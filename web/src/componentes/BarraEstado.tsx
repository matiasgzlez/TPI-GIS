import { useEffect, useRef, useState } from 'react';
import { ScaleLine } from 'ol/control';
import { unByKey } from 'ol/Observable';
import { bandaDeEscala } from '../estilos';
import { denominadorEscala, denominadorWms, formatoCoordenada, type Visor } from '../visor';
import type MapEvent from 'ol/MapEvent';

// La escala gráfica vive dentro de `.interfaz`, que tiene `zoom` (0,88 en la notebook, hasta 1,41 en
// la tele). OpenLayers mide la barra en píxeles del mapa, que no tiene zoom, así que la barra salía
// un 12 % corta en la notebook y un 41 % larga en la tele. Esta versión divide el ancho por el zoom
// efectivo del contenedor (`currentCSSZoom`): en pantalla la barra mide exactamente la distancia que
// dice. Los anchos mínimo y máximo se dan en píxeles de la interfaz y se pasan a píxeles del mapa.
type Interna = { minWidth_: number; maxWidth_?: number; renderedWidth_?: number; innerElement_: HTMLElement };
export class EscalaGrafica extends ScaleLine {
  private zoomPrevio = 0;
  private textoPrevio = '';
  // `onTexto`: la distancia ("20 km") para escribirla afuera de la barra (la escala negra del simple).
  constructor(private base: { target: HTMLElement; minWidth: number; maxWidth: number; onTexto?: (texto: string) => void }) {
    super({ target: base.target, units: 'metric', minWidth: base.minWidth, maxWidth: base.maxWidth });
  }
  render(evento: MapEvent) {
    const interna = this as unknown as Interna;
    const zoom = (this.base.target as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom || 1;
    if (zoom !== this.zoomPrevio) {
      interna.minWidth_ = this.base.minWidth * zoom;
      interna.maxWidth_ = this.base.maxWidth * zoom;
      interna.renderedWidth_ = undefined;
      this.zoomPrevio = zoom;
    }
    super.render(evento);
    if (interna.renderedWidth_) interna.innerElement_.style.width = `${interna.renderedWidth_ / zoom}px`;
    const texto = (this as unknown as { renderedHTML_: string }).renderedHTML_;
    if (this.base.onTexto && texto !== this.textoPrevio) {
      this.textoPrevio = texto;
      this.base.onTexto(texto);
    }
  }
}

// Escala gráfica (ScaleLine de OpenLayers), denominador 1:N y coordenadas bajo el cursor.
// Las coordenadas se escriben directo en el DOM: mover el mouse no re-renderiza React.
// `compacta`: solo la escala gráfica y el denominador, para el celular y el modo simple (la escala es
// consigna mínima). `fila`: todo en una línea, la barra de estado del pie en el modo profesional.
// `negra`: la del escritorio del simple, una cápsula negra como las pastillas, con la distancia en grande.
export default function BarraEstado({ visor, compacta = false, fila = false, negra = false, children }: { visor: Visor; compacta?: boolean; fila?: boolean; negra?: boolean; children?: React.ReactNode }) {
  const contenedorEscala = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const [escala, setEscala] = useState(0);
  const [distancia, setDistancia] = useState('');
  // La banda (País, Región, Provincia, Local) es la de lo que se dibuja: la del nivel de teselas.
  const [escalaDibujo, setEscalaDibujo] = useState(0);

  useEffect(() => {
    const control = new EscalaGrafica({ target: contenedorEscala.current!, minWidth: compacta ? 56 : negra ? 64 : 80, maxWidth: compacta ? 90 : negra ? 96 : 130, onTexto: negra ? setDistancia : undefined });
    visor.mapa.addControl(control);
    // Cambiar el tamaño de la interfaz (Configuración) cambia --escala sin mover el mapa: se vuelve a
    // dibujar para que la escala gráfica tome el zoom nuevo.
    const observador = new MutationObserver(() => visor.mapa.render());
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    const actualizar = () => {
      setEscala(denominadorEscala(visor.mapa));
      setEscalaDibujo(denominadorWms(visor));
    };
    actualizar();
    const claves = [
      visor.mapa.getView().on('change:resolution', actualizar),
      visor.mapa.on('pointermove', e => {
        if (cursor.current) cursor.current.textContent = formatoCoordenada(e.coordinate);
      }),
    ];
    const salir = () => {
      if (cursor.current) cursor.current.textContent = 'Mové el cursor sobre el mapa';
    };
    visor.mapa.getViewport()!.addEventListener('pointerleave', salir);
    return () => {
      visor.mapa.removeControl(control);
      observador.disconnect();
      unByKey(claves);
      visor.mapa.getViewport()!.removeEventListener('pointerleave', salir);
    };
  }, [visor, compacta, negra]);

  if (fila) {
    return (
      <div className="panel flex h-11 items-center gap-5 px-4 text-[13px]">
        <div className="escala min-w-[80px]" ref={contenedorEscala} />
        <span className="font-semibold tabular-nums">1:{escala.toLocaleString('es-AR')}</span>
        <span className="text-[var(--tinta-3)]">{bandaDeEscala(escalaDibujo)}</span>
        <span className="h-5 w-px bg-white/15" />
        {/* Reescribir las coordenadas en cada movimiento no vuelve a calcular el documento: el texto va en
            un bloque con contain: strict dentro del ítem flex (un ítem flex no corta el layout). */}
        <span className="h-5 min-w-0 flex-1">
          <span ref={cursor} className="block h-5 w-full truncate font-medium leading-5 tabular-nums text-[var(--tinta-2)] [contain:strict]">Mové el cursor sobre el mapa</span>
        </span>
        <span className="text-[var(--tinta-3)]">WGS 84 · EPSG:3857</span>
        {children}
      </div>
    );
  }

  if (negra) {
    return (
      // La distancia arriba, grande y en negrita, y debajo la barra blanca que mide eso mismo (sin texto
      // adentro: antes el "20 km" no entraba en la barra y se pisaban). Tamaño fijo: la barra cambia de largo
      // dentro de su lugar (hasta 96 px), así la cápsula no crece ni se achica al acercar o alejar.
      <div className="superficie-notch dark flex h-[52px] w-[216px] items-center gap-3 rounded-[16px] bg-[var(--notch-fondo)] px-3.5 text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,.45)]" aria-label={`Escala ${distancia}, 1:${escala.toLocaleString('es-AR')}`}>
        <div className="flex w-[96px] shrink-0 flex-col gap-[6px]">
          <span className="text-[17px] font-bold leading-none tracking-[-0.01em] tabular-nums">{distancia}</span>
          <div className="escala escala-negra" ref={contenedorEscala} />
        </div>
        <span className="h-7 w-px shrink-0 bg-white/15" />
        <span className="flex min-w-0 flex-1 flex-col items-end gap-1 text-right">
          <span className="text-[11.5px] font-semibold leading-none text-[var(--tinta-3)]">Escala</span>
          <span className="text-[13px] font-bold leading-none tabular-nums">1:{escala.toLocaleString('es-AR')}</span>
        </span>
      </div>
    );
  }

  if (compacta) {
    return (
      <div className="panel flex items-center gap-3 px-3 py-2" aria-label={`Escala 1:${escala.toLocaleString('es-AR')}`}>
        <div className="escala min-w-[64px]" ref={contenedorEscala} />
        <span className="text-[12px] font-semibold tabular-nums">1:{escala.toLocaleString('es-AR')}</span>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col gap-2.5 px-5 py-3.5">
      <div className="flex items-end justify-between gap-4">
        <div className="escala min-w-[80px]" ref={contenedorEscala} />
        <div className="text-right">
          <div className="text-[12px] font-medium text-[var(--tinta-3)]">Escala · {bandaDeEscala(escalaDibujo)}</div>
          <div className="text-[15px] font-semibold">1:{escala.toLocaleString('es-AR')}</div>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-[var(--linea)] pt-2.5">
        <span className="text-[12px] font-medium text-[var(--tinta-3)]">WGS 84</span>
        <span ref={cursor} className="truncate text-[13px] font-medium text-[var(--tinta-2)]">Mové el cursor sobre el mapa</span>
      </div>
    </div>
  );
}
