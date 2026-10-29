import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Toast, ToggleButton, ToggleButtonGroup, toast } from '@heroui/react';
import { CornersOut, Minus, Moon, Plus, Sun } from '@phosphor-icons/react';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { getCenter } from 'ol/extent';
import BarraEstado from './componentes/BarraEstado';
import Buscador from './componentes/Buscador';
import Dock from './componentes/Dock';
import EscudoRuta from './componentes/EscudoRuta';
import Minimapa from './componentes/Minimapa';
import PanelCapas from './componentes/PanelCapas';
import type { EstadoResultados } from './componentes/PanelResultados';
import type { Sugerencia } from './comandos';
import { activarHerramienta, HERRAMIENTAS, type Modo } from './herramientas';
import { guardarObra, type DatosObra } from './obras';
import { useTema } from './tema';
import { aplicarTema, cambiarCapas, cargarRn11, crearVisor, refrescarMapa, restablecerCapas, verChaco, volarA, type Visor } from './visor';

// Se cargan recién cuando hacen falta: el formulario trae Select, TextArea y el botón animado.
const FormObra = lazy(() => import('./componentes/FormObra'));
const PanelResultados = lazy(() => import('./componentes/PanelResultados'));

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
    if (visor) aplicarTema(visor);
  }, [visor, oscuro]);

  useEffect(() => {
    if (!visor) return;
    setObra(null);
    if (modo === 'navegar' || modo === 'alta') setResultados(null);
    return activarHerramienta(visor, modo, {
      consultando: origen => setResultados({ tipo: 'cargando', origen }),
      consulta: consulta => setResultados({ tipo: 'consulta', consulta }),
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
      setRn11({ ...rn11, activa: false });
      return;
    }
    setRn11({ ...rn11, cargando: true });
    try {
      const { tramos } = await cargarRn11(visor);
      visor.rn11.setVisible(true);
      volarA(visor, visor.rn11.getSource()!.getExtent()!, { duracion: 1400 });
      setRn11({ cargando: false, activa: true, tramos });
    } catch {
      setRn11({ cargando: false, activa: false });
      toast.danger('No se pudo cargar la traza de la RN11', { description: '¿Está levantado GeoServer?' });
    }
  }

  // Lo que se elige en el buscador central.
  function elegir(s: Sugerencia) {
    if (!visor) return;
    const separador = s.id.indexOf(':');
    const [tipo, valor] = [s.id.slice(0, separador), s.id.slice(separador + 1)];
    if (tipo === 'lugar' && s.extension) {
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
        <>
          {/* Arriba: marca, buscador al centro, RN11 y tema. */}
          <header className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start gap-3 lg:inset-x-4 lg:top-4">
            <div className="entra pointer-events-auto max-xl:hidden" style={retraso(100)}>
              <Marca />
            </div>
            <div className="entra pointer-events-auto mx-auto w-full lg:absolute lg:left-[356px] lg:w-[calc(100vw-356px-452px)] xl:left-1/2 xl:w-[clamp(420px,calc(100vw-880px),600px)] xl:-translate-x-1/2" style={retraso(180)}>
              <Buscador capaPrendida={nombre => visor.visibles.has(nombre)} onElegir={elegir} />
            </div>
            <div className="entra pointer-events-auto ml-auto flex items-center gap-2.5 max-lg:hidden" style={retraso(260)}>
              <BotonRn11 estado={rn11} onPress={() => mostrarRn11(true)} />
              <SelectorTema oscuro={oscuro} onCambiar={cambiarTema} />
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
          {resultados && (
            <div className="pointer-events-none absolute bottom-[184px] right-4 top-[92px] z-10 flex w-[400px] flex-col max-lg:inset-x-3 max-lg:bottom-[110px] max-lg:top-auto max-lg:max-h-[46vh] max-lg:w-auto">
              <div className="pointer-events-auto flex min-h-0 flex-col">
                <Suspense fallback={null}>
                  <PanelResultados visor={visor} estado={resultados} onCerrar={cerrarResultados} />
                </Suspense>
              </div>
            </div>
          )}

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
            <div className="entra pointer-events-auto" style={retraso(520)}>
              <Minimapa visor={visor} />
            </div>
          </div>

          {/* Celular: RN11 y tema arriba del dock. */}
          <div className="pointer-events-none absolute bottom-[100px] right-3 z-10 lg:hidden">
            <div className="pointer-events-auto flex gap-2">
              <BotonRn11 estado={rn11} onPress={() => mostrarRn11(true)} />
              <SelectorTema oscuro={oscuro} onCambiar={cambiarTema} compacto />
            </div>
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
        </>
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

// Claro u oscuro con un control segmentado de HeroUI: las dos opciones a la vista.
function SelectorTema({ oscuro, onCambiar, compacto }: { oscuro: boolean; onCambiar: (oscuro: boolean) => void; compacto?: boolean }) {
  const opciones = [
    { id: 'claro', Icono: Sun, texto: 'Claro' },
    { id: 'oscuro', Icono: Moon, texto: 'Oscuro' },
  ];
  return (
    <div className={`panel flex items-center p-1.5 ${compacto ? 'h-12' : 'h-[60px]'}`}>
      <ToggleButtonGroup
        aria-label="Tema"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([oscuro ? 'oscuro' : 'claro'])}
        onSelectionChange={claves => onCambiar([...claves][0] === 'oscuro')}
        className="h-full gap-1"
      >
        {opciones.map(({ id, Icono, texto }) => (
          <ToggleButton
            key={id}
            id={id}
            aria-label={`Tema ${texto.toLowerCase()}`}
            className="h-full gap-2 rounded-[11px] bg-transparent px-3.5 text-[14px] font-medium text-[var(--tinta-2)] data-[selected=true]:bg-[var(--tinta)] data-[selected=true]:text-[var(--superficie)]"
          >
            <Icono size={18} weight="bold" />
            {!compacto && texto}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
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
