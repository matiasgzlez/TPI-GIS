import { useEffect, useReducer, useRef, useState } from 'react';
import { unByKey } from 'ol/Observable';
import { toLonLat } from 'ol/proj';
import { EscalaGrafica } from '../BarraEstado';
import { bandaDeEscala } from '../../estilos';
import { denominadorEscala, denominadorWms, formatoCoordenada, suscribirCapas, type Visor } from '../../visor';
import { CAPAS } from '../../config';

const num = (n: number, d = 0) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

// La barra de estado del profesional, de punta a punta, como la de un SIG de escritorio. A la izquierda la
// vista: escala gráfica y numérica, nivel de zoom, resolución en el terreno (m/px, corregida por la latitud
// del centro: en Web Mercator el píxel se achica hacia los polos) y el nivel de detalle de las capas. Al
// medio, el cursor: geográficas (WGS 84, en grados, minutos y segundos) y proyectadas (EPSG:3857, en metros).
// A la derecha, el servicio: las teselas WMS en cola, la latencia de GeoServer (de las respuestas que ya
// llegaron, por Resource Timing: no hace pedidos propios), el sistema de referencia y las capas visibles.
export default function EstadoTecnico({ visor }: { visor: Visor }) {
  const escalaEl = useRef<HTMLDivElement>(null);
  const geo = useRef<HTMLSpanElement>(null);
  const xy = useRef<HTMLSpanElement>(null);
  const [vista, setVista] = useState({ escala: 0, zoom: 0, resolucion: 0, banda: '' });
  const [cola, setCola] = useState(0);
  const [latencia, setLatencia] = useState<{ ms: number; ok: boolean } | null>(null);
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);

  useEffect(() => {
    const control = new EscalaGrafica({ target: escalaEl.current!, minWidth: 72, maxWidth: 120 });
    visor.mapa.addControl(control);
    const vistaMapa = visor.mapa.getView();
    const actualizar = () => {
      const centro = vistaMapa.getCenter();
      const lat = centro ? toLonLat(centro)[1] : 0;
      setVista({
        escala: denominadorEscala(visor.mapa),
        zoom: vistaMapa.getZoom() ?? 0,
        resolucion: (vistaMapa.getResolution() ?? 0) * Math.cos((lat * Math.PI) / 180),
        banda: bandaDeEscala(denominadorWms(visor)),
      });
    };
    actualizar();
    const sinCursor = () => {
      if (geo.current) geo.current.textContent = '—';
      if (xy.current) xy.current.textContent = '—';
    };
    const claves = [
      vistaMapa.on('change:resolution', actualizar),
      vistaMapa.on('change:center', actualizar),
      visor.mapa.on('pointermove', e => {
        if (geo.current) geo.current.textContent = formatoCoordenada(e.coordinate);
        if (xy.current) xy.current.textContent = `${num(e.coordinate[0])} · ${num(e.coordinate[1])}`;
      }),
    ];
    visor.mapa.getViewport()!.addEventListener('pointerleave', sinCursor);
    // Las teselas WMS que faltan llegar.
    const fuente = visor.wms.getSource()!;
    let pendientes = 0;
    const sumar = (d: number) => { pendientes = Math.max(0, pendientes + d); setCola(pendientes); };
    const teselas = [
      fuente.on('tileloadstart', () => sumar(1)),
      fuente.on('tileloadend', () => sumar(-1)),
      fuente.on('tileloaderror', () => sumar(-1)),
    ];
    // La latencia de GeoServer: la mediana de las últimas respuestas.
    const ultimas: number[] = [];
    let ok = true;
    const observador = new PerformanceObserver(lista => {
      let hubo = false;
      for (const e of lista.getEntries() as PerformanceResourceTiming[]) {
        if (!e.name.includes('/geoserver/')) continue;
        const total = e.responseStart > 0 ? e.responseStart - e.requestStart : e.duration;
        if (total <= 0) continue;
        ultimas.push(total);
        if (ultimas.length > 15) ultimas.shift();
        const estado = (e as PerformanceResourceTiming & { responseStatus?: number }).responseStatus ?? 200;
        ok = estado === 0 || estado < 400;
        hubo = true;
      }
      if (!hubo) return;
      const orden = [...ultimas].sort((a, b) => a - b);
      setLatencia({ ms: orden[Math.floor(orden.length / 2)], ok });
    });
    try { observador.observe({ type: 'resource', buffered: true }); } catch { /* sin Resource Timing */ }
    return () => {
      visor.mapa.removeControl(control);
      unByKey(claves);
      unByKey(teselas);
      observador.disconnect();
      visor.mapa.getViewport()!.removeEventListener('pointerleave', sinCursor);
    };
  }, [visor]);

  const resolucion = vista.resolucion >= 100 ? `${num(vista.resolucion)} m/px` : `${num(vista.resolucion, 1)} m/px`;
  return (
    <div className="estado-tecnico panel flex h-[var(--alto-estado)] items-center gap-0 text-[13px]" aria-label="Estado de la vista">
      <Campo etiqueta="Escala" ancho>
        <div className="escala min-w-[72px]" ref={escalaEl} />
        <span className="font-semibold tabular-nums">1:{num(vista.escala)}</span>
      </Campo>
      <Campo etiqueta="Zoom"><span className="tabular-nums">{num(vista.zoom, 2)}</span></Campo>
      <Campo etiqueta="Res." titulo="Resolución en el terreno, en el centro de la vista"><span className="tabular-nums">{resolucion}</span></Campo>
      <Campo etiqueta="LOD" titulo="Nivel de detalle de las capas (según la escala)"><span>{vista.banda}</span></Campo>
      <Campo etiqueta="WGS 84" titulo="Coordenadas geográficas del cursor (latitud, longitud)" crece ancho>
        {/* Reescribir el texto en cada movimiento no recalcula el documento (contain: strict). */}
        <span className="h-5 min-w-0 flex-1"><span ref={geo} className="block h-5 w-full truncate font-medium leading-5 tabular-nums [contain:strict]">—</span></span>
      </Campo>
      <Campo campo="xy" etiqueta="X · Y" titulo="Coordenadas proyectadas del cursor, en metros (EPSG:3857)" crece>
        <span className="h-5 min-w-0 flex-1"><span ref={xy} className="block h-5 w-full truncate font-medium leading-5 tabular-nums [contain:strict]">—</span></span>
      </Campo>
      <span className="ml-auto" />
      <Campo etiqueta="Teselas" titulo="Teselas WMS 1.3.0 (512 px) que faltan llegar">
        <span className="flex items-center gap-1.5 tabular-nums">
          <span aria-hidden="true" className={`size-2 rounded-full ${cola ? 'animate-pulse bg-[var(--vial)]' : 'bg-[#1e8e3e]'}`} />
          {cola ? `${cola} en cola` : 'al día'}
        </span>
      </Campo>
      <Campo etiqueta="GeoServer" titulo="Latencia de las últimas respuestas de GeoServer (WMS y WFS), mediana">
        <span className="flex items-center gap-1.5 tabular-nums">
          <span aria-hidden="true" className={`size-2 rounded-full ${!latencia ? 'bg-[var(--tinta-3)]' : latencia.ok ? 'bg-[#1e8e3e]' : 'bg-[var(--danger)]'}`} />
          {latencia ? `${num(latencia.ms)} ms` : '—'}
        </span>
      </Campo>
      <Campo etiqueta="SRC" titulo="Sistema de referencia de la vista: WGS 84 / Pseudo-Mercator"><span>EPSG:3857</span></Campo>
      <Campo etiqueta="Capas" titulo="Capas visibles de las publicadas"><span className="tabular-nums"><strong className="font-semibold">{visor.visibles.size}</strong> de {CAPAS.length}</span></Campo>
    </div>
  );
}

function Campo({ campo, etiqueta, titulo, ancho, crece, children }: { campo?: string; etiqueta: string; titulo?: string; ancho?: boolean; crece?: boolean; children: React.ReactNode }) {
  return (
    <span data-campo={campo} title={titulo} className={`campo-estado flex h-full items-center gap-2 px-3.5 ${crece ? 'min-w-0 max-w-[260px] flex-1' : 'shrink-0'} ${ancho ? 'gap-3' : ''}`}>
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--tinta-3)]">{etiqueta}</span>
      {children}
    </span>
  );
}
