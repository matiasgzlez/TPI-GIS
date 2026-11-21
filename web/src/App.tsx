import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast, toast } from '@heroui/react';
import { CornersOut, FilePdf, GearSix, ListBullets, Minus, Moon, Plus, Question, SplitHorizontal, Stack, Sun, Table as IconoTabla, X } from '@phosphor-icons/react';
import { AnimatePresence, MotionConfig, motion, useIsPresent } from 'motion/react';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { buffer, getCenter } from 'ol/extent';
import { unByKey } from 'ol/Observable';
import BarraEstado from './componentes/BarraEstado';
import Buscador from './componentes/Buscador';
import Dock from './componentes/Dock';
import InterruptorModo from './componentes/InterruptorModo';
import TransicionModo, { type Pase } from './componentes/TransicionModo';
import Acciones from './componentes/simple/Acciones';
import PanelTemas from './componentes/simple/PanelTemas';
import NotchAjustes from './componentes/simple/NotchAjustes';
import NotchTemas from './componentes/simple/NotchTemas';
import Riel, { type Cajon } from './componentes/pro/Riel';
import Chips, { AyudaTecnica } from './componentes/pro/Chips';
import EstadoTecnico from './componentes/pro/EstadoTecnico';
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
import { usePreferencias, type Preferencias } from './preferencias';
import type { Interfaz } from './interfaz';
import { RESORTE_PANEL } from './movimiento';
import { aplicarFactor, aplicarTema, callarRotulos, cambiarCapas, capasVisibles, crearVisor, terminarAnimacion, usarFocoSimple, dibujarRuta, ocultarRuta, ponerDisposicion, refrescarMapa, restablecerCapas, suscribirCapas, verChaco, volarA, type Visor } from './visor';
import { tituloProvincia } from './provincias';
import { AvisoCalor } from './componentes/Calor';
import type { Contenido } from './exportar/pdf';

// Se cargan recién cuando hacen falta: el formulario trae Select, TextArea y el botón animado.
const FormObra = lazy(() => import('./componentes/FormObra'));
const PanelResultados = lazy(() => import('./componentes/PanelResultados'));
import Isla from './componentes/simple/Isla';
import NotchResultados from './componentes/simple/NotchResultados';
const PanelConfiguracion = lazy(() => import('./componentes/PanelConfiguracion'));
const TableroRuta = lazy(() => import('./componentes/TableroRuta'));
const Bienvenida = lazy(() => import('./componentes/Bienvenida'));
const Guia = lazy(() => import('./componentes/simple/Guia'));
// Imprimir / exportar a PDF: jsPDF, pdf.js y la letra incrustada se cargan solo al abrirlo.
const Imprimir = lazy(() => import('./exportar/Imprimir'));
const TablaDatos = lazy(() => import('./componentes/pro/TablaDatos'));
// Comparador deslizante (T6): la cortina y sus listas, recién al abrirlo.
const Comparador = lazy(() => import('./componentes/Comparador'));
// Paneles del cajón del profesional (Análisis, Datos, Navegación y Base de datos): se cargan al abrirlos.
const PanelSeleccion = lazy(() => import('./componentes/pro/paneles/Seleccion'));
const PanelEstadisticas = lazy(() => import('./componentes/pro/paneles/Estadisticas'));
const PanelObras = lazy(() => import('./componentes/pro/paneles/Obras'));
const PanelServicios = lazy(() => import('./componentes/pro/paneles/Servicios'));
const PanelMapasBase = lazy(() => import('./componentes/pro/paneles/MapasBase'));
const PanelCoordenadas = lazy(() => import('./componentes/pro/paneles/Coordenadas'));
const PanelVistas = lazy(() => import('./componentes/pro/paneles/Vistas'));
const PanelCatalogo = lazy(() => import('./componentes/pro/paneles/Catalogo'));
import { aplicarVista, vistaDelEnlace } from './vistas';
const ENLACE_INICIAL = vistaDelEnlace();
if (ENLACE_INICIAL) history.replaceState(null, '', location.pathname + location.search);
import { mapaBaseGuardado, ponerMapaBase } from './mapaBase';

// Corre el mapa hacia la izquierda si el notch de resultados de la derecha tapa una zona (extensión en
// coordenadas del mapa). Todo en píxeles de pantalla: el mapa no tiene zoom de interfaz, el notch sí
// (getBoundingClientRect ya lo cuenta).
function despejarLado(visor: Visor, zona: number[]) {
  const fondo = document.querySelector('.notch-resultados > .notch[data-abierta] > .notch-cuerpo');
  if (!fondo) return;
  const panel = fondo.getBoundingClientRect();
  const { mapa } = visor;
  const vp = mapa.getViewport()!.getBoundingClientRect();
  const a = mapa.getPixelFromCoordinate([zona[0], zona[3]]), b = mapa.getPixelFromCoordinate([zona[2], zona[1]]);
  if (!a || !b) return;
  const [arriba, der, abajo] = [vp.top + Math.min(a[1], b[1]), vp.left + Math.max(a[0], b[0]), vp.top + Math.max(a[1], b[1])];
  const margen = 40;
  if (der < panel.left - margen || abajo < panel.top - 12 || arriba > panel.bottom + 12) return;
  const correr = der - (panel.left - margen * 2);
  const tam = mapa.getSize();
  if (!tam) return;
  const centro = mapa.getCoordinateFromPixel([tam[0] / 2 + correr, tam[1] / 2]);
  const reducido = document.querySelector('[data-movimiento="reducido"]') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  mapa.getView().animate({ center: centro, duration: reducido ? 0 : 650 });
}

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

