// El mapa de la hoja: un mapa de OpenLayers fuera de pantalla, del tamaño del marco en la hoja (a 96
// puntos por pulgada) y con pixelRatio 2, así sale a ~190 ppp. Encuadra lo que se ve en pantalla (sin
// lo que tapan los paneles) con una escala redonda (1:2.500.000 y no 1:2.381.904).
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import { getCenter, getHeight, getWidth } from 'ol/extent';
import { toLonLat } from 'ol/proj';
import { capasParaImprimir, extensionLibre, type Visor } from '../visor';

// Metros de papel por píxel CSS (96 ppp).
const METROS_POR_PX = 0.0254 / 96;
const MM_A_PX = 96 / 25.4;
const PIXEL_RATIO = 2;
// Fondo del mapa: el papel del tema claro, como en pantalla.
export const PAPEL = '#eceeeb';

// Escalas "redondas": 1; 1,25; 1,5; 2; 2,5; 3; 4; 5; 6; 7,5 × 10^n (con el 6, "lo que estás viendo" no se
// aleja ×1,5 al pasar de 5 a 7,5).
const PASOS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5];
// La primera escala redonda mayor o igual.
export function escalaRedonda(denominador: number) {
  const potencia = 10 ** Math.floor(Math.log10(denominador));
  const paso = [...PASOS, 10].find(p => p * potencia >= denominador * 0.999)!;
  return Math.round(paso * potencia);
}
// La escala redonda `saltos` pasos más lejos (positivo) o más cerca (negativo).
export function escalaVecina(denominador: number, saltos: number) {
  let exponente = Math.floor(Math.log10(denominador));
  let i = PASOS.findIndex(p => Math.round(p * 10 ** exponente) === denominador);
  if (i < 0) return denominador;
  i += saltos;
  exponente += Math.floor(i / PASOS.length);
  i = ((i % PASOS.length) + PASOS.length) % PASOS.length;
  return Math.round(PASOS[i] * 10 ** exponente);
}

// La escala con la que `extension` entra entera en un marco de anchoMm × altoMm.
export function escalaParaEncuadre(extension: number[], anchoMm: number, altoMm: number) {
  const cosLatitud = Math.cos((toLonLat(getCenter(extension))[1] * Math.PI) / 180);
  const resolucion = Math.max(getWidth(extension) / (anchoMm * MM_A_PX), getHeight(extension) / (altoMm * MM_A_PX));
  return escalaRedonda((resolucion * cosLatitud) / METROS_POR_PX);
}

export interface MapaImpreso {
  imagen: string; // JPEG en data URL
  denominador: number;
  extension: number[]; // EPSG:3857 del marco completo
  anchoMm: number;
  altoMm: number;
}

// Lo que se ve en pantalla, sin lo que tapan los paneles: el encuadre "como lo estás viendo".
export const encuadreActual = (visor: Visor, conPanel: boolean) => extensionLibre(visor, conPanel);

// Escalas útiles para la hoja: más cerca que 1:50.000 los datos del IGN (1:250.000) no dan más detalle,
// y más lejos que 1:10.000.000 el Chaco es un punto.
export const ESCALA_MAS_CERCA = 50_000;
export const ESCALA_MAS_LEJOS = 10_000_000;

// `extension`: qué encuadrar (se centra ahí). `denominador`: la escala; si no viene, la redonda con la
// que entra toda la extensión.
export async function dibujarMapa(visor: Visor, anchoMm: number, altoMm: number, extension: number[], denominadorPedido?: number, señal?: AbortSignal): Promise<MapaImpreso> {
  const ancho = Math.round(anchoMm * MM_A_PX);
  const alto = Math.round(altoMm * MM_A_PX);
  const centro = getCenter(extension);
  const cosLatitud = Math.cos((toLonLat(centro)[1] * Math.PI) / 180);
  // Denominador real en el centro (corregido por latitud).
  const denominador = denominadorPedido ?? escalaParaEncuadre(extension, anchoMm, altoMm);
  const resolucion = (denominador * METROS_POR_PX) / cosLatitud;

  const destino = document.createElement('div');
  Object.assign(destino.style, { position: 'fixed', left: '-20000px', top: '0', width: `${ancho}px`, height: `${alto}px` });
  document.body.appendChild(destino);
  const capas = capasParaImprimir(visor);
  // Teselas pedidas, cargadas y fallidas: si GeoServer rechaza o se cuelga, la hoja no sale con el
  // mapa vacío.
  let pedidas = 0; let cargadas = 0; let fallidas = 0;
  for (const capa of capas) {
    if (!(capa instanceof TileLayer)) continue;
    capa.getSource()!.on('tileloadstart', () => pedidas++);
    capa.getSource()!.on('tileloadend', () => cargadas++);
    capa.getSource()!.on('tileloaderror', () => fallidas++);
  }
  const mapa = new Map({
    target: destino,
    layers: capas,
    view: new View({ center: centro, resolution: resolucion }),
    controls: [],
    interactions: [],
    pixelRatio: PIXEL_RATIO,
  });
  try {
    await new Promise<void>((listo, fallo) => {
      // Tope: lo que no llegó en 15 s cuenta como fallido (GeoServer colgado no rechaza: no responde).
      const tope = setTimeout(listo, 15000);
      mapa.once('rendercomplete', () => { clearTimeout(tope); listo(); });
      señal?.addEventListener('abort', () => { clearTimeout(tope); fallo(new DOMException('cancelado', 'AbortError')); });
    });
    // Cualquier tesela fallida o que no llegó deja un hueco en la hoja: es error (se puede reintentar).
    if (fallidas > 0 || cargadas < pedidas) throw new Error(`Faltan teselas: ${cargadas} de ${pedidas} (${fallidas} fallidas).`);
    // Las capas se componen en un solo lienzo, con su opacidad y su transformación (como el ejemplo
    // de exportación de OpenLayers).
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho * PIXEL_RATIO;
    lienzo.height = alto * PIXEL_RATIO;
    const ctx = lienzo.getContext('2d')!;
    ctx.fillStyle = PAPEL;
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    destino.querySelectorAll<HTMLCanvasElement>('.ol-layer canvas, canvas.ol-layer').forEach(capa => {
      if (!capa.width) return;
      const opacidad = (capa.parentNode as HTMLElement).style.opacity || capa.style.opacity;
      ctx.globalAlpha = opacidad === '' ? 1 : Number(opacidad);
      // La transformación lleva de píxeles del lienzo de la capa a píxeles CSS del mapa; el lienzo de
      // la hoja tiene PIXEL_RATIO píxeles por píxel CSS.
      const matriz = capa.style.transform.match(/^matrix\(([^(]*)\)$/)?.[1].split(',').map(Number) ?? [1 / PIXEL_RATIO, 0, 0, 1 / PIXEL_RATIO, 0, 0];
      ctx.setTransform(...(matriz.map(v => v * PIXEL_RATIO) as [number, number, number, number, number, number]));
      const fondo = (capa.parentNode as HTMLElement).style.backgroundColor;
      if (fondo) { ctx.fillStyle = fondo; ctx.fillRect(0, 0, capa.width, capa.height); }
      ctx.drawImage(capa, 0, 0);
    });
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return {
      imagen: lienzo.toDataURL('image/jpeg', 0.93),
      denominador,
      extension: mapa.getView().calculateExtent([ancho, alto]),
      anchoMm,
      altoMm,
    };
  } finally {
    mapa.setTarget(undefined);
    mapa.dispose();
    destino.remove();
  }
}
