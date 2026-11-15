// Mapas de calor (T3): los datos. Una capa de puntos se puede ver como "manchas": dónde se juntan las
// cosas. Las localidades, pesadas por sus habitantes (canthab: 3.356 de las 10.804 tienen el dato),
// muestran dónde vive la gente; el resto de las capas de puntos, cuántas cosas hay.
//
// Cómo se cargan: cuando el mapa se queda quieto, se piden por WFS los puntos de lo que se ve (con un
// margen) y reemplazan a los anteriores. Nunca se dibuja una mancha parcial: si en lo visible hay más
// puntos que el tope, la mancha se vacía y se avisa que hay que acercarse. Si un pedido falla, no se
// reintenta solo (se avisa y se reintenta a pedido).
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { buffer, containsExtent, getWidth } from 'ol/extent';
import type { FeatureLike } from 'ol/Feature';
import { URL_WFS, WORKSPACE } from './config';

// La capa que se pesa por población; las demás son densidad.
export const CAPA_POBLACION = 'localidades';
export const esPoblacion = (nombre: string) => nombre === CAPA_POBLACION;

// Tope de puntos en lo visible. Las 10.804 localidades del país entran siempre; "Otras edificaciones"
// (96.056) pide acercarse a escala país.
export const TOPE = 60_000;

// Peso de una localidad: (habitantes / 300.000) ^ 0,35, saturando en 300.000. Resistencia (274.490) pesa
// 0,97; una ciudad de 50.000, 0,53; un pueblo de 2.000, 0,17.
export const pesoPoblacion = (f: FeatureLike) => Math.min(1, ((Number(f.get('canthab')) || 0) / 300_000) ** 0.35);
// Densidad: con muchos puntos a la vista cada uno pesa poco (si no, todo satura); con pocos, más (si no,
// un hospital solo no se ve). Depende de lo que se ve en cada momento, no de lo que se cargó: la capa lo
// recalcula al quedarse quieto el mapa (capaCalor.ts).
// 150 o menos: 0,7; 1.000: 0,17; 5.000: 0,05; 36.000 (las casas de la provincia): 0,012.
export const pesoDensidad = (aLaVista: number) => Math.min(0.7, Math.max(0.008, 0.7 * (150 / Math.max(1, aLaVista)) ** 0.75));

export type Fase = 'vacio' | 'cargando' | 'lista' | 'demasiados' | 'error';
export interface EstadoCalor { fase: Fase; cantidad: number; total: number }

export interface ControlCalor {
  nombre: string;
  fuente: VectorSource;
  estado: () => EstadoCalor;
  // Asegura los puntos de `extension`. Si ya están (la extensión cargada la cubre), no pide nada.
  cargar: (extension: number[], forzar?: boolean) => Promise<EstadoCalor>;
}

// Un control por capa y por uso: el del mapa y el de la hoja impresa son independientes (la hoja pide
// su propio encuadre y no le cambia los datos al mapa).
const controles = new Map<string, ControlCalor>();
export function calorDe(nombre: string, uso: 'mapa' | 'impresion' = 'mapa'): ControlCalor {
  const clave = `${nombre}|${uso}`;
  const existente = controles.get(clave);
  if (existente) return existente;

  const fuente = new VectorSource();
  const formato = new GeoJSON();
  let estado: EstadoCalor = { fase: 'vacio', cantidad: 0, total: 0 };
  let cargada: number[] | null = null;
  let enCurso: { extension: number[]; promesa: Promise<EstadoCalor>; control: AbortController } | null = null;
  const poner = (nuevo: EstadoCalor) => { estado = nuevo; fuente.set('estado', nuevo); };

  const cargar = (extension: number[], forzar = false): Promise<EstadoCalor> => {
    if (!forzar && estado.fase === 'lista' && cargada && containsExtent(cargada, extension)) return Promise.resolve(estado);
    if (!forzar && enCurso && containsExtent(enCurso.extension, extension)) return enCurso.promesa;
    enCurso?.control.abort();
    // Con un margen de un cuarto del ancho: los paneos chicos no vuelven a pedir.
    const pedida = buffer(extension, getWidth(extension) * 0.25);
    const control = new AbortController();
    const filtro = `BBOX(geom,${pedida.join(',')},'EPSG:3857')${esPoblacion(nombre) ? ' AND canthab > 0' : ''}`;
    const base = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:${nombre}`
      + `&CQL_FILTER=${encodeURIComponent(filtro)}`;
    const señal = AbortSignal.any([control.signal, AbortSignal.timeout(20_000)]);
    poner({ ...estado, fase: 'cargando' });
    // Primero cuántos hay (un número, no 1,4 MB de puntos para tirar): si pasan el tope, no se bajan.
    // Las localidades no hace falta contarlas: entran siempre.
    const contar = esPoblacion(nombre)
      ? Promise.resolve(0)
      : fetch(`${base}&resultType=hits`, { signal: señal })
        .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
        .then(xml => Number(/numberMatched="(\d+)"/.exec(xml)?.[1] ?? NaN));
    const promesa = contar
      .then(async total => {
        if (Number.isNaN(total)) throw new Error('sin conteo');
        if (total > TOPE) return { total, datos: null };
        const r = await fetch(`${base}&outputFormat=application/json&srsName=EPSG:3857&count=${TOPE}`
          + `&propertyName=${esPoblacion(nombre) ? 'geom,nombre,canthab' : 'geom'}`, { signal: señal });
        if (!r.ok) throw new Error(String(r.status));
        return { total, datos: await r.json() as { features: unknown[] } };
      })
      .then(({ total, datos }) => {
        fuente.clear(true);
        if (!datos) {
          // Una mancha con una parte de los puntos mentiría (regiones enteras vacías): se vacía.
          cargada = null;
          poner({ fase: 'demasiados', cantidad: 0, total });
        } else {
          const features = formato.readFeatures(datos, { dataProjection: 'EPSG:3857' });
          for (const f of features) f.set('peso', esPoblacion(nombre) ? pesoPoblacion(f) : 1);
          fuente.addFeatures(features);
          cargada = pedida;
          poner({ fase: 'lista', cantidad: features.length, total: features.length });
        }
        return estado;
      })
      .catch(e => {
        if (control.signal.aborted && (e as Error).name === 'AbortError') return estado; // lo reemplazó otro pedido
        cargada = null;
        poner({ ...estado, fase: 'error' });
        return estado;
      })
      .finally(() => { if (enCurso?.control === control) enCurso = null; });
    enCurso = { extension: pedida, promesa, control };
    return promesa;
  };

  const ctl: ControlCalor = { nombre, fuente, estado: () => estado, cargar };
  controles.set(clave, ctl);
  return ctl;
}
