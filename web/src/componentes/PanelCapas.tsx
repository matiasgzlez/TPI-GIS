import { useEffect, useReducer, useState } from 'react';
import { Switch } from '@heroui/react';
import { ArrowCounterClockwise, CaretDown, Eye, EyeSlash, ListBullets, MagnifyingGlass, SidebarSimple, Table, X } from '@phosphor-icons/react';
import { miniatura } from '../interfaz';
import { AnimatePresence, motion } from 'motion/react';
import { unByKey } from 'ol/Observable';
import { CAPAS, CONJUNTOS, GRUPOS, type Geometria } from '../config';
import { normalizar, SINONIMOS } from '../comandos';
import { RESORTE_PANEL } from '../movimiento';
import { escalaMinima } from '../estilos';
import { SelectorCalor, LeyendaCalor, admiteCalor } from './Calor';
import { acercarAEscala, cambiarCapas, cambiarOpacidad, cargarLeyenda, denominadorWms, ponerCapas, restablecerCapas, suscribirCapas, verSolo, type Visor } from '../visor';

interface Props {
  visor: Visor;
  // En celular el panel arranca plegado para que se vea el mapa.
  plegable: boolean;
  // Modo profesional: pliega la barra lateral entera.
  onPlegar?: () => void;
  // Modo profesional: abre la tabla de datos de la capa (T4).
  onTabla?: (nombre: string) => void;
  tablaAbierta?: string | null;
}

