// Rampas del mapa de calor (T3), compartidas por la capa, la leyenda y la hoja impresa (que es siempre
// clara). Empiezan transparentes: donde no hay nada, se ve el mapa.
//
// - Población: magma (amarillo, coral, magenta, violeta). No es el naranja de las rutas, así la mancha
//   no se confunde con la red vial. En oscuro va hacia los claros: el extremo alto oscuro se perdía.
// - Densidad: violeta, para que no se confunda con la de población.
// El primer tono visible ya tiene media opacidad: sobre el crema de la provincia, los tonos pálidos no se veían.
export const GRADIENTES = {
  poblacion: {
    claro: ['rgba(254,178,118,0)', 'rgba(252,137,97,0.5)', '#fc8961', '#e3456b', '#b5367a', '#721f81', '#3b0f70'],
    oscuro: ['rgba(114,31,129,0)', 'rgba(140,41,129,0.32)', '#b5367a', '#e3456b', '#fc8961', '#fec98e', '#fcfdbf'],
  },
  densidad: {
    claro: ['rgba(139,92,246,0)', 'rgba(139,92,246,0.42)', '#8b5cf6', '#6d28d9', '#4c1d95', '#2e1065'],
    oscuro: ['rgba(91,33,182,0)', 'rgba(124,58,237,0.3)', 'rgba(139,92,246,0.75)', '#8b5cf6', '#a78bfa', '#c4b5fd'],
  },
} as const;
