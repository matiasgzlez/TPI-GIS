// Comparador (T6): los juegos de capas que se pueden poner de cada lado de la cortina y los pares listos
// ("Natural vs. Humano", el atajo con el que abre). Todos llevan las provincias, así los dos lados tienen
// el mismo contorno de referencia.
import { GRUPOS } from './config';
import { TEMATICAS, type Interfaz } from './interfaz';

export interface Juego {
  id: string;
  titulo: string;
  // Cómo se dice en el modo simple (si es distinto).
  simple?: string;
  frase: string;
  color: string;
  capas: string[];
}

const BASE = ['provincias'];

export const JUEGOS_PROPIOS: Juego[] = [
  {
    id: 'natural', titulo: 'Natural', frase: 'Agua, monte, plantas de agua y suelo desnudo', color: 'var(--tema-naturaleza)',
    capas: [...BASE, 'curso_de_agua_hid', 'espejo_de_agua_hid', 'isla', 'veg_arborea', 'veg_arbustiva', 'veg_hidrofila', 'veg_suelo_desnudo'],
  },
  {
    id: 'humano', titulo: 'Humano', simple: 'Lo que hizo la gente', frase: 'Pueblos, caminos, vías, campos sembrados y cables', color: 'var(--tema-pueblos)',
    capas: [...BASE, 'localidades', 'ejido', 'red_vial', 'vias_secundarias', 'red_ferroviaria', 'veg_cultivos', 'lineas_de_conduccion_ene'],
  },
  {
    id: 'monte', titulo: 'Monte', simple: 'Bosques', frase: 'Bosques y arbustos', color: 'var(--tema-naturaleza)',
    capas: [...BASE, 'veg_arborea', 'veg_arbustiva'],
  },
  {
    id: 'campos', titulo: 'Campos sembrados', frase: 'Cultivos y establecimientos agropecuarios', color: 'var(--tema-energia)',
    capas: [...BASE, 'veg_cultivos', 'actividades_agropecuarias'],
  },
  {
    id: 'agua', titulo: 'Agua', frase: 'Ríos, lagunas, bañados e islas', color: 'var(--tema-agua)',
    capas: [...BASE, 'curso_de_agua_hid', 'espejo_de_agua_hid', 'isla', 'veg_hidrofila'],
  },
  {
    id: 'caminos', titulo: 'Caminos', frase: 'Rutas, caminos, vías del tren y puentes', color: 'var(--tema-caminos)',
    capas: [...BASE, 'red_vial', 'vias_secundarias', 'red_ferroviaria', 'puente_red_vial_puntos'],
  },
];

// Los pares listos: un toque pone los dos lados.
export const PARES: { id: string; izquierda: string; derecha: string }[] = [
  { id: 'natural-humano', izquierda: 'natural', derecha: 'humano' },
  { id: 'monte-campos', izquierda: 'monte', derecha: 'campos' },
  { id: 'agua-caminos', izquierda: 'agua', derecha: 'caminos' },
];

// Además de los propios, cada temática (simple) o grupo (profesional), con las provincias de fondo.
export function juegos(interfaz: Interfaz): Juego[] {
  const temas: Juego[] = interfaz === 'simple'
    ? TEMATICAS.map(t => ({ id: `tema:${t.id}`, titulo: t.titulo, frase: t.frase, color: t.color, capas: [...new Set([...BASE, ...t.capas.map(c => c.nombre)])] }))
    : GRUPOS.map(g => ({ id: `grupo:${g.id}`, titulo: g.titulo, frase: g.capas.map(c => c.titulo).join(', '), color: 'var(--tinta-3)', capas: [...new Set([...BASE, ...g.capas.map(c => c.nombre)])] }));
  return [...JUEGOS_PROPIOS, ...temas];
}

export const juegoPorId = (id: string) => JUEGOS_PROPIOS.find(j => j.id === id)!;
export const tituloJuego = (j: Juego, interfaz: Interfaz) => (interfaz === 'simple' ? j.simple ?? j.titulo : j.titulo);

const mismas = (a: readonly string[], b: readonly string[]) => a.length === b.length && new Set([...a, ...b]).size === a.length;

// Cómo se llama un lado: el juego con esas mismas capas, "Lo que estabas viendo" (las capas de antes de abrir
// la cortina) o, si no coincide con ninguno, "A medida".
export function nombreLado(capas: readonly string[], antes: readonly string[], interfaz: Interfaz): { titulo: string; color: string; juego?: Juego } {
  const unicas = [...new Set(capas)];
  if (!unicas.length) return { titulo: interfaz === 'simple' ? 'Nada' : 'Sin capas', color: 'var(--tinta-3)' };
  const juego = juegos(interfaz).find(j => mismas(j.capas, unicas));
  if (juego) return { titulo: tituloJuego(juego, interfaz), color: juego.color, juego };
  if (antes.length && mismas(antes, unicas)) return { titulo: 'Lo que estabas viendo', color: 'var(--vial)' };
  return { titulo: interfaz === 'simple' ? 'Tu elección' : `A medida · ${unicas.length} ${unicas.length === 1 ? 'capa' : 'capas'}`, color: 'var(--tinta-3)' };
}
