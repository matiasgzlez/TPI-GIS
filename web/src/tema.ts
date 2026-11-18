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
    const interrumpir = () => transicion.current?.skipTransition();
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

    // Fundir dos imágenes terminadas evita el gris plano que produce interpolar invert() al 50 %.
    if (!document.documentElement.dataset.lucesCapitales) iluminarCapitales(oscuro);
    const nueva = document.startViewTransition(() => flushSync(() => setOscuro(solicitado.current)));
    transicion.current = nueva;
    // La captura suspende la animación del contenido. Las luces arrancan cuando el mapa vuelve a estar vivo.
    void nueva.ready.then(() => {
      if (transicion.current === nueva) iluminarCapitales(solicitado.current, true);
    }, () => {});
    const terminar = () => {
      if (transicion.current !== nueva) return;
      iluminarCapitales(solicitado.current);
      transicion.current = null;
    };
    void nueva.finished.then(terminar, terminar);
  }

  return { oscuro, cambiar };
}
