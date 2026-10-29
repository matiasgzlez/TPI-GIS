import { useEffect, useReducer, useState } from 'react';
import { Switch } from '@heroui/react';
import { ArrowCounterClockwise, CaretDown, EyeSlash } from '@phosphor-icons/react';
import { CAPAS, GRUPOS, type Geometria } from '../config';
import { cambiarCapas, cargarLeyenda, restablecerCapas, suscribirCapas, type Visor } from '../visor';

interface Props {
  visor: Visor;
  // En celular el panel arranca plegado para que se vea el mapa.
  plegable: boolean;
}

// Grupos plegables con un switch por grupo y uno por capa; al prender una capa aparece su leyenda.
export default function PanelCapas({ visor, plegable }: Props) {
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(['proyecto', 'limites', 'transporte', 'hidrografia']));
  const [desplegado, setDesplegado] = useState(!plegable);

  // La visibilidad vive en el visor; el panel solo la refleja.
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);

  const alternar = (id: string) => setAbiertos(prev => {
    const nuevo = new Set(prev);
    if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
    return nuevo;
  });
  const prendidas = visor.visibles.size;

  return (
    <section className="panel flex min-h-0 flex-col overflow-hidden" aria-label="Capas">
      <header className="px-5 pb-4 pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => plegable && setDesplegado(!desplegado)}
            aria-expanded={desplegado}
            className={`flex min-w-0 flex-1 items-center gap-2 text-left ${plegable ? '' : 'pointer-events-none'}`}
          >
            <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Capas</h2>
            {plegable && <CaretDown size={14} weight="bold" className={`transition-transform ${desplegado ? 'rotate-180' : ''}`} />}
          </button>
          <BotonTexto onPress={() => restablecerCapas(visor)} etiqueta="Restablecer capas del inicio" soloIcono>
            <ArrowCounterClockwise size={17} />
          </BotonTexto>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[14px] text-[var(--tinta-2)]">
            {prendidas ? <><strong className="font-semibold text-[var(--tinta)]">{prendidas}</strong> de {CAPAS.length} prendidas</> : 'Ninguna prendida'}
          </p>
          <BotonTexto onPress={() => cambiarCapas(visor, [...visor.visibles], false)} deshabilitado={!prendidas} etiqueta="Apagar todas">
            <EyeSlash size={17} />
          </BotonTexto>
        </div>
      </header>

      {desplegado && (
        <div className="desplazable min-h-0 flex-1 overflow-y-auto border-t border-[var(--linea)] px-2 pb-3 pt-1.5">
          {GRUPOS.map(grupo => {
            const nombres = grupo.capas.map(c => c.nombre);
            const cuantas = nombres.filter(n => visor.visibles.has(n)).length;
            const abierto = abiertos.has(grupo.id);
            return (
              <div key={grupo.id} className="py-0.5">
                <div className="flex items-center gap-1 rounded-xl pr-3 hover:bg-[var(--superficie-2)]">
                  <button
                    type="button"
                    onClick={() => alternar(grupo.id)}
                    aria-expanded={abierto}
                    className="flex min-h-[50px] flex-1 items-center gap-2.5 rounded-xl pl-3 text-left"
                  >
                    <CaretDown size={13} weight="bold" className={`shrink-0 text-[var(--tinta-3)] transition-transform duration-300 ${abierto ? '' : '-rotate-90'}`} />
                    <span className="flex-1 text-[15px] font-semibold">{grupo.titulo}</span>
                    <span className={`text-[13px] font-medium ${cuantas ? 'text-[var(--tinta-2)]' : 'text-[var(--tinta-3)]'}`}>
                      {cuantas}/{grupo.capas.length}
                    </span>
                  </button>
                  <Switch
                    aria-label={`${cuantas ? 'Apagar' : 'Prender'} todo ${grupo.titulo}`}
                    isSelected={cuantas > 0}
                    onChange={valor => cambiarCapas(visor, nombres, valor)}
                  >
                    <Switch.Content className="cursor-pointer p-1">
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>

                <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <ul className="overflow-hidden" inert={!abierto}>
                    {grupo.capas.map(capa => {
                      const visible = visor.visibles.has(capa.nombre);
                      return (
                        <li key={capa.nombre}>
                          <Switch isSelected={visible} onChange={valor => cambiarCapas(visor, [capa.nombre], valor)} className="w-full">
                            <Switch.Content className="flex min-h-[46px] w-full cursor-pointer items-center gap-3 rounded-xl py-1.5 pl-8 pr-4 hover:bg-[var(--superficie-2)]">
                              <Glifo geometria={capa.geometria} activo={visible} />
                              <span className={`flex-1 text-[15px] leading-tight ${visible ? 'text-[var(--tinta)]' : 'text-[var(--tinta-2)]'}`}>
                                {capa.titulo}
                              </span>
                              <Switch.Control><Switch.Thumb /></Switch.Control>
                            </Switch.Content>
                          </Switch>
                          {visible && <Leyenda nombre={capa.nombre} titulo={capa.titulo} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function BotonTexto({ etiqueta, onPress, deshabilitado, soloIcono, children }: {
  etiqueta: string; onPress: () => void; deshabilitado?: boolean; soloIcono?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={deshabilitado}
      aria-label={etiqueta}
      title={etiqueta}
      className={`flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[var(--superficie-2)] text-[14px] font-medium text-[var(--tinta)] transition-colors hover:bg-[var(--superficie-3)] disabled:cursor-not-allowed disabled:opacity-40 ${soloIcono ? 'w-10 justify-center' : 'px-3.5'}`}
    >
      {children}
      {!soloIcono && <span>{etiqueta}</span>}
    </button>
  );
}

function Leyenda({ nombre, titulo }: { nombre: string; titulo: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    const control = new AbortController();
    cargarLeyenda(nombre, control.signal).then(setSrc, () => {});
    return () => control.abort();
  }, [nombre]);
  useEffect(() => () => {
    if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
  }, [src]);
  if (!src) return null;
  return <img className="leyenda-wms mb-2 ml-[58px] block max-w-[230px]" alt={`Leyenda de ${titulo}`} src={src} />;
}

// Un glifo por tipo de geometría: dice qué se va a ver antes de prenderla.
function Glifo({ geometria, activo }: { geometria: Geometria; activo: boolean }) {
  const color = activo ? 'var(--tinta)' : 'var(--tinta-3)';
  return (
    <svg viewBox="0 0 12 12" className="size-3.5 shrink-0" aria-hidden="true">
      {geometria === 'punto' && <circle cx="6" cy="6" r="2.8" fill={color} />}
      {geometria === 'linea' && <path d="M1.5 9.5 5 5l2.5 2.5 3-5" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
      {geometria === 'poligono' && <path d="M2 3.5 7 1.8l3.2 3.4-1.4 5H3z" fill={color} fillOpacity=".22" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />}
    </svg>
  );
}
