// Tabla de datos (T4, modo profesional): los datos. Todo por WFS y del lado del servidor: GeoServer
// pagina, ordena y filtra (CQL), así una capa de 96.000 entidades se recorre igual que una de 20.
// Solo lectura, salvo las obras de la RN11, que se editan y se borran por WFS-T.
import GeoJSON from 'ol/format/GeoJSON';
import { NAMESPACE, URL_WFS, URL_WFST, WORKSPACE } from './config';
import { OCULTOS } from './herramientas';
import { CLAVE } from './entidades';

export type TipoColumna = 'texto' | 'numero' | 'fecha';
export interface Columna { nombre: string; tipo: TipoColumna }

export type Operador = 'contiene' | 'es' | 'mayor' | 'menor' | 'vacio' | 'conDato';
export interface Filtro { columna: string; operador: Operador; valor: string }

export interface Criterios {
  capa: string;
  busqueda: string;
  filtros: Filtro[];
  // Solo lo que se ve en el mapa (EPSG:3857), o null.
  extension: number[] | null;
  orden: { columna: string; descendente: boolean } | null;
}

export interface Fila { id: string; valores: Record<string, unknown> }
export interface Pagina { filas: Fila[]; total: number }

export const POR_PAGINA = 50;
// Tope para exportar de una vez (las 96.056 "otras edificaciones" entran).
export const TOPE_EXPORTAR = 100_000;
export const EDITABLE = 'obras_rn11';

const TIPOS: Record<string, TipoColumna> = { int: 'numero', number: 'numero', double: 'numero', long: 'numero', short: 'numero', float: 'numero', decimal: 'numero', date: 'fecha', 'date-time': 'fecha', dateTime: 'fecha' };
// Metadatos del IGN: al final de la tabla y fuera de la búsqueda («IGN» o «mapas» coincidían con todo).
export const AL_FINAL = ['precision', 'escala', 'fuente', 'coddepto', 'codloc'];
const visible = (campo: string) => !OCULTOS.has(campo) && !campo.startsWith('igds_');

// Las columnas que se muestran (sin los campos técnicos del IGN), con el nombre primero.
const esquemas = new Map<string, Promise<Columna[]>>();
export function columnasDe(capa: string): Promise<Columna[]> {
  let esquema = esquemas.get(capa);
  if (!esquema) {
    esquema = fetch(`${URL_WFS}?service=WFS&version=2.0.0&request=DescribeFeatureType&typeNames=${WORKSPACE}:${capa}&outputFormat=application/json`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d: { featureTypes: { properties: { name: string; localType: string }[] }[] }) => {
        const columnas = d.featureTypes[0].properties
          .filter(p => p.name !== 'geom' && !/^(Multi)?(Point|LineString|Polygon|Geometry)$/.test(p.localType) && visible(p.name))
          .map(p => ({ nombre: p.name, tipo: TIPOS[p.localType] ?? 'texto' }));
        // Primero lo que más dice (el nombre y los datos clave de la ficha), al final los metadatos del IGN.
        const peso = (c: string) => (c === 'nombre' ? -1 : CLAVE.includes(c) ? CLAVE.indexOf(c) : AL_FINAL.includes(c) ? 100 + AL_FINAL.indexOf(c) : 50);
        return columnas.map((c, i) => ({ c, i })).sort((a, b) => peso(a.c.nombre) - peso(b.c.nombre) || a.i - b.i).map(x => x.c);
      });
    esquema.catch(() => esquemas.delete(capa));
    esquemas.set(capa, esquema);
  }
  return esquema;
}

// CQL: comillas simples duplicadas; la búsqueda, sin tildes y sin distinguir mayúsculas.
const literal = (v: string) => `'${v.replaceAll("'", "''")}'`;
const sinTildes = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '');
const comodin = (v: string) => literal(`%${sinTildes(v).replaceAll('%', '').replaceAll('_', '')}%`);
// Números como se escriben acá («20.000», «1,5») y también con punto decimal («1.5»): un punto es de miles
// solo si separa grupos de tres cifras.
export const numero = (v: string) => {
  const t = v.trim().replace(/\s/g, '');
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));
  return Number(t);
};

