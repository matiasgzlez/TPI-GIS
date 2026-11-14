// Imprimir el mapa (en pro, "Exportar a PDF"): una ventana grande al centro. A la izquierda, la hoja
// real sobre la mesa, tan grande como entra; a la derecha, todo lo que se puede decidir: la hoja, el
// encuadre y la escala, los textos y qué mostrar. Cada cambio rehace la vista previa, que es el PDF
// mismo: lo que se ve es exactamente lo que se descarga.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buffer } from 'ol/extent';
import { motion, useIsPresent } from 'motion/react';
import { Switch } from '@heroui/react';
import { ArrowDown, Eye, FilePdf, MapTrifold, MagnifyingGlassMinus, MagnifyingGlassPlus, Printer, X } from '@phosphor-icons/react';
import { capasVisibles, cargarLeyenda, type Visor } from '../visor';
import { EXTENSION_CHACO, URL_WFS, WORKSPACE, tituloDeCapa } from '../config';
import { capaSimple, useInterfaz } from '../interfaz';
import { RESORTE_PANEL } from '../movimiento';
import EscudoRuta from '../componentes/EscudoRuta';
import { dibujarMapa, encuadreActual, escalaParaEncuadre, escalaVecina, ESCALA_MAS_CERCA, ESCALA_MAS_LEJOS, type MapaImpreso } from './mapaImpreso';
import { generarPdf, marcoMapa, type Contenido, type Leyenda, type Orientacion } from './pdf';
import VistaPrevia from './VistaPrevia';
import { ubicarEntidades } from '../cercanias';
import { nombrePro, nombreSimple } from '../entidades';

interface Props {
  visor: Visor;
  contenido: Contenido | null;
  // La ruta dibujada en el mapa (si hay): ofrece encuadrarla.
  ruta: { numero: string; nombre: string } | null;
  // Si hay un panel abierto a la derecha (resultados, tablero): tapa parte del mapa que se veía.
  panelAbierto: boolean;
  autores: string;
  onAutores: (autores: string) => void;
  onCerrar: () => void;
}

type Encuadre = 'vista' | 'chaco' | 'ruta';

// Una leyenda de GeoServer a 192 ppp, como PNG en data URL (jsPDF no lee URLs de blob).
const leyendasGuardadas = new Map<string, Promise<Leyenda | null>>();
function leyendaDe(nombre: string, simple: boolean): Promise<Leyenda | null> {
  const clave = `${nombre}|${simple}`;
  if (!leyendasGuardadas.has(clave)) {
    leyendasGuardadas.set(clave, (async () => {
      try {
        // Con tope de 15 s: una leyenda colgada no deja la ventana en "Actualizando…" para siempre
        // (al vencer cuenta como fallida, se avisa y se puede reintentar).
        const tope = <T,>(promesa: Promise<T>) => Promise.race([promesa, new Promise<never>((_, no) => setTimeout(() => no(new Error('tope')), 15000))]);
        const url = await cargarLeyenda(nombre, AbortSignal.timeout(15000), simple, 192);
        const imagen = new Image();
        imagen.src = url;
        await tope(imagen.decode());
        const lienzo = document.createElement('canvas');
        lienzo.width = imagen.naturalWidth; lienzo.height = imagen.naturalHeight;
        lienzo.getContext('2d')!.drawImage(imagen, 0, 0);
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        const titulo = simple ? capaSimple(nombre)?.titulo ?? tituloDeCapa(nombre) : tituloDeCapa(nombre);
        return { titulo, imagen: lienzo.toDataURL('image/png'), ancho: imagen.naturalWidth, alto: imagen.naturalHeight };
      } catch {
        leyendasGuardadas.delete(clave);
        return null;
      }
    })());
  }
  return leyendasGuardadas.get(clave)!;
}

// ¿Hay obras cargadas? Si la pregunta falla, se asume que sí (mejor una leyenda de más que de menos).
async function hayObras() {
  try {
    const r = await fetch(`${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:obras_rn11&resultType=hits`, { signal: AbortSignal.timeout(8000) });
    const n = (await r.text()).match(/numberMatched="(\d+)"/)?.[1];
    return n === undefined || Number(n) > 0;
  } catch {
    return true;
  }
}

