import { Crosshair, Info, ListBullets } from '@phosphor-icons/react';
import { Segmentado } from '../ui/segmentado';
import LeyendaGeneral from '../LeyendaGeneral';
import type { Visor } from '../../visor';

export type PestanaInspector = 'informacion' | 'leyenda';

// Inspector del modo profesional, fijo a la derecha: "Información" (resultados de consultas, mediciones
// o el tablero de una ruta) y "Leyenda" (la de todas las capas prendidas). Sin nada consultado,
// Información explica cómo empezar.
export default function Inspector({ visor, pestana, onPestana, contenido }: {
  visor: Visor;
  pestana: PestanaInspector;
  onPestana: (p: PestanaInspector) => void;
  contenido: React.ReactNode | null;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="panel p-1">
        <Segmentado
          etiqueta="Inspector"
          valor={pestana}
          onCambiar={onPestana}
          opciones={[
            { valor: 'informacion', etiqueta: 'Información', icono: <Info size={16} weight="bold" /> },
            { valor: 'leyenda', etiqueta: 'Leyenda', icono: <ListBullets size={16} weight="bold" /> },
          ]}
          className="bg-transparent"
        />
      </div>
      {pestana === 'leyenda' ? (
        <section tabIndex={0} className="panel desplazable min-h-0 flex-1 overflow-y-auto focus-visible:outline-2" aria-label="Leyenda de las capas prendidas">
          <LeyendaGeneral visor={visor} />
        </section>
      ) : contenido ? (
        <div className="flex min-h-0 flex-1 flex-col">{contenido}</div>
      ) : (
        // Sin nada consultado, una tarjeta compacta y no una columna vacía de alto completo (en la tele
        // quedaba un bloque blanco de 550×1140 px). El mapa se ve por debajo.
        <section className="panel flex flex-col items-center gap-3 px-8 py-7 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-[var(--superficie-2)] text-[var(--tinta-2)]"><Crosshair size={24} /></span>
          <h2 className="text-[17px] font-semibold">Nada seleccionado</h2>
          <p className="text-[14px] leading-relaxed text-[var(--tinta-3)]">
            Consultá con <strong className="font-semibold text-[var(--tinta-2)]">Punto (2)</strong> o <strong className="font-semibold text-[var(--tinta-2)]">Rectángulo (3)</strong>, medí, preguntá en el buscador o abrí el tablero de la RN11. Los atributos y resultados aparecen acá.
          </p>
        </section>
      )}
    </div>
  );
}
