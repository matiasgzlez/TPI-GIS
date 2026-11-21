import { useEffect, useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { URL_WFS, WORKSPACE, tituloDeCapa } from '../../../config';
import { columnasDe, type Columna } from '../../../tabla';
import { rotulo } from '../../../entidades';
import { capasVisibles, type Visor } from '../../../visor';
import { Boton, Campo, OpcionesCapas, PanelCajon, Seccion, campo, descargar, miles } from './comun';

// Estadísticas de una capa: resumen de un campo numérico (suma, promedio, mínimo, máximo, mediana) y, si se
// elige, agrupado por un campo de texto. Los datos vienen por WFS (solo las columnas pedidas) y se calculan acá.
const TOPE = 50_000;

interface Resumen { n: number; suma: number; promedio: number; minimo: number; maximo: number; mediana: number }
interface Resultado { total: number; truncado: boolean; resumen: Resumen | null; grupos: { clave: string; n: number; suma: number }[] }

function resumir(valores: number[]): Resumen | null {
  if (!valores.length) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const suma = orden.reduce((s, v) => s + v, 0);
  const medio = Math.floor(orden.length / 2);
  return { n: orden.length, suma, promedio: suma / orden.length, minimo: orden[0], maximo: orden.at(-1)!, mediana: orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2 };
}

export default function Estadisticas({ visor }: { visor: Visor }) {
  const [capa, setCapa] = useState(() => capasVisibles(visor).includes('localidades') ? 'localidades' : capasVisibles(visor).at(-1) ?? 'localidades');
  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [campoNum, setCampoNum] = useState('');
  const [agrupar, setAgrupar] = useState('');
  const [soloVista, setSoloVista] = useState(false);
  const [estado, setEstado] = useState<'listo' | 'cargando' | string>('listo');
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    let vigente = true;
    setColumnas([]); setResultado(null);
    columnasDe(capa).then(c => {
      if (!vigente) return;
      setColumnas(c);
      setCampoNum(c.find(x => x.nombre === 'canthab')?.nombre ?? c.find(x => x.tipo === 'numero')?.nombre ?? '');
      setAgrupar(c.find(x => x.nombre === 'provincia')?.nombre ?? '');
    }).catch(() => vigente && setEstado('No se pudo leer el esquema de la capa.'));
    return () => { vigente = false; };
  }, [capa]);

  const numericas = columnas.filter(c => c.tipo === 'numero');
  const textos = columnas.filter(c => c.tipo === 'texto');

  async function calcular() {
    setEstado('cargando');
    try {
      const props = [campoNum, agrupar].filter(Boolean);
      let url = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:${capa}&outputFormat=application/json&count=${TOPE}`;
      // Sin columnas pedidas, alcanza con una cualquiera (solo se cuenta).
      url += `&propertyName=${props.length ? props.join(',') : columnas[0]?.nombre ?? ''}`;
      if (soloVista) url += `&bbox=${visor.mapa.getView().calculateExtent(visor.mapa.getSize()).join(',')},EPSG:3857`;
      const datos = await (await fetch(url)).json() as { features: { properties: Record<string, unknown> }[]; numberMatched?: number };
      const filas = datos.features.map(f => f.properties);
      const valores = campoNum ? filas.map(p => Number(p[campoNum])).filter(Number.isFinite) : [];
      const porGrupo = new Map<string, { n: number; suma: number }>();
      if (agrupar) for (const p of filas) {
        const clave = String(p[agrupar] ?? '').trim() || '(sin dato)';
        const g = porGrupo.get(clave) ?? { n: 0, suma: 0 };
        g.n++; const v = Number(p[campoNum]); if (campoNum && Number.isFinite(v)) g.suma += v;
        porGrupo.set(clave, g);
      }
      const total = typeof datos.numberMatched === 'number' ? datos.numberMatched : filas.length;
      setResultado({
        total, truncado: filas.length < total, resumen: resumir(valores),
        grupos: [...porGrupo].map(([clave, g]) => ({ clave, ...g })).sort((a, b) => (campoNum ? b.suma - a.suma : b.n - a.n)),
      });
      setEstado('listo');
    } catch {
      setEstado('No se pudieron traer los datos de GeoServer.');
    }
  }

  function exportarCsv() {
    if (!resultado) return;
    const cab = [rotulo(agrupar), 'Entidades', ...(campoNum ? [`Suma de ${rotulo(campoNum)}`] : [])];
    const lineas = resultado.grupos.map(g => [`"${g.clave.replaceAll('"', '""')}"`, g.n, ...(campoNum ? [g.suma] : [])].join(','));
    descargar(new Blob([[cab.join(','), ...lineas].join('\n')], { type: 'text/csv' }), `estadisticas-${capa}-por-${agrupar}.csv`);
  }

  const maximo = resultado?.grupos.reduce((m, g) => Math.max(m, campoNum ? g.suma : g.n), 0) || 1;

  return (
    <PanelCajon titulo="Estadísticas" bajada="Resumen de un campo numérico y agrupado por un campo de texto · WFS GetFeature con las columnas pedidas">
      <div className="flex flex-col gap-4">
        <Campo rotulo="Capa">
          <select value={capa} onChange={e => setCapa(e.target.value)} className={campo}><OpcionesCapas /></select>
        </Campo>
        <Campo rotulo="Campo numérico">
          <select value={campoNum} onChange={e => setCampoNum(e.target.value)} className={campo} disabled={!columnas.length}>
            <option value="">Solo contar entidades</option>
            {numericas.map(c => <option key={c.nombre} value={c.nombre}>{rotulo(c.nombre)}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Agrupar por">
          <select value={agrupar} onChange={e => setAgrupar(e.target.value)} className={campo} disabled={!columnas.length}>
            <option value="">Sin agrupar</option>
            {textos.map(c => <option key={c.nombre} value={c.nombre}>{rotulo(c.nombre)}</option>)}
          </select>
        </Campo>
        <label className="flex items-center gap-3 text-[16px]">
          <input type="checkbox" checked={soloVista} onChange={e => setSoloVista(e.target.checked)} className="size-5 accent-[var(--vial)]" />
          Solo lo que se ve en el mapa
        </label>
        <Boton principal onClick={calcular} disabled={!columnas.length || estado === 'cargando'}>{estado === 'cargando' ? 'Calculando…' : 'Calcular'}</Boton>
        {estado !== 'listo' && estado !== 'cargando' && <p role="alert" className="text-[15px] text-[var(--vial-texto)]">{estado}</p>}
      </div>

      {resultado && (
        <div aria-live="polite" className="mt-6">
          <Seccion titulo={`${tituloDeCapa(capa)}${soloVista ? ' · en la vista' : ''}${campoNum && resultado.resumen ? ` · ${rotulo(campoNum)}` : ''}`}>
            <p className="text-[16px] text-[var(--tinta-2)]">
              <strong className="text-[24px] font-semibold text-[var(--tinta)]">{miles(resultado.total)}</strong> entidades
              {resultado.truncado && <span className="block text-[14px] text-[var(--tinta-3)]">Se calcularon las primeras {miles(TOPE)}.</span>}
            </p>
            {resultado.resumen && (
              <dl className="mt-3 grid grid-cols-2 gap-2">
                {([['Suma', resultado.resumen.suma], ['Promedio', resultado.resumen.promedio], ['Mediana', resultado.resumen.mediana], ['Mínimo', resultado.resumen.minimo], ['Máximo', resultado.resumen.maximo], ['Con dato', resultado.resumen.n]] as const).map(([r, v]) => (
                  <div key={r} className="rounded-xl bg-[var(--superficie-2)] px-3 py-2.5">
                    <dt className="text-[14px] text-[var(--tinta-3)]">{r}</dt>
                    <dd className="text-[19px] font-semibold tabular-nums">{miles(v, 1)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Seccion>
          {agrupar && resultado.grupos.length > 0 && (
            <Seccion titulo={`Por ${rotulo(agrupar).toLowerCase()} · ${resultado.grupos.length} grupos`}>
              <ol className="flex flex-col gap-1.5">
                {resultado.grupos.slice(0, 15).map(g => {
                  const valor = campoNum ? g.suma : g.n;
                  return (
                    <li key={g.clave} className="relative overflow-hidden rounded-lg px-3 py-2">
                      <span aria-hidden="true" className="absolute inset-y-0 left-0 rounded-lg bg-[var(--acento-suave)]" style={{ width: `${(valor / maximo) * 100}%` }} />
                      <span className="relative flex items-baseline justify-between gap-3 text-[15.5px]">
                        <span className="truncate">{g.clave}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{miles(valor)}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              {resultado.grupos.length > 15 && <p className="mt-2 text-[14px] text-[var(--tinta-3)]">Y {resultado.grupos.length - 15} grupos más en el CSV.</p>}
              <Boton className="mt-3 w-full" onClick={exportarCsv}><DownloadSimple size={18} weight="bold" /> Descargar CSV</Boton>
            </Seccion>
          )}
        </div>
      )}
    </PanelCajon>
  );
}
