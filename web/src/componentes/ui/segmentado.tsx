import { cn } from '@/lib/utils';

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
// La pastilla es una sola y se mueve con translate en CSS (las opciones miden lo mismo): con el `zoom` de
// .interfaz, las animaciones de layout de motion medían en píxeles de pantalla y saltaban al final.
export function Segmentado<T extends string>({ opciones, valor, onCambiar, etiqueta, className }: Props<T>) {
  const elegida = Math.max(0, opciones.findIndex(o => o.valor === valor));
  return (
    <div role="radiogroup" aria-label={etiqueta} className={cn('relative flex rounded-xl bg-[var(--superficie-2)] p-1', className)}>
      <span
        aria-hidden="true"
        className="segmento-pastilla absolute inset-y-1 left-1 rounded-[9px] bg-[var(--superficie)] shadow-[0_1px_2px_rgba(0,0,0,.08),0_2px_8px_-2px_rgba(0,0,0,.12)]"
        style={{ width: `calc((100% - 8px) / ${opciones.length})`, translate: `${elegida * 100}% 0` }}
      />
      {opciones.map(opcion => {
        const esta = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={esta}
            onClick={() => onCambiar(opcion.valor)}
            className={cn(
              'relative flex h-9 flex-1 basis-0 items-center justify-center gap-1.5 rounded-[9px] px-3 text-[14px] font-medium transition-colors duration-200 focus-visible:outline-2',
              esta ? 'text-[var(--tinta)]' : 'text-[var(--tinta-3)] hover:text-[var(--tinta-2)]',
            )}
          >
            <span className="relative flex items-center gap-1.5">{opcion.icono}{opcion.etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}
