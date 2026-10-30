import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Toast, toast } from '@heroui/react';
import { CornersOut, GearSix, Minus, Moon, Plus, Sun } from '@phosphor-icons/react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { LineString, MultiLineString } from 'ol/geom';
import { buffer, getCenter } from 'ol/extent';
import BarraEstado from './componentes/BarraEstado';
import Buscador from './componentes/Buscador';
import Dock from './componentes/Dock';
import EscudoRuta from './componentes/EscudoRuta';
import Minimapa from './componentes/Minimapa';
import PanelCapas from './componentes/PanelCapas';
import type { EstadoResultados } from './componentes/PanelResultados';
import type { Sugerencia } from './comandos';
import { activarHerramienta, consultarCapaEnExtension, HERRAMIENTAS, type Modo } from './herramientas';
import { activarCartel } from './cartel';
import { analizarRn11, type AnalisisRn11 } from './analisisRn11';
import { aprender } from './aprendizaje';
import { usePrediccion } from './prediccion';
import { claveDe, type Interpretacion } from './lenguaje';
import { guardarObra, type DatosObra } from './obras';
import { useTema } from './tema';
import { usePreferencias } from './preferencias';
import { RESORTE_PANEL } from './movimiento';
import { aplicarTema, cambiarCapas, cargarRn11, crearVisor, refrescarMapa, restablecerCapas, verChaco, volarA, type Visor } from './visor';

// Se cargan recién cuando hacen falta: el formulario trae Select, TextArea y el botón animado.
const FormObra = lazy(() => import('./componentes/FormObra'));
const PanelResultados = lazy(() => import('./componentes/PanelResultados'));
const PanelConfiguracion = lazy(() => import('./componentes/PanelConfiguracion'));
const TableroRn11 = lazy(() => import('./componentes/TableroRn11'));

const retraso = (ms: number) => ({ '--retraso': `${ms}ms` }) as React.CSSProperties;
const esCelular = () => !window.matchMedia('(min-width: 1024px)').matches;

interface EstadoRn11 { cargando: boolean; activa: boolean; tramos?: number }

