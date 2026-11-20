import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hayDialogoModal } from '../../interfaz';

// La pastilla negra de los bordes del modo simple: el menú de antiwebslop.com. Cerrada es una pastilla
// pegada al borde (vertical a la izquierda o a la derecha, horizontal abajo), en el centro; al pasar el cursor se estira
// (desde el centro) hasta ser un panel, y al sacarlo se recoge. Para que sea fluida en la tele, el panel
// está siempre armado en su tamaño final y lo que se anima es su recorte (clip-path): no hay reacomodo en
// ningún cuadro, y el contenido entra solo con opacidad y transform (estilos en .notch, estilos.css).
// `alto`: "lleno" ocupa todo el alto disponible (Capas); "contenido", solo lo que mide lo de adentro (Ajustes).
// Con el teclado: Enter abre y lleva el foco adentro, Escape cierra y vuelve a la pastilla, Tab afuera cierra.
// El estado vive acá: abrir y cerrar no vuelve a dibujar la App.
interface Props {
  lado: 'izquierda' | 'derecha' | 'abajo';
  alto?: 'lleno' | 'contenido';
  etiqueta: string;
  id: string;
  guia?: string;
  cuenta?: number;
  // En lugar del número: un ícono en el círculo blanco (la herramienta elegida, en "Herramientas").
  insignia?: React.ReactNode;
  // Sin título, el panel es solo el contenido ("Herramientas": los botones y nada más).
  titulo?: React.ReactNode;
  children: React.ReactNode;
}

