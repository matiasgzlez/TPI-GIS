import { useEffect, useRef, useState } from 'react';
import { Switch } from '@heroui/react';
import { motion, useIsPresent } from 'motion/react';
import { BookOpen, FilePdf, GearSix, Moon, Printer, Sun, X } from '@phosphor-icons/react';
import { HERRAMIENTAS, type Modo } from '../herramientas';
import { RESORTE_PANEL } from '../movimiento';
import type { Preferencias, Tamano } from '../preferencias';
import EscudoRuta from './EscudoRuta';
import { ICONOS_HERRAMIENTA, IconoCapa } from './iconos';
import { Segmentado } from './ui/segmentado';
import { HERRAMIENTAS_SIMPLES, useInterfaz } from '../interfaz';

interface Props {
  preferencias: Preferencias;
  onCambiar: <K extends keyof Preferencias>(clave: K, valor: Preferencias[K]) => void;
  oscuro: boolean;
  onTema: (oscuro: boolean) => void;
  onCerrar: () => void;
}

// Qué hace cada herramienta, con un ejemplo concreto. Es el manual del visor.
const MANUAL: Record<Modo, { explicacion: string; ejemplo: string }> = {
  navegar: { explicacion: 'Mover y acercar el mapa.', ejemplo: 'Arrastrá para moverte; rueda, pellizco o los botones + y − para acercar.' },
  punto: { explicacion: 'Muestra qué hay en un lugar, en todas las capas prendidas.', ejemplo: 'Tocá una ruta para ver su tipo, número y estado.' },
  rectangulo: { explicacion: 'Lista todo lo que cae dentro de un rectángulo, capa por capa, con un resumen.', ejemplo: 'Encerrá Resistencia para contar escuelas y localidades.' },
  distancia: { explicacion: 'Mide sobre el elipsoide, en metros o kilómetros.', ejemplo: 'Clic en Resistencia, doble clic en Sáenz Peña: unos 160 km.' },
  area: { explicacion: 'Mide superficies en hectáreas o kilómetros cuadrados.', ejemplo: 'Dibujá el contorno de una laguna y cerralo con doble clic.' },
  alta: { explicacion: 'Carga una obra de mantenimiento de la RN11 en la base (WFS-T).', ejemplo: 'Tocá la traza, elegí "Bacheo", prioridad alta y guardá.' },
};

const TAMANOS: { valor: Tamano; etiqueta: string }[] = [
  { valor: 'compacto', etiqueta: 'Compacto' },
  { valor: 'normal', etiqueta: 'Normal' },
  { valor: 'grande', etiqueta: 'Grande' },
];

type Seccion = 'ajustes' | 'manual';