function condicion(f: Filtro, columnas: Columna[]): string | null {
  const c = columnas.find(x => x.nombre === f.columna);
  if (!c) return null;
  switch (f.operador) {
    case 'vacio': return c.tipo === 'texto' ? `(${c.nombre} IS NULL OR ${c.nombre} = '')` : `${c.nombre} IS NULL`;
    case 'conDato': return c.tipo === 'texto' ? `(${c.nombre} IS NOT NULL AND ${c.nombre} <> '')` : `${c.nombre} IS NOT NULL`;
    case 'contiene': return f.valor.trim() ? `strStripAccents(${c.nombre}) ILIKE ${comodin(f.valor.trim())}` : null;
    case 'es':
      if (c.tipo === 'numero') return Number.isFinite(numero(f.valor)) ? `${c.nombre} = ${numero(f.valor)}` : null;
      return f.valor.trim() ? `strToLowerCase(strStripAccents(${c.nombre})) = ${literal(sinTildes(f.valor.trim()).toLowerCase())}` : null;
    case 'mayor': case 'menor': {
      const op = f.operador === 'mayor' ? '>' : '<';
      if (c.tipo === 'numero') return Number.isFinite(numero(f.valor)) ? `${c.nombre} ${op} ${numero(f.valor)}` : null;
      return f.valor.trim() ? `${c.nombre} ${op} ${literal(f.valor.trim())}` : null;
    }
  }
}

export function filtroCql(criterios: Criterios, columnas: Columna[]): string | null {
  const partes: string[] = [];
  const texto = criterios.busqueda.trim();
  if (texto) {
    const textuales = columnas.filter(c => c.tipo === 'texto' && !AL_FINAL.includes(c.nombre));
    // Con «ñ» se busca tal cual (sin tildes, «peña» y «pena» serían lo mismo y «ñ» sola coincidía con todo).
    const conEnie = /ñ/i.test(texto);
    const enTexto = textuales.map(c => conEnie ? `${c.nombre} ILIKE ${literal(`%${texto.replaceAll('%', '').replaceAll('_', '')}%`)}` : `strStripAccents(${c.nombre}) ILIKE ${comodin(texto)}`);
    // Un número también se busca en las columnas numéricas (habitantes, n.º de ruta...).
    const n = numero(texto);
    const enNumeros = /^-?[\d.,]+$/.test(texto) && Number.isFinite(n) ? columnas.filter(c => c.tipo === 'numero').map(c => `${c.nombre} = ${n}`) : [];
    const todas = [...enTexto, ...enNumeros];
    if (todas.length) partes.push(`(${todas.join(' OR ')})`);
  }
  for (const f of criterios.filtros) {
    const c = condicion(f, columnas);
    if (c) partes.push(c);
  }
  if (criterios.extension) partes.push(`BBOX(geom,${criterios.extension.map(v => v.toFixed(1)).join(',')},'EPSG:3857')`);
  return partes.length ? partes.join(' AND ') : null;
}

function base(criterios: Criterios, columnas: Columna[]) {
  const cql = filtroCql(criterios, columnas);
  return `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:${criterios.capa}${cql ? `&CQL_FILTER=${encodeURIComponent(cql)}` : ''}`;
}

export async function pedirPagina(criterios: Criterios, columnas: Columna[], pagina: number, señal?: AbortSignal): Promise<Pagina> {
  const orden = criterios.orden ? `&sortBy=${criterios.orden.columna}+${criterios.orden.descendente ? 'D' : 'A'}` : '';
  const url = `${base(criterios, columnas)}&outputFormat=application/json&count=${POR_PAGINA}&startIndex=${pagina * POR_PAGINA}`
    + `&propertyName=${columnas.map(c => c.nombre).join(',') || 'geom'}${orden}`;
  const r = await fetch(url, { signal: señal });
  const texto = await r.text();
  if (!r.ok || texto.startsWith('<')) throw new Error('GeoServer no pudo responder la tabla.');
  const datos = JSON.parse(texto) as { features: { id: string; properties: Record<string, unknown> }[]; numberMatched?: number; totalFeatures?: number };
  return {
    filas: datos.features.map(f => ({ id: f.id, valores: f.properties })),
    total: Number(datos.numberMatched ?? datos.totalFeatures ?? datos.features.length),
  };
}

