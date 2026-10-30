import { useEffect, useReducer, useState } from 'react';
import { Switch } from '@heroui/react';
import { ArrowCounterClockwise, CaretDown, Eye, EyeSlash, MagnifyingGlass, SlidersHorizontal, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { CAPAS, CONJUNTOS, GRUPOS, type Geometria } from '../config';
import { normalizar, SINONIMOS } from '../comandos';
import { RESORTE_PANEL } from '../movimiento';
import { cambiarCapas, cambiarOpacidad, cargarLeyenda, ponerCapas, restablecerCapas, suscribirCapas, verSolo, type Visor } from '../visor';

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
  const [filtro, setFiltro] = useState('');
  const [ajustando, setAjustando] = useState<string | null>(null);

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
        {desplegado && (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Conjuntos de capas">
              {CONJUNTOS.map(c => {
                const activo = c.capas.length === visor.visibles.size && c.capas.every(n => visor.visibles.has(n));
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => ponerCapas(visor, c.capas)}
                    aria-pressed={activo}
                    className={`h-8 rounded-full px-3 text-[13px] font-medium transition-colors ${activo ? 'bg-[var(--tinta)] text-[var(--superficie)]' : 'bg-[var(--superficie-2)] text-[var(--tinta-2)] hover:bg-[var(--superficie-3)] hover:text-[var(--tinta)]'}`}
                  >
                    {c.titulo}
                  </button>
                );
              })}
            </div>
            <label className="mt-3 flex h-10 items-center gap-2 rounded-xl bg-[var(--superficie-2)] px-3">
              <MagnifyingGlass size={16} className="shrink-0 text-[var(--tinta-3)]" />
              <input
                value={filtro}
                onChange={e => setFiltro(e.target.value)}
                placeholder="Filtrar las 48 capas"
                aria-label="Filtrar capas"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--tinta-3)]"
              />
              {filtro && <button type="button" onClick={() => setFiltro('')} aria-label="Borrar filtro" className="text-[var(--tinta-3)] hover:text-[var(--tinta)]"><X size={15} /></button>}
            </label>
          </>
        )}
      </header>

      {desplegado && (
        <div className="desplazable min-h-0 flex-1 overflow-y-auto border-t border-[var(--linea)] px-2 pb-3 pt-1.5">
          {filtro && !GRUPOS.some(g => g.capas.some(c => coincide(c.nombre, c.titulo, g.titulo, filtro))) && (
            <p className="px-3 py-4 text-[14px] text-[var(--tinta-2)]">Ninguna capa coincide con “{filtro}”.</p>
          )}
          {GRUPOS.map(grupo => {
            const capasGrupo = filtro ? grupo.capas.filter(c => coincide(c.nombre, c.titulo, grupo.titulo, filtro)) : grupo.capas;
            if (!capasGrupo.length) return null;
            const nombres = grupo.capas.map(c => c.nombre);
            const cuantas = nombres.filter(n => visor.visibles.has(n)).length;
            const abierto = !!filtro || abiertos.has(grupo.id);
            return (
              <div key={grupo.id} className="py-0.5">
                <div className="flex items-center gap-1 rounded-xl pr-3 hover:bg-[var(--superficie-2)]">
                  <button
                    type="button"
                    onClick={() => alternar(grupo.id)}
                    aria-expanded={abierto}
                    className="flex min-h-[50px] flex-1 items-center gap-2.5 rounded-xl pl-3 text-left"
                  >
                    <CaretDown size={13} weight="bold" className={`shrink-0 text-[var(--tinta-3)] transition-transform duration-[420ms] ease-[var(--ios)] ${abierto ? '' : '-rotate-90'}`} />
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

                <div className={`grid transition-[grid-template-rows] duration-[420ms] ease-[var(--ios)] ${abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <ul className="overflow-hidden" inert={!abierto}>
                    {capasGrupo.map(capa => {
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
                          {visible && (
                            <div className="flex items-start gap-2 pr-3">
                              <Leyenda nombre={capa.nombre} titulo={capa.titulo} />
                              <button
                                type="button"
                                onClick={() => setAjustando(ajustando === capa.nombre ? null : capa.nombre)}
                                aria-expanded={ajustando === capa.nombre}
                                aria-label={`Ajustar ${capa.titulo}`}
                                title="Opacidad y ver solo esta"
                                className={`ml-auto grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${ajustando === capa.nombre ? 'bg-[var(--superficie-3)] text-[var(--tinta)]' : 'text-[var(--tinta-3)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]'}`}
                              >
                                <SlidersHorizontal size={16} />
                              </button>
                            </div>
                          )}
                          <AnimatePresence initial={false}>
                            {visible && ajustando === capa.nombre && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={RESORTE_PANEL}
                                className="overflow-hidden"
                              >
                                <Ajustes visor={visor} nombre={capa.nombre} />
                              </motion.div>
                            )}
                          </AnimatePresence>
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

const coincide = (nombre: string, titulo: string, grupo: string, filtro: string) =>
  normalizar(`${titulo} ${grupo} ${SINONIMOS[nombre] ?? ''}`).includes(normalizar(filtro));

// Opacidad y "ver solo esta" de una capa prendida.
function Ajustes({ visor, nombre }: { visor: Visor; nombre: string }) {
  const opacidad = visor.opacidades[nombre] ?? 1;
  return (
    <div className="mx-3 mb-2 ml-[52px] rounded-xl bg-[var(--superficie-2)] px-3.5 py-3">
      <label className="block">
        <span className="flex items-baseline justify-between text-[13px]">
          <span className="font-medium text-[var(--tinta-2)]">Opacidad</span>
          <span className="font-semibold">{Math.round(opacidad * 100)} %</span>
        </span>
        <input
          type="range" min={10} max={100} step={5}
          value={Math.round(opacidad * 100)}
          onChange={e => cambiarOpacidad(visor, nombre, Number(e.target.value) / 100)}
          className="deslizador mt-2 w-full"
          aria-label="Opacidad"
        />
      </label>
      <button
        type="button"
        onClick={() => verSolo(visor, nombre)}
        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[var(--superficie)] text-[13px] font-medium hover:bg-[var(--superficie-3)]"
      >
        <Eye size={15} /> Ver solo esta capa
      </button>
    </div>
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
  return <img className="leyenda-wms mb-2 ml-[58px] block max-w-[200px]" alt={`Leyenda de ${titulo}`} src={src} />;
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
