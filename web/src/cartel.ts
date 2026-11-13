import Overlay from 'ol/Overlay';
import { unByKey } from 'ol/Observable';
import type { Coordinate } from 'ol/coordinate';
import type { Pixel } from 'ol/pixel';
import { tituloDeCapa } from './config';
import { nombreDe } from './entidades';
import { capasVisibles, urlConsultaPunto, type Visor } from './visor';

// Las capas que cubren todo (provincias, países) no se nombran al pasar: dirían "Chaco" en todos lados.
const DE_FONDO = new Set(['provincias', 'pais_lim']);
const ESPERA = 250;
// Un temblor del mouse (o el doble clic) no cuenta como moverse: el cartel se queda.
const QUIETO = 6;

// Una ruta nacional bajo el cursor: el doble clic la elige para el tablero.
export interface RutaBajoCursor {
  numero: string;
  coordenada: Coordinate;
  pixel: Pixel;
}

interface Opciones {
  habilitado: () => boolean;
  alCambiarRuta?: (ruta: RutaBajoCursor | null) => void;
}

// Cartel con el nombre de lo que hay bajo el cursor. Se pide a GeoServer (GetFeatureInfo) recién
// cuando el mouse se queda quieto, y se cancela si se vuelve a mover.
export function activarCartel(visor: Visor, { habilitado, alCambiarRuta }: Opciones) {
  const elemento = document.createElement('div');
  elemento.className = 'cartel-mapa';
  const overlay = new Overlay({ element: elemento, positioning: 'bottom-center', offset: [0, -14], stopEvent: false });
  visor.mapa.addOverlay(overlay);
  const viewport = visor.mapa.getViewport()!;

  let espera: ReturnType<typeof setTimeout> | undefined;
  let pedido: AbortController | undefined;
  let consultado: Pixel | undefined;
  let ruta: RutaBajoCursor | null = null;

  const ponerRuta = (nueva: RutaBajoCursor | null) => {
    if (!ruta && !nueva) return;
    ruta = nueva;
    viewport.classList.toggle('sobre-ruta', !!ruta);
    alCambiarRuta?.(ruta);
  };
  const ocultar = () => {
    elemento.classList.remove('visible');
    consultado = undefined;
    ponerRuta(null);
  };

  async function consultar(coordenada: Coordinate, pixel: Pixel) {
    const capas = [...capasVisibles(visor)].reverse().filter(c => !DE_FONDO.has(c));
    if (!capas.length) return;
    pedido?.abort();
    pedido = new AbortController();
    try {
      const url = urlConsultaPunto(visor, coordenada, capas, 1);
      const datos = await (await fetch(url, { signal: pedido.signal })).json();
      const entidad = datos.features?.[0];
      if (!entidad) return ocultar();
      const capa = entidad.id.split('.')[0];
      const p = entidad.properties ?? {};
      const nacional = capa === 'red_vial' && p.administra === 'Nacional' && p.nro_ruta;
      if (nacional) {
        elemento.replaceChildren(
          Object.assign(document.createElement('strong'), { textContent: `Ruta Nacional ${p.nro_ruta}` }),
          Object.assign(document.createElement('span'), { textContent: 'Doble clic para ver su tablero' }),
        );
      } else {
        elemento.replaceChildren(
          Object.assign(document.createElement('strong'), { textContent: nombreDe(p) ?? 'Sin nombre' }),
          Object.assign(document.createElement('span'), { textContent: tituloDeCapa(capa) }),
        );
      }
      overlay.setPosition(coordenada);
      elemento.classList.add('visible');
      consultado = pixel;
      ponerRuta(nacional ? { numero: String(p.nro_ruta), coordenada, pixel } : null);
    } catch {
      // Cancelado por otro movimiento o GeoServer sin respuesta: no se muestra nada.
    }
  }

  const claves = [
    visor.mapa.on('pointermove', e => {
      if (consultado && !e.dragging && Math.hypot(e.pixel[0] - consultado[0], e.pixel[1] - consultado[1]) < QUIETO) return;
      ocultar();
      clearTimeout(espera);
      pedido?.abort();
      if (e.dragging || !habilitado()) return;
      espera = setTimeout(() => consultar(e.coordinate, e.pixel), ESPERA);
    }),
    visor.mapa.on('movestart', ocultar),
  ];
  const salir = () => {
    clearTimeout(espera);
    pedido?.abort();
    ocultar();
  };
  viewport.addEventListener('pointerleave', salir);

  return () => {
    salir();
    unByKey(claves);
    viewport.removeEventListener('pointerleave', salir);
    visor.mapa.removeOverlay(overlay);
  };
}
