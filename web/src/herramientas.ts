import type MapBrowserEvent from 'ol/MapBrowserEvent';
import type Point from 'ol/geom/Point';
import DragBox from 'ol/interaction/DragBox';
import Draw from 'ol/interaction/Draw';
import GeoJSON from 'ol/format/GeoJSON';
import { getLength } from 'ol/sphere';
import { URL_WFS, WORKSPACE } from './config';
import { capasVisibles, type Visor } from './visor';

export type Modo = 'navegar' | 'punto' | 'rectangulo' | 'medir' | 'alta';

export const HERRAMIENTAS: Record<Modo, { titulo: string; ayuda: string }> = {
  navegar: { titulo: 'Navegar', ayuda: 'Arrastrá para moverte, rueda para zoom.' },
  punto: { titulo: 'Consulta por punto', ayuda: 'Hacé clic sobre una entidad.' },
  rectangulo: { titulo: 'Consulta por rectángulo', ayuda: 'Arrastrá un rectángulo. Consulta la capa visible de más arriba.' },
  medir: { titulo: 'Medir distancia', ayuda: 'Clic para cada vértice, doble clic para terminar.' },
  alta: { titulo: 'Nueva obra RN11', ayuda: 'Hacé clic donde está la obra.' },
};

interface Avisos {
  mostrar: (texto: string) => void;
  nuevaObra: (punto: Point) => void;
}

interface FeatureGeoJSON {
  id: string;
  properties: Record<string, unknown>;
}

// Activa la herramienta y devuelve la función que la desactiva (la usa el useEffect de App).
export function activarHerramienta(visor: Visor, modo: Modo, avisos: Avisos): () => void {
  const { mapa, dibujo } = visor;
  dibujo.clear();

  if (modo === 'punto') {
    const alHacerClic = (e: MapBrowserEvent) => consultarPunto(visor, e.coordinate, avisos.mostrar);
    mapa.on('singleclick', alHacerClic);
    return () => mapa.un('singleclick', alHacerClic);
  }

  let interaccion: DragBox | Draw;
  if (modo === 'rectangulo') {
    const caja = new DragBox({ condition: () => true });
    caja.on('boxend', () => consultarRectangulo(visor, caja.getGeometry().getExtent(), avisos.mostrar));
    interaccion = caja;
  } else if (modo === 'medir') {
    // Medición geodésica: ni en grados ni en metros de Mercator.
    interaccion = new Draw({ source: dibujo, type: 'LineString' });
    interaccion.on('drawstart', () => dibujo.clear());
    interaccion.on('drawend', e => {
      avisos.mostrar(`Distancia: ${(getLength(e.feature.getGeometry()!) / 1000).toFixed(2)} km`);
    });
  } else if (modo === 'alta') {
    interaccion = new Draw({ source: dibujo, type: 'Point' });
    interaccion.on('drawstart', () => dibujo.clear());
    interaccion.on('drawend', e => avisos.nuevaObra(e.feature.getGeometry() as Point));
  } else {
    return () => {};
  }
  mapa.addInteraction(interaccion);
  return () => {
    mapa.removeInteraction(interaccion);
    dibujo.clear();
  };
}

// WMS GetFeatureInfo sobre todas las capas visibles.
async function consultarPunto(visor: Visor, coordenada: number[], mostrar: Avisos['mostrar']) {
  const capas = capasVisibles(visor).map(n => `${WORKSPACE}:${n}`).join(',');
  if (!capas) return mostrar('No hay capas visibles.');
  const url = visor.capas[0].getSource()!.getFeatureInfoUrl(
    coordenada, visor.mapa.getView().getResolution()!, 'EPSG:3857',
    { LAYERS: capas, QUERY_LAYERS: capas, INFO_FORMAT: 'application/json', FEATURE_COUNT: 5 },
  )!;
  const datos = await (await fetch(url)).json();
  mostrar(resaltar(visor, datos));
}

// WFS GetFeature con BBOX sobre la capa visible de más arriba, con límite de entidades.
async function consultarRectangulo(visor: Visor, extension: number[], mostrar: Avisos['mostrar']) {
  const capa = capasVisibles(visor).at(-1);
  if (!capa) return mostrar('No hay capas visibles.');
  const url = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:${capa}`
    + `&outputFormat=application/json&srsName=EPSG:3857&count=50&bbox=${extension.join(',')},EPSG:3857`;
  const datos = await (await fetch(url)).json();
  mostrar(`${capa}: ${datos.numberMatched} entidades (se muestran ${datos.features.length})\n\n` + resaltar(visor, datos));
}

// Dibuja las entidades en rojo y devuelve sus atributos como texto.
function resaltar(visor: Visor, datos: { features: FeatureGeoJSON[] }): string {
  visor.dibujo.clear();
  visor.dibujo.addFeatures(new GeoJSON().readFeatures(datos, { dataProjection: 'EPSG:3857' }));
  if (!datos.features.length) return 'Sin resultados.';
  return datos.features.map(f => f.id + '\n' + Object.entries(f.properties)
    .filter(([, v]) => v !== null && v !== '')
    .map(([k, v]) => `  ${k}: ${v}`).join('\n')).join('\n\n');
}
