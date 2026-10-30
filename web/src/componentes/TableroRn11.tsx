import { useState } from 'react';
import { Spinner } from '@heroui/react';
import { Bridge, CaretDown, X } from '@phosphor-icons/react';
import { buffer } from 'ol/extent';
import type { AnalisisRn11, LocalidadCercana } from '../analisisRn11';
import { volarA, type Visor } from '../visor';
import EscudoRuta from './EscudoRuta';
import { Dona, NumeroAnimado } from './ui/graficos';

interface Props {
  visor: Visor;
  analisis?: AnalisisRn11;
  error?: string;
  onCerrar: () => void;
}

const km = (metros: number) => (metros / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

// Las respuestas de la parte B, calculadas en vivo y explicadas para entenderlas de un vistazo.
export default function TableroRn11({ visor, analisis, error, onCerrar }: Props) {
  const [verPuentes, setVerPuentes] = useState(false);
  const enfocar = (f?: import('ol/Feature').default) => {
    visor.foco.clear();
    if (f) visor.foco.addFeature(f);
  };

  return (
    <section className="entra panel flex max-h-full min-h-0 flex-col overflow-hidden" aria-live="polite">
      <header className="flex items-start gap-3 border-b border-[var(--linea)] py-4 pl-5 pr-3">
        <EscudoRuta className="mt-0.5 h-9 w-auto shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold leading-tight tracking-[-0.02em]">Ruta Nacional 11 en Chaco</h2>
          <p className="mt-0.5 text-[14px] text-[var(--tinta-3)]">Calculado en vivo sobre las capas del IGN</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar tablero" className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]">
          <X size={19} />
        </button>
      </header>

      <div className="desplazable min-h-0 flex-1 overflow-y-auto">
        {!analisis && !error && (
          <div className="flex items-center gap-3 px-5 py-7 text-[15px] text-[var(--tinta-2)]">
            <Spinner size="sm" /> Midiendo la traza y buscando localidades y puentes…
          </div>
        )}
        {error && <p className="px-5 py-6 text-[15px] text-[var(--danger)]">{error}</p>}
        {analisis && (
          <>
            <section className="border-b border-[var(--linea)] px-5 pb-5 pt-4">
              <div className="text-[13px] font-semibold text-[var(--tinta-3)]">Longitud de la traza</div>
              <div className="mt-1 flex items-baseline gap-2">
                <NumeroAnimado valor={analisis.km} decimales={1} className="text-[44px] font-semibold leading-none tracking-[-0.03em]" />
                <span className="text-[18px] font-medium text-[var(--tinta-2)]">km</span>
              </div>
              <p className="mt-2 text-[13px] text-[var(--tinta-3)]">{analisis.tramos} tramos de la red vial, recortados al límite provincial.</p>
            </section>

            <section className="border-b border-[var(--linea)] px-5 pb-5 pt-4">
              <div className="mb-4 text-[13px] font-semibold text-[var(--tinta-3)]">Población afectada</div>
              <Dona
                centro={<NumeroAnimado valor={analisis.franja1.habitantes + analisis.franja2.habitantes} />}
                detalle="habitantes"
                segmentos={[
                  { id: '1', etiqueta: 'Hasta 10 km', valor: analisis.franja1.habitantes, color: 'var(--dato-1)' },
                  { id: '2', etiqueta: 'De 10 a 20 km', valor: analisis.franja2.habitantes, color: 'var(--dato-2)' },
                ]}
              />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Franja color="var(--dato-1)" titulo="Hasta 10 km" datos={analisis.franja1} />
                <Franja color="var(--dato-2)" titulo="De 10 a 20 km" datos={analisis.franja2} />
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--tinta-3)]">
                Franjas excluyentes, con distancia geodésica a la traza. Las localidades sin dato de habitantes en el IGN se cuentan pero no suman población.
              </p>
            </section>

            <section className="border-b border-[var(--linea)] px-5 pb-4 pt-4">
              <button type="button" onClick={() => setVerPuentes(!verPuentes)} aria-expanded={verPuentes} className="flex w-full items-center gap-3 text-left">
                <span className="grid size-10 place-items-center rounded-[11px] bg-[var(--superficie-2)] text-[var(--tinta-2)]"><Bridge size={20} /></span>
                <span className="flex-1">
                  <span className="block text-[13px] font-semibold text-[var(--tinta-3)]">Puentes sobre la traza</span>
                  <span className="text-[15px]"><NumeroAnimado valor={analisis.puentes.length} className="text-[22px] font-semibold" /> a menos de 100 m</span>
                </span>
                <CaretDown size={14} weight="bold" className={`text-[var(--tinta-3)] transition-transform duration-300 ${verPuentes ? 'rotate-180' : ''}`} />
              </button>
              {verPuentes && (
                <ul className="mt-3 divide-y divide-[var(--linea)]">
                  {analisis.puentes.map(p => (
                    <li key={p.id} onMouseEnter={() => enfocar(p.feature)} onMouseLeave={() => enfocar()} className="-mx-2 flex items-baseline justify-between gap-3 rounded-lg px-2 py-2 text-[14px] hover:bg-[var(--superficie-2)]">
                      <span className="min-w-0"><span className="block truncate font-medium">{p.nombre}</span><span className="text-[13px] text-[var(--tinta-3)]">{p.tipo}</span></span>
                      <span className="shrink-0 text-[13px] text-[var(--tinta-3)]">{Math.round(p.distancia)} m</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pb-3 pt-4">
              <div className="flex items-baseline justify-between px-5 pb-2">
                <h3 className="text-[13px] font-semibold text-[var(--tinta-3)]">Localidades, de la más cercana a la más lejana</h3>
                <span className="text-[13px] text-[var(--tinta-3)]">{analisis.localidades.length}</span>
              </div>
              <ul className="divide-y divide-[var(--linea)]">
                {analisis.localidades.map(l => <FilaLocalidad key={l.id} localidad={l} onEnfocar={enfocar} onAcercar={() => volarA(visor, buffer(l.feature.getGeometry()!.getExtent(), 4000), { maxZoom: 12 })} />)}
              </ul>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

function Franja({ color, titulo, datos }: { color: string; titulo: string; datos: AnalisisRn11['franja1'] }) {
  return (
    <div className="rounded-xl bg-[var(--superficie-2)] px-3.5 py-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--tinta-3)]">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />{titulo}
      </div>
      <div className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em]"><NumeroAnimado valor={datos.localidades} /> <span className="text-[14px] font-medium text-[var(--tinta-2)]">localidades</span></div>
      <div className="text-[13px] text-[var(--tinta-3)]">{datos.sinDato} sin dato de habitantes</div>
    </div>
  );
}

function FilaLocalidad({ localidad, onEnfocar, onAcercar }: { localidad: LocalidadCercana; onEnfocar: (f?: import('ol/Feature').default) => void; onAcercar: () => void }) {
  return (
    <li
      onMouseEnter={() => onEnfocar(localidad.feature)}
      onMouseLeave={() => onEnfocar()}
      onClick={onAcercar}
      className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-[var(--superficie-2)]"
    >
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: localidad.franja === 1 ? 'var(--dato-1)' : 'var(--dato-2)' }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{localidad.nombre}</span>
        <span className="text-[13px] text-[var(--tinta-3)]">{localidad.departamento}{localidad.habitantes ? ` · ${localidad.habitantes.toLocaleString('es-AR')} hab.` : ' · sin dato'}</span>
      </span>
      <span className="shrink-0 text-[14px] font-semibold">{km(localidad.distancia)} km</span>
    </li>
  );
}
