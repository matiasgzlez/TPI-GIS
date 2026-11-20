import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { movimientoReducido } from './preferencias';

function iluminarCapitales(encender: boolean, animar = false) {
  document.documentElement.dataset.lucesCapitales = animar
    ? (encender ? 'encendiendo' : 'apagando')
    : (encender ? 'encendidas' : 'apagadas');
}

// Claro u oscuro. index.html ya aplicó la clase antes del primer pintado; acá se mantiene en sincronía.
export function useTema() {
  const [oscuro, setOscuro] = useState(() => document.documentElement.classList.contains('dark'));
  const transicion = useRef<ViewTransition | null>(null);
  const solicitado = useRef(oscuro);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', oscuro);
  }, [oscuro]);

  useEffect(() => {
    // El cuadro saliente es fijo. Si la persona mueve el mapa o usa un control, se deja ver el mapa vivo.
    // De paso, el último toque marca de dónde nace el círculo del tema nuevo (--tema-x/--tema-y).
    const interrumpir = (e?: Event) => {
      if (e instanceof PointerEvent) {
        document.documentElement.style.setProperty('--tema-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--tema-y', `${e.clientY}px`);
      }
      transicion.current?.skipTransition();
    };
    document.addEventListener('pointerdown', interrumpir, { capture: true, passive: true });
    document.addEventListener('wheel', interrumpir, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', interrumpir, true);
      document.removeEventListener('wheel', interrumpir, true);
      interrumpir();
    };
  }, []);

  function cambiar(valor: boolean) {
    if (valor === solicitado.current) return;
    solicitado.current = valor;
    try {
      localStorage.setItem('tema', valor ? 'oscuro' : 'claro');
    } catch {
      // Sin almacenamiento (ventana privada): el tema vale solo para esta sesión.
    }

    if (!document.startViewTransition || movimientoReducido()) {
      transicion.current?.skipTransition();
      iluminarCapitales(valor);
      setOscuro(valor);
      return;
    }

    // Con el teclado, el círculo nace del control con foco (si no, del último toque).
    const activo = document.activeElement as HTMLElement | null;
    if (activo && activo !== document.body && activo.matches(':focus-visible')) {
      const r = activo.getBoundingClientRect();
      document.documentElement.style.setProperty('--tema-x', `${r.left + r.width / 2}px`);
      document.documentElement.style.setProperty('--tema-y', `${r.top + r.height / 2}px`);
    }
    // El círculo termina justo en la esquina más lejana del toque (así los 1,1 s se ven enteros).
    const raiz = document.documentElement;
    const x = parseFloat(raiz.style.getPropertyValue('--tema-x')) || innerWidth / 2;
    const y = parseFloat(raiz.style.getPropertyValue('--tema-y')) || innerHeight / 2;
    raiz.style.setProperty('--tema-radio-fin', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 120}px`);
    // Mientras dura, los notch no se cierran por el cursor (el navegador tapa la página con la captura y
    // avisaba que el cursor "salía": Ajustes se cerraba en medio del cambio).
    document.documentElement.dataset.cambiandoTema = '';
    // Dos imágenes terminadas: el tema nuevo se abre en un círculo de borde suave desde el toque.
    if (!document.documentElement.dataset.lucesCapitales) iluminarCapitales(oscuro);
    const nueva = document.startViewTransition(() => flushSync(() => setOscuro(solicitado.current)));
    transicion.current = nueva;
    // La captura suspende la animación del contenido. Las luces arrancan cuando el mapa vuelve a estar vivo.
    void nueva.ready.then(() => {
      if (transicion.current === nueva) iluminarCapitales(solicitado.current, true);
    }, () => {});
    const terminar = () => {
      if (transicion.current !== nueva) return;
      delete document.documentElement.dataset.cambiandoTema;
      // Los notch revisan si el cursor se fue mientras tanto (durante el cambio no se cierran).
      document.dispatchEvent(new Event('tema-terminado'));
      iluminarCapitales(solicitado.current);
      transicion.current = null;
    };
    void nueva.finished.then(terminar, terminar);
  }

  return { oscuro, cambiar };
}
