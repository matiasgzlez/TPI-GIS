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
  const tinta = color('--tinta', '#15171a');
  const fantasma = !!feature.get('fantasma');
  const extension = feature.getGeometry()!.getExtent();
  if (Math.max(getWidth(extension), getHeight(extension)) / resolucion < LADO_MINIMO) {
    return new Style({
      geometry: new Point(getCenter(extension)),
      image: fantasma
        ? new Circle({ radius: 4.5, stroke: new Stroke({ color: tinta, width: 1.5 }) })
        : new Circle({ radius: 4.5, fill: new Fill({ color: vial }), stroke: new Stroke({ color: papel, width: 2 }) }),
    });
  }
  // El fantasma es adónde iría la vista si se hace clic: punteado y sin relleno.
  if (fantasma) return new Style({ stroke: new Stroke({ color: transparente(tinta, 0.7), width: 1.5, lineDash: [4, 3] }) });
  return [
    new Style({ stroke: new Stroke({ color: papel, width: 4 }) }),
    new Style({ stroke: new Stroke({ color: vial, width: 2 }), fill: new Fill({ color: transparente(vial, 0.14) }) }),
  ];
}

// Minimapa de ubicación: un mapa chico con las provincias de GeoServer que acompaña al principal en
// cada cuadro (al arrastrar, al hacer zoom, durante los vuelos). El recuadro naranja es la vista actual.
// Pasar el mouse no mueve nada: un recuadro punteado muestra adónde iría la vista. Un clic vuela hasta
// ahí y arrastrar lleva el mapa principal en vivo. Mientras se arrastra el minimapa se queda quieto
// (si se recentrara, se correría bajo el cursor y todo derivaría) y al soltar vuelve a centrarse.
export default function Minimapa({ visor }: { visor: Visor }) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const principal = visor.mapa;
    const vistaPrincipal = principal.getView();
    const recuadro = new Feature();
    const fantasma = new Feature({ fantasma: true });
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
        new VectorLayer({ source: new VectorSource({ features: [fantasma, recuadro] }), style: estiloRecuadro, updateWhileAnimating: true, updateWhileInteracting: true }),
      ],
      view: vista,
    });

    const elemento = contenedor.current!;
    let explorando = false;
    const encuadre = () => {
      const centro = vistaPrincipal.getCenter();
      const resolucion = vistaPrincipal.getResolution();
      if (!centro || !resolucion) return null;
      // El recuadro nunca ocupa más de la mitad del minimapa: a escala país el tope dejaba al minimapa
      // más cerca que el mapa principal y el recuadro lo tapaba entero.
      const tamaño = principal.getSize();
      const proporcion = tamaño ? Math.max(tamaño[0], tamaño[1]) / (contenedor.current?.offsetWidth || 148) : FACTOR;
      const acotada = Math.min(Math.max(resolucion * FACTOR, RESOLUCION_MINIMA), RESOLUCION_MAXIMA);
      return { center: centro, resolution: Math.max(acotada, resolucion * proporcion * 2) };
    };
    // Más lejos que 1:28.000.000 (escala continente) el minimapa no agrega nada: se desvanece.
    const seguir = () => {
      elemento.classList.toggle('minimapa-lejos', (vistaPrincipal.getResolution() ?? 0) > 8000);
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

    // Los paneles van en una capa con zoom CSS (la escala de la interfaz): los píxeles de pantalla se
    // pasan a píxeles del minimapa con la relación entre su tamaño propio y el que ocupa en pantalla.
    const coordenada = (e: PointerEvent) => {
      const caja = elemento.getBoundingClientRect();
      const escala = elemento.offsetWidth / (caja.width || elemento.offsetWidth);
      return mini.getCoordinateFromPixel([(e.clientX - caja.left) * escala, (e.clientY - caja.top) * escala]);
    };
    // El recuadro punteado: la vista actual trasladada a donde está el cursor.
    const mostrarFantasma = (destino: number[] | null) => {
      const tamaño = principal.getSize();
      const centro = vistaPrincipal.getCenter();
      if (!destino || !tamaño || !centro) return fantasma.setGeometry(undefined);
      const geometria = fromExtent(vistaPrincipal.calculateExtent(tamaño));
      geometria.translate(destino[0] - centro[0], destino[1] - centro[1]);
      fantasma.setGeometry(geometria);
    };

    let presionado: { x: number; y: number; arrastrando: boolean } | null = null;
    const alPresionar = (e: PointerEvent) => {
      if (e.button !== 0) return;
      presionado = { x: e.clientX, y: e.clientY, arrastrando: false };
      elemento.setPointerCapture(e.pointerId);
    };
    const alMover = (e: PointerEvent) => {
      const destino = coordenada(e);
      if (!presionado) return mostrarFantasma(destino);
      // Unos píxeles de tolerancia: un clic con temblor no es un arrastre.
      if (!presionado.arrastrando && Math.hypot(e.clientX - presionado.x, e.clientY - presionado.y) < 4) return;
      if (!presionado.arrastrando) {
        presionado.arrastrando = true;
        explorando = true;
        vista.cancelAnimations();
        fantasma.setGeometry(undefined);
      }
      if (!destino) return;
      vistaPrincipal.cancelAnimations();
      vistaPrincipal.setCenter(destino);
    };
    const recentrar = () => {
      if (!explorando) return;
      explorando = false;
      const destino = encuadre();
      if (destino) vista.animate({ ...destino, duration: movimientoReducido() ? 0 : 350 });
    };
    const alSoltar = (e: PointerEvent) => {
      if (!presionado) return;
      const fueClic = !presionado.arrastrando;
      presionado = null;
      if (elemento.hasPointerCapture(e.pointerId)) elemento.releasePointerCapture(e.pointerId);
      if (fueClic) {
        const destino = coordenada(e);
        fantasma.setGeometry(undefined);
        if (destino) {
          vistaPrincipal.cancelAnimations();
          vistaPrincipal.animate({ center: destino, duration: movimientoReducido() ? 0 : 600 });
        }
      }
      recentrar();
    };
    const alSalir = () => {
      if (!presionado) fantasma.setGeometry(undefined);
    };
    const alCancelar = () => {
      presionado = null;
      fantasma.setGeometry(undefined);
      recentrar();
    };
    // Teclado: con el foco en el minimapa, las flechas corren el mapa principal un cuarto de la vista.
    const alTeclear = (e: KeyboardEvent) => {
      const paso: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      const direccion = paso[e.key];
      const tamaño = principal.getSize();
      const centro = vistaPrincipal.getCenter();
      const resolucion = vistaPrincipal.getResolution();
      if (!direccion || !tamaño || !centro || !resolucion) return;
      e.preventDefault();
      vistaPrincipal.cancelAnimations();
      vistaPrincipal.animate({
        center: [centro[0] + direccion[0] * tamaño[0] * resolucion * 0.25, centro[1] + direccion[1] * tamaño[1] * resolucion * 0.25],
        duration: movimientoReducido() ? 0 : 250,
      });
    };
    elemento.addEventListener('keydown', alTeclear);
    elemento.addEventListener('pointerdown', alPresionar);
    elemento.addEventListener('pointermove', alMover);
    elemento.addEventListener('pointerup', alSoltar);
    elemento.addEventListener('pointerleave', alSalir);
    elemento.addEventListener('pointercancel', alCancelar);

    return () => {
      unByKey(claves);
      elemento.removeEventListener('keydown', alTeclear);
      elemento.removeEventListener('pointerdown', alPresionar);
      elemento.removeEventListener('pointermove', alMover);
      elemento.removeEventListener('pointerup', alSoltar);
      elemento.removeEventListener('pointerleave', alSalir);
      elemento.removeEventListener('pointercancel', alCancelar);
      mini.setTarget(undefined);
    };
  }, [visor]);

  return <div
      ref={contenedor}
      role="application"
      tabIndex={0}
      aria-roledescription="minimapa"
      className="minimapa panel size-[148px] cursor-pointer overflow-hidden active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2"
      title="Hacé clic para ir ahí o arrastrá para recorrer"
      aria-label="Minimapa de ubicación. Hacé clic para ir a un lugar, arrastrá para recorrer o usá las flechas para mover el mapa."
    />;
}
