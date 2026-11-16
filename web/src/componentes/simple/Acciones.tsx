import { HandGrabbing, MapPinPlus, Printer, Question, Ruler, SelectionPlus, SplitHorizontal, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import type { Modo } from '../../herramientas';
import { RESORTE, RESORTE_PANEL } from '../../movimiento';
import { Segmentado } from '../ui/segmentado';
import { HERRAMIENTAS_SIMPLES } from '../../interfaz';

// Las herramientas del modo simple como botones grandes con dibujo y una palabra. Mientras una está
// activa, una burbuja dice qué hacer con palabras de todos los días y un botón grande vuelve a "Mover".
// Son las mismas herramientas que el modo profesional (consignas: consulta por punto y rectángulo,
// medición y alta de una obra).
const ACCIONES: { modo: Modo; titulo: string; corto: string; Icono: typeof Question }[] = [
  { modo: 'navegar', Icono: HandGrabbing },
  { modo: 'punto', Icono: Question },
  { modo: 'rectangulo', Icono: SelectionPlus },
  { modo: 'distancia', Icono: Ruler },
  { modo: 'alta', Icono: MapPinPlus },
].map(a => ({ ...a, modo: a.modo as Modo, titulo: a.modo === 'distancia' ? 'Medir' : HERRAMIENTAS_SIMPLES[a.modo as Modo].titulo, corto: HERRAMIENTAS_SIMPLES[a.modo as Modo].corto }));

const PISTAS = Object.fromEntries(Object.entries(HERRAMIENTAS_SIMPLES).map(([m, h]) => [m, h.pista])) as Record<Modo, string>;

// `sinPista`: con el formulario de una obra (o la impresión) abierto, la burbuja no se superpone con él.
// "Imprimir" no es una herramienta del mapa sino una acción: va aparte, después de una línea.
export default function Acciones({ modo, onModo, sinPista, imprimiendo, onImprimir, comparando, onComparar }: { modo: Modo; onModo: (modo: Modo) => void; sinPista?: boolean; imprimiendo?: boolean; onImprimir?: () => void; comparando?: boolean; onComparar?: () => void }) {
  const midiendo = modo === 'distancia' || modo === 'area';
  return (
    <div className="flex flex-col items-center gap-3">
      <AnimatePresence mode="popLayout">
        {modo !== 'navegar' && !sinPista && (
          <motion.div
            key="pista"
            role="status"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={RESORTE_PANEL}
            className="panel flex max-w-[min(560px,calc(100cqw-24px))] flex-col gap-3 px-5 py-4 shadow-[var(--sombra-alta)]"
          >
            <div className="flex items-start gap-3">
              <p key={modo} className="flex-1 text-[17px] font-medium leading-snug">{PISTAS[modo]}</p>
              <button
                type="button"
                onClick={() => onModo('navegar')}
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-[var(--tinta)] px-4 text-[15px] font-semibold text-[var(--superficie)]"
              >
                <X size={16} weight="bold" /> Listo
              </button>
            </div>
            {midiendo && (
              <Segmentado
                etiqueta="Qué medir"
                valor={modo}
                onCambiar={onModo}
                opciones={[{ valor: 'distancia', etiqueta: 'Qué tan lejos' }, { valor: 'area', etiqueta: 'Qué tan grande' }]}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <nav aria-label="Herramientas" data-guia="acciones" className="panel flex gap-1 p-1.5 shadow-[var(--sombra-alta)]">
        {ACCIONES.map(({ modo: m, titulo, corto, Icono }) => {
          const activo = m === modo || (m === 'distancia' && modo === 'area');
          return (
            <button
              key={m}
              type="button"
              onClick={() => onModo(m)}
              aria-pressed={activo}
              aria-label={titulo}
              className={`relative flex h-[74px] w-[86px] flex-col items-center justify-center gap-1 rounded-[18px] text-[14px] font-semibold transition-colors duration-200 focus-visible:outline-2 max-sm:w-[64px] max-sm:text-[12.5px] ${
                activo ? 'text-[var(--superficie)]' : 'text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]'
              }`}
            >
              {activo && <motion.span layoutId="accion-activa" transition={RESORTE} className="absolute inset-0 rounded-[18px] bg-[var(--tinta)]" />}
              <Icono size={30} weight={activo ? 'fill' : 'duotone'} className="relative" />
              <span className="relative">{corto}</span>
            </button>
          );
        })}
        {(onImprimir || onComparar) && <span className="mx-1 my-3 w-px bg-[var(--linea)]" aria-hidden="true" />}
        {/* Comparar (T6): la cortina que muestra dos cosas distintas, una de cada lado. */}
        {onComparar && (
          <button
            type="button"
            onClick={onComparar}
            aria-pressed={!!comparando}
            aria-label="Comparar dos mapas"
            className={`relative flex h-[74px] w-[86px] flex-col items-center justify-center gap-1 rounded-[18px] text-[14px] font-semibold transition-colors duration-200 focus-visible:outline-2 max-sm:w-[64px] max-sm:text-[12.5px] ${
              comparando ? 'bg-[var(--tinta)] text-[var(--superficie)]' : 'text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]'
            }`}
          >
            <SplitHorizontal size={30} weight={comparando ? 'fill' : 'duotone'} className="relative" />
            <span className="relative">Comparar</span>
          </button>
        )}
        {onImprimir && (
          <>
            <button
              type="button"
              onClick={onImprimir}
              aria-pressed={!!imprimiendo}
              aria-label="Imprimir el mapa"
              className={`relative flex h-[74px] w-[86px] flex-col items-center justify-center gap-1 rounded-[18px] text-[14px] font-semibold transition-colors duration-200 focus-visible:outline-2 max-sm:w-[64px] max-sm:text-[12.5px] ${
                imprimiendo ? 'bg-[var(--vial-fuerte)] text-white' : 'text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]'
              }`}
            >
              <Printer size={30} weight={imprimiendo ? 'fill' : 'duotone'} className="relative" />
              <span className="relative">Imprimir</span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
