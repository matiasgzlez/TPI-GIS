import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HandGrabbing, MapPinPlus, Printer, Question, Ruler, SelectionPlus, SplitHorizontal, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import type { Modo } from '../../herramientas';
import { RESORTE, RESORTE_PANEL } from '../../movimiento';
import { Segmentado } from '../ui/segmentado';
import { HERRAMIENTAS_SIMPLES } from '../../interfaz';
import Notch from './Notch';

// Las herramientas del modo simple como botones grandes con dibujo y una palabra. Mientras una está
// activa, una burbuja dice qué hacer con palabras de todos los días y un botón grande vuelve a "Mover".
// Son las mismas herramientas que el modo profesional (consignas: consulta por punto y rectángulo,
// medición y alta de una obra).
const ACCIONES: { modo: Modo; titulo: string; corto: string; Icono: typeof Question }[] = [
  { modo: 'navegar', Icono: HandGrabbing },
  { modo: 'punto', Icono: Question },
  { modo: 'rectangulo', Icono: SelectionPlus },
  { modo: 'distancia', Icono: Ruler },
  { modo: 'alta', Icono: MapPinPlus },
].map(a => ({ ...a, modo: a.modo as Modo, titulo: a.modo === 'distancia' ? 'Medir' : HERRAMIENTAS_SIMPLES[a.modo as Modo].titulo, corto: HERRAMIENTAS_SIMPLES[a.modo as Modo].corto }));

const PISTAS = Object.fromEntries(Object.entries(HERRAMIENTAS_SIMPLES).map(([m, h]) => [m, h.pista])) as Record<Modo, string>;

