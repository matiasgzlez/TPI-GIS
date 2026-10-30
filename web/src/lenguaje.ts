import { CAPAS, tituloDeCapa, type Geometria } from './config';
import { SINONIMOS, normalizar } from './comandos';
import { aprendidos } from './aprendizaje';

// Intérprete de preguntas en castellano, sin servicios externos. Reconoce una intención (listar,
// contar, población, tablero de la RN11), una capa, una relación espacial y un lugar:
//   "localidades a menos de 10 km de la RN11"  "cuántas escuelas hay en Resistencia"
//   "puentes sobre la ruta 11"  "población entre 10 y 20 km de la RN11"  "hospitales en Corrientes"
// Si no entiende, lo dice: arma frases parecidas con el árbol de posibilidades (sugerencias) y lo
// que se elige queda aprendido para todo el equipo (aprendizaje.ts).

export type Intencion = 'listar' | 'contar' | 'poblacion' | 'tablero';
export type Lugar = { tipo: 'rn11' } | { tipo: 'provincia'; nombre: string } | { tipo: 'localidad'; nombre: string };
export interface Relacion { tipo: 'cerca' | 'dentro'; desde: number; hasta: number }

export interface Interpretacion {
  intencion: Intencion;
  capa: string;
  relacion: Relacion;
  lugar: Lugar;
}

export const PROVINCIAS = [
  'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Ciudad de Buenos Aires', 'Cordoba', 'Corrientes', 'Entre Rios', 'Formosa',
  'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquen', 'Rio Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
  'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucuman',
];

// Palabras que no dicen nada de la consulta. Lo que sobra después de reconocer todo y no está acá
// son palabras nuevas: se pueden aprender como sinónimos.
const VACIAS = new Set(('el la los las un una unos unas de del al a en y o que hay cuales cual cuantos cuantas cuanta cuanto '
  + 'son es esta estan me mostrame mostra ver busca buscar quiero saber todos todas sobre cerca entre menos mas km kilometros '
  + 'metros m hasta dentro ruta nacional rn11 rn 11 tiene tienen vive viven por con para se lo le').split(' '));

const singular = (palabra: string) => palabra.replace(/(es|s)$/, '');

// Términos por capa: palabras del título, del nombre técnico y sinónimos (de fábrica y aprendidos).
function terminosDeCapas(): [string, string[]][] {
  const aprendidosPorCapa = new Map<string, string[]>();
  for (const s of aprendidos('sinonimo')) aprendidosPorCapa.set(s.valor, [...(aprendidosPorCapa.get(s.valor) ?? []), s.clave]);
  return CAPAS.map(c => [c.nombre, [
    normalizar(c.titulo),
    ...normalizar(SINONIMOS[c.nombre] ?? '').split(' ').filter(Boolean),
    ...(aprendidosPorCapa.get(c.nombre) ?? []),
  ]]);
}

// La capa nombrada en el texto: la coincidencia más larga gana ("cursos de agua" antes que "agua").
function reconocerCapa(texto: string): { capa: string; termino: string } | undefined {
  const palabras = texto.split(' ').map(singular);
  let mejor: { capa: string; termino: string } | undefined;
  for (const [capa, terminos] of terminosDeCapas()) {
    for (const termino of terminos) {
      const partes = termino.split(' ').map(singular);
      const esta = partes.every(p => p.length > 2 && palabras.includes(p)) || (partes.length === 1 && palabras.includes(singular(termino)));
      if (esta && (!mejor || termino.length > mejor.termino.length)) mejor = { capa, termino };
    }
  }
  return mejor;
}

const numero = (texto: string) => Number(texto.replace(',', '.'));
const aMetros = (valor: number, unidad?: string) => (unidad && /^m(etros?)?$/.test(unidad) ? valor : valor * 1000);

function reconocerRelacion(texto: string): { relacion?: Relacion; resto: string } {
  let m = texto.match(/entre (\d+(?:[.,]\d+)?) y (\d+(?:[.,]\d+)?) ?(km|kilometros|m|metros)?/);
  if (m) return { relacion: { tipo: 'cerca', desde: aMetros(numero(m[1]), m[3]), hasta: aMetros(numero(m[2]), m[3]) }, resto: texto.replace(m[0], ' ') };
  m = texto.match(/(?:a menos de|hasta|dentro de|a|de) (\d+(?:[.,]\d+)?) ?(km|kilometros|m|metros)/);
  if (m) return { relacion: { tipo: 'cerca', desde: 0, hasta: aMetros(numero(m[1]), m[2]) }, resto: texto.replace(m[0], ' ') };
  m = texto.match(/\b(sobre|que cruzan|que cruza|cruzan)\b/);
  if (m) return { relacion: { tipo: 'cerca', desde: 0, hasta: 100 }, resto: texto.replace(m[0], ' ') };
  m = texto.match(/\bcerca\b/);
  if (m) return { relacion: { tipo: 'cerca', desde: 0, hasta: 5000 }, resto: texto.replace(m[0], ' ') };
  return { resto: texto };
}

