import { useEffect, useState } from 'react';
import { CaretDown, Table } from '@phosphor-icons/react';
import { GRUPOS, URL_WFS, WORKSPACE, type Capa } from '../../../config';
import { columnasDe, type Columna } from '../../../tabla';
import { Boton, PanelCajon, miles } from './comun';

// Catálogo de la base: las 48 tablas de PostGIS publicadas en GeoServer, con su esquema, tipo de geometría,
// cantidad de registros (WFS resultType=hits) y columnas (DescribeFeatureType). Las 47 del IGN están en el
// esquema ign; la de obras, en edicion. Todas en SRID 4326.
const GEOMETRIA: Record<Capa['geometria'], string> = { punto: 'Punto', linea: 'Línea', poligono: 'Polígono' };
const TIPO: Record<Columna['tipo'], string> = { texto: 'texto', numero: 'número', fecha: 'fecha' };

const cuentas = new Map<string, Promise<number>>();
function contar(capa: string) {
  if (!cuentas.has(capa)) cuentas.set(capa, fetch(`${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:${capa}&resultType=hits`)
    .then(r => r.text()).then(t => Number(/numberMatched="(\d+)"/.exec(t)?.[1] ?? NaN)));
  return cuentas.get(capa)!;
}

export default function Catalogo({ onTabla }: { onTabla: (capa: string) => void }) {
  const [registros, setRegistros] = useState<Record<string, number>>({});
  const [abierta, setAbierta] = useState<string | null>(null);
  const [columnas, setColumnas] = useState<Columna[] | null>(null);
  const capas = GRUPOS.flatMap(g => g.capas);

  useEffect(() => {
    let vigente = true;
    // De a 6 pedidos a la vez, para no trabar a GeoServer.
    const pendientes = [...capas];
    const trabajar = async () => {
      for (let c = pendientes.shift(); c && vigente; c = pendientes.shift()) {
        const n = await contar(c.nombre).catch(() => NaN);
        if (vigente) setRegistros(r => ({ ...r, [c.nombre]: n }));
      }
    };
    for (let i = 0; i < 6; i++) trabajar();
    return () => { vigente = false; };
  }, []);

  useEffect(() => {
    if (!abierta) return;
    let vigente = true;
    setColumnas(null);
    columnasDe(abierta).then(c => vigente && setColumnas(c)).catch(() => vigente && setColumnas([]));
    return () => { vigente = false; };
  }, [abierta]);

  const total = Object.values(registros).filter(Number.isFinite).reduce((s, n) => s + n, 0);
  const contadas = Object.keys(registros).length;

  return (
    <PanelCajon titulo="Base de datos" bajada="PostGIS · base tpi · esquemas ign y edicion · SRID 4326 · publicada en GeoServer (workspace tpi)"
      pie={contadas < capas.length ? `Contando registros… ${contadas} de ${capas.length} tablas` : `${capas.length} tablas · ${miles(total)} registros en total`}>
      {GRUPOS.map(g => (
        <section key={g.id} className="mb-4">
          <h3 className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--tinta-3)]">{g.titulo}</h3>
          <ul className="flex flex-col">
            {g.capas.map(c => {
              const abiertaEsta = abierta === c.nombre;
              const n = registros[c.nombre];
              return (
                <li key={c.nombre} className={`rounded-xl ${abiertaEsta ? 'bg-[var(--superficie-2)]' : ''}`}>
                  <button type="button" aria-expanded={abiertaEsta} onClick={() => setAbierta(abiertaEsta ? null : c.nombre)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--superficie-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">{c.titulo}</span>
                      <span className="block truncate font-mono text-[14px] text-[var(--tinta-3)]">{c.nombre === 'obras_rn11' ? 'edicion' : 'ign'}.{c.nombre}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[15.5px] font-semibold tabular-nums">{n === undefined ? '…' : Number.isFinite(n) ? miles(n) : '—'}</span>
                      <span className="block text-[13.5px] text-[var(--tinta-3)]">{GEOMETRIA[c.geometria]}</span>
                    </span>
                    <CaretDown size={16} weight="bold" className={`shrink-0 text-[var(--tinta-3)] transition-transform ${abiertaEsta ? 'rotate-180' : ''}`} />
                  </button>
                  {abiertaEsta && (
                    <div className="px-3 pb-3">
                      {!columnas && <p className="text-[15px] text-[var(--tinta-3)]">Leyendo columnas…</p>}
                      {columnas && (
                        <table className="w-full text-[14.5px]">
                          <caption className="sr-only">Columnas de {c.nombre}</caption>
                          <thead><tr className="text-left text-[13px] text-[var(--tinta-3)]"><th className="py-1 font-semibold">Columna</th><th className="py-1 font-semibold">Tipo</th></tr></thead>
                          <tbody>
                            <tr className="border-t border-[var(--linea)]"><td className="py-1 font-mono">geom</td><td className="py-1">geometría ({GEOMETRIA[c.geometria].toLowerCase()}, 4326)</td></tr>
                            {columnas.map(col => (
                              <tr key={col.nombre} className="border-t border-[var(--linea)]"><td className="py-1 font-mono">{col.nombre}</td><td className="py-1">{TIPO[col.tipo]}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <Boton className="mt-3 w-full" onClick={() => onTabla(c.nombre)}><Table size={18} weight="bold" /> Ver los registros</Boton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </PanelCajon>
  );
}
