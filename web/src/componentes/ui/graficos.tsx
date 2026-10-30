import { useEffect, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { RESORTE_SUAVE } from '../../movimiento';

const formatoAR = (n: number, decimales = 0) => n.toLocaleString('es-AR', { maximumFractionDigits: decimales, minimumFractionDigits: decimales });

// Un número que cuenta hasta su valor al aparecer y cuando cambia.
export function NumeroAnimado({ valor, decimales = 0, className }: { valor: number; decimales?: number; className?: string }) {
  const reducido = useReducedMotion();
  const actual = useMotionValue(reducido ? valor : 0);
  const texto = useTransform(actual, v => formatoAR(v, decimales));
  useEffect(() => {
    if (reducido) {
      actual.set(valor);
      return;
    }
    const control = animate(actual, valor, { type: 'spring', stiffness: 90, damping: 22, restDelta: 0.5 });
    return () => control.stop();
  }, [valor, reducido, actual]);
  return <motion.span className={className}>{texto}</motion.span>;
}

export interface DatoBarra {
  id: string;
  etiqueta: string;
  valor: number;
  detalle?: string;
  color?: string;
}

interface PropsBarras {
  datos: DatoBarra[];
  unidad?: string;
  // Al pasar el mouse por una barra (para resaltar lo mismo en el mapa).
  onApuntar?: (dato: DatoBarra | null) => void;
}

// Barras horizontales de una sola serie: el valor siempre a la vista, el porcentaje al pasar el mouse.
export function Barras({ datos, unidad, onApuntar }: PropsBarras) {
  const [apuntada, setApuntada] = useState<string | null>(null);
  const maximo = Math.max(...datos.map(d => d.valor), 1);
  const total = datos.reduce((s, d) => s + d.valor, 0) || 1;
  return (
    <ul className="flex flex-col gap-3" onMouseLeave={() => { setApuntada(null); onApuntar?.(null); }}>
      {datos.map((dato, i) => {
        const activa = apuntada === dato.id;
        return (
          <li
            key={dato.id}
            onMouseEnter={() => { setApuntada(dato.id); onApuntar?.(dato); }}
            className={`-mx-2 rounded-lg px-2 py-1 transition-colors ${activa ? 'bg-[var(--superficie-2)]' : ''}`}
          >
            <div className="flex items-baseline justify-between gap-3 text-[14px]">
              <span className="min-w-0 truncate font-medium">{dato.etiqueta}</span>
              <span className="shrink-0 font-semibold">
                {activa && <span className="mr-1.5 font-medium text-[var(--tinta-3)]">{formatoAR((dato.valor / total) * 100)} %</span>}
                {formatoAR(dato.valor)}{unidad ? ` ${unidad}` : ''}
              </span>
            </div>
            {dato.detalle && <div className="text-[12px] text-[var(--tinta-3)]">{dato.detalle}</div>}
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--dato-pista)]">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: dato.color ?? 'var(--dato-1)' }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max((dato.valor / maximo) * 100, dato.valor ? 1.5 : 0)}%` }}
                transition={{ ...RESORTE_SUAVE, delay: i * 0.04 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface SegmentoDona {
  id: string;
  etiqueta: string;
  valor: number;
  color: string;
}

// Dona de pocas partes (hasta 4). En el centro, el total o lo que se le pase.
export function Dona({ segmentos, centro, detalle, tamano = 132 }: { segmentos: SegmentoDona[]; centro: React.ReactNode; detalle?: string; tamano?: number }) {
  const total = segmentos.reduce((s, d) => s + d.valor, 0) || 1;
  const radio = 42;
  const vuelta = 2 * Math.PI * radio;
  const separacion = segmentos.filter(s => s.valor > 0).length > 1 ? 2.5 : 0;
  let acumulado = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={radio} fill="none" stroke="var(--dato-pista)" strokeWidth="11" />
          {segmentos.map((s, i) => {
            const largo = (s.valor / total) * vuelta;
            const inicio = acumulado;
            acumulado += largo;
            if (!s.valor) return null;
            return (
              <motion.circle
                key={s.id}
                cx="50" cy="50" r={radio} fill="none" stroke={s.color} strokeWidth="11" strokeLinecap="butt"
                strokeDasharray={`${Math.max(largo - separacion, 0.5)} ${vuelta}`}
                initial={{ strokeDashoffset: -inicio + largo }}
                animate={{ strokeDashoffset: -inicio }}
                transition={{ ...RESORTE_SUAVE, delay: 0.1 + i * 0.08 }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[22px] font-semibold leading-none tracking-[-0.02em]">{centro}</div>
          {detalle && <div className="mt-1 text-[12px] text-[var(--tinta-3)]">{detalle}</div>}
        </div>
      </div>
      <ul className="flex min-w-0 flex-col gap-2.5">
        {segmentos.map(s => (
          <li key={s.id} className="flex items-start gap-2.5 text-[14px]">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="min-w-0">
              <span className="block font-medium leading-snug">{s.etiqueta}</span>
              <span className="text-[13px] text-[var(--tinta-3)]">{formatoAR(s.valor)} · {formatoAR((s.valor / total) * 100)} %</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