export default function Notch({ lado, alto = 'lleno', etiqueta, id, guia, cuenta, insignia, titulo, children }: Props) {
  const [abierta, setAbierta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  const porTeclado = useRef(false);
  const contenedor = useRef<HTMLDivElement>(null);
  // El último cambio de tamaño de la caja (cambiar la letra la achica bajo el cursor): un rato después, que
  // el cursor "salga" no la cierra, porque no se movió la persona sino el panel.
  const ultimoCambio = useRef(0);
  const reacomodandose = () => performance.now() - ultimoCambio.current < 450;
  // Dónde está el cursor (para saber, al terminar un cambio de tema, si sigue encima: en ese momento
  // :hover todavía no se actualizó y daba falso, y Ajustes se cerraba y se volvía a abrir).
  const puntero = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const mover = (e: PointerEvent) => { puntero.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener('pointermove', mover, { passive: true });
    // Al terminar un cambio de tema: si el cursor se fue mientras tanto (y no hay foco de teclado), se cierra.
    const revisar = () => {
      const el = raiz.current;
      if (!el || el.querySelector(':focus-visible')) return;
      const q = puntero.current;
      const encima = q ? el.contains(document.elementFromPoint(q.x, q.y)) : el.matches(':hover');
      if (!encima) setAbierta(false);
    };
    document.addEventListener('tema-terminado', revisar);
    return () => { document.removeEventListener('pointermove', mover); document.removeEventListener('tema-terminado', revisar); };
  }, []);

  // Ajustes (a la derecha, del alto de su contenido): la pastilla va exactamente a la altura de la de Capas
  // (se mide, no se supone) y el panel abierto se centra en ella, sin salirse de su lugar (arriba del
  // minimapa). Pasa --notch-centro y --sube en px; estilos.css trae una cuenta de respaldo por si no hay JS.
  // Se mide antes de pintar (al montarse, en un efecto de layout; después, en el ResizeObserver, que corre
  // entre el layout y el pintado): si se midiera un cuadro tarde, el recorte (que tiene transición) se
  // animaba desde la posición de respaldo y la pastilla volvía "subiendo" al cerrar los resultados.
  useLayoutEffect(() => {
    const caja = contenedor.current;
    const lugar = caja?.parentElement;
    if (lado !== 'derecha' || alto !== 'contenido' || !caja || !lugar) return;
    const capas = () => document.querySelector<HTMLElement>('.notch-contenedor[data-lado="izquierda"]');
    let altoPrevio = -1;
    const medir = () => {
      const altoCaja = caja.offsetHeight;
      if (altoPrevio >= 0 && altoCaja !== altoPrevio) ultimoCambio.current = performance.now();
      altoPrevio = altoCaja;
      caja.style.setProperty('--alto-caja', `${altoCaja}px`);
      const pastilla = capas()?.querySelector<HTMLElement>('.notch-pastilla');
      const r = lugar.getBoundingClientRect();
      if (!pastilla || !lugar.offsetHeight || !r.height) return;
      // En px de pantalla vs. px de CSS (.interfaz lleva zoom).
      const escala = r.height / lugar.offsetHeight;
      const p = pastilla.getBoundingClientRect();
      const centro = (p.top + p.height / 2 - r.top) / escala;
      const altoLugar = lugar.offsetHeight;
      const sube = Math.max(0, Math.min(altoLugar - centro - altoCaja / 2, altoLugar - altoCaja));
      caja.style.setProperty('--sube', `${sube}px`);
      caja.style.setProperty('--notch-centro', `${centro - (altoLugar - sube - altoCaja)}px`);
    };
    // La primera medida, sin transiciones: la pastilla aparece ya en su lugar.
    caja.dataset.sinTransicion = '';
    medir();
    let cuadro = requestAnimationFrame(() => { cuadro = requestAnimationFrame(() => delete caja.dataset.sinTransicion); });
    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    observador.observe(lugar);
    const izquierda = capas();
    if (izquierda) observador.observe(izquierda);
    window.addEventListener('resize', medir);
    // Las entradas (las pastillas llegan animadas) mueven lo medido: al terminar cualquiera, se vuelve a medir.
    document.addEventListener('animationend', medir, true);
    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      window.removeEventListener('resize', medir);
      document.removeEventListener('animationend', medir, true);
    };
  }, [lado, alto]);

  useEffect(() => {
    if (!abierta) return;
    // Abierta con el teclado: el foco pasa al primer control del cuerpo (la pastilla se desvanece). No al
    // del título: ahí puede estar "Sacar todo", y un Enter repetido vaciaría el mapa.
    if (porTeclado.current) {
      porTeclado.current = false;
      requestAnimationFrame(() => raiz.current?.querySelector<HTMLElement>('.notch-cuerpo button, .notch-cuerpo [role="radio"], .notch-cuerpo input')?.focus());
    }
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || hayDialogoModal()) return;
      e.stopImmediatePropagation();
      const adentro = raiz.current?.contains(document.activeElement);
      setAbierta(false);
      if (adentro) boton.current?.focus();
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  }, [abierta]);

  return (
    <div ref={contenedor} className="notch-contenedor relative" data-lado={lado} data-alto={alto} data-abierta={abierta || undefined}>
      <span aria-hidden="true" className="notch-filete" data-borde="arriba" />
      <span aria-hidden="true" className="notch-filete" data-borde="abajo" />
      <div
        ref={raiz}
        className={`notch dark pointer-events-auto${abierta ? ' panel' : ''}`}
        data-abierta={abierta || undefined}
        // Con un botón apretado (arrastrando el mapa) no se abre: solo el cursor que pasa.
        onPointerEnter={e => e.pointerType === 'mouse' && e.buttons === 0 && setAbierta(true)}
        // Durante el cambio de tema (data-cambiando-tema) el cursor no "sale": la captura del navegador tapa todo.
        onPointerLeave={e => e.pointerType === 'mouse' && !('cambiandoTema' in document.documentElement.dataset) && !reacomodandose() && !raiz.current?.querySelector(':focus-visible') && setAbierta(false)}
        onBlur={e => { if (!('cambiandoTema' in document.documentElement.dataset) && !raiz.current?.contains(e.relatedTarget as Node | null) && !raiz.current?.matches(':hover')) setAbierta(false); }}
      >
        <button
          ref={boton}
          type="button"
          aria-label={etiqueta}
          aria-controls={id}
          aria-expanded={abierta}
          data-guia={guia}
          tabIndex={abierta ? -1 : 0}
          onClick={e => {
            if (e.detail === 0) porTeclado.current = true;
            setAbierta(true);
          }}
          className={`notch-pastilla ${abierta ? '' : 'panel'}`}
        >
          <span className="notch-vertical whitespace-nowrap text-[19px] font-bold tracking-[0.005em]">{etiqueta}</span>
          {insignia ? <span aria-hidden="true" className="notch-cuenta notch-insignia">{insignia}</span> : !!cuenta && <span aria-hidden="true" className="notch-cuenta">{cuenta}</span>}
        </button>

        {titulo && (
          <div className="notch-titulo flex h-[76px] shrink-0 items-center gap-3 pl-6 pr-4" aria-hidden={!abierta} inert={!abierta}>
            {titulo}
          </div>
        )}
        <div ref={cuerpo} id={id} inert={!abierta} className="notch-cuerpo flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
