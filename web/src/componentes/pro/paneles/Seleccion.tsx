import { useState } from 'react';
import { PROVINCIAS, describir, type Interpretacion } from '../../../lenguaje';
import { Boton, Campo, OpcionesCapas, PanelCajon, Seccion, campo } from './comun';

type TipoLugar = 'rn11' | 'provincia' | 'localidad';

// Selección espacial: capa × relación × lugar, armada a mano. Usa el mismo motor que las preguntas del buscador
// (WFS GetFeature con DWithin o Intersects en GeoServer); el resultado aparece en el panel de lo consultado.
const ATAJOS: { titulo: string; i: Interpretacion }[] = [
  { titulo: 'Localidades a menos de 10 km de la RN11', i: { intencion: 'listar', capa: 'localidades', relacion: { tipo: 'cerca', desde: 0, hasta: 10_000 }, lugar: { tipo: 'rn11' } } },
  { titulo: 'Localidades entre 10 y 20 km de la RN11', i: { intencion: 'listar', capa: 'localidades', relacion: { tipo: 'cerca', desde: 10_000, hasta: 20_000 }, lugar: { tipo: 'rn11' } } },
  { titulo: 'Puentes sobre la RN11', i: { intencion: 'listar', capa: 'puente_red_vial_puntos', relacion: { tipo: 'cerca', desde: 0, hasta: 100 }, lugar: { tipo: 'rn11' } } },
  { titulo: 'Escuelas a menos de 5 km de la RN11', i: { intencion: 'listar', capa: 'edif_educacion', relacion: { tipo: 'cerca', desde: 0, hasta: 5_000 }, lugar: { tipo: 'rn11' } } },
];

export default function Seleccion({ onPreguntar }: { onPreguntar: (i: Interpretacion) => void }) {
  const [capa, setCapa] = useState('localidades');
  const [tipoLugar, setTipoLugar] = useState<TipoLugar>('rn11');
  const [provincia, setProvincia] = useState('Chaco');
  const [localidad, setLocalidad] = useState('Resistencia');
  const [desde, setDesde] = useState('0');
  const [hasta, setHasta] = useState('10');

  const km = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0) * 1000;
  const dentro = tipoLugar === 'provincia';
  const valida = dentro || (km(hasta) > km(desde) && (tipoLugar !== 'localidad' || localidad.trim().length > 1));
  const i: Interpretacion = {
    intencion: 'listar',
    capa,
    relacion: dentro ? { tipo: 'dentro', desde: 0, hasta: 0 } : { tipo: 'cerca', desde: km(desde), hasta: km(hasta) },
    lugar: tipoLugar === 'rn11' ? { tipo: 'rn11' } : tipoLugar === 'provincia' ? { tipo: 'provincia', nombre: provincia } : { tipo: 'localidad', nombre: localidad.trim() },
  };

  return (
    <PanelCajon titulo="Selección espacial" bajada="Entidades de una capa según su relación con la RN11, una provincia o una localidad · WFS con filtro espacial (DWithin, Intersects)">
      <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); if (valida) onPreguntar(i); }}>
        <Campo rotulo="Capa a seleccionar">
          <select value={capa} onChange={e => setCapa(e.target.value)} className={campo}><OpcionesCapas /></select>
        </Campo>
        <Campo rotulo="Respecto de">
          <select value={tipoLugar} onChange={e => setTipoLugar(e.target.value as TipoLugar)} className={campo}>
            <option value="rn11">La RN11 (tramo en Chaco)</option>
            <option value="provincia">Una provincia (dentro de)</option>
            <option value="localidad">Una localidad</option>
          </select>
        </Campo>
        {tipoLugar === 'provincia' && (
          <Campo rotulo="Provincia">
            <select value={provincia} onChange={e => setProvincia(e.target.value)} className={campo}>
              {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Campo>
        )}
        {tipoLugar === 'localidad' && (
          <Campo rotulo="Localidad">
            <input value={localidad} onChange={e => setLocalidad(e.target.value)} className={campo} placeholder="Ej.: Presidencia Roque Sáenz Peña" />
          </Campo>
        )}
        {!dentro && (
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Desde (km)"><input inputMode="decimal" value={desde} onChange={e => setDesde(e.target.value)} className={campo} /></Campo>
            <Campo rotulo="Hasta (km)"><input inputMode="decimal" value={hasta} onChange={e => setHasta(e.target.value)} className={campo} /></Campo>
          </div>
        )}
        <p className="rounded-xl bg-[var(--superficie-2)] px-3.5 py-3 text-[15px] leading-snug text-[var(--tinta-2)]">
          {valida ? describir(i) : 'La distancia "hasta" tiene que ser mayor que "desde".'}
        </p>
        <Boton principal type="submit" disabled={!valida}>Seleccionar</Boton>
      </form>

      <Seccion titulo="Consultas de la parte B">
        <div className="flex flex-col gap-2">
          {ATAJOS.map(a => (
            <button key={a.titulo} type="button" onClick={() => onPreguntar(a.i)}
              className="rounded-xl px-3.5 py-3 text-left text-[16px] font-medium text-[var(--tinta)] transition-colors hover:bg-[var(--superficie-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]">
              {a.titulo}
            </button>
          ))}
        </div>
      </Seccion>
    </PanelCajon>
  );
}
