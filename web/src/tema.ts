import { useEffect, useState } from 'react';

// Claro u oscuro. index.html ya aplicó la clase antes del primer pintado; acá se mantiene en sincronía.
export function useTema() {
  const [oscuro, setOscuro] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', oscuro);
  }, [oscuro]);

  function cambiar(valor: boolean) {
    try {
      localStorage.setItem('tema', valor ? 'oscuro' : 'claro');
    } catch {
      // Sin almacenamiento (ventana privada): el tema vale solo para esta sesión.
    }
    setOscuro(valor);
  }

  return { oscuro, cambiar };
}
