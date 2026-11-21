import { useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { MAPAS_BASE, mapaBaseGuardado, ponerMapaBase } from '../../../mapaBase';
import type { Visor } from '../../../visor';
import { PanelCajon } from './comun';

// Elegir el fondo: el papel propio del visor o un servicio externo (IGN, satélite, OpenStreetMap).
export default function MapasBase({ visor }: { visor: Visor }) {
  const [elegido, setElegido] = useState(mapaBaseGuardado);
  const actual = MAPAS_BASE.find(b => b.id === elegido);
  return (
    <PanelCajon titulo="Mapas base" bajada="Fondo debajo de las capas de GeoServer · teselas XYZ / TMS en EPSG:3857"
      pie={actual?.atribucion ? `Fuente del fondo: ${actual.atribucion}` : 'Con un fondo externo, las provincias se dibujan sin relleno para dejarlo ver.'}>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Mapa base">
        {MAPAS_BASE.map(b => (
          <button key={b.id} type="button" role="radio" aria-checked={elegido === b.id}
              onClick={() => { setElegido(b.id); ponerMapaBase(visor, b.id); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)] ${elegido === b.id ? 'bg-[var(--acento-suave)]' : 'hover:bg-[var(--superficie-2)]'}`}>
              <span className="min-w-0 flex-1">
                <span className={`block text-[17px] font-semibold ${elegido === b.id ? 'text-[var(--acento-tinta)]' : ''}`}>{b.titulo}</span>
                <span className="block text-[15px] text-[var(--tinta-2)]">{b.detalle}</span>
              </span>
              {elegido === b.id && <Check size={20} weight="bold" className="shrink-0 text-[var(--acento-tinta)]" />}
            </button>
        ))}
      </div>
    </PanelCajon>
  );
}
