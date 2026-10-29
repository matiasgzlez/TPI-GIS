import { useEffect, useRef, useState } from 'react';
import { ScaleLine } from 'ol/control';
import { unByKey } from 'ol/Observable';
import { denominadorEscala, formatoCoordenada, type Visor } from '../visor';

// Escala gráfica (ScaleLine de OpenLayers), denominador 1:N y coordenadas bajo el cursor.
// Las coordenadas se escriben directo en el DOM: mover el mouse no re-renderiza React.
export default function BarraEstado({ visor }: { visor: Visor }) {
  const contenedorEscala = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const [escala, setEscala] = useState(0);

  useEffect(() => {
    const control = new ScaleLine({ target: contenedorEscala.current!, units: 'metric', minWidth: 80, maxWidth: 130 });
    visor.mapa.addControl(control);
    const actualizar = () => setEscala(denominadorEscala(visor.mapa));
    actualizar();
    const claves = [
      visor.mapa.getView().on('change:resolution', actualizar),
      visor.mapa.on('pointermove', e => {
        if (cursor.current) cursor.current.textContent = formatoCoordenada(e.coordinate);
      }),
    ];
    const salir = () => {
      if (cursor.current) cursor.current.textContent = 'Mové el cursor sobre el mapa';
    };
    visor.mapa.getViewport()!.addEventListener('pointerleave', salir);
    return () => {
      visor.mapa.removeControl(control);
      unByKey(claves);
      visor.mapa.getViewport()!.removeEventListener('pointerleave', salir);
    };
  }, [visor]);

  return (
    <div className="panel flex flex-col gap-2.5 px-5 py-3.5">
      <div className="flex items-end justify-between gap-4">
        <div className="escala min-w-[80px]" ref={contenedorEscala} />
        <div className="text-right">
          <div className="text-[12px] font-medium text-[var(--tinta-3)]">Escala</div>
          <div className="text-[15px] font-semibold">1:{escala.toLocaleString('es-AR')}</div>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-[var(--linea)] pt-2.5">
        <span className="text-[12px] font-medium text-[var(--tinta-3)]">WGS 84</span>
        <span ref={cursor} className="truncate text-[13px] font-medium text-[var(--tinta-2)]">Mové el cursor sobre el mapa</span>
      </div>
    </div>
  );
}
