// Dónde queda cada cosa, dicho con el pueblo más cercano ("En Fontana", "A 4 km de Basail"). Lo usa la
// lista de resultados para distinguir las cosas que se llaman igual: el IGN tiene cientos de
// "Escuela Provincial" sin nombre propio y sin campo de localidad.
import { getCenter } from 'ol/extent';
import { toLonLat } from 'ol/proj';
import { getDistance } from 'ol/sphere';
import { URL_WFS, WORKSPACE } from './config';
import type { Entidad } from './herramientas';

// Hasta dónde se busca un pueblo alrededor de las cosas a ubicar.
const RADIO = 25_000;
// Más cerca que esto, la cosa está "en" el pueblo.
const EN_EL_PUEBLO = 1_500;

type Punto = [number, number];

export async function ubicarEntidades(entidades: Entidad[], señal: AbortSignal): Promise<Map<string, string>> {
  const centros = new Map<string, Punto>(entidades.map(e => [e.id, getCenter(e.feature.getGeometry()!.getExtent()) as Punto]));
  if (!centros.size) return new Map();
  const xs = [...centros.values()].map(c => c[0]);
  const ys = [...centros.values()].map(c => c[1]);
  const caja = [Math.min(...xs) - RADIO, Math.min(...ys) - RADIO, Math.max(...xs) + RADIO, Math.max(...ys) + RADIO];
  const filtro = `BBOX(geom,${caja.join(',')},'EPSG:3857') AND NOT (nombre ILIKE 'sin nombre')`;
  const url = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:localidades`
    + `&outputFormat=application/json&srsName=EPSG:3857&count=5000&propertyName=geom,nombre&CQL_FILTER=${encodeURIComponent(filtro)}`;
  // Con tope: si el WFS se cuelga, la impresión no queda esperando para siempre.
  const respuesta = await fetch(url, { signal: AbortSignal.any([señal, AbortSignal.timeout(15000)]) });
  // Un error lo tiene que saber quien pidió (la impresión avisa y deja reintentar): no se calla.
  if (!respuesta.ok) throw new Error(`Cercanías: ${respuesta.status}`);
  const datos: { features: { geometry: { coordinates: Punto } | null; properties: { nombre: string } }[] } = await respuesta.json();
  const pueblos = datos.features.filter(f => f.geometry).map(f => ({ nombre: f.properties.nombre, xy: f.geometry!.coordinates }));

  const ubicaciones = new Map<string, string>();
  for (const [id, centro] of centros) {
    // En EPSG:3857 la distancia plana sirve para elegir el más cercano; el número se mide sobre el elipsoide.
    let mejor: (typeof pueblos)[number] | undefined;
    let menor = Infinity;
    for (const p of pueblos) {
      const d = (p.xy[0] - centro[0]) ** 2 + (p.xy[1] - centro[1]) ** 2;
      if (d < menor) { menor = d; mejor = p; }
    }
    if (!mejor) continue;
    const metros = getDistance(toLonLat(centro), toLonLat(mejor.xy));
    ubicaciones.set(id, metros < EN_EL_PUEBLO
      ? `En ${mejor.nombre}`
      : `A ${(metros / 1000).toLocaleString('es-AR', { maximumFractionDigits: metros < 10_000 ? 1 : 0 })} km de ${mejor.nombre}`);
  }
  return ubicaciones;
}
