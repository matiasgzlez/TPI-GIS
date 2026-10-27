import { URL_WMS, WORKSPACE } from '../config';
import type { Visor } from '../visor';

// Casillas para prender y apagar capas, con la leyenda de GeoServer (GetLegendGraphic).
export default function PanelCapas({ visor }: { visor: Visor }) {
  const capas = [visor.base, ...visor.capas].reverse();
  return (
    <div>
      {capas.map(capa => {
        const nombre = capa.get('nombre') as string | undefined;
        return (
          <div key={capa.get('titulo')}>
            <label>
              <input type="checkbox" defaultChecked={capa.getVisible()} onChange={e => capa.setVisible(e.target.checked)} />
              {' '}{capa.get('titulo')}
            </label>
            {nombre && (
              <img
                className="leyenda"
                alt=""
                src={`${URL_WMS}?service=WMS&request=GetLegendGraphic&format=image/png&layer=${WORKSPACE}:${nombre}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
