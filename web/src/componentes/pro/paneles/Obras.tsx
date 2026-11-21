import { useEffect, useState } from 'react';
import { buffer } from 'ol/extent';
import { MapPin, Plus, Table } from '@phosphor-icons/react';
import { URL_WFS, WORKSPACE, PRIORIDADES } from '../../../config';
import { ESTADOS_OBRA, ETIQUETAS_OBRA } from '../../../tabla';
import { armarResultado, mostrar, type Consulta } from '../../../herramientas';
import { cambiarCapas, volarA, type Visor } from '../../../visor';
import { Boton, PanelCajon, campo, miles } from './comun';

// Las obras de mantenimiento cargadas por WFS-T (edicion.obras_rn11): la lista, con filtros por estado y
// prioridad. Un clic vuela a la obra y la muestra en el panel de lo consultado (de ahí se edita o se borra).
interface Obra { id: string; properties: Record<string, unknown>; geometry: unknown }

const COLOR_PRIORIDAD: Record<string, string> = { alta: '#e5484d', media: '#f5a524', baja: '#46a758' };

export default function Obras({ visor, recarga, onConsulta, onTabla, onNueva }: {
  visor: Visor;
  recarga: number;
  onConsulta: (c: Consulta) => void;
  onTabla: () => void;
  onNueva: () => void;
}) {
  const [obras, setObras] = useState<Obra[] | null>(null);
  const [error, setError] = useState(false);
  const [estado, setEstado] = useState('');
  const [prioridad, setPrioridad] = useState('');

  useEffect(() => {
    let vigente = true;
    fetch(`${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:obras_rn11&outputFormat=application/json&srsName=EPSG:3857&count=2000`)
      .then(r => r.json()).then(d => { if (vigente) { setObras(d.features); setError(false); } })
      .catch(() => vigente && setError(true));
    return () => { vigente = false; };
  }, [recarga]);

  const lista = (obras ?? []).filter(o => (!estado || o.properties.estado === estado) && (!prioridad || o.properties.prioridad === prioridad));

  function ir(o: Obra) {
    if (!visor.visibles.has('obras_rn11')) cambiarCapas(visor, ['obras_rn11'], true);
    const resultado = armarResultado('obras_rn11', 1, { type: 'FeatureCollection', features: [o] } as never);
    onConsulta({ origen: 'rectangulo', titulo: 'Obra de mantenimiento · desde la lista', capas: mostrar(visor, [resultado]) });
    const entidad = resultado.entidades[0];
    visor.foco.clear();
    visor.foco.addFeature(entidad.feature);
    const extension = entidad.feature.getGeometry()?.getExtent();
    if (extension?.every(Number.isFinite)) volarA(visor, buffer(extension, 5000), { maxZoom: 12, duracion: 900, conPanel: true });
  }

  return (
    <PanelCajon
      titulo="Obras RN11"
      bajada="Obras de mantenimiento cargadas en edicion.obras_rn11 por WFS-T"
      pie={<div className="flex gap-2"><Boton className="flex-1" onClick={onNueva}><Plus size={18} weight="bold" /> Nueva obra</Boton><Boton className="flex-1" onClick={onTabla}><Table size={18} weight="bold" /> En la tabla</Boton></div>}
    >
      <div className="grid grid-cols-2 gap-3">
        <select aria-label="Filtrar por estado" value={estado} onChange={e => setEstado(e.target.value)} className={campo}>
          <option value="">Todo estado</option>
          {ESTADOS_OBRA.map(e => <option key={e} value={e}>{ETIQUETAS_OBRA[e]}</option>)}
        </select>
        <select aria-label="Filtrar por prioridad" value={prioridad} onChange={e => setPrioridad(e.target.value)} className={campo}>
          <option value="">Toda prioridad</option>
          {PRIORIDADES.map(p => <option key={p} value={p}>{ETIQUETAS_OBRA[p]}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="mt-4 text-[15px] text-[var(--vial-texto)]">No se pudieron traer las obras de GeoServer.</p>}
      {!obras && !error && <p className="mt-4 text-[16px] text-[var(--tinta-3)]">Cargando las obras…</p>}
      {obras && (
        <>
          <p className="mb-2 mt-4 text-[15px] text-[var(--tinta-3)]">{miles(lista.length)} de {miles(obras.length)} obras</p>
          {lista.length === 0 && <p className="text-[16px] text-[var(--tinta-2)]">{obras.length ? 'Ninguna obra con esos filtros.' : 'Todavía no hay obras cargadas. Usá "Nueva obra" y tocá el mapa.'}</p>}
          <ul className="flex flex-col gap-1.5">
            {lista.map(o => {
              const p = o.properties;
              return (
                <li key={o.id}>
                  <button type="button" onClick={() => ir(o)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[var(--superficie-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
                    <MapPin size={22} weight="fill" className="mt-0.5 shrink-0" style={{ color: COLOR_PRIORIDAD[String(p.prioridad)] ?? 'var(--tinta-3)' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16.5px] font-semibold">{ETIQUETAS_OBRA[String(p.tipo_obra)] ?? String(p.tipo_obra ?? 'Obra')}</span>
                      <span className="block text-[14.5px] text-[var(--tinta-2)]">
                        Prioridad {(ETIQUETAS_OBRA[String(p.prioridad)] ?? 'sin asignar').toLowerCase()} · {ETIQUETAS_OBRA[String(p.estado)] ?? String(p.estado ?? 'sin estado')}
                      </span>
                      {p.descripcion ? <span className="mt-0.5 block truncate text-[14.5px] text-[var(--tinta-3)]">{String(p.descripcion)}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </PanelCajon>
  );
}
