// Medidas sobre el elipsoide WGS 84 para distancias cortas (hasta decenas de km): en cada lugar se usan
// los metros por grado de latitud y de longitud de esa latitud. A 20 km el error queda por debajo del
// metro, así que los resultados coinciden con PostGIS (geography) para la parte B.

export type LonLat = [number, number];
export type Linea = LonLat[];
// Un polígono: anillo exterior y huecos.
export type Poligono = LonLat[][];

const A = 6378137;
const E2 = 0.00669437999014;

function metrosPorGrado(lat: number) {
  const φ = (lat * Math.PI) / 180;
  const s = Math.sin(φ);
  const w = Math.sqrt(1 - E2 * s * s);
  return {
    lat: (Math.PI / 180) * (A * (1 - E2)) / (w * w * w),
    lon: (Math.PI / 180) * (A * Math.cos(φ)) / w,
  };
}

function largoTramo(a: LonLat, b: LonLat) {
  const m = metrosPorGrado((a[1] + b[1]) / 2);
  return Math.hypot((b[0] - a[0]) * m.lon, (b[1] - a[1]) * m.lat);
}

export const longitud = (linea: Linea) => linea.slice(1).reduce((total, p, i) => total + largoTramo(linea[i], p), 0);

// Distancia mínima de un punto a un conjunto de líneas, en metros.
export function distanciaALineas(punto: LonLat, lineas: Linea[]): number {
  const m = metrosPorGrado(punto[1]);
  const x = (p: LonLat) => (p[0] - punto[0]) * m.lon;
  const y = (p: LonLat) => (p[1] - punto[1]) * m.lat;
  let minima = Infinity;
  for (const linea of lineas) {
    for (let i = 1; i < linea.length; i++) {
      const ax = x(linea[i - 1]); const ay = y(linea[i - 1]);
      const bx = x(linea[i]); const by = y(linea[i]);
      const dx = bx - ax; const dy = by - ay;
      const largo2 = dx * dx + dy * dy;
      const t = largo2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / largo2)) : 0;
      minima = Math.min(minima, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return minima;
}

// ¿El punto está adentro del polígono? (rayo; los huecos restan).
export function adentro(p: LonLat, poligono: Poligono): boolean {
  let dentro = false;
  for (const anillo of poligono) {
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i]; const [xj, yj] = anillo[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  }
  return dentro;
}

// Recorta líneas al interior de los polígonos: corta cada tramo donde cruza un borde y se queda con
// los pedazos cuyo punto medio cae adentro.
export function recortar(lineas: Linea[], poligonos: Poligono[]): Linea[] {
  const bordes: [LonLat, LonLat][] = poligonos.flatMap(p => p.flatMap(anillo => anillo.slice(1).map((q, i) => [anillo[i], q] as [LonLat, LonLat])));
  const resultado: Linea[] = [];
  for (const linea of lineas) {
    for (let i = 1; i < linea.length; i++) {
      const a = linea[i - 1]; const b = linea[i];
      const cortes = [0, 1];
      const [minX, maxX] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
      const [minY, maxY] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
      for (const [c, d] of bordes) {
        if (Math.max(c[0], d[0]) < minX || Math.min(c[0], d[0]) > maxX || Math.max(c[1], d[1]) < minY || Math.min(c[1], d[1]) > maxY) continue;
        const r = [b[0] - a[0], b[1] - a[1]]; const s = [d[0] - c[0], d[1] - c[1]];
        const den = r[0] * s[1] - r[1] * s[0];
        if (!den) continue;
        const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
        const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) cortes.push(t);
      }
      cortes.sort((p, q) => p - q);
      for (let k = 1; k < cortes.length; k++) {
        const p0: LonLat = [a[0] + (b[0] - a[0]) * cortes[k - 1], a[1] + (b[1] - a[1]) * cortes[k - 1]];
        const p1: LonLat = [a[0] + (b[0] - a[0]) * cortes[k], a[1] + (b[1] - a[1]) * cortes[k]];
        const medio: LonLat = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        if (poligonos.some(p => adentro(medio, p))) resultado.push([p0, p1]);
      }
    }
  }
  return resultado;
}