// Grupos plegables con un switch por grupo y uno por capa. Minimalista: los grupos arrancan cerrados
// y dicen en una línea qué tienen prendido; la leyenda y los ajustes de cada capa se abren a pedido.
export default function PanelCapas({ visor, plegable, onPlegar, onTabla, tablaAbierta }: Props) {
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set());
  // Grupos que alguna vez se abrieron: los cerrados no montan sus filas (ni piden sus miniaturas).
  const [montados, setMontados] = useState<Set<string>>(() => new Set());
  const [desplegado, setDesplegado] = useState(!plegable);
  const [filtro, setFiltro] = useState('');
  const [ajustando, setAjustando] = useState<string | null>(null);

  // La visibilidad vive en el visor; el panel solo la refleja.
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);

  // Capas prendidas que a la escala actual no dibujan nada. Se guarda como texto para que el panel
  // solo se redibuje cuando cambia el conjunto, no en cada cuadro del zoom.
  const [sinDibujar, setSinDibujar] = useState('');
  useEffect(() => {
    const vista = visor.mapa.getView();
    const actualizar = () => {
      if (vista.getResolution() === undefined || !vista.getCenter()) return;
      const escala = denominadorWms(visor);
      setSinDibujar([...visor.visibles].filter(n => (escalaMinima(n) ?? Infinity) <= escala).join(','));
    };
    actualizar();
    const clave = vista.on('change:resolution', actualizar);
    const desuscribir = suscribirCapas(visor, actualizar);
    return () => {
      unByKey(clave);
      desuscribir();
    };
  }, [visor]);
  const ocultas = new Set(sinDibujar ? sinDibujar.split(',') : []);

  const alternar = (id: string) => {
    setMontados(m => new Set(m).add(id));
    setAbiertos(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
      return nuevo;
    });
  };
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
            <span className="text-[14px] tabular-nums text-[var(--tinta-3)]" aria-label={`${prendidas} de ${CAPAS.length} prendidas`}>
              {prendidas}/{CAPAS.length}
            </span>
            {plegable && <CaretDown size={14} weight="bold" className={`transition-transform ${desplegado ? 'rotate-180' : ''}`} />}
          </button>
          <BotonTexto onPress={() => restablecerCapas(visor)} etiqueta="Restablecer capas del inicio" soloIcono>
            <ArrowCounterClockwise size={17} />
          </BotonTexto>
          <BotonTexto onPress={() => cambiarCapas(visor, [...visor.visibles], false)} deshabilitado={!prendidas} etiqueta="Apagar todas" soloIcono>
            <EyeSlash size={17} />
          </BotonTexto>
          {onPlegar && (
            <BotonTexto onPress={onPlegar} etiqueta="Plegar la barra de capas" soloIcono>
              <SidebarSimple size={17} />
            </BotonTexto>
          )}
        </div>
        {desplegado && (
          <>
            <div className="desplazable-x -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5" role="group" aria-label="Conjuntos de capas">
              {CONJUNTOS.map(c => {
                const activo = c.capas.length === visor.visibles.size && c.capas.every(n => visor.visibles.has(n));
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => ponerCapas(visor, c.capas)}
                    aria-pressed={activo}
                    className={`h-8 shrink-0 rounded-full px-3 text-[13px] font-medium transition-colors ${activo ? 'bg-[var(--tinta)] text-[var(--superficie)]' : 'bg-[var(--superficie-2)] text-[var(--tinta-2)] hover:bg-[var(--superficie-3)] hover:text-[var(--tinta)]'}`}
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
            const resumen = grupo.capas.filter(c => visor.visibles.has(c.nombre)).map(c => c.titulo).join(' · ');
            return (
              <div key={grupo.id} className="py-0.5">
                <div className="flex items-center gap-1 rounded-xl pr-3 hover:bg-[var(--superficie-2)]">
                  <button
                    type="button"
                    onClick={() => alternar(grupo.id)}
                    aria-expanded={abierto}
                    className="flex min-h-[46px] min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1.5 pl-3 text-left"
                  >
                    <CaretDown size={13} weight="bold" className={`shrink-0 text-[var(--tinta-3)] transition-transform duration-[420ms] ease-[var(--ios)] ${abierto ? '' : '-rotate-90'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold leading-tight">{grupo.titulo}</span>
                      {/* Cerrado, el grupo dice qué tiene prendido: no hace falta abrirlo para saberlo. */}
                      {!abierto && resumen && <span className="mt-0.5 block truncate text-[12.5px] text-[var(--tinta-3)]">{resumen}</span>}
                    </span>
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
                    {(abierto || montados.has(grupo.id)) && <>
                    {capasGrupo.map(capa => {
                      const visible = visor.visibles.has(capa.nombre);
                      return (
                        <li key={capa.nombre}>
                          <Switch isSelected={visible} onChange={valor => cambiarCapas(visor, [capa.nombre], valor)} className="w-full">
                            <Switch.Content className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl py-1 pl-7 pr-4 hover:bg-[var(--superficie-2)]">
                              {/* Vista previa real de la capa (scripts/miniaturas.ts) y, chico, el tipo de geometría. */}
                              <span className="relative shrink-0">
                                <img src={miniatura(capa.nombre)} alt="" loading="lazy" className={`miniatura aspect-[16/10] w-16 rounded-md object-cover transition-opacity ${visible ? '' : 'opacity-60'}`} />
                                <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-[var(--superficie)] shadow-[0_0_0_1px_var(--linea)]">
                                  <Glifo geometria={capa.geometria} activo={visible} />
                                </span>
                              </span>
                              <span className={`flex-1 text-[14.5px] leading-tight ${visible ? 'text-[var(--tinta)]' : 'text-[var(--tinta-2)]'}`}>
                                {capa.titulo}
                              </span>
                              <Switch.Control><Switch.Thumb /></Switch.Control>
                            </Switch.Content>
                          </Switch>
                          {visible && ocultas.has(capa.nombre) && !visor.calor.has(capa.nombre) && (
                            <p className="-mt-1 mb-1.5 pl-[104px] pr-4 text-[13px] text-[var(--tinta-3)]">
                              Aparece al acercarse.{' '}
                              <button
                                type="button"
                                onClick={() => acercarAEscala(visor, escalaMinima(capa.nombre)!)}
                                className="font-medium text-[var(--tinta-2)] underline underline-offset-2 hover:text-[var(--tinta)]"
                              >
                                Acercar
                              </button>
                            </p>
                          )}
                          {visible && (
                            <div className="-mt-1 mb-1 ml-[100px] flex flex-wrap items-center gap-2 pr-3">
                            <button
                              type="button"
                              onClick={() => setAjustando(ajustando === capa.nombre ? null : capa.nombre)}
                              aria-expanded={ajustando === capa.nombre}
                              aria-label={`Leyenda y ajustes de ${capa.titulo}`}
                              className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition-colors ${ajustando === capa.nombre ? 'bg-[var(--superficie-3)] text-[var(--tinta)]' : 'text-[var(--tinta-3)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]'}`}
                            >
                              <ListBullets size={14} /> Leyenda y ajustes
                            </button>
                            {onTabla && (
                              <button
                                type="button"
                                onClick={() => onTabla(capa.nombre)}
                                aria-pressed={tablaAbierta === capa.nombre}
                                aria-label={`Tabla de datos de ${capa.titulo}`}
                                className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition-colors ${tablaAbierta === capa.nombre ? 'bg-[var(--superficie-3)] text-[var(--tinta)]' : 'text-[var(--tinta-3)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]'}`}
                              >
                                <Table size={14} /> Tabla
                              </button>
                            )}
                            {/* Capas de puntos: verlas como puntos o como mapa de calor (T3). */}
                            {admiteCalor(capa.nombre) && <SelectorCalor visor={visor} nombre={capa.nombre} titulo={capa.titulo} />}
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
                                {visor.calor.has(capa.nombre)
                                  ? <LeyendaCalor visor={visor} nombre={capa.nombre} simple={false} className="mb-2 ml-[104px] mt-1 pr-4" />
                                  : <Leyenda nombre={capa.nombre} titulo={capa.titulo} />}
                                <Ajustes visor={visor} nombre={capa.nombre} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      );
                    })}
                  </>}
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
    <div className="mx-3 mb-2 ml-[100px] rounded-xl bg-[var(--superficie-2)] px-3.5 py-3">
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
  return <img className="leyenda-wms mb-2 ml-[104px] mt-1 block max-w-[200px]" alt={`Leyenda de ${titulo}`} src={src} />;
}

// Un glifo por tipo de geometría: dice qué se va a ver antes de prenderla.
function Glifo({ geometria, activo }: { geometria: Geometria; activo: boolean }) {
  const color = activo ? 'var(--tinta)' : 'var(--tinta-3)';
  return (
    <svg viewBox="0 0 12 12" className="size-2.5 shrink-0" aria-hidden="true">
      {geometria === 'punto' && <circle cx="6" cy="6" r="2.8" fill={color} />}
      {geometria === 'linea' && <path d="M1.5 9.5 5 5l2.5 2.5 3-5" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
      {geometria === 'poligono' && <path d="M2 3.5 7 1.8l3.2 3.4-1.4 5H3z" fill={color} fillOpacity=".22" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />}
    </svg>
  );
}
