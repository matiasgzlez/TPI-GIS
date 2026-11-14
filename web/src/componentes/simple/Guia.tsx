import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { RESORTE_PANEL } from '../../movimiento';

// Guía de primeros pasos del modo simple: tres burbujas que iluminan dónde tocar. Aparece la primera vez
// y se repite desde el botón de ayuda. Cada paso apunta a un elemento con data-guia="…".
const PASOS = [
  { destino: 'buscar', titulo: 'Buscá lo que quieras', texto: 'Escribí un pueblo, "escuelas" o una pregunta como "¿cuánta gente vive cerca de la ruta 11?".' },
  { destino: 'temas', titulo: 'Elegí qué ver', texto: 'Tocá un tema, como Agua o Escuelas, y después lo que quieras mostrar en el mapa.' },
  { destino: 'acciones', titulo: 'Tocá un botón', texto: 'Para saber qué hay en un lugar, medir o agregar una obra en la ruta.' },
] as const;

export default function Guia({ onTerminar }: { onTerminar: () => void }) {
  const [paso, setPaso] = useState(0);
  const [caja, setCaja] = useState<DOMRect | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const actual = PASOS[paso];

  // La guía crece con la interfaz (.pantalla-escalada): todo se calcula en sus píxeles, que son los de
  // la pantalla divididos por el zoom.
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const medir = () => {
      const z = raiz.current?.currentCSSZoom || 1;
      setZoom(z);
      const r = document.querySelector(`[data-guia="${actual.destino}"]`)?.getBoundingClientRect();
      setCaja(r ? new DOMRect(r.left / z, r.top / z, r.width / z, r.height / z) : null);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [actual.destino]);
  useEffect(() => boton.current?.focus(), [paso]);
  // Al cerrarse, el foco vuelve a donde estaba. Al abrirse, el resto queda inert y el botón de ayuda ya
  // perdió el foco: se vuelve a él (y si no está, la primera vez, al buscador).
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    return () => {
      const destino = previo && previo !== document.body && previo.isConnected ? previo
        : document.querySelector<HTMLElement>('[aria-label="Ayuda: cómo se usa"]') ?? document.querySelector<HTMLElement>('[data-guia="buscar"] input');
      requestAnimationFrame(() => destino?.focus());
    };
  }, []);
  // Un solo oyente, en captura y con la última onTerminar en un ref: si dependía de onTerminar (nueva en
  // cada render de App), un render a mitad del evento lo quitaba y el Escape no cerraba la guía.
  const terminar = useRef(onTerminar);
  terminar.current = onTerminar;
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      // La guía es modal: ninguna tecla llega al visor de atrás (ni Escape, ni los atajos 1–6).
      e.stopPropagation();
      if (e.key === 'Escape') terminar.current();
      // El Tab no sale de la burbuja: con el resto inert, el navegador pasaba por el body.
      if (e.key === 'Tab' && raiz.current) {
        const botones = [...raiz.current.querySelectorAll<HTMLElement>('button')];
        if (!botones.length) return;
        const i = botones.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        botones[(i + (e.shiftKey ? -1 : 1) + botones.length) % botones.length].focus();
      }
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  }, []);

  const margen = 8;
  const anchoVentana = window.innerWidth / zoom;
  const altoVentana = window.innerHeight / zoom;
  const ancho = Math.min(340, anchoVentana - 24);
  // Arriba o abajo del elemento, donde haya lugar; si es muy alto (el panel de temas), al costado.
  const alto = caja && caja.height > altoVentana * 0.5 && caja.right + ancho + 32 < anchoVentana;
  const arriba = !alto && caja && caja.top > altoVentana / 2;
  const izquierda = !caja ? 12
    : alto ? caja.right + margen + 16
      : Math.min(Math.max(12, caja.left + caja.width / 2 - ancho / 2), anchoVentana - ancho - 12);

  return (
    <div ref={raiz} className="pantalla-escalada fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="guia-titulo">
      {/* El resto de la pantalla se oscurece (una máscara con el hueco del elemento) y el elemento del
          paso queda iluminado, con un borde vial. */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id="guia-hueco">
            <rect width="100%" height="100%" fill="white" />
            {caja && (
              <motion.rect
                rx="22"
                fill="black"
                initial={false}
                animate={{ x: caja.left - margen, y: caja.top - margen, width: caja.width + margen * 2, height: caja.height + margen * 2 }}
                transition={RESORTE_PANEL}
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(10,12,14,.58)" mask="url(#guia-hueco)" />
        {caja && (
          <motion.rect
            rx="22"
            fill="none"
            stroke="var(--vial)"
            strokeWidth="3"
            initial={false}
            animate={{ x: caja.left - margen, y: caja.top - margen, width: caja.width + margen * 2, height: caja.height + margen * 2 }}
            transition={RESORTE_PANEL}
          />
        )}
      </svg>
      <motion.div
        key={paso}
        initial={{ opacity: 0, y: arriba ? 10 : -10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={RESORTE_PANEL}
        className="absolute rounded-[22px] bg-[var(--superficie)] p-5 shadow-[var(--sombra-alta)]"
        style={{
          width: ancho,
          left: izquierda,
          ...(!caja ? { top: '40%' }
            : alto ? { top: caja.top + 40 }
              : arriba ? { bottom: altoVentana - caja.top + margen + 14 } : { top: caja.bottom + margen + 14 }),
        }}
      >
        <p className="text-[13px] font-semibold text-[var(--vial-texto)]">Paso {paso + 1} de {PASOS.length}</p>
        <h2 id="guia-titulo" className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em]">{actual.titulo}</h2>
        <p className="mt-2 text-[16px] leading-snug text-[var(--tinta-2)]">{actual.texto}</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 gap-1.5" aria-hidden="true">
            {PASOS.map((_, i) => <span key={i} className={`h-2 rounded-full transition-all duration-300 ${i === paso ? 'w-6 bg-[var(--tinta)]' : 'w-2 bg-[var(--superficie-3)]'}`} />)}
          </div>
          <button type="button" onClick={onTerminar} className="h-11 rounded-full px-4 text-[15px] font-medium text-[var(--tinta-2)] hover:bg-[var(--superficie-2)]">Saltear</button>
          <button
            ref={boton}
            type="button"
            onClick={() => (paso < PASOS.length - 1 ? setPaso(paso + 1) : onTerminar())}
            className="h-11 rounded-full bg-[var(--tinta)] px-5 text-[15px] font-semibold text-[var(--superficie)] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {paso < PASOS.length - 1 ? 'Siguiente' : '¡Listo!'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
