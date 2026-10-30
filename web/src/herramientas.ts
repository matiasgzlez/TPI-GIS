import type Feature from 'ol/Feature';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import Overlay from 'ol/Overlay';
import type Point from 'ol/geom/Point';
import type { Geometry, LineString, Polygon } from 'ol/geom';
import DragBox from 'ol/interaction/DragBox';
import Draw from 'ol/interaction/Draw';
import GeoJSON from 'ol/format/GeoJSON';
import { getArea, getLength } from 'ol/sphere';
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import { URL_WFS, WORKSPACE, tituloDeCapa } from './config';
import { capasVisibles, estiloDibujo, urlConsultaPunto, type Visor } from './visor';

export type Modo = 'navegar' | 'punto' | 'rectangulo' | 'distancia' | 'area' | 'alta';

export const HERRAMIENTAS: Record<Modo, { titulo: string; corto: string; ayuda: string; tecla: string }> = {
  navegar: { titulo: 'Navegar', corto: 'Navegar', ayuda: 'Arrastrá para moverte · rueda o pellizco para acercar', tecla: '1' },
  punto: { titulo: 'Consulta por punto', corto: 'Punto', ayuda: 'Hacé clic sobre el mapa para ver qué hay en ese lugar', tecla: '2' },
  rectangulo: { titulo: 'Consulta por rectángulo', corto: 'Rectángulo', ayuda: 'Arrastrá un rectángulo: se consultan todas las capas visibles', tecla: '3' },
  distancia: { titulo: 'Medir distancia', corto: 'Distancia', ayuda: 'Clic en cada vértice · doble clic para terminar', tecla: '4' },
  area: { titulo: 'Medir área', corto: 'Área', ayuda: 'Clic en cada vértice · doble clic para cerrar el polígono', tecla: '5' },
  alta: { titulo: 'Nueva obra', corto: 'Nueva obra', ayuda: 'Hacé clic sobre la traza donde va la obra', tecla: '6' },
};

export interface Entidad {
  id: string;
  atributos: [string, string][];
  feature: Feature<Geometry>;
}

export interface ResultadoCapa {
  capa: string;
  titulo: string;
  total: number;
  entidades: Entidad[];
}

export interface Consulta {
  origen: 'punto' | 'rectangulo' | 'lenguaje';
  capas: ResultadoCapa[];
  // Consultas en lenguaje natural: la pregunta como la entendió el visor.
  titulo?: string;
}

export interface Medicion {
  tipo: 'distancia' | 'area';
  texto: string;
  terminada: boolean;
}

export interface Avisos {
  consultando: (origen: Consulta['origen']) => void;
  consulta: (consulta: Consulta) => void;
  error: (mensaje: string) => void;
  medicion: (medicion: Medicion | null) => void;
  nuevaObra: (punto: Point) => void;
}

const LIMITE_POR_CAPA = 50;

// Activa la herramienta y devuelve la función que la desactiva (la usa el useEffect de App).
export function activarHerramienta(visor: Visor, modo: Modo, avisos: Avisos): () => void {
  const { mapa, dibujo } = visor;
  dibujo.clear();

  if (modo === 'punto') {
    const alHacerClic = (e: MapBrowserEvent) => {
      avisos.consultando('punto');
      consultarPunto(visor, e.coordinate).then(avisos.consulta, e => avisos.error(String(e)));
    };
    mapa.on('singleclick', alHacerClic);
    return () => mapa.un('singleclick', alHacerClic);
  }

  if (modo === 'rectangulo') {
    const caja = new DragBox({ condition: () => true, className: 'caja-consulta' });
    caja.on('boxend', () => {
      avisos.consultando('rectangulo');
      consultarRectangulo(visor, caja.getGeometry().getExtent()).then(avisos.consulta, e => avisos.error(String(e)));
    });
    mapa.addInteraction(caja);
    return () => mapa.removeInteraction(caja);
  }

  if (modo === 'distancia' || modo === 'area') return activarMedicion(visor, modo, avisos);

  if (modo === 'alta') {
    const dibujar = new Draw({ source: dibujo, type: 'Point', style: estiloDibujo });
    dibujar.on('drawstart', () => dibujo.clear());
    dibujar.on('drawend', e => avisos.nuevaObra(e.feature.getGeometry() as Point));
    mapa.addInteraction(dibujar);
    return () => {
      mapa.removeInteraction(dibujar);
      dibujo.clear();
    };
  }

  return () => {};
}

// Medición geodésica (ni en grados ni en metros de Mercator), con una etiqueta que sigue al dibujo.
function activarMedicion(visor: Visor, tipo: 'distancia' | 'area', avisos: Avisos) {
  const { mapa, dibujo } = visor;
  const etiqueta = document.createElement('div');
  etiqueta.className = 'etiqueta-medida';
  const overlay = new Overlay({ element: etiqueta, offset: [14, -14], positioning: 'bottom-left', stopEvent: false });
  mapa.addOverlay(overlay);

  const dibujar = new Draw({ source: dibujo, type: tipo === 'distancia' ? 'LineString' : 'Polygon', style: estiloDibujo });
  let escucha: EventsKey | undefined;

  const medir = (geometria: Geometry, terminada: boolean) => {
    const texto = tipo === 'distancia' ? formatoDistancia(getLength(geometria)) : formatoArea(getArea(geometria));
    etiqueta.textContent = texto;
    etiqueta.classList.toggle('terminada', terminada);
    const punto = tipo === 'distancia'
      ? (geometria as LineString).getLastCoordinate()
      : (geometria as Polygon).getInteriorPoint().getCoordinates();
    overlay.setPosition(punto);
    avisos.medicion({ tipo, texto, terminada });
  };

  dibujar.on('drawstart', e => {
    dibujo.clear();
    const geometria = e.feature.getGeometry()!;
    escucha = geometria.on('change', () => medir(geometria, false));
  });
  dibujar.on('drawend', e => {
    if (escucha) unByKey(escucha);
    medir(e.feature.getGeometry()!, true);
  });
  mapa.addInteraction(dibujar);

  return () => {
    if (escucha) unByKey(escucha);
    mapa.removeInteraction(dibujar);
    mapa.removeOverlay(overlay);
    dibujo.clear();
    avisos.medicion(null);
  };
}