export default function App() {
  const destino = useRef<HTMLDivElement>(null);
  const [visor, setVisor] = useState<Visor | null>(null);
  const [modo, setModo] = useState<Modo>('navegar');
  const [resultados, setResultados] = useState<EstadoResultados | null>(null);
  const [obra, setObra] = useState<Point | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [rn11, setRn11] = useState<EstadoRn11>({ cargando: false, activa: false });
  const { oscuro, cambiar: cambiarTema } = useTema();
  const { preferencias, cambiar: cambiarPreferencia } = usePreferencias();
  const [configuracion, setConfiguracion] = useState(false);
  const enVista = usePrediccion(visor);
  const [tablero, setTablero] = useState<{ analisis?: AnalisisRn11; error?: string } | null>(null);

  // El mapa de OpenLayers se crea una sola vez; React maneja los paneles de alrededor.
  useEffect(() => {
    const v = crearVisor(destino.current!);
    setVisor(v);
    // Entrada: cuando el mapa terminó de dibujarse (o a los 1,8 s) hace un zoom hasta Chaco. El mapa no
    // se oculta mientras tanto: su fondo es el papel, y ocultarlo atrasaba el primer pintado ~700 ms.
    // Un clic o la rueda saltean la entrada.
    let inicio: ReturnType<typeof setTimeout> | undefined;
    let arrancado = false;
    const arrancar = () => {
      if (arrancado) return;
      arrancado = true;
      inicio = setTimeout(() => verChaco(v, 1600), 350);
    };
    v.mapa.once('rendercomplete', arrancar);
    const tope = setTimeout(arrancar, 1800);
    const saltear = () => {
      arrancar();
      clearTimeout(inicio);
      verChaco(v, 0);
    };
    v.mapa.getViewport()!.addEventListener('pointerdown', saltear, { once: true });
    v.mapa.getViewport()!.addEventListener('wheel', saltear, { once: true, passive: true });
    return () => {
      clearTimeout(inicio);
      clearTimeout(tope);
      v.mapa.setTarget(undefined);
    };
  }, []);

  useEffect(() => {
    if (!visor) return;
    aplicarTema(visor);
    visor.cuadricula.setVisible(preferencias.cuadricula);
  }, [visor, oscuro, preferencias.cuadricula]);

  // Cartel con el nombre de lo que hay bajo el cursor, solo mientras se navega o se consulta por punto.
  const modoActual = useRef(modo);
  modoActual.current = modo;
  useEffect(() => {
    if (!visor) return;
    return activarCartel(visor, () => modoActual.current === 'navegar' || modoActual.current === 'punto');
  }, [visor]);

  useEffect(() => {
    if (!visor) return;
    setObra(null);
    if (modo === 'navegar' || modo === 'alta') setResultados(null);
    return activarHerramienta(visor, modo, {
      consultando: origen => setResultados({ tipo: 'cargando', origen }),
      consulta: consulta => {
        setResultados({ tipo: 'consulta', consulta });
        // En la consulta por punto, lo más relevante (la capa de más arriba) queda seleccionado y late.
        const primera = consulta.origen === 'punto' ? consulta.capas[0]?.entidades[0] : undefined;
        if (primera) visor.foco.addFeature(primera.feature);
      },
      error: mensaje => setResultados({ tipo: 'error', mensaje }),
      medicion: medicion => setResultados(medicion ? { tipo: 'medicion', medicion } : null),
      nuevaObra: setObra,
    });
  }, [visor, modo]);

  // Atajos: 1–6 eligen herramienta y Esc vuelve a navegar. "/" y ⌘K los maneja el buscador.
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      const escribiendo = e.target instanceof HTMLElement && e.target.closest('input, textarea, [role="listbox"], form');
      if (e.key === 'Escape' && !escribiendo) {
        setModo('navegar');
        cerrarResultados();
        return;
      }
      if (escribiendo || e.metaKey || e.ctrlKey || e.altKey) return;
      const elegido = (Object.keys(HERRAMIENTAS) as Modo[]).find(m => HERRAMIENTAS[m].tecla === e.key);
      if (elegido) setModo(elegido);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  });

  function cerrarResultados() {
    setResultados(null);
    visor?.resaltado.clear();
    visor?.foco.clear();
    visor?.dibujo.clear();
  }

  async function guardar(datos: DatosObra) {
    setGuardando(true);
    try {
      const id = await guardarObra(obra!, datos);
      refrescarMapa(visor!);
      toast.success('Obra guardada', { description: `GeoServer la registró como ${id}.` });
      // Deja ver el tilde del botón antes de cerrar la tarjeta.
      setTimeout(() => {
        setObra(null);
        visor!.dibujo.clear();
      }, 900);
    } catch (error) {
      toast.danger('No se pudo guardar la obra', { description: resumirError(error), timeout: 8000 });
      throw error;
    } finally {
      setGuardando(false);
    }
  }

  async function mostrarRn11(alternar: boolean) {
    if (!visor || rn11.cargando) return;
    if (rn11.activa && alternar) {
      visor.rn11.setVisible(false);
      visor.analisis.clear();
      setRn11({ ...rn11, activa: false });
      setTablero(null);
      return;
    }
    setRn11({ ...rn11, cargando: true });
    setResultados(null);
    setTablero({});
    try {
      const { tramos } = await cargarRn11(visor);
      visor.rn11.setVisible(true);
      volarA(visor, visor.rn11.getSource()!.getExtent()!, { duracion: 1400 });
      setRn11({ cargando: false, activa: true, tramos });
      mostrarAnalisis();
    } catch {
      setTablero(null);
      setRn11({ cargando: false, activa: false });
      toast.danger('No se pudo cargar la traza de la RN11', { description: '¿Está levantado GeoServer?' });
    }
  }

  // Las respuestas de la parte B en el mapa (bandas, localidades por franja, puentes) y en el tablero.
  async function mostrarAnalisis() {
    if (!visor) return;
    try {
      const analisis = await analizarRn11();
      visor.analisis.clear();
      // Toda la traza en una sola geometría: cada banda se pinta de una vez y la transparencia no se
      // acumula donde los tramos se tocan.
      const lineas = visor.rn11.getSource()!.getFeatures().flatMap(f => {
        const g = f.getGeometry() as MultiLineString | LineString;
        return g.getType() === 'MultiLineString' ? (g as MultiLineString).getCoordinates() : [(g as LineString).getCoordinates()];
      });
      visor.analisis.addFeature(new Feature({ geometry: new MultiLineString(lineas), tipo_analisis: 'traza' }));
      analisis.localidades.forEach(l => {
        l.feature.set('tipo_analisis', 'localidad');
        l.feature.set('habitantes', l.habitantes);
      });
      analisis.puentes.forEach(p => p.feature.set('tipo_analisis', 'puente'));
      visor.analisis.addFeatures([...analisis.localidades.map(l => l.feature), ...analisis.puentes.map(p => p.feature)]);
      setTablero({ analisis });
    } catch (error) {
      setTablero({ error: (error as Error).message });
    }
  }

  // Una pregunta en lenguaje natural: la consulta se resuelve en GeoServer, se resalta en el mapa y
  // se cuenta para "lo más consultado".
  async function preguntar(i: Interpretacion) {
    if (!visor) return;
    aprender('consulta', claveDe(i), JSON.stringify(i));
    if (i.intencion === 'tablero') {
      mostrarRn11(false);
      return;
    }
    if (!visor.visibles.has(i.capa)) cambiarCapas(visor, [i.capa], true);
    setTablero(null);
    setResultados({ tipo: 'cargando', origen: 'lenguaje' });
    try {
      const { ejecutar } = await import('./consultaLenguaje');
      const consulta = await ejecutar(visor, i);
      setResultados({ tipo: 'consulta', consulta });
      const extension = visor.resaltado.getExtent();
      if (consulta.capas.length && extension?.every(Number.isFinite)) volarA(visor, buffer(extension!, 3000), { maxZoom: 12, duracion: 1200 });
    } catch (error) {
      setResultados({ tipo: 'error', mensaje: (error as Error).message });
    }
  }

  // Lo que se elige en el buscador central.
  function elegir(s: Sugerencia) {
    if (!visor) return;
    const separador = s.id.indexOf(':');
    const [tipo, valor] = [s.id.slice(0, separador), s.id.slice(separador + 1)];
    if (tipo === 'vista') {
      if (!visor.visibles.has(valor)) cambiarCapas(visor, [valor], true);
      setTablero(null);
      setResultados({ tipo: 'cargando', origen: 'rectangulo' });
      consultarCapaEnExtension(visor, valor, visor.mapa.getView().calculateExtent(visor.mapa.getSize()))
        .then(consulta => setResultados({ tipo: 'consulta', consulta }), error => setResultados({ tipo: 'error', mensaje: String(error) }));
    } else if (tipo === 'pregunta' && s.interpretacion) {
      // Lo que se eligió en "¿Quisiste decir?" queda aprendido: la frase y sus palabras nuevas.
      if (s.aprender) {
        aprender('frase', s.aprender.frase, JSON.stringify(s.interpretacion));
        s.aprender.desconocidas.forEach(p => aprender('sinonimo', p, s.interpretacion!.capa));
      }
      preguntar(s.interpretacion);
    } else if (tipo === 'lugar' && s.extension) {
      volarA(visor, s.extension, { maxZoom: 12, duracion: 1200 });
      visor.foco.clear();
      visor.foco.addFeature(new Feature(new Point(getCenter(s.extension))));
    } else if (tipo === 'herramienta') {
      setModo(valor as Modo);
    } else if (tipo === 'capa') {
      const prender = !visor.visibles.has(valor);
      cambiarCapas(visor, [valor], prender);
      toast(`${s.titulo}: ${prender ? 'prendida' : 'apagada'}`, { timeout: 2500 });
    } else if (valor === 'rn11') {
      mostrarRn11(false);
    } else if (valor === 'chaco') {
      verChaco(visor);
    } else if (valor === 'apagar') {
      cambiarCapas(visor, [...visor.visibles], false);
    } else if (valor === 'restablecer') {
      restablecerCapas(visor);
    } else if (valor === 'tema') {
      cambiarTema(!oscuro);
    }
  }

  const zoom = (delta: number) => {
    const vista = visor!.mapa.getView();
    vista.animate({ zoom: vista.getZoom()! + delta, duration: 250 });
  };

  return (
    <>
      <div className="mapa" ref={destino} />

      {visor && (
        <MotionConfig reducedMotion={preferencias.movimientoReducido ? 'always' : 'user'}>
        <div className="interfaz">
          {/* Arriba: marca, buscador al centro, RN11, tema y configuración. */}
          <header className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start gap-3 lg:inset-x-4 lg:top-4">
            <div className="entra pointer-events-auto max-xl:hidden" style={retraso(100)}>
              <Marca />
            </div>
            <div className="entra pointer-events-auto mx-auto w-full lg:absolute lg:left-[356px] lg:w-[calc(100cqw-356px-452px)] xl:left-1/2 xl:w-[clamp(420px,calc(100cqw-880px),600px)] xl:-translate-x-1/2" style={retraso(180)}>
              <Buscador capaPrendida={nombre => visor.visibles.has(nombre)} enVista={enVista} onElegir={elegir} />
            </div>
            <div className="entra pointer-events-auto ml-auto flex items-center gap-2.5 max-lg:hidden" style={retraso(260)}>
              <BotonRn11 estado={rn11} onPress={() => mostrarRn11(true)} />
              <BotonRedondo etiqueta={oscuro ? 'Tema claro' : 'Tema oscuro'} onPress={() => cambiarTema(!oscuro)}>
                {oscuro ? <Sun size={21} weight="bold" /> : <Moon size={21} weight="bold" />}
              </BotonRedondo>
              <BotonRedondo etiqueta="Configuración y ayuda" onPress={() => setConfiguracion(true)}>
                <GearSix size={22} weight="bold" />
              </BotonRedondo>
            </div>
          </header>

          {/* Izquierda: capas y escala. */}
          <aside className="pointer-events-none absolute bottom-4 left-4 top-4 z-10 xl:top-[92px] flex w-[340px] flex-col gap-3 max-lg:bottom-auto max-lg:left-3 max-lg:right-3 max-lg:top-[84px] max-lg:max-h-[52vh] max-lg:w-auto">
            <div className="entra pointer-events-auto flex min-h-0 flex-1 flex-col" style={retraso(220)}>
              <PanelCapas visor={visor} plegable={esCelular()} />
            </div>
            <div className="entra pointer-events-auto max-lg:hidden" style={retraso(420)}>
              <BarraEstado visor={visor} />
            </div>
          </aside>

          {/* Derecha: resultados de consultas y mediciones. */}
          <AnimatePresence>
            {!resultados && tablero && (
              <motion.div
                key="tablero"
                className="pointer-events-none absolute bottom-[184px] right-4 top-[92px] z-10 flex w-[400px] flex-col max-lg:inset-x-3 max-lg:bottom-[110px] max-lg:top-auto max-lg:max-h-[46cqh] max-lg:w-auto"
                initial={{ opacity: 0, x: 32, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 32, scale: 0.98 }}
                transition={RESORTE_PANEL}
              >
                <div className="pointer-events-auto flex min-h-0 flex-col">
                  <Suspense fallback={null}>
                    <TableroRn11 visor={visor} analisis={tablero.analisis} error={tablero.error} onCerrar={() => setTablero(null)} />
                  </Suspense>
                </div>
              </motion.div>
            )}
            {resultados && (
              <motion.div
                key="resultados"
                className="pointer-events-none absolute bottom-[184px] right-4 top-[92px] z-10 flex w-[400px] flex-col max-lg:inset-x-3 max-lg:bottom-[110px] max-lg:top-auto max-lg:max-h-[46cqh] max-lg:w-auto"
                initial={{ opacity: 0, x: 32, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 32, scale: 0.98 }}
                transition={RESORTE_PANEL}
              >
                <div className="pointer-events-auto flex min-h-0 flex-col">
                  <Suspense fallback={null}>
                    <PanelResultados visor={visor} estado={resultados} onCerrar={cerrarResultados} />
                  </Suspense>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Abajo: herramientas al centro; zoom y minimapa a la derecha. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center max-lg:bottom-3 lg:left-[356px] lg:right-[230px] xl:left-0 xl:right-0">
            <div className="entra pointer-events-auto" style={retraso(340)}>
              <Dock modo={modo} onModo={setModo} />
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-end gap-3 max-lg:hidden">
            <div className="entra panel pointer-events-auto flex flex-col p-1.5" style={retraso(460)}>
              <BotonMapa etiqueta="Acercar" onPress={() => zoom(1)}><Plus size={20} /></BotonMapa>
              <BotonMapa etiqueta="Alejar" onPress={() => zoom(-1)}><Minus size={20} /></BotonMapa>
              <span className="mx-2.5 my-1 h-px bg-[var(--linea)]" />
              <BotonMapa etiqueta="Ver Chaco completo" onPress={() => verChaco(visor)}><CornersOut size={20} /></BotonMapa>
            </div>
            {preferencias.minimapa && (
              <div className="entra pointer-events-auto" style={retraso(520)}>
                <Minimapa visor={visor} />
              </div>
            )}
          </div>

          {/* Celular: RN11, tema y configuración arriba del dock (se ocultan mientras hay un panel abierto). */}
          <div className={`pointer-events-none absolute bottom-[100px] right-3 z-10 transition-opacity duration-300 lg:hidden ${resultados || tablero ? 'invisible opacity-0' : ''}`}>
            <div className="pointer-events-auto flex gap-2">
              <BotonRn11 estado={rn11} onPress={() => mostrarRn11(true)} />
              <BotonRedondo etiqueta={oscuro ? 'Tema claro' : 'Tema oscuro'} onPress={() => cambiarTema(!oscuro)} compacto>
                {oscuro ? <Sun size={20} weight="bold" /> : <Moon size={20} weight="bold" />}
              </BotonRedondo>
              <BotonRedondo etiqueta="Configuración y ayuda" onPress={() => setConfiguracion(true)} compacto>
                <GearSix size={21} weight="bold" />
              </BotonRedondo>
            </div>
          </div>

          <AnimatePresence>
            {configuracion && (
              <Suspense fallback={null}>
                <PanelConfiguracion
                  preferencias={preferencias}
                  onCambiar={cambiarPreferencia}
                  oscuro={oscuro}
                  onTema={cambiarTema}
                  onCerrar={() => setConfiguracion(false)}
                />
              </Suspense>
            )}
          </AnimatePresence>
        </div>

          {obra && (
            <Suspense fallback={null}>
              <FormObra
                visor={visor}
                punto={obra}
                guardando={guardando}
                onGuardar={guardar}
                onCancelar={() => {
                  setObra(null);
                  visor.dibujo.clear();
                }}
              />
            </Suspense>
          )}
        </MotionConfig>
      )}

      <Toast.Provider placement="top end" />
    </>
  );
}

function Marca() {
  return (
    <div className="panel flex h-[60px] w-[340px] items-center gap-3 px-4">
      <EscudoRuta className="h-9 w-auto shrink-0" />
      <div className="min-w-0">
        <h1 className="text-[18px] font-semibold leading-tight tracking-[-0.02em]">Visor SIG · RN11 Chaco</h1>
        <p className="text-[13px] leading-tight text-[var(--tinta-3)]">IGN SIG 250 · UTN FRRe 2026</p>
      </div>
    </div>
  );
}

function BotonRn11({ estado, onPress }: { estado: EstadoRn11; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={estado.activa}
      className={`panel flex h-[60px] w-[200px] items-center gap-3 pl-3.5 pr-4 text-left max-lg:w-auto transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 max-lg:h-12 max-lg:pr-3.5 ${
        estado.activa ? '!bg-[var(--vial)] text-white' : 'hover:bg-[var(--superficie-2)]'
      }`}
      style={estado.activa ? ({ '--escudo-fondo': 'var(--vial)', '--escudo-tinta': '#fff' } as React.CSSProperties) : undefined}
    >
      <EscudoRuta className={`h-8 w-auto max-lg:h-7 ${estado.cargando ? 'animate-pulse' : ''}`} />
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold leading-tight">{estado.activa ? 'Ocultar RN11' : 'Ver RN11'}</span>
        <span className={`text-[13px] leading-tight max-lg:hidden ${estado.activa ? 'text-white/85' : 'text-[var(--tinta-3)]'}`}>
          {estado.cargando ? 'Cargando traza…' : estado.activa ? `${estado.tramos} tramos en Chaco` : 'Traza en Chaco'}
        </span>
      </span>
    </button>
  );
}

function BotonRedondo({ etiqueta, onPress, compacto, children }: { etiqueta: string; onPress: () => void; compacto?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={etiqueta}
      title={etiqueta}
      className={`panel grid shrink-0 place-items-center text-[var(--tinta-2)] transition-colors hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)] focus-visible:outline-2 ${compacto ? 'size-12' : 'size-[60px]'}`}
    >
      {children}
    </button>
  );
}

function BotonMapa({ etiqueta, onPress, children }: { etiqueta: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onPress}
      className="grid size-11 place-items-center rounded-xl text-[var(--tinta-2)] transition-colors hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)] focus-visible:outline-2"
    >
      {children}
    </button>
  );
}

function resumirError(error: unknown) {
  const texto = (error as Error).message ?? String(error);
  const excepcion = texto.match(/<ows:ExceptionText>([\s\S]*?)<\/ows:ExceptionText>/)?.[1];
  return (excepcion ?? texto).slice(0, 220);
}