// Hoja lateral con los ajustes del visor y el manual de uso.
export default function PanelConfiguracion({ preferencias, onCambiar, oscuro, onTema, onCerrar }: Props) {
  const simple = useInterfaz() === 'simple';
  const [seccion, setSeccion] = useState<Seccion>('ajustes');
  const hoja = useRef<HTMLElement>(null);
  // Mientras sale (la animación dura ~0,5 s) ya no es modal: los atajos y el foco vuelven enseguida.
  const presente = useIsPresent();
  const previo = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  const devolverFoco = () => {
    const p = previo.current;
    const destino = p && p !== document.body && p.isConnected ? p
      : [...document.querySelectorAll<HTMLElement>('[aria-label="Configuración y ayuda"]')].find(el => el.getClientRects().length > 0);
    requestAnimationFrame(() => destino?.focus());
  };
  useEffect(() => { if (!presente) devolverFoco(); }, [presente]);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  // Es modal (oscurece el mapa): Escape la cierra a ella primero, el Tab no sale de la hoja, los atajos
  // del visor no actúan detrás (aria-modal) y, al cerrarse, el foco vuelve al engranaje.
  useEffect(() => {
    if (!presente) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (!hoja.current) return;
      if (e.key === 'Escape') {
        // Una lista abierta adentro (por ejemplo, un menú de HeroUI) se cierra primero.
        if ((e.target as HTMLElement | null)?.closest?.('[role="listbox"], [role="menu"]')) return;
        e.stopPropagation();
        cerrar.current();
      } else if (e.key === 'Tab') {
        const enfocables = [...hoja.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
          .filter(el => !el.hasAttribute('disabled') && el.getClientRects().length > 0 && !el.closest('[inert]'));
        if (!enfocables.length) return;
        const i = enfocables.indexOf(document.activeElement as HTMLElement);
        if (i === -1 || (e.shiftKey ? i === 0 : i === enfocables.length - 1)) {
          e.preventDefault();
          enfocables[e.shiftKey ? enfocables.length - 1 : 0].focus();
        }
      }
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  }, [presente]);
  return (
    <>
      <motion.div
        className="pointer-events-auto absolute inset-0 z-30 bg-black/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onCerrar}
      />
      <motion.aside
        ref={hoja}
        role="dialog"
        aria-modal={presente ? 'true' : undefined}
        aria-label="Configuración y ayuda"
        className="panel pointer-events-auto absolute bottom-4 right-4 top-4 z-40 flex w-[420px] flex-col overflow-hidden shadow-[var(--sombra-alta)] max-lg:inset-x-3 max-lg:bottom-3 max-lg:top-auto max-lg:max-h-[85cqh] max-lg:w-auto"
        initial={{ x: 460, opacity: 0.6 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 460, opacity: 0.6 }}
        transition={RESORTE_PANEL}
      >
        <header className="flex items-center gap-3 px-5 pb-3 pt-5">
          <h2 className="flex-1 text-[20px] font-semibold tracking-[-0.02em]">{seccion === 'ajustes' ? 'Configuración' : 'Cómo se usa'}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" autoFocus className="grid size-10 place-items-center rounded-xl text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]">
            <X size={19} />
          </button>
        </header>
        <div className="px-5 pb-4">
          <Segmentado
            etiqueta="Sección"
            valor={seccion}
            onCambiar={setSeccion}
            opciones={[
              { valor: 'ajustes', etiqueta: 'Ajustes', icono: <GearSix size={16} /> },
              { valor: 'manual', etiqueta: 'Manual', icono: <BookOpen size={16} /> },
            ]}
          />
        </div>

        {/* En el manual (largo y sin nada enfocable adentro) la región es enfocable: se desplaza con flechas y PageDown. El anillo no baja de 2 px reales con el zoom de la notebook. */}
        <div tabIndex={seccion === 'manual' ? 0 : undefined} role="region" aria-label="Contenido de Configuración" className="desplazable min-h-0 flex-1 overflow-y-auto border-t border-[var(--linea)] px-5 pb-6 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-[var(--vial)] focus-visible:[outline-width:max(2px,calc(2px/var(--zoom-interfaz)))]">
          {seccion === 'ajustes' ? (
            <>
              <Grupo titulo="Apariencia">
                <Fila titulo="Pantalla">
                  <Segmentado
                    etiqueta="Pantalla"
                    className="w-[220px]"
                    valor={preferencias.interfaz ?? 'simple'}
                    onCambiar={v => onCambiar('interfaz', v)}
                    opciones={[{ valor: 'simple', etiqueta: 'Simple' }, { valor: 'pro', etiqueta: 'Profesional' }]}
                  />
                </Fila>
                <Fila titulo="Tema">
                  <Segmentado
                    etiqueta="Tema"
                    className="w-[220px]"
                    valor={oscuro ? 'oscuro' : 'claro'}
                    onCambiar={v => onTema(v === 'oscuro')}
                    opciones={[
                      { valor: 'claro', etiqueta: 'Claro', icono: <Sun size={15} weight="bold" /> },
                      { valor: 'oscuro', etiqueta: 'Oscuro', icono: <Moon size={15} weight="bold" /> },
                    ]}
                  />
                </Fila>
                <div className="py-3">
                  <div className="mb-2.5 text-[15px] font-medium">{simple ? 'Tamaño de los botones y letras' : 'Tamaño de la interfaz'}</div>
                  <Segmentado etiqueta="Tamaño de la interfaz" valor={preferencias.tamano} onCambiar={v => onCambiar('tamano', v)} opciones={TAMANOS} />
                  <p className="mt-2 text-[13px] text-[var(--tinta-3)]">Grande es el pensado para el proyector. En el celular siempre se ve en tamaño normal.</p>
                </div>
              </Grupo>
              <Grupo titulo="Mapa">
                <Interruptor titulo={simple ? 'Líneas para ubicarse en el mapa' : 'Cuadrícula de coordenadas'} valor={preferencias.cuadricula} onCambiar={v => onCambiar('cuadricula', v)} />
                <Interruptor titulo={simple ? 'Mapa chiquito de dónde estás' : 'Minimapa de ubicación'} valor={preferencias.minimapa} onCambiar={v => onCambiar('minimapa', v)} />
                <Interruptor
                  titulo="Reducir movimiento"
                  detalle="Sin vuelos ni animaciones: todo cambia al instante."
                  valor={preferencias.movimientoReducido}
                  onCambiar={v => onCambiar('movimientoReducido', v)}
                />
              </Grupo>
              <Grupo titulo="Datos">
                <p className="py-2 text-[14px] leading-relaxed text-[var(--tinta-2)]">
                  {simple
                    ? 'Los datos son del Instituto Geográfico Nacional. Las distancias se miden sobre la forma real de la Tierra.'
                    : 'Capas del SIG IGN 250 cargadas en PostGIS y servidas por GeoServer (WMS, WFS y WFS-T). Coordenadas en WGS 84; las distancias y áreas se calculan sobre el elipsoide.'}
                </p>
              </Grupo>
            </>
          ) : (
            <>
              {simple ? (
                <>
                  <Grupo titulo="Para empezar">
                    <Ayuda icono={<EscudoRuta className="h-[22px] w-auto" />} titulo="Ver la ruta 11" texto="Te muestra la ruta, qué tan larga es y cuánta gente vive cerca." />
                    <Ayuda icono={<IconoCapa size={20} />} titulo="¿Qué querés ver?" texto="Tocá un tema, como Agua o Escuelas, y después lo que quieras mostrar en el mapa." />
                    <Ayuda icono={<span className="text-[15px] font-semibold">?</span>} titulo="Buscar" texto="Escribí un pueblo, una cosa (escuelas, ríos) o una pregunta." />
                  </Grupo>
                  <Grupo titulo="Botones">
                    {(['navegar', 'punto', 'rectangulo', 'distancia', 'area', 'alta'] as Modo[]).map(m => {
                      const Icono = ICONOS_HERRAMIENTA[m];
                      return <Ayuda key={m} icono={<Icono size={20} />} titulo={HERRAMIENTAS_SIMPLES[m].titulo} texto={HERRAMIENTAS_SIMPLES[m].pista} />;
                    })}
                  </Grupo>
                </>
              ) : (<>
              <Grupo titulo="Para empezar">
                <Ayuda icono={<EscudoRuta className="h-[22px] w-auto" />} titulo="Ver RN11" texto="Resalta la traza de la Ruta Nacional 11 en Chaco y la encuadra." />
                <Ayuda icono={<IconoCapa size={20} />} titulo="Capas" texto="Prendé y apagá capas con su switch, o un grupo entero con el de arriba. Al prender una capa aparece su leyenda." />
                <Ayuda
                  icono={<span className="text-[15px] font-semibold">/</span>}
                  titulo="Buscador"
                  texto="Escribí un lugar (Resistencia), una capa (ríos, puentes) o una herramienta (medir). Con el campo vacío muestra lo último que usaste."
                />
              </Grupo>
              <Grupo titulo="Herramientas">
                {(Object.keys(HERRAMIENTAS) as Modo[]).map(m => {
                  const Icono = ICONOS_HERRAMIENTA[m];
                  return (
                    <Ayuda
                      key={m}
                      icono={<Icono size={20} />}
                      titulo={HERRAMIENTAS[m].titulo}
                      texto={MANUAL[m].explicacion}
                      ejemplo={MANUAL[m].ejemplo}
                      tecla={HERRAMIENTAS[m].tecla}
                    />
                  );
                })}
                <Ayuda
                  icono={simple ? <Printer size={20} /> : <FilePdf size={20} />}
                  titulo={simple ? 'Imprimir el mapa' : 'Exportar a PDF'}
                  texto={simple
                    ? 'Arma una hoja con el mapa que estás viendo, qué significa cada color y la respuesta abierta. Se descarga para imprimirla.'
                    : 'Hoja A4 con la vista actual: título, grilla de coordenadas, norte, escala gráfica y numérica, leyenda, fuente y autores. Con una consulta o el tablero abiertos, suma páginas con cifras, gráfico y tabla.'}
                  ejemplo={simple ? 'Tocá "Ver la ruta 11", después Imprimir y Descargar el mapa.' : 'Abrí el tablero de la RN11, apretá P y descargá: mapa más la tabla de localidades.'}
                  tecla="P"
                />
              </Grupo>
              <Grupo titulo="Atajos de teclado">
                {[['/', 'Ir al buscador'], ['⌘ K', 'Ir al buscador'], ['1 – 6', 'Elegir herramienta'], ['P · ⌘P', simple ? 'Imprimir el mapa' : 'Exportar a PDF'], ...(simple ? [] : [['T', 'Abrir o cerrar la tabla de datos']]), ['C', simple ? 'Comparar dos mapas' : 'Abrir o cerrar el comparador'], ['Esc', 'Volver a navegar y cerrar resultados']].map(([tecla, texto]) => (
                  <div key={texto + tecla} className="flex items-center justify-between py-2 text-[15px]">
                    <span className="text-[var(--tinta-2)]">{texto}</span>
                    <kbd className="rounded-lg bg-[var(--superficie-2)] px-2.5 py-1 text-[13px] font-semibold">{tecla}</kbd>
                  </div>
                ))}
              </Grupo>
              </>)}
            </>
          )}
        </div>
      </motion.aside>
    </>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="pt-5">
      <h3 className="pb-1 text-[13px] font-semibold text-[var(--tinta-3)]">{titulo}</h3>
      <div className="divide-y divide-[var(--linea)]">{children}</div>
    </section>
  );
}

