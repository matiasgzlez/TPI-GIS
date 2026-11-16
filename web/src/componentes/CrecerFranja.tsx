// Animación de distancia (T5): la franja alrededor de la ruta crece de 0 a 20 km y un contador suma, en
// vivo, las localidades y los habitantes que va alcanzando. Son los mismos datos del tablero (distancia
// geodésica de cada localidad a la traza): a los 20 km, los totales son exactamente los del tablero.
//
// Va sobre el mapa, arriba al centro. La pista de 0 a 20 km tiene cada localidad en su distancia (más
// grande, más habitantes), que se enciende cuando la franja la alcanza; se puede recorrer a mano con el
// deslizador. Con movimiento reducido no hay barrido: va directo a los 20 km.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ArrowCounterClockwise, Pause, Play, X } from '@phosphor-icons/react';
import { buffer } from 'ol/extent';
import type { AnalisisRuta } from '../analisisRuta';
import { RADIOS } from '../analisisRuta';
import { alTerminarAnimacion, ponerRadioAnimado, volarA, type Visor } from '../visor';
import { movimientoReducido } from '../preferencias';
import { escribiendoEn, hayDialogoModal, useInterfaz } from '../interfaz';
import { RESORTE_PANEL } from '../movimiento';

const TOPE = RADIOS.franja2;
const DURACION = 7000; // ms de 0 a 20 km
const km = (m: number) => (m / 1000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n = (v: number) => v.toLocaleString('es-AR');

export function contarHasta(analisis: AnalisisRuta, metros: number) {
  const dentro = analisis.localidades.filter(l => l.distancia <= metros);
  const de = (franja: 1 | 2) => dentro.filter(l => l.franja === franja);
  const suma = (ls: typeof dentro) => ls.reduce((s, l) => s + l.habitantes, 0);
  return {
    localidades: dentro.length, habitantes: suma(dentro),
    franja1: { localidades: de(1).length, habitantes: suma(de(1)) },
    franja2: { localidades: de(2).length, habitantes: suma(de(2)) },
  };
}

export default function CrecerFranja({ visor, analisis, onCerrar }: { visor: Visor; analisis: AnalisisRuta; onCerrar: () => void }) {
  const simple = useInterfaz() === 'simple';
  const [metros, setMetros] = useState(() => (movimientoReducido() ? TOPE : 0));
  const [reproduciendo, setReproduciendo] = useState(() => !movimientoReducido());
  const cuadro = useRef(0);
  // La distancia del último cuadro (el estado puede estar un render atrás cuando se pausa).
  const actual = useRef(0);
  const inicio = useRef<{ t: number; desde: number } | null>(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  const panel = useRef<HTMLElement>(null);
  const botonReproducir = useRef<HTMLButtonElement>(null);
  const reducido = useRef(movimientoReducido());
  // Lo que se anuncia al lector de pantalla, una sola vez: al pausar y al llegar a los 20 km. Mientras
  // corre no (serían decenas por segundo) y con el deslizador lo dice su aria-valuetext.
  const [anuncio, setAnuncio] = useState('');

  // Al abrir: el encuadre de la traza con sus 20 km a la vista. Al cerrar: el tablero normal.
  useEffect(() => {
    // El panel tapa la parte de arriba del mapa: el encuadre arranca debajo de él.
    const extension = visor.ruta.getSource()?.getExtent();
    const tapado = panel.current ? panel.current.getBoundingClientRect().bottom - (visor.mapa.getTargetElement()?.getBoundingClientRect().top ?? 0) + 16 : 0;
    // Con el panel arriba la traza baja y su punta podía quedar bajo el zoom y el minimapa (abajo a la
    // derecha): se reserva ese bloque, a la derecha si la ruta es más ancha que alta y abajo si no.
    const mapa = visor.mapa.getTargetElement()?.getBoundingClientRect();
    const bloque = document.querySelector('[aria-label="Acercar"], [aria-label="Acercar el mapa"]')?.closest('.pointer-events-none')?.getBoundingClientRect();
    const reserva: { derecha?: number; abajo?: number } = {};
    // (Solo si el contenedor es el bloque de la esquina, no una barra a lo ancho.)
    if (mapa && bloque && extension && bloque.width < mapa.width * 0.4 && bloque.height < mapa.height * 0.5) {
      if (extension[2] - extension[0] > extension[3] - extension[1]) reserva.derecha = mapa.right - bloque.left + 12;
      else reserva.abajo = mapa.bottom - bloque.top + 12;
    }
    if (extension?.every(Number.isFinite)) volarA(visor, buffer(extension, 22_000), { duracion: 900, conPanel: true, arriba: tapado, ...reserva });
    const alTerminar = () => cerrar.current();
    alTerminarAnimacion.add(alTerminar);
    // El foco entra al panel (estaba a más de 40 Tabs, después de la lista del tablero) y al cerrar
    // vuelve a quien lo abrió.
    const origen = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => botonReproducir.current?.focus({ preventScroll: true }));
    // Esc lo cierra aunque el foco esté afuera (en el tablero o en el mapa); antes que el Esc general.
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || hayDialogoModal() || (escribiendoEn(e.target) && !panel.current?.contains(e.target as Node))) return;
      // Con las Referencias abiertas (modo simple), el Esc es de ellas: se cierra primero lo de adelante.
      if (document.querySelector('button[title^="Referencias"][aria-expanded="true"]')) return;
      // Lo mismo con el comparador (T6): su lista abierta o el foco en la cortina.
      if (document.querySelector('.comparador [role=dialog]:not([inert])') || document.activeElement?.closest('.comparador')) return;
      e.stopImmediatePropagation();
      cerrar.current();
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => {
      window.removeEventListener('keydown', alPresionar, true);
      alTerminarAnimacion.delete(alTerminar); cancelAnimationFrame(cuadro.current); ponerRadioAnimado(visor, null);
      const enPanel = !document.activeElement || document.activeElement === document.body || !!panel.current?.contains(document.activeElement);
      if (enPanel && origen?.isConnected) requestAnimationFrame(() => origen.focus({ preventScroll: true }));
    };
  }, [visor]);

  // Dónde termina el panel (en unidades de .interfaz), como variable CSS: la tabla de datos del profesional no
  // sube más allá (agrandada lo tapaba, y con él el zoom y la cortina del comparador).
  useEffect(() => {
    const interfazEl = document.querySelector<HTMLElement>('.interfaz');
    const el = panel.current;
    if (!interfazEl || !el) return;
    const poner = () => interfazEl.style.setProperty('--fondo-franja', `${(el.parentElement?.offsetTop ?? 0) + el.offsetTop + el.offsetHeight}px`);
    const o = new ResizeObserver(poner);
    o.observe(el);
    poner();
    return () => { o.disconnect(); interfazEl.style.removeProperty('--fondo-franja'); };
  }, []);

  // El mapa sigue a la distancia.
  useEffect(() => ponerRadioAnimado(visor, metros), [visor, metros]);

  // El barrido: lineal (cada km tarda lo mismo: el contador se lee honesto), arranca donde está.
  useEffect(() => {
    if (!reproduciendo) return;
    if (movimientoReducido()) { setMetros(TOPE); setReproduciendo(false); return; }
    inicio.current = null;
    // Desde dónde arranca, ya: si se pausa antes del primer cuadro, se queda ahí (no en la corrida anterior).
    actual.current = metros >= TOPE ? 0 : metros;
    const paso = (t: number) => {
      if (!inicio.current) inicio.current = { t, desde: metros >= TOPE ? 0 : metros };
      const m = Math.min(TOPE, inicio.current.desde + ((t - inicio.current.t) / DURACION) * TOPE);
      actual.current = m;
      setMetros(m);
      if (m < TOPE) cuadro.current = requestAnimationFrame(paso);
      else { setReproduciendo(false); setAnuncio(anunciar(TOPE, true)); }
    };
    cuadro.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reproduciendo]);

  const cuenta = useMemo(() => contarHasta(analisis, metros), [analisis, metros]);
  const anunciar = (m: number, final = false) => {
    const c = contarHasta(analisis, m);
    return `${final ? 'A 20 km' : `En ${km(m)} km`}: ${n(c.localidades)} ${simple ? 'pueblos' : 'localidades'}, ${n(c.habitantes)} ${simple ? 'personas' : 'habitantes'}.`;
  };
  const terminado = metros >= TOPE;
  const enFranja2 = metros > RADIOS.franja1;
  const maxHab = Math.max(1, ...analisis.localidades.map(l => l.habitantes));
  const destino = typeof document !== 'undefined' ? document.querySelector('.interfaz') : null;
  if (!destino) return null;

  return createPortal(
    <div className="pointer-events-none absolute inset-x-0 top-[92px] z-20 flex justify-center px-4">
    <motion.section
      ref={panel}
      role="region"
      aria-label={simple ? 'La franja crece alrededor de la ruta' : 'Animación de distancia'}
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={RESORTE_PANEL}
      className="crecer-franja panel pointer-events-auto w-full max-w-[560px] px-5 pb-4 pt-4 shadow-[var(--sombra-alta)]"
    >
      <div className="flex items-start gap-4">
        {/* La distancia, grande. */}
        <div className="min-w-[132px]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--tinta-3)]">{simple ? 'A menos de' : 'Distancia a la traza'}</div>
          <div className="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-[44px] font-semibold leading-none tracking-[-0.04em]">{km(metros)}</span>
            <span className="text-[17px] font-medium text-[var(--tinta-2)]">km</span>
          </div>
          {/* En qué franja va: el color en una marca (el naranja claro como texto no llegaba a 3:1 sobre blanco). */}
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[var(--tinta-2)]">
            <span className="h-1.5 w-5 rounded-full transition-colors duration-300" style={{ background: enFranja2 ? 'var(--dato-2)' : 'var(--dato-1)' }} aria-hidden="true" />
            {enFranja2 ? 'De 10 a 20 km' : 'Hasta 10 km'}
          </div>
        </div>
        {/* El contador. */}
        <p role="status" className="sr-only">{anuncio}</p>
        <div className="contador-franja grid flex-1 grid-cols-2 gap-3 pt-0.5">
          <Cifra titulo={simple ? 'Pueblos' : 'Localidades'} valor={n(cuenta.localidades)} detalle={`${n(cuenta.franja1.localidades)} + ${n(cuenta.franja2.localidades)}`} />
          <Cifra titulo={simple ? 'Personas' : 'Habitantes'} valor={n(cuenta.habitantes)} detalle={`${n(cuenta.franja1.habitantes)} + ${n(cuenta.franja2.habitantes)}`} />
        </div>
        <button type="button" onClick={onCerrar} aria-label={simple ? 'Cerrar la animación' : 'Cerrar la animación de distancia'} className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)] focus-visible:outline-2">
          <X size={17} weight="bold" />
        </button>
      </div>

      {/* La pista: cada localidad en su distancia; se enciende cuando la franja la alcanza. */}
      <div className="mt-4 flex items-center gap-3">
        <button
          ref={botonReproducir}
          type="button"
          onClick={() => {
            // Con movimiento reducido no hay barrido: el botón salta entre 0 y 20 km.
            if (reducido.current) { const m = terminado ? 0 : TOPE; setMetros(m); setAnuncio(anunciar(m, m === TOPE)); return; }
            if (terminado) { setMetros(0); setReproduciendo(true); return; }
            if (reproduciendo) {
              // Se corta el cuadro ya pedido antes de anunciar: si no, corría una vez más y el anuncio
              // quedaba un cuadro atrás de lo que muestra el panel.
              cancelAnimationFrame(cuadro.current);
              setMetros(actual.current);
              setAnuncio(`Pausa. ${anunciar(actual.current)}`);
            }
            setReproduciendo(r => !r);
          }}
          aria-label={reducido.current ? (terminado ? 'Ir a 0 km' : 'Ir a 20 km') : reproduciendo ? 'Pausar' : terminado ? 'Repetir desde 0 km' : 'Reproducir'}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--tinta)] text-[var(--superficie)] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {reproduciendo ? <Pause size={17} weight="fill" /> : terminado ? <ArrowCounterClockwise size={17} weight="bold" /> : <Play size={17} weight="fill" />}
        </button>
        <div className="relative h-11 flex-1">
          <div className="absolute inset-x-0 top-[18px] h-[6px] rounded-full bg-[var(--superficie-3)]" aria-hidden="true" />
          <div className="absolute left-0 top-[18px] h-[6px] rounded-full" aria-hidden="true"
            style={{ width: `${(metros / TOPE) * 100}%`, background: `linear-gradient(90deg, var(--dato-1) 0%, var(--dato-1) ${Math.min(100, (RADIOS.franja1 / Math.max(metros, 1)) * 100)}%, var(--dato-2) ${Math.min(100, (RADIOS.franja1 / Math.max(metros, 1)) * 100)}%, var(--dato-2) 100%)` }} />
          {/* Cada localidad, en su km. */}
          {analisis.localidades.map(l => {
            const alcanzada = l.distancia <= metros;
            const r = l.habitantes ? 3 + 7 * Math.sqrt(l.habitantes / maxHab) : 2.5;
            return (
              <span key={l.id} aria-hidden="true" className="absolute top-[21px] rounded-full transition-[opacity,transform] duration-300"
                style={{
                  left: `${(l.distancia / TOPE) * 100}%`, width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r,
                  background: l.habitantes ? (l.franja === 1 ? 'var(--dato-1)' : 'var(--dato-2)') : 'transparent',
                  boxShadow: l.habitantes ? '0 0 0 1.5px var(--superficie)' : `inset 0 0 0 1.5px ${l.franja === 1 ? 'var(--dato-1)' : 'var(--dato-2)'}`,
                  opacity: alcanzada ? 1 : 0.28, transform: `scale(${alcanzada ? 1 : 0.7})`,
                }} />
            );
          })}
          {/* Marcas de 0, 10 y 20 km. */}
          {[0, RADIOS.franja1, TOPE].map(m => (
            <span key={m} aria-hidden="true" className={`absolute top-[30px] whitespace-nowrap text-[11px] font-medium tabular-nums text-[var(--tinta-3)] ${m === 0 ? '' : m === TOPE ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${(m / TOPE) * 100}%` }}>{m / 1000} km</span>
          ))}
          <input
            type="range" min={0} max={TOPE} step={100} value={Math.round(metros)}
            onChange={e => { setReproduciendo(false); setMetros(Number(e.target.value)); }}
            onKeyDown={e => {
              // Pasos de medio km con las flechas; Re Pág / Av Pág, de 2 km.
              const pasos: Record<string, number> = { ArrowRight: 500, ArrowUp: 500, ArrowLeft: -500, ArrowDown: -500, PageUp: 2000, PageDown: -2000 };
              if (pasos[e.key] === undefined) return;
              e.preventDefault(); setReproduciendo(false);
              setMetros(m => Math.max(0, Math.min(TOPE, Math.round((m + pasos[e.key]) / 100) * 100)));
            }}
            aria-label={simple ? 'Distancia a la ruta' : 'Distancia a la traza'}
            aria-valuetext={`${km(metros)} km: ${n(cuenta.localidades)} ${simple ? 'pueblos' : 'localidades'}, ${n(cuenta.habitantes)} ${simple ? 'personas' : 'habitantes'}`}
            className="pista-franja absolute inset-x-0 top-[8px] h-[26px] w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>
      <p className="mt-1 text-[12.5px] text-[var(--tinta-3)]">
        {terminado
          ? (simple ? 'A 20 km: los mismos números del tablero.' : 'A 20 km, los totales coinciden con el tablero (distancia geodésica a la traza).')
          : (simple ? 'Cada punto es un pueblo, en su distancia a la ruta. Arrastrá para recorrer.' : 'Cada punto es una localidad en su distancia a la traza (tamaño: habitantes). Arrastrá o usá las flechas.')}
      </p>
    </motion.section>
    </div>,
    destino,
  );
}

function Cifra({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-xl bg-[var(--superficie-2)] px-3 py-2">
      <div className="text-[12px] font-semibold text-[var(--tinta-3)]">{titulo}</div>
      <div className="text-[24px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{valor}</div>
      <div className="flex items-center gap-1 text-[11.5px] tabular-nums text-[var(--tinta-3)]">
        <span aria-hidden="true" className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-[var(--dato-1)]" />{detalle.split(' + ')[0]}
          <span className="ml-1.5 size-2 rounded-full bg-[var(--dato-2)]" />{detalle.split(' + ')[1]}
        </span>
        <span className="sr-only">: hasta 10 km {detalle.split(' + ')[0]}, de 10 a 20 km {detalle.split(' + ')[1]}</span>
      </div>
    </div>
  );
}
