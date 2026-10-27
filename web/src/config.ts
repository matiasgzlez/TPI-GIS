import { transformExtent } from 'ol/proj';

export const WORKSPACE = 'tpi';
export const NAMESPACE = 'https://github.com/matiasgzlez/TPI-GIS';
export const URL_WMS = `/geoserver/${WORKSPACE}/wms`;
export const URL_WFS = `/geoserver/${WORKSPACE}/ows`;
// Lo atiende el proxy (Vite o nginx), que agrega las credenciales del editor.
export const URL_WFST = '/wfst';

export interface Capa {
  nombre: string;
  titulo: string;
  visible: boolean;
}

// De abajo hacia arriba en el mapa.
export const CAPAS: Capa[] = [
  { nombre: 'provincias', titulo: 'Provincias', visible: true },
  { nombre: 'red_vial', titulo: 'Red vial', visible: true },
  { nombre: 'localidades', titulo: 'Localidades', visible: true },
  { nombre: 'puente_red_vial_puntos', titulo: 'Puentes', visible: false },
  { nombre: 'obras_rn11', titulo: 'Obras RN11', visible: true },
];

export const EXTENSION_CHACO = transformExtent([-63.5, -28.1, -58.3, -24.0], 'EPSG:4326', 'EPSG:3857');

export const TIPOS_OBRA = ['bacheo', 'repavimentacion', 'banquina', 'senalizacion', 'puente', 'drenaje', 'otro'];
export const PRIORIDADES = ['alta', 'media', 'baja'];
