import { useEffect, useReducer, useState } from 'react';
import { tituloDeCapa } from '../config';
import { capaSimple, miniatura, useInterfaz } from '../interfaz';
import { capasVisibles, cargarLeyenda, suscribirCapas, type Visor } from '../visor';
import { LeyendaCalor } from './Calor';

// La leyenda de todo lo que está prendido, en el orden del mapa (lo de arriba primero). Consigna A.3:
// "mostrar la leyenda de las capas (clases de la simbología)". La usa el inspector del modo profesional
// y el botón "Referencias" del simple, que la nombra con palabras de todos los días.
export default function LeyendaGeneral({ visor }: { visor: Visor }) {
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);
  const interfaz = useInterfaz();
  const nombres = [...capasVisibles(visor)].reverse();

  if (!nombres.length) {
    return (
      <p className="px-5 py-6 text-[15px] text-[var(--tinta-2)]">
        {interfaz === 'simple' ? 'Todavía no estás viendo nada. Elegí un tema para empezar.' : 'No hay capas prendidas.'}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[var(--linea)]">
      {nombres.map(nombre => {
        const simple = interfaz === 'simple' ? capaSimple(nombre) : undefined;
        return (
          <li key={nombre} className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <img src={miniatura(nombre)} alt="" className="miniatura aspect-[16/10] w-12 shrink-0 rounded-md object-cover" />
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold leading-tight">{simple?.titulo ?? tituloDeCapa(nombre)}</h3>
                {interfaz === 'pro' && <p className="truncate font-mono text-[11.5px] text-[var(--tinta-3)]">tpi:{nombre}</p>}
              </div>
            </div>
            {visor.calor.has(nombre)
              ? <LeyendaCalor visor={visor} nombre={nombre} simple={interfaz === 'simple'} className="ml-[60px] mt-2" />
              : <ImagenLeyenda nombre={nombre} simple={interfaz === 'simple'} />}
          </li>
        );
      })}
    </ul>
  );
}

function ImagenLeyenda({ nombre, simple }: { nombre: string; simple: boolean }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    const control = new AbortController();
    cargarLeyenda(nombre, control.signal, simple).then(setSrc, () => {});
    return () => control.abort();
  }, [nombre, simple]);
  useEffect(() => () => {
    if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
  }, [src]);
  if (!src) return <div className="ml-[60px] mt-2 h-5 w-32 animate-pulse rounded bg-[var(--superficie-2)]" />;
  return <img className="leyenda-wms ml-[60px] mt-2 block max-w-[260px]" alt={`Leyenda de ${tituloDeCapa(nombre)}`} src={src} />;
}
