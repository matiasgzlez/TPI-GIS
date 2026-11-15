import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast, toast } from '@heroui/react';
import { CornersOut, FilePdf, GearSix, ListBullets, Minus, Moon, Plus, Question, Stack, Sun, Table as IconoTabla, X } from '@phosphor-icons/react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { buffer, getCenter } from 'ol/extent';
import { unByKey } from 'ol/Observable';
import BarraEstado from './componentes/BarraEstado';
import Buscador from './componentes/Buscador';
import Dock from './componentes/Dock';
import InterruptorModo from './componentes/InterruptorModo';
import Acciones from './componentes/simple/Acciones';
import PanelTemas from './componentes/simple/PanelTemas';
import BarraHerramientas from './componentes/pro/BarraHerramientas';
import Inspector, { type PestanaInspector } from './componentes/pro/Inspector';
import LeyendaGeneral from './componentes/LeyendaGeneral';
import { InterfazContexto, useInterfaz, hayDialogoModal, escribiendoEn, tituloSimple } from './interfaz';
import EscudoRuta from './componentes/EscudoRuta';
import Minimapa from './componentes/Minimapa';
import PanelCapas from './componentes/PanelCapas';
import type { EstadoResultados } from './componentes/PanelResultados';
import type { Sugerencia } from './comandos';
import { activarHerramienta, consultarCapaEnExtension, HERRAMIENTAS, type Modo } from './herramientas';
import { activarCartel, type RutaBajoCursor } from './cartel';
import { analizarRuta, mismaRuta, provinciaEn, RN11, trazaRuta, type AnalisisRuta, type Ruta } from './analisisRuta';
import { aprender } from './aprendizaje';
import { usePrediccion } from './prediccion';
import { claveDe, type Interpretacion } from './lenguaje';
import { guardarObra, type DatosObra } from './obras';
import { useTema } from './tema';
import { usePreferencias } from './preferencias';
import { RESORTE_PANEL } from './movimiento';
import { aplicarFactor, aplicarTema, callarRotulos, cambiarCapas, capasVisibles, crearVisor, dibujarRuta, ocultarRuta, ponerDisposicion, refrescarMapa, restablecerCapas, suscribirCapas, verChaco, volarA, type Visor } from './visor';
import { tituloProvincia } from './provincias';
import { AvisoCalor } from './componentes/Calor';
import type { Contenido } from './exportar/pdf';

// Se cargan recién cuando hacen falta: el formulario trae Select, TextArea y el botón animado.
const FormObra = lazy(() => import('./componentes/FormObra'));
const PanelResultados = lazy(() => import('./componentes/PanelResultados'));
const PanelConfiguracion = lazy(() => import('./componentes/PanelConfiguracion'));
const TableroRuta = lazy(() => import('./componentes/TableroRuta'));
const Bienvenida = lazy(() => import('./componentes/Bienvenida'));
const Guia = lazy(() => import('./componentes/simple/Guia'));
// Imprimir / exportar a PDF: jsPDF, pdf.js y la letra incrustada se cargan solo al abrirlo.
const Imprimir = lazy(() => import('./exportar/Imprimir'));
const TablaDatos = lazy(() => import('./componentes/pro/TablaDatos'));

const retraso = (ms: number) => ({ '--retraso': `${ms}ms` }) as React.CSSProperties;
// Si la pantalla cumple una media query, atento a los cambios de tamaño.
function useMedia(consultaCss: string) {
  const [cumple, setCumple] = useState(() => window.matchMedia(consultaCss).matches);
  useEffect(() => {
    const consulta = window.matchMedia(consultaCss);
    const cambio = () => setCumple(consulta.matches);
    consulta.addEventListener('change', cambio);
    return () => consulta.removeEventListener('change', cambio);
  }, [consultaCss]);
  return cumple;
}
// Celular o tablet chica: menos de 1024 px.
const useCelular = () => useMedia('(max-width: 1023px)');

// La ruta nacional del tablero: la RN11 en Chaco desde el botón, o cualquier otra con doble clic.
interface EstadoRuta { cargando: boolean; activa: Ruta | null; tramos?: number }

