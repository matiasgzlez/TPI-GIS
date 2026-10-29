import { transformExtent } from 'ol/proj';

export const WORKSPACE = 'tpi';
export const NAMESPACE = 'https://github.com/matiasgzlez/TPI-GIS';
export const URL_WMS = `/geoserver/${WORKSPACE}/wms`;
export const URL_WFS = `/geoserver/${WORKSPACE}/ows`;
// Lo atiende el proxy (Vite o nginx), que agrega las credenciales del editor.
export const URL_WFST = '/wfst';

// La geometría decide el orden de dibujo: polígonos abajo, líneas en el medio, puntos arriba.
export type Geometria = 'poligono' | 'linea' | 'punto';

export interface Capa {
  nombre: string;
  titulo: string;
  geometria: Geometria;
  visible?: boolean;
}

export interface Grupo {
  id: string;
  titulo: string;
  capas: Capa[];
}

// Las 48 capas de GeoServer, agrupadas por tema. Prendidas al iniciar: el contexto de la RN11.
export const GRUPOS: Grupo[] = [
  {
    id: 'proyecto',
    titulo: 'Proyecto RN11',
    capas: [{ nombre: 'obras_rn11', titulo: 'Obras de mantenimiento', geometria: 'punto', visible: true }],
  },
  {
    id: 'limites',
    titulo: 'Límites y localidades',
    capas: [
      { nombre: 'localidades', titulo: 'Localidades', geometria: 'punto', visible: true },
      { nombre: 'limite_politico_administrativo_lim', titulo: 'Límites político-administrativos', geometria: 'linea', visible: true },
      { nombre: 'ejido', titulo: 'Ejidos urbanos', geometria: 'poligono' },
      { nombre: 'provincias', titulo: 'Provincias', geometria: 'poligono', visible: true },
      { nombre: 'pais_lim', titulo: 'Países limítrofes', geometria: 'poligono' },
    ],
  },
  {
    id: 'transporte',
    titulo: 'Transporte',
    capas: [
      { nombre: 'red_vial', titulo: 'Red vial', geometria: 'linea', visible: true },
      { nombre: 'vias_secundarias', titulo: 'Vías secundarias', geometria: 'linea' },
      { nombre: 'puente_red_vial_puntos', titulo: 'Puentes', geometria: 'punto' },
      { nombre: 'red_ferroviaria', titulo: 'Red ferroviaria', geometria: 'linea' },
      { nombre: 'edificios_ferroviarios', titulo: 'Edificios ferroviarios', geometria: 'punto' },
      { nombre: 'salvado_de_obstaculo', titulo: 'Salvado de obstáculos', geometria: 'punto' },
      { nombre: 'marcas_y_senales', titulo: 'Marcas y señales', geometria: 'punto' },
      { nombre: 'senalizaciones', titulo: 'Señalizaciones', geometria: 'punto' },
      { nombre: 'infraestructura_aeroportuaria_punto', titulo: 'Infraestructura aeroportuaria', geometria: 'punto' },
      { nombre: 'estructuras_portuarias', titulo: 'Estructuras portuarias', geometria: 'punto' },
      { nombre: 'obra_portuaria', titulo: 'Obras portuarias', geometria: 'punto' },
    ],
  },
  {
    id: 'hidrografia',
    titulo: 'Hidrografía',
    capas: [
      { nombre: 'curso_de_agua_hid', titulo: 'Cursos de agua', geometria: 'linea', visible: true },
      { nombre: 'espejo_de_agua_hid', titulo: 'Espejos de agua', geometria: 'poligono', visible: true },
      { nombre: 'isla', titulo: 'Islas', geometria: 'poligono' },
      { nombre: 'infraestructura_hidro', titulo: 'Infraestructura hídrica', geometria: 'punto' },
      { nombre: 'muro_embalse', titulo: 'Muros de embalse', geometria: 'linea' },
    ],
  },
  {
    id: 'relieve',
    titulo: 'Relieve',
    capas: [
      { nombre: 'curvas_de_nivel', titulo: 'Curvas de nivel', geometria: 'linea' },
      { nombre: 'puntos_de_alturas_topograficas', titulo: 'Alturas topográficas', geometria: 'punto' },
      { nombre: 'puntos_del_terreno', titulo: 'Puntos del terreno', geometria: 'punto' },
    ],
  },
  {
    id: 'suelos',
    titulo: 'Suelos',
    capas: [
      { nombre: 'sue_consolidado', titulo: 'Suelo consolidado', geometria: 'poligono' },
      { nombre: 'sue_no_consolidado', titulo: 'Suelo no consolidado', geometria: 'poligono' },
      { nombre: 'sue_hidromorfologico', titulo: 'Suelo hidromorfológico', geometria: 'poligono' },
      { nombre: 'sue_costero', titulo: 'Suelo costero', geometria: 'poligono' },
      { nombre: 'sue_congelado', titulo: 'Suelo congelado', geometria: 'poligono' },
    ],
  },
  {
    id: 'vegetacion',
    titulo: 'Vegetación',
    capas: [
      { nombre: 'veg_arborea', titulo: 'Arbórea', geometria: 'poligono' },
      { nombre: 'veg_arbustiva', titulo: 'Arbustiva', geometria: 'poligono' },
      { nombre: 'veg_cultivos', titulo: 'Cultivos', geometria: 'poligono' },
      { nombre: 'veg_hidrofila', titulo: 'Hidrófila', geometria: 'poligono' },
      { nombre: 'veg_suelo_desnudo', titulo: 'Suelo desnudo', geometria: 'poligono' },
    ],
  },
  {
    id: 'edificaciones',
    titulo: 'Edificaciones',
    capas: [
      { nombre: 'edif_educacion', titulo: 'Educación', geometria: 'punto' },
      { nombre: 'edificio_de_salud_ips', titulo: 'Salud', geometria: 'punto' },
      { nombre: 'edificio_de_seguridad_ips', titulo: 'Seguridad', geometria: 'punto' },
      { nombre: 'edificio_publico_ips', titulo: 'Edificios públicos', geometria: 'punto' },
      { nombre: 'edif_religiosos', titulo: 'Religiosos', geometria: 'punto' },
      { nombre: 'edif_depor_y_esparcimiento', titulo: 'Deporte y esparcimiento', geometria: 'punto' },
      { nombre: 'edif_construcciones_turisticas', titulo: 'Turismo', geometria: 'punto' },
      { nombre: 'otras_edificaciones', titulo: 'Otras edificaciones', geometria: 'punto' },
    ],
  },
  {
    id: 'energia',
    titulo: 'Energía y comunicaciones',
    capas: [
      { nombre: 'complejo_de_energia_ene', titulo: 'Complejos de energía', geometria: 'punto' },
      { nombre: 'lineas_de_conduccion_ene', titulo: 'Líneas de conducción', geometria: 'linea' },
      { nombre: 'obra_de_comunicacion', titulo: 'Obras de comunicación', geometria: 'punto' },
    ],
  },
  {
    id: 'economia',
    titulo: 'Actividades económicas',
    capas: [
      { nombre: 'actividades_agropecuarias', titulo: 'Agropecuarias', geometria: 'punto' },
      { nombre: 'actividades_economicas', titulo: 'Económicas', geometria: 'punto' },
    ],
  },
];

export const CAPAS: Capa[] = GRUPOS.flatMap(g => g.capas);
export const tituloDeCapa = (nombre: string) => CAPAS.find(c => c.nombre === nombre)?.titulo ?? nombre;

export const EXTENSION_CHACO = transformExtent([-63.5, -28.1, -58.3, -24.0], 'EPSG:4326', 'EPSG:3857');

// La traza que analiza la parte B: ruta nacional 11 dentro de Chaco.
export const FILTRO_RN11 = "nro_ruta = '11' AND administra = 'Nacional'";

export const TIPOS_OBRA = ['bacheo', 'repavimentacion', 'banquina', 'senalizacion', 'puente', 'drenaje', 'otro'];
export const PRIORIDADES = ['alta', 'media', 'baja'];
