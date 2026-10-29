import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Graticule from 'ol/layer/Graticule';
import TileWMS from 'ol/source/TileWMS';
import TileState from 'ol/TileState';
import type ImageTile from 'ol/ImageTile';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { getLength } from 'ol/sphere';
import { getPointResolution, toLonLat } from 'ol/proj';
import { getCenter } from 'ol/extent';
import type { Coordinate } from 'ol/coordinate';
import { Circle, Fill, Stroke, Style, Text } from 'ol/style';
import { sldDeCapas, sldDeLeyenda } from './estilos';
import { CAPAS, EXTENSION_CHACO, FILTRO_RN11, URL_WFS, URL_WMS, WORKSPACE } from './config';

// Todo lo que las herramientas y los paneles necesitan del mapa.
export interface Visor {
  mapa: Map;
  // Las capas prendidas de GeoServer se piden juntas: una imagen por tesela, no una por capa.
  wms: TileLayer<TileWMS>;
  visibles: Set<string>;
  suscriptores: Set<() => void>;
  // Entidades devueltas por una consulta.
  resaltado: VectorSource;
  // La entidad bajo el cursor en el panel de resultados.
  foco: VectorSource;
  // Lo que dibuja el usuario: medición o el punto de una obra nueva.
  dibujo: VectorSource;
  rn11: VectorLayer<VectorSource>;
  cuadricula: Graticule;
}

// Orden de dibujo: provincias y países abajo, después polígonos, líneas, puntos y las obras arriba.
const PESO: Record<string, number> = { provincias: 0, pais_lim: 0, obras_rn11: 9 };
const PESO_GEOMETRIA = { poligono: 1, linea: 2, punto: 3 };
const orden = (nombre: string) => {
  const capa = CAPAS.find(c => c.nombre === nombre)!;
  return (PESO[nombre] ?? PESO_GEOMETRIA[capa.geometria]) * 100 + CAPAS.indexOf(capa);
};

export const CAPAS_INICIALES = CAPAS.filter(c => c.visible).map(c => c.nombre);


// Colores de las capas propias del visor. Se leen de las variables CSS del tema activo.
const paleta = { acento: '#e5521f', tinta: '#15171a', papel: '#eceeeb', grilla: 'rgba(21,23,26,.06)' };

function leerPaleta() {
  const css = getComputedStyle(document.documentElement);
  const v = (nombre: string) => css.getPropertyValue(nombre).trim();
  paleta.acento = v('--vial') || paleta.acento;
  paleta.tinta = v('--tinta') || paleta.tinta;
  paleta.papel = v('--papel') || paleta.papel;
  paleta.grilla = v('--grilla') || paleta.grilla;
}

const estiloResaltado = () => [
  new Style({
    stroke: new Stroke({ color: paleta.papel, width: 6 }),
    image: new Circle({ radius: 9, fill: new Fill({ color: paleta.papel }) }),
  }),
  new Style({
    // Contorno con un velo mínimo: una provincia resaltada no puede tapar el mapa.
    stroke: new Stroke({ color: paleta.acento, width: 2.5 }),
    fill: new Fill({ color: hacerTransparente(paleta.acento, 0.05) }),
    image: new Circle({ radius: 6, fill: new Fill({ color: paleta.acento }), stroke: new Stroke({ color: paleta.papel, width: 2 }) }),
  }),
];

const estiloFoco = () => [
  new Style({
    stroke: new Stroke({ color: hacerTransparente(paleta.acento, 0.25), width: 14 }),
    image: new Circle({ radius: 16, fill: new Fill({ color: hacerTransparente(paleta.acento, 0.22) }) }),
  }),
  new Style({
    stroke: new Stroke({ color: paleta.tinta, width: 2.5 }),
    fill: new Fill({ color: hacerTransparente(paleta.acento, 0.12) }),
    image: new Circle({ radius: 7, fill: new Fill({ color: paleta.tinta }), stroke: new Stroke({ color: paleta.papel, width: 2.5 }) }),
  }),
];