export default function App() {
  const destino = useRef<HTMLDivElement>(null);
  const [visor, setVisor] = useState<Visor | null>(null);
  const [modo, setModo] = useState<Modo>('navegar');
  const [resultados, setResultados] = useState<EstadoResultados | null>(null);
  const [obra, setObra] = useState<Point | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ruta, setRuta] = useState<EstadoRuta>({ cargando: false, activa: null });
  // Cada pedido de ruta tiene un número: si llega uno nuevo (otro doble clic), el anterior se descarta.
  const pedidoRuta = useRef(0);
  const { oscuro, cambiar: cambiarTema } = useTema();
  const { preferencias, cambiar: cambiarPreferencia, factor } = usePreferencias();
  const [configuracion, setConfiguracion] = useState(false);
  const [exportar, setExportar] = useState(false);
  const enVista = usePrediccion(visor);
  const [tablero, setTablero] = useState<{ ruta: Ruta; analisis?: AnalisisRuta; error?: string } | null>(null);
  // Simple o profesional. Hasta elegir en la bienvenida, detrás se ve el simple.
  const interfaz = preferencias.interfaz ?? 'simple';
  const celular = useCelular();
  const [guia, setGuia] = useState(false);
  const [plegado, setPlegado] = useState(false);
  const [pestana, setPestana] = useState<PestanaInspector>('informacion');
  const [temasAbierto, setTemasAbierto] = useState(false);
  // Tabla de datos (T4, solo en el profesional): la capa abierta y si está agrandada. Su alto (medido) le
  // corre el borde de abajo al encuadre del mapa y sube los botones de zoom.
  const [tabla, setTabla] = useState<{ capa: string; amplia: boolean } | null>(null);
  const [altoTabla, setAltoTabla] = useState(0);
  const ultimaTabla = useRef<string | null>(null);
  const [recargaObras, setRecargaObras] = useState(0);
  const modal = !preferencias.interfaz || guia || exportar;
  // Pro por debajo de 1440 px (la notebook de 1366): sin nada que mostrar, el inspector se pliega a un botón y le deja el lugar al mapa.
  const anchoAmplio = useMedia('(min-width: 1440px)');
  const hayContenido = !!(obra || resultados || tablero);
  const inspectorPlegado = interfaz === 'pro' && !anchoAmplio && !hayContenido && pestana === 'informacion';

  // El encuadre del mapa deja libres los bordes que tapa la interfaz a la vista.
  useEffect(() => ponerDisposicion(interfaz, plegado, inspectorPlegado, tabla ? altoTabla : 0), [interfaz, plegado, inspectorPlegado, tabla, altoTabla]);
  // La tabla es del profesional: al pasar al simple se cierra.
  useEffect(() => { if (interfaz !== 'pro') setTabla(null); }, [interfaz]);
  // En el profesional, un resultado nuevo o el tablero se muestran en "Información".
  useEffect(() => {
    if (resultados || tablero || obra) setPestana('informacion');
  }, [resultados, tablero, obra]);

  // El mapa de OpenLayers se crea una sola vez; React maneja los paneles de alrededor.
  useEffect(() => {
    const v = crearVisor(destino.current!);
    setVisor(v);
    // Entrada: cuando el mapa terminó de dibujarse (o a los 1,8 s) hace un zoom hasta Chaco. El mapa no
    // se oculta mientras tanto: su fondo es el papel, y ocultarlo atrasaba el primer pintado ~700 ms.
    // Un clic o la rueda saltean la entrada, solo mientras dura: antes los escuchas quedaban puestos y el
    // primer toque sobre el mapa, aunque fuera mucho después, devolvía la vista a Chaco.
    let inicio: ReturnType<typeof setTimeout> | undefined;
    let fin: ReturnType<typeof setTimeout> | undefined;
    let arrancado = false;
    const viewport = v.mapa.getViewport()!;
    const terminar = () => {
      viewport.removeEventListener('pointerdown', saltear);
      viewport.removeEventListener('wheel', saltear);
      // Marca que la entrada terminó: la batería de verificación (scripts/verificar) la espera antes de medir.
      document.documentElement.dataset.entrada = 'lista';
    };
    const arrancar = () => {
      if (arrancado) return;
      arrancado = true;
      inicio = setTimeout(() => {
        verChaco(v, 1600);
        fin = setTimeout(terminar, 1650);
      }, 350);
    };
    v.mapa.once('rendercomplete', arrancar);
    const tope = setTimeout(arrancar, 1800);
    function saltear() {
      terminar();
      clearTimeout(tope);
      clearTimeout(inicio);
      clearTimeout(fin);
      arrancado = true;
      verChaco(v, 0);
    }
    viewport.addEventListener('pointerdown', saltear);
    viewport.addEventListener('wheel', saltear, { passive: true });
    return () => {
      terminar();
      clearTimeout(inicio);
      clearTimeout(fin);
      clearTimeout(tope);
      v.mapa.setTarget(undefined);
    };
  }, []);

  // En la tele (factor de pantalla mayor a 1), rótulos y símbolos del mapa crecen con la interfaz.
  useEffect(() => {
    if (visor) aplicarFactor(visor, factor);
  }, [visor, factor]);

  useEffect(() => {
    if (!visor) return;
    aplicarTema(visor);
    visor.cuadricula.setVisible(preferencias.cuadricula);
  }, [visor, oscuro, preferencias.cuadricula]);

  // Cartel con el nombre de lo que hay bajo el cursor, solo mientras se navega o se consulta por punto.
  // Si es una ruta nacional, el doble clic la elige y abre su tablero (en vez de acercar el mapa).
  const modoActual = useRef(modo);
  modoActual.current = modo;
  const interfazActual = useRef(interfaz);
  interfazActual.current = interfaz;
  const elegirRutaEn = useRef<(numero: string, coordenada: number[]) => void>(() => {});
  useEffect(() => {
    if (!visor) return;
    let bajoCursor: RutaBajoCursor | null = null;
    const quitarCartel = activarCartel(visor, {
      habilitado: () => modoActual.current === 'navegar' || modoActual.current === 'punto',
      simple: () => interfazActual.current === 'simple',
      alCambiarRuta: r => { bajoCursor = r; },
    });
    const clave = visor.mapa.on('dblclick', e => {
      if (!bajoCursor || Math.hypot(e.pixel[0] - bajoCursor.pixel[0], e.pixel[1] - bajoCursor.pixel[1]) > 12) return;
      e.preventDefault();
      e.stopPropagation();
      elegirRutaEn.current(bajoCursor.numero, bajoCursor.coordenada);
    });
    return () => {
      quitarCartel();
      unByKey(clave);
    };
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
      // ⌘P / Ctrl+P: la impresión del visor (la hoja armada), no la de la página del navegador.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (!modal && !configuracion) setExportar(true);
        return;
      }
      // Con la bienvenida, la guía o la Configuración abiertas (modales), los atajos no actúan sobre el visor de atrás.
      if (modal || configuracion || hayDialogoModal()) return;
      const escribiendo = escribiendoEn(e.target);
      if (e.key === 'Escape' && !escribiendo) {
        setTemasAbierto(false);
        setExportar(false);
        setModo('navegar');
        cerrarResultados();
        return;
      }
      if (escribiendo || e.metaKey || e.ctrlKey || e.altKey) return;
      // "P": exportar a PDF (imprimir, en el modo simple).
      if (e.key.toLowerCase() === 'p') { e.preventDefault(); setExportar(true); return; } // sin escribir la «p» en el título
      // "T": la tabla de datos (profesional), de la última capa abierta o de la de más arriba.
      if (e.key.toLowerCase() === 't' && interfaz === 'pro' && !celular && visor) { e.preventDefault(); alternarTabla(); return; }
      const elegido = (Object.keys(HERRAMIENTAS) as Modo[]).find(m => HERRAMIENTAS[m].tecla === e.key);
      if (elegido) setModo(elegido);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  });

  function abrirTabla(capa: string) {
    ultimaTabla.current = capa;
    setTabla(t => ({ capa, amplia: t?.amplia ?? false }));
  }
  // Al cerrar la tabla con el foco adentro, el foco vuelve al botón de la tabla (si no, quedaba en el body).
  function cerrarTabla() {
    const adentro = !!document.activeElement?.closest('section[aria-label^="Tabla de datos:"]');
    setTabla(null);
    if (adentro) requestAnimationFrame(() => document.querySelector<HTMLElement>('button[aria-label="Tabla de datos (T)"]')?.focus());
  }
  function alternarTabla() {
    if (tabla) { cerrarTabla(); return; }
    const capas = visor ? [...capasVisibles(visor)].reverse() : [];
    // La última que se abrió; si no, Localidades (si está prendida) o la primera con datos de verdad: las
    // obras arrancan vacías y la primera impresión era una tabla vacía.
    abrirTabla(ultimaTabla.current ?? (capas.includes('localidades') ? 'localidades' : capas.find(c => c !== 'provincias' && c !== 'obras_rn11') ?? 'localidades'));
  }

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
      // La tabla de obras (si está abierta) vuelve a pedir: la obra nueva aparece sin tocar nada.
      setRecargaObras(n => n + 1);
      if (interfaz === 'simple') toast.success('¡Listo! Guardamos la obra', { description: 'Ya aparece en el mapa.' });
      else toast.success('Obra guardada', { description: `GeoServer la registró como ${id}.` });
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

  function cerrarRuta() {
    pedidoRuta.current++;
    if (visor) ocultarRuta(visor);
    setRuta({ cargando: false, activa: null });
    setTablero(null);
  }

  // Muestra una ruta nacional en una provincia: la traza señalizada, el vuelo hasta ella y el tablero
  // con las respuestas de la parte B. Con `alternar`, si ya hay una ruta a la vista, la oculta.
  async function mostrarRuta(elegida: Ruta, alternar = false) {
    if (!visor) return;
    if (alternar && ruta.activa) return cerrarRuta();
    if (mismaRuta(ruta.activa, elegida) && tablero) return;
    const pedido = ++pedidoRuta.current;
    const vigente = () => pedido === pedidoRuta.current;
    setRuta(r => ({ ...r, cargando: true }));
    setResultados(null);
    setTablero({ ruta: elegida });
    visor.analisis.clear();
    try {
      const traza = await trazaRuta(elegida);
      if (!vigente()) return;
      dibujarRuta(visor, elegida, traza);
      volarA(visor, visor.ruta.getSource()!.getExtent()!, { duracion: 1400, conPanel: true });
      setRuta({ cargando: false, activa: elegida, tramos: traza.tramos });
    } catch (error) {
      if (!vigente()) return;
      cerrarRuta();
      toast.danger(`No se pudo cargar la traza de la RN${elegida.numero}`, { description: (error as Error).message || '¿Está levantado GeoServer?' });
      return;
    }
    try {
      const analisis = await analizarRuta(elegida);
      if (!vigente()) return;
      dibujarAnalisis(analisis);
      setTablero({ ruta: elegida, analisis });
    } catch (error) {
      if (vigente()) setTablero({ ruta: elegida, error: (error as Error).message });
    }
  }

  // Doble clic sobre una ruta nacional: se analiza dentro de la provincia donde se hizo el clic.
  elegirRutaEn.current = async (numero, coordenada) => {
    try {
      const provincia = await provinciaEn(coordenada);
      if (!provincia) throw new Error('El punto está fuera de las provincias argentinas.');
      mostrarRuta({ numero, provincia });
    } catch (error) {
      toast.danger(`No se pudo elegir la RN${numero}`, { description: (error as Error).message });
    }
  };

  // Las respuestas de la parte B en el mapa: bandas de 10 y 20 km, localidades por franja y puentes.
  // Las bandas usan la misma geometría que la traza: cada una se pinta de una vez y la transparencia
  // no se acumula donde los tramos se tocan.
  function dibujarAnalisis(analisis: AnalisisRuta) {
    if (!visor) return;
    visor.analisis.clear();
    const traza = visor.ruta.getSource()!.getFeatures()[0];
    if (traza) visor.analisis.addFeature(new Feature({ geometry: traza.getGeometry(), tipo_analisis: 'traza', cos_latitud: traza.get('cos_latitud') }));
    analisis.localidades.forEach(l => {
      l.feature.set('tipo_analisis', 'localidad');
      l.feature.set('habitantes', l.habitantes);
    });
    analisis.puentes.forEach(p => p.feature.set('tipo_analisis', 'puente'));
    visor.analisis.addFeatures([...analisis.localidades.map(l => l.feature), ...analisis.puentes.map(p => p.feature)]);
    callarRotulos(visor, 'localidades', true);
  }

  // Una pregunta en lenguaje natural: la consulta se resuelve en GeoServer, se resalta en el mapa y
  // se cuenta para "lo más consultado".
  async function preguntar(i: Interpretacion) {
    if (!visor) return;
    aprender('consulta', claveDe(i), JSON.stringify(i));
    if (i.intencion === 'tablero') {
      mostrarRuta(RN11);
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
      // Con nombre y "elegida": la capa de foco le pone su etiqueta (con el tablero abierto el WMS calla
      // los rótulos de localidades y el lugar quedaba sin nombre).
      visor.foco.addFeature(new Feature({ geometry: new Point(getCenter(s.extension)), nombre: s.titulo, elegida: true }));
    } else if (tipo === 'ruta') {
      const [numero, provincia] = valor.split('|');
      mostrarRuta({ numero, provincia });
    } else if (tipo === 'herramienta') {
      setModo(valor as Modo);
    } else if (tipo === 'capa') {
      const prender = !visor.visibles.has(valor);
      cambiarCapas(visor, [valor], prender);
      toast(`${s.titulo}: ${prender ? 'prendida' : 'apagada'}`, { timeout: 2500 });
    } else if (valor === 'rn11') {
      mostrarRuta(RN11);
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

  // Lo que va en el panel de la derecha (flotante en simple y celular, inspector en pro). El formulario
  // de una obra nueva tiene prioridad.
  // Estable: la ventana de impresión la usa en su efecto de teclado.
  const cerrarImprimir = useCallback(() => setExportar(false), []);

  // Lo que el PDF suma después del mapa: la respuesta abierta o el tablero de la ruta.
  // Memorizado: si fuera un objeto nuevo en cada render, la impresión volvería a pedir los pueblos
  // cercanos con cada tecla (por ejemplo, al escribir los autores).
  const contenidoPdf = useMemo<Contenido | null>(() => resultados?.tipo === 'consulta'
    ? {
      tipo: 'consulta',
      consulta: resultados.consulta,
      titulo: resultados.consulta.titulo
        ? (interfaz === 'simple' ? tituloSimple(resultados.consulta.titulo, resultados.consulta.capas) : resultados.consulta.titulo)
        : resultados.consulta.origen === 'punto' ? (interfaz === 'simple' ? 'Qué hay en este lugar' : 'Consulta por punto') : (interfaz === 'simple' ? 'Lo que hay en la zona' : 'Consulta por rectángulo'),
    }
    : resultados?.tipo === 'medicion' && resultados.medicion.terminada
      ? { tipo: 'medicion', medicion: resultados.medicion, titulo: resultados.medicion.tipo === 'distancia' ? (interfaz === 'simple' ? 'Qué tan lejos' : 'Distancia medida') : (interfaz === 'simple' ? 'Qué tan grande' : 'Área medida') }
      : tablero?.analisis
        ? { tipo: 'tablero', analisis: tablero.analisis, titulo: `${interfaz === 'simple' ? 'La ruta' : 'Ruta Nacional'} ${tablero.ruta.numero} en ${tituloProvincia(tablero.ruta.provincia)}` }
        : null, [resultados, tablero, interfaz]);

  const contenidoPanel = !visor ? null : obra ? (
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
  ) : resultados ? (
    <Suspense fallback={null}>
      <PanelResultados visor={visor} estado={resultados} onCerrar={cerrarResultados} />
    </Suspense>
  ) : tablero ? (
    <Suspense fallback={null}>
      <TableroRuta visor={visor} ruta={tablero.ruta} analisis={tablero.analisis} error={tablero.error} onCerrar={() => setTablero(null)} />
    </Suspense>
  ) : null;

  const botonesTema = (compacto?: boolean) => (
    <BotonRedondo etiqueta={oscuro ? 'Tema claro' : 'Tema oscuro'} onPress={() => cambiarTema(!oscuro)} compacto={compacto}>
      {oscuro ? <Sun size={compacto ? 20 : 21} weight="bold" /> : <Moon size={compacto ? 20 : 21} weight="bold" />}
    </BotonRedondo>
  );
  const botonConfiguracion = (compacto?: boolean) => (
    <BotonRedondo etiqueta="Configuración y ayuda" onPress={() => setConfiguracion(true)} compacto={compacto}>
      <GearSix size={compacto ? 21 : 22} weight="bold" />
    </BotonRedondo>
  );
  const interruptor = (
    <div className="panel p-1">
      <InterruptorModo valor={interfaz} onCambiar={v => cambiarPreferencia('interfaz', v)} className="w-[150px] bg-transparent max-lg:w-[124px]" />
    </div>
  );
  const zoomBotones = (grande?: boolean) => (
    <div className="panel pointer-events-auto flex flex-col p-1.5">
      <BotonMapa etiqueta={grande ? 'Acercar el mapa' : 'Acercar'} onPress={() => zoom(1)} grande={grande}><Plus size={grande ? 24 : 20} /></BotonMapa>
      <BotonMapa etiqueta={grande ? 'Alejar el mapa' : 'Alejar'} onPress={() => zoom(-1)} grande={grande}><Minus size={grande ? 24 : 20} /></BotonMapa>
      <span className="mx-2.5 my-1 h-px bg-[var(--linea)]" />
      <BotonMapa etiqueta={grande ? 'Ver todo el Chaco' : 'Ver Chaco completo'} onPress={() => verChaco(visor!)} grande={grande}><CornersOut size={grande ? 24 : 20} /></BotonMapa>
    </div>
  );
  // Celular: escala, referencias (simple) e interruptor en una fila debajo del buscador, siempre a la
  // vista (antes desaparecían al abrir un resultado o el tablero).
  const filaCelular = (
    <div className="pointer-events-none absolute inset-x-3 top-[76px] z-10 flex items-center gap-2">
      <div className="entra pointer-events-auto" style={retraso(300)}><BarraEstado visor={visor!} compacta /></div>
      {interfaz === 'simple' && <div className="entra pointer-events-auto" style={retraso(340)}><BotonReferencias visor={visor!} compacto /></div>}
      <div className="entra pointer-events-auto ml-auto" style={retraso(380)}>{interruptor}</div>
    </div>
  );

  // Panel flotante de la derecha (modo simple y celular).
  const panelFlotante = (
    <AnimatePresence>
      {contenidoPanel && (
        <motion.div
          key={obra ? 'obra' : resultados ? 'resultados' : 'tablero'}
          className={`pointer-events-none absolute right-4 top-[92px] z-10 flex w-[400px] flex-col max-lg:inset-x-3 max-lg:bottom-[110px] max-lg:top-auto max-lg:max-h-[46cqh] max-lg:w-auto ${interfaz === 'simple' ? 'bottom-[228px] max-lg:bottom-[118px]' : 'bottom-[184px]'}`}
          initial={{ opacity: 0, x: 32, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 32, scale: 0.98 }}
          transition={RESORTE_PANEL}
        >
          <div className="pointer-events-auto flex min-h-0 flex-col">{contenidoPanel}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Con la bienvenida o la guía abiertas, el resto queda inerte: el Tab no se escapa del diálogo. */}
      <div className="mapa" ref={destino} inert={modal} />

      {visor && (
        <InterfazContexto.Provider value={interfaz}>
        <MotionConfig reducedMotion={preferencias.movimientoReducido ? 'always' : 'user'}>
        <div className="interfaz" data-interfaz={interfaz} inert={modal}>
          {/* Mapa de calor (T3): si una mancha necesita acercarse o no se pudo traer, se avisa sobre el mapa. */}
          {visor && (
            <div className="pointer-events-none absolute inset-x-0 top-[92px] z-20 flex justify-center px-4 max-lg:top-[150px]">
              <AvisoCalor visor={visor} onAcercar={() => zoom(1)} />
            </div>
          )}
          {interfaz === 'simple' ? (
            <>
              {/* Simple: buscador grande arriba, "¿Qué querés ver?" a la izquierda, botones grandes abajo. */}
              {/* Cabecera en fila: un espacio del ancho del panel de temas, el buscador en el lugar libre y
                  los botones a la derecha; nada se pisa a ningún ancho. */}
              <header className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start gap-3 lg:inset-x-4 lg:top-4">
                <div className="w-[340px] shrink-0 max-lg:hidden xl:w-[384px]" />
                <div className="entra pointer-events-auto mx-auto w-full min-w-0 lg:max-w-[620px] lg:flex-1" style={retraso(120)} data-guia="buscar">
                  <Buscador capaPrendida={nombre => visor.visibles.has(nombre)} enVista={enVista} onElegir={elegir} />
                </div>
                <div className="entra pointer-events-auto flex shrink-0 items-center gap-2.5 max-lg:hidden" style={retraso(200)}>
                  <BotonRuta estado={ruta} onPress={() => mostrarRuta(RN11, true)} angosto />
                  {interruptor}
                  <BotonRedondo etiqueta="Ayuda: cómo se usa" onPress={() => setGuia(true)}><Question size={22} weight="bold" /></BotonRedondo>
                  <div className="max-xl:hidden">{botonesTema()}</div>
                  {botonConfiguracion()}
                </div>
              </header>

              {!celular && (
                <aside className="pointer-events-none absolute bottom-4 left-4 top-4 z-10 flex w-[340px] flex-col gap-3 xl:w-[384px]">
                  <div className="entra pointer-events-auto flex min-h-0 flex-1 flex-col" style={retraso(180)} data-guia="temas">
                    <PanelTemas visor={visor} />
                  </div>
                  {/* Sin animación de entrada: en la tele, la escala y "Referencias" eran el LCP y la
                      animación lo atrasaba (igual que la barra de estado de pro). */}
                  <div className="pointer-events-auto flex items-center gap-2">
                    <BarraEstado visor={visor} compacta />
                    <BotonReferencias visor={visor} />
                  </div>
                </aside>
              )}

              {panelFlotante}

              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center max-lg:bottom-3 lg:left-[360px] lg:right-[96px] xl:left-[404px] 2xl:left-0 2xl:right-0">
                <div className="entra pointer-events-auto" style={retraso(260)}>
                  <Acciones modo={modo} onModo={setModo} sinPista={!!obra || exportar} imprimiendo={exportar} onImprimir={() => setExportar(e => !e)} />
                </div>
              </div>
              {!celular && (
                <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-end gap-3">
                  {preferencias.minimapa && <div className="entra pointer-events-auto max-xl:hidden" style={retraso(440)}><Minimapa visor={visor} /></div>}
                  <div className="entra" style={retraso(380)}>{zoomBotones(true)}</div>
                </div>
              )}

              {celular && (
                <>
                  {/* Celular: escala, "¿Qué querés ver?" y los ajustes arriba de los botones grandes. */}
                  {filaCelular}
                  <div className={`pointer-events-none absolute bottom-[112px] inset-x-3 z-10 flex items-end gap-2 transition-opacity duration-300 ${contenidoPanel || temasAbierto ? 'invisible opacity-0' : ''}`}>
                    <div className="pointer-events-auto flex w-full flex-col gap-2">
                      <div className="flex gap-2">
                        <button type="button" data-guia="temas" onClick={() => setTemasAbierto(true)} className="panel flex h-12 min-w-0 flex-1 items-center justify-center gap-2 px-3 text-[16px] font-semibold">
                          <Stack size={20} weight="fill" className="shrink-0" /> <span className="truncate">¿Qué querés ver?</span>
                        </button>
                        <BotonRuta estado={ruta} onPress={() => mostrarRuta(RN11, true)} soloEscudo />
                        <BotonRedondo etiqueta="Ayuda: cómo se usa" onPress={() => setGuia(true)} compacto><Question size={20} weight="bold" /></BotonRedondo>
                        {botonConfiguracion(true)}
                      </div>
                    </div>
                  </div>
                  <AnimatePresence>
                    {temasAbierto && (
                      <motion.div
                        className="pointer-events-auto absolute inset-x-2 bottom-2 z-30 flex max-h-[78cqh] flex-col"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={RESORTE_PANEL}
                      >
                        <button type="button" onClick={() => setTemasAbierto(false)} className="panel mx-auto mb-2 flex h-11 items-center gap-2 px-5 text-[15px] font-semibold">
                          <X size={16} weight="bold" /> Ver el mapa
                        </button>
                        <PanelTemas visor={visor} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </>
          ) : !celular ? (
            <>
              {/* Pro: barra arriba, capas a la izquierda, inspector a la derecha y estado abajo. */}
              <header className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-center gap-2.5">
                <div className="entra pointer-events-auto max-xl:hidden" style={retraso(80)}><Marca angosta /></div>
                <div className="entra pointer-events-auto min-w-[240px] flex-1" style={retraso(140)}>
                  <Buscador capaPrendida={nombre => visor.visibles.has(nombre)} enVista={enVista} onElegir={elegir} />
                </div>
                <div className="entra pointer-events-auto" style={retraso(200)}><BarraHerramientas modo={modo} onModo={setModo} /></div>
                <div className="entra pointer-events-auto flex items-center gap-2" style={retraso(260)}>
                  <BotonRuta estado={ruta} onPress={() => mostrarRuta(RN11, true)} angosto />
                  <BotonRedondo etiqueta={tabla ? 'Cerrar la tabla de datos (T)' : 'Tabla de datos (T)'} onPress={alternarTabla} compacto activo={!!tabla}><IconoTabla size={21} weight="bold" /></BotonRedondo>
                  <BotonRedondo etiqueta="Exportar a PDF" onPress={() => setExportar(e => !e)} compacto><FilePdf size={21} weight="bold" /></BotonRedondo>
                  {interruptor}
                  {botonesTema(true)}
                  {botonConfiguracion(true)}
                </div>
              </header>

              <aside className="pointer-events-none absolute bottom-[68px] left-3 top-[84px] z-10 flex w-[316px] flex-col">
                <AnimatePresence initial={false} mode="popLayout">
                  {plegado ? (
                    <motion.button
                      key="riel"
                      type="button"
                      onClick={() => setPlegado(false)}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={RESORTE_PANEL}
                      className="panel pointer-events-auto flex w-14 flex-col items-center gap-2 py-4 text-[13px] font-semibold"
                      aria-label={`Mostrar capas (${visor.visibles.size} prendidas)`}
                    >
                      <Stack size={22} />
                      <span className="[writing-mode:vertical-rl]">Capas · <ContadorCapas visor={visor} solo /></span>
                    </motion.button>
                  ) : (
                    <motion.div
                      key="lateral"
                      className="entra pointer-events-auto flex min-h-0 flex-1 flex-col"
                      style={retraso(180)}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={RESORTE_PANEL}
                    >
                      <PanelCapas visor={visor} plegable={false} onPlegar={() => setPlegado(true)} onTabla={abrirTabla} tablaAbierta={tabla?.capa ?? null} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </aside>

              {inspectorPlegado ? (
                <button
                  type="button"
                  onClick={() => setPestana('leyenda')}
                  className="entra panel pointer-events-auto absolute right-3 top-[84px] z-10 flex h-11 items-center gap-2 px-4 text-[14px] font-semibold"
                  style={retraso(240)}
                >
                  <ListBullets size={17} weight="bold" /> Leyenda
                </button>
              ) : (
                <aside className="entra pointer-events-none absolute bottom-[68px] right-3 top-[84px] z-10 flex w-[392px] flex-col" style={retraso(240)}>
                  <div className="pointer-events-auto flex min-h-0 flex-1 flex-col">
                    <Inspector visor={visor} pestana={pestana} onPestana={setPestana} contenido={contenidoPanel} />
                  </div>
                </aside>
              )}

              {/* Indicación de la herramienta activa, arriba del mapa. */}
              <AnimatePresence>
                {modo !== 'navegar' && !obra && (
                  <motion.p
                    key={modo}
                    className="panel pointer-events-none absolute left-1/2 top-[84px] z-10 -translate-x-1/2 px-4 py-2 text-[14px] font-medium text-[var(--tinta-2)]"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={RESORTE_PANEL}
                  >
                    {HERRAMIENTAS[modo].ayuda}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* La tabla de datos: un cajón entre las capas y el inspector, sobre la barra de estado. */}
              <AnimatePresence>
                {tabla && (
                  <motion.div
                    key="tabla"
                    ref={el => {
                      if (!el) return;
                      const medir = () => setAltoTabla(el.offsetHeight);
                      const o = new ResizeObserver(medir);
                      o.observe(el);
                      medir();
                      return () => { o.disconnect(); setAltoTabla(0); };
                    }}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 28 }}
                    transition={RESORTE_PANEL}
                    className="pointer-events-auto absolute bottom-[68px] z-10 flex flex-col"
                    style={{ left: plegado ? 80 : 340, right: inspectorPlegado ? 12 : 416, height: tabla.amplia ? 'calc((100% - 164px) * 0.68)' : 'max(calc((100% - 164px) * 0.42), min(320px, calc(100% - 300px)))', transition: 'height .45s var(--ios), left .3s, right .3s' }}
                  >
                    <Suspense fallback={<div className="panel h-full" />}>
                      <TablaDatos
                        visor={visor}
                        capa={tabla.capa}
                        onCapa={abrirTabla}
                        amplia={tabla.amplia}
                        onAmplia={amplia => setTabla(t => t && { ...t, amplia })}
                        onCerrar={cerrarTabla}
                        bordes={`${plegado}|${inspectorPlegado}`}
                        onIrA={consulta => { setTablero(null); setResultados({ tipo: 'consulta', consulta }); }}
                        onLimpiar={cerrarResultados}
                        recargaObras={recargaObras}
                      />
                    </Suspense>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={`pointer-events-none absolute z-10 flex items-end gap-3 transition-[bottom] duration-300 ${inspectorPlegado ? 'right-3' : 'right-[408px]'}`} style={{ bottom: 68 + (tabla ? altoTabla + 12 : 0) }}>
                <div className="entra" style={retraso(420)}>{zoomBotones()}</div>
                {preferencias.minimapa && <div className="entra pointer-events-auto" style={retraso(480)}><Minimapa visor={visor} /></div>}
              </div>

              {/* Sin animación de entrada: es lo que el navegador toma como LCP y la demora lo empeoraba. */}
              <footer className="pointer-events-auto absolute inset-x-3 bottom-3 z-10">
                <BarraEstado visor={visor} fila>
                  <span className="h-5 w-px bg-[var(--linea)]" />
                  <ContadorCapas visor={visor} />
                </BarraEstado>
              </footer>
            </>
          ) : (
            <>
              {/* Pro en celular: la disposición flotante (el profesional pide pantalla grande). */}
              <header className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start gap-3">
                <div className="entra pointer-events-auto mx-auto w-full" style={retraso(180)}>
                  <Buscador capaPrendida={nombre => visor.visibles.has(nombre)} enVista={enVista} onElegir={elegir} />
                </div>
              </header>
              {filaCelular}
              <aside className="pointer-events-none absolute left-3 right-3 top-[134px] z-10 flex max-h-[48vh] flex-col gap-3">
                <div className="entra pointer-events-auto flex min-h-0 flex-1 flex-col" style={retraso(220)}>
                  <PanelCapas visor={visor} plegable />
                </div>
              </aside>
              {panelFlotante}
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
                <div className="entra pointer-events-auto" style={retraso(340)}>
                  <Dock modo={modo} onModo={setModo} />
                </div>
              </div>
              <div className={`pointer-events-none absolute bottom-[100px] right-3 z-10 transition-opacity duration-300 ${contenidoPanel ? 'invisible opacity-0' : ''}`}>
                <div className="pointer-events-auto flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                    <BotonRuta estado={ruta} onPress={() => mostrarRuta(RN11, true)} />
                    {botonesTema(true)}
                    {botonConfiguracion(true)}
                  </div>
                </div>
              </div>
            </>
          )}

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


          <AnimatePresence>
            {!preferencias.interfaz && (
              <Suspense fallback={null}>
                <Bienvenida
                  onElegir={v => {
                    cambiarPreferencia('interfaz', v);
                    if (v === 'simple' && !preferencias.guiaVista) setTimeout(() => setGuia(true), 700);
                    // Si no viene la guía, el foco queda en el modo recién elegido (y no en el body).
                    else setTimeout(() => [...document.querySelectorAll<HTMLElement>('[aria-label="Tipo de pantalla"] [aria-checked="true"]')]
                      .find(el => el.getClientRects().length > 0)?.focus(), 80);
                  }}
                />
              </Suspense>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {exportar && visor && (
              <Suspense fallback={null}>
                <Imprimir
                  visor={visor}
                  contenido={contenidoPdf}
                  panelAbierto={hayContenido}
                  ruta={ruta.activa ? { numero: ruta.activa.numero, nombre: `${interfaz === 'simple' ? 'La ruta' : 'RN'}${interfaz === 'simple' ? ' ' : ''}${ruta.activa.numero} en ${tituloProvincia(ruta.activa.provincia)}` } : null}
                  autores={preferencias.autores}
                  onAutores={v => cambiarPreferencia('autores', v)}
                  onCerrar={cerrarImprimir}
                />
              </Suspense>
            )}
          </AnimatePresence>
          {guia && interfaz === 'simple' && (
            <Guia
              onTerminar={() => {
                setGuia(false);
                cambiarPreferencia('guiaVista', true);
              }}
            />
          )}
        </MotionConfig>
        </InterfazContexto.Provider>
      )}

      <Toast.Provider placement="top end" />
    </>
  );
}

function Marca({ angosta }: { angosta?: boolean }) {
  return (
    <div className={`panel flex h-[60px] items-center gap-3 px-4 ${angosta ? 'w-[316px]' : 'w-[340px]'}`}>
      <EscudoRuta className="h-9 w-auto shrink-0" />
      <div className="min-w-0">
        <h1 className="text-[18px] font-semibold leading-tight tracking-[-0.02em]">Visor SIG · RN11 Chaco</h1>
        <p className="text-[13px] leading-tight text-[var(--tinta-3)]">IGN SIG 250 · UTN FRRe 2026</p>
      </div>
    </div>
  );
}

// Sin ruta a la vista abre la RN11; con una ruta elegida (la RN11 u otra por doble clic) la oculta.
function BotonRuta({ estado, onPress, angosto, soloEscudo }: { estado: EstadoRuta; onPress: () => void; angosto?: boolean; soloEscudo?: boolean }) {
  const activa = estado.activa;
  const simple = useInterfaz() === 'simple';
  if (soloEscudo) {
    return (
      <button
        type="button"
        onClick={onPress}
        aria-pressed={!!activa}
        aria-label={activa ? `Ocultar la ruta ${activa.numero}` : 'Ver la ruta 11'}
        className={`panel grid size-12 shrink-0 place-items-center transition-colors ${activa ? '!bg-[var(--vial-fuerte)]' : ''}`}
        style={activa ? ({ '--escudo-fondo': 'var(--vial-fuerte)', '--escudo-tinta': '#fff' } as React.CSSProperties) : undefined}
      >
        <EscudoRuta numero={activa?.numero ?? '11'} className={`h-7 w-auto ${estado.cargando ? 'animate-pulse' : ''}`} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={!!activa}
      className={`panel flex h-[60px] items-center gap-3 pl-3.5 pr-4 text-left max-lg:w-auto transition-colors ${angosto ? 'w-auto' : 'w-[200px]'} duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 max-lg:h-12 max-lg:pr-3.5 ${
        activa ? '!bg-[var(--vial-fuerte)] text-white' : 'hover:bg-[var(--superficie-2)]'
      }`}
      style={activa ? ({ '--escudo-fondo': 'var(--vial-fuerte)', '--escudo-tinta': '#fff' } as React.CSSProperties) : undefined}
    >
      {/* En pro, desde 1780 px útiles (la tele) la barra muestra los nombres de las herramientas: el botón
          pierde el subtítulo para dejarle lugar al buscador. */}
      <EscudoRuta numero={activa?.numero ?? '11'} className={`h-8 w-auto max-lg:h-7 ${estado.cargando ? 'animate-pulse' : ''}`} />
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold leading-tight">{simple ? (activa ? `Ocultar la ruta ${activa.numero}` : 'Ver la ruta 11') : activa ? `Ocultar RN${activa.numero}` : 'Ver RN11'}</span>
        <span className={`truncate text-[13px] leading-tight max-lg:hidden ${angosto ? 'max-2xl:hidden' : ''} ${angosto && !simple ? '@min-[1780px]:hidden' : ''} ${activa ? 'text-white' : 'text-[var(--tinta-3)]'}`}>
          {estado.cargando ? (simple ? 'Cargando…' : 'Cargando traza…')
            : activa ? (simple ? `En ${tituloProvincia(activa.provincia)}` : `${estado.tramos} tramos en ${tituloProvincia(activa.provincia)}`)
              : simple ? 'En el Chaco' : 'Traza en Chaco'}
        </span>
      </span>
    </button>
  );
}

function BotonRedondo({ etiqueta, onPress, compacto, activo, children }: { etiqueta: string; onPress: () => void; compacto?: boolean; activo?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={activo}
      className={`panel grid shrink-0 place-items-center transition-colors focus-visible:outline-2 ${activo ? '!bg-[var(--tinta)] text-[var(--superficie)]' : 'text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]'} ${compacto ? 'size-12' : 'size-[60px]'}`}
    >
      {children}
    </button>
  );
}

function BotonMapa({ etiqueta, onPress, grande, children }: { etiqueta: string; onPress: () => void; grande?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onPress}
      className={`grid place-items-center rounded-xl text-[var(--tinta-2)] transition-colors hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)] focus-visible:outline-2 ${grande ? 'size-14' : 'size-11'}`}
    >
      {children}
    </button>
  );
}

// Capas prendidas, al día (la barra de estado no se redibujaba al prender o apagar).
function ContadorCapas({ visor, solo }: { visor: Visor; solo?: boolean }) {
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);
  if (solo) return <>{visor.visibles.size}</>;
  return <span className="text-[var(--tinta-3)]"><strong className="font-semibold text-[var(--tinta)]">{visor.visibles.size}</strong> de 48 capas</span>;
}

// Modo simple: "Referencias" abre qué significa cada color de lo que se está viendo (la leyenda).
// `compacto`: en el celular, más chico y se abre hacia abajo (va en la fila de arriba).
function BotonReferencias({ visor, compacto }: { visor: Visor; compacto?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  // Escape cierra las referencias (antes que cualquier otro Escape del visor) y devuelve el foco al botón.
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      // Con un diálogo modal encima (la guía), el Escape es del diálogo.
      if (e.key !== 'Escape' || hayDialogoModal()) return;
      e.stopPropagation();
      setAbierto(false);
      boton.current?.focus();
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  }, [abierto]);
  return (
    <div className="relative">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        aria-label={compacto ? 'Referencias' : undefined}
        title="Referencias: qué significa cada color"
        className={`panel flex items-center gap-2 font-semibold hover:bg-[var(--superficie-2)] ${compacto ? 'size-[42px] justify-center' : 'h-[46px] px-4 text-[15px]'}`}
      >
        <ListBullets size={18} weight="bold" /> {!compacto && 'Referencias'}
      </button>
      {/* En el celular va en un portal: la animación de entrada del contenedor (transform) atrapaba el
          position: fixed y el panel salía angosto y corrido. */}
      {compacto ? createPortal(<div className="interfaz-portal"><AnimatePresence>
        {abierto && (
          <motion.section
            aria-label="Referencias: qué significa cada color"
            className={`panel desplazable max-h-[60cqh] overflow-y-auto shadow-[var(--sombra-alta)] ${compacto ? 'fixed inset-x-3 top-[124px] z-40' : 'absolute bottom-[56px] left-0 w-[360px]'}`}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={RESORTE_PANEL}
          >
            <header className="flex items-center justify-between border-b border-[var(--linea)] py-3 pl-5 pr-2">
              <h2 className="text-[18px] font-semibold">Qué significa cada color</h2>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar referencias" className="grid size-10 place-items-center rounded-xl hover:bg-[var(--superficie-2)]"><X size={18} /></button>
            </header>
            <LeyendaGeneral visor={visor} />
          </motion.section>
        )}
      </AnimatePresence></div>, document.body) : (
      <AnimatePresence>
        {abierto && (
          <motion.section
            aria-label="Referencias: qué significa cada color"
            className={`panel desplazable max-h-[60cqh] overflow-y-auto shadow-[var(--sombra-alta)] ${compacto ? 'fixed inset-x-3 top-[124px] z-40' : 'absolute bottom-[56px] left-0 w-[360px]'}`}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={RESORTE_PANEL}
          >
            <header className="flex items-center justify-between border-b border-[var(--linea)] py-3 pl-5 pr-2">
              <h2 className="text-[18px] font-semibold">Qué significa cada color</h2>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar referencias" className="grid size-10 place-items-center rounded-xl hover:bg-[var(--superficie-2)]"><X size={18} /></button>
            </header>
            <LeyendaGeneral visor={visor} />
          </motion.section>
        )}
      </AnimatePresence>
      )}
    </div>
  );
}

function resumirError(error: unknown) {
  const texto = (error as Error).message ?? String(error);
  const excepcion = texto.match(/<ows:ExceptionText>([\s\S]*?)<\/ows:ExceptionText>/)?.[1];
  return (excepcion ?? texto).slice(0, 220);
}
