import type { Transition } from 'motion/react';

// Resortes compartidos por todo el visor, calibrados para sentirse como iOS: rápidos, sin rebote
// visible en lo grande y con un rebote mínimo en lo chico.
export const RESORTE: Transition = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 };
export const RESORTE_PANEL: Transition = { type: 'spring', stiffness: 380, damping: 38, mass: 1 };
export const RESORTE_SUAVE: Transition = { type: 'spring', stiffness: 260, damping: 30 };
