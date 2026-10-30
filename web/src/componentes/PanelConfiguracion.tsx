import { useState } from 'react';
import { Switch } from '@heroui/react';
import { motion } from 'motion/react';
import { BookOpen, GearSix, Moon, Sun, X } from '@phosphor-icons/react';
import { HERRAMIENTAS, type Modo } from '../herramientas';
import { RESORTE_PANEL } from '../movimiento';
import type { Preferencias, Tamano } from '../preferencias';
import EscudoRuta from './EscudoRuta';
import { ICONOS_HERRAMIENTA, IconoCapa } from './iconos';
import { Segmentado } from './ui/segmentado';

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
  const [seccion, setSeccion] = useState<Seccion>('ajustes');
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
        role="dialog"
        aria-label="Configuración y ayuda"
        className="panel pointer-events-auto absolute bottom-4 right-4 top-4 z-40 flex w-[420px] flex-col overflow-hidden shadow-[var(--sombra-alta)] max-lg:inset-x-3 max-lg:bottom-3 max-lg:top-auto max-lg:max-h-[85cqh] max-lg:w-auto"
        initial={{ x: 460, opacity: 0.6 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 460, opacity: 0.6 }}
        transition={RESORTE_PANEL}
        onKeyDown={e => e.key === 'Escape' && onCerrar()}
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

        <div className="desplazable min-h-0 flex-1 overflow-y-auto border-t border-[var(--linea)] px-5 pb-6">
          {seccion === 'ajustes' ? (
            <>
              <Grupo titulo="Apariencia">
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
                  <div className="mb-2.5 text-[15px] font-medium">Tamaño de la interfaz</div>
                  <Segmentado etiqueta="Tamaño de la interfaz" valor={preferencias.tamano} onCambiar={v => onCambiar('tamano', v)} opciones={TAMANOS} />
                  <p className="mt-2 text-[13px] text-[var(--tinta-3)]">Grande es el pensado para el proyector. En el celular siempre se ve en tamaño normal.</p>
                </div>
              </Grupo>
              <Grupo titulo="Mapa">
                <Interruptor titulo="Cuadrícula de coordenadas" valor={preferencias.cuadricula} onCambiar={v => onCambiar('cuadricula', v)} />
                <Interruptor titulo="Minimapa de ubicación" valor={preferencias.minimapa} onCambiar={v => onCambiar('minimapa', v)} />
                <Interruptor
                  titulo="Reducir movimiento"
                  detalle="Sin vuelos ni animaciones: todo cambia al instante."
                  valor={preferencias.movimientoReducido}
                  onCambiar={v => onCambiar('movimientoReducido', v)}
                />
              </Grupo>
              <Grupo titulo="Datos">
                <p className="py-2 text-[14px] leading-relaxed text-[var(--tinta-2)]">
                  Capas del SIG IGN 250 cargadas en PostGIS y servidas por GeoServer (WMS, WFS y WFS-T). Coordenadas en WGS 84; las distancias y áreas se calculan sobre el elipsoide.
                </p>
              </Grupo>
            </>
          ) : (
            <>
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
              </Grupo>
              <Grupo titulo="Atajos de teclado">
                {[['/', 'Ir al buscador'], ['⌘ K', 'Ir al buscador'], ['1 – 6', 'Elegir herramienta'], ['Esc', 'Volver a navegar y cerrar resultados']].map(([tecla, texto]) => (
                  <div key={texto + tecla} className="flex items-center justify-between py-2 text-[15px]">
                    <span className="text-[var(--tinta-2)]">{texto}</span>
                    <kbd className="rounded-lg bg-[var(--superficie-2)] px-2.5 py-1 text-[13px] font-semibold">{tecla}</kbd>
                  </div>
                ))}
              </Grupo>
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
