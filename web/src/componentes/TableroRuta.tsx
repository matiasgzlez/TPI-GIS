import { useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import { Bridge, CaretDown, X } from '@phosphor-icons/react';
import { buffer } from 'ol/extent';
import type { AnalisisRuta, LocalidadCercana, Ruta } from '../analisisRuta';
import { volarA, type Visor } from '../visor';
import EscudoRuta from './EscudoRuta';
import { tituloProvincia } from '../provincias';
import { useInterfaz } from '../interfaz';
import { BarraApilada, NumeroAnimado } from './ui/graficos';

interface Props {
  visor: Visor;
  ruta: Ruta;
  analisis?: AnalisisRuta;
  error?: string;
  onCerrar: () => void;
}

const km = (metros: number) => (metros / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

// Las respuestas de la parte B para la ruta elegida, calculadas en vivo y explicadas para entenderlas
// de un vistazo. La RN11 en Chaco es la del trabajo; cualquier otra ruta nacional sale igual.
export default function TableroRuta({ visor, ruta, analisis, error, onCerrar }: Props) {
  // En el modo simple, lo mismo con palabras de todos los días.
  const simple = useInterfaz() === 'simple';
  const [verPuentes, setVerPuentes] = useState(false);
  // La localidad tocada en la lista queda elegida: marcada en el mapa (con nombre y habitantes) y en
  // la lista, hasta tocar otra. Pasar el mouse por otra fila la muestra solo mientras dura.
  const [elegida, setElegida] = useState<LocalidadCercana | null>(null);
  const enfocar = (f?: import('ol/Feature').default) => {
    visor.foco.clear();
    const destino = f ?? elegida?.feature;
    if (destino) visor.foco.addFeature(destino);
  };
  const elegir = (l: LocalidadCercana) => {
    elegida?.feature.unset('elegida');
    l.feature.set('elegida', true);
    setElegida(l);
    visor.foco.clear();
    visor.foco.addFeature(l.feature);
    // A escala de departamento (no de calle): se siguen viendo la traza, las franjas y los vecinos.
    volarA(visor, buffer(l.feature.getGeometry()!.getExtent(), 9000), { maxZoom: 11, conPanel: true });
  };
  // Si otra parte del visor pone el foco en algo que no es de este tablero (un lugar del buscador, una
  // consulta), la elegida deja de estarlo: antes la fila quedaba marcada y el lugar nuevo sin nombre.
  useEffect(() => {
    if (!elegida || !analisis) return;
    const propias = new Set(analisis.localidades.map(l => l.feature));
    const alAgregar = (e: { feature?: import('ol/Feature').default }) => {
      if (e.feature && !propias.has(e.feature)) {
        elegida.feature.unset('elegida');
        setElegida(null);
      }
    };
    visor.foco.on('addfeature', alAgregar);
    return () => visor.foco.un('addfeature', alAgregar);
  }, [elegida, analisis, visor]);

  // Al cambiar de análisis o cerrar el tablero, la elegida deja de estarlo.
  useEffect(() => {
    setElegida(null);
    return () => {
      analisis?.localidades.forEach(l => l.feature.unset('elegida'));
      visor.foco.clear();
    };
  }, [analisis, visor]);

  // Al desplazar la lista, la cabecera se separa con una sombra (antes el contenido pasaba por debajo
  // sin ninguna marca).
  const [desplazado, setDesplazado] = useState(false);

  return (
    <section className="entra panel flex max-h-full min-h-0 flex-col overflow-hidden" aria-live="polite">
      <header className={`relative z-10 flex items-start gap-3 border-b py-4 pl-5 pr-3 transition-shadow duration-300 ${desplazado ? 'border-transparent shadow-[0_6px_16px_-8px_rgba(0,0,0,.25)]' : 'border-[var(--linea)]'}`}>
        <EscudoRuta numero={ruta.numero} className="mt-0.5 h-9 w-auto shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold leading-tight tracking-[-0.02em]">Ruta Nacional {ruta.numero} en {tituloProvincia(ruta.provincia)}</h2>
          <p className="mt-0.5 text-[14px] text-[var(--tinta-3)]">{simple ? 'Con los datos del Instituto Geográfico Nacional' : 'Calculado en vivo sobre las capas del IGN'}</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar tablero" className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]">
          <X size={19} />
        </button>
      </header>

      <div className="desplazable min-h-0 flex-1 overflow-y-auto" onScroll={e => setDesplazado(e.currentTarget.scrollTop > 4)}>
        {!analisis && !error && (
          <div className="flex items-center gap-3 px-5 py-7 text-[15px] text-[var(--tinta-2)]">
            <Spinner size="sm" /> {simple ? 'Midiendo la ruta y buscando pueblos y puentes…' : 'Midiendo la traza y buscando localidades y puentes…'}
          </div>
        )}
        {error && <p className="px-5 py-6 text-[15px] text-[var(--danger)]">{error}</p>}
        {analisis && (
          <>
            <section className="border-b border-[var(--linea)] px-5 pb-5 pt-4">
              <div className="text-[13px] font-semibold text-[var(--tinta-3)]">{simple ? 'Qué tan larga es' : 'Longitud de la traza'}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <NumeroAnimado valor={analisis.km} decimales={1} className="text-[44px] font-semibold leading-none tracking-[-0.03em]" />
                <span className="text-[18px] font-medium text-[var(--tinta-2)]">km</span>
              </div>
              <p className="mt-2 text-[13px] text-[var(--tinta-3)]">{simple ? `Solo la parte que está dentro de ${tituloProvincia(ruta.provincia)}.` : `${analisis.tramos} tramos de la red vial, recortados al límite provincial.`}</p>
            </section>

            <section className="border-b border-[var(--linea)] px-5 pb-5 pt-4">
              <div className="mb-4 text-[13px] font-semibold text-[var(--tinta-3)]">{simple ? 'Gente que vive cerca' : 'Población afectada'}</div>
              <BarraApilada
                total={<NumeroAnimado valor={analisis.franja1.habitantes + analisis.franja2.habitantes} />}
                detalle={simple ? 'personas' : 'habitantes'}
                segmentos={[
                  { id: '1', etiqueta: 'Hasta 10 km', valor: analisis.franja1.habitantes, color: 'var(--dato-1)' },
                  { id: '2', etiqueta: 'De 10 a 20 km', valor: analisis.franja2.habitantes, color: 'var(--dato-2)' },
                ]}
              />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Franja color="var(--dato-1)" titulo="Hasta 10 km" datos={analisis.franja1} />
                <Franja color="var(--dato-2)" titulo="De 10 a 20 km" datos={analisis.franja2} />
              </div>
              <div className="mt-4 flex items-center gap-4 text-[13px] text-[var(--tinta-2)]" aria-label="Cómo leer el mapa">
                <span className="flex items-center gap-1.5">
                  <span className="flex items-end gap-0.5" aria-hidden="true">
                    <span className="size-1.5 rounded-full bg-[var(--dato-1)]" /><span className="size-2.5 rounded-full bg-[var(--dato-1)]" /><span className="size-3.5 rounded-full bg-[var(--dato-1)]" />
                  </span>
                  Más grande, más habitantes
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ boxShadow: 'inset 0 0 0 2px var(--dato-1)' }} aria-hidden="true" />
                  Sin dato
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--tinta-3)]">
                {simple
                  ? 'Cada pueblo se cuenta una sola vez: en el grupo de lo que está más cerca. Algunos pueblos no tienen el dato de cuánta gente vive.'
                  : 'Franjas excluyentes, con distancia geodésica a la traza. Las localidades sin dato de habitantes en el IGN se cuentan pero no suman población.'}
              </p>
            </section>

            <section className="border-b border-[var(--linea)] px-5 pb-4 pt-4">
              <button type="button" onClick={() => setVerPuentes(!verPuentes)} aria-expanded={verPuentes} className="flex w-full items-center gap-3 text-left">
                <span className="grid size-10 place-items-center rounded-[11px] bg-[var(--superficie-2)] text-[var(--tinta-2)]"><Bridge size={20} /></span>
                <span className="flex-1">
                  <span className="block text-[13px] font-semibold text-[var(--tinta-3)]">{simple ? 'Puentes en la ruta' : 'Puentes sobre la traza'}</span>
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
                <h3 className="text-[13px] font-semibold text-[var(--tinta-3)]">{simple ? 'Pueblos, del más cercano al más lejano' : 'Localidades, de la más cercana a la más lejana'}</h3>
                <span className="text-[13px] text-[var(--tinta-3)]">{analisis.localidades.length}</span>
              </div>
              <ul className="divide-y divide-[var(--linea)]">
                {analisis.localidades.map(l => <FilaLocalidad key={l.id} localidad={l} elegida={elegida?.id === l.id} onEnfocar={enfocar} onElegir={() => elegir(l)} />)}
              </ul>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

function Franja({ color, titulo, datos }: { color: string; titulo: string; datos: AnalisisRuta['franja1'] }) {
  const simple = useInterfaz() === 'simple';
  return (
    <div className="rounded-xl bg-[var(--superficie-2)] px-3.5 py-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--tinta-3)]">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />{titulo}
      </div>
      <div className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em]"><NumeroAnimado valor={datos.localidades} /> <span className="text-[14px] font-medium text-[var(--tinta-2)]">{simple ? 'pueblos' : 'localidades'}</span></div>
      <div className="text-[13px] text-[var(--tinta-3)]">{datos.sinDato} {simple ? 'sin el dato de gente' : 'sin dato de habitantes'}</div>
    </div>
  );
}

function FilaLocalidad({ localidad, elegida, onEnfocar, onElegir }: {
  localidad: LocalidadCercana; elegida: boolean; onEnfocar: (f?: import('ol/Feature').default) => void; onElegir: () => void;
}) {
  const color = localidad.franja === 1 ? 'var(--dato-1)' : 'var(--dato-2)';
  return (
    <li>
      <button
        type="button"
        onMouseEnter={() => onEnfocar(localidad.feature)}
        onMouseLeave={() => onEnfocar()}
        onFocus={() => onEnfocar(localidad.feature)}
        onBlur={() => onEnfocar()}
        onClick={onElegir}
        aria-pressed={elegida}
        className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${elegida ? 'bg-[var(--superficie-3)]' : 'hover:bg-[var(--superficie-2)]'}`}
      >
        {/* El mismo símbolo que en el mapa: lleno con habitantes, anillo sin dato. */}
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={localidad.habitantes ? { backgroundColor: color } : { boxShadow: `inset 0 0 0 2px ${color}` }}
        />
        <span className="min-w-0 flex-1">
          {/* El IGN tiene muchos parajes "Sin Nombre": se nombran como lugar y quedan atenuados. */}
          {/^sin nombre$/i.test(localidad.nombre)
            ? <span className={`block truncate text-[15px] italic text-[var(--tinta-2)] ${elegida ? 'font-semibold' : ''}`}>Lugar sin nombre</span>
            : <span className={`block truncate text-[15px] ${elegida ? 'font-semibold' : 'font-medium'}`}>{localidad.nombre}</span>}
          <span className="text-[13px] text-[var(--tinta-3)]">
            {localidad.departamento}{localidad.habitantes ? ` · ${localidad.habitantes.toLocaleString('es-AR')} hab.` : ' · sin dato de habitantes'}
          </span>
        </span>
        <span className="shrink-0 text-[14px] font-semibold tabular-nums">{km(localidad.distancia)} km</span>
      </button>
    </li>
  );
}
