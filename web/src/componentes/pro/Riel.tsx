import { FilePdf, GearSix, ListBullets, Moon, SplitHorizontal, Stack, Sun, Table as IconoTabla, type Icon } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { RESORTE } from '../../movimiento';
import EscudoRuta from '../EscudoRuta';

export type Cajon = 'capas' | 'leyenda';

// El riel del modo profesional, pegado al borde izquierdo de punta a punta (como el de un mapa web): arriba
// el escudo del visor; después lo que se abre al costado (Capas y Leyenda, en el cajón) y lo que se abre en
// el mapa (la tabla, el comparador e imprimir); abajo, el tema y los ajustes. Cada botón es un ícono en una
// pastilla con su nombre debajo; lo abierto lleva la pastilla de color, que se desliza de un botón al otro.
export default function Riel({ estilo, cajon, onCajon, tabla, onTabla, comparar, onComparar, onImprimir, oscuro, onTema, onAjustes }: {
  estilo?: React.CSSProperties;
  cajon: Cajon | null;
  onCajon: (c: Cajon | null) => void;
  tabla: boolean;
  onTabla: () => void;
  comparar: boolean;
  onComparar: () => void;
  onImprimir: () => void;
  oscuro: boolean;
  onTema: () => void;
  onAjustes: () => void;
}) {
  return (
    <nav aria-label="Menú del visor" style={estilo} className="riel-pro entra panel pointer-events-auto absolute bottom-[var(--alto-estado)] left-0 top-0 z-30 flex w-[var(--ancho-riel)] flex-col items-center pb-3 pt-3.5">
      <h1 className="sr-only">Visor SIG · RN11 Chaco</h1>
      <span className="mb-4 grid h-12 place-items-center" title="Visor SIG · RN11 Chaco · IGN SIG 250 · UTN FRRe 2026">
        <EscudoRuta className="h-10 w-auto" />
      </span>
      <div className="flex w-full flex-col gap-1.5">
        <Item icono={Stack} etiqueta="Capas" activo={cajon === 'capas'} expandido={cajon === 'capas'} controla="cajon-pro" onPress={() => onCajon(cajon === 'capas' ? null : 'capas')} />
        <Item icono={ListBullets} etiqueta="Leyenda" activo={cajon === 'leyenda'} expandido={cajon === 'leyenda'} controla="cajon-pro" onPress={() => onCajon(cajon === 'leyenda' ? null : 'leyenda')} />
        <span aria-hidden="true" className="mx-auto my-1.5 h-px w-9 bg-[var(--linea)]" />
        <Item icono={IconoTabla} etiqueta="Atributos" titulo={tabla ? 'Cerrar la tabla de atributos (T)' : 'Tabla de atributos (T)'} activo={tabla} presionado={tabla} onPress={onTabla} />
        <Item icono={SplitHorizontal} etiqueta="Comparar" titulo="Comparar dos juegos de capas (C)" activo={comparar} presionado={comparar} onPress={onComparar} />
        <Item icono={FilePdf} etiqueta="Exportar" titulo="Exportar a PDF" atajo="P" onPress={onImprimir} />
      </div>
      <div className="mt-auto flex w-full flex-col gap-1.5">
        <Item icono={oscuro ? Sun : Moon} etiqueta={oscuro ? 'Claro' : 'Oscuro'} titulo={oscuro ? 'Tema claro' : 'Tema oscuro'} onPress={onTema} />
        <Item icono={GearSix} etiqueta="Ajustes" titulo="Configuración y ayuda" onPress={onAjustes} />
      </div>
    </nav>
  );
}

function Item({ icono: Icono, etiqueta, titulo = etiqueta, atajo, activo, expandido, presionado, controla, onPress }: {
  icono: Icon;
  etiqueta: string;
  titulo?: string;
  atajo?: string;
  activo?: boolean;
  expandido?: boolean;
  presionado?: boolean;
  controla?: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={titulo}
      title={atajo ? `${titulo} (${atajo})` : titulo}
      aria-keyshortcuts={atajo}
      aria-expanded={controla ? expandido : undefined}
      aria-controls={controla && expandido ? controla : undefined}
      aria-pressed={presionado}
      data-activo={activo || undefined}
      className="item-riel group flex w-full flex-col items-center gap-1 py-1 focus-visible:outline-none"
    >
      <span className="item-riel-pastilla relative grid h-9 w-[58px] place-items-center rounded-full">
        {/* La de Capas y Leyenda se desliza entre las dos (es un solo cajón); la de lo que se abre en el mapa, no. */}
        {activo && (controla
          ? <motion.span layoutId="riel-cajon" transition={RESORTE} className="absolute inset-0 rounded-full bg-[var(--acento-suave)]" />
          : <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={RESORTE} className="absolute inset-0 rounded-full bg-[var(--acento-suave)]" />)}
        <Icono size={22} weight={activo ? 'fill' : 'regular'} className="relative" />
      </span>
      <span aria-hidden="true" className="text-[13px] font-semibold leading-none tracking-[-0.005em]">{etiqueta}</span>
    </button>
  );
}
