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
import { MultiLineString, Point } from 'ol/geom';
import type { Coordinate } from 'ol/coordinate';
import { Circle, Fill, RegularShape, Stroke, Style, Text } from 'ol/style';
import { getVectorContext } from 'ol/render';
import type RenderEvent from 'ol/render/Event';
import { ponerFactorMapa, sldDeCapas, sldDeLeyenda, tamanoMapa } from './estilos';
import { escalaActual, factorPantalla, movimientoReducido } from './preferencias';
import { CAPAS, EXTENSION_CHACO, URL_WMS } from './config';
import { claveRuta, type Ruta, type Traza } from './analisisRuta';
import { CAPITALES, PROVINCIAS } from './provincias';

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
  // Capas cuyos rótulos del WMS se callan (con el tablero abierto, localidades: los pinta el visor).
  sinRotulos: Set<string>;
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

const estiloFoco = (feature: import('ol/Feature').FeatureLike, resolucion: number) => {
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

// Radio de la burbuja: el área es proporcional a los habitantes (Resistencia, unos 290 000, llega al tope).
export const radioLocalidad = (habitantes: number) => tamanoMapa(Math.min(4 + Math.sqrt(habitantes) / 32, 20));

function estiloAnalisis(feature: import('ol/Feature').FeatureLike, resolucion: number) {
  const tipo = feature.get('tipo_analisis');
  if (tipo === 'traza') {
    const cos = feature.get('cos_latitud') ?? Math.cos((27 * Math.PI) / 180);
    const alfa = opacidadBanda(resolucion);
    return [
      new Style({ stroke: new Stroke({ color: hacerTransparente(paleta.dato2, alfa), width: ancho(20_000, resolucion, cos), lineCap: 'round', lineJoin: 'round' }) }),
      new Style({ stroke: new Stroke({ color: hacerTransparente(paleta.dato1, alfa), width: ancho(10_000, resolucion, cos), lineCap: 'round', lineJoin: 'round' }) }),
    ];
  }
  if (tipo === 'localidad') {
    // Más lejos que 1:5.000.000 las burbujas se amontonan en un manchón: queda solo la traza con sus franjas.
    if (resolucion > 1500) return undefined;
    const habitantes = Number(feature.get('habitantes')) || 0;
    const color = feature.get('franja') === 1 ? paleta.dato1 : paleta.dato2;
    const elegida = !!feature.get('elegida');
    // Sin dato de habitantes: un anillo hueco, así no se confunde con un pueblo chico.
    const radio = habitantes ? radioLocalidad(habitantes) : tamanoMapa(4);
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
  // Hasta 1:6.000.000 con el denominador de GeoServer: 6.000.000 × 0,00028 = 1680 m por píxel.
  return new VectorLayer({ source: fuente, style: estiloCapital, declutter: true, maxResolution: 1680, zIndex: 31 });
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

  const mapa = new Map({
    target: destino,
    layers: [
      cuadricula,
      wms,
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

  const visor: Visor = { mapa, wms, visibles: new Set(CAPAS_INICIALES), opacidades: {}, sueltas: {}, suscriptores: new Set(), resaltado, foco, dibujo, ruta, analisis, cuadricula, rotulos, capitales, sinRotulos: new Set() };
  actualizarWms(visor);
  return visor;
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

export function cambiarOpacidad(visor: Visor, nombre: string, opacidad: number) {
  if (opacidad >= 0.99) delete visor.opacidades[nombre];
  else visor.opacidades[nombre] = opacidad;
  actualizarWms(visor);
}

function actualizarWms(visor: Visor) {
  const nombres = capasVisibles(visor);
  const combinadas = nombres.filter(n => visor.opacidades[n] === undefined);
  visor.wms.setVisible(combinadas.length > 0);
  visor.rotulos.setVisible(visor.visibles.has('provincias'));
  // Con el tablero abierto los nombres de localidades los pinta su capa: las capitales también callan.
  visor.capitales.setVisible(visor.visibles.has('localidades') && !visor.sinRotulos.has('localidades'));
  if (combinadas.length) ponerSld(visor.wms, combinadas, visor.sinRotulos);

  // Las sueltas se dibujan arriba de la combinada, en su orden de dibujo entre ellas.
  for (const [nombre, capa] of Object.entries(visor.sueltas)) {
    if (!visor.visibles.has(nombre) || visor.opacidades[nombre] === undefined) {
      visor.mapa.removeLayer(capa);
      delete visor.sueltas[nombre];
    }
  }
  nombres.forEach((nombre, i) => {
    const opacidad = visor.opacidades[nombre];
    if (opacidad === undefined) return;
    let capa = visor.sueltas[nombre];
    if (!capa) {
      capa = crearCapaWms();
      visor.sueltas[nombre] = capa;
      visor.mapa.addLayer(capa);
    }
    ponerSld(capa, [nombre], visor.sinRotulos);
    capa.setOpacity(opacidad);
    capa.setZIndex(10 + (i + 1) / (nombres.length + 1));
  });
  visor.suscriptores.forEach(aviso => aviso());
}

// Después de un WFS-T: el parámetro nuevo hace que se pidan teselas nuevas (y saltea la caché).
export function refrescarMapa(visor: Visor) {
  [visor.wms, ...Object.values(visor.sueltas)].forEach(c => c.getSource()!.updateParams({ _: Date.now() }));
}

// GetFeatureInfo con el mismo SLD que las teselas (por POST, como ellas): GeoServer evalúa las reglas
// del estilo, filtros y escala incluidos, así la consulta devuelve solo lo que se ve. Sin el SLD, de
// lejos aparecían bañados y arroyos que a esa escala no se dibujan. La fuente aparte sirve solo para
// armar la URL.
// Con la misma grilla que las teselas: getFeatureInfoUrl toma la resolución de su nivel de teselas, y tiene
// que ser la del dibujo para que la consulta devuelva lo que se ve.
const fuenteConsulta = new TileWMS({ url: URL_WMS, params: {}, tileGrid: GRILLA_512 });
export async function consultarPuntoWms(visor: Visor, coordenada: Coordinate, nombres: string[], maximo = 10, señal?: AbortSignal) {
  const capas = nombres.join(',');
  const url = fuenteConsulta.getFeatureInfoUrl(coordenada, visor.mapa.getView().getResolution()!, 'EPSG:3857', {
    LAYERS: capas, QUERY_LAYERS: capas, INFO_FORMAT: 'application/json', FEATURE_COUNT: maximo,
  })!;
  const respuesta = await fetch(url, { method: 'POST', body: new URLSearchParams({ SLD_BODY: sldDeCapas(nombres, visor.sinRotulos) }), signal: señal });
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
}

// Leyenda de GeoServer. En tema oscuro se invierte por CSS igual que el mapa (.leyenda-wms).
// Las capas con estilo propio mandan su SLD por POST, por el mismo límite de cabeceras que las teselas.
// `ppp`: puntos por pulgada de la imagen (para el PDF, el doble de los 96 de pantalla).
export async function cargarLeyenda(nombre: string, señal: AbortSignal, simple = false, ppp?: number): Promise<string> {
  const opciones = ['fontName:Helvetica', 'fontAntiAliasing:true', 'fontSize:12', 'dx:8', 'forceLabels:on', 'fontColor:0x2A2E33', ...(ppp ? [`dpi:${ppp}`] : [])].join(';');
  const url = `${URL_WMS}?service=WMS&request=GetLegendGraphic&format=image/png&transparent=true`
    + `&width=18&height=18&layer=${nombre}&legend_options=${opciones}`;
  const sld = sldDeLeyenda(nombre, simple);
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


export function volarA(visor: Visor, extension: number[], opciones: { maxZoom?: number; duracion?: number; conPanel?: boolean; minResolution?: number } = {}) {
  const vista = visor.mapa.getView();
  vista.cancelAnimations();
  vista.fit(extension, {
    size: visor.mapa.getSize(),
    padding: margenesMapa(opciones.conPanel),
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
  // Pro: barra de arriba, barra lateral de capas, inspector fijo a la derecha y barra de estado abajo.
  pro: { base: [96, 420, 80, 340], conPanel: 420 },
};
let disposicion: 'simple' | 'pro' = 'pro';
let lateralPlegado = false;
let inspectorPlegado = false;
export function ponerDisposicion(interfaz: 'simple' | 'pro', plegado = false, sinInspector = false) {
  disposicion = interfaz;
  lateralPlegado = plegado;
  inspectorPlegado = sinInspector;
}

function margenesMapa(conPanel = false): Margenes {
  if (window.innerWidth < 1024 && conPanel) return [150, 20, Math.round(window.innerHeight * 0.5), 20];
  if (window.innerWidth < 768) return [150, 20, 190, 20];
  const escala = escalaActual();
  const { base, conPanel: derecha } = DISPOSICIONES[disposicion];
  const margenDerecho = disposicion === 'pro' && inspectorPlegado ? 40 : base[1];
  const margenes: Margenes = [base[0], conPanel ? Math.max(margenDerecho, derecha) : margenDerecho, base[2], disposicion === 'pro' && lateralPlegado ? 96 : base[3]];
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
export function capasParaImprimir(visor: Visor) {
  const nombres = capasVisibles(visor);
  const combinadas = nombres.filter(n => visor.opacidades[n] === undefined);
  const capas: (TileLayer<TileWMS> | VectorLayer<VectorSource>)[] = [];
  if (combinadas.length) capas.push(capaWmsImpresion(combinadas, visor.sinRotulos));
  nombres.forEach((nombre, i) => {
    const opacidad = visor.opacidades[nombre];
    if (opacidad === undefined) return;
    const capa = capaWmsImpresion([nombre], visor.sinRotulos, opacidad);
    capa.setZIndex(10 + (i + 1) / (nombres.length + 1));
    capas.push(capa);
  });
  for (const capa of visor.mapa.getLayers().getArray()) {
    if (!(capa instanceof VectorLayer) || capa instanceof Graticule || !capa.getVisible()) continue;
    const estilo = capa.getStyleFunction();
    if (!estilo) continue;
    capas.push(new VectorLayer({
      source: capa.getSource()!,
      style: (feature, resolucion) => paraImprimir(() => estilo(feature, resolucion)),
      declutter: capa.getDeclutter(),
      zIndex: capa.getZIndex(),
      minResolution: capa.getMinResolution(),
      maxResolution: capa.getMaxResolution(),
      opacity: capa.getOpacity(),
    }));
  }
  return capas;
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
