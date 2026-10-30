import Overlay from 'ol/Overlay';
import { unByKey } from 'ol/Observable';
import type { Coordinate } from 'ol/coordinate';
import { tituloDeCapa } from './config';
import { nombreDe } from './entidades';
import { capasVisibles, urlConsultaPunto, type Visor } from './visor';

// Las capas que cubren todo (provincias, países) no se nombran al pasar: dirían "Chaco" en todos lados.
const DE_FONDO = new Set(['provincias', 'pais_lim']);
const ESPERA = 250;

// Cartel con el nombre de lo que hay bajo el cursor. Se pide a GeoServer (GetFeatureInfo) recién
// cuando el mouse se queda quieto, y se cancela si se vuelve a mover.
export function activarCartel(visor: Visor, habilitado: () => boolean) {
  const elemento = document.createElement('div');
  elemento.className = 'cartel-mapa';
  const overlay = new Overlay({ element: elemento, positioning: 'bottom-center', offset: [0, -14], stopEvent: false });
  visor.mapa.addOverlay(overlay);

  let espera: ReturnType<typeof setTimeout> | undefined;
  let pedido: AbortController | undefined;
  const ocultar = () => {
    elemento.classList.remove('visible');
  };

  async function consultar(coordenada: Coordinate) {
    const capas = [...capasVisibles(visor)].reverse().filter(c => !DE_FONDO.has(c));
    if (!capas.length) return;
    pedido?.abort();
    pedido = new AbortController();
    try {
      const url = urlConsultaPunto(visor, coordenada, capas, 1);
      const datos = await (await fetch(url, { signal: pedido.signal })).json();
      const entidad = datos.features?.[0];
      if (!entidad) return ocultar();
      const nombre = nombreDe(entidad.properties) ?? 'Sin nombre';
      elemento.replaceChildren(
        Object.assign(document.createElement('strong'), { textContent: nombre }),
        Object.assign(document.createElement('span'), { textContent: tituloDeCapa(entidad.id.split('.')[0]) }),
      );
      overlay.setPosition(coordenada);
      elemento.classList.add('visible');
    } catch {
      // Cancelado por otro movimiento o GeoServer sin respuesta: no se muestra nada.
    }
  }

  const claves = [
    visor.mapa.on('pointermove', e => {
      ocultar();
      clearTimeout(espera);
      pedido?.abort();
      if (e.dragging || !habilitado()) return;
      espera = setTimeout(() => consultar(e.coordinate), ESPERA);
    }),
    visor.mapa.on('movestart', ocultar),
  ];
  const salir = () => {
    clearTimeout(espera);
    pedido?.abort();
    ocultar();
  };
  visor.mapa.getViewport()!.addEventListener('pointerleave', salir);

  return () => {
    salir();
    unByKey(claves);
    visor.mapa.getViewport()!.removeEventListener('pointerleave', salir);
    visor.mapa.removeOverlay(overlay);
  };
}
