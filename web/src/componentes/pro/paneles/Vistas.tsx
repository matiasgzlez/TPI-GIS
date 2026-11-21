import { useState } from 'react';
import { Check, LinkSimple, Trash } from '@phosphor-icons/react';
import { aplicarVista, enlaceDe, escribirGuardadas, leerGuardadas, vistaActual, type Vista } from '../../../vistas';
import type { Visor } from '../../../visor';
import { Boton, Campo, PanelCajon, Seccion, campo } from './comun';

// Vistas guardadas (encuadre + capas, con nombre, en este navegador) y el enlace para compartir la vista actual.
export default function Vistas({ visor }: { visor: Visor }) {
  const [vistas, setVistas] = useState<Vista[]>(leerGuardadas);
  const [nombre, setNombre] = useState('');
  const [copiado, setCopiado] = useState<string | null>(null);

  const guardar = (lista: Vista[]) => { setVistas(lista); escribirGuardadas(lista); };
  const copiar = (vista: Vista, clave: string) => navigator.clipboard.writeText(enlaceDe(vista)).then(() => { setCopiado(clave); setTimeout(() => setCopiado(null), 1600); });

  return (
    <PanelCajon titulo="Vistas guardadas" bajada="Encuadre y capas prendidas, para volver o compartir con el equipo">
      <Seccion titulo="Compartir la vista actual">
        <Boton className="w-full" onClick={() => copiar(vistaActual(visor), 'actual')}>
          {copiado === 'actual' ? <><Check size={18} weight="bold" /> Enlace copiado</> : <><LinkSimple size={18} weight="bold" /> Copiar enlace</>}
        </Boton>
        <p className="mt-2 text-[14px] text-[var(--tinta-3)]">El enlace abre el visor en este encuadre y con estas capas.</p>
      </Seccion>

      <Seccion titulo="Guardar la vista actual">
        <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); if (nombre.trim()) { guardar([vistaActual(visor, nombre.trim()), ...vistas]); setNombre(''); } }}>
          <div className="flex-1"><Campo rotulo="Nombre"><input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej.: Puente General Belgrano" className={campo} /></Campo></div>
          <Boton principal type="submit" disabled={!nombre.trim()}>Guardar</Boton>
        </form>
      </Seccion>

      <Seccion titulo={`Guardadas · ${vistas.length}`}>
        {vistas.length === 0 && <p className="text-[16px] text-[var(--tinta-2)]">Todavía no guardaste ninguna vista.</p>}
        <ul className="flex flex-col gap-1.5">
          {vistas.map((v, i) => (
            <li key={v.fecha + v.nombre} className="flex items-center gap-1 rounded-xl transition-colors hover:bg-[var(--superficie-2)]">
              <button type="button" onClick={() => aplicarVista(visor, v)} className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
                <span className="block truncate text-[16.5px] font-semibold">{v.nombre}</span>
                <span className="block text-[14px] text-[var(--tinta-3)]">Zoom {v.zoom.toLocaleString('es-AR')} · {v.capas.length} capas · {new Date(v.fecha).toLocaleDateString('es-AR')}</span>
              </button>
              <button type="button" aria-label={`Copiar enlace de ${v.nombre}`} title="Copiar enlace" onClick={() => copiar(v, v.fecha)}
                className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--tinta-2)] hover:bg-[var(--superficie-3)] hover:text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
                {copiado === v.fecha ? <Check size={18} weight="bold" className="text-[var(--acento-tinta)]" /> : <LinkSimple size={18} weight="bold" />}
              </button>
              <button type="button" aria-label={`Borrar ${v.nombre}`} title="Borrar" onClick={() => guardar(vistas.filter((_, j) => j !== i))}
                className="mr-1 grid size-10 shrink-0 place-items-center rounded-full text-[var(--tinta-2)] hover:bg-[var(--superficie-3)] hover:text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
                <Trash size={18} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      </Seccion>
    </PanelCajon>
  );
}
