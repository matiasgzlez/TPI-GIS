import { createContext, useContext } from 'react';
import { tituloDeCapa } from './config';

// Las dos interfaces del visor. Comparten el mapa, las capas prendidas, la selección y las funciones;
// cambia cómo se muestran y cómo se habla.
// - simple: para cualquiera, "hasta un nene de 5 años": temáticas con dibujos, botones grandes y nada de
//   jerga (capa, entidad, WMS, WFS, feature).
// - pro: más herramientas y datos a la vista, con jerarquía de herramienta GIS.
export type Interfaz = 'simple' | 'pro';

export const InterfazContexto = createContext<Interfaz>('pro');
export const useInterfaz = () => useContext(InterfazContexto);

// Palabras que cambian según la interfaz. Lo técnico va solo en la profesional.
const VOCES = {
  pro: {
    entidad: 'entidad', entidades: 'entidades', capa: 'capa', capas: 'capas',
    cargando: 'Consultando GeoServer…', buscando: 'Buscando entidades…',
    errorAyuda: 'Revisá que GeoServer esté levantado (docker compose up -d) y volvé a consultar.',
    origenPunto: 'Consulta por punto', origenRectangulo: 'Consulta por rectángulo', origenLenguaje: 'Pregunta',
    vacioPunto: 'Ninguna capa prendida tiene entidades en ese punto. Probá acercarte o prender otras capas.',
    vacioRectangulo: 'Ninguna capa prendida tiene entidades dentro del rectángulo.',
    sinEntidades: 'Sin entidades en ese lugar',
  },
  simple: {
    entidad: 'cosa', entidades: 'cosas', capa: 'tema', capas: 'temas',
    cargando: 'Buscando…', buscando: 'Buscando qué hay…',
    errorAyuda: 'El mapa no contestó. Esperá un momento y probá de nuevo.',
    origenPunto: '¿Qué hay acá?', origenRectangulo: 'Lo que hay en la zona', origenLenguaje: 'Tu pregunta',
    vacioPunto: 'Acá no encontramos nada de lo que estás viendo. Probá tocar más cerca de algo o mostrar más cosas en el mapa.',
    vacioRectangulo: 'En esa zona no hay nada de lo que estás viendo. Probá con una zona más grande.',
    sinEntidades: 'No encontramos nada acá',
  },
} as const;

export type Voz = keyof typeof VOCES.pro;
export const useVoz = () => {
  const interfaz = useInterfaz();
  return (clave: Voz) => VOCES[interfaz][clave];
};

// --- Modo simple: temáticas y nombres de todos los días ---

export interface CapaSimple {
  nombre: string;
  // Cómo se le dice en la calle y una frase que explica qué es.
  titulo: string;
  frase: string;
}

export interface Tematica {
  id: string;
  titulo: string;
  frase: string;
  // Color del dibujo de la temática (una de las variables --tema-*).
  color: string;
  capas: CapaSimple[];
}

