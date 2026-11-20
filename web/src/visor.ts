import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Graticule from 'ol/layer/Graticule';
import TileWMS from 'ol/source/TileWMS';
import TileState from 'ol/TileState';
import type ImageTile from 'ol/ImageTile';
import VectorSource from 'ol/source/Vector';
import { get as proyeccion, getPointResolution, toLonLat, fromLonLat } from 'ol/proj';
import { createXYZ } from 'ol/tilegrid';
import { getCenter } from 'ol/extent';
import Feature from 'ol/Feature';
import { LineString, MultiLineString, MultiPoint, Point } from 'ol/geom';
import type { Geometry } from 'ol/geom';
import type { Coordinate } from 'ol/coordinate';
import { Circle, Fill, Icon, RegularShape, Stroke, Style, Text } from 'ol/style';
import { getRenderPixel, getVectorContext } from 'ol/render';
import type BaseLayer from 'ol/layer/Base';
import type Layer from 'ol/layer/Layer';
import type { FrameState } from 'ol/Map';
import { apply as aplicarTransformacion } from 'ol/transform';
import type RenderEvent from 'ol/render/Event';
import { ponerFactorMapa, sldDeCapas, sldDeLeyenda, tamanoMapa } from './estilos';
import { escalaActual, factorPantalla, movimientoReducido } from './preferencias';
import { CAPAS, EXTENSION_CHACO, URL_WMS } from './config';
import { claveRuta, type Ruta, type Traza } from './analisisRuta';
import { CAPITALES, PROVINCIAS } from './provincias';
import type Heatmap from 'ol/layer/Heatmap';
import type LayerGroup from 'ol/layer/Group';
import LayerGroupClase from 'ol/layer/Group';
import { calorDe } from './calor';

// Todo lo que las herramientas y los paneles necesitan del mapa.
export interface Visor {
  mapa: Map;
  // Las capas prendidas de GeoServer se piden juntas: una imagen por tesela, no una por capa.
  wms: TileLayer<TileWMS>;
  visibles: Set<string>;
  // Capas con opacidad propia (menos de 1): salen de la imagen combinada a una capa WMS cada una.
  opacidades: Record<string, number>;
  sueltas: Record<string, TileLayer<TileWMS>>;
  suscriptores: Set<() => void>;
  // Entidades devueltas por una consulta.
  resaltado: VectorSource;
  // La entidad bajo el cursor en el panel de resultados.
  foco: VectorSource;
  // Lo que dibuja el usuario: medición o el punto de una obra nueva.
  dibujo: VectorSource;
  // La ruta nacional elegida (la RN11 u otra con doble clic), dibujada como ruta señalizada.
  ruta: VectorLayer<VectorSource>;
  // Tablero de la ruta: bandas de 10 y 20 km, localidades por franja y puentes.
  analisis: VectorSource;
  cuadricula: Graticule;
  // Nombres de provincia, pintados en el cliente (en teselas WMS se repetían en cada una).
  rotulos: VectorLayer<VectorSource>;
  // Nombres de las capitales, también en el cliente (en el borde entre teselas GeoServer los descartaba).
  capitales: VectorLayer<VectorSource>;
  lucesCapitales: VectorLayer<VectorSource>;
  // Capas cuyos rótulos del WMS se callan (con el tablero abierto, localidades: los pinta el visor).
  sinRotulos: Set<string>;
  // Capas de puntos vistas como mapa de calor (T3): salen del WMS y se dibujan como manchas. null: el
  // calor ya está elegido y su capa (con WebGL, carga diferida) todavía está en camino.
  calor: globalThis.Map<string, LayerGroup | null>;
  // Comparador (T6): la cortina. A la izquierda, el mapa de siempre (las capas prendidas); a la derecha,
  // otro juego de capas, en su propia capa WMS. null: sin cortina.
  comparacion: Comparacion | null;
  wmsDerecha: TileLayer<TileWMS>;
}

