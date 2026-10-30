import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import { toLonLat } from 'ol/proj';
import type { Point } from 'ol/geom';
import { FILTRO_RN11, URL_WFS, WORKSPACE } from './config';
import { distanciaALineas, longitud, recortar, type Linea, type LonLat, type Poligono } from './geodesia';

// Las preguntas de la parte B, respondidas en vivo: longitud de la RN11 en Chaco, población en las
// franjas excluyentes de 0–10 km y 10–20 km, y puentes sobre la traza. GeoServer da los candidatos con
// margen (DWithin aproxima metros en grados) y la distancia exacta se calcula acá (geodesia.ts).

export const RADIOS = { franja1: 10_000, franja2: 20_000, puentes: 100 };

export interface LocalidadCercana {
  id: string;
  nombre: string;
  departamento: string;
  habitantes: number;
  distancia: number;
  franja: 1 | 2;
  feature: Feature;
}

export interface PuenteCercano {
  id: string;
  nombre: string;
  tipo: string;
  distancia: number;
  feature: Feature;
}

export interface AnalisisRn11 {
  km: number;
  tramos: number;
  localidades: LocalidadCercana[];
  puentes: PuenteCercano[];
  franja1: { localidades: number; habitantes: number; sinDato: number };
  franja2: { localidades: number; habitantes: number; sinDato: number };
}

interface ColeccionGeoJSON {
  features: { id: string; properties: Record<string, string | number | null>; geometry: { type: string; coordinates: unknown } }[];
}

export async function pedir(url: string, cuerpo?: string): Promise<ColeccionGeoJSON> {
  const respuesta = await fetch(url, cuerpo ? { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: cuerpo } : undefined);
  const texto = await respuesta.text();
  if (!respuesta.ok || texto.startsWith('<')) throw new Error('GeoServer no pudo responder el análisis de la RN11.');
  return JSON.parse(texto);
}

export const poligonosDe = (g: { type: string; coordinates: unknown }) =>
  (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]) as Poligono[];
export const lineasDe = (g: { type: string; coordinates: unknown }) =>
  (g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]) as Linea[];

// En GML con EPSG:4326 el orden de los ejes es latitud longitud.
const posiciones = (puntos: LonLat[]) => puntos.map(([x, y]) => `${y} ${x}`).join(' ');
export const gmlLineas = (lineas: Linea[]) => '<gml:MultiCurve srsName="urn:ogc:def:crs:EPSG::4326">'
  + lineas.map(l => `<gml:curveMember><gml:LineString><gml:posList>${posiciones(l)}</gml:posList></gml:LineString></gml:curveMember>`).join('')
  + '</gml:MultiCurve>';
export const gmlPoligonos = (poligonos: Poligono[]) => '<gml:MultiSurface srsName="urn:ogc:def:crs:EPSG::4326">'
  + poligonos.map(p => `<gml:surfaceMember><gml:Polygon><gml:exterior><gml:LinearRing><gml:posList>${posiciones(p[0])}</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></gml:surfaceMember>`).join('')
  + '</gml:MultiSurface>';

function consultaCerca(capa: string, propiedades: string[], lineas: Linea[], metros: number, chaco: Poligono[]) {
  return `<wfs:GetFeature service="WFS" version="2.0.0" outputFormat="application/json"
    xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2">
    <wfs:Query typeNames="${WORKSPACE}:${capa}" srsName="EPSG:3857">
      ${['geom', ...propiedades].map(p => `<wfs:PropertyName>${p}</wfs:PropertyName>`).join('')}
      <fes:Filter><fes:And>
        <fes:DWithin><fes:ValueReference>geom</fes:ValueReference>${gmlLineas(lineas)}<fes:Distance uom="m">${metros}</fes:Distance></fes:DWithin>
        <fes:Intersects><fes:ValueReference>geom</fes:ValueReference>${gmlPoligonos(chaco)}</fes:Intersects>
      </fes:And></fes:Filter>
    </wfs:Query></wfs:GetFeature>`;
}

