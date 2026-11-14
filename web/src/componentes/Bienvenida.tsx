import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { Interfaz } from '../interfaz';
import { RESORTE_PANEL } from '../movimiento';
import { GlowingEffect } from './ui/glowing-effect';

// Primera vez que se abre el visor: elegir entre el modo simple y el profesional. Las dos tarjetas son
// botones grandes; el mapa se ve detrás, ya cargado. La elección se recuerda y se cambia en cualquier
// momento con el interruptor Simple / Pro.
export default function Bienvenida({ onElegir }: { onElegir: (interfaz: Interfaz) => void }) {
  const primera = useRef<HTMLButtonElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => primera.current?.focus(), []);
  // El Tab no sale del diálogo: con el resto inert, el navegador pasaba por el body.
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !raiz.current) return;
      const botones = [...raiz.current.querySelectorAll<HTMLElement>('button')];
      if (!botones.length) return;
      const i = botones.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      botones[(i + (e.shiftKey ? -1 : 1) + botones.length) % botones.length].focus();
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  }, []);

  return (
    <motion.div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bienvenida-titulo"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[color-mix(in_srgb,var(--papel)_62%,transparent)] p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <motion.div
        className="escalado w-full max-w-[880px] py-6"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={RESORTE_PANEL}
      >
        <p className="text-center text-[14px] font-semibold tracking-[0.08em] text-[var(--vial-texto)]">MAPA DEL CHACO · RUTA NACIONAL 11</p>
        <h1 id="bienvenida-titulo" className="mt-2 text-balance text-center text-[clamp(30px,5vw,46px)] font-semibold leading-[1.05] tracking-[-0.035em]">
          ¿Cómo querés usar el mapa?
        </h1>
        <p className="mx-auto mt-3 max-w-[520px] text-balance text-center text-[17px] leading-snug text-[var(--tinta-2)]">
          Los dos hacen todo lo mismo. Cambia cuánto se ve en la pantalla.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Tarjeta
            referencia={primera}
            titulo="Simple"
            frase="Para mirar y descubrir. Botones grandes, dibujos y palabras de todos los días."
            pista="Ideal para empezar"
            dibujo={<DibujoSimple />}
            onElegir={() => onElegir('simple')}
            demora={0.08}
          />
          <Tarjeta
            titulo="Profesional"
            frase="Todas las herramientas a la vista: capas, atributos, leyendas, mediciones y consultas."
            pista="Para trabajar con los datos"
            dibujo={<DibujoPro />}
            onElegir={() => onElegir('pro')}
            demora={0.16}
          />
        </div>
        <p className="mt-6 text-center text-[14px] text-[var(--tinta-3)]">Podés cambiarlo cuando quieras con el botón Simple / Pro de arriba.</p>
      </motion.div>
    </motion.div>
  );
}

function Tarjeta({ titulo, frase, pista, dibujo, onElegir, demora, referencia }: {
  titulo: string; frase: string; pista: string; dibujo: React.ReactNode; onElegir: () => void; demora: number;
  referencia?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <motion.button
      ref={referencia}
      type="button"
      onClick={onElegir}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...RESORTE_PANEL, delay: demora }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      className="group relative flex flex-col overflow-hidden rounded-[28px] bg-[var(--superficie)] p-2 text-left shadow-[var(--sombra-alta)] focus-visible:outline-3 focus-visible:outline-offset-4"
    >
      <GlowingEffect variant="vial" spread={40} proximity={80} inactiveZone={0.2} borderWidth={2} glow disabled={false} />
      <div className="relative grid aspect-[16/10] place-items-center overflow-hidden rounded-[22px] bg-[var(--superficie-2)]">{dibujo}</div>
      <div className="relative px-4 pb-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[26px] font-semibold tracking-[-0.03em]">{titulo}</span>
          <span className="rounded-full bg-[var(--vial-suave)] px-3 py-1 text-[13px] font-semibold text-[var(--vial-texto)]">{pista}</span>
        </div>
        <p className="mt-2 text-[16px] leading-snug text-[var(--tinta-2)]">{frase}</p>
        <span className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-[var(--tinta)] text-[16px] font-semibold text-[var(--superficie)] transition-transform duration-300 ease-[var(--ios)] group-hover:scale-[1.02]">
          Usar {titulo.toLowerCase()}
        </span>
      </div>
    </motion.button>
  );
}

// Dibujo del modo simple: un mapa amable con un pin grande y tres botones redondos.
function DibujoSimple() {
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full" aria-hidden="true">
      <rect width="320" height="200" fill="var(--superficie-2)" />
      <path d="M0 140c40-20 70-6 110-26s70-48 120-40 70 20 90 14v112H0z" fill="var(--tema-naturaleza)" opacity=".16" />
      <path d="M-10 70c50 10 80 40 130 36s90-50 130-44 60 26 80 30" fill="none" stroke="var(--tema-agua)" strokeWidth="7" strokeLinecap="round" opacity=".55" />
      <path d="M60 210 150 96l40-60" fill="none" stroke="var(--vial)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <motion.g initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.35 }}>
        <path d="M168 44c-14 0-25 11-25 25 0 19 25 43 25 43s25-24 25-43c0-14-11-25-25-25z" fill="var(--tinta)" />
        <circle cx="168" cy="69" r="9" fill="var(--superficie)" />
      </motion.g>
      {[0, 1, 2].map(i => (
        <g key={i} transform={`translate(${96 + i * 64} 158)`}>
          <circle r="20" fill="var(--superficie)" stroke="var(--linea)" strokeWidth="2" />
          <circle r="7" fill={['var(--tema-agua)', 'var(--tema-pueblos)', 'var(--tema-servicios)'][i]} />
        </g>
      ))}
    </svg>
  );
}

// Dibujo del modo profesional: tres zonas (capas, mapa, inspector) y una tabla abajo.
function DibujoPro() {
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full" aria-hidden="true">
      <rect width="320" height="200" fill="var(--superficie-2)" />
      <rect x="14" y="16" width="70" height="168" rx="10" fill="var(--superficie)" />
      {[0, 1, 2, 3, 4, 5].map(i => (
        <g key={i} transform={`translate(24 ${30 + i * 24})`}>
          <rect width="16" height="12" rx="3" fill="var(--superficie-3)" />
          <rect x="22" y="3" width={30 - (i % 3) * 6} height="6" rx="3" fill="var(--tinta-3)" opacity=".5" />
        </g>
      ))}
      <rect x="92" y="16" width="146" height="120" rx="10" fill="var(--papel)" />
      <path d="M100 118c20-30 40-20 60-40s40-30 70-24" fill="none" stroke="var(--tema-agua)" strokeWidth="3" opacity=".6" />
      <path d="M110 136 170 60l30-36" fill="none" stroke="var(--vial)" strokeWidth="4" strokeLinecap="round" />
      <rect x="92" y="144" width="146" height="40" rx="10" fill="var(--superficie)" />
      {[0, 1, 2].map(i => <rect key={i} x="102" y={153 + i * 9} width="126" height="4" rx="2" fill="var(--superficie-3)" />)}
      <rect x="246" y="16" width="60" height="168" rx="10" fill="var(--superficie)" />
      <rect x="254" y="28" width="44" height="26" rx="6" fill="var(--vial-suave)" />
      {[0, 1, 2, 3].map(i => <rect key={i} x="254" y={66 + i * 14} width={40 - i * 5} height="5" rx="2.5" fill="var(--tinta-3)" opacity=".45" />)}
    </svg>
  );
}