// Valor que se actualiza recién cuando deja de cambiar (al escribir no se rehace el PDF por letra).
function useQuieto<T>(valor: T, ms = 350) {
  const [quieto, setQuieto] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setQuieto(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return quieto;
}

const nombreArchivo = (titulo: string) => `${(titulo || 'mapa').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'mapa'}.pdf`;
const miles = (n: number) => n.toLocaleString('es-AR');
const peso = (bytes: number) => (bytes > 1e6 ? `${(bytes / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB` : `${Math.round(bytes / 1024)} KB`);

export default function Imprimir({ visor, contenido, ruta, panelAbierto, autores, onAutores, onCerrar }: Props) {
  const simple = useInterfaz() === 'simple';
  const raiz = useRef<HTMLDivElement>(null);
  const campoTitulo = useRef<HTMLInputElement>(null);
  const botonDescargar = useRef<HTMLButtonElement>(null);
  const [paginaVista, setPaginaVista] = useState(1);
  // Lo que se veía al abrir: el encuadre "como lo estás viendo".
  const [vista] = useState(() => encuadreActual(visor, panelAbierto));
  const extensionRuta = useMemo(() => {
    if (!ruta || !visor.ruta.getVisible()) return null;
    const e = visor.ruta.getSource()!.getExtent();
    // Con aire alrededor: las franjas de 20 km no se cortan en el borde del marco.
    return e && Number.isFinite(e[0]) ? buffer(e, 25_000) : null;
  }, [visor, ruta]);

  const [orientacion, setOrientacion] = useState<Orientacion>('horizontal');
  const [encuadre, setEncuadre] = useState<Encuadre>('vista');
  // La escala elegida a mano (null: la redonda con la que entra el encuadre). Sobrevive al giro de la hoja.
  const [escalaElegida, setEscalaElegida] = useState<number | null>(null);
  const [titulo, setTitulo] = useState(contenido?.titulo ?? 'Mapa del Chaco y la Ruta Nacional 11');
  const [descripcion, setDescripcion] = useState('');
  const [mostrar, setMostrar] = useState({ leyenda: true, grilla: true, norte: true, escala: true, respuesta: !!contenido });
  // Cada resultado guarda la clave de lo que se le pidió: el mapa, las leyendas y el PDF. Solo se
  // descarga si el PDF es el de lo que se está eligiendo ahora (no depende de que un "cargando" llegue
  // a tiempo: entre un cambio y su efecto hay un instante en que el PDF viejo parecía vigente).
  const [mapa, setMapa] = useState<{ clave: string; impreso: MapaImpreso } | null>(null);
  const [leyendas, setLeyendas] = useState<{ clave: string; lista: Leyenda[] } | null>(null);
  const [pdf, setPdf] = useState<{ url: string; blob: Blob; paginas: number; clave: string } | null>(null);
  const [armando, setArmando] = useState(true);
  // Errores por separado (uno no borra al otro): el mapa, las leyendas y el armado del PDF.
  const [errorMapa, setErrorMapa] = useState<string | null>(null);
  const [errorLeyenda, setErrorLeyenda] = useState<string | null>(null);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  // Si pdf.js no puede mostrar la hoja, no se descarga a ciegas.
  const [errorVista, setErrorVista] = useState<string | null>(null);
  // El PDF que la vista previa ya mostró: se descarga solo ese (lo que se ve es lo que se baja).
  const [blobDibujado, setBlobDibujado] = useState<Blob | null>(null);
  const [reintento, setReintento] = useState(0);
  const tituloQuieto = useQuieto(titulo);
  const descripcionQuieta = useQuieto(descripcion);
  const autoresQuietos = useQuieto(autores);

  // Ventana modal: el foco empieza en el título, el Tab no sale y Escape cierra. Apenas empieza a
  // cerrarse deja de ser modal y el foco vuelve al botón que la abrió (al abrirla, el resto queda inert
  // y ese botón ya perdió el foco: se lo busca por su nombre).
  const presente = useIsPresent();
  useEffect(() => {
    if (presente) return;
    const boton = [...document.querySelectorAll<HTMLElement>('[aria-label="Imprimir el mapa"], [aria-label="Exportar a PDF"]')].find(el => el.getClientRects().length > 0);
    requestAnimationFrame(() => boton?.focus());
  }, [presente]);
  useEffect(() => {
    if (!presente) return;
    campoTitulo.current?.focus();
    campoTitulo.current?.select();
    const alPresionar = (e: KeyboardEvent) => {
      if (!raiz.current) return;
      if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); return; }
      if (e.key !== 'Tab') return;
      const enfocables = [...raiz.current.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.hasAttribute('disabled') && el.getClientRects().length > 0 && !el.closest('[inert]'));
      const i = enfocables.indexOf(document.activeElement as HTMLElement);
      if (i === -1 || (e.shiftKey ? i === 0 : i === enfocables.length - 1)) {
        e.preventDefault();
        enfocables[e.shiftKey ? enfocables.length - 1 : 0]?.focus();
      }
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  }, [onCerrar, presente]);

  // Encuadre y escala: la escala redonda con la que entra el encuadre, más los saltos pedidos.
  const marco = useMemo(() => marcoMapa(orientacion, mostrar.grilla, mostrar.leyenda), [orientacion, mostrar.grilla, mostrar.leyenda]);
  const extension = encuadre === 'chaco' ? EXTENSION_CHACO : encuadre === 'ruta' && extensionRuta ? extensionRuta : vista;
  const escalaBase = useMemo(() => {
    const e = escalaParaEncuadre(extension, marco.ancho, marco.alto);
    return Math.min(ESCALA_MAS_LEJOS, Math.max(ESCALA_MAS_CERCA, e));
  }, [extension, marco]);
  const denominador = escalaElegida ?? escalaBase;
  // Topes: más cerca que 1:50.000 los datos no dan más detalle; más lejos que 1:10.000.000, el Chaco es un punto.
  const puedeAlejar = escalaVecina(denominador, 1) <= ESCALA_MAS_LEJOS;
  const puedeAcercar = escalaVecina(denominador, -1) >= ESCALA_MAS_CERCA;
  useEffect(() => setEscalaElegida(null), [encuadre]);

  // El mapa de la hoja, del tamaño justo del marco.
  const claveMapa = JSON.stringify([extension, denominador, marco.ancho, marco.alto, reintento]);
  useEffect(() => {
    const control = new AbortController();
    setArmando(true);
    dibujarMapa(visor, marco.ancho, marco.alto, extension, denominador, control.signal)
      .then(m => { setMapa({ clave: claveMapa, impreso: m }); setErrorMapa(null); })
      .catch(e => { if (e.name !== 'AbortError') { setErrorMapa(simple ? 'No pudimos traer el mapa.' : 'No se pudo cargar el mapa de GeoServer.'); setArmando(false); } });
    return () => control.abort();
  }, [visor, marco, extension, denominador, reintento, simple, claveMapa]);

  // Las leyendas de las capas prendidas, de la de más arriba a la de más abajo. Mientras no llegan, la
  // hoja no se arma ni se puede descargar (saldría sin leyenda).
  const claveLeyendas = `${simple}|${reintento}`;
  useEffect(() => {
    let vigente = true;
    const nombres = [...capasVisibles(visor)].reverse();
    // Las obras sin ninguna cargada no van a la leyenda (explicaría algo que no está en el mapa).
    hayObras().then(hay => Promise.all(nombres.filter(n => n !== 'obras_rn11' || hay).map(n => leyendaDe(n, simple)))).then(ls => {
      if (!vigente) return;
      setLeyendas({ clave: claveLeyendas, lista: ls.filter((l): l is Leyenda => !!l) });
      // Una leyenda que no llegó es un error: la hoja saldría incompleta.
      setErrorLeyenda(ls.some(l => !l) ? simple ? 'No pudimos traer qué significa cada color.' : 'No se pudo cargar la leyenda de GeoServer.' : null);
    });
    return () => { vigente = false; };
  }, [visor, simple, reintento, claveLeyendas]);

  // En una pregunta, las cosas que se llaman igual ("Escuela Provincial" ×14) se distinguen en la tabla
  // por el pueblo más cercano, como en el panel de resultados.
  // Solo entre cosas de la misma capa: la provincia "Corrientes" no se confunde con la ciudad.
  const [ubicaciones, setUbicaciones] = useState<Map<string, string>>(new Map());
  const [ubicando, setUbicando] = useState(false);
  const [errorUbicaciones, setErrorUbicaciones] = useState<string | null>(null);
  useEffect(() => {
    if (contenido?.tipo !== 'consulta') return;
    const nombrar = simple ? nombreSimple : nombrePro;
    const repetidas = contenido.consulta.capas.flatMap(c => {
      const cuenta = new Map<string, number>();
      for (const e of c.entidades) { const n = nombrar(e.atributos) ?? ''; cuenta.set(n, (cuenta.get(n) ?? 0) + 1); }
      return c.entidades.filter(e => (cuenta.get(nombrar(e.atributos) ?? '') ?? 0) > 1);
    });
    if (!repetidas.length) return;
    const control = new AbortController();
    setUbicando(true);
    setErrorUbicaciones(null);
    ubicarEntidades(repetidas, control.signal)
      .then(setUbicaciones)
      // Sin los pueblos cercanos, las filas de la tabla serían iguales: es error, se avisa y se reintenta.
      .catch(() => !control.signal.aborted && setErrorUbicaciones(simple ? 'No pudimos ubicar los lugares de la respuesta.' : 'No se pudieron ubicar las entidades de la respuesta (WFS).'))
      .finally(() => !control.signal.aborted && setUbicando(false));
    return () => { control.abort(); setUbicando(false); };
  }, [contenido, simple, reintento]);

  // El PDF: solo con el mapa y las leyendas de lo que se está eligiendo ahora.
  const mapaVigente = mapa?.clave === claveMapa ? mapa.impreso : null;
  const leyendasVigentes = leyendas?.clave === claveLeyendas ? leyendas.lista : null;
  const claveHoja = JSON.stringify([claveMapa, claveLeyendas, tituloQuieto, descripcionQuieta, autoresQuietos, orientacion, simple, mostrar, contenido?.titulo ?? null, ubicaciones.size, ubicando]);
  useEffect(() => {
    if (!mapaVigente || (mostrar.leyenda && !leyendasVigentes) || ubicando) return;
    let vigente = true;
    const clave = claveHoja;
    setArmando(true);
    generarPdf({
      titulo: tituloQuieto.trim(), descripcion: descripcionQuieta, autores: autoresQuietos.trim(), orientacion, simple, mapa: mapaVigente,
      grilla: mostrar.grilla, norte: mostrar.norte, escalaGrafica: mostrar.escala,
      leyendas: mostrar.leyenda ? leyendasVigentes : null,
      contenido: mostrar.respuesta ? contenido : null,
      ubicaciones,
    })
      .then(async blob => {
        if (!vigente) return;
        const paginas = ((await blob.slice(0, blob.size).text()).match(/\/Type \/Page[^s]/g) ?? []).length || 1;
        setPdf(anterior => { if (anterior) URL.revokeObjectURL(anterior.url); return { url: URL.createObjectURL(blob), blob, paginas, clave }; });
        setArmando(false);
        setErrorPdf(null);
      })
      .catch(() => vigente && setErrorPdf('No se pudo armar el PDF.'));
    return () => { vigente = false; };
  }, [claveHoja, mapaVigente, leyendasVigentes, tituloQuieto, descripcionQuieta, autoresQuietos, orientacion, simple, mostrar, contenido, ubicaciones, ubicando]);

  useEffect(() => () => { setPdf(anterior => { if (anterior) URL.revokeObjectURL(anterior.url); return null; }); }, []);

  // Sin leyenda en la hoja, un error de leyenda no bloquea; sin la respuesta, tampoco uno de cercanías.
  const error = errorMapa ?? (mostrar.leyenda ? errorLeyenda : null) ?? (mostrar.respuesta ? errorUbicaciones : null) ?? errorPdf ?? errorVista;
  // Lo que se descarga tiene que ser lo que se ve: no mientras falten leyendas o cercanías, ni con un
  // texto recién escrito que todavía no llegó a la hoja.
  const textosPendientes = titulo !== tituloQuieto || descripcion !== descripcionQuieta || autores !== autoresQuietos;
  // Generando: se está armando un PDF nuevo (la pastilla "Actualizando…"). Mientras solo se dibuja en
  // pantalla no hace falta la pastilla, pero la descarga igual espera a que termine.
  const generando = armando || !pdf || pdf.clave !== claveHoja || textosPendientes;
  const actualizando = generando || blobDibujado !== pdf?.blob;
  const sinDescarga = !pdf || actualizando || !!error;
  // Por qué no se puede descargar, según el error.
  const motivo = errorMapa
    ? (simple ? 'Primero hay que traer el mapa' : 'Sin mapa no se puede descargar')
    : errorLeyenda && mostrar.leyenda
      ? (simple ? 'Falta qué significa cada color' : 'Sin leyenda no se puede descargar')
      : errorUbicaciones && mostrar.respuesta
        ? (simple ? 'Faltan los lugares de la respuesta' : 'Sin ubicaciones no se puede descargar')
        : errorPdf || errorVista ? (simple ? 'No pudimos armar la hoja' : 'No se pudo armar el PDF') : null;
  const descargar = () => {
    if (!pdf || sinDescarga) return;
    const enlace = document.createElement('a');
    enlace.href = pdf.url;
    enlace.download = nombreArchivo(titulo);
    enlace.click();
  };

  const t = simple
    ? { encabezado: 'Imprimir el mapa', antetitulo: 'Así va a quedar tu hoja', hoja: 'Hoja', horizontal: 'Acostada', vertical: 'Parada', encuadre: 'Qué se ve', vista: 'Lo que estás viendo', chaco: 'Todo el Chaco', escala: 'Qué tan cerca', textos: 'Título', masTextos: 'Más textos', titulo: 'Cómo se llama', descripcion: 'Una frase debajo (si querés)', ejemploDescripcion: 'Ej.: los pueblos cerca de la ruta 11', autores: '¿Quién lo hizo?', mostrar: 'Qué mostrar', leyenda: 'Qué significa cada color', grilla: 'Líneas para ubicarse', norte: 'Flecha del norte', regla: 'Regla de distancias', respuesta: 'La respuesta', descargar: 'Descargar el mapa', ocupado: 'Armando la hoja…', alejar: 'Ver más lejos', acercar: 'Ver más cerca' }
    : { encabezado: 'Exportar a PDF', antetitulo: 'Vista previa en vivo', hoja: 'Orientación', horizontal: 'Horizontal', vertical: 'Vertical', encuadre: 'Encuadre', vista: 'Vista actual', chaco: 'Chaco completo', escala: 'Escala', textos: 'Título', masTextos: 'Descripción y autores', titulo: 'Título del mapa', descripcion: 'Descripción (opcional)', ejemploDescripcion: 'Ej.: localidades a menos de 20 km de la RN11', autores: 'Autores', mostrar: 'Elementos', leyenda: 'Leyenda', grilla: 'Grilla de coordenadas', norte: 'Norte', regla: 'Escala gráfica', respuesta: 'Resultados', descargar: 'Descargar PDF', ocupado: 'Actualizando…', alejar: 'Alejar (escala menor)', acercar: 'Acercar (escala mayor)' };

  const opcionesEncuadre: { valor: Encuadre; titulo: string; icono: React.ReactNode }[] = [
    { valor: 'vista', titulo: t.vista, icono: <Eye size={20} weight="duotone" /> },
    { valor: 'chaco', titulo: t.chaco, icono: <MapTrifold size={20} weight="duotone" /> },
    ...(extensionRuta && ruta ? [{ valor: 'ruta' as const, titulo: ruta.nombre, icono: <span aria-hidden="true"><EscudoRuta numero={ruta.numero} className="h-5 w-auto" /></span> }] : []),
  ];

  return (
    <motion.div
      ref={raiz}
      role="dialog"
      aria-modal={presente ? 'true' : undefined}
      aria-labelledby="imprimir-titulo"
      className="pantalla-escalada fixed inset-0 z-50 grid place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <div className="absolute inset-0 bg-[color-mix(in_srgb,#0b0d0f_52%,transparent)] backdrop-blur-[10px]" onClick={onCerrar} />
      <motion.div
        className="relative grid h-[min(940px,calc(100%-48px))] w-[min(1500px,calc(100%-48px))] grid-cols-[minmax(0,1fr)_392px] overflow-hidden rounded-[28px] bg-[var(--superficie)] shadow-[0_40px_120px_-20px_rgba(0,0,0,.55),0_0_0_1px_color-mix(in_srgb,var(--tinta)_8%,transparent)]"
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={RESORTE_PANEL}
      >
        {/* La mesa: la hoja sobre un fondo punteado, con lo esencial de la hoja arriba a la izquierda. */}
        <div
          className="relative flex min-h-0 flex-col bg-[var(--superficie-2)]"
          style={{ backgroundImage: 'radial-gradient(color-mix(in srgb, var(--tinta) 10%, transparent) 1px, transparent 1.4px)', backgroundSize: '22px 22px' }}
        >
          <div className="flex shrink-0 items-center gap-2 px-6 pt-5 text-[13px] font-medium text-[var(--tinta-2)]">
            <span className="rounded-full bg-[var(--superficie)] px-3 py-1.5 shadow-[0_0_0_1px_var(--linea)]">A4 · {paginaVista === 1 ? (orientacion === 'horizontal' ? t.horizontal : t.vertical) : `${t.vertical} · página ${paginaVista}`}</span>
            <span className="rounded-full bg-[var(--superficie)] px-3 py-1.5 tabular-nums shadow-[0_0_0_1px_var(--linea)]">1:{miles(denominador)}</span>
            {pdf && pdf.paginas > 1 && <span className="rounded-full bg-[var(--superficie)] px-3 py-1.5 shadow-[0_0_0_1px_var(--linea)]">{pdf.paginas} páginas</span>}
          </div>
          <div className="min-h-0 flex-1">
            <VistaPrevia onPagina={setPaginaVista} blob={pdf?.blob ?? null} ocupado={generando} explicacion={simple ? 'Puede que el servidor de mapas no esté andando. Probá de nuevo en un ratito.' : 'Revisá que GeoServer esté andando y volvé a probar.'} error={error} conMiniaturas={!!contenido && mostrar.respuesta} onDibujada={b => { setBlobDibujado(b); if (b) setErrorVista(null); }} onErrorVista={() => setErrorVista(simple ? 'No pudimos mostrar la hoja.' : 'No se pudo mostrar la vista previa del PDF.')} onReintentar={() => { setErrorMapa(null); setErrorLeyenda(null); setErrorPdf(null); setErrorUbicaciones(null); setErrorVista(null); setReintento(r => r + 1); botonDescargar.current?.focus(); }} textoOcupado={t.ocupado} proporcionInicial={orientacion === 'horizontal' ? 210 / 297 : 297 / 210} />
          </div>
        </div>

        {/* Los controles. */}
        <aside className="flex min-h-0 flex-col border-l border-[var(--linea)]">
          <header className="flex items-start gap-3 px-7 pb-5 pt-7">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--vial-texto)]">
                {simple ? <Printer size={14} weight="bold" /> : <FilePdf size={14} weight="bold" />} {t.antetitulo}
              </p>
              <h2 id="imprimir-titulo" className="mt-1.5 text-[28px] font-semibold leading-[1.05] tracking-[-0.03em]">{t.encabezado}</h2>
            </div>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="-mr-2 grid size-10 shrink-0 place-items-center rounded-xl text-[var(--tinta-2)] transition-colors hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-offset-2">
              <X size={20} />
            </button>
          </header>

          <div className="desplazable min-h-0 flex-1 overflow-y-auto px-7 pb-6">
            {/* Orden: lo que más cambia la hoja primero (a 1366 entra sin desplazarse); los textos
                secundarios, después. */}
            <Seccion titulo={t.textos} indice={0}>
              <Campo etiqueta={t.titulo} valor={titulo} onCambiar={setTitulo} referencia={campoTitulo} grande />
            </Seccion>

            <Seccion titulo={t.hoja} indice={1}>
              <div role="radiogroup" aria-label={t.hoja} className="grid grid-cols-2 gap-2.5" onKeyDown={e => recorrer(e, ['horizontal', 'vertical'] as Orientacion[], orientacion, setOrientacion)}>
                {(['horizontal', 'vertical'] as const).map(o => (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={orientacion === o}
                    tabIndex={orientacion === o ? 0 : -1}
                    onClick={() => setOrientacion(o)}
                    className={`flex h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${orientacion === o ? 'border-[var(--tinta)] bg-[var(--superficie-2)] text-[var(--tinta)]' : 'border-[var(--linea)] text-[var(--tinta-2)] hover:bg-[var(--superficie-2)]'}`}
                  >
                    <span className="grid h-[38px] place-items-center"><span className={`block rounded-[3px] border-[1.5px] ${orientacion === o ? 'border-[var(--tinta)] bg-[var(--superficie)]' : 'border-[var(--tinta-3)]'} ${o === 'horizontal' ? 'h-[26px] w-[37px]' : 'h-[37px] w-[26px]'}`} /></span>
                    {o === 'horizontal' ? t.horizontal : t.vertical}
                  </button>
                ))}
              </div>
            </Seccion>

            <Seccion titulo={t.encuadre} indice={2}>
              <div role="radiogroup" aria-label={t.encuadre} className="flex flex-col gap-2" onKeyDown={e => recorrer(e, opcionesEncuadre.map(o => o.valor), encuadre, setEncuadre)}>
                {opcionesEncuadre.map(o => (
                  <button
                    key={o.valor}
                    type="button"
                    role="radio"
                    aria-checked={encuadre === o.valor}
                    tabIndex={encuadre === o.valor ? 0 : -1}
                    onClick={() => setEncuadre(o.valor)}
                    className={`flex min-h-[48px] items-center gap-3 rounded-2xl border px-4 text-left text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${encuadre === o.valor ? 'border-[var(--tinta)] bg-[var(--superficie-2)]' : 'border-[var(--linea)] text-[var(--tinta-2)] hover:bg-[var(--superficie-2)]'}`}
                  >
                    <span className="grid w-6 place-items-center">{o.icono}</span>
                    <span className="flex-1">{o.titulo}</span>
                    <span className={`size-2.5 rounded-full ${encuadre === o.valor ? 'bg-[var(--vial)]' : 'bg-transparent'}`} />
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[var(--superficie-2)] p-1.5">
                <button type="button" onClick={() => puedeAlejar && setEscalaElegida(escalaVecina(denominador, 1))} aria-disabled={!puedeAlejar} aria-label={t.alejar} title={t.alejar} className="grid size-10 place-items-center rounded-xl text-[var(--tinta-2)] transition-colors aria-[disabled=false]:hover:bg-[var(--superficie)] aria-[disabled=false]:hover:text-[var(--tinta)] aria-disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2">
                  <MagnifyingGlassMinus size={19} weight="bold" />
                </button>
                <div className="flex-1 text-center" aria-live="polite">
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--tinta-3)]">{t.escala}</div>
                  <div className="text-[16px] font-semibold tabular-nums">1:{miles(denominador)}</div>
                </div>
                <button type="button" onClick={() => puedeAcercar && setEscalaElegida(escalaVecina(denominador, -1))} aria-disabled={!puedeAcercar} aria-label={t.acercar} title={t.acercar} className="grid size-10 place-items-center rounded-xl text-[var(--tinta-2)] transition-colors aria-[disabled=false]:hover:bg-[var(--superficie)] aria-[disabled=false]:hover:text-[var(--tinta)] aria-disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2">
                  <MagnifyingGlassPlus size={19} weight="bold" />
                </button>
              </div>
            </Seccion>

            <Seccion titulo={t.masTextos} indice={3}>
              <Campo etiqueta={t.descripcion} valor={descripcion} onCambiar={setDescripcion} ejemplo={t.ejemploDescripcion} />
              <Campo etiqueta={t.autores} valor={autores} onCambiar={onAutores} />
            </Seccion>

            <Seccion titulo={t.mostrar} indice={4}>
              <div className="divide-y divide-[var(--linea)]">
                <Opcion titulo={t.leyenda} valor={mostrar.leyenda} onCambiar={v => setMostrar(m => ({ ...m, leyenda: v }))} />
                <Opcion titulo={t.grilla} valor={mostrar.grilla} onCambiar={v => setMostrar(m => ({ ...m, grilla: v }))} />
                <Opcion titulo={t.norte} valor={mostrar.norte} onCambiar={v => setMostrar(m => ({ ...m, norte: v }))} />
                <Opcion titulo={t.regla} valor={mostrar.escala} onCambiar={v => setMostrar(m => ({ ...m, escala: v }))} />
                {contenido && <Opcion titulo={t.respuesta} detalle={contenido.titulo} valor={mostrar.respuesta} onCambiar={v => setMostrar(m => ({ ...m, respuesta: v }))} />}
              </div>
            </Seccion>
          </div>

          <motion.footer
            className="flex flex-col gap-2 border-t border-[var(--linea)] px-7 pb-6 pt-5"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...RESORTE_PANEL, delay: 0.42 }}
          >
            <button
              type="button"
              ref={botonDescargar}
              onClick={descargar}
              aria-disabled={sinDescarga}
              className="group flex h-14 w-full items-center justify-between gap-3 rounded-2xl bg-[var(--vial-fuerte)] pl-5 pr-2 text-white transition-[transform,opacity] duration-200 ease-[var(--ios)] aria-[disabled=false]:hover:scale-[1.01] aria-[disabled=false]:active:scale-[0.99] aria-disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="text-left">
                <span className="block text-[16px] font-semibold leading-tight">{t.descargar}</span>
                <span className="block text-[12.5px] font-medium leading-tight text-white tabular-nums">
                  {motivo ?? (actualizando ? t.ocupado : pdf ? `A4 · ${pdf.paginas} ${pdf.paginas === 1 ? 'página' : 'páginas'} · ${peso(pdf.blob.size)}` : t.ocupado)}
                </span>
              </span>
              <span className="grid size-10 place-items-center rounded-xl bg-white/15 transition-transform duration-300 ease-[var(--ios)] group-aria-[disabled=false]:group-hover:translate-y-0.5">
                <ArrowDown size={19} weight="bold" />
              </span>
            </button>
          </motion.footer>
        </aside>
      </motion.div>
    </motion.div>
  );
}

