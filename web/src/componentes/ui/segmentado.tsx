import { useId } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { RESORTE } from '../../movimiento';

export interface OpcionSegmentada<T extends string> {
  valor: T;
  etiqueta: string;
  icono?: React.ReactNode;
}

interface Props<T extends string> {
  opciones: OpcionSegmentada<T>[];
  valor: T;
  onCambiar: (valor: T) => void;
  etiqueta: string;
  className?: string;
}

// Control segmentado al estilo iOS: la opción elegida se marca con una pastilla que se desliza.
export function Segmentado<T extends string>({ opciones, valor, onCambiar, etiqueta, className }: Props<T>) {
  const grupo = useId();
  return (
    <div role="radiogroup" aria-label={etiqueta} className={cn('flex rounded-xl bg-[var(--superficie-2)] p-1', className)}>
      {opciones.map(opcion => {
        const elegida = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={elegida}
            onClick={() => onCambiar(opcion.valor)}
            className={cn(
              'relative flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 text-[14px] font-medium transition-colors duration-200 focus-visible:outline-2',
              elegida ? 'text-[var(--tinta)]' : 'text-[var(--tinta-3)] hover:text-[var(--tinta-2)]',
            )}
          >
            {elegida && (
              <motion.span
                layoutId={`segmento-${grupo}`}
                transition={RESORTE}
                className="absolute inset-0 rounded-[9px] bg-[var(--superficie)] shadow-[0_1px_2px_rgba(0,0,0,.08),0_2px_8px_-2px_rgba(0,0,0,.12)]"
              />
            )}
            <span className="relative flex items-center gap-1.5">{opcion.icono}{opcion.etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}
