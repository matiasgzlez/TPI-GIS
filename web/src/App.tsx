import { useEffect, useRef, useState } from 'react';
import type Point from 'ol/geom/Point';
import FormObra from './componentes/FormObra';
import PanelCapas from './componentes/PanelCapas';
import { activarHerramienta, HERRAMIENTAS, type Modo } from './herramientas';
import { guardarObra, type DatosObra } from './obras';
import { crearVisor, denominadorEscala, refrescarCapa, type Visor } from './visor';

export default function App() {
  const destino = useRef<HTMLDivElement>(null);
  const [visor, setVisor] = useState<Visor | null>(null);
  const [modo, setModo] = useState<Modo>('navegar');
  const [resultado, setResultado] = useState('');
  const [escala, setEscala] = useState('');
  const [obra, setObra] = useState<Point | null>(null);

  // El mapa de OpenLayers se crea una sola vez; React maneja solo el panel.
  useEffect(() => {
    const v = crearVisor(destino.current!);
    v.mapa.on('moveend', () => setEscala(denominadorEscala(v.mapa)));
    setVisor(v);
    return () => v.mapa.setTarget(undefined);
  }, []);

  useEffect(() => {
    if (!visor) return;
    setObra(null);
    setResultado(HERRAMIENTAS[modo].ayuda);
    return activarHerramienta(visor, modo, { mostrar: setResultado, nuevaObra: setObra });
  }, [visor, modo]);

  async function guardar(datos: DatosObra) {
    try {
      setResultado(`Obra guardada: ${await guardarObra(obra!, datos)}`);
      refrescarCapa(visor!, 'obras_rn11');
    } catch (error) {
      setResultado(`Error al guardar:\n${(error as Error).message}`);
    }
    setObra(null);
    visor!.dibujo.clear();
  }

  function cancelar() {
    setObra(null);
    visor!.dibujo.clear();
    setResultado(HERRAMIENTAS.alta.ayuda);
  }

  return (
    <>
      <aside className="panel">
        <h2>Herramienta</h2>
        {(Object.keys(HERRAMIENTAS) as Modo[]).map(m => (
          <label key={m}>
            <input type="radio" name="modo" checked={modo === m} onChange={() => setModo(m)} /> {HERRAMIENTAS[m].titulo}
          </label>
        ))}
        {obra && <FormObra onGuardar={guardar} onCancelar={cancelar} />}

        <h2>Escala</h2>
        <div>{escala}</div>

        <h2>Capas</h2>
        {visor && <PanelCapas visor={visor} />}

        <h2>Resultado</h2>
        <div className="resultado">{resultado}</div>
      </aside>
      <div className="mapa" ref={destino} />
    </>
  );
}
