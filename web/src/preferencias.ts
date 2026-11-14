import { useEffect, useState } from 'react';
import type { Interfaz } from './interfaz';

// Preferencias del visor, guardadas en el navegador de cada uno.
export type Tamano = 'compacto' | 'normal' | 'grande';

export interface Preferencias {
  tamano: Tamano;
  cuadricula: boolean;
  minimapa: boolean;
  // Además de lo que pida el sistema: animaciones mínimas.
  movimientoReducido: boolean;
  // Simple o profesional. Null hasta que se elige en la bienvenida (la primera vez).
  interfaz: Interfaz | null;
  // La guía de primeros pasos del modo simple ya se mostró.
  guiaVista: boolean;
  // Quién firma los mapas exportados a PDF (se recuerda para la próxima).
  autores: string;
}

// Factor de zoom de la interfaz (los paneles, no el mapa). Grande es el tamaño pensado para el proyector.
export const ESCALAS: Record<Tamano, number> = { compacto: 0.8, normal: 0.88, grande: 1 };

const CLAVE = 'visor-preferencias';
const INICIALES: Preferencias = { tamano: 'normal', cuadricula: true, minimapa: true, movimientoReducido: false, interfaz: null, guiaVista: false, autores: 'Equipo del TPI · UTN FRRe' };

function leer(): Preferencias {
  try {
    return { ...INICIALES, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') };
  } catch {
    return INICIALES;
  }
}

// Pantallas grandes (la tele 2K de la presentación): la interfaz y el mapa crecen con el ancho, desde
// 1900 px y hasta 1,6× en 2560 px. En una notebook (1366–1920) vale 1. Sin esto, en la tele el texto
// quedaba en 12 px reales y los paneles se veían chicos y perdidos.
export const factorPantalla = () => {
  const ancho = window.innerWidth;
  return ancho < 1900 ? 1 : Math.min(1.6, Math.max(1, ancho / 1600));
};

export function usePreferencias() {
  const [preferencias, setPreferencias] = useState(leer);
  const [factor, setFactor] = useState(factorPantalla);

  useEffect(() => {
    const alCambiar = () => setFactor(factorPantalla());
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty('--escala', String(ESCALAS[preferencias.tamano] * factor));
    raiz.dataset.movimiento = preferencias.movimientoReducido ? 'reducido' : 'normal';
    try {
      localStorage.setItem(CLAVE, JSON.stringify(preferencias));
    } catch {
      // Ventana privada: valen solo para esta sesión.
    }
  }, [preferencias, factor]);

  const cambiar = <K extends keyof Preferencias>(clave: K, valor: Preferencias[K]) =>
    setPreferencias(actual => ({ ...actual, [clave]: valor }));

  return { preferencias, cambiar, factor };
}

// La escala vigente, para los cálculos en píxeles de pantalla (márgenes del encuadre del mapa).
export const escalaActual = () =>
  window.matchMedia('(min-width: 1024px)').matches
    ? Number(getComputedStyle(document.documentElement).getPropertyValue('--escala')) || 1
    : 1;

export const movimientoReducido = () =>
  document.documentElement.dataset.movimiento === 'reducido'
  || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
