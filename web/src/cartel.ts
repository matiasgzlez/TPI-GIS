import Overlay from 'ol/Overlay';
import { unByKey } from 'ol/Observable';
import type { Coordinate } from 'ol/coordinate';
import type { Pixel } from 'ol/pixel';
import { tituloDeCapa } from './config';
import { capaSimple } from './interfaz';
import { nombrePro, nombreSimple } from './entidades';
import { capasVisibles, consultarPuntoWms, type Visor } from './visor';

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
  // Modo simple: nombres de todos los días ("Ríos y arroyos", no "Cursos de agua") y "tocá dos veces".
  simple?: () => boolean;
  alCambiarRuta?: (ruta: RutaBajoCursor | null) => void;
}

// Cartel con el nombre de lo que hay bajo el cursor. Se pide a GeoServer (GetFeatureInfo) recién
// cuando el mouse se queda quieto, y se cancela si se vuelve a mover.
export function activarCartel(visor: Visor, { habilitado, alCambiarRuta, simple = () => false }: Opciones) {
  const elemento = document.createElement('div');
  elemento.className = 'cartel-mapa';
  const overlay = new Overlay({ element: elemento, positioning: 'bottom-center', offset: [0, -14], stopEvent: false });
  visor.mapa.addOverlay(overlay);
  const viewport = visor.mapa.getViewport()!;

  let espera: ReturnType<typeof setTimeout> | undefined;
  let pedido: AbortController | undefined;
  let consultado: Pixel | undefined;
  let ruta: RutaBajoCursor | null = null;
  // Sube con cada movimiento del mapa: una respuesta pedida antes de un vuelo ya no corresponde al
  // lugar bajo el mouse y se descarta.
  let movimientos = 0;

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
    const movimiento = movimientos;
    try {
      const datos = await consultarPuntoWms(visor, coordenada, capas, 1, pedido.signal);
      if (movimiento !== movimientos || visor.mapa.getView().getAnimating()) return;
      const entidad = datos.features?.[0];
      if (!entidad) return ocultar();
      const capa = entidad.id.split('.')[0];
      const p = entidad.properties ?? {};
      const nacional = capa === 'red_vial' && p.administra === 'Nacional' && p.nro_ruta;
      if (nacional) {
        elemento.replaceChildren(
          Object.assign(document.createElement('strong'), { textContent: `Ruta Nacional ${p.nro_ruta}` }),
          Object.assign(document.createElement('span'), { textContent: simple() ? 'Tocá dos veces para ver sus datos' : 'Doble clic para ver su tablero' }),
        );
      } else {
        elemento.replaceChildren(
          Object.assign(document.createElement('strong'), { textContent: (simple() ? nombreSimple(p) : nombrePro(p)) ?? 'Sin nombre' }),
          Object.assign(document.createElement('span'), { textContent: (simple() && capaSimple(capa)?.titulo) || tituloDeCapa(capa) }),
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
      // Durante un vuelo el mapa se corre bajo el mouse: no se pregunta hasta que termine.
      if (e.dragging || !habilitado() || visor.mapa.getView().getAnimating()) return;
      espera = setTimeout(() => consultar(e.coordinate, e.pixel), ESPERA);
    }),
    // Al moverse el mapa (un vuelo, el minimapa) se cancela también el pedido en curso: si no, su
    // respuesta llegaba después y dejaba el cartel clavado donde ya no está el mouse.
    visor.mapa.on('movestart', () => {
      movimientos++;
      salir();
    }),
  ];
  function salir() {
    clearTimeout(espera);
    pedido?.abort();
    ocultar();
  }
  viewport.addEventListener('pointerleave', salir);

  return () => {
    salir();
    unByKey(claves);
    viewport.removeEventListener('pointerleave', salir);
    visor.mapa.removeOverlay(overlay);
  };
}