// Las 48 capas, en 9 temáticas. Cada capa está una sola vez.
export const TEMATICAS: Tematica[] = [
  {
    id: 'ruta', titulo: 'La ruta 11', frase: 'Las obras que se hacen en la ruta', color: 'var(--tema-ruta)',
    capas: [{ nombre: 'obras_rn11', titulo: 'Obras en la ruta', frase: 'Arreglos que hay que hacer en la ruta 11' }],
  },
  {
    id: 'pueblos', titulo: 'Pueblos y ciudades', frase: 'Dónde vive la gente', color: 'var(--tema-pueblos)',
    capas: [
      { nombre: 'localidades', titulo: 'Pueblos y ciudades', frase: 'Cada puntito es un lugar donde vive gente' },
      { nombre: 'ejido', titulo: 'Zonas urbanas', frase: 'Hasta dónde llega cada pueblo' },
      { nombre: 'provincias', titulo: 'Provincias', frase: 'Las 24 partes de la Argentina' },
      { nombre: 'limite_politico_administrativo_lim', titulo: 'Bordes', frase: 'Las líneas que separan provincias y países' },
      { nombre: 'pais_lim', titulo: 'Países vecinos', frase: 'Los países que están al lado' },
    ],
  },
  {
    id: 'caminos', titulo: 'Caminos y viajes', frase: 'Rutas, trenes, puentes y aeropuertos', color: 'var(--tema-caminos)',
    capas: [
      { nombre: 'red_vial', titulo: 'Rutas y caminos', frase: 'Por donde andan los autos y los camiones' },
      { nombre: 'vias_secundarias', titulo: 'Caminos chicos', frase: 'Calles y caminos de tierra' },
      { nombre: 'puente_red_vial_puntos', titulo: 'Puentes', frase: 'Donde la ruta cruza un río' },
      { nombre: 'red_ferroviaria', titulo: 'Vías del tren', frase: 'Por donde pasa el tren' },
      { nombre: 'edificios_ferroviarios', titulo: 'Estaciones de tren', frase: 'Donde para el tren' },
      { nombre: 'infraestructura_aeroportuaria_punto', titulo: 'Aeropuertos', frase: 'Donde aterrizan los aviones' },
      { nombre: 'estructuras_portuarias', titulo: 'Puertos', frase: 'Donde llegan los barcos' },
      { nombre: 'obra_portuaria', titulo: 'Muelles', frase: 'Obras para que atraquen los barcos' },
      { nombre: 'salvado_de_obstaculo', titulo: 'Pasos y alcantarillas', frase: 'Donde el camino pasa por arriba de algo' },
      { nombre: 'marcas_y_senales', titulo: 'Mojones', frase: 'Marcas que indican lugares del camino' },
      { nombre: 'senalizaciones', titulo: 'Señales', frase: 'Carteles y señales' },
    ],
  },
  {
    id: 'agua', titulo: 'Agua', frase: 'Ríos, lagunas e islas', color: 'var(--tema-agua)',
    capas: [
      { nombre: 'curso_de_agua_hid', titulo: 'Ríos y arroyos', frase: 'Agua que corre' },
      { nombre: 'espejo_de_agua_hid', titulo: 'Lagunas y bañados', frase: 'Agua quieta' },
      { nombre: 'isla', titulo: 'Islas', frase: 'Tierra con agua alrededor' },
      { nombre: 'veg_hidrofila', titulo: 'Plantas de agua', frase: 'Juncos y plantas que viven en el agua' },
      { nombre: 'infraestructura_hidro', titulo: 'Obras de agua', frase: 'Canales, bombas y tomas de agua' },
      { nombre: 'muro_embalse', titulo: 'Diques', frase: 'Paredes que frenan el agua' },
    ],
  },
  {
    id: 'servicios', titulo: 'Escuelas, salud y más', frase: 'Lugares a los que va la gente', color: 'var(--tema-servicios)',
    capas: [
      { nombre: 'edif_educacion', titulo: 'Escuelas', frase: 'Escuelas, colegios y universidades' },
      { nombre: 'edificio_de_salud_ips', titulo: 'Hospitales', frase: 'Donde te curan' },
      { nombre: 'edificio_de_seguridad_ips', titulo: 'Policía y bomberos', frase: 'Los que nos cuidan' },
      { nombre: 'edificio_publico_ips', titulo: 'Edificios públicos', frase: 'Municipios y oficinas del Estado' },
      { nombre: 'edif_religiosos', titulo: 'Iglesias y templos', frase: 'Lugares para rezar' },
      { nombre: 'edif_depor_y_esparcimiento', titulo: 'Clubes y plazas', frase: 'Para jugar y hacer deporte' },
      { nombre: 'edif_construcciones_turisticas', titulo: 'Turismo', frase: 'Lugares para visitar' },
      { nombre: 'otras_edificaciones', titulo: 'Casas y galpones', frase: 'Otras construcciones' },
    ],
  },
  {
    id: 'naturaleza', titulo: 'Naturaleza', frase: 'Bosques, campos y suelos', color: 'var(--tema-naturaleza)',
    capas: [
      { nombre: 'veg_arborea', titulo: 'Bosques', frase: 'Donde hay muchos árboles' },
      { nombre: 'veg_arbustiva', titulo: 'Arbustos', frase: 'Plantas bajitas' },
      { nombre: 'veg_cultivos', titulo: 'Campos sembrados', frase: 'Donde se cultiva' },
      { nombre: 'veg_suelo_desnudo', titulo: 'Tierra sin plantas', frase: 'Suelo pelado' },
      { nombre: 'sue_consolidado', titulo: 'Suelo firme', frase: 'Roca y tierra dura' },
      { nombre: 'sue_no_consolidado', titulo: 'Arena y médanos', frase: 'Suelo suelto' },
      { nombre: 'sue_hidromorfologico', titulo: 'Suelo mojado', frase: 'Tierra que se inunda' },
      { nombre: 'sue_costero', titulo: 'Costas', frase: 'La orilla del mar' },
      { nombre: 'sue_congelado', titulo: 'Hielo', frase: 'Glaciares y nieve' },
    ],
  },
  {
    id: 'relieve', titulo: 'Montañas y alturas', frase: 'Qué tan alto es cada lugar', color: 'var(--tema-relieve)',
    capas: [
      { nombre: 'curvas_de_nivel', titulo: 'Líneas de altura', frase: 'Unen lugares a la misma altura' },
      { nombre: 'puntos_de_alturas_topograficas', titulo: 'Cerros y picos', frase: 'Puntos con su altura' },
      { nombre: 'puntos_del_terreno', titulo: 'Puntos medidos', frase: 'Lugares donde se midió la altura' },
    ],
  },
  {
    id: 'energia', titulo: 'Luz y comunicación', frase: 'Centrales, cables y antenas', color: 'var(--tema-energia)',
    capas: [
      { nombre: 'complejo_de_energia_ene', titulo: 'Centrales de energía', frase: 'Donde se hace la luz' },
      { nombre: 'lineas_de_conduccion_ene', titulo: 'Cables de alta tensión', frase: 'Llevan la luz lejos' },
      { nombre: 'obra_de_comunicacion', titulo: 'Antenas', frase: 'Para el teléfono, la radio y la tele' },
    ],
  },
  {
    id: 'trabajo', titulo: 'Trabajo', frase: 'Campos, fábricas y comercios', color: 'var(--tema-trabajo)',
    capas: [
      { nombre: 'actividades_agropecuarias', titulo: 'Campo', frase: 'Estancias, tambos y granjas' },
      { nombre: 'actividades_economicas', titulo: 'Fábricas y comercios', frase: 'Donde trabaja la gente' },
    ],
  },
];

