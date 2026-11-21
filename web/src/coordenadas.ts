import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { fromLonLat, toLonLat, transform } from 'ol/proj';

// Coordenadas para el profesional: WGS 84 (decimal y grados-minutos-segundos), Web Mercator y POSGAR 2007 /
// Argentina en fajas Gauss-Krüger (EPSG:5343 a 5349: faja 1, meridiano -72°, a faja 7, meridiano -54°).
// Convención argentina: X es la coordenada norte e Y la este, que lleva adelante el número de faja.
for (let faja = 1; faja <= 7; faja++) {
  proj4.defs(`EPSG:${5342 + faja}`, `+proj=tmerc +lat_0=-90 +lon_0=${-72 + (faja - 1) * 3} +k=1 +x_0=${faja * 1_000_000 + 500_000} +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`);
}
register(proj4);

export type LonLat = [number, number];

export const fajaDe = (lon: number) => Math.min(7, Math.max(1, Math.round((lon + 72) / 3) + 1));

export function aGaussKruger([lon, lat]: LonLat, faja = fajaDe(lon)) {
  const [este, norte] = transform([lon, lat], 'EPSG:4326', `EPSG:${5342 + faja}`);
  return { faja, epsg: 5342 + faja, x: norte, y: este };
}

function gms(valor: number, positivo: string, negativo: string) {
  const a = Math.abs(valor);
  const g = Math.floor(a);
  const m = Math.floor((a - g) * 60);
  const s = ((a - g) * 60 - m) * 60;
  return `${g}°${String(m).padStart(2, '0')}'${s.toFixed(1).padStart(4, '0')}"${valor < 0 ? negativo : positivo}`;
}

export function formatos(lonLat: LonLat) {
  const [lon, lat] = lonLat;
  const [mx, my] = fromLonLat(lonLat);
  const gk = aGaussKruger(lonLat);
  const n = (v: number, d: number) => v.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
  return [
    { rotulo: 'WGS 84 · decimal (lat, lon)', valor: `${lat.toFixed(6)}, ${lon.toFixed(6)}` },
    { rotulo: 'WGS 84 · grados, minutos y segundos', valor: `${gms(lat, 'N', 'S')} ${gms(lon, 'E', 'O')}` },
    { rotulo: `POSGAR 2007 · Gauss-Krüger faja ${gk.faja} (EPSG:${gk.epsg})`, valor: `X ${n(gk.x, 2)} · Y ${n(gk.y, 2)}` },
    { rotulo: 'Web Mercator (EPSG:3857)', valor: `${n(mx, 2)} · ${n(my, 2)}` },
  ];
}

const numero = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'));

// Lee una coordenada escrita a mano. Acepta:
//   -27.4512, -58.9866          (lat, lon decimal; si el primero es la longitud de Argentina, se da vuelta)
//   27°27'07"S 58°59'10"O       (grados, minutos y segundos, con S/N y O/W/E)
//   X 6963930 Y 5600183         (Gauss-Krüger: X norte, Y este con la faja adelante; sin letras, en ese orden)
//   -6566291 -3180058           (Web Mercator, metros)
export function leerCoordenada(texto: string): LonLat | null {
  const t = texto.trim().toUpperCase().replace(/W/g, 'O');
  const gmsRe = /(\d+(?:[.,]\d+)?)\s*°\s*(?:(\d+(?:[.,]\d+)?)\s*['′]\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:["″]|'')\s*)?([NSEO])/g;
  const partes = [...t.matchAll(gmsRe)];
  if (partes.length === 2) {
    let lat = NaN, lon = NaN;
    for (const [, g, m = '0', s = '0', h] of partes) {
      const v = (Number(g.replace(',', '.')) + Number(m.replace(',', '.')) / 60 + Number(s.replace(',', '.')) / 3600) * (h === 'S' || h === 'O' ? -1 : 1);
      if (h === 'N' || h === 'S') lat = v; else lon = v;
    }
    return Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : null;
  }
  const nums = (t.match(/-?\d[\d.,]*/g) ?? []).map(s => s.replace(/[.,]+$/, '')).map(s => (/^-?\d{1,3}([.,]\d+)?$/.test(s) ? Number(s.replace(',', '.')) : numero(s)));
  if (nums.length !== 2 || nums.some(n => !Number.isFinite(n))) return null;
  const [a, b] = nums;
  // Grados decimales.
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
    // En Argentina la longitud siempre es mayor (en valor absoluto) que la latitud: así se reconoce "lon, lat".
    const [lat, lon] = Math.abs(a) > 90 || (a < 0 && b < 0 && Math.abs(a) > Math.abs(b)) ? [b, a] : [a, b];
    return Math.abs(lat) <= 90 ? [lon, lat] : null;
  }
  // Web Mercator: dos valores negativos en Argentina.
  if (a < 0 && b < 0) {
    const [lon, lat] = toLonLat(Math.abs(a) > Math.abs(b) ? [a, b] : [b, a]);
    return [lon, lat];
  }
  // Gauss-Krüger: Y lleva la faja adelante (1.000.000 a 7.999.999), X es el norte.
  if (a > 0 && b > 0) {
    const [x, y] = /^\s*Y/.test(t) ? [b, a] : [a, b];
    const faja = Math.floor(y / 1_000_000);
    if (faja < 1 || faja > 7) return null;
    const [lon, lat] = transform([y, x], `EPSG:${5342 + faja}`, 'EPSG:4326');
    return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
  }
  return null;
}
