// Piezas de interfaz del mapa de calor (T3): el selector Puntos / Calor de pro, el botón "Ver como
// manchas" de simple, la leyenda de la mancha, la tarjeta "¿Dónde vive la gente?" y el aviso sobre el
// mapa cuando una mancha necesita que te acerques o no se pudo traer.
import { useEffect, useReducer, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Spinner } from '@heroui/react';
import { ArrowClockwise, DotsNine, Fire, MagnifyingGlassPlus, UsersThree, WarningCircle } from '@phosphor-icons/react';
import { CAPA_POBLACION, calorDe, esPoblacion, type EstadoCalor } from '../calor';
import { GRADIENTES } from '../calorColores';
import { cambiarCalor, cambiarCapas, cargarCalor, suscribirCapas, type Visor } from '../visor';
import { CAPAS, tituloDeCapa } from '../config';
import { capaSimple, useInterfaz } from '../interfaz';
import { RESORTE, RESORTE_PANEL } from '../movimiento';

// ¿Se puede ver como calor? Las capas de puntos, salvo las obras de la ruta (las carga cada uno por
// WFS-T: una mancha de pocas obras no dice nada y no se actualizaría con una obra nueva).
export const admiteCalor = (nombre: string) => nombre !== 'obras_rn11' && CAPAS.find(c => c.nombre === nombre)?.geometria === 'punto';

// Si la tarjeta "¿Dónde vive la gente?" prendió las localidades, al apagarla también las apaga: vuelve
// a como estaba.
let tarjetaPrendioLocalidades = false;

// El estado de una mancha; se vuelve a pintar cuando cambian las capas o el estado de su carga.
function useCalor(visor: Visor, nombre: string): { activo: boolean; estado: EstadoCalor } {
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);
  useEffect(() => {
    const fuente = calorDe(nombre).fuente;
    const escuchar = (e: { key: string }) => e.key === 'estado' && redibujar();
    fuente.on('propertychange', escuchar);
    return () => fuente.un('propertychange', escuchar);
  }, [nombre]);
  return { activo: visor.calor.has(nombre), estado: calorDe(nombre).estado() };
}

// El tema, en vivo: la rampa de la leyenda tiene que ser la misma que la del mapa en cada tema.
const esOscuro = () => document.documentElement.classList.contains('dark');
const suscribirTema = (aviso: () => void) => {
  const o = new MutationObserver(aviso);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => o.disconnect();
};
const useOscuro = () => useSyncExternalStore(suscribirTema, esOscuro);
const rampa = (nombre: string, oscuro: boolean) => `linear-gradient(90deg, ${GRADIENTES[esPoblacion(nombre) ? 'poblacion' : 'densidad'][oscuro ? 'oscuro' : 'claro'].slice(1).join(', ')})`;

// Después de "Reintentar" el aviso se va: el foco vuelve al mapa, no al vacío.
function reintentar(visor: Visor) {
  const mapa = visor.mapa.getTargetElement();
  if (mapa) { if (!mapa.hasAttribute('tabindex')) mapa.tabIndex = -1; mapa.focus({ preventScroll: true }); }
  cargarCalor(visor, true);
}

// Un solo mensaje a la vez para el estado de una mancha (nada si está lista).
function mensaje(estado: EstadoCalor, simple: boolean): { tipo: 'cargando' | 'error' | 'demasiados'; texto: string } | null {
  if (estado.fase === 'cargando') return { tipo: 'cargando', texto: simple ? 'Trayendo los datos…' : 'Cargando puntos por WFS…' };
  if (estado.fase === 'error') return { tipo: 'error', texto: simple ? 'No pudimos traer los datos.' : 'Falló el pedido WFS.' };
  if (estado.fase === 'demasiados') return { tipo: 'demasiados', texto: simple ? 'Hay demasiados para esta distancia: acercate para ver las manchas.' : `${estado.total.toLocaleString('es-AR')} puntos en esta zona: acercate para dibujar la mancha.` };
  return null;
}