// Las secciones entran en cascada (cada una 50 ms después de la anterior), mientras la hoja se dibuja.
function Seccion({ titulo, children, indice = 0 }: { titulo: string; children: React.ReactNode; indice?: number }) {
  return (
    <motion.section
      className="border-t border-[var(--linea)] py-5 first:border-t-0 first:pt-1"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...RESORTE_PANEL, delay: 0.14 + indice * 0.05 }}
    >
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--tinta-3)]">{titulo}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </motion.section>
  );
}

function Campo({ etiqueta, valor, onCambiar, ejemplo, grande, referencia }: { etiqueta: string; valor: string; onCambiar: (v: string) => void; ejemplo?: string; grande?: boolean; referencia?: React.Ref<HTMLInputElement> }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-[var(--tinta-2)]">{etiqueta}</span>
      <input
        ref={referencia}
        value={valor}
        onChange={e => onCambiar(e.target.value)}
        placeholder={ejemplo}
        maxLength={grande ? 80 : 120}
        className={`rounded-xl border border-[var(--linea)] bg-[var(--superficie-2)] px-3.5 text-[var(--tinta)] outline-none transition-colors placeholder:text-[var(--tinta-3)] focus:border-[var(--vial)] focus:bg-[var(--superficie)] ${grande ? 'h-12 text-[17px] font-semibold tracking-[-0.01em]' : 'h-11 text-[15px] font-medium'}`}
      />
    </label>
  );
}

function Opcion({ titulo, detalle, valor, onCambiar }: { titulo: string; detalle?: string; valor: boolean; onCambiar: (v: boolean) => void }) {
  return (
    <Switch isSelected={valor} onChange={onCambiar} className="w-full">
      <Switch.Content className="flex min-h-[48px] w-full cursor-pointer items-center justify-between gap-4 py-2">
        <span className="min-w-0">
          <span className="block text-[15px] font-medium">{titulo}</span>
          {detalle && <span className="block truncate text-[13px] text-[var(--tinta-3)]">{detalle}</span>}
        </span>
        <Switch.Control><Switch.Thumb /></Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

// Grupo de opciones con flechas (como un grupo de radios nativo): una sola parada de Tab y las flechas
// eligen la anterior o la siguiente, llevando el foco con ellas.
function recorrer<T>(e: React.KeyboardEvent<HTMLElement>, valores: T[], actual: T, elegir: (v: T) => void) {
  const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (!paso) return;
  e.preventDefault();
  const i = (valores.indexOf(actual) + paso + valores.length) % valores.length;
  elegir(valores[i]);
  const botones = e.currentTarget.querySelectorAll<HTMLElement>('[role=radio]');
  requestAnimationFrame(() => botones[i]?.focus());
}
