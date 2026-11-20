import { useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { HERRAMIENTAS, type Modo } from '../../herramientas';
import { RESORTE } from '../../movimiento';
import { ICONOS_HERRAMIENTA } from '../iconos';

const ORDEN: Modo[] = ['navegar', 'punto', 'rectangulo', 'distancia', 'area', 'alta'];

// Los nombres del profesional, con el vocabulario de un SIG: qué operación es y con qué servicio OGC se hace
// (lo que de verdad pide el visor: ver herramientas.ts y obras.ts).
export const TECNICO: Record<Modo, { corto: string; operacion: string; ayuda: string }> = {
  navegar: { corto: 'Pan · Zoom', operacion: 'Desplazar y escalar la vista', ayuda: 'Pan: arrastrá el mapa · Zoom: rueda, pellizco o + / −' },
  punto: { corto: 'Identificar', operacion: 'Identificar entidades · WMS GetFeatureInfo', ayuda: 'Identificar: clic en el mapa · WMS GetFeatureInfo sobre las capas visibles (hasta 10 entidades)' },
  rectangulo: { corto: 'Selección BBOX', operacion: 'Selección espacial · WFS GetFeature con filtro BBOX', ayuda: 'Selección BBOX: arrastrá un rectángulo · WFS 1.1.0 GetFeature con ogc:BBOX en EPSG:3857, a la escala actual' },
  distancia: { corto: 'Longitud', operacion: 'Medir longitud geodésica', ayuda: 'Longitud geodésica: clic en cada vértice · doble clic para terminar' },
  area: { corto: 'Área', operacion: 'Medir área geodésica', ayuda: 'Área geodésica: clic en cada vértice · doble clic para cerrar el polígono' },
  alta: { corto: 'Digitalizar', operacion: 'Alta de entidad · WFS-T Insert en obras_rn11', ayuda: 'Digitalizar: clic sobre la traza · la obra se inserta en tpi:obras_rn11 por WFS-T' },
};

// La ayuda de la herramienta elegida, con lo técnico en negrita.
export function AyudaTecnica({ modo }: { modo: Modo }) {
  const [nombre, ...resto] = TECNICO[modo].ayuda.split(': ');
  return <><strong className="font-semibold text-[var(--tinta)]">{nombre}:</strong> {resto.join(': ')}</>;
}

// Las herramientas del profesional como chips en una fila, arriba del mapa (como los atajos de un mapa web):
// ícono, nombre y la tecla. La elegida se tiñe con el acento, y el tinte se desliza de un chip al otro. Al
// final, separado, lo que se agrega (el botón de la ruta). Si no entran, la fila se desliza de costado, con
// flechas en los bordes y un fundido que avisa que hay más.
export default function Chips({ modo, onModo, extra }: { modo: Modo; onModo: (m: Modo) => void; extra?: React.ReactNode }) {
  const fila = useRef<HTMLDivElement>(null);
  const [bordes, setBordes] = useState({ izq: false, der: false });

  useEffect(() => {
    const el = fila.current;
    if (!el) return;
    const medir = () => setBordes({ izq: el.scrollLeft > 2, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    const o = new ResizeObserver(medir);
    o.observe(el);
    el.addEventListener('scroll', medir, { passive: true });
    medir();
    return () => { o.disconnect(); el.removeEventListener('scroll', medir); };
  }, []);

  // Con el teclado, la herramienta elegida siempre queda a la vista.
  useEffect(() => {
    fila.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [modo]);

  const correr = (sentido: number) => fila.current?.scrollBy({ left: sentido * fila.current.clientWidth * 0.6, behavior: 'smooth' });

  return (
    <div className="chips-pro relative min-w-0" data-izq={bordes.izq || undefined} data-der={bordes.der || undefined}>
      <div ref={fila} role="toolbar" aria-label="Herramientas" className="chips-fila flex items-center gap-2 overflow-x-auto px-1 py-1.5">
        {ORDEN.map(m => {
          const Icono = ICONOS_HERRAMIENTA[m];
          const activo = m === modo;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onModo(m)}
              aria-pressed={activo}
              aria-label={`${TECNICO[m].corto} (${HERRAMIENTAS[m].titulo})`}
              aria-keyshortcuts={HERRAMIENTAS[m].tecla}
              title={`${TECNICO[m].operacion} (${HERRAMIENTAS[m].tecla})`}
              className="chip-pro relative flex h-11 shrink-0 items-center gap-2 rounded-full pl-3.5 pr-4 text-[15px] font-semibold"
              data-activo={activo || undefined}
            >
              {activo && <motion.span layoutId="chip-activo" transition={RESORTE} className="absolute inset-0 rounded-full bg-[var(--acento-suave)]" />}
              <Icono size={19} weight={activo ? 'fill' : 'bold'} className="relative shrink-0" />
              <span className="relative whitespace-nowrap">{TECNICO[m].corto}</span>
              <kbd aria-hidden="true" className="chip-tecla relative">{HERRAMIENTAS[m].tecla}</kbd>
            </button>
          );
        })}
        {extra && <><span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-[var(--linea-fuerte)]" />{extra}</>}
      </div>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => correr(-1)} className="chips-flecha left-0" data-lado="izq"><CaretLeft size={16} weight="bold" /></button>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => correr(1)} className="chips-flecha right-0" data-lado="der"><CaretRight size={16} weight="bold" /></button>
    </div>
  );
}
