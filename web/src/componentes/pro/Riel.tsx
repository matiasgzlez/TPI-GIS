import { Fragment } from 'react';
import {
  IconBarrierBlock, IconBookmark, IconChartBar, IconCloudDownload, IconCurrentLocation, IconDatabase, IconFileTypePdf,
  IconLayoutColumns, IconList, IconMap, IconMoon, IconRoad, IconSettings, IconShape, IconStack2, IconSun, IconTable,
} from '@tabler/icons-react';
import { motion } from 'motion/react';
import { Sidebar, SidebarBody, SidebarLink } from '@/componentes/ui/sidebar';
import { cn } from '@/lib/utils';
import EscudoRuta from '../EscudoRuta';

// Lo que se abre en el cajón, al lado de la sidebar.
export type Cajon = 'capas' | 'leyenda' | 'seleccion' | 'estadisticas' | 'obras' | 'servicios' | 'mapas-base' | 'coordenada' | 'vistas' | 'catalogo';

// El riel del modo profesional, con la sidebar de Aceternity: angosta (60 px, solo íconos) y se abre a 300 px
// con los nombres al pasar el mouse o al entrar con el teclado; al abrirse corre el cajón, el buscador y lo
// demás (no se superpone). Arriba el escudo y las capas; después las secciones (Análisis, Datos, Navegación y
// Base de datos); abajo, el tema y los ajustes.
export default function Riel({ estilo, abierta, onAbierta, cajon, onCajon, tabla, onTabla, comparar, onComparar, ruta, onRuta, onImprimir, oscuro, onTema, onAjustes }: {
  estilo?: React.CSSProperties;
  abierta: boolean;
  onAbierta: (abierta: boolean) => void;
  cajon: Cajon | null;
  onCajon: (c: Cajon | null) => void;
  tabla: boolean;
  onTabla: () => void;
  comparar: boolean;
  onComparar: () => void;
  ruta: boolean;
  onRuta: () => void;
  onImprimir: () => void;
  oscuro: boolean;
  onTema: () => void;
  onAjustes: () => void;
}) {
  const alCajon = (c: Cajon) => ({ activo: cajon === c, expandido: cajon === c, controla: 'cajon-pro', onPress: () => onCajon(cajon === c ? null : c) });
  const secciones: { titulo?: string; items: ItemProps[] }[] = [
    { items: [
      { icono: IconStack2, etiqueta: 'Capas', ...alCajon('capas') },
      { icono: IconList, etiqueta: 'Leyenda', ...alCajon('leyenda') },
    ] },
    { titulo: 'Análisis', items: [
      { icono: IconShape, etiqueta: 'Selección espacial', ...alCajon('seleccion') },
      { icono: IconChartBar, etiqueta: 'Estadísticas', ...alCajon('estadisticas') },
      { icono: IconRoad, etiqueta: 'Tablero RN11', activo: ruta, presionado: ruta, onPress: onRuta },
      { icono: IconLayoutColumns, etiqueta: 'Comparar', atajo: 'C', activo: comparar, presionado: comparar, onPress: onComparar },
    ] },
    { titulo: 'Datos', items: [
      { icono: IconTable, etiqueta: 'Tabla de atributos', atajo: 'T', activo: tabla, presionado: tabla, onPress: onTabla },
      { icono: IconBarrierBlock, etiqueta: 'Obras RN11', ...alCajon('obras') },
      { icono: IconCloudDownload, etiqueta: 'Servicios y descargas', ...alCajon('servicios') },
      { icono: IconMap, etiqueta: 'Mapas base', ...alCajon('mapas-base') },
      { icono: IconFileTypePdf, etiqueta: 'Exportar a PDF', atajo: 'P', onPress: onImprimir },
    ] },
    { titulo: 'Navegación', items: [
      { icono: IconCurrentLocation, etiqueta: 'Ir a coordenada', ...alCajon('coordenada') },
      { icono: IconBookmark, etiqueta: 'Vistas guardadas', ...alCajon('vistas') },
    ] },
    { titulo: 'Base de datos', items: [
      { icono: IconDatabase, etiqueta: 'Tablas de PostGIS', ...alCajon('catalogo') },
    ] },
  ];

  return (
    <nav aria-label="Menú del visor" style={estilo} className="entra pointer-events-auto absolute bottom-[var(--alto-estado)] left-0 top-0 z-30">
      <h1 className="sr-only">Visor SIG · RN11 Chaco</h1>
      <Sidebar open={abierta} setOpen={v => onAbierta(typeof v === 'function' ? v(abierta) : v)}>
        <SidebarBody
          data-abierta={abierta || undefined}
          className="riel-pro justify-between gap-4 bg-[var(--superficie)] dark:bg-[var(--superficie)]"
          onFocus={() => onAbierta(true)}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onAbierta(false); }}
        >
          <div className="riel-lista -mx-2 flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-2">
            <span className="relative z-20 flex items-center gap-2.5 py-1" title="Visor SIG · RN11 Chaco · IGN SIG 250 · UTN FRRe 2026">
              <EscudoRuta className="h-7 w-7 shrink-0" />
              {abierta && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-pre text-[17px] font-semibold text-[var(--tinta)]">
                  Visor SIG · RN11 Chaco
                </motion.span>
              )}
            </span>
            <div className="mt-5 flex flex-col">
              {secciones.map((s, i) => (
                <Fragment key={s.titulo ?? i}>
                  {s.titulo && (
                    <div className="riel-seccion flex h-8 items-center" aria-hidden={!abierta || undefined}>
                      {abierta
                        ? <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-pre text-[13px] font-bold uppercase tracking-[0.07em] text-[var(--tinta-3)]">{s.titulo}</motion.span>
                        : <span className="h-px w-full bg-[var(--linea)]" />}
                    </div>
                  )}
                  <div role={s.titulo ? 'group' : undefined} aria-label={s.titulo} className="flex flex-col gap-0.5">
                    {s.items.map(item => <Item key={item.etiqueta} {...item} />)}
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <Item icono={oscuro ? IconSun : IconMoon} etiqueta={oscuro ? 'Tema claro' : 'Tema oscuro'} onPress={onTema} />
            <Item icono={IconSettings} etiqueta="Ajustes" onPress={onAjustes} />
          </div>
        </SidebarBody>
      </Sidebar>
    </nav>
  );
}

interface ItemProps {
  icono: typeof IconStack2;
  etiqueta: string;
  atajo?: string;
  activo?: boolean;
  expandido?: boolean;
  presionado?: boolean;
  controla?: string;
  onPress: () => void;
}

function Item({ icono: Icono, etiqueta, atajo, activo, expandido, presionado, controla, onPress }: ItemProps) {
  return (
    <SidebarLink
      link={{
        label: etiqueta,
        href: '#',
        icon: <Icono className={cn('h-[22px] w-[22px] shrink-0 text-neutral-700 dark:text-neutral-200', activo && 'text-[var(--acento-tinta)] dark:text-[var(--acento-tinta)]')} />,
      }}
      role="button"
      aria-label={etiqueta}
      title={atajo ? `${etiqueta} (${atajo})` : etiqueta}
      aria-keyshortcuts={atajo}
      aria-expanded={controla ? expandido : undefined}
      aria-controls={controla && expandido ? controla : undefined}
      aria-pressed={presionado}
      data-activo={activo || undefined}
      onClick={e => { e.preventDefault(); onPress(); }}
      onKeyDown={e => { if (e.key === ' ') { e.preventDefault(); onPress(); } }}
      className="item-riel-aceternity -mx-[7px] gap-3 rounded-lg px-[7px] py-[7px]"
    />
  );
}