function Fila({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-4 py-2">
      <span className="text-[15px] font-medium">{titulo}</span>
      {children}
    </div>
  );
}

function Interruptor({ titulo, detalle, valor, onCambiar }: { titulo: string; detalle?: string; valor: boolean; onCambiar: (v: boolean) => void }) {
  return (
    <Switch isSelected={valor} onChange={onCambiar} className="w-full">
      <Switch.Content className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-4 py-2">
        <span>
          <span className="block text-[15px] font-medium">{titulo}</span>
          {detalle && <span className="block text-[13px] text-[var(--tinta-3)]">{detalle}</span>}
        </span>
        <Switch.Control><Switch.Thumb /></Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

function Ayuda({ icono, titulo, texto, ejemplo, tecla }: { icono: React.ReactNode; titulo: string; texto: string; ejemplo?: string; tecla?: string }) {
  return (
    <div className="flex gap-3.5 py-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-[var(--superficie-2)] text-[var(--tinta-2)]">{icono}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold">{titulo}</span>
          {tecla && <kbd className="rounded-lg bg-[var(--superficie-2)] px-2 py-0.5 text-[13px] font-semibold text-[var(--tinta-2)]">{tecla}</kbd>}
        </div>
        <p className="mt-0.5 text-[14px] leading-relaxed text-[var(--tinta-2)]">{texto}</p>
        {ejemplo && <p className="mt-1.5 rounded-lg bg-[var(--superficie-2)] px-3 py-2 text-[13px] leading-relaxed text-[var(--tinta-2)]">{ejemplo}</p>}
      </div>
    </div>
  );
}