export function formatoDistancia(metros: number) {
  return metros < 1000
    ? `${Math.round(metros).toLocaleString('es-AR')} m`
    : `${(metros / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} km`;
}

export function formatoArea(m2: number) {
  if (m2 < 10_000) return `${Math.round(m2).toLocaleString('es-AR')} m²`;
  if (m2 < 1_000_000) return `${(m2 / 10_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} ha`;
  return `${(m2 / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} km²`;
}

interface FeatureGeoJSON {
  id: string;
  properties: Record<string, unknown>;
}

// WMS GetFeatureInfo sobre todas las capas visibles; GeoServer devuelve hasta 10 entidades.
async function consultarPunto(visor: Visor, coordenada: number[]): Promise<Consulta> {
  const nombres = capasVisibles(visor);
  if (!nombres.length) return { origen: 'punto', capas: [] };
  const datos = await pedirJson(urlConsultaPunto(visor, coordenada, nombres));
  const porCapa = new Map<string, FeatureGeoJSON[]>();
  for (const f of datos.features as FeatureGeoJSON[]) {
    const capa = f.id.split('.')[0];
    porCapa.set(capa, [...(porCapa.get(capa) ?? []), f]);
  }
  // Mismo orden que el panel de capas: la de más arriba primero.
  const orden = [...nombres].reverse();
  const capasConResultado = [...porCapa.entries()]
    .sort(([a], [b]) => orden.indexOf(a) - orden.indexOf(b))
    .map(([capa, features]) => armarResultado(capa, features.length, { ...datos, features }));
  return { origen: 'punto', capas: mostrar(visor, capasConResultado) };
}

// WFS GetFeature con BBOX, una consulta por cada capa visible y un límite de entidades por capa.
async function consultarRectangulo(visor: Visor, extension: number[]): Promise<Consulta> {
  const nombres = [...capasVisibles(visor)].reverse();
  const resultados = await Promise.all(nombres.map(async capa => {
    const url = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:${capa}`
      + `&outputFormat=application/json&srsName=EPSG:3857&count=${LIMITE_POR_CAPA}&bbox=${extension.join(',')},EPSG:3857`;
    const datos = await pedirJson(url);
    return armarResultado(capa, datos.numberMatched ?? datos.features.length, datos);
  }));
  return { origen: 'rectangulo', capas: mostrar(visor, resultados.filter(r => r.total > 0)) };
}

// Una capa dentro de una extensión (la vista actual): lo usan las consultas predichas.
export async function consultarCapaEnExtension(visor: Visor, capa: string, extension: number[]): Promise<Consulta> {
  const url = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:${capa}`
    + `&outputFormat=application/json&srsName=EPSG:3857&count=${LIMITE_POR_CAPA}&bbox=${extension.join(',')},EPSG:3857`;
  const datos = await pedirJson(url);
  const resultado = armarResultado(capa, datos.numberMatched ?? datos.features.length, datos);
  return { origen: 'rectangulo', titulo: `${tituloDeCapa(capa)} en esta vista`, capas: mostrar(visor, resultado.total ? [resultado] : []) };
}

async function pedirJson(url: string) {
  const respuesta = await fetch(url);
  const texto = await respuesta.text();
  if (!respuesta.ok || texto.startsWith('<')) throw new Error('GeoServer no pudo responder la consulta.');
  return JSON.parse(texto);
}

// Campos técnicos del IGN (identificadores, metadatos de carga, símbolos de MicroStation) que no le
// dicen nada a quien consulta el mapa.
const OCULTOS = new Set([
  'gid', 'id', 'fid', 'objectid', 'cell_name', 'group', 'rotation', 'shape_leng', 'shape_area', 'length',
  'signo', 'operador', 'responsabl', 'cargo', 'dataset', 'fclass', 'sp', 'datum', 'ac', 't_act', 'coord', 'progreso', 'actualizac',
]);

export function armarResultado(capa: string, total: number, datos: { features: FeatureGeoJSON[] }): ResultadoCapa {
  const features = new GeoJSON().readFeatures(datos, { dataProjection: 'EPSG:3857' });
  return {
    capa,
    titulo: tituloDeCapa(capa),
    total,
    entidades: datos.features.map((f, i) => ({
      id: f.id,
      feature: features[i],
      atributos: Object.entries(f.properties)
        .filter(([k, v]) => v !== null && v !== '' && !OCULTOS.has(k) && !k.startsWith('igds_'))
        .map(([k, v]) => [k, typeof v === 'number' ? v.toLocaleString('es-AR') : String(v)]),
    })),
  };
}

// Las capas que cubren todo (provincias, países) se listan pero no se resaltan: su contorno taparía
// lo que de verdad se consultó.
const SIN_RESALTAR = new Set(['provincias', 'pais_lim']);

export function mostrar(visor: Visor, capas: ResultadoCapa[]) {
  visor.resaltado.clear();
  visor.foco.clear();
  visor.resaltado.addFeatures(capas.filter(c => !SIN_RESALTAR.has(c.capa)).flatMap(c => c.entidades.map(e => e.feature)));
  return capas;
}