function reconocerLugar(texto: string): { lugar?: Lugar; resto: string } {
  const rn11 = texto.match(/\b(rn ?11|ruta (?:nacional )?(?:n(?:ro|°|umero)? ?)?11|la 11)\b/);
  if (rn11) return { lugar: { tipo: 'rn11' }, resto: texto.replace(rn11[0], ' ') };
  for (const provincia of [...PROVINCIAS].sort((a, b) => b.length - a.length)) {
    const nombre = normalizar(provincia);
    if (new RegExp(`\\b${nombre}\\b`).test(texto)) return { lugar: { tipo: 'provincia', nombre: provincia }, resto: texto.replace(nombre, ' ') };
  }
  // Una localidad: lo que viene después de "en" o "de" al final de la frase.
  const m = texto.match(/\b(?:en|de|del|cerca de)\s+([a-z][a-z .]{2,})$/);
  if (m) {
    const nombre = m[1].trim().split(' ').filter(p => !VACIAS.has(p)).join(' ');
    if (nombre.length > 2) return { lugar: { tipo: 'localidad', nombre }, resto: texto.replace(m[0], ' ') };
  }
  return { resto: texto };
}

export interface Analisis {
  interpretacion?: Interpretacion;
  // Lo que se reconoció aunque falten partes: alimenta las sugerencias.
  parcial: Partial<Interpretacion>;
  // Palabras que no se entendieron (candidatas a sinónimo).
  desconocidas: string[];
}

export function interpretar(entrada: string): Analisis {
  const texto = normalizar(entrada).replace(/[¿?¡!]/g, ' ').replace(/\s+/g, ' ').trim();

  const aprendida = aprendidos('frase').find(a => a.clave === texto);
  if (aprendida) {
    try {
      return { interpretacion: JSON.parse(aprendida.valor), parcial: {}, desconocidas: [] };
    } catch {
      // Valor dañado: se interpreta de nuevo.
    }
  }

  let intencion: Intencion = /\bcuant[oa]s\b/.test(texto) ? 'contar' : 'listar';
  if (/\b(poblacion|habitantes|gente|personas)\b/.test(texto)) intencion = 'poblacion';
  if (/\b(largo|longitud|cuantos km|cuantos kilometros|mide|tablero|analisis)\b/.test(texto) && /11/.test(texto)) intencion = 'tablero';

  const { relacion, resto: sinRelacion } = reconocerRelacion(texto);
  const { lugar, resto } = reconocerLugar(sinRelacion);
  const capa = reconocerCapa(resto)?.capa ?? (intencion === 'poblacion' ? 'localidades' : undefined);
  const conocidas = new Set(capa ? reconocerCapa(resto)?.termino.split(' ') ?? [] : []);
  const desconocidas = resto.split(' ').filter(p => p.length > 2 && !VACIAS.has(p) && !conocidas.has(p) && !/^\d/.test(p));

  const parcial: Partial<Interpretacion> = { intencion, capa, lugar, relacion };
  if (intencion === 'tablero') {
    return { interpretacion: { intencion, capa: 'red_vial', relacion: { tipo: 'cerca', desde: 0, hasta: 0 }, lugar: { tipo: 'rn11' } }, parcial, desconocidas };
  }
  if (!capa || !lugar) return { parcial, desconocidas };
  // "escuelas en Resistencia": dentro de una provincia, o a 5 km de una localidad o de la ruta.
  const final: Relacion = relacion ?? (lugar.tipo === 'provincia' ? { tipo: 'dentro', desde: 0, hasta: 0 } : { tipo: 'cerca', desde: 0, hasta: lugar.tipo === 'rn11' ? 1000 : 5000 });
  return { interpretacion: { intencion, capa, relacion: final, lugar }, parcial, desconocidas };
}

// --- Cómo se lee una interpretación ---

const distancia = (metros: number) => (metros >= 1000 ? `${(metros / 1000).toLocaleString('es-AR')} km` : `${metros} m`);
const nombreLugar = (lugar: Lugar) => (lugar.tipo === 'rn11' ? 'la RN11 en Chaco' : lugar.tipo === 'provincia' ? lugar.nombre : capitalizar(lugar.nombre));
const capitalizar = (texto: string) => texto.replace(/(^|\s)\S/g, l => l.toUpperCase());