export interface Comparacion {
  derecha: string[];
  // Dónde está el corte, como fracción del ancho del mapa (la cortina queda fija en la pantalla al moverse).
  fraccion: number;
  // Cómo se llama cada lado (para la hoja impresa).
  titulos: [string, string];
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
const paleta = { acento: '#e5521f', tinta: '#15171a', papel: '#eceeeb', grilla: 'rgba(21,23,26,.06)', dato1: '#c2410c', dato2: '#ec8455' };

function leerPaleta() {
  const css = getComputedStyle(document.documentElement);
  const v = (nombre: string) => css.getPropertyValue(nombre).trim();
  paleta.acento = v('--vial') || paleta.acento;
  paleta.tinta = v('--tinta') || paleta.tinta;
  paleta.papel = v('--papel') || paleta.papel;
  paleta.grilla = v('--grilla') || paleta.grilla;
  paleta.dato1 = v('--dato-1') || paleta.dato1;
  paleta.dato2 = v('--dato-2') || paleta.dato2;
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

// El resaltado del escritorio del modo simple (lo que se apunta en "¿Qué hay acá?"): una línea como un trazo
// de marcador, naranja y con puntas redondas, sobre un borde del color del papel (se despega de las rutas
// naranjas del mapa) y un resplandor suave; un punto en cada punta para ver dónde empieza y termina. Al
// aparecer la recorre una luz (cometa, en latir). Un lugar: punto naranja con aro claro y un halo.
let focoSimple = false;
export const usarFocoSimple = (visor: Visor, simple: boolean) => { if (focoSimple !== simple) { focoSimple = simple; visor.foco.changed(); } };
const lineasDe = (g: Geometry | undefined): LineString[] =>
  g instanceof LineString ? [g] : g instanceof MultiLineString ? g.getLineStrings() : [];
const puntas = (f: import('ol/Feature').FeatureLike) => {
  const lineas = lineasDe(f.getGeometry() as Geometry | undefined);
  return lineas.length ? new MultiPoint(lineas.flatMap(l => [l.getFirstCoordinate(), l.getLastCoordinate()])) : undefined;
};
function estiloFocoGrande(feature: import('ol/Feature').FeatureLike) {
  const t = tamanoMapa;
  const redondo = { lineCap: 'round', lineJoin: 'round' } as const;
  return [
    new Style({
      zIndex: 1,
      stroke: new Stroke({ color: hacerTransparente(paleta.acento, 0.16), width: t(22), ...redondo }),
      image: new Circle({ radius: t(22), fill: new Fill({ color: hacerTransparente(paleta.acento, 0.18) }) }),
    }),
    new Style({ zIndex: 2, stroke: new Stroke({ color: paleta.papel, width: t(9.5), ...redondo }), fill: new Fill({ color: hacerTransparente(paleta.acento, 0.1) }) }),
    new Style({
      zIndex: 3,
      stroke: new Stroke({ color: paleta.acento, width: t(5), ...redondo }),
      image: new Circle({ radius: t(8.5), fill: new Fill({ color: paleta.acento }), stroke: new Stroke({ color: paleta.papel, width: t(3.5) }) }),
    }),
    new Style({
      zIndex: 4,
      geometry: puntas,
      image: new Circle({ radius: t(6), fill: new Fill({ color: paleta.papel }), stroke: new Stroke({ color: paleta.acento, width: t(3.5) }) }),
    }),
  ];
}

const estiloFoco = (feature: import('ol/Feature').FeatureLike, resolucion: number) => {
  if (focoSimple && !feature.get('elegida')) return estiloFocoGrande(feature);
  const estilos = [
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
  // Localidad elegida en el tablero: etiqueta con fondo a la derecha del punto, que tapa el rótulo del
  // WMS (va en el mismo lugar) en vez de duplicarlo, y queda por encima de la traza.
  // Igual que las burbujas, se calla más lejos que 1:5.000.000.
  if (feature.get('elegida') && resolucion <= 1500) {
    const habitantes = Number(feature.get('habitantes')) || 0;
    estilos.push(new Style({
      text: new Text({
        text: habitantes ? `${feature.get('nombre')} · ${habitantes.toLocaleString('es-AR')} hab.` : String(feature.get('nombre') ?? ''),
        font: `600 ${tamanoMapa(12.5)}px "Instrument Sans Variable", sans-serif`,
        fill: new Fill({ color: paleta.papel }),
        backgroundFill: new Fill({ color: paleta.tinta }),
        padding: [4, 8, 3, 8],
        textAlign: 'left',
        offsetX: 14,
        overflow: true,
      }),
    }));
  }
  return estilos;
};

// La ruta elegida se dibuja como una ruta señalizada: halo del color del papel y trazo vial encima. El zIndex
// ordena por pasada entre todos los tramos (primero todos los halos, al final todos los trazos), así el
// borde de un tramo no tapa la unión con el siguiente.
const estiloRuta = () => [
  new Style({ zIndex: 1, stroke: new Stroke({ color: hacerTransparente(paleta.acento, 0.18), width: 18, lineCap: 'round', lineJoin: 'round' }) }),
  new Style({ zIndex: 2, stroke: new Stroke({ color: paleta.papel, width: 8, lineCap: 'round', lineJoin: 'round' }) }),
  new Style({ zIndex: 3, stroke: new Stroke({ color: paleta.acento, width: 4, lineCap: 'round', lineJoin: 'round' }) }),
];

// Bandas de 10 y 20 km alrededor de la traza: la misma línea con un ancho en metros reales, que con
// extremos y uniones redondeados es exactamente el área de influencia. En EPSG:3857 un metro de
// terreno mide 1/cos(latitud) metros proyectados: la traza guarda el coseno de su latitud media
// (la RN11 en Chaco anda por los 27° S; la RN3 en Santa Cruz, por los 49° S).
const ancho = (metros: number, resolucion: number, cosLatitud: number) => (2 * metros) / cosLatitud / resolucion;

// De cerca las bandas ocupan toda la pantalla: se aclaran para que se lea el mapa debajo
// (0,16 de opacidad a escala provincia, 0,06 a escala local).
const opacidadBanda = (resolucion: number) => Math.min(0.16, Math.max(0.06, 0.04 + resolucion / 2500));

// Animación de distancia (T5): la franja crece de 0 a 20 km. Mientras dura, las bandas tienen ese
// ancho y solo aparecen las localidades que ya alcanzó (con un pequeño "pop" al entrar). null: el
// tablero normal, con las dos franjas enteras. La hoja impresa siempre sale con las franjas enteras.
let radioAnimado: number | null = null;
export function ponerRadioAnimado(visor: Visor, metros: number | null) {
  radioAnimado = metros;
  visor.analisis.changed();
}
export const hayRadioAnimado = () => radioAnimado !== null;
// Quien muestra la animación se entera cuando hay que cortarla (por ejemplo, al abrir Imprimir).
export const alTerminarAnimacion = new Set<() => void>();
export function terminarAnimacion(visor: Visor) {
  alTerminarAnimacion.forEach(f => f());
  ponerRadioAnimado(visor, null);
}
// Cuánto crece la burbuja al entrar: llega a su tamaño a los 900 m de franja.
const entrada = (distancia: number) => (radioAnimado === null ? 1 : Math.max(0, Math.min(1, (radioAnimado - distancia) / 900)));

// Radio de la burbuja: el área es proporcional a los habitantes (Resistencia, unos 290 000, llega al tope).
export const radioLocalidad = (habitantes: number) => tamanoMapa(Math.min(4 + Math.sqrt(habitantes) / 32, 20));

function estiloAnalisis(feature: import('ol/Feature').FeatureLike, resolucion: number) {
  const tipo = feature.get('tipo_analisis');
  if (tipo === 'traza') {
    const cos = feature.get('cos_latitud') ?? Math.cos((27 * Math.PI) / 180);
    const alfa = opacidadBanda(resolucion);
    if (radioAnimado !== null) {
      // Creciendo: un poco más intensas, y el frente de la franja marcado con un borde.
      const r = Math.max(1, radioAnimado);
      const estilos = [];
      if (r > 10_000) estilos.push(new Style({ stroke: new Stroke({ color: hacerTransparente(paleta.dato2, Math.min(0.32, alfa * 1.7)), width: ancho(r, resolucion, cos), lineCap: 'round', lineJoin: 'round' }) }));
      estilos.push(new Style({ stroke: new Stroke({ color: hacerTransparente(paleta.dato1, Math.min(0.32, alfa * 1.7)), width: ancho(Math.min(r, 10_000), resolucion, cos), lineCap: 'round', lineJoin: 'round' }) }));
      return estilos;
    }
    return [
      new Style({ stroke: new Stroke({ color: hacerTransparente(paleta.dato2, alfa), width: ancho(20_000, resolucion, cos), lineCap: 'round', lineJoin: 'round' }) }),
      new Style({ stroke: new Stroke({ color: hacerTransparente(paleta.dato1, alfa), width: ancho(10_000, resolucion, cos), lineCap: 'round', lineJoin: 'round' }) }),
    ];
  }
  if (tipo === 'localidad') {
    // Más lejos que 1:5.000.000 las burbujas se amontonan en un manchón: queda solo la traza con sus franjas.
    if (resolucion > 1500) return undefined;
    // Animando: todavía no la alcanzó la franja.
    const escalaEntrada = entrada(Number(feature.get('distancia')) || 0);
    if (escalaEntrada <= 0) return undefined;
    const habitantes = Number(feature.get('habitantes')) || 0;
    const color = feature.get('franja') === 1 ? paleta.dato1 : paleta.dato2;
    const elegida = !!feature.get('elegida');
    // Sin dato de habitantes: un anillo hueco, así no se confunde con un pueblo chico.
    const radio = (habitantes ? radioLocalidad(habitantes) : tamanoMapa(4)) * (escalaEntrada < 1 ? 0.4 + 0.6 * escalaEntrada + 0.25 * Math.sin(Math.PI * escalaEntrada) : 1);
    const estilo = new Style({
      image: new Circle({
        // El declutter es solo para los rótulos: ninguna burbuja se esconde.
        declutterMode: 'none',
        radius: radio,
        fill: new Fill({ color: habitantes ? hacerTransparente(color, 0.82) : paleta.papel }),
        stroke: new Stroke({ color: elegida ? paleta.tinta : habitantes ? paleta.papel : color, width: elegida ? 2.5 : habitantes ? 1.5 : 2 }),
      }),
      // Las grandes abajo: las chicas que caen encima quedan a la vista.
      zIndex: elegida ? 200 : 100 - radio,
    });
    // Rótulo: la elegida siempre; las de 20 000 hab. o más cuando hay lugar (declutter).
    return estilo;
  }
  return new Style({
    image: new Circle({ declutterMode: 'none', radius: 5, fill: new Fill({ color: paleta.tinta }), stroke: new Stroke({ color: paleta.papel, width: 2 }) }),
  });
}

// Nombres de las localidades del tablero, en una capa propia por encima de la traza y de las burbujas
// (si no, la línea de la ruta y la burbuja vecina los cruzaban). Con el tablero abierto el WMS calla
// sus rótulos de localidades: los pone esta capa, al costado de cada burbuja y con declutter, las más
// pobladas primero. Las sin dato, recién de cerca. La elegida la rotula la capa de foco (estiloFoco).
function estiloNombres(feature: import('ol/Feature').FeatureLike, resolucion: number) {
  if (feature.get('tipo_analisis') !== 'localidad' || feature.get('elegida') || resolucion > 1500) return undefined;
  if (entrada(Number(feature.get('distancia')) || 0) < 1) return undefined;
  const habitantes = Number(feature.get('habitantes')) || 0;
  const nombre = String(feature.get('nombre') ?? '');
  if (!nombre || /^sin nombre$/i.test(nombre) || (!habitantes && resolucion >= 300)) return undefined;
  const radio = habitantes ? radioLocalidad(habitantes) : 4;
  const grande = habitantes >= 20_000;
  return new Style({
    text: new Text({
      text: nombre,
      font: `${grande ? 600 : 500} ${tamanoMapa(grande ? 12.5 : 11.5)}px "Instrument Sans Variable", sans-serif`,
      fill: new Fill({ color: paleta.tinta }),
      stroke: new Stroke({ color: paleta.papel, width: 3.5 }),
      textAlign: 'left',
      offsetX: radio + 4,
    }),
    zIndex: habitantes,
  });
}

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

// Nombres de provincia: espaciados y en mayúsculas, como en un atlas; Chaco con más peso. Se ven de
// lejos (escala región o país, igual que antes en el SLD) y el declutter descarta los que se pisan.
const ESPACIO = '\u200A';
const espaciado = (texto: string) => texto.toUpperCase().split('').join(ESPACIO);

function estiloRotuloProvincia(feature: import('ol/Feature').FeatureLike) {
  const chaco = feature.get('nombre') === 'Chaco';
  return new Style({
    text: new Text({
      text: espaciado(feature.get('titulo')),
      font: `${chaco ? 650 : 550} ${tamanoMapa(chaco ? 13 : 11)}px "Instrument Sans Variable", sans-serif`,
      fill: new Fill({ color: hacerTransparente(paleta.tinta, chaco ? 0.72 : 0.38) }),
      stroke: new Stroke({ color: paleta.papel, width: 3 }),
      overflow: true,
    }),
    zIndex: chaco ? 1_000_000 : feature.get('km2'),
  });
}

function crearRotulos() {
  const fuente = new VectorSource({
    features: PROVINCIAS.map(p => new Feature({ geometry: new Point(fromLonLat(p.rotulo)), nombre: p.nombre, titulo: p.titulo, km2: p.km2 })),
  });
  // Desde 1:1.600.000 (a los 27° S de Chaco, unos 500 m por píxel en EPSG:3857): en la vista inicial
  // (Chaco entero, 1:2.400.000) se lee CHACO y sus vecinas.
  return new VectorLayer({ source: fuente, style: estiloRotuloProvincia, declutter: true, minResolution: 500, zIndex: 30 });
}

// Nombres de capitales: a la derecha de la estrella del WMS, desde escala país hacia adentro (como el
// rótulo que tenían en el SLD). Van en el mismo grupo de declutter que los nombres de provincia. En el
// declutter de OpenLayers gana el zIndex más alto (comprobado: con 0 y 1 Corrientes le ganaba a
// Resistencia, que está a 15 km): la capa va por encima de la de provincias y Resistencia, por encima
// de las demás capitales.
// Estrella como la del WMS (#B71C1C, borde blanco) para las capitales que el IGN no marca como tales.
const ESTRELLA = new RegularShape({ points: 5, radius: 6.5, radius2: 2.8, fill: new Fill({ color: '#B71C1C' }), stroke: new Stroke({ color: '#ffffff', width: 0.8 }), declutterMode: 'none' });
// 1:6.000.000 con el denominador de GeoServer (6.000.000 × 0,00028).
const RESOLUCION_CAPITALES = 1680;

function estiloCapital(feature: import('ol/Feature').FeatureLike) {
  const chaco = feature.get('provincia') === 'Chaco';
  return new Style({
    image: feature.get('estrella') ? ESTRELLA : undefined,
    text: new Text({
      text: feature.get('nombre'),
      font: `700 ${tamanoMapa(chaco ? 12 : 11)}px "Instrument Sans Variable", sans-serif`,
      fill: new Fill({ color: paleta.tinta }),
      stroke: new Stroke({ color: paleta.papel, width: 3 }),
      textAlign: 'left',
      offsetX: 9,
    }),
    zIndex: chaco ? 1 : 0,
  });
}

function crearCapitales() {
  const fuente = new VectorSource({
    features: CAPITALES.map(c => new Feature({ geometry: new Point(fromLonLat(c.punto)), nombre: c.nombre, provincia: c.provincia, estrella: !!c.estrella })),
  });
  return new VectorLayer({ source: fuente, style: estiloCapital, declutter: true, maxResolution: RESOLUCION_CAPITALES, zIndex: 31 });
}

function crearLucesCapitales(fuente: VectorSource) {
  // Una textura reutilizada por todas las capitales. El halo va debajo de los rótulos.
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 96;
  const ctx = lienzo.getContext('2d')!;
  const luz = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  luz.addColorStop(0, '#fff5cb');
  luz.addColorStop(0.12, '#ffe4a2');
  luz.addColorStop(0.29, 'rgba(255, 174, 66, 0.7)');
  luz.addColorStop(0.56, 'rgba(248, 132, 47, 0.23)');
  luz.addColorStop(1, 'rgba(248, 132, 47, 0)');
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, 96, 96);

  const normal = new Style({ image: new Icon({ img: lienzo, scale: 36 / 96 }) });
  const chaco = new Style({ image: new Icon({ img: lienzo, scale: 48 / 96 }) });
  return new VectorLayer({
    source: fuente,
    className: 'luces-capitales',
    style: feature => feature.get('provincia') === 'Chaco' ? chaco : normal,
    maxResolution: RESOLUCION_CAPITALES,
    zIndex: 29,
  });
}

function crearCuadricula() {
  const etiqueta = (offsetX: number, offsetY: number, align: CanvasTextAlign) => new Text({
    font: `500 ${tamanoMapa(11)}px "Instrument Sans Variable", sans-serif`,
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
// ¿La imagen llegó entera? Una respuesta cortada (200 con media imagen) igual se decodifica y se vería
// a medias: un PNG termina con el bloque IEND y un JPEG con FF D9.
export async function imagenCompleta(blob: Blob) {
  const fin = new Uint8Array(await blob.slice(Math.max(0, blob.size - 12)).arrayBuffer());
  if (blob.type.includes('png')) return String.fromCharCode(...fin.slice(fin.length - 8, fin.length - 4)) === 'IEND';
  if (blob.type.includes('jpeg')) return fin[fin.length - 2] === 0xff && fin[fin.length - 1] === 0xd9;
  return true;
}

function cargarTesela(tesela: ImageTile, url: string, sld: string) {
  const imagen = tesela.getImage() as HTMLImageElement;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ SLD_BODY: sld }),
  })
    .then(respuesta => {
      if (!respuesta.ok || !respuesta.headers.get('content-type')?.startsWith('image/')) throw new Error(String(respuesta.status));
      return respuesta.blob();
    })
    .then(async blob => {
      if (!(await imagenCompleta(blob))) throw new Error('tesela cortada');
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

const GRILLA_512 = createXYZ({ extent: proyeccion('EPSG:3857')!.getExtent(), tileSize: 512 });

// --- Comparador (T6): el recorte de cada lado ---

// Cada capa que se recorta lleva en 'lado' de qué lado de la cortina se dibuja ('izq', 'der' o nada:
// en los dos). `corte` dice, para cada cuadro, dónde está el corte en píxeles CSS del mapa (null: sin cortina).
// En las capas de lienzo 2D se recorta el dibujo (clip). En las de WebGL (las manchas de calor) no:
// gl.scissor también limita el borrado del cuadro y quedaban restos del anterior. Ahí se recorta su lienzo
// por CSS, y se anota el corte en el lienzo para la hoja impresa (que compone los lienzos a mano).
type Lado = 'izq' | 'der';
type Corte = (cuadro: FrameState) => number | null;
function recortable(capa: BaseLayer, corte: Corte) {
  if (capa.get('recortable')) return;
  capa.set('recortable', true);
  let recortada = false;
  const conEventos = capa as Layer;
  conEventos.on('prerender', (e: RenderEvent) => {
    recortada = false;
    const lado = capa.get('lado') as Lado | undefined;
    const x = lado && e.frameState ? corte(e.frameState) : null;
    const contexto = e.context;
    if (!contexto) return;
    if (!('save' in contexto)) {
      const lienzo = (contexto as WebGLRenderingContext).canvas as HTMLCanvasElement;
      lienzo.style.clipPath = x === null ? '' : lado === 'izq' ? `inset(0 calc(100% - ${x}px) 0 0)` : `inset(0 0 0 ${x}px)`;
      if (x === null) delete lienzo.dataset.corte; else lienzo.dataset.corte = `${lado}:${x}`;
      return;
    }
    if (x === null) return;
    const [ancho, alto] = e.frameState!.size;
    const [x1, x2] = lado === 'izq' ? [0, x] : [x, ancho];
    const puntos = [[x1, 0], [x2, 0], [x2, alto], [x1, alto]].map(p => getRenderPixel(e, p));
    contexto.save();
    contexto.beginPath();
    contexto.moveTo(puntos[0][0], puntos[0][1]);
    puntos.slice(1).forEach(p => contexto.lineTo(p[0], p[1]));
    contexto.closePath();
    contexto.clip();
    recortada = true;
  });
  conEventos.on('postrender', (e: RenderEvent) => {
    if (recortada) (e.context as CanvasRenderingContext2D).restore();
    recortada = false;
  });
}

// En pantalla, el corte es una fracción del ancho del mapa.
const corteEnPantalla = (visor: Visor): Corte => cuadro => (visor.comparacion ? visor.comparacion.fraccion * cuadro.size[0] : null);
const recortarEnMapa = (visor: Visor, capa: BaseLayer) => {
  if (capa instanceof LayerGroupClase) capa.getLayers().forEach(c => recortable(c, corteEnPantalla(visor)));
  else recortable(capa, corteEnPantalla(visor));
};

function crearCapaWms() {
  // El SLD vive en la propia fuente: cada capa WMS (la combinada y las que tienen opacidad propia)
  // pide sus teselas con el suyo.
  const fuente: TileWMS = new TileWMS({
    url: URL_WMS,
    params: { TILED: true },
    // Teselas de 512 px: la cuarta parte de pedidos que con 256 (en la tele 2K eran más de 300).
    tileGrid: GRILLA_512,
    transition: 200,
    tileLoadFunction: (tesela, url) => cargarTesela(tesela as ImageTile, url, fuente.get('sld') ?? ''),
  });
  return new TileLayer({
    // Las teselas WMS tienen un canvas con clase propia: en tema oscuro se invierten por CSS.
    className: 'capa-wms',
    zIndex: 10,
    // Mientras llegan las teselas nuevas se ve el nivel de menor resolución, no huecos.
    preload: 1,
    source: fuente,
  });
}

function ponerSld(capa: TileLayer<TileWMS>, nombres: string[], sinRotulos: ReadonlySet<string>) {
  const sld = sldDeCapas(nombres, sinRotulos);
  const fuente = capa.getSource()!;
  if (fuente.get('sld') === sld) return;
  fuente.set('sld', sld);
  fuente.updateParams({ ESTILO: hashCorto(sld) });
}

export function crearVisor(destino: HTMLElement): Visor {
  leerPaleta();
  ponerFactorMapa(factorPantalla());
  const wms = crearCapaWms();
  const resaltado = new VectorSource();
  const foco = new VectorSource();
  const dibujo = new VectorSource();
  const ruta = new VectorLayer({ source: new VectorSource(), style: estiloRuta, zIndex: 35, visible: false });
  const cuadricula = crearCuadricula();
  const capaFoco = new VectorLayer({ source: foco, style: estiloFoco, zIndex: 55 });
  const analisis = new VectorSource();
  const capaAnalisis = new VectorLayer({ source: analisis, style: estiloAnalisis, zIndex: 32, updateWhileAnimating: true });
  const capaNombres = new VectorLayer({ source: analisis, style: estiloNombres, zIndex: 40, declutter: true });
  const rotulos = crearRotulos();
  const capitales = crearCapitales();
  const lucesCapitales = crearLucesCapitales(capitales.getSource()!);

  const mapa = new Map({
    target: destino,
    layers: [
      cuadricula,
      wms,
      lucesCapitales,
      capitales,
      rotulos,
      capaAnalisis,
      ruta,
      capaNombres,
      new VectorLayer({ source: resaltado, style: estiloResaltado, zIndex: 50 }),
      capaFoco,
      new VectorLayer({ source: dibujo, style: estiloDibujo, zIndex: 60 }),
    ],
    view: new View({ maxZoom: 19, minZoom: 3 }),
    controls: [],
  });
  // Arranca un nivel por encima de Chaco y centrado en Chaco: la entrada es un zoom puro, así las
  // teselas agrandadas coinciden con las nuevas. Sin size, fit() usa 100 px porque el mapa no se dibujó.
  const vista = mapa.getView();
  vista.fit(EXTENSION_CHACO, { size: mapa.getSize(), padding: margenesMapa(), minResolution: RESOLUCION_CHACO });
  vista.setZoom(vista.getZoom()! - 1);
  vista.setCenter(getCenter(EXTENSION_CHACO));

  capaFoco.on('postrender', e => latir(e, foco, mapa));
  foco.on('addfeature', () => {
    inicioLatido = Date.now();
    mapa.render();
  });

  // La capa del lado derecho de la cortina (T6): apagada hasta que se compara.
  const wmsDerecha = crearCapaWms();
  wmsDerecha.setVisible(false);
  wmsDerecha.setZIndex(11);
  wmsDerecha.set('lado', 'der');
  mapa.addLayer(wmsDerecha);

  const visor: Visor = { mapa, wms, visibles: new Set(CAPAS_INICIALES), opacidades: {}, sueltas: {}, suscriptores: new Set(), resaltado, foco, dibujo, ruta, analisis, cuadricula, rotulos, capitales, lucesCapitales, sinRotulos: new Set(), calor: new globalThis.Map(), comparacion: null, wmsDerecha };
  [wms, wmsDerecha, rotulos, capitales, lucesCapitales].forEach(c => recortarEnMapa(visor, c));
  actualizarWms(visor);
  // Mapa de calor: cuando el mapa se queda quieto, se piden los puntos de lo que se ve.
  mapa.on('moveend', () => cargarCalor(visor));
  return visor;
}

// Pide los puntos de lo que se ve para cada capa en calor (si ya están, no pide nada).
export function cargarCalor(visor: Visor, forzar = false) {
  if (!visor.calor.size) return;
  const extension = visor.mapa.getView().calculateExtent(visor.mapa.getSize());
  for (const nombre of visor.calor.keys()) calorDe(nombre).cargar(extension, forzar);
}

// La entidad seleccionada late: un anillo (o un halo en líneas y polígonos) que se expande y se
// desvanece cada 1,6 s durante unos segundos, para encontrarla de un vistazo. Después queda quieta
// (el mapa deja de redibujarse) y con movimiento reducido no late.
const DURACION_LATIDO = 4800;
let inicioLatido = 0;

function latir(evento: RenderEvent, fuente: VectorSource, mapa: Map) {
  const entidades = fuente.getFeatures();
  if (!entidades.length || movimientoReducido() || Date.now() - inicioLatido > DURACION_LATIDO) return;
  const t = (Date.now() % 1600) / 1600;
  const suave = 1 - (1 - t) ** 3;
  const contexto = getVectorContext(evento);
  const color = hacerTransparente(paleta.acento, 0.55 * (1 - t));
  if (focoSimple) { cometa(evento, entidades, contexto); mapa.render(); return; }
  for (const entidad of entidades) {
    const geometria = entidad.getGeometry();
    if (!geometria) continue;
    contexto.setStyle(geometria.getType() === 'Point'
      ? new Style({ image: new Circle({ radius: 8 + suave * 26, stroke: new Stroke({ color, width: 3 }) }) })
      : new Style({ stroke: new Stroke({ color, width: 6 + suave * 18, lineJoin: 'round', lineCap: 'round' }) }));
    contexto.drawGeometry(geometria);
  }
  mapa.render();
}

// En el simple, una luz recorre cada línea de punta a punta (1,6 s por vuelta, mientras dura el latido): una
// raya corta y blanca con un brillo alrededor, que se mueve con el desfase del punteado. Los lugares, dos aros
// que se abren uno detrás del otro.
function cometa(evento: RenderEvent, entidades: import('ol/Feature').default[], contexto: ReturnType<typeof getVectorContext>) {
  const resolucion = evento.frameState!.viewState.resolution;
  const ahora = Date.now();
  const largoCometa = tamanoMapa(70);
  for (const entidad of entidades) {
    const geometria = entidad.getGeometry() as Geometry | undefined;
    if (!geometria) continue;
    if (geometria.getType() === 'Point' || geometria.getType() === 'MultiPoint') {
      for (const desfase of [0, 0.5]) {
        const u = ((ahora + desfase * 1600) % 1600) / 1600;
        const abre = 1 - (1 - u) ** 3;
        contexto.setStyle(new Style({ image: new Circle({ radius: tamanoMapa(10 + abre * 30), stroke: new Stroke({ color: hacerTransparente(paleta.acento, 0.6 * (1 - u)), width: tamanoMapa(2.5) }) }) }));
        contexto.drawGeometry(geometria);
      }
      continue;
    }
    for (const linea of lineasDe(geometria)) {
      const largo = linea.getLength() / resolucion;
      if (largo < tamanoMapa(24)) continue;
      // Cuanto más larga la línea, más lenta la vuelta (velocidad pareja): entre 1,1 y 2,4 s.
      const vuelta = Math.min(2400, Math.max(1100, largo * 4));
      const u = (ahora % vuelta) / vuelta;
      const avance = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
      const desplazamiento = largoCometa - avance * (largo + largoCometa);
      const punteado = [largoCometa, largo + largoCometa * 2];
      contexto.setStyle(new Style({ stroke: new Stroke({ color: 'rgba(255,255,255,0.45)', width: tamanoMapa(9), lineCap: 'round', lineDash: punteado, lineDashOffset: desplazamiento }) }));
      contexto.drawGeometry(linea);
      contexto.setStyle(new Style({ stroke: new Stroke({ color: '#ffffff', width: tamanoMapa(2.5), lineCap: 'round', lineDash: punteado, lineDashOffset: desplazamiento }) }));
      contexto.drawGeometry(linea);
    }
  }
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

export function verSolo(visor: Visor, nombre: string) {
  visor.visibles = new Set([nombre]);
  actualizarWms(visor);
}

export function ponerCapas(visor: Visor, nombres: string[]) {
  visor.visibles = new Set(nombres);
  actualizarWms(visor);
}

// Ver una capa de puntos como mapa de calor (o volver a verla como puntos). Prenderla en calor la
// prende también como capa.
// El calor queda elegido en el momento (la interfaz responde y el WMS deja de dibujar esos puntos); la
// capa, con WebGL, se agrega cuando termina de bajar su módulo.
export function cambiarCalor(visor: Visor, nombre: string, activo: boolean) {
  const elegido = visor.calor.has(nombre);
  if (activo && !elegido) {
    visor.visibles.add(nombre);
    visor.calor.set(nombre, null);
    calorDe(nombre).cargar(visor.mapa.getView().calculateExtent(visor.mapa.getSize()));
    import('./capaCalor').then(({ crearCapaCalor }) => {
      // Si mientras tanto se volvió a puntos (o se apagó), no se agrega.
      if (!visor.calor.has(nombre) || visor.calor.get(nombre)) return;
      const capa = crearCapaCalor(nombre, calorDe(nombre).fuente, factorPantalla());
      (capa.get('mancha') as Heatmap).setOpacity(0.88 * (visor.opacidades[nombre] ?? 1));
      visor.calor.set(nombre, capa);
      // Con la cortina, la mancha es del lado izquierdo (el mapa de siempre).
      capa.getLayers().forEach(c => c.set('lado', visor.comparacion ? 'izq' : undefined));
      recortarEnMapa(visor, capa);
      visor.mapa.addLayer(capa);
      visor.suscriptores.forEach(aviso => aviso());
    });
  } else if (!activo && elegido) {
    const capa = visor.calor.get(nombre);
    if (capa) visor.mapa.removeLayer(capa);
    visor.calor.delete(nombre);
  }
  actualizarWms(visor);
}

export function cambiarOpacidad(visor: Visor, nombre: string, opacidad: number) {
  if (opacidad >= 0.99) delete visor.opacidades[nombre];
  else visor.opacidades[nombre] = opacidad;
  // En calor, la opacidad es la de la mancha.
  (visor.calor.get(nombre)?.get('mancha') as Heatmap | undefined)?.setOpacity(0.88 * opacidad);
  actualizarWms(visor);
}

function actualizarWms(visor: Visor) {
  const nombres = capasVisibles(visor);
  // Una capa vista como calor no se pide al WMS: sus puntos no se dibujan debajo de las manchas.
  for (const [nombre, capa] of visor.calor) {
    if (!visor.visibles.has(nombre)) { if (capa) visor.mapa.removeLayer(capa); visor.calor.delete(nombre); }
  }
  const combinadas = nombres.filter(n => visor.opacidades[n] === undefined && !visor.calor.has(n));
  visor.wms.setVisible(combinadas.length > 0);
  // Los nombres de provincia y de capitales los prende y apaga ponerLados (con el tablero abierto, los
  // nombres de localidades los pinta su capa: las capitales también callan).
  if (combinadas.length) ponerSld(visor.wms, combinadas, visor.sinRotulos);

  // Las sueltas se dibujan arriba de la combinada, en su orden de dibujo entre ellas.
  for (const [nombre, capa] of Object.entries(visor.sueltas)) {
    if (!visor.visibles.has(nombre) || visor.opacidades[nombre] === undefined || visor.calor.has(nombre)) {
      visor.mapa.removeLayer(capa);
      delete visor.sueltas[nombre];
    }
  }
  nombres.forEach((nombre, i) => {
    const opacidad = visor.opacidades[nombre];
    if (opacidad === undefined || visor.calor.has(nombre)) return;
    let capa = visor.sueltas[nombre];
    if (!capa) {
      capa = crearCapaWms();
      visor.sueltas[nombre] = capa;
      recortarEnMapa(visor, capa);
      visor.mapa.addLayer(capa);
    }
    ponerSld(capa, [nombre], visor.sinRotulos);
    capa.setOpacity(opacidad);
    capa.setZIndex(10 + (i + 1) / (nombres.length + 1));
  });
  ponerLados(visor);
  visor.suscriptores.forEach(aviso => aviso());
}

// Con la cortina: todo lo del mapa de siempre se dibuja a la izquierda y el otro juego a la derecha.
// Los nombres de provincia y de capitales (que pinta el visor) siguen a su capa: si está de los dos
// lados, van en los dos; si no, solo del lado donde está.
function ponerLados(visor: Visor) {
  const c = visor.comparacion;
  const izquierda = c ? 'izq' : undefined;
  [visor.wms, ...Object.values(visor.sueltas)].forEach(capa => capa.set('lado', izquierda));
  for (const grupo of visor.calor.values()) grupo?.getLayers().forEach(capa => capa.set('lado', izquierda));
  const derecha = c ? capasDerecha(visor) : [];
  visor.wmsDerecha.setVisible(derecha.length > 0);
  if (derecha.length) ponerSld(visor.wmsDerecha, derecha, visor.sinRotulos);
  const seguir = (capa: VectorLayer<VectorSource>, enIzquierda: boolean, enDerecha: boolean) => {
    capa.setVisible(enIzquierda || enDerecha);
    capa.set('lado', !c || (enIzquierda && enDerecha) ? undefined : enIzquierda ? 'izq' : 'der');
  };
  seguir(visor.rotulos, visor.visibles.has('provincias'), derecha.includes('provincias'));
  const capitales = (nombres: { has: (n: string) => boolean }) => nombres.has('localidades') && !visor.sinRotulos.has('localidades');
  const capitalesIzquierda = capitales(visor.visibles);
  const capitalesDerecha = capitales(new Set(derecha));
  seguir(visor.capitales, capitalesIzquierda, capitalesDerecha);
  seguir(visor.lucesCapitales, capitalesIzquierda, capitalesDerecha);
  visor.mapa.render();
}

// Abre, cambia o cierra (null) la comparación.
export function ponerComparacion(visor: Visor, comparacion: Comparacion | null) {
  visor.comparacion = comparacion;
  actualizarWms(visor);
}

// Mueve la cortina: solo se vuelve a dibujar el mapa (sin avisar a los paneles).
export function moverCorte(visor: Visor, fraccion: number) {
  if (!visor.comparacion) return;
  visor.comparacion.fraccion = fraccion;
  visor.mapa.render();
}

export const capasDerecha = (visor: Visor) => (visor.comparacion ? [...new Set(visor.comparacion.derecha)].sort((a, b) => orden(a) - orden(b)) : []);

// Las capas que se ven en un píxel del mapa: con la cortina, a la derecha del corte, las del otro juego.
// Las consultas por punto y el cartel preguntan por lo que se ve ahí.
export function capasEn(visor: Visor, pixel: number[]): { nombres: string[]; derecha: boolean } {
  const c = visor.comparacion;
  if (c && pixel[0] > c.fraccion * visor.mapa.getSize()![0]) return { nombres: capasDerecha(visor), derecha: true };
  return { nombres: capasVisibles(visor), derecha: false };
}

// La x del corte en coordenadas del mapa (EPSG:3857), o null sin cortina.
export function corteEnCoordenada(visor: Visor) {
  const c = visor.comparacion;
  const tamano = visor.mapa.getSize();
  if (!c || !tamano) return null;
  return visor.mapa.getCoordinateFromPixel([c.fraccion * tamano[0], tamano[1] / 2])[0];
}

// Después de un WFS-T: el parámetro nuevo hace que se pidan teselas nuevas (y saltea la caché).
export function refrescarMapa(visor: Visor) {
  [visor.wms, visor.wmsDerecha, ...Object.values(visor.sueltas)].forEach(c => c.getSource()!.updateParams({ _: Date.now() }));
}

// GetFeatureInfo con el mismo SLD que las teselas (por POST, como ellas): GeoServer evalúa las reglas
// del estilo, filtros y escala incluidos, así la consulta devuelve solo lo que se ve. Sin el SLD, de
// lejos aparecían bañados y arroyos que a esa escala no se dibujan. La fuente aparte sirve solo para
// armar la URL.
// Con la misma grilla que las teselas: getFeatureInfoUrl toma la resolución de su nivel de teselas, y tiene
// que ser la del dibujo para que la consulta devuelva lo que se ve.
const fuenteConsulta = new TileWMS({ url: URL_WMS, params: {}, tileGrid: GRILLA_512 });
// `derecha`: la consulta es del lado derecho de la cortina, donde no hay manchas de calor.
export async function consultarPuntoWms(visor: Visor, coordenada: Coordinate, nombres: string[], maximo = 10, señal?: AbortSignal, derecha = false) {
  const capas = nombres.join(',');
  const url = fuenteConsulta.getFeatureInfoUrl(coordenada, visor.mapa.getView().getResolution()!, 'EPSG:3857', {
    LAYERS: capas, QUERY_LAYERS: capas, INFO_FORMAT: 'application/json', FEATURE_COUNT: maximo,
  })!;
  const respuesta = await fetch(url, { method: 'POST', body: new URLSearchParams({ SLD_BODY: sldDeCapas(nombres, visor.sinRotulos, derecha ? new Set() : new Set(visor.calor.keys())) }), signal: señal });
  const texto = await respuesta.text();
  if (!respuesta.ok || texto.startsWith('<')) throw new Error('GeoServer no pudo responder la consulta.');
  return JSON.parse(texto) as { features: { id: string; properties: Record<string, unknown> }[] };
}

// Denominador de escala como lo ve GeoServer al dibujar: el de la resolución del nivel de teselas
// que OpenLayers pide para la vista (no la de la vista, que con zoom fraccionario cae entre dos
// niveles), con el método OGC (en EPSG:3857, sin corregir por latitud). Es el que decide qué reglas
// del estilo se dibujan; la barra de escala muestra el real (denominadorEscala).
function grillaWms(visor: Visor) {
  const fuente = visor.wms.getSource()!;
  return { fuente, grilla: fuente.getTileGridForProjection(visor.mapa.getView().getProjection()) };
}

export function denominadorWms(visor: Visor) {
  const { fuente, grilla } = grillaWms(visor);
  const z = grilla.getZForResolution(visor.mapa.getView().getResolution()!, fuente.zDirection);
  return grilla.getResolution(z) / 0.00028;
}

// Al cambiar de tema: la cuadrícula se rehace (sus estilos no se pueden cambiar) y el resto se redibuja.
export function aplicarTema(visor: Visor) {
  leerPaleta();
  const capas = visor.mapa.getLayers();
  const indice = capas.getArray().indexOf(visor.cuadricula);
  visor.cuadricula = crearCuadricula();
  capas.setAt(indice, visor.cuadricula);
  visor.mapa.getAllLayers().forEach(c => c.changed());
  // Las manchas cambian de rampa (en oscuro, hacia los claros).
  const grupos = [...visor.calor.values()].filter((g): g is LayerGroup => !!g);
  if (grupos.length) import('./capaCalor').then(({ aplicarTemaCalor }) => grupos.forEach(aplicarTemaCalor));
}

// Leyenda de GeoServer. En tema oscuro se invierte por CSS igual que el mapa (.leyenda-wms).
// Las capas con estilo propio mandan su SLD por POST, por el mismo límite de cabeceras que las teselas.
// `ppp`: puntos por pulgada de la imagen (para el PDF, el doble de los 96 de pantalla).
export async function cargarLeyenda(nombre: string, señal: AbortSignal, simple = false, ppp?: number): Promise<string> {
  const opciones = ['fontName:Helvetica', 'fontAntiAliasing:true', 'fontSize:12', 'dx:8', 'forceLabels:on', 'fontColor:0x2A2E33', ...(ppp ? [`dpi:${ppp}`] : [])].join(';');
  let url = `${URL_WMS}?service=WMS&request=GetLegendGraphic&format=image/png&transparent=true`
    + `&width=18&height=18&layer=${nombre}&legend_options=${opciones}`;
  const sld = sldDeLeyenda(nombre, simple);
  // nginx guarda las leyendas por URL y el estilo va en el cuerpo: sin su hash en la URL, una leyenda de un
  // modo (o de un estilo viejo) se servía para el otro.
  if (sld) url += `&ESTILO=${hashCorto(sld)}`;
  // Para el PDF (`ppp`) se pide siempre por fetch, también sin SLD, para comprobar que llegó entera.
  if (!sld && !ppp) return url;
  const respuesta = sld
    ? await fetch(url, { method: 'POST', body: new URLSearchParams({ SLD_BODY: sld }), signal: señal })
    : await fetch(url, { signal: señal });
  if (!respuesta.ok || !respuesta.headers.get('content-type')?.startsWith('image/')) throw new Error(`Leyenda de ${nombre}: ${respuesta.status}`);
  const blob = await respuesta.blob();
  if (!(await imagenCompleta(blob))) throw new Error(`Leyenda de ${nombre}: cortada`);
  return URL.createObjectURL(blob);
}

// Denominador de escala corregido por latitud (Mercator agranda hacia los polos).
export function denominadorEscala(mapa: Map): number {
  const vista = mapa.getView();
  const resolucion = getPointResolution('EPSG:3857', vista.getResolution()!, vista.getCenter()!);
  return Math.round(resolucion / 0.00028);
}

// Acerca la vista hasta el primer nivel de teselas cuyo denominador (denominadorWms) queda por debajo
// de `denominador`, sin mover el centro: ahí empieza a dibujarse una regla con ese MaxScaleDenominator.
export function acercarAEscala(visor: Visor, denominador: number) {
  const { grilla } = grillaWms(visor);
  const resoluciones = grilla.getResolutions();
  const destino = resoluciones.find(r => r / 0.00028 < denominador) ?? resoluciones[resoluciones.length - 1];
  const vista = visor.mapa.getView();
  vista.cancelAnimations();
  vista.animate({ resolution: destino, duration: movimientoReducido() ? 0 : 700 });
}

export function formatoCoordenada(coordenada: Coordinate) {
  const [lon, lat] = toLonLat(coordenada);
  const gms = (valor: number, pos: string, neg: string) => {
    // Se redondea el total de segundos antes de repartir: si no, salía "58°59′60″".
    const total = Math.round(Math.abs(valor) * 3600);
    const g = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${g}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${valor < 0 ? neg : pos}`;
  };
  return `${gms(lat, 'N', 'S')}  ${gms(lon, 'E', 'O')}`;
}


// `arriba`: píxeles del mapa tapados desde arriba por algo que está a la vista (el panel de la animación
// de distancia), si son más que el margen de siempre.
// `derecha` y `abajo`: lo mismo para los otros bordes (el bloque de zoom y minimapa).
export function volarA(visor: Visor, extension: number[], opciones: { maxZoom?: number; duracion?: number; conPanel?: boolean; minResolution?: number; arriba?: number; derecha?: number; abajo?: number } = {}) {
  const vista = visor.mapa.getView();
  vista.cancelAnimations();
  const margenes = margenesMapa(opciones.conPanel);
  if (opciones.arriba) margenes[0] = Math.max(margenes[0], Math.round(opciones.arriba));
  if (opciones.derecha) margenes[1] = Math.max(margenes[1], Math.round(opciones.derecha));
  if (opciones.abajo) margenes[2] = Math.max(margenes[2], Math.round(opciones.abajo));
  vista.fit(extension, {
    size: visor.mapa.getSize(),
    padding: margenes,
    maxZoom: opciones.maxZoom ?? 14,
    minResolution: opciones.minResolution,
    duration: movimientoReducido() ? 0 : opciones.duracion ?? 900,
  });
}

// Chaco entero, nunca más cerca que 1:2.100.000 (600 m por píxel en EPSG:3857): en pantallas grandes el
// encuadre quedaba en 1:1.100.000 y aparecían todos los caminos de tierra (la "maraña" de la tele).
const RESOLUCION_CHACO = 600;
export const verChaco = (visor: Visor, duracion?: number) => volarA(visor, EXTENSION_CHACO, { duracion, minResolution: RESOLUCION_CHACO });

// Cambió el factor de pantalla (la tele): rótulos y símbolos del WMS y del visor se rehacen a la medida nueva.
export function aplicarFactor(visor: Visor, factor: number) {
  ponerFactorMapa(factor);
  actualizarWms(visor);
  aplicarTema(visor);
}

// Los paneles tapan los bordes del mapa: el encuadre deja ese espacio libre. Con `conPanel` también
// el del panel de la derecha (tablero o resultados), que en pantallas chicas va abajo. Cada interfaz
// tapa bordes distintos: la App avisa cuál está a la vista (ponerDisposicion).
// [arriba, derecha, abajo, izquierda] en px de diseño (se multiplican por la escala de la interfaz).
type Margenes = [number, number, number, number];
const DISPOSICIONES: Record<'simple' | 'pro', { base: Margenes; conPanel: number }> = {
  // Simple: panel de temas a la izquierda (≈390 px), botones grandes abajo, resultados flotando a la derecha.
  simple: { base: [110, 100, 150, 410], conPanel: 450 },
  // Pro (como un mapa web): arriba el buscador y los chips, a la izquierda el riel (y su cajón, si está
  // abierto), abajo la barra de estado y a la derecha el zoom. Lo consultado va debajo del buscador, a la
  // izquierda: ver margenesMapa.
  pro: { base: [80, 84, 64, 100], conPanel: 84 },
};
let disposicion: 'simple' | 'pro' = 'pro';
let lateralPlegado = false;
let altoTablaAbierta = 0;
// `plegado`: el panel de la izquierda cerrado (en el profesional, el cajón del riel). `altoTabla`: la tabla
// de datos del profesional (T4) tapa el borde de abajo del mapa.
export function ponerDisposicion(interfaz: 'simple' | 'pro', plegado = false, altoTabla = 0) {
  disposicion = interfaz;
  lateralPlegado = plegado;
  altoTablaAbierta = altoTabla;
}

// Profesional: el riel (76 px), el cajón (380 px) y la columna de lo consultado (400 px + 16 de aire).
const RIEL_PRO = 76;
const CAJON_PRO = 380;
const COLUMNA_PRO = 416;

function margenesMapa(conPanel = false): Margenes {
  if (window.innerWidth < 1024 && conPanel) return [150, 20, Math.round(window.innerHeight * 0.5), 20];
  if (window.innerWidth < 768) return [150, 20, 190, 20];
  const escala = escalaActual();
  const { base, conPanel: derecha } = DISPOSICIONES[disposicion];
  if (disposicion === 'pro') {
    const izquierda = RIEL_PRO + (lateralPlegado ? 0 : CAJON_PRO) + (conPanel ? COLUMNA_PRO : 0) + 24;
    const abajo = base[2] + (altoTablaAbierta ? altoTablaAbierta + 12 : 0);
    return ([base[0], base[1], abajo, izquierda] as Margenes).map(m => Math.round(m * escala)) as Margenes;
  }
  const margenes: Margenes = [base[0], conPanel ? Math.max(base[1], derecha) : base[1], base[2], lateralPlegado ? 16 : base[3]];
  return margenes.map(m => Math.round(m * escala)) as Margenes;
}

// Deja la traza de una ruta nacional en una provincia (para la RN11 en Chaco, 68 tramos: los mismos
// de la consulta SQL de la parte B) en la capa de la ruta como una sola geometría, con el coseno de su
// latitud media para las bandas en metros. Es sincrónica: quien la pidió ya sabe que sigue vigente.
export function dibujarRuta(visor: Visor, elegida: Ruta, traza: Traza) {
  const fuente = visor.ruta.getSource()!;
  if (fuente.get('clave') !== claveRuta(elegida)) {
    fuente.clear();
    const geometria = new MultiLineString(traza.lineas.map(l => l.map(p => fromLonLat(p))));
    const latitud = toLonLat(getCenter(geometria.getExtent()))[1];
    fuente.addFeature(new Feature({ geometry: geometria, cos_latitud: Math.cos((latitud * Math.PI) / 180) }));
    fuente.set('clave', claveRuta(elegida));
  }
  visor.ruta.setVisible(true);
}

export function ocultarRuta(visor: Visor) {
  visor.ruta.setVisible(false);
  visor.analisis.clear();
  callarRotulos(visor, 'localidades', false);
}

export function callarRotulos(visor: Visor, nombre: string, callar: boolean) {
  if (visor.sinRotulos.has(nombre) === callar) return;
  if (callar) visor.sinRotulos.add(nombre); else visor.sinRotulos.delete(nombre);
  actualizarWms(visor);
}

// El canvas no garantiza entender color-mix(): las variables del tema van en hex y se pasan a rgba.
function hacerTransparente(hex: string, alfa: number) {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
}


// --- Impresión (exportar a PDF) ---

// La hoja siempre sale en papel claro y con los tamaños de una notebook, aunque se exporte en tema
// oscuro o desde la tele: los estilos del visor leen la paleta y el factor al dibujar, así que se
// cambian solo durante cada llamada (es sincrónica) y se restauran enseguida.
const PALETA_CLARA = { acento: '#e5521f', tinta: '#15171a', papel: '#eceeeb', grilla: 'rgba(21,23,26,.06)', dato1: '#c2410c', dato2: '#ec8455' };
function paraImprimir<T>(dibujar: () => T): T {
  const guardada = { ...paleta };
  const factor = tamanoMapa(1);
  Object.assign(paleta, PALETA_CLARA);
  ponerFactorMapa(1);
  try {
    return dibujar();
  } finally {
    Object.assign(paleta, guardada);
    ponerFactorMapa(factor);
  }
}

// WMS para la hoja: el SLD con tamaños de notebook y teselas en alta resolución (GeoServer dibuja al
// doble de puntos por pulgada cuando el mapa de impresión tiene pixelRatio 2).
function capaWmsImpresion(nombres: string[], sinRotulos: ReadonlySet<string>, opacidad = 1) {
  const sld = paraImprimir(() => sldDeCapas(nombres, sinRotulos));
  const fuente = new TileWMS({
    url: URL_WMS,
    params: { TILED: true, ESTILO: hashCorto(sld) },
    tileGrid: GRILLA_512,
    serverType: 'geoserver',
    hidpi: true,
    transition: 0,
    tileLoadFunction: (tesela, url) => cargarTesela(tesela as ImageTile, url, sld),
  });
  return new TileLayer({ source: fuente, opacity: opacidad, zIndex: 10 });
}

// Las capas de la hoja: las mismas que se ven (WMS combinado, las que tienen opacidad propia y las
// capas del visor, con sus fuentes compartidas), sin la cuadrícula de pantalla: la hoja dibuja la suya.
// `extension`: el marco de la hoja. Los mapas de calor piden sus puntos para ese encuadre (con su propio
// control: no le cambian los datos al mapa); si no se pueden traer todos, es error (la hoja no sale con
// una mancha incompleta).
// Con la cortina (T6), la hoja la muestra en el mismo lugar del mapa (la misma coordenada): cada capa
// lleva su lado y el recorte se calcula con la transformación de la hoja.
export async function capasParaImprimir(visor: Visor, extension: number[]) {
  const nombres = capasVisibles(visor);
  const combinadas = nombres.filter(n => visor.opacidades[n] === undefined && !visor.calor.has(n));
  const capas: (TileLayer<TileWMS> | VectorLayer<VectorSource> | LayerGroup)[] = [];
  const corteX = corteEnCoordenada(visor);
  const corte: Corte = cuadro => (corteX === null ? null : aplicarTransformacion(cuadro.coordinateToPixelTransform, [corteX, 0])[0]);
  const conLado = <T extends BaseLayer>(capa: T, lado: Lado | undefined) => {
    if (corteX === null) return capa;
    const hojas = capa instanceof LayerGroupClase ? capa.getLayers().getArray() : [capa];
    hojas.forEach(h => { h.set('lado', lado); recortable(h, corte); });
    return capa;
  };
  if (visor.calor.size) {
    const { crearCapaCalor } = await import('./capaCalor');
    for (const nombre of visor.calor.keys()) {
      const control = calorDe(nombre, 'impresion');
      const estado = await control.cargar(extension, true);
      if (estado.fase !== 'lista') throw new Error(`calor:${nombre}:${estado.fase}`);
      const grupo = crearCapaCalor(nombre, control.fuente, 1, true);
      (grupo.get('mancha') as Heatmap).setOpacity(0.88 * (visor.opacidades[nombre] ?? 1));
      capas.push(conLado(grupo, 'izq'));
    }
  }
  if (combinadas.length) capas.push(conLado(capaWmsImpresion(combinadas, visor.sinRotulos), 'izq'));
  const derecha = capasDerecha(visor);
  if (corteX !== null && derecha.length) {
    const capa = capaWmsImpresion(derecha, visor.sinRotulos);
    capa.setZIndex(11);
    capas.push(conLado(capa, 'der'));
  }
  nombres.forEach((nombre, i) => {
    const opacidad = visor.opacidades[nombre];
    if (opacidad === undefined || visor.calor.has(nombre)) return;
    const capa = capaWmsImpresion([nombre], visor.sinRotulos, opacidad);
    capa.setZIndex(10 + (i + 1) / (nombres.length + 1));
    capas.push(conLado(capa, 'izq'));
  });
  for (const capa of visor.mapa.getLayers().getArray()) {
    if (!(capa instanceof VectorLayer) || capa instanceof Graticule || !capa.getVisible()) continue;
    // Las luces de las capitales son de la noche en pantalla (su visibilidad la da el CSS): la hoja no las lleva.
    if (capa === visor.lucesCapitales) continue;
    const estilo = capa.getStyleFunction();
    if (!estilo) continue;
    capas.push(conLado(new VectorLayer({
      source: capa.getSource()!,
      style: (feature, resolucion) => paraImprimir(() => estilo(feature, resolucion)),
      declutter: capa.getDeclutter(),
      zIndex: capa.getZIndex(),
      minResolution: capa.getMinResolution(),
      maxResolution: capa.getMaxResolution(),
      opacity: capa.getOpacity(),
    }), capa.get('lado')));
  }
  return capas;
}

// El rectángulo libre del mapa en píxeles de pantalla: [izquierda, arriba, derecha, abajo] (la cortina se
// mueve ahí adentro, nunca debajo de un panel).
export function areaLibre(visor: Visor, conPanel: boolean) {
  const [ancho, alto] = visor.mapa.getSize() ?? [window.innerWidth, window.innerHeight];
  const [arriba, derecha, abajo, izquierda] = margenesMapa(conPanel);
  return [izquierda, arriba, ancho - derecha, alto - abajo];
}

// Lo que se ve del mapa, sin lo que tapan los paneles que están a la vista (`conPanel`: si hay un
// panel abierto a la derecha, como resultados o el tablero).
export function extensionLibre(visor: Visor, conPanel: boolean) {
  const [ancho, alto] = visor.mapa.getSize()!;
  const [arriba, derecha, abajo, izquierda] = margenesMapa(conPanel);
  const a = visor.mapa.getCoordinateFromPixel([izquierda, alto - abajo]);
  const b = visor.mapa.getCoordinateFromPixel([ancho - derecha, arriba]);
  if (b[0] - a[0] <= 0 || b[1] - a[1] <= 0) return visor.mapa.getView().calculateExtent(visor.mapa.getSize());
  return [a[0], a[1], b[0], b[1]];
}