const TITULOS_CAJON: Record<Cajon, string> = {
  capas: 'Capas', leyenda: 'Leyenda', seleccion: 'Selección espacial', estadisticas: 'Estadísticas', obras: 'Obras RN11',
  servicios: 'Servicios y descargas', 'mapas-base': 'Mapas base', coordenada: 'Ir a coordenada', vistas: 'Vistas guardadas', catalogo: 'Base de datos',
};

// La ruta nacional del tablero: la RN11 en Chaco desde el botón, o cualquier otra con doble clic.
interface EstadoRuta { cargando: boolean; activa: Ruta | null; tramos?: number }

export default function App() {
  const destino = useRef<HTMLDivElement>(null);
  const [visor, setVisor] = useState<Visor | null>(null);
  const [modo, setModo] = useState<Modo>('navegar');
  const [resultados, setResultados] = useState<EstadoResultados | null>(null);
  // Lo último consultado (punto o rectángulo, como extensión): la isla del simple corre el mapa si lo tapa.
  const zonaConsultada = useRef<number[] | null>(null);
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
  // El resaltado grande y naranja (con la luz que lo recorre) es del escritorio del simple.
  useEffect(() => { if (visor) usarFocoSimple(visor, interfaz === 'simple' && !celular); }, [visor, interfaz, celular]);
  // El panel de resultados se baja apenas el mapa está listo: así la isla se abre al tocar, sin esperar la descarga.
  useEffect(() => { if (visor) { const reloj = setTimeout(() => { void import('./componentes/PanelResultados'); void import('./componentes/FormObra'); }, 1500); return () => clearTimeout(reloj); } }, [visor]);
  const [guia, setGuia] = useState(false);
  // Pro: lo abierto en el cajón del riel (Capas o Leyenda), o nada.
  const [cajon, setCajon] = useState<Cajon | null>(null);
  // La sidebar del profesional abierta (300 px, con los nombres): corre todo lo de la izquierda.
  const [rielAbierto, setRielAbierto] = useState(false);
  const [temasAbierto, setTemasAbierto] = useState(false);
  // Tabla de datos (T4, solo en el profesional): la capa abierta y si está agrandada. Su alto (medido) le
  // corre el borde de abajo al encuadre del mapa y sube los botones de zoom.
  const [tabla, setTabla] = useState<{ capa: string; amplia: boolean } | null>(null);
  const [altoTabla, setAltoTabla] = useState(0);
  const ultimaTabla = useRef<string | null>(null);
  const [recargaObras, setRecargaObras] = useState(0);
  // Comparador (T6): la cortina que divide el mapa en dos juegos de capas.
  const [comparar, setComparar] = useState(false);
  const modal = !preferencias.interfaz || guia || exportar;
  // Pro por debajo de 1440 px (la notebook de 1366): sin nada que mostrar, el inspector se pliega a un botón y le deja el lugar al mapa.
  const hayContenido = !!(obra || resultados || tablero);
  // En el simple, "Capas" se abre solo mientras el cursor está encima (es pasajera): para el encuadre del
  // mapa y la cortina cuenta siempre como recogida, y abrirla no vuelve a dibujar la App.
  const lateralPlegado = !celular && (interfaz === 'simple' ? true : !cajon);

  // El encuadre del mapa deja libres los bordes que tapa la interfaz a la vista.
  // El alto de la tabla vale hasta que terminó de salir (lo pone en 0 su ref al desmontarse, después de la
  // animación): si no, el lugar libre crecía de golpe y la cortina se acomodaba encima de la tabla que se iba.
  // Durante el render (es un valor de módulo, idempotente): así los hijos —la cortina del comparador— ya lo
  // ven en sus efectos de layout del mismo cuadro (con un efecto de App, que corre después de los de los
  // hijos, la cortina medía un cuadro tarde).
  ponerDisposicion(interfaz, lateralPlegado, altoTabla);
  // La hoja impresa sale con las franjas enteras: al abrir Imprimir se corta la animación de distancia (T5).
  useEffect(() => { if (exportar && visor) terminarAnimacion(visor); }, [exportar, visor]);
  // La tabla es del profesional: al pasar al simple se cierra.
  useEffect(() => { if (interfaz !== 'pro') setTabla(null); }, [interfaz]);


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
    // Un enlace de vista (#mapa=zoom/lat/lon&capas=…) reemplaza el vuelo a Chaco. Se lee al cargar el módulo
    // (ENLACE_INICIAL): con StrictMode este efecto corre dos veces y la segunda ya no encontraba el hash.
    const enlace = ENLACE_INICIAL;
    const entrar = (duracion: number) => (enlace ? aplicarVista(v, enlace, duracion > 0) : verChaco(v, duracion));
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
        entrar(1600);
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
      entrar(0);
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

  // Marca en <html> el profesional de escritorio: lo que HeroUI dibuja fuera de la interfaz (los desplegables
  // de los Select) toma de ahí los colores negros del pro.
  useEffect(() => { document.documentElement.toggleAttribute('data-pro-escritorio', interfaz === 'pro' && !celular); }, [interfaz, celular]);

  // El mapa base externo es del profesional de escritorio; en el simple y en el celular, el papel.
  useEffect(() => {
    if (visor) ponerMapaBase(visor, interfaz === 'pro' && !celular ? mapaBaseGuardado() : 'papel', false);
  }, [visor, interfaz, celular]);

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
    // En el escritorio del simple los resultados van en el notch de la derecha: al cambiar de herramienta se
    // cierran, así no tapan el mapa donde se va a tocar.
    const enLadoAhora = interfazActual.current === 'simple' && !matchMedia('(max-width: 1023px)').matches;
    if (modo === 'navegar' || modo === 'alta' || enLadoAhora) setResultados(null);
    return activarHerramienta(visor, modo, {
      consultando: (origen, zona) => { zonaConsultada.current = zona ?? null; setResultados({ tipo: 'cargando', origen }); },
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
        // Con la cortina del comparador abierta, Esc cierra primero lo de adelante (la herramienta, los
        // resultados) y, cuando no queda nada, la cortina.
        if (comparar && modo === 'navegar' && !resultados && !obra && !exportar && !temasAbierto) { setComparar(false); return; }
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
      // "C": el comparador (los dos modos).
      if (e.key.toLowerCase() === 'c' && !celular && visor) { e.preventDefault(); alternarComparar(); return; }
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
    if (adentro) requestAnimationFrame(() => document.querySelector<HTMLElement>('button[aria-label="Tabla de datos (T)"], button[aria-label="Tabla de atributos (T)"], .riel-pro [aria-label="Tabla de atributos"]')?.focus());
  }
  function alternarTabla() {
    if (tabla) { cerrarTabla(); return; }
    const capas = visor ? [...capasVisibles(visor)].reverse() : [];
    // La última que se abrió; si no, Localidades (si está prendida) o la primera con datos de verdad: las
    // obras arrancan vacías y la primera impresión era una tabla vacía.
    abrirTabla(ultimaTabla.current ?? (capas.includes('localidades') ? 'localidades' : capas.find(c => c !== 'provincias' && c !== 'obras_rn11') ?? 'localidades'));
  }

  // Abre o cierra el comparador (el foco vuelve solo a quien lo abrió).
  function alternarComparar() {
    setComparar(c => !c);
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
      l.feature.set('distancia', l.distancia);
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
        : resultados.consulta.origen === 'punto' ? (interfaz === 'simple' ? 'Qué hay en este lugar' : 'Consulta por punto · GetFeatureInfo') : (interfaz === 'simple' ? 'Lo que hay en la zona' : 'Consulta por rectángulo · WFS BBOX'),
    }
    : resultados?.tipo === 'medicion' && resultados.medicion.terminada
      ? { tipo: 'medicion', medicion: resultados.medicion, titulo: resultados.medicion.tipo === 'distancia' ? (interfaz === 'simple' ? 'Qué tan lejos' : 'Longitud geodésica') : (interfaz === 'simple' ? 'Qué tan grande' : 'Área geodésica') }
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

  // El pase de un modo al otro (TransicionModo): la pantalla blanca nace del botón que se tocó. Con
  // movimiento reducido no hay pase: se cambia en el acto. `foco`: si se cambió con el teclado, al terminar
  // el foco vuelve al interruptor del modo nuevo.
  const [pase, setPase] = useState<(Pase & { foco: boolean }) | null>(null);
  const cambiarModo = useCallback((v: Interfaz) => {
    if (v === interfaz || pase) return;
    const reducido = preferencias.movimientoReducido || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducido) { cambiarPreferencia('interfaz', v); return; }
    const activo = document.activeElement as HTMLElement | null;
    const caja = activo && activo !== document.body ? activo.getBoundingClientRect() : null;
    const x = caja && caja.width ? caja.left + caja.width / 2 : innerWidth - 120;
    const y = caja && caja.height ? caja.top + caja.height / 2 : 40;
    setPase({ de: interfaz, a: v, x, y, foco: !!activo?.closest('[role="radiogroup"]') && activo.matches(':focus-visible') });
  }, [interfaz, pase, preferencias.movimientoReducido, cambiarPreferencia]);
  const cambiarConPase = useCallback(<K extends keyof Preferencias>(clave: K, valor: Preferencias[K]) => {
    if (clave === 'interfaz') cambiarModo(valor as Interfaz);
    else cambiarPreferencia(clave, valor);
  }, [cambiarModo, cambiarPreferencia]);
  const alCubrir = useCallback(() => { if (pase) cambiarPreferencia('interfaz', pase.a); }, [pase, cambiarPreferencia]);
  const alTerminarPase = useCallback(() => {
    const foco = pase?.foco;
    setPase(null);
    if (foco) [...document.querySelectorAll<HTMLElement>('[aria-label="Tipo de pantalla"] [aria-checked="true"]')].find(el => el.getClientRects().length > 0)?.focus();
  }, [pase]);

  // Estables, para que NotchAjustes (memo) no se vuelva a dibujar con cada cambio de la App.
  const abrirGuia = useCallback(() => { setConfiguracion(false); setGuia(true); }, []);
  const abrirManual = useCallback(() => setConfiguracion(true), []);
  const [referencias, setReferencias] = useState(false);
  const abrirReferencias = useCallback(() => setReferencias(true), []);
  const cerrarReferencias = useCallback(() => setReferencias(false), []);
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
  const interruptor = <InterruptorModo valor={interfaz} onCambiar={cambiarModo} compacto className="max-lg:w-[124px]" />;
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

  // Panel flotante de la derecha (modo simple y celular). En el escritorio del simple, los resultados (qué hay,
  // la zona, la medida y las preguntas) salen en cambio del notch de la derecha, en el lugar de Ajustes.
  const enLado = interfaz === 'simple' && !celular && (!!resultados || !!obra);
  // El notch de resultados sigue puesto mientras se recoge; recién al terminar vuelve el de Ajustes.
  const [ladoPuesto, setLadoPuesto] = useState(false);
  useEffect(() => { if (enLado) setLadoPuesto(true); }, [enLado]);
  // Al recogerse, si el foco quedó en la nada (estaba adentro del notch que se cerró), pasa a la pastilla de
  // Ajustes, que vuelve a su lugar.
  const alRecogerLado = useCallback(() => {
    setLadoPuesto(false);
    requestAnimationFrame(() => {
      const activo = document.activeElement;
      if (activo && activo !== document.body && !activo.classList.contains('notch-resultados')) return;
      document.querySelector<HTMLElement>('[aria-label="Ajustes"]')?.focus({ preventScroll: true });
    });
  }, []);
  // Abierto el notch (0,6 s), si tapa lo consultado (el punto, el rectángulo o lo medido), el mapa se corre lo
  // justo para que quede a la vista, a su izquierda.
  const listoParaDespejar = !!resultados && (resultados.tipo === 'consulta' || (resultados.tipo === 'medicion' && resultados.medicion.terminada));
  useEffect(() => {
    if (!visor || !enLado || !listoParaDespejar) return;
    const zona = resultados?.tipo === 'medicion'
      ? (visor.dibujo.getFeatures().length ? visor.dibujo.getExtent() : null)
      : resultados?.tipo === 'consulta' && resultados.consulta.origen !== 'lenguaje' ? zonaConsultada.current : null;
    if (!zona) return;
    const reloj = setTimeout(() => despejarLado(visor, zona), 650);
    return () => clearTimeout(reloj);
  }, [visor, enLado, listoParaDespejar, resultados]);
  const panelFlotante = (
    <AnimatePresence>
      {contenidoPanel && !enLado && (
        <motion.div
          key={obra ? 'obra' : resultados ? 'resultados' : 'tablero'}
          className={`pointer-events-none absolute right-4 top-[92px] z-10 flex ${interfaz === 'simple' && resultados && !obra ? 'w-[440px]' : 'w-[400px]'} flex-col max-lg:inset-x-3 max-lg:bottom-[110px] max-lg:top-auto max-lg:max-h-[46cqh] max-lg:w-auto ${interfaz === 'simple' ? 'bottom-[228px] max-lg:bottom-[118px] lg:right-[72px]' : 'bottom-[184px]'}`}
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
        {/* El profesional de escritorio lleva los paneles negros del simple: adentro rige siempre el tema oscuro. */}
        <div className={interfaz === 'pro' && !celular ? 'interfaz dark' : 'interfaz'} data-interfaz={interfaz} inert={modal}>
          {/* Mapa de calor (T3): si una mancha necesita acercarse o no se pudo traer, se avisa sobre el mapa. */}
          {visor && (
            <div className="pointer-events-none absolute inset-x-0 top-[92px] z-20 flex justify-center px-4 max-lg:top-[150px]">
              <AvisoCalor visor={visor} onAcercar={() => zoom(1)} />
            </div>
          )}
          {comparar && !celular && (
            <Suspense fallback={null}>
              <Comparador
                visor={visor}
                conPanel={hayContenido}
                disposicion={`${interfaz}|${lateralPlegado}|${altoTabla}|${hayContenido}`}
                onCerrar={() => setComparar(false)}
              />
            </Suspense>
          )}
          {interfaz === 'simple' ? (
            <>
              {!celular && (
                <>
                  {/* "Capas": la pastilla negra del centro del borde izquierdo, que se estira hasta ser el panel. */}
                  <aside className="entra pointer-events-none absolute bottom-[76px] left-0 top-[84px] z-30 flex" style={retraso(80)}>
                    <NotchTemas visor={visor} />
                  </aside>
                  {/* La escala, sola: Referencias se mudó a la pastilla "Ajustes". */}
                  <div className="pointer-events-auto absolute bottom-3 left-4 z-20">
                    <BarraEstado visor={visor} negra />
                  </div>
                </>
              )}

              {celular ? (
                <header className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start gap-3">
                  <div className="entra pointer-events-auto mx-auto w-full min-w-0" style={retraso(120)} data-guia="buscar">
                    <Buscador capaPrendida={nombre => visor.visibles.has(nombre)} enVista={enVista} onElegir={elegir} />
                  </div>
                </header>
              ) : (
                <>
                  {/* Arriba: el buscador negro al centro y el interruptor Simple / Pro metido en la esquina. */}
                  <Isla style={retraso(120)}>
                    <Buscador capaPrendida={nombre => visor.visibles.has(nombre)} enVista={enVista} onElegir={elegir} negro />
                  </Isla>
                  <div className="entra pointer-events-auto absolute right-3 top-3 z-20" style={retraso(200)}>
                    <InterruptorModo valor={interfaz} onCambiar={cambiarModo} grande />
                  </div>
                  {/* "Ajustes": la pastilla del centro del borde derecho, espejo de "Capas" (tema, tamaño, guía y
                      manual y referencias). Abierta se apoya arriba del bloque del minimapa (termina 248 px antes del
                      borde) y la pastilla cerrada queda a la altura de la de Capas (--notch-centro en estilos.css). El panel de resultados se corre a su izquierda (ver panelFlotante). */}
                  <aside className="ajustes-lugar entra pointer-events-none absolute bottom-[248px] right-0 top-[84px] z-30 flex w-[640px] flex-col items-end justify-end" style={retraso(160)}>
                    {enLado || ladoPuesto ? (
                      <NotchResultados contenido={enLado ? contenidoPanel : null} onRecogida={alRecogerLado} />
                    ) : (
                      <NotchAjustes
                        preferencias={preferencias}
                        onCambiar={cambiarPreferencia}
                        oscuro={oscuro}
                        onTema={cambiarTema}
                        onGuia={abrirGuia}
                        onManual={abrirManual}
                        onReferencias={abrirReferencias}
                      />
                    )}
                  </aside>
                  <PanelReferencias visor={visor} abierto={referencias} onCerrar={cerrarReferencias} />
                </>
              )}

              {panelFlotante}

              {celular ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
                  <div className="entra pointer-events-auto" style={retraso(260)}>
                    <Acciones modo={modo} onModo={setModo} sinPista={!!obra || exportar} imprimiendo={exportar} onImprimir={() => setExportar(e => !e)} comparando={comparar} onComparar={alternarComparar} />
                  </div>
                </div>
              ) : (
                // "Herramientas": la pastilla del centro del borde de abajo, que se estira hacia arriba con los botones.
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center">
                  <div className="entra pointer-events-none" style={retraso(260)}>
                    <Acciones enNotch modo={modo} onModo={setModo} sinPista={!!obra || exportar} imprimiendo={exportar} onImprimir={() => setExportar(e => !e)} comparando={comparar} onComparar={alternarComparar} />
                  </div>
                </div>
              )}
              {!celular && (
                // Un solo bloque negro: el minimapa arriba y debajo "−" y "+" bien grandes. Nada más.
                <div className="controles-mapa entra superficie-notch pointer-events-auto absolute bottom-4 right-4 z-10 flex flex-col gap-1.5 rounded-[22px] bg-[var(--notch-fondo)] p-1.5 text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,.45)]" style={retraso(380)}>
                  {preferencias.minimapa && <div className="max-xl:hidden [&_.minimapa]:size-[140px] [&_.minimapa]:rounded-[16px] [&_.minimapa]:shadow-none"><Minimapa visor={visor} /></div>}
                  <div className="dark flex gap-1.5">
                    <button type="button" aria-label="Alejar el mapa" title="Alejar el mapa" onClick={() => zoom(-1)} className="boton-zoom"><Minus size={28} weight="bold" /></button>
                    <button type="button" aria-label="Acercar el mapa" title="Acercar el mapa" onClick={() => zoom(1)} className="boton-zoom"><Plus size={28} weight="bold" /></button>
                  </div>
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
              {/* Pro, como un mapa web: el riel de la izquierda (y su cajón de Capas o Leyenda), el buscador
                  arriba con lo consultado debajo, las herramientas como chips, el minimapa abajo a la izquierda,
                  el zoom abajo a la derecha y la barra de estado de punta a punta. --izq: hasta dónde llega lo
                  de la izquierda (el riel y el cajón abierto); --abajo: el borde de abajo libre (sobre la barra
                  de estado y, si está abierta, la tabla). */}
              <div className="pro-maps contents" style={{ '--ancho-riel': rielAbierto ? '300px' : '60px', '--izq': `calc(var(--ancho-riel) + ${cajon ? 'var(--ancho-cajon)' : '0px'})`, '--abajo': `calc(var(--alto-estado) + 16px + ${altoTabla ? `${altoTabla + 12}px` : '0px'})`, ...(preferencias.minimapa ? {} : { '--alto-mini': '-14px' }) } as React.CSSProperties}>
                <Riel
                  estilo={retraso(40)}
                  abierta={rielAbierto}
                  onAbierta={setRielAbierto}
                  ruta={!!ruta.activa}
                  onRuta={() => mostrarRuta(RN11, true)}
                  cajon={cajon}
                  onCajon={setCajon}
                  tabla={!!tabla}
                  onTabla={alternarTabla}
                  comparar={comparar}
                  onComparar={alternarComparar}
                  onImprimir={() => setExportar(e => !e)}
                  oscuro={oscuro}
                  onTema={() => cambiarTema(!oscuro)}
                  onAjustes={() => setConfiguracion(true)}
                />

              {/* El cajón: se abre pegado al riel, de arriba abajo. Queda siempre armado (cerrado, inerte y fuera
                  de la vista): así recuerda qué grupos de capas estaban abiertos y dónde estaba el desplazamiento. */}
              <aside
                id="cajon-pro"
                aria-label={TITULOS_CAJON[cajon ?? 'capas']}
                inert={!cajon}
                data-abierto={cajon ? true : undefined}
                className="cajon-pro pointer-events-auto absolute bottom-[var(--alto-estado)] left-[var(--ancho-riel)] top-0 z-20 flex w-[var(--ancho-cajon)] flex-col"
              >
                <button type="button" onClick={() => setCajon(null)} aria-label={`Cerrar ${TITULOS_CAJON[cajon ?? 'capas'].toLowerCase()}`} title="Cerrar" className="cajon-cerrar absolute right-3 top-3.5 z-10 grid size-10 place-items-center rounded-full"><X size={18} weight="bold" /></button>
                <div hidden={cajon !== 'capas' && cajon !== null} className="flex min-h-0 flex-1 flex-col">
                  <PanelCapas visor={visor} plegable={false} onTabla={abrirTabla} tablaAbierta={tabla?.capa ?? null} />
                  <p className="cajon-pie shrink-0 border-t border-[var(--linea)] px-5 py-3 text-[12.5px] leading-snug text-[var(--tinta-3)]">
                    <strong className="font-semibold text-[var(--tinta-2)]">Fuente:</strong> IGN · SIG 250 · GeoServer (workspace <code className="font-mono">tpi</code>) · WMS 1.3.0 en teselas de 512 px · SRC EPSG:3857
                  </p>
                </div>
                {cajon === 'leyenda' && (
                  <section className="flex min-h-0 flex-1 flex-col">
                    <header className="px-5 pb-3.5 pt-[18px] pr-16">
                      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Leyenda</h2>
                      <p className="mt-1 text-[13px] leading-snug text-[var(--tinta-3)]">Simbología de las capas visibles · WMS GetLegendGraphic con el SLD de cada capa</p>
                    </header>
                    <section tabIndex={0} aria-label="Leyenda de las capas prendidas" className="desplazable min-h-0 flex-1 overflow-y-auto border-t border-[var(--linea)] focus-visible:outline-2">
                      <LeyendaGeneral visor={visor} />
                    </section>
                  </section>
                )}
                <Suspense fallback={null}>
                  {cajon === 'seleccion' && <PanelSeleccion onPreguntar={preguntar} />}
                  {cajon === 'estadisticas' && <PanelEstadisticas visor={visor} />}
                  {cajon === 'obras' && <PanelObras visor={visor} recarga={recargaObras} onConsulta={consulta => { setTablero(null); setResultados({ tipo: 'consulta', consulta }); }} onTabla={() => abrirTabla('obras_rn11')} onNueva={() => setModo('alta')} />}
                  {cajon === 'servicios' && <PanelServicios visor={visor} />}
                  {cajon === 'mapas-base' && <PanelMapasBase visor={visor} />}
                  {cajon === 'coordenada' && <PanelCoordenadas visor={visor} />}
                  {cajon === 'vistas' && <PanelVistas visor={visor} />}
                  {cajon === 'catalogo' && <PanelCatalogo onTabla={abrirTabla} />}
                </Suspense>
              </aside>

              {/* Arriba: el buscador (una tarjeta, como la de un mapa web), los chips y el interruptor de modo. */}
              <header className="encabezado-pro pointer-events-none absolute left-[calc(var(--izq)+16px)] right-4 top-3 z-20 flex items-start gap-3">
                <div className="buscador-pro entra pointer-events-auto w-[var(--ancho-columna)] shrink-0" style={retraso(100)}>
                  <Buscador capaPrendida={nombre => visor.visibles.has(nombre)} enVista={enVista} onElegir={elegir} />
                </div>
                <div className="entra pointer-events-auto mt-[2px] min-w-0 flex-1" style={retraso(160)}>
                  <Chips modo={modo} onModo={setModo} extra={<BotonRuta estado={ruta} onPress={() => mostrarRuta(RN11, true)} chip />} />
                </div>
                <div className="entra pointer-events-auto mt-[5px] shrink-0" style={retraso(220)}>{interruptor}</div>
              </header>

              {/* Lo consultado: debajo del buscador, del alto de su contenido (como mucho, hasta el minimapa). */}
              <AnimatePresence>
                {contenidoPanel && (
                  <motion.div
                    key={obra ? 'obra' : resultados ? 'resultados' : 'tablero'}
                    className="columna-pro pointer-events-none absolute left-[calc(var(--izq)+16px)] top-[84px] z-10 flex w-[var(--ancho-columna)] flex-col"
                    style={{ bottom: 'calc(var(--abajo) + var(--alto-mini) + 14px)' }}
                    initial={{ opacity: 0, y: -10, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.985 }}
                    transition={RESORTE_PANEL}
                  >
                    <Tocable>{contenidoPanel}</Tocable>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Qué hacer con la herramienta elegida: debajo de los chips. */}
              <AnimatePresence>
                {modo !== 'navegar' && !obra && (
                  <motion.p
                    key={modo}
                    role="status"
                    className="ayuda-pro panel pointer-events-none absolute top-[78px] z-10 px-4 py-2.5 text-[14.5px] font-medium"
                    style={{ left: 'calc(var(--izq) + 16px + var(--ancho-columna) + 16px)' }}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={RESORTE_PANEL}
                  >
                    <AyudaTecnica modo={modo} />
                  </motion.p>
                )}
              </AnimatePresence>

              {/* La tabla de datos: un cajón abajo, entre lo de la izquierda y el zoom, sobre la barra de estado. */}
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
                    className="pointer-events-auto absolute bottom-[calc(var(--alto-estado)+16px)] left-[calc(var(--izq)+16px)] right-[84px] z-10 flex flex-col"
                    style={{ transition: 'height .45s var(--ios), left .45s var(--ios)',
                      // Con la animación de distancia abierta, la tabla no sube más allá de su panel y deja 200 px de mapa
                      // (para el zoom y el comparador): --fondo-franja lo pone el panel (CrecerFranja).
                      height: `min(${tabla.amplia ? 'calc((100% - 164px) * 0.68)' : 'max(calc((100% - 164px) * 0.42), min(320px, calc(100% - 300px)))'}, calc(100% - 268px - var(--fondo-franja, 0px) - var(--reserva-comparador, 0px)))` }}
                  >
                    <Suspense fallback={<div className="panel h-full" />}>
                      <TablaDatos
                        visor={visor}
                        capa={tabla.capa}
                        onCapa={abrirTabla}
                        amplia={tabla.amplia}
                        onAmplia={amplia => setTabla(t => t && { ...t, amplia })}
                        onCerrar={cerrarTabla}
                        bordes={`${cajon}`}
                        onIrA={consulta => { setTablero(null); setResultados({ tipo: 'consulta', consulta }); }}
                        onLimpiar={cerrarResultados}
                        recargaObras={recargaObras}
                      />
                    </Suspense>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Abajo a la izquierda, el minimapa (la miniatura de un mapa web). */}
              {preferencias.minimapa && (
                <div className="controles-mapa minimapa-pro entra pointer-events-auto absolute left-[calc(var(--izq)+16px)] z-10" style={{ ...retraso(420), bottom: 'var(--abajo)' }}>
                  <Minimapa visor={visor} />
                </div>
              )}

              {/* Abajo a la derecha: ver todo el Chaco y el zoom, como los controles de un mapa web. */}
              <div className="controles-mapa controles-pro entra pointer-events-none absolute right-4 z-10 flex flex-col items-center gap-2.5" style={{ ...retraso(460), bottom: 'var(--abajo)' }}>
                <button type="button" aria-label="Ver Chaco completo" title="Ver Chaco completo" onClick={() => verChaco(visor)} className="boton-control-pro panel pointer-events-auto grid size-12 place-items-center rounded-full"><CornersOut size={21} weight="bold" /></button>
                <div className="panel pointer-events-auto flex w-12 flex-col items-center overflow-hidden rounded-[24px]">
                  <button type="button" aria-label="Acercar" title="Acercar" onClick={() => zoom(1)} className="boton-control-pro grid h-12 w-12 place-items-center"><Plus size={21} weight="bold" /></button>
                  <span aria-hidden="true" className="h-px w-7 bg-[var(--linea)]" />
                  <button type="button" aria-label="Alejar" title="Alejar" onClick={() => zoom(-1)} className="boton-control-pro grid h-12 w-12 place-items-center"><Minus size={21} weight="bold" /></button>
                </div>
              </div>

              {/* La barra de estado, de punta a punta (sin animación de entrada: es lo que el navegador toma
                  como LCP y la demora lo empeoraba). */}
              <footer className="estado-pro pointer-events-auto absolute inset-x-0 bottom-0 z-30">
                <EstadoTecnico visor={visor} />
              </footer>
              </div>
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
                  onCambiar={cambiarConPase}
                  oscuro={oscuro}
                  onTema={cambiarTema}
                  onCerrar={() => setConfiguracion(false)}
                  onGuia={interfaz === 'simple' ? () => { setConfiguracion(false); setGuia(true); } : undefined}
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
      {pase && <TransicionModo pase={pase} onCubierta={alCubrir} onFin={alTerminarPase} />}
    </>
  );
}

// Sin ruta a la vista abre la RN11; con una ruta elegida (la RN11 u otra por doble clic) la oculta.
function BotonRuta({ estado, onPress, angosto, soloEscudo, chip }: { estado: EstadoRuta; onPress: () => void; angosto?: boolean; soloEscudo?: boolean; chip?: boolean }) {
  const activa = estado.activa;
  const simple = useInterfaz() === 'simple';
  // En los chips del profesional: un chip más, con el escudo; puesta, se pinta del color de la ruta.
  if (chip) {
    return (
      <button
        type="button"
        onClick={onPress}
        aria-pressed={!!activa}
        title={activa ? `${estado.tramos} tramos en ${tituloProvincia(activa.provincia)}` : 'La traza de la RN11 en Chaco'}
        className="chip-pro chip-ruta relative flex h-11 shrink-0 items-center gap-2 rounded-full pl-2.5 pr-4 text-[15px] font-semibold"
        data-activo={activa ? true : undefined}
        style={activa ? ({ '--escudo-fondo': 'var(--vial-fuerte)', '--escudo-tinta': '#fff' } as React.CSSProperties) : undefined}
      >
        <EscudoRuta numero={activa?.numero ?? '11'} className={`h-7 w-auto ${estado.cargando ? 'animate-pulse' : ''}`} />
        <span className="whitespace-nowrap">{estado.cargando ? 'Cargando…' : activa ? `Ocultar RN${activa.numero}` : 'Ver RN11'}</span>
      </button>
    );
  }
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

interface PropsPanelLateral {
  id: string;
  etiqueta: string;
  titulo?: string;
  pasoGuia?: string;
  abierto: boolean;
  onAlternar: () => void;
  className: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
}

function PanelLateral({ id, etiqueta, titulo = etiqueta, pasoGuia, abierto, onAlternar, className, children, pie }: PropsPanelLateral) {
  return (
    <aside className={`lateral-capas pointer-events-none absolute flex flex-col ${className}`}>
      <button
        type="button"
        aria-label={etiqueta}
        aria-controls={id}
        aria-expanded={abierto}
        title={titulo}
        data-guia={pasoGuia}
        onClick={onAlternar}
        className="boton-capas panel pointer-events-auto relative z-20 grid size-12 shrink-0 place-items-center self-start text-[var(--tinta-2)] hover:text-[var(--tinta)] focus-visible:outline-2"
      >
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect className="boton-capas-relleno" x="3" y="4.5" width="7.5" height="15" rx="2" fill="currentColor" />
          <rect x="3" y="4.5" width="18" height="15" rx="3" stroke="currentColor" strokeWidth="1.65" />
          <path d="M10.5 5v14" stroke="currentColor" strokeWidth="1.65" />
        </svg>
      </button>
      <div id={id} inert={!abierto} className="cajon-capas relative z-10 flex min-h-0 flex-1 flex-col">
        {children}
      </div>
      {pie}
    </aside>
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
function ContadorCapas({ visor }: { visor: Visor }) {
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);
  return <span className="text-[var(--tinta-3)]"><strong className="font-semibold text-[var(--tinta)]">{visor.visibles.size}</strong> de 48 capas</span>;
}

// Modo simple: "Referencias" abre qué significa cada color de lo que se está viendo (la leyenda).
// `compacto`: en el celular, más chico y se abre hacia abajo (va en la fila de arriba).
// Escritorio del simple: las referencias, abiertas desde la pastilla "Ajustes". Un panel abajo a la izquierda,
// sobre la escala (no choca con el panel de resultados, que va a la derecha); Escape o la cruz lo cierran y el foco vuelve a "Ajustes".
function PanelReferencias({ visor, abierto, onCerrar }: { visor: Visor; abierto: boolean; onCerrar: () => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!abierto) return;
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('button')?.focus());
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || hayDialogoModal()) return;
      e.stopImmediatePropagation();
      onCerrar();
      document.querySelector<HTMLElement>('[aria-label="Ajustes"]')?.focus();
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  }, [abierto, onCerrar]);
  return (
    <AnimatePresence>
      {abierto && (
        <motion.section
          ref={panel}
          aria-label="Referencias: qué significa cada color"
          className="panel desplazable pointer-events-auto absolute bottom-[88px] left-4 z-20 max-h-[calc(100%-190px)] w-[380px] overflow-y-auto shadow-[var(--sombra-alta)]"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={RESORTE_PANEL}
        >
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--linea)] bg-[var(--superficie)] py-3 pl-5 pr-2">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">Referencias</h2>
            <button type="button" onClick={() => { onCerrar(); document.querySelector<HTMLElement>('[aria-label="Ajustes"]')?.focus(); }} aria-label="Cerrar referencias" className="grid size-11 place-items-center rounded-xl hover:bg-[var(--superficie-2)]"><X size={20} weight="bold" /></button>
          </header>
          <LeyendaGeneral visor={visor} />
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function BotonReferencias({ visor, compacto }: { visor: Visor; compacto?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  // Escape cierra las referencias (antes que cualquier otro Escape del visor) y devuelve el foco al botón.
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      // Con un diálogo modal encima (la guía), el Escape es del diálogo.
      if (e.key !== 'Escape' || hayDialogoModal()) return;
      // stopImmediatePropagation: también frena a los otros Esc en captura de la ventana (el panel de la
      // animación de distancia), así un Esc cierra solo lo de adelante.
      e.stopImmediatePropagation();
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

// Lo de adentro de un panel que entra y sale animado: mientras se va, ya no recibe clics (si no, el primer clic
// en el mapa después de cerrarlo, por ejemplo el primer vértice de una medición, caía en el panel que se iba).
function Tocable({ children }: { children: React.ReactNode }) {
  const presente = useIsPresent();
  return <div className={`${presente ? 'pointer-events-auto' : 'pointer-events-none'} flex min-h-0 flex-col`}>{children}</div>;
}