export function describir(i: Interpretacion): string {
  if (i.intencion === 'tablero') return 'Longitud, población y puentes de la RN11 en Chaco';
  const capa = tituloDeCapa(i.capa);
  const sujeto = i.intencion === 'poblacion' ? 'Población' : i.intencion === 'contar' ? `Cuántas: ${capa.toLowerCase()}` : capa;
  if (i.relacion.tipo === 'dentro') return `${sujeto} en ${nombreLugar(i.lugar)}`;
  if (i.relacion.hasta <= 100) return `${sujeto} sobre ${nombreLugar(i.lugar)}`;
  if (i.relacion.desde > 0) return `${sujeto} entre ${distancia(i.relacion.desde)} y ${distancia(i.relacion.hasta)} de ${nombreLugar(i.lugar)}`;
  return `${sujeto} a menos de ${distancia(i.relacion.hasta)} de ${nombreLugar(i.lugar)}`;
}

export const claveDe = (i: Interpretacion) => normalizar(describir(i));

// --- Árbol de posibilidades: capas × relaciones × lugares, más las preguntas de la parte B ---

const CAPAS_FRECUENTES = ['localidades', 'puente_red_vial_puntos', 'edif_educacion', 'edificio_de_salud_ips', 'curso_de_agua_hid',
  'espejo_de_agua_hid', 'red_ferroviaria', 'obras_rn11', 'edificio_de_seguridad_ips', 'infraestructura_aeroportuaria_punto'];
const LUGARES: Lugar[] = [{ tipo: 'rn11' }, { tipo: 'provincia', nombre: 'Chaco' }, { tipo: 'localidad', nombre: 'resistencia' }, { tipo: 'provincia', nombre: 'Corrientes' }];

const PARTE_B: Interpretacion[] = [
  { intencion: 'tablero', capa: 'red_vial', relacion: { tipo: 'cerca', desde: 0, hasta: 0 }, lugar: { tipo: 'rn11' } },
  { intencion: 'poblacion', capa: 'localidades', relacion: { tipo: 'cerca', desde: 0, hasta: 10_000 }, lugar: { tipo: 'rn11' } },
  { intencion: 'poblacion', capa: 'localidades', relacion: { tipo: 'cerca', desde: 10_000, hasta: 20_000 }, lugar: { tipo: 'rn11' } },
  { intencion: 'listar', capa: 'puente_red_vial_puntos', relacion: { tipo: 'cerca', desde: 0, hasta: 100 }, lugar: { tipo: 'rn11' } },
];

export function arbol(): Interpretacion[] {
  const frases: Interpretacion[] = [...PARTE_B];
  for (const capa of CAPAS_FRECUENTES) {
    for (const lugar of LUGARES) {
      if (lugar.tipo === 'provincia') frases.push({ intencion: 'listar', capa, relacion: { tipo: 'dentro', desde: 0, hasta: 0 }, lugar });
      else for (const hasta of lugar.tipo === 'rn11' ? [5000, 10_000, 20_000] : [5000, 20_000]) {
        frases.push({ intencion: 'listar', capa, relacion: { tipo: 'cerca', desde: 0, hasta }, lugar });
      }
    }
  }
  return frases;
}

// Las frases del árbol (y las ya consultadas) que más se parecen a lo escrito. Pesa más lo consultado.
export function sugerir(entrada: string, maximo = 4): Interpretacion[] {
  const palabras = normalizar(entrada).split(' ').filter(p => p.length > 1 && !VACIAS.has(p)).map(singular);
  const { parcial } = interpretar(entrada);
  const usos = new Map(aprendidos('consulta').map(c => [c.clave, c.usos]));
  const consultadas = aprendidos('consulta').flatMap(c => {
    try {
      return [JSON.parse(c.valor) as Interpretacion];
    } catch {
      return [];
    }
  });
  const candidatas = [...consultadas, ...arbol()].filter((i, n, todas) => todas.findIndex(o => claveDe(o) === claveDe(i)) === n);
  return candidatas
    .map(i => {
      const texto = normalizar(describir(i)).split(' ').map(singular);
      let puntos = palabras.filter(p => texto.some(t => t.startsWith(p) || p.startsWith(t))).length * 3;
      if (parcial.capa && parcial.capa === i.capa) puntos += 5;
      if (parcial.lugar && JSON.stringify(parcial.lugar) === JSON.stringify(i.lugar)) puntos += 4;
      if (parcial.intencion && parcial.intencion !== 'listar' && parcial.intencion === i.intencion) puntos += 3;
      puntos += Math.min(usos.get(claveDe(i)) ?? 0, 10) * 0.5;
      return { i, puntos };
    })
    .filter(c => c.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, maximo)
    .map(c => c.i);
}

// Lo más consultado por el equipo, para el buscador vacío.
export function masConsultadas(maximo = 3): Interpretacion[] {
  return aprendidos('consulta')
    .sort((a, b) => b.usos - a.usos)
    .slice(0, maximo)
    .flatMap(c => {
      try {
        return [JSON.parse(c.valor) as Interpretacion];
      } catch {
        return [];
      }
    });
}

export const geometriaDeCapa = (capa: string): Geometria => CAPAS.find(c => c.nombre === capa)?.geometria ?? 'punto';
