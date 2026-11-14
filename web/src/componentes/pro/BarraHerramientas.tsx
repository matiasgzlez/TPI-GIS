import { motion } from 'motion/react';
import { HERRAMIENTAS, type Modo } from '../../herramientas';
import { RESORTE } from '../../movimiento';
import { ICONOS_HERRAMIENTA } from '../iconos';

// Familias: navegar | consultar | medir | editar.
const FAMILIAS: Modo[][] = [['navegar'], ['punto', 'rectangulo'], ['distancia', 'area'], ['alta']];

// Barra de herramientas del modo profesional, arriba como en un SIG de escritorio: ícono, nombre y la
// tecla de atajo; la activa se marca con una pastilla que se desliza. Abajo, qué hacer con ella.
export default function BarraHerramientas({ modo, onModo }: { modo: Modo; onModo: (modo: Modo) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div role="toolbar" aria-label="Herramientas" className="panel flex items-center gap-0.5 p-1">
        {FAMILIAS.map((familia, i) => (
          <div key={i} className={`flex gap-0.5 ${i ? 'border-l border-[var(--linea)] pl-0.5 ml-0.5' : ''}`}>
            {familia.map(m => {
              const Icono = ICONOS_HERRAMIENTA[m];
              const activo = m === modo;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onModo(m)}
                  aria-pressed={activo}
                  aria-label={HERRAMIENTAS[m].titulo}
                  aria-keyshortcuts={HERRAMIENTAS[m].tecla}
                  title={`${HERRAMIENTAS[m].titulo} (${HERRAMIENTAS[m].tecla})`}
                  className={`relative flex h-10 items-center gap-1.5 rounded-[10px] px-2.5 text-[13.5px] font-medium transition-colors focus-visible:outline-2 ${
                    activo ? 'text-[var(--superficie)]' : 'text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]'
                  }`}
                >
                  {activo && <motion.span layoutId="herramienta-pro" transition={RESORTE} className="absolute inset-0 rounded-[10px] bg-[var(--tinta)]" />}
                  <Icono size={18} weight={activo ? 'fill' : 'regular'} className="relative" />
                  {/* Consultas de contenedor (el espacio útil después del zoom de la interfaz, no el ancho de la
                      pantalla): nombres desde 1780 px útiles y teclas entre 1400 y 1780 (con el nombre, la tecla queda en el title y en aria-keyshortcuts). A 1536 px de notebook (1745 útiles)
                      los nombres achicaban el buscador a 117 px; en la tele (2560 / 1,41 = 1818 útiles) se ven. */}
                  <span className="relative hidden @min-[1780px]:inline">{HERRAMIENTAS[m].corto}</span>
                  <kbd aria-hidden="true" className={`relative hidden text-[11px] font-medium @min-[1400px]:inline @min-[1780px]:hidden ${activo ? 'text-[var(--superficie)]/60' : 'text-[var(--tinta-3)]'}`}>{HERRAMIENTAS[m].tecla}</kbd>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
