import { useEffect, useState } from 'react';

// Preferencias del visor, guardadas en el navegador de cada uno.
export type Tamano = 'compacto' | 'normal' | 'grande';

export interface Preferencias {
  tamano: Tamano;
  cuadricula: boolean;
  minimapa: boolean;
  // Además de lo que pida el sistema: animaciones mínimas.
  movimientoReducido: boolean;
}

// Factor de zoom de la interfaz (los paneles, no el mapa). Grande es el tamaño pensado para el proyector.
export const ESCALAS: Record<Tamano, number> = { compacto: 0.8, normal: 0.88, grande: 1 };

const CLAVE = 'visor-preferencias';
const INICIALES: Preferencias = { tamano: 'normal', cuadricula: true, minimapa: true, movimientoReducido: false };

function leer(): Preferencias {
  try {
    return { ...INICIALES, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') };
  } catch {
    return INICIALES;
  }
}

export function usePreferencias() {
  const [preferencias, setPreferencias] = useState(leer);

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty('--escala', String(ESCALAS[preferencias.tamano]));
    raiz.dataset.movimiento = preferencias.movimientoReducido ? 'reducido' : 'normal';
    try {
      localStorage.setItem(CLAVE, JSON.stringify(preferencias));
    } catch {
      // Ventana privada: valen solo para esta sesión.
    }
  }, [preferencias]);

  const cambiar = <K extends keyof Preferencias>(clave: K, valor: Preferencias[K]) =>
    setPreferencias(actual => ({ ...actual, [clave]: valor }));

  return { preferencias, cambiar };
}

// La escala vigente, para los cálculos en píxeles de pantalla (márgenes del encuadre del mapa).
export const escalaActual = () =>
  window.matchMedia('(min-width: 1024px)').matches
    ? Number(getComputedStyle(document.documentElement).getPropertyValue('--escala')) || 1
    : 1;

export const movimientoReducido = () =>
  document.documentElement.dataset.movimiento === 'reducido'
  || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