export const capaSimple = (nombre: string) => TEMATICAS.flatMap(t => t.capas).find(c => c.nombre === nombre);
export const miniatura = (nombre: string) => `${import.meta.env.BASE_URL}miniaturas/${nombre}.png`;

// Las herramientas con palabras de todos los días: los botones grandes y el buscador del modo simple.
export const HERRAMIENTAS_SIMPLES: Record<'navegar' | 'punto' | 'rectangulo' | 'distancia' | 'area' | 'alta', { titulo: string; corto: string; pista: string }> = {
  navegar: { titulo: 'Mover el mapa', corto: 'Mover', pista: 'Arrastrá para moverte. Con la rueda o dos dedos, acercás.' },
  punto: { titulo: '¿Qué hay acá?', corto: '¿Qué hay?', pista: 'Tocá cualquier lugar del mapa y te contamos qué hay.' },
  rectangulo: { titulo: 'Ver una zona', corto: 'Zona', pista: 'Arrastrá para dibujar un rectángulo: te mostramos todo lo que hay adentro.' },
  distancia: { titulo: 'Medir qué tan lejos', corto: 'Medir', pista: 'Tocá donde empieza y donde termina. Tocá dos veces para terminar.' },
  area: { titulo: 'Medir qué tan grande', corto: 'Medir', pista: 'Tocá las esquinas del lugar. Tocá dos veces para cerrarlo.' },
  alta: { titulo: 'Agregar una obra', corto: 'Obra', pista: 'Tocá la ruta 11 donde hay que hacer un arreglo.' },
};

// "RN11" no le dice nada a un chico: "la ruta 11".
export const sinSiglas = (texto: string) => texto.replace(/\bla RN ?(\d+)/g, 'la ruta $1').replace(/\bRN ?(\d+)/g, 'ruta $1');

// ¿Hay un diálogo modal abierto (bienvenida, guía o Configuración)? Los atajos globales del visor
// (1–6, Escape, "/" y ⌘K, Escape de Referencias) lo consultan acá para no actuar detrás de él.
export const hayDialogoModal = () => !!document.querySelector('[aria-modal="true"]');

// ¿La tecla va a un lugar donde se escribe? Un interruptor, una casilla o un deslizador también son
// <input>, pero no se escribe en ellos: los atajos tienen que seguir andando después de tocarlos.
export const escribiendoEn = (destino: EventTarget | null) => destino instanceof HTMLElement && !!destino.closest(
  'textarea, [contenteditable="true"], [role="listbox"], form, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"])',
);

// El título de una respuesta en el modo simple: cada capa se nombra como en "¿Qué querés ver?"
// ("Escuelas a menos de…", no "Educación…") y sin siglas ("la ruta 11", no "la RN11"). Lo usan el
// panel de resultados y el PDF.
export function tituloSimple(titulo: string, capas: { capa: string }[]) {
  let texto = titulo;
  for (const { capa } of capas) {
    const propio = tituloDeCapa(capa);
    const simple = capaSimple(capa)?.titulo;
    if (!simple || simple === propio) continue;
    texto = texto.replace(propio, simple).replace(propio.toLowerCase(), simple.toLowerCase());
  }
  return sinSiglas(texto);
}
