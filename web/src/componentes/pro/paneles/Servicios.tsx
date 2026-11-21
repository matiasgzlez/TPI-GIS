import { useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { URL_WFS, URL_WMS, WORKSPACE, tituloDeCapa } from '../../../config';
import { TOPE_EXPORTAR } from '../../../tabla';
import { capasVisibles, type Visor } from '../../../visor';
import { Boton, Campo, Copiable, OpcionesCapas, PanelCajon, Seccion, campo, descargar } from './comun';

// Servicios OGC y descargas: las URL para conectar QGIS (u otro cliente) y la descarga de una capa en los
// formatos que ofrece el WFS de GeoServer, entera o solo lo que se ve.
const FORMATOS = [
  { id: 'shp', titulo: 'Shapefile', salida: 'SHAPE-ZIP', srs: 'EPSG:4326', extension: 'zip' },
  { id: 'geojson', titulo: 'GeoJSON', salida: 'application/json', srs: 'EPSG:4326', extension: 'geojson' },
  { id: 'kml', titulo: 'KML', salida: 'KML', srs: 'EPSG:4326', extension: 'kml' },
  { id: 'gml', titulo: 'GML 3.2', salida: 'gml32', srs: 'EPSG:4326', extension: 'gml' },
  { id: 'csv', titulo: 'CSV', salida: 'csv', srs: 'EPSG:4326', extension: 'csv' },
] as const;

export default function Servicios({ visor }: { visor: Visor }) {
  const origen = location.origin;
  const [capa, setCapa] = useState(() => capasVisibles(visor).at(-1) ?? 'localidades');
  const [formato, setFormato] = useState<(typeof FORMATOS)[number]['id']>('shp');
  const [soloVista, setSoloVista] = useState(true);
  const [estado, setEstado] = useState<'listo' | 'bajando' | 'error'>('listo');

  async function bajar() {
    const f = FORMATOS.find(x => x.id === formato)!;
    setEstado('bajando');
    try {
      let url = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:${capa}&outputFormat=${encodeURIComponent(f.salida)}&srsName=${f.srs}&count=${TOPE_EXPORTAR}`;
      if (soloVista) url += `&bbox=${visor.mapa.getView().calculateExtent(visor.mapa.getSize()).join(',')},EPSG:3857`;
      const r = await fetch(url);
      if (!r.ok) throw new Error();
      descargar(await r.blob(), `${capa}${soloVista ? '-vista' : ''}-${new Date().toISOString().slice(0, 10)}.${f.extension}`);
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  }

  return (
    <PanelCajon titulo="Servicios y descargas" bajada="Conexión OGC de GeoServer (workspace tpi) y descarga de capas por WFS"
      pie={<>En QGIS: <strong className="font-semibold text-[var(--tinta-2)]">Capa → Añadir capa → Añadir capa WMS/WFS</strong>, nueva conexión y pegar la URL.</>}>
      <Seccion titulo="Servicios">
        <div className="flex flex-col gap-2">
          <Copiable rotulo="WMS 1.3.0" valor={`${origen}${URL_WMS}`} />
          <Copiable rotulo="WFS 2.0.0" valor={`${origen}${URL_WFS}`} />
          <Copiable rotulo="GetCapabilities WMS" valor={`${origen}${URL_WMS}?service=WMS&request=GetCapabilities`} />
          <Copiable rotulo="WFS-T (edición de obras_rn11, con usuario editor)" valor={`${origen}/geoserver/wfs`} />
        </div>
      </Seccion>

      <Seccion titulo="Descargar una capa">
        <div className="flex flex-col gap-4">
          <Campo rotulo="Capa">
            <select value={capa} onChange={e => setCapa(e.target.value)} className={campo}><OpcionesCapas /></select>
          </Campo>
          <fieldset>
            <legend className="mb-1.5 text-[15px] font-semibold text-[var(--tinta-2)]">Formato</legend>
            <div className="flex flex-wrap gap-2">
              {FORMATOS.map(f => (
                <button key={f.id} type="button" aria-pressed={formato === f.id} onClick={() => setFormato(f.id)}
                  className={`h-10 rounded-full px-4 text-[15.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)] ${formato === f.id ? 'bg-[var(--tinta)] text-[var(--superficie)]' : 'bg-[var(--superficie-2)] text-[var(--tinta-2)] hover:bg-[var(--superficie-3)]'}`}>
                  {f.titulo}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-3 text-[16px]">
            <input type="checkbox" checked={soloVista} onChange={e => setSoloVista(e.target.checked)} className="size-5 accent-[var(--vial)]" />
            Solo lo que se ve en el mapa
          </label>
          <Boton principal onClick={bajar} disabled={estado === 'bajando'}>
            <DownloadSimple size={18} weight="bold" /> {estado === 'bajando' ? 'Descargando…' : `Descargar ${tituloDeCapa(capa)}`}
          </Boton>
          {estado === 'error' && <p role="alert" className="text-[15px] text-[var(--vial-texto)]">GeoServer no pudo armar el archivo.</p>}
          <p className="text-[14px] text-[var(--tinta-3)]">Coordenadas en WGS 84 (EPSG:4326), como están en PostGIS. Hasta {TOPE_EXPORTAR.toLocaleString('es-AR')} entidades.</p>
        </div>
      </Seccion>
    </PanelCajon>
  );
}