// La RN11 se dibuja como una ruta señalizada: halo del color del papel y trazo vial encima.
const estiloRn11 = () => [
  new Style({ stroke: new Stroke({ color: hacerTransparente(paleta.acento, 0.18), width: 18, lineCap: 'round', lineJoin: 'round' }) }),
  new Style({ stroke: new Stroke({ color: paleta.papel, width: 8, lineCap: 'round', lineJoin: 'round' }) }),
  new Style({ stroke: new Stroke({ color: paleta.acento, width: 4, lineCap: 'round', lineJoin: 'round' }) }),
];

export const estiloDibujo = () => [
  new Style({
    stroke: new Stroke({ color: paleta.papel, width: 6 }),
    image: new Circle({ radius: 9, fill: new Fill({ color: paleta.papel }) }),
  }),
  new Style({
    stroke: new Stroke({ color: paleta.tinta, width: 2.5, lineDash: [7, 6] }),
    fill: new Fill({ color: hacerTransparente(paleta.acento, 0.12) }),
    image: new Circle({ radius: 6, fill: new Fill({ color: paleta.acento }), stroke: new Stroke({ color: paleta.papel, width: 2.5 }) }),
  }),
];

function crearCuadricula() {
  const etiqueta = (offsetX: number, offsetY: number, align: CanvasTextAlign) => new Text({
    font: '500 11px "Instrument Sans Variable", sans-serif',
    fill: new Fill({ color: hacerTransparente(paleta.tinta, 0.55) }),
    stroke: new Stroke({ color: paleta.papel, width: 3 }),
    offsetX, offsetY, textAlign: align,
  });
  return new Graticule({
    strokeStyle: new Stroke({ color: paleta.grilla, width: 1 }),
    showLabels: true,
    wrapX: false,
    lonLabelPosition: 0.02,
    latLabelPosition: 0.985,
    lonLabelStyle: etiqueta(0, 0, 'center'),
    latLabelStyle: etiqueta(-4, 0, 'right'),
    zIndex: 5,
  });
}

// El SLD de las capas prendidas (5–6 KB) no viaja en la URL sino en el cuerpo de un POST: sumado a
// las cookies que el navegador manda a localhost pasaba el límite de cabeceras de Node y de Tomcat
// (error 431) y el mapa quedaba vacío. En la URL va solo un hash del estilo, que distingue cada
// combinación de capas para la caché de nginx.
let sldActual = '';

function cargarTesela(tesela: ImageTile, url: string) {
  const imagen = tesela.getImage() as HTMLImageElement;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ SLD_BODY: sldActual }),
  })
    .then(respuesta => {
      if (!respuesta.ok || !respuesta.headers.get('content-type')?.startsWith('image/')) throw new Error(String(respuesta.status));
      return respuesta.blob();
    })
    .then(blob => {
      const direccion = URL.createObjectURL(blob);
      imagen.onload = () => URL.revokeObjectURL(direccion);
      imagen.src = direccion;
    })
    .catch(() => tesela.setState(TileState.ERROR));
}

