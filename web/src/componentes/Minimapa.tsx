import { useEffect, useRef } from 'react';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import TileWMS from 'ol/source/TileWMS';
import VectorSource from 'ol/source/Vector';
import { fromExtent } from 'ol/geom/Polygon';
import { Point } from 'ol/geom';
import { getCenter, getHeight, getWidth } from 'ol/extent';
import { unByKey } from 'ol/Observable';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import type { FeatureLike } from 'ol/Feature';
import { URL_WMS } from '../config';
import { ESTILO_MINIMAPA } from '../estilos';
import { movimientoReducido } from '../preferencias';
import type { Visor } from '../visor';

// Cuánto más lejos mira el minimapa que el mapa principal, y entre qué escalas: nunca más cerca que
// una región (unos 300 km de lado, si no solo se verían líneas de provincia) ni más lejos que el país.
const FACTOR = 16;
const RESOLUCION_MINIMA = 2_000;
const RESOLUCION_MAXIMA = 34_000;
// Por debajo de este tamaño en pantalla el recuadro de la vista se dibuja como un punto.
const LADO_MINIMO = 7;

const color = (nombre: string, respaldo: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || respaldo;

// El canvas no garantiza entender color-mix(): el color del tema va en hex y se pasa a rgba.
function transparente(hex: string, alfa: number) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
}

function estiloRecuadro(feature: FeatureLike, resolucion: number) {
  const vial = color('--vial', '#e5521f');
  const papel = color('--papel', '#eceeeb');
  const extension = feature.getGeometry()!.getExtent();
  if (Math.max(getWidth(extension), getHeight(extension)) / resolucion < LADO_MINIMO) {
    return new Style({
      geometry: new Point(getCenter(extension)),
      image: new Circle({ radius: 4.5, fill: new Fill({ color: vial }), stroke: new Stroke({ color: papel, width: 2 }) }),
    });
  }
  return [
    new Style({ stroke: new Stroke({ color: papel, width: 4 }) }),
    new Style({ stroke: new Stroke({ color: vial, width: 2 }), fill: new Fill({ color: transparente(vial, 0.14) }) }),
  ];
}

// Minimapa de ubicación: un mapa chico con las provincias de GeoServer que acompaña al principal en
// cada cuadro (al arrastrar, al hacer zoom, durante los vuelos). El recuadro naranja es la vista actual.
// Al pasar el mouse por encima, el recuadro sigue al cursor y el mapa principal va con él; mientras
// tanto el minimapa se queda quieto (si se recentrara, se correría bajo el cursor y todo derivaría) y
// al salir vuelve a centrarse en la vista.
export default function Minimapa({ visor }: { visor: Visor }) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const principal = visor.mapa;
    const vistaPrincipal = principal.getView();
    const recuadro = new Feature();
    const vista = new View({ constrainResolution: false, smoothResolutionConstraint: false });
    const mini = new Map({
      target: contenedor.current!,
      controls: [],
      interactions: [],
      layers: [
        new TileLayer({
          className: 'capa-wms',
          preload: Infinity,
          source: new TileWMS({ url: URL_WMS, params: { LAYERS: 'provincias', TILED: true, SLD_BODY: ESTILO_MINIMAPA }, transition: 0 }),
        }),
        new VectorLayer({ source: new VectorSource({ features: [recuadro] }), style: estiloRecuadro, updateWhileAnimating: true, updateWhileInteracting: true }),
      ],
      view: vista,
    });

    let explorando = false;
    const encuadre = () => {
      const centro = vistaPrincipal.getCenter();
      const resolucion = vistaPrincipal.getResolution();
      if (!centro || !resolucion) return null;
      return { center: centro, resolution: Math.min(Math.max(resolucion * FACTOR, RESOLUCION_MINIMA), RESOLUCION_MAXIMA) };
    };
    const seguir = () => {
      const tamaño = principal.getSize();
      if (tamaño && vistaPrincipal.getCenter()) recuadro.setGeometry(fromExtent(vistaPrincipal.calculateExtent(tamaño)));
      const destino = encuadre();
      if (explorando || !destino || vista.getAnimating()) return;
      vista.setCenter(destino.center);
      vista.setResolution(destino.resolution);
    };
    seguir();
    const claves = [
      ...vistaPrincipal.on(['change:center', 'change:resolution', 'change:rotation'], seguir),
      principal.on('change:size', seguir),
    ];

    const elemento = contenedor.current!;
    // Los paneles van en una capa con zoom CSS (la escala de la interfaz): los píxeles de pantalla se
    // pasan a píxeles del minimapa con la relación entre su tamaño propio y el que ocupa en pantalla.
    const coordenada = (e: PointerEvent) => {
      const caja = elemento.getBoundingClientRect();
      const escala = elemento.offsetWidth / (caja.width || elemento.offsetWidth);
      return mini.getCoordinateFromPixel([(e.clientX - caja.left) * escala, (e.clientY - caja.top) * escala]);
    };
    const alMover = (e: PointerEvent) => {
      const destino = coordenada(e);
      if (!destino) return;
      if (!explorando) {
        explorando = true;
        vista.cancelAnimations();
      }
      vistaPrincipal.cancelAnimations();
      vistaPrincipal.setCenter(destino);
    };
    const alSalir = () => {
      if (!explorando) return;
      explorando = false;
      const destino = encuadre();
      if (destino) vista.animate({ ...destino, duration: movimientoReducido() ? 0 : 350 });
    };
    elemento.addEventListener('pointermove', alMover);
    elemento.addEventListener('pointerleave', alSalir);
    elemento.addEventListener('pointercancel', alSalir);

    return () => {
      unByKey(claves);
      elemento.removeEventListener('pointermove', alMover);
      elemento.removeEventListener('pointerleave', alSalir);
      elemento.removeEventListener('pointercancel', alSalir);
      mini.setTarget(undefined);
    };
  }, [visor]);

  return <div ref={contenedor} className="minimapa panel size-[148px] cursor-crosshair overflow-hidden" aria-label="Minimapa de ubicación: mové el mouse encima para recorrer el mapa" />;
}