// Exporta todo lo que cumple los criterios (no solo la página), en WGS 84: CSV con la geometría en WKT
// (QGIS lo abre directo) o GeoJSON.
export async function exportar(criterios: Criterios, columnas: Columna[], formato: 'csv' | 'geojson', señal?: AbortSignal): Promise<Blob> {
  // El GeoJSON se pide en metros (EPSG:3857) y se pasa a WGS 84 acá, con 7 decimales (~1 cm): en grados,
  // GeoServer lo recortaba a 4 (~11 m).
  const url = `${base(criterios, columnas)}&outputFormat=${formato === 'csv' ? 'csv' : 'application/json'}&srsName=EPSG:${formato === 'csv' ? 4326 : 3857}&count=${TOPE_EXPORTAR}`
    + `&propertyName=geom,${columnas.map(c => c.nombre).join(',')}`;
  const r = await fetch(url, { signal: señal });
  if (!r.ok) throw new Error(String(r.status));
  const blob = await r.blob();
  // GeoServer avisa los errores con un XML, aun con 200.
  if (/xml/.test(r.headers.get('content-type') ?? '') || (await blob.slice(0, 64).text()).includes('ExceptionReport')) throw new Error('GeoServer no pudo exportar.');
  // El CSV con BOM: Excel lo abre con las tildes bien.
  if (formato === 'csv') return new Blob(['\ufeff', blob], { type: 'text/csv;charset=utf-8' });
  const formatoJson = new GeoJSON();
  const features = formatoJson.readFeatures(await blob.text(), { dataProjection: 'EPSG:3857' });
  const json = formatoJson.writeFeatures(features, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857', decimals: 7 });
  return new Blob([json], { type: 'application/geo+json' });
}

// La entidad entera, con su geometría, para mostrarla en el inspector y volar hasta ella.
export async function entidadCompleta(id: string, señal?: AbortSignal) {
  const capa = id.slice(0, id.lastIndexOf('.'));
  const r = await fetch(`${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:${capa}&featureID=${encodeURIComponent(id)}&outputFormat=application/json&srsName=EPSG:3857`, { signal: señal });
  const texto = await r.text();
  if (!r.ok || texto.startsWith('<')) throw new Error('GeoServer no encontró la entidad.');
  return JSON.parse(texto) as { features: { id: string; geometry: unknown; properties: Record<string, unknown> }[] };
}

// --- Obras de la RN11 (WFS-T) ---
const escaparXml = (v: string) => v.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
const transaccion = (cuerpo: string) => '<wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" '
  + `xmlns:ogc="http://www.opengis.net/ogc" xmlns:${WORKSPACE}="${NAMESPACE}">${cuerpo}</wfs:Transaction>`;

async function enviar(xml: string, esperado: RegExp) {
  const r = await fetch(URL_WFST, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml })
    .catch(() => { throw new Error('no hay conexión con GeoServer'); });
  const texto = await r.text();
  if (!r.ok || texto.includes('Exception') || !esperado.test(texto)) throw new Error(texto.match(/<ows:ExceptionText>([^<]*)/)?.[1] ?? 'GeoServer rechazó el cambio.');
}

export interface CambiosObra { tipo_obra: string; prioridad: string; estado: string; descripcion: string }

export function actualizarObra(id: string, cambios: CambiosObra) {
  const propiedades = Object.entries(cambios).map(([k, v]) => `<wfs:Property><wfs:Name>${k}</wfs:Name>${v.trim() ? `<wfs:Value>${escaparXml(v.trim())}</wfs:Value>` : ''}</wfs:Property>`).join('');
  return enviar(transaccion(`<wfs:Update typeName="${WORKSPACE}:${EDITABLE}">${propiedades}<ogc:Filter><ogc:FeatureId fid="${escaparXml(id)}"/></ogc:Filter></wfs:Update>`), /totalUpdated>1</);
}

export function borrarObra(id: string) {
  return enviar(transaccion(`<wfs:Delete typeName="${WORKSPACE}:${EDITABLE}"><ogc:Filter><ogc:FeatureId fid="${escaparXml(id)}"/></ogc:Filter></wfs:Delete>`), /totalDeleted>1</);
}

export const ESTADOS_OBRA = ['relevado', 'planificado', 'en_ejecucion', 'finalizado'];

// Valores de las obras, legibles.
export const ETIQUETAS_OBRA: Record<string, string> = {
  bacheo: 'Bacheo', repavimentacion: 'Repavimentación', banquina: 'Banquina', senalizacion: 'Señalización', puente: 'Puente', drenaje: 'Drenaje', otro: 'Otro',
  alta: 'Alta', media: 'Media', baja: 'Baja', relevado: 'Relevado', planificado: 'Planificado', en_ejecucion: 'En ejecución', finalizado: 'Finalizado',
};

