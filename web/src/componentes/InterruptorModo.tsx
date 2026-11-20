import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Interfaz } from '../interfaz';

const OPCIONES: { valor: Interfaz; etiqueta: string }[] = [{ valor: 'simple', etiqueta: 'Simple' }, { valor: 'pro', etiqueta: 'Pro' }];

// Simple / Pro, siempre a la vista arriba. El mapa, las capas y lo elegido se mantienen al cambiar.
// Carril negro y una pastilla blanca que se desliza hasta la opción elegida (el mismo ritmo de 0,45 s
// que la pastilla de la marca). `compacto`: 48 px de alto, para la barra del profesional; `grande`: 64 px
// y letra de 19 px, en la esquina del simple.
// El simple y el pro lo montan en lugares distintos, así que al cambiar de modo aparece uno nuevo: arranca
// donde estaba la pastilla del anterior (se recuerda acá) y en el cuadro siguiente se desliza a la elegida.
let ultimo: number | null = null;

export default function InterruptorModo({ valor, onCambiar, compacto, grande, className }: { valor: Interfaz; onCambiar: (v: Interfaz) => void; compacto?: boolean; grande?: boolean; className?: string }) {
  const elegido = OPCIONES.findIndex(o => o.valor === valor);
  const [indice, setIndice] = useState(ultimo ?? elegido);
  useEffect(() => {
    ultimo = elegido;
    if (indice === elegido) return;
    const cuadro = requestAnimationFrame(() => requestAnimationFrame(() => setIndice(elegido)));
    return () => cancelAnimationFrame(cuadro);
  }, [elegido, indice]);
  return (
    <div
      role="radiogroup"
      aria-label="Tipo de pantalla"
      className={cn('interruptor-modo panel relative flex shrink-0 rounded-full p-[5px]', compacto ? 'h-12 w-[150px]' : grande ? 'h-[64px] w-[232px] p-[6px]' : 'h-[60px] w-[196px]', className)}
    >
      <span aria-hidden="true" className={cn('interruptor-pastilla absolute rounded-full', grande ? 'inset-y-[6px] left-[6px] w-[calc(50%-6px)]' : 'inset-y-[5px] left-[5px] w-[calc(50%-5px)]')} style={{ translate: `${indice * 100}% 0` }} />
      {OPCIONES.map(opcion => {
        const elegida = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={elegida}
            onClick={() => onCambiar(opcion.valor)}
            className={cn(
              'interruptor-opcion relative flex flex-1 items-center justify-center rounded-full font-semibold focus-visible:outline-2 focus-visible:outline-offset-2',
              compacto ? 'text-[14px]' : grande ? 'text-[19px] font-bold' : 'text-[16px]',
            )}
          >
            {opcion.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
