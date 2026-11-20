import { memo, useEffect, useReducer } from 'react';
import { EyeSlash } from '@phosphor-icons/react';
import { cambiarCapas, suscribirCapas, type Visor } from '../../visor';
import Notch from './Notch';
import PanelTemas from './PanelTemas';

// "Capas" en el escritorio del modo simple: la pastilla del borde izquierdo que se estira hasta ser el
// panel de categorías (ver Notch). Es memo: abrirla y cerrarla no vuelve a dibujar la App.
export default memo(function NotchTemas({ visor }: { visor: Visor }) {
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);
  const viendo = visor.visibles.size;
  return (
    <Notch
      lado="izquierda"
      etiqueta="Capas"
      id="temas-simple"
      guia="temas"
      cuenta={viendo}
      titulo={<>
        <h2 className="text-[26px] font-bold tracking-[-0.025em]">Capas</h2>
        {viendo > 0 && <span className="notch-cuenta" aria-label={`${viendo} a la vista`}>{viendo}</span>}
        <span className="flex-1" />
        {viendo > 0 && (
          <button
            type="button"
            onClick={() => cambiarCapas(visor, [...visor.visibles], false)}
            className="flex h-10 items-center gap-2 rounded-full bg-[var(--superficie-2)] px-4 text-[15px] font-bold text-[var(--tinta-2)] transition-colors hover:bg-[var(--superficie-3)] hover:text-[var(--tinta)] focus-visible:outline-2"
          >
            <EyeSlash size={18} weight="bold" /> Sacar todo
          </button>
        )}
      </>}
    >
      <PanelTemas visor={visor} desnudo />
    </Notch>
  );
});
