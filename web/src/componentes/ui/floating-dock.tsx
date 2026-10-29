/**
 * Floating Dock de Aceternity UI (https://ui.aceternity.com/components/floating-dock),
 * adaptado al visor: botones de herramienta con ícono y nombre siempre visibles, estado activo,
 * separadores entre familias y atajo de teclado. La magnificación del original (que cambia el ancho)
 * pasa a ser una escala sutil, para que los nombres no salten.
 */
import { cn } from "@/lib/utils";
import { type MotionValue, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useRef } from "react";

export interface ItemDock {
  id: string;
  title: string;
  icon: (activo: boolean) => React.ReactNode;
  tecla?: string;
  activo?: boolean;
  separadoAntes?: boolean;
  onClick: () => void;
}

export const FloatingDock = ({ items, className }: { items: ItemDock[]; className?: string }) => {
  const mouseX = useMotionValue(Infinity);
  return (
    <motion.div
      role="toolbar"
      aria-label="Herramientas"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn("flex items-center gap-1 p-2", className)}
    >
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-1">
          {item.separadoAntes && <span className="mx-1.5 h-10 w-px bg-[var(--linea)]" aria-hidden="true" />}
          <IconContainer mouseX={mouseX} item={item} />
        </div>
      ))}
    </motion.div>
  );
};

function IconContainer({ mouseX, item }: { mouseX: MotionValue<number>; item: ItemDock }) {
  const ref = useRef<HTMLButtonElement>(null);
  const reducido = useReducedMotion();

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });
  const escalaObjetivo = useTransform(distance, [-140, 0, 140], [1, reducido ? 1 : 1.07, 1]);
  const escala = useSpring(escalaObjetivo, { mass: 0.1, stiffness: 190, damping: 14 });

  return (
    <motion.button
      ref={ref}
      type="button"
      aria-pressed={item.activo}
      aria-keyshortcuts={item.tecla}
      title={item.tecla ? `${item.title} (${item.tecla})` : item.title}
      onClick={item.onClick}
      style={{ scale: escala }}
      className={cn(
        "relative flex h-[66px] w-[84px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[14px] max-xl:w-[66px] max-xl:[&>span:last-child]:text-[12px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2",
        item.activo
          ? "bg-[var(--tinta)] text-[var(--superficie)]"
          : "text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]",
      )}
    >
      <span className="flex size-6 items-center justify-center [&>svg]:size-full">{item.icon(!!item.activo)}</span>
      <span className="text-[13px] font-medium leading-none">{item.title}</span>
    </motion.button>
  );
}
