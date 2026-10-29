import { useEffect, useRef } from 'react';
import { OverviewMap } from 'ol/control';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import View from 'ol/View';
import { URL_WMS } from '../config';
import { ESTILO_MINIMAPA } from '../estilos';
import type { Visor } from '../visor';

// Minimapa de ubicación (OverviewMap de OpenLayers) con las provincias de GeoServer.
export default function Minimapa({ visor }: { visor: Visor }) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const control = new OverviewMap({
      target: contenedor.current!,
      collapsed: false,
      collapsible: false,
      layers: [new TileLayer({
        className: 'capa-wms',
        source: new TileWMS({ url: URL_WMS, params: { LAYERS: 'provincias', TILED: true, SLD_BODY: ESTILO_MINIMAPA } }),
      })],
      // Zoom fijo: Argentina entera llena el cuadro y el recuadro naranja marca dónde está la vista.
      view: new View({ zoom: 2.15, minZoom: 2.15, maxZoom: 2.15 }),
    });
    visor.mapa.addControl(control);
    return () => {
      visor.mapa.removeControl(control);
    };
  }, [visor]);

  return <div ref={contenedor} className="minimapa panel size-[148px] overflow-hidden" aria-label="Minimapa de ubicación" />;
}