const BASE = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=CRS:84`;

const provincias = new Map<string, Promise<Poligono[]>>();
export function provincia(nombre: string): Promise<Poligono[]> {
  if (!provincias.has(nombre)) {
    const filtro = encodeURIComponent(`provincia = '${nombre.replaceAll("'", "''")}'`);
    provincias.set(nombre, pedir(`${BASE}&typeNames=${WORKSPACE}:provincias&CQL_FILTER=${filtro}`).then(r => {
      if (!r.features.length) throw new Error(`No existe la provincia ${nombre}.`);
      return poligonosDe(r.features[0].geometry);
    }));
  }
  return provincias.get(nombre)!;
}

// La traza de la RN11 en Chaco (tramos que tocan la provincia), pedida una sola vez.
let traza: Promise<{ lineas: Linea[]; tramos: number; chaco: Poligono[] }> | undefined;
export function trazaRn11() {
  traza ??= (async () => {
    const chaco = await provincia('Chaco');
    const anillo = chaco.map(p => p[0]).reduce((a, b) => (b.length > a.length ? b : a));
    const paso = Math.max(1, Math.floor(anillo.length / 120));
    const simple = [...anillo.filter((_, i) => i % paso === 0), anillo[0]];
    const wkt = `POLYGON((${simple.map(([x, y]) => `${y.toFixed(4)} ${x.toFixed(4)}`).join(',')}))`;
    const tramos = (await pedir(`${BASE}&typeNames=${WORKSPACE}:red_vial&propertyName=geom&CQL_FILTER=${encodeURIComponent(`${FILTRO_RN11} AND INTERSECTS(geom, ${wkt})`)}`)).features;
    return { lineas: tramos.flatMap(t => lineasDe(t.geometry)), tramos: tramos.length, chaco };
  })();
  traza.catch(() => { traza = undefined; });
  return traza;
}

export async function analizarRn11(): Promise<AnalisisRn11> {
  const { lineas, tramos: cantidad, chaco } = await trazaRn11();

  const km = recortar(lineas, chaco).reduce((total, l) => total + longitud(l), 0) / 1000;

  const formato = new GeoJSON();
  const [locales, puentes] = await Promise.all([
    pedir(URL_WFS, consultaCerca('localidades', ['nombre', 'departamen', 'canthab'], lineas, 25_000, chaco)),
    pedir(URL_WFS, consultaCerca('puente_red_vial_puntos', ['nombre', 'tipo'], lineas, 400, chaco)),
  ]);

  const lonLat = (f: Feature) => toLonLat((f.getGeometry() as Point).getCoordinates()) as LonLat;
  const featuresLocales = formato.readFeatures(locales, { dataProjection: 'EPSG:3857' });
  const localidades = locales.features.map((l, i): LocalidadCercana | null => {
    const distancia = distanciaALineas(lonLat(featuresLocales[i]), lineas);
    if (distancia > RADIOS.franja2) return null;
    featuresLocales[i].set('franja', distancia <= RADIOS.franja1 ? 1 : 2);
    return {
      id: l.id,
      nombre: String(l.properties.nombre ?? 'Sin nombre'),
      departamento: String(l.properties.departamen ?? ''),
      habitantes: Number(l.properties.canthab) || 0,
      distancia,
      franja: distancia <= RADIOS.franja1 ? 1 : 2,
      feature: featuresLocales[i],
    };
  }).filter((l): l is LocalidadCercana => l !== null).sort((a, b) => a.distancia - b.distancia);

  const featuresPuentes = formato.readFeatures(puentes, { dataProjection: 'EPSG:3857' });
  const puentesCerca = puentes.features.map((p, i): PuenteCercano | null => {
    const distancia = distanciaALineas(lonLat(featuresPuentes[i]), lineas);
    if (distancia > RADIOS.puentes) return null;
    return {
      id: p.id,
      nombre: String(p.properties.nombre || 'Puente sin nombre'),
      tipo: String(p.properties.tipo ?? ''),
      distancia,
      feature: featuresPuentes[i],
    };
  }).filter((p): p is PuenteCercano => p !== null).sort((a, b) => a.distancia - b.distancia);

  const resumir = (franja: 1 | 2) => {
    const lista = localidades.filter(l => l.franja === franja);
    return { localidades: lista.length, habitantes: lista.reduce((s, l) => s + l.habitantes, 0), sinDato: lista.filter(l => !l.habitantes).length };
  };
  return { km, tramos: cantidad, localidades, puentes: puentesCerca, franja1: resumir(1), franja2: resumir(2) };
}
