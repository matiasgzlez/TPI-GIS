import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import VectorSource from 'ol/source/Vector';
import { defaults as controlesPorDefecto, ScaleLine, ZoomToExtent } from 'ol/control';
import { getPointResolution } from 'ol/proj';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import { CAPAS, EXTENSION_CHACO, URL_WMS, WORKSPACE } from './config';

// Todo lo que las herramientas necesitan del mapa.
export interface Visor {
  mapa: Map;
  base: TileLayer<OSM>;
  capas: TileLayer<TileWMS>[];
  dibujo: VectorSource;
}

export function crearVisor(destino: HTMLElement): Visor {
  const base = new TileLayer({ source: new OSM(), properties: { titulo: 'OpenStreetMap' } });
  const capas = CAPAS.map(({ nombre, titulo, visible }) => new TileLayer({
    visible,
    properties: { nombre, titulo },
    source: new TileWMS({ url: URL_WMS, params: { LAYERS: `${WORKSPACE}:${nombre}`, TILED: true } }),
  }));
  const dibujo = new VectorSource();
  const resaltado = new VectorLayer({
    source: dibujo,
    style: new Style({
      stroke: new Stroke({ color: '#e00', width: 3 }),
      fill: new Fill({ color: 'rgba(255,0,0,0.1)' }),
      image: new Circle({ radius: 6, fill: new Fill({ color: '#e00' }) }),
    }),
  });

  const mapa = new Map({
    target: destino,
    layers: [base, ...capas, resaltado],
    view: new View(),
    controls: controlesPorDefecto().extend([new ScaleLine(), new ZoomToExtent({ extent: EXTENSION_CHACO })]),
  });
  // Sin size, fit() usa un tamaño por defecto de 100 px porque el mapa todavía no se dibujó.
  mapa.getView().fit(EXTENSION_CHACO, { size: mapa.getSize() });
  return { mapa, base, capas, dibujo };
}

export const capasVisibles = (visor: Visor) =>
  visor.capas.filter(c => c.getVisible()).map(c => c.get('nombre') as string);

// Denominador de escala corregido por latitud (Mercator agranda hacia los polos).
export function denominadorEscala(mapa: Map): string {
  const vista = mapa.getView();
  const resolucion = getPointResolution('EPSG:3857', vista.getResolution()!, vista.getCenter()!);
  return `1:${Math.round(resolucion / 0.00028).toLocaleString('es-AR')}`;
}

export function refrescarCapa(visor: Visor, nombre: string) {
  visor.capas.find(c => c.get('nombre') === nombre)?.getSource()?.updateParams({ _: Date.now() });
}
