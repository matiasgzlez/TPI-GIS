import { useEffect, useState } from 'react';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { buffer } from 'ol/extent';
import { fromLonLat, toLonLat } from 'ol/proj';
import { formatos, leerCoordenada, type LonLat } from '../../../coordenadas';
import { volarA, type Visor } from '../../../visor';
import { Boton, Campo, Copiable, PanelCajon, Seccion, campo } from './comun';

// Ir a una coordenada escrita en cualquier formato, y el centro del mapa en todos los sistemas (para copiar).
export default function Coordenadas({ visor }: { visor: Visor }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState(false);
  const [destino, setDestino] = useState<LonLat | null>(null);
  const [centro, setCentro] = useState<LonLat>(() => toLonLat(visor.mapa.getView().getCenter()!) as LonLat);

  useEffect(() => {
    const vista = visor.mapa.getView();
    const actualizar = () => setCentro(toLonLat(vista.getCenter()!) as LonLat);
    visor.mapa.on('moveend', actualizar);
    return () => visor.mapa.un('moveend', actualizar);
  }, [visor]);

  function ir(e: React.FormEvent) {
    e.preventDefault();
    const punto = leerCoordenada(texto);
    setError(!punto);
    if (!punto) return;
    setDestino(punto);
    const p = fromLonLat(punto);
    visor.foco.clear();
    visor.foco.addFeature(new Feature({ geometry: new Point(p), nombre: `${punto[1].toFixed(5)}, ${punto[0].toFixed(5)}`, elegida: true }));
    volarA(visor, buffer([...p, ...p], 2500), { maxZoom: 13, duracion: 1000 });
  }

  return (
    <PanelCajon titulo="Ir a coordenada" bajada="WGS 84, grados-minutos-segundos, POSGAR 2007 (Gauss-Krüger) o Web Mercator">
      <form onSubmit={ir} className="flex flex-col gap-3">
        <Campo rotulo="Coordenada" ayuda={'Ej.: -27.4512, -58.9866 · 27°27\'04"S 58°59\'12"O · X 6963930 Y 5600183'}>
          <input value={texto} onChange={e => { setTexto(e.target.value); setError(false); }} className={campo} placeholder="Escribí o pegá una coordenada" aria-invalid={error || undefined} />
        </Campo>
        {error && <p role="alert" className="text-[15px] text-[var(--vial-texto)]">No reconozco esa coordenada. Probá con uno de los ejemplos.</p>}
        <Boton principal type="submit" disabled={!texto.trim()}>Ir</Boton>
      </form>

      {destino && (
        <Seccion titulo="Punto marcado">
          <div className="flex flex-col gap-2">{formatos(destino).map(f => <Copiable key={f.rotulo} {...f} />)}</div>
        </Seccion>
      )}

      <Seccion titulo="Centro del mapa">
        <div className="flex flex-col gap-2">{formatos(centro).map(f => <Copiable key={f.rotulo} {...f} />)}</div>
      </Seccion>
    </PanelCajon>
  );
}