// `sinPista`: con el formulario de una obra (o la impresión) abierto, la burbuja no se superpone con él.
// "Imprimir" no es una herramienta del mapa sino una acción: va aparte, después de una línea.
// `enNotch` (escritorio del simple): los botones van adentro de la pastilla "Herramientas" del borde de abajo,
// que se estira hacia arriba con el cursor; cerrada muestra en su círculo blanco la herramienta elegida. La
// burbuja con la pista queda flotando arriba de la pastilla.
export default function Acciones({ modo, onModo, sinPista, imprimiendo, onImprimir, comparando, onComparar, enNotch }: { modo: Modo; onModo: (modo: Modo) => void; sinPista?: boolean; imprimiendo?: boolean; onImprimir?: () => void; comparando?: boolean; onComparar?: () => void; enNotch?: boolean }) {
  const midiendo = modo === 'distancia' || modo === 'area';
  const elegida = ACCIONES.find(a => a.modo === modo || (a.modo === 'distancia' && modo === 'area'));
  const IconoElegido = modo !== 'navegar' && elegida ? elegida.Icono : null;
  // En la pastilla, la burbuja con la pista se muestra unos segundos al elegir la herramienta y se va sola
  // (con el cursor encima espera). Al medir se queda: tiene el selector de distancia o superficie.
  const [pistaVisible, setPistaVisible] = useState(true);
  const [encima, setEncima] = useState(false);
  useEffect(() => { setPistaVisible(true); }, [modo]);
  useEffect(() => {
    if (!enNotch || midiendo || encima || !pistaVisible || modo === 'navegar') return;
    const reloj = setTimeout(() => setPistaVisible(false), 5000);
    return () => clearTimeout(reloj);
  }, [enNotch, midiendo, encima, pistaVisible, modo]);
  // Con "Herramientas" abierta, la burbuja sube por encima del panel (no se le superpone): el alto del panel
  // abierto (la caja del notch ya mide eso) se pasa como --alto-herramientas (ver .acciones-pista en estilos.css).
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const caja = raiz.current?.querySelector<HTMLElement>('.notch-contenedor');
    if (!enNotch || !caja) return;
    const medir = () => raiz.current?.style.setProperty('--alto-herramientas', `${caja.offsetHeight}px`);
    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    return () => observador.disconnect();
  }, [enNotch]);
  return (
    <div ref={raiz} className={enNotch ? 'acciones-notch relative flex flex-col items-center' : 'flex flex-col items-center gap-3'}>
      {/* En la pastilla, la burbuja ya va absoluta: sin popLayout, que al salir la volvía a medir sin contar el zoom
          de la interfaz (88 % en la notebook), la achicaba y el texto saltaba de renglón mientras se iba. */}
      <AnimatePresence mode={enNotch ? 'sync' : 'popLayout'}>
        {modo !== 'navegar' && !sinPista && (!enNotch || pistaVisible || midiendo) && (
          <motion.div
            key="pista"
            role="status"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={RESORTE_PANEL}
            onMouseEnter={() => setEncima(true)}
            onMouseLeave={() => setEncima(false)}
            className={enNotch
              ? 'acciones-pista superficie-notch dark pointer-events-auto absolute bottom-[74px] flex w-max max-w-[min(620px,calc(100cqw-24px))] flex-col gap-3 bg-[var(--notch-fondo)] py-3 pl-6 pr-3 text-[var(--tinta)] shadow-[0_24px_60px_-24px_rgba(0,0,0,.6)]'
              : 'panel flex max-w-[min(560px,calc(100cqw-24px))] flex-col gap-3 px-5 py-4 shadow-[var(--sombra-alta)]'}
          >
            <div className={`flex gap-3 ${enNotch ? 'items-center gap-5' : 'items-start'}`}>
              <p key={modo} className={enNotch ? 'flex-1 text-[19px] font-bold leading-snug tracking-[-0.01em] [text-wrap:balance]' : 'flex-1 text-[17px] font-medium leading-snug'}>{PISTAS[modo]}</p>
              <button
                type="button"
                onClick={() => onModo('navegar')}
                className={enNotch
                  ? 'boton-ajuste flex h-12 shrink-0 items-center gap-2 rounded-full bg-white px-5 text-[16px] font-bold text-[#0b0c0e] focus-visible:outline-2 focus-visible:outline-offset-2'
                  : 'flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-[var(--tinta)] px-4 text-[15px] font-semibold text-[var(--superficie)]'}
              >
                <X size={enNotch ? 18 : 16} weight="bold" /> Listo
              </button>
            </div>
            {midiendo && (
              <Segmentado
                etiqueta="Qué medir"
                valor={modo}
                onCambiar={onModo}
                opciones={[{ valor: 'distancia', etiqueta: 'Qué tan lejos' }, { valor: 'area', etiqueta: 'Qué tan grande' }]}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {enNotch ? (
        <Notch lado="abajo" alto="contenido" etiqueta="Herramientas" id="herramientas-simple" guia="acciones" insignia={IconoElegido && <IconoElegido size={18} weight="fill" />}>
          <Botonera modo={modo} onModo={onModo} imprimiendo={imprimiendo} onImprimir={onImprimir} comparando={comparando} onComparar={onComparar} />
        </Notch>
      ) : botones('panel flex gap-1 p-1.5 shadow-[var(--sombra-alta)]', 'acciones')}
    </div>
  );

  function botones(clase: string, guia?: string) {
    return (
      <nav aria-label="Herramientas" data-guia={guia} className={clase}>
        {ACCIONES.map(({ modo: m, titulo, corto, Icono }) => {
          const activo = m === modo || (m === 'distancia' && modo === 'area');
          return (
            <button
              key={m}
              type="button"
              onClick={() => onModo(m)}
              aria-pressed={activo}
              aria-label={titulo}
              className={`relative flex h-[74px] w-[86px] flex-col items-center justify-center gap-1 rounded-[18px] text-[14px] font-semibold transition-colors duration-200 focus-visible:outline-2 max-sm:w-[64px] max-sm:text-[12.5px] ${
                activo ? 'text-[var(--superficie)]' : 'text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]'
              }`}
            >
              {activo && <motion.span layoutId="accion-activa" transition={RESORTE} className="absolute inset-0 rounded-[18px] bg-[var(--tinta)]" />}
              <Icono size={30} weight={activo ? 'fill' : 'duotone'} className="relative" />
              <span className="relative">{corto}</span>
            </button>
          );
        })}
        {(onImprimir || onComparar) && <span className="mx-1 my-3 w-px bg-[var(--linea)]" aria-hidden="true" />}
        {/* Comparar (T6): la cortina que muestra dos cosas distintas, una de cada lado. */}
        {onComparar && (
          <button
            type="button"
            onClick={onComparar}
            aria-pressed={!!comparando}
            aria-label="Comparar dos mapas"
            className={`relative flex h-[74px] w-[86px] flex-col items-center justify-center gap-1 rounded-[18px] text-[14px] font-semibold transition-colors duration-200 focus-visible:outline-2 max-sm:w-[64px] max-sm:text-[12.5px] ${
              comparando ? 'bg-[var(--tinta)] text-[var(--superficie)]' : 'text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]'
            }`}
          >
            <SplitHorizontal size={30} weight={comparando ? 'fill' : 'duotone'} className="relative" />
            <span className="relative">Comparar</span>
          </button>
        )}
        {onImprimir && (
          <>
            <button
              type="button"
              onClick={onImprimir}
              aria-pressed={!!imprimiendo}
              aria-label="Imprimir el mapa"
              className={`relative flex h-[74px] w-[86px] flex-col items-center justify-center gap-1 rounded-[18px] text-[14px] font-semibold transition-colors duration-200 focus-visible:outline-2 max-sm:w-[64px] max-sm:text-[12.5px] ${
                imprimiendo ? 'bg-[var(--vial-fuerte)] text-white' : 'text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]'
              }`}
            >
              <Printer size={30} weight={imprimiendo ? 'fill' : 'duotone'} className="relative" />
              <span className="relative">Imprimir</span>
            </button>
          </>
        )}
      </nav>
    );
  }
}

// Los botones dentro de la pastilla "Herramientas" (escritorio del simple), grandes y con palabras en negrita.
// La elegida lleva una pastilla blanca que se desliza de una herramienta a la otra, y al pasar el cursor un
// resaltado gris lo sigue de botón en botón. Las dos son un solo elemento que se mueve con translate en CSS,
// medido con offsetLeft (en píxeles de la interfaz: el `zoom` de .interfaz no lo afecta, como sí le pasaba
// al layoutId de motion, que medía en píxeles de pantalla y daba un salto al final).
function Botonera({ modo, onModo, imprimiendo, onImprimir, comparando, onComparar }: { modo: Modo; onModo: (modo: Modo) => void; imprimiendo?: boolean; onImprimir?: () => void; comparando?: boolean; onComparar?: () => void }) {
  const nav = useRef<HTMLElement>(null);
  const pastilla = useRef<HTMLSpanElement>(null);
  const brillo = useRef<HTMLSpanElement>(null);
  const elegida = modo === 'area' ? 'distancia' : modo;

  useLayoutEffect(() => {
    const ubicar = () => {
      const boton = nav.current?.querySelector<HTMLElement>(`[data-herramienta="${elegida}"]`);
      if (!boton || !pastilla.current) return;
      pastilla.current.style.translate = `${boton.offsetLeft}px ${boton.offsetTop}px`;
      pastilla.current.style.width = `${boton.offsetWidth}px`;
      pastilla.current.style.height = `${boton.offsetHeight}px`;
    };
    ubicar();
    // La primera vez, sin viaje: aparece ya en su lugar.
    requestAnimationFrame(() => pastilla.current?.setAttribute('data-lista', ''));
    const observador = new ResizeObserver(ubicar);
    if (nav.current) observador.observe(nav.current);
    return () => observador.disconnect();
  }, [elegida]);

  const apuntar = (e: React.PointerEvent) => {
    const boton = (e.target as HTMLElement).closest('button');
    const b = brillo.current;
    if (!boton || !b || !nav.current?.contains(boton)) return;
    const visible = b.hasAttribute('data-visible');
    // Si venía de afuera, aparece en el botón (sin deslizarse desde el último lugar).
    if (!visible) b.removeAttribute('data-viaja');
    b.style.translate = `${boton.offsetLeft}px ${boton.offsetTop}px`;
    b.style.width = `${boton.offsetWidth}px`;
    b.style.height = `${boton.offsetHeight}px`;
    b.setAttribute('data-visible', '');
    if (!visible) requestAnimationFrame(() => b.setAttribute('data-viaja', ''));
  };
  const salir = () => brillo.current?.removeAttribute('data-visible');

  const clase = (activo: boolean, acento?: boolean) =>
    `herramienta relative z-[1] flex h-[88px] w-[100px] flex-col items-center justify-center gap-1.5 rounded-[20px] text-[16px] font-bold tracking-[-0.005em] focus-visible:outline-2 ${
      activo ? (acento ? 'text-white' : 'text-[#0b0c0e]') : 'text-[var(--tinta-2)] hover:text-[var(--tinta)]'
    }`;

  return (
    <nav ref={nav} aria-label="Herramientas" className="relative flex gap-1 p-2.5" onPointerOver={apuntar} onPointerLeave={salir}>
      <span ref={brillo} aria-hidden="true" className="herramienta-brillo absolute left-0 top-0 rounded-[20px]" />
      <span ref={pastilla} aria-hidden="true" className="herramienta-pastilla absolute left-0 top-0 rounded-[20px]" />
      {ACCIONES.map(({ modo: m, titulo, corto, Icono }) => {
        const activo = m === elegida;
        return (
          <button key={m} type="button" data-herramienta={m} onClick={() => onModo(m)} aria-pressed={activo} aria-label={titulo} className={clase(activo)}>
            <Icono size={34} weight={activo ? 'fill' : 'duotone'} className="herramienta-icono" />
            <span>{corto}</span>
          </button>
        );
      })}
      {(onImprimir || onComparar) && <span className="relative z-[1] mx-1.5 my-4 w-px bg-[var(--linea)]" aria-hidden="true" />}
      {onComparar && (
        <button type="button" onClick={onComparar} aria-pressed={!!comparando} aria-label="Comparar dos mapas" className={`${clase(!!comparando)} ${comparando ? 'bg-white' : ''}`}>
          <SplitHorizontal size={34} weight={comparando ? 'fill' : 'duotone'} className="herramienta-icono" />
          <span>Comparar</span>
        </button>
      )}
      {onImprimir && (
        <button type="button" onClick={onImprimir} aria-pressed={!!imprimiendo} aria-label="Imprimir el mapa" className={`${clase(!!imprimiendo, true)} ${imprimiendo ? 'bg-[var(--vial-fuerte)]' : ''}`}>
          <Printer size={34} weight={imprimiendo ? 'fill' : 'duotone'} className="herramienta-icono" />
          <span>Imprimir</span>
        </button>
      )}
    </nav>
  );
}
