import { transformExtent } from 'ol/proj';
import { GRUPOS } from './config';
import { HERRAMIENTAS, type Modo } from './herramientas';
import type { Interpretacion } from './lenguaje';

// Lo que ofrece el buscador central: acciones del visor, herramientas, capas y lugares.
export type TipoSugerencia = 'accion' | 'herramienta' | 'capa' | 'lugar' | 'pregunta';

export interface Sugerencia {
  id: string;
  tipo: TipoSugerencia;
  titulo: string;
  detalle: string;
  // Palabras con las que también se encuentra ("medir" encuentra "Distancia").
  terminos?: string;
  tecla?: string;
  // Lugares: la extensión a la que vuela el mapa.
  extension?: number[];
  // Preguntas en lenguaje natural: la interpretación y, si vino de "¿Quisiste decir?", qué aprender.
  interpretacion?: Interpretacion;
  aprender?: { frase: string; desconocidas: string[] };
}

const ACCIONES: Sugerencia[] = [
  { id: 'accion:rn11', tipo: 'accion', titulo: 'Ver la RN11 en Chaco', detalle: 'Resalta la traza de la Ruta Nacional 11', terminos: 'ruta nacional 11 rn11 traza obra mantenimiento vial camino' },
  { id: 'accion:chaco', tipo: 'accion', titulo: 'Ver Chaco completo', detalle: 'Encuadra la provincia', terminos: 'chaco provincia encuadrar inicio volver zoom extension' },
  { id: 'accion:apagar', tipo: 'accion', titulo: 'Apagar todas las capas', detalle: 'Deja el mapa vacío', terminos: 'apagar ocultar todas capas limpiar borrar quitar' },
  { id: 'accion:restablecer', tipo: 'accion', titulo: 'Restablecer capas', detalle: 'Vuelve a las capas del inicio', terminos: 'restablecer reiniciar capas iniciales defecto' },
  { id: 'accion:tema', tipo: 'accion', titulo: 'Cambiar tema claro u oscuro', detalle: 'Modo noche para el proyector', terminos: 'tema oscuro claro modo noche dia color' },
];

const TERMINOS_HERRAMIENTA: Record<Modo, string> = {
  navegar: 'navegar mover mano arrastrar',
  punto: 'consulta punto info identificar que hay clic atributos',
  rectangulo: 'consulta rectangulo area seleccion caja varias',
  distancia: 'medir distancia longitud km regla',
  area: 'medir area superficie hectareas poligono',
  alta: 'nueva obra agregar cargar alta punto editar wfs',
};

const HERRAMIENTAS_SUGERIDAS: Sugerencia[] = (Object.keys(HERRAMIENTAS) as Modo[]).map(m => ({
  id: `herramienta:${m}`,
  tipo: 'herramienta',
  titulo: HERRAMIENTAS[m].titulo,
  detalle: HERRAMIENTAS[m].ayuda,
  terminos: TERMINOS_HERRAMIENTA[m],
  tecla: HERRAMIENTAS[m].tecla,
}));

// Cómo se le dice a cada capa en la calle: "ríos" encuentra Cursos de agua.
export const SINONIMOS: Record<string, string> = {
  curso_de_agua_hid: 'rio rios arroyo arroyos riacho agua',
  espejo_de_agua_hid: 'laguna lagunas lago lagos bañado estero agua',
  red_vial: 'ruta rutas camino caminos calle autopista',
  vias_secundarias: 'calle calles camino caminos',
  puente_red_vial_puntos: 'puente puentes',
  red_ferroviaria: 'tren trenes ferrocarril via vias',
  localidades: 'ciudad ciudades pueblo pueblos localidad',
  provincias: 'provincia limite',
  curvas_de_nivel: 'altura relieve topografia',
  edif_educacion: 'escuela escuelas colegio universidad',
  edificio_de_salud_ips: 'hospital hospitales salita clinica',
  edificio_de_seguridad_ips: 'policia comisaria bomberos',
  infraestructura_aeroportuaria_punto: 'aeropuerto aerodromo avion',
  obras_rn11: 'obra obras mantenimiento rn11 bacheo',
};

const CAPAS_SUGERIDAS: Sugerencia[] = GRUPOS.flatMap(g => g.capas.map(c => ({
  id: `capa:${c.nombre}`,
  tipo: 'capa' as const,
  titulo: c.titulo,
  detalle: g.titulo,
  terminos: `${g.titulo} ${c.nombre.replaceAll('_', ' ')} capa ${SINONIMOS[c.nombre] ?? ''}`,
})));

const RESISTENCIA: Sugerencia = {
  id: 'lugar:resistencia',
  tipo: 'lugar',
  titulo: 'Resistencia',
  detalle: 'Capital del Chaco',
  extension: transformExtent([-59.06, -27.52, -58.9, -27.39], 'EPSG:4326', 'EPSG:3857'),
};

// Con el buscador vacío: lo más útil para la presentación.
export const DESTACADAS = ['accion:rn11', 'lugar:resistencia', 'herramienta:distancia', 'herramienta:rectangulo', 'accion:apagar']
  .map(id => [...ACCIONES, ...HERRAMIENTAS_SUGERIDAS, RESISTENCIA].find(s => s.id === id)!);

export const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Todas las palabras escritas tienen que aparecer. Pesa más que coincidan al comienzo de una palabra
// ("rio" → Cursos de agua por el sinónimo "rios", no Edificios ferroviarios) y, sobre todo, del título.
export function buscar(texto: string): { acciones: Sugerencia[]; capas: Sugerencia[] } {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  const alComienzo = (lugar: string, palabra: string) => lugar.split(/[\s,.-]+/).some(w => w.startsWith(palabra));
  const puntuar = (s: Sugerencia) => {
    const titulo = normalizar(s.titulo);
    const resto = `${normalizar(s.detalle)} ${normalizar(s.terminos ?? '')}`;
    if (!palabras.every(p => titulo.includes(p) || resto.includes(p))) return 0;
    return palabras.reduce((total, p) => total
      + (alComienzo(titulo, p) ? 6 : alComienzo(resto, p) ? 4 : 1), titulo.startsWith(palabras[0]) ? 2 : 0);
  };
  const ordenar = (lista: Sugerencia[], maximo: number) => lista
    .map(s => [s, puntuar(s)] as const).filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, maximo).map(([s]) => s);
  return { acciones: ordenar([...ACCIONES, ...HERRAMIENTAS_SUGERIDAS], 4), capas: ordenar(CAPAS_SUGERIDAS, 5) };
}

// --- Historial (en el navegador; si no hay almacenamiento, vale solo para esta sesión) ---

const CLAVE = 'visor-historial';
let enMemoria: Sugerencia[] = [];

export function leerHistorial(): Sugerencia[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
  } catch {
    return enMemoria;
  }
}

export function guardarEnHistorial(sugerencia: Sugerencia) {
  const lista = [sugerencia, ...leerHistorial().filter(s => s.id !== sugerencia.id)].slice(0, 5);
  enMemoria = lista;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Ventana privada: queda en memoria.
  }
}

export function borrarHistorial() {
  enMemoria = [];
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que borrar.
  }
}