// El estado debajo de un control (tarjeta, botón o selector). La región está siempre montada: un lector
// de pantalla anuncia los cambios una vez, no cada vez que aparece y desaparece.
function EstadoCalorLinea({ visor, nombre, simple }: { visor: Visor; nombre: string; simple: boolean }) {
  const { activo, estado } = useCalor(visor, nombre);
  const m = activo ? mensaje(estado, simple) : null;
  return (
    <div role="status" aria-live="polite" className="text-[12.5px] leading-snug">
      {m && (
        <span className={`mt-1.5 flex items-center gap-1.5 ${m.tipo === 'error' ? 'font-medium text-[var(--danger)]' : m.tipo === 'demasiados' ? 'font-medium text-[var(--vial-texto)]' : 'text-[var(--tinta-3)]'}`}>
          {m.tipo === 'cargando' ? <Spinner size="sm" /> : m.tipo === 'error' ? <WarningCircle size={15} weight="bold" /> : <MagnifyingGlassPlus size={15} weight="bold" />}
          <span className="min-w-0 flex-1">{m.texto}</span>
          {m.tipo === 'error' && (
            <button type="button" onClick={() => reintentar(visor)} className="shrink-0 rounded-md px-1.5 py-0.5 font-semibold text-[var(--tinta)] underline underline-offset-2 hover:bg-[var(--superficie-2)]">
              {simple ? 'Probar de nuevo' : 'Reintentar'}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

// Modo profesional: "Puntos | Calor", al lado de "Leyenda y ajustes" de una capa de puntos prendida. Un
// grupo de radios con una sola parada de Tab: las flechas eligen.
export function SelectorCalor({ visor, nombre, titulo }: { visor: Visor; nombre: string; titulo: string }) {
  const { activo } = useCalor(visor, nombre);
  const opciones = [
    { valor: false, etiqueta: 'Puntos', icono: <DotsNine size={13} weight="bold" /> },
    { valor: true, etiqueta: 'Calor', icono: <Fire size={13} weight="bold" /> },
  ];
  return (
    <div className="flex flex-col">
      <div
        role="radiogroup"
        aria-label={`Ver ${titulo} como`}
        className="relative flex h-7 w-fit rounded-lg bg-[var(--superficie-2)] p-0.5"
        onKeyDown={e => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
          e.preventDefault();
          cambiarCalor(visor, nombre, !activo);
          const botones = e.currentTarget.querySelectorAll<HTMLElement>('[role=radio]');
          requestAnimationFrame(() => botones[activo ? 0 : 1]?.focus());
        }}
      >
        {opciones.map(o => {
          const elegida = o.valor === activo;
          return (
            <button
              key={o.etiqueta}
              type="button"
              role="radio"
              aria-checked={elegida}
              tabIndex={elegida ? 0 : -1}
              onClick={() => cambiarCalor(visor, nombre, o.valor)}
              className={`relative flex items-center gap-1 rounded-md px-2 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ${elegida ? 'text-[var(--tinta)]' : 'text-[var(--tinta-3)] hover:text-[var(--tinta-2)]'}`}
            >
              {elegida && <motion.span layoutId={`calor-${nombre}`} transition={RESORTE} className="absolute inset-0 rounded-md bg-[var(--superficie)] shadow-[0_1px_2px_rgba(0,0,0,.1)]" />}
              <span className="relative flex items-center gap-1">{o.icono}{o.etiqueta}</span>
            </button>
          );
        })}
      </div>
      <EstadoCalorLinea visor={visor} nombre={nombre} simple={false} />
    </div>
  );
}

// Modo simple: el botón "Ver como manchas" debajo de la tarjeta de una capa de puntos prendida.
export function BotonManchas({ visor, nombre }: { visor: Visor; nombre: string }) {
  const { activo } = useCalor(visor, nombre);
  return (
    <div>
      <button
        type="button"
        onClick={() => cambiarCalor(visor, nombre, !activo)}
        aria-pressed={activo}
        className={`mt-1.5 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${activo ? 'bg-[var(--tinta)] text-[var(--superficie)]' : 'bg-[var(--superficie-2)] text-[var(--tinta-2)] hover:bg-[var(--superficie-3)] hover:text-[var(--tinta)]'}`}
      >
        {activo ? <><DotsNine size={17} weight="bold" /> Ver como puntos</> : <><Fire size={17} weight="bold" /> Ver como manchas</>}
      </button>
      <div className="px-1"><EstadoCalorLinea visor={visor} nombre={nombre} simple /></div>
    </div>
  );
}

// La leyenda de una mancha: la rampa de colores y qué quiere decir.
export function LeyendaCalor({ visor, nombre, simple, className = '' }: { visor: Visor; nombre: string; simple: boolean; className?: string }) {
  useCalor(visor, nombre);
  const oscuro = useOscuro();
  const poblacion = esPoblacion(nombre);
  const [menos, mas] = poblacion
    ? (simple ? ['Poca gente', 'Mucha gente'] : ['Menos habitantes', 'Más habitantes'])
    : (simple ? ['Pocos', 'Muchos'] : ['Menor densidad', 'Mayor densidad']);
  return (
    <div className={className}>
      <div className="h-2.5 w-full max-w-[240px] rounded-full shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--tinta)_10%,transparent)]" style={{ background: rampa(nombre, oscuro) }} aria-hidden="true" />
      <div className="mt-1 flex max-w-[240px] justify-between gap-2 whitespace-nowrap text-[11.5px] font-medium text-[var(--tinta-3)]">
        <span>{menos}</span><span className="text-right">{mas}</span>
      </div>
      <p className="mt-1.5 max-w-[260px] text-[12.5px] leading-snug text-[var(--tinta-3)]">
        {poblacion
          ? (simple ? 'Cuanto más fuerte el color, más gente vive ahí.' : 'Localidades pesadas por habitantes (canthab ^ 0,35; las que no tienen dato no suman). De lejos, cada lugar pesa menos.')
          : (simple ? 'Cuanto más fuerte el color, más hay juntos.' : 'Densidad de puntos: cada punto pesa lo mismo; con muchos a la vista, cada uno pesa menos.')}
      </p>
    </div>
  );
}

// Modo simple: tarjeta grande arriba de las temáticas. Un toque muestra dónde vive la gente (las
// localidades como manchas pesadas por habitantes); otro, vuelve a como estaba.
export function TarjetaDondeViveLaGente({ visor }: { visor: Visor }) {
  const { activo } = useCalor(visor, CAPA_POBLACION);
  const oscuro = useOscuro();
  // El dibujo usa la misma rampa que el mapa: en oscuro, el centro claro.
  const [g0, g1, g2, g3, g4, g5, g6] = GRADIENTES.poblacion[oscuro ? 'oscuro' : 'claro'];
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (!activo) {
            tarjetaPrendioLocalidades = !visor.visibles.has(CAPA_POBLACION);
            cambiarCalor(visor, CAPA_POBLACION, true);
          } else {
            cambiarCalor(visor, CAPA_POBLACION, false);
            if (tarjetaPrendioLocalidades) cambiarCapas(visor, [CAPA_POBLACION], false);
            tarjetaPrendioLocalidades = false;
          }
        }}
        aria-pressed={activo}
        className={`group relative flex w-full items-center gap-3.5 overflow-hidden rounded-[18px] p-3 text-left transition-[box-shadow,transform] duration-300 ease-[var(--ios)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 ${activo ? 'bg-[var(--superficie)] shadow-[0_0_0_2px_var(--tinta),var(--sombra)]' : 'bg-[var(--superficie-2)]'}`}
      >
        {/* Un mapa de calor dibujado: manchas que laten despacio cuando la tarjeta está activa. */}
        <span className="relative block h-[68px] w-[96px] shrink-0 overflow-hidden rounded-[12px]" style={{ background: oscuro ? '#1b1d21' : '#f3efe6' }} aria-hidden="true">
          {[[30, 40, 38], [64, 30, 26], [52, 62, 20], [18, 20, 16], [80, 70, 14]].map(([x, y, r], i) => (
            <span
              key={i}
              className={`absolute rounded-full ${activo ? 'latido' : ''}`}
              style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r, animationDelay: `${i * 0.4}s`,
                background: `radial-gradient(circle, ${g6} 0%, ${g5} 14%, ${g4} 28%, ${g3} 42%, ${g2} 58%, ${g1} 76%, ${g0} 100%)` }}
            />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[16px] font-semibold leading-tight"><UsersThree size={18} weight="bold" /> ¿Dónde vive la gente?</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-[var(--tinta-3)]">{activo ? 'Las manchas muestran dónde vive más gente. Tocá de nuevo para sacarlas.' : 'Tocá para ver manchas donde vive más gente'}</span>
        </span>
      </button>
      <div className="px-2"><EstadoCalorLinea visor={visor} nombre={CAPA_POBLACION} simple /></div>
    </div>
  );
}

// Sobre el mapa: si alguna mancha necesita que te acerques o no se pudo traer, se dice ahí mismo (no
// solo en la leyenda), con la salida a mano.
export function AvisoCalor({ visor, onAcercar }: { visor: Visor; onAcercar: () => void }) {
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  const simple = useInterfaz() === 'simple';
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);
  const nombres = [...visor.calor.keys()];
  const claveNombres = nombres.join('|');
  useEffect(() => {
    const fuentes = claveNombres ? claveNombres.split('|').map(n => calorDe(n).fuente) : [];
    const escuchar = (e: { key: string }) => e.key === 'estado' && redibujar();
    fuentes.forEach(f => f.on('propertychange', escuchar));
    return () => fuentes.forEach(f => f.un('propertychange', escuchar));
  }, [claveNombres]);
  const problema = nombres.map(n => ({ n, e: calorDe(n).estado() })).find(({ e }) => e.fase === 'demasiados' || e.fase === 'error');
  const titulo = problema && (simple ? capaSimple(problema.n)?.titulo ?? tituloDeCapa(problema.n) : tituloDeCapa(problema.n));
  return (
    <AnimatePresence>
      {problema && (
        <motion.div
          key={`${problema.n}-${problema.e.fase}`}
          role="alert"
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={RESORTE_PANEL}
          className="panel pointer-events-auto flex max-w-[min(560px,calc(100cqw-32px))] items-center gap-3 py-2 pl-4 pr-2 text-[14px] shadow-[var(--sombra-alta)]"
        >
          {problema.e.fase === 'error' ? <WarningCircle size={18} weight="bold" className="shrink-0 text-[var(--danger)]" /> : <Fire size={18} weight="bold" className="shrink-0 text-[var(--vial-texto)]" />}
          <span className="min-w-0 flex-1 leading-snug">
            <strong className="font-semibold">{titulo}:</strong>{' '}
            {problema.e.fase === 'error'
              ? (simple ? 'no pudimos traer las manchas.' : 'no se pudieron cargar los puntos de la mancha.')
              : (simple ? 'hay demasiados para ver las manchas desde tan lejos.' : `${problema.e.total.toLocaleString('es-AR')} puntos en esta zona, más que el tope de la mancha.`)}
          </span>
          {problema.e.fase === 'error'
            ? <button type="button" onClick={() => reintentar(visor)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--tinta)] px-3 text-[13.5px] font-semibold text-[var(--superficie)]"><ArrowClockwise size={15} weight="bold" /> {simple ? 'Probar de nuevo' : 'Reintentar'}</button>
            : <button type="button" onClick={onAcercar} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--tinta)] px-3 text-[13.5px] font-semibold text-[var(--superficie)]"><MagnifyingGlassPlus size={15} weight="bold" /> Acercar</button>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