function hashCorto(texto: string) {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function crearCapaWms() {
  return new TileLayer({
    // Las teselas WMS tienen un canvas con clase propia: en tema oscuro se invierten por CSS.
    className: 'capa-wms',
    zIndex: 10,
    // Mientras llegan las teselas nuevas se ve el nivel de menor resolución, no huecos.
    preload: 1,
    source: new TileWMS({
      url: URL_WMS,
      params: { TILED: true },
      transition: 200,
      tileLoadFunction: (tesela, url) => cargarTesela(tesela as ImageTile, url),
    }),
  });
}

export function crearVisor(destino: HTMLElement): Visor {
  leerPaleta();
  const wms = crearCapaWms();
  const resaltado = new VectorSource();
  const foco = new VectorSource();
  const dibujo = new VectorSource();
  const rn11 = new VectorLayer({ source: new VectorSource(), style: estiloRn11, zIndex: 35, visible: false });
  const cuadricula = crearCuadricula();

  const mapa = new Map({
    target: destino,
    layers: [
      cuadricula,
      wms,
      rn11,
      new VectorLayer({ source: resaltado, style: estiloResaltado, zIndex: 50 }),
      new VectorLayer({ source: foco, style: estiloFoco, zIndex: 55 }),
      new VectorLayer({ source: dibujo, style: estiloDibujo, zIndex: 60 }),
    ],
    view: new View({ maxZoom: 19, minZoom: 3 }),
    controls: [],
  });
  // Arranca un nivel por encima de Chaco y centrado en Chaco: la entrada es un zoom puro, así las
  // teselas agrandadas coinciden con las nuevas. Sin size, fit() usa 100 px porque el mapa no se dibujó.
  const vista = mapa.getView();
  vista.fit(EXTENSION_CHACO, { size: mapa.getSize(), padding: margenesMapa() });
  vista.setZoom(vista.getZoom()! - 1);
  vista.setCenter(getCenter(EXTENSION_CHACO));

  const visor: Visor = { mapa, wms, visibles: new Set(CAPAS_INICIALES), suscriptores: new Set(), resaltado, foco, dibujo, rn11, cuadricula };
  actualizarWms(visor);
  return visor;
}

// --- Capas prendidas ---

export const capasVisibles = (visor: Visor) => [...visor.visibles].sort((a, b) => orden(a) - orden(b));

export function suscribirCapas(visor: Visor, aviso: () => void) {
  visor.suscriptores.add(aviso);
  return () => {
    visor.suscriptores.delete(aviso);
  };
}

export function cambiarCapas(visor: Visor, nombres: string[], visible: boolean) {
  nombres.forEach(n => (visible ? visor.visibles.add(n) : visor.visibles.delete(n)));
  actualizarWms(visor);
}

export function restablecerCapas(visor: Visor) {
  visor.visibles = new Set(CAPAS_INICIALES);
  actualizarWms(visor);
}

function actualizarWms(visor: Visor) {
  const nombres = capasVisibles(visor);
  visor.wms.setVisible(nombres.length > 0);
  if (nombres.length) {
    sldActual = sldDeCapas(nombres);
    visor.wms.getSource()!.updateParams({ ESTILO: hashCorto(sldActual) });
  }
  visor.suscriptores.forEach(aviso => aviso());
}

// Después de un WFS-T: el parámetro nuevo hace que se pidan teselas nuevas (y saltea la caché).
export function refrescarMapa(visor: Visor) {
  visor.wms.getSource()!.updateParams({ _: Date.now() });
}

// GetFeatureInfo sin estilos: con una fuente aparte, solo para armar la URL.
const fuenteConsulta = new TileWMS({ url: URL_WMS, params: {} });
export function urlConsultaPunto(visor: Visor, coordenada: Coordinate, nombres: string[]) {
  const capas = nombres.map(n => `${WORKSPACE}:${n}`).join(',');
  return fuenteConsulta.getFeatureInfoUrl(coordenada, visor.mapa.getView().getResolution()!, 'EPSG:3857', {
    LAYERS: capas, QUERY_LAYERS: capas, INFO_FORMAT: 'application/json', FEATURE_COUNT: 10,
  })!;
}

// Al cambiar de tema: la cuadrícula se rehace (sus estilos no se pueden cambiar) y el resto se redibuja.
export function aplicarTema(visor: Visor) {
  leerPaleta();
  const capas = visor.mapa.getLayers();
  const indice = capas.getArray().indexOf(visor.cuadricula);
  visor.cuadricula = crearCuadricula();
  capas.setAt(indice, visor.cuadricula);
  visor.mapa.getAllLayers().forEach(c => c.changed());
}

// Leyenda de GeoServer. En tema oscuro se invierte por CSS igual que el mapa (.leyenda-wms).
// Las capas con estilo propio mandan su SLD por POST, por el mismo límite de cabeceras que las teselas.
export async function cargarLeyenda(nombre: string, señal: AbortSignal): Promise<string> {
  const opciones = ['fontName:Helvetica', 'fontAntiAliasing:true', 'fontSize:12', 'dx:8', 'forceLabels:on', 'fontColor:0x2A2E33'].join(';');
  const url = `${URL_WMS}?service=WMS&request=GetLegendGraphic&format=image/png&transparent=true`
    + `&width=18&height=18&layer=${nombre}&legend_options=${opciones}`;
  const sld = sldDeLeyenda(nombre);
  if (!sld) return url;
  const respuesta = await fetch(url, { method: 'POST', body: new URLSearchParams({ SLD_BODY: sld }), signal: señal });
  return URL.createObjectURL(await respuesta.blob());
}

// Denominador de escala corregido por latitud (Mercator agranda hacia los polos).
export function denominadorEscala(mapa: Map): number {
  const vista = mapa.getView();
  const resolucion = getPointResolution('EPSG:3857', vista.getResolution()!, vista.getCenter()!);
  return Math.round(resolucion / 0.00028);
}

export function formatoCoordenada(coordenada: Coordinate) {
  const [lon, lat] = toLonLat(coordenada);
  const gms = (valor: number, pos: string, neg: string) => {
    const abs = Math.abs(valor);
    const g = Math.floor(abs);
    const m = Math.floor((abs - g) * 60);
    const s = Math.round(((abs - g) * 60 - m) * 60);
    return `${g}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${valor < 0 ? neg : pos}`;
  };
  return `${gms(lat, 'N', 'S')}  ${gms(lon, 'E', 'O')}`;
}

const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function volarA(visor: Visor, extension: number[], opciones: { maxZoom?: number; duracion?: number } = {}) {
  const vista = visor.mapa.getView();
  vista.cancelAnimations();
  vista.fit(extension, {
    size: visor.mapa.getSize(),
    padding: margenesMapa(),
    maxZoom: opciones.maxZoom ?? 14,
    duration: reducido() ? 0 : opciones.duracion ?? 900,
  });
}

export const verChaco = (visor: Visor, duracion?: number) => volarA(visor, EXTENSION_CHACO, { duracion });

// Los paneles tapan los bordes del mapa: el encuadre deja ese espacio libre.
function margenesMapa(): [number, number, number, number] {
  if (window.innerWidth < 768) return [150, 20, 190, 20];
  return [110, 120, 130, 400];
}

// Polígono de Chaco simplificado en WKT. GeoServer no tiene la extensión querylayer, así que el
// recorte de la RN11 va como geometría literal. En CQL sobre EPSG:4326 el orden es latitud longitud.
async function wktChaco(): Promise<string> {
  const url = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:provincias`
    + `&outputFormat=application/json&srsName=CRS:84&CQL_FILTER=${encodeURIComponent("provincia = 'Chaco'")}`;
  const datos = await (await fetch(url)).json();
  const geometria = datos.features[0].geometry;
  const poligonos: number[][][][] = geometria.type === 'MultiPolygon' ? geometria.coordinates : [geometria.coordinates];
  const anillo = poligonos.map(p => p[0]).reduce((a, b) => (b.length > a.length ? b : a));
  const paso = Math.max(1, Math.floor(anillo.length / 120));
  const puntos = [...anillo.filter((_, i) => i % paso === 0), anillo[0]];
  return `POLYGON((${puntos.map(([x, y]) => `${y.toFixed(4)} ${x.toFixed(4)}`).join(',')}))`;
}

// Trae la traza de la RN11 en Chaco (68 tramos, los mismos de la consulta SQL de la parte B).
export async function cargarRn11(visor: Visor): Promise<{ tramos: number; km: number }> {
  const fuente = visor.rn11.getSource()!;
  if (!fuente.getFeatures().length) {
    const filtro = `${FILTRO_RN11} AND INTERSECTS(geom, ${await wktChaco()})`;
    const url = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:red_vial`
      + `&outputFormat=application/json&srsName=EPSG:3857&propertyName=geom,nombre,tipo&CQL_FILTER=${encodeURIComponent(filtro)}`;
    const datos = await (await fetch(url)).json();
    fuente.addFeatures(new GeoJSON().readFeatures(datos, { dataProjection: 'EPSG:3857' }));
  }
  const km = fuente.getFeatures().reduce((total, f) => total + getLength(f.getGeometry()!), 0) / 1000;
  return { tramos: fuente.getFeatures().length, km };
}

// El canvas no garantiza entender color-mix(): las variables del tema van en hex y se pasan a rgba.
function hacerTransparente(hex: string, alfa: number) {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
}
