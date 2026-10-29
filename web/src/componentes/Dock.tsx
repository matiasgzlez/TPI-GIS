import { HERRAMIENTAS, type Modo } from '../herramientas';
import { ICONOS_HERRAMIENTA } from './iconos';
import { FloatingDock } from './ui/floating-dock';

// Separadores entre familias: navegar | consultar | medir | editar.
const SEPARADO_ANTES = new Set<Modo>(['punto', 'distancia', 'alta']);

interface Props {
  modo: Modo;
  onModo: (modo: Modo) => void;
}

// Barra de herramientas (Floating Dock de Aceternity) con la indicación de la herramienta activa.
export default function Dock({ modo, onModo }: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p key={modo} className="entra panel px-4 py-2 text-center text-[14px] font-medium text-[var(--tinta-2)] max-md:hidden" style={{ '--desde': '6px' } as React.CSSProperties}>
        {HERRAMIENTAS[modo].ayuda}
      </p>
      <FloatingDock
        className="panel max-w-[calc(100vw-24px)] overflow-x-auto shadow-[var(--sombra-alta)]"
        items={(Object.keys(HERRAMIENTAS) as Modo[]).map(m => {
          const Icono = ICONOS_HERRAMIENTA[m];
          return {
            id: m,
            title: HERRAMIENTAS[m].corto,
            tecla: HERRAMIENTAS[m].tecla,
            activo: m === modo,
            separadoAntes: SEPARADO_ANTES.has(m),
            icon: activo => <Icono weight={activo ? 'fill' : 'regular'} />,
            onClick: () => onModo(m),
          };
        })}
      />
    </div>
  );
}
