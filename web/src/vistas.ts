import { fromLonLat, toLonLat } from 'ol/proj';
import { CAPAS } from './config';
import { capasVisibles, ponerCapas, type Visor } from './visor';

// Vistas: el encuadre (centro y zoom) y las capas prendidas. Se guardan con nombre en el navegador y se
// comparten como enlace: #mapa=zoom/lat/lon&capas=a,b,c (se abre igual en otra computadora).
export interface Vista { nombre: string; zoom: number; lon: number; lat: number; capas: string[]; fecha: string }

const CLAVE = 'vistas-guardadas';

export function vistaActual(visor: Visor, nombre = ''): Vista {
  const v = visor.mapa.getView();
  const [lon, lat] = toLonLat(v.getCenter()!);
  return { nombre, zoom: Math.round(v.getZoom()! * 100) / 100, lon: Math.round(lon * 1e5) / 1e5, lat: Math.round(lat * 1e5) / 1e5, capas: capasVisibles(visor), fecha: new Date().toISOString() };
}

export function aplicarVista(visor: Visor, vista: Pick<Vista, 'zoom' | 'lon' | 'lat' | 'capas'>, animar = true) {
  const capas = vista.capas.filter(c => CAPAS.some(x => x.nombre === c));
  if (capas.length) ponerCapas(visor, capas);
  const view = visor.mapa.getView();
  const destino = { center: fromLonLat([vista.lon, vista.lat]), zoom: vista.zoom };
  if (animar) view.animate({ ...destino, duration: 1000 }); else { view.setCenter(destino.center); view.setZoom(destino.zoom); }
}

export function leerGuardadas(): Vista[] {
  try { return JSON.parse(localStorage.getItem(CLAVE) ?? '[]'); } catch { return []; }
}

export function escribirGuardadas(vistas: Vista[]) {
  try { localStorage.setItem(CLAVE, JSON.stringify(vistas)); } catch { /* sin almacenamiento */ }
}

export function enlaceDe(vista: Vista) {
  const url = new URL(location.href);
  url.hash = `mapa=${vista.zoom}/${vista.lat}/${vista.lon}&capas=${vista.capas.join(',')}`;
  return url.toString();
}

// Al abrir el visor con un enlace de vista, lo aplica (sin animación) y limpia el hash.
export function vistaDelEnlace(): Pick<Vista, 'zoom' | 'lon' | 'lat' | 'capas'> | null {
  const params = new URLSearchParams(location.hash.slice(1));
  const mapa = params.get('mapa')?.split('/').map(Number);
  if (!mapa || mapa.length !== 3 || mapa.some(n => !Number.isFinite(n))) return null;
  const [zoom, lat, lon] = mapa;
  return { zoom, lat, lon, capas: (params.get('capas') ?? '').split(',').filter(Boolean) };
}
