import TileLayer from 'ol/layer/Tile';
import Attribution from 'ol/control/Attribution';
import XYZ from 'ol/source/XYZ';
import { actualizarWms, type Visor } from './visor';
import { usarFondoExterno } from './estilos';

// Mapas base externos, debajo de las capas de GeoServer. "Papel" es el fondo propio del visor (sin capa).
export interface MapaBase { id: string; titulo: string; detalle: string; url?: string; atribucion?: string }

export const MAPAS_BASE: MapaBase[] = [
  { id: 'papel', titulo: 'Papel', detalle: 'El fondo propio del visor, sin servicios externos' },
  { id: 'argenmap', titulo: 'Argenmap', detalle: 'Mapa base oficial del IGN (TMS)', url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png', atribucion: '© Instituto Geográfico Nacional' },
  { id: 'argenmap-gris', titulo: 'Argenmap gris', detalle: 'IGN en grises, para que resalten las capas', url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png', atribucion: '© Instituto Geográfico Nacional' },
  { id: 'satelite', titulo: 'Satélite', detalle: 'Imágenes Esri World Imagery', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', atribucion: '© Esri, Maxar, Earthstar Geographics' },
  { id: 'osm', titulo: 'OpenStreetMap', detalle: 'Cartografía colaborativa', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', atribucion: '© colaboradores de OpenStreetMap' },
];

const CLAVE = 'mapa-base';
let capa: TileLayer<XYZ> | null = null;
// La fuente del fondo, sobre el mapa (abajo a la derecha), mientras hay un fondo externo.
const atribucion = new Attribution({ collapsible: false, className: 'ol-attribution atribucion-base' });

export const mapaBaseGuardado = () => {
  try { return localStorage.getItem(CLAVE) ?? 'papel'; } catch { return 'papel'; }
};

// Con un mapa base, las provincias del WMS se dibujan sin relleno (estilos.ts) para que se vea lo de abajo.
export function ponerMapaBase(visor: Visor, id: string, guardar = true) {
  const base = MAPAS_BASE.find(b => b.id === id) ?? MAPAS_BASE[0];
  if (guardar) try { localStorage.setItem(CLAVE, base.id); } catch { /* sin almacenamiento */ }
  const habia = !!capa;
  if (capa) { visor.mapa.removeLayer(capa); visor.mapa.removeControl(atribucion); capa = null; }
  document.documentElement.dataset.mapaBase = base.id;
  usarFondoExterno(!!base.url);
  if (habia !== !!base.url) actualizarWms(visor);
  if (!base.url) return;
  capa = new TileLayer({
    className: 'capa-base',
    zIndex: -1,
    source: new XYZ({ url: base.url, crossOrigin: 'anonymous', attributions: base.atribucion, maxZoom: 19 }),
  });
  visor.mapa.addLayer(capa);
  visor.mapa.addControl(atribucion);
}
