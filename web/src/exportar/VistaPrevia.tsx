// El escenario de la impresión: la hoja del PDF real (dibujada con pdf.js) apoyada sobre una mesa,
// tan grande como entre. Si hay más de una página, abajo van sus miniaturas para pasar de una a otra.
// Mientras el PDF se rehace queda la imagen anterior (no parpadea) y una pastilla avisa.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimate, useReducedMotion } from 'motion/react';
import { Spinner } from '@heroui/react';
import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import trabajador from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { RESORTE_PANEL } from '../movimiento';

GlobalWorkerOptions.workerSrc = trabajador;

interface Props {
  blob: Blob | null;
  ocupado: boolean;
  error: string | null;
  textoOcupado: string;
  // Debajo del error: qué hacer (en el modo simple, sin jerga).
  explicacion?: string;
  onReintentar?: () => void;
  // Otra salida en vez de "Reintentar" (p. ej. "Ver más cerca" cuando la mancha tiene demasiados puntos).
  accion?: { texto: string; icono: React.ReactNode; alElegir: () => void } | null;
  // Avisa qué página se está viendo (la pastilla de arriba dice su orientación).
  onPagina?: (pagina: number) => void;
  // Avisa qué PDF terminó de dibujarse (la descarga espera a que se vea) y si pdf.js no pudo.
  // null: empezó a dibujarse (la descarga espera); un blob: ese PDF ya se ve entero.
  onDibujada?: (blob: Blob | null) => void;
  // Si la hoja va a tener más de una página: el lugar de las miniaturas se reserva desde el principio
  // (si aparecía después, la hoja se achicaba a mitad del dibujo de entrada y el dibujo se reiniciaba).
  conMiniaturas?: boolean;
  onErrorVista?: () => void;
  // Proporción alto/ancho de la primera hoja: se usa antes de que llegue el primer PDF.
  proporcionInicial: number;
}

const ALTO_MINIATURAS = 112;

// Dibuja una página en un lienzo nuevo de `ancho` píxeles de dispositivo, al triple: después se
// reduce con suavizado de calidad. Dibujada al tamaño justo (o al doble y reducida por el navegador),
// la letra chica de las leyendas (imágenes de 192 ppp muy achicadas) perdía trazos.
async function dibujar(doc: PDFDocumentProxy, numero: number, ancho: number) {
  const hoja = await doc.getPage(numero);
  const base = hoja.getViewport({ scale: 1 });
  // Al triple en hojas chicas; en las grandes (la tele) al doble alcanza y alivia la animación.
  const vista = hoja.getViewport({ scale: Math.min((ancho > 1500 ? 2 : 3) * ancho, 4200) / base.width });
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(vista.width);
  lienzo.height = Math.round(vista.height);
  await hoja.render({ canvas: lienzo, canvasContext: lienzo.getContext('2d')!, viewport: vista }).promise;
  return { lienzo, proporcion: base.height / base.width };
}

export default function VistaPrevia({ blob, ocupado, error, textoOcupado, explicacion, onReintentar, accion, onPagina, onDibujada, onErrorVista, conMiniaturas, proporcionInicial }: Props) {
  const mesa = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const actual = useRef<PDFDocumentProxy | null>(null);
  // El blob del documento abierto (para avisar cuál se dibujó).
  const blobDelDocumento = useRef<Blob | null>(null);
  const [documento, setDocumento] = useState<PDFDocumentProxy | null>(null);
  const [pagina, setPagina] = useState(1);
  // La proporción de la hoja que se dibujó por última vez (para no mostrarla deformada en otra forma).
  const [proporcionDibujada, setProporcionDibujada] = useState(0);
  const [lugar, setLugar] = useState({ ancho: 0, alto: 0 });
  const [dibujada, setDibujada] = useState(false);
  const [miniaturas, setMiniaturas] = useState<string[]>([]);
  useEffect(() => onPagina?.(pagina), [pagina, onPagina]);

  // --- Transiciones: la hoja "se dibuja" ---
  // La primera vez, al cambiar de página y al girar la hoja, la página no aparece de golpe: primero se
  // traza en lápiz (la misma página en grises) con una línea que la recorre de arriba abajo, y detrás
  // pasa una segunda línea, naranja, que la llena de color. Al cambiar de página la anterior sale como
  // una hoja que se da vuelta. Con "reducir movimiento" (del sistema o de Configuración), un fundido.
  const [alcance, animar] = useAnimate();
  const boceto = useRef<HTMLCanvasElement>(null);
  const hoja = useRef<HTMLDivElement>(null);
  const reducidoSistema = useReducedMotion();
  const reducido = () => !!reducidoSistema || document.documentElement.dataset.movimiento === 'reducido';
  const pendienteDibujo = useRef(true);
  // El dibujo animado en curso: cualquier otro aviso de "lista" lo espera.
  const dibujoEnCurso = useRef<Promise<unknown> | null>(null);
  const [saliente, setSaliente] = useState<{ src: string; ancho: number; alto: number; sentido: 1 | -1; clave: number } | null>(null);

  const cambiarPagina = (nueva: number) => {
    if (nueva === pagina) return;
    // La página que se va, como imagen, para que salga dándose vuelta.
    if (lienzo.current && dibujada && !reducido()) {
      const r = hoja.current!.getBoundingClientRect();
      const zoom = (hoja.current as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom || 1;
      setSaliente({ src: lienzo.current.toDataURL('image/jpeg', 0.82), ancho: r.width / zoom, alto: r.height / zoom, sentido: nueva > pagina ? 1 : -1, clave: Date.now() });
    }
    pendienteDibujo.current = true;
    // En el mismo instante del clic: mientras la página se da vuelta y se dibuja, no se descarga.
    onDibujada?.(null);
    setPagina(nueva);
  };

  // Al girar la hoja: un giro corto sobre la mesa y se vuelve a dibujar.
  const orientacionPrevia = useRef(proporcionInicial);
  useEffect(() => {
    if (orientacionPrevia.current === proporcionInicial) return;
    const sentido = proporcionInicial > orientacionPrevia.current ? 1 : -1;
    orientacionPrevia.current = proporcionInicial;
    if (pagina !== 1) return;
    pendienteDibujo.current = true;
    onDibujada?.(null);
    if (!reducido() && hoja.current) animar(hoja.current, { rotate: [sentido * -9, 0], scale: [0.95, 1] }, { type: 'spring', stiffness: 170, damping: 19 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proporcionInicial]);

  // La forma de la hoja: la primera página, según la orientación elegida (cambia enseguida, con un
  // resorte, antes de que llegue el PDF nuevo); las de la respuesta, siempre verticales.
  const proporcion = pagina === 1 ? proporcionInicial : 297 / 210;

  // El lugar disponible en la mesa (cambia con la ventana y con la tira de miniaturas).
  useLayoutEffect(() => {
    const medir = () => {
      const r = mesa.current!.getBoundingClientRect();
      const zoom = (mesa.current as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom || 1;
      setLugar({ ancho: r.width / zoom, alto: r.height / zoom });
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(mesa.current!);
    return () => observador.disconnect();
  }, []);

  // Cada PDF nuevo se abre; el anterior se libera cuando el nuevo ya está listo.
  useEffect(() => {
    if (!blob) return;
    let vigente = true;
    blob.arrayBuffer()
      .then(datos => getDocument({ data: new Uint8Array(datos) }).promise)
      .then(doc => {
        if (!vigente) { doc.loadingTask.destroy(); return; }
        const anterior = actual.current;
        actual.current = doc;
        blobDelDocumento.current = blob;
        setDocumento(doc);
        setPagina(p => Math.min(p, doc.numPages));
        anterior?.loadingTask.destroy();
      })
      .catch(() => vigente && onErrorVista?.());
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);
  useEffect(() => () => { actual.current?.loadingTask.destroy(); }, []);

  // Tamaño de la hoja: la proporción de la página a la vista, tan grande como entre (con aire).
  const margen = 32;
  const anchoHoja = Math.max(0, Math.min(lugar.ancho - 2 * margen, (lugar.alto - 2 * margen) / proporcion));
  const altoHoja = anchoHoja * proporcion;

  // La página elegida, en un lienzo aparte que recién al final pasa al visible.
  useEffect(() => {
    if (!documento || anchoHoja < 10) return;
    let cancelado = false;
    let aviso: ReturnType<typeof setTimeout> | undefined;
    // Píxeles de dispositivo de la hoja: su ancho en CSS por el zoom de la ventana y la densidad del monitor.
    const zoom = (mesa.current as (HTMLElement & { currentCSSZoom?: number }) | null)?.currentCSSZoom || 1;
    const dispositivo = Math.round(anchoHoja * zoom * (window.devicePixelRatio || 1));
    dibujar(documento, pagina, dispositivo).then(({ lienzo: aparte, proporcion: p }) => {
      if (cancelado || !lienzo.current) return;
      // Es el PDF de antes, en la otra orientación: no se dibuja deformado, se espera al nuevo.
      if (Math.abs(p - proporcion) > 0.01) return;
      lienzo.current.width = dispositivo;
      lienzo.current.height = Math.round(dispositivo * p);
      const ctx = lienzo.current.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Reducción en pasos de a la mitad como mucho: cada paso promedia bien los trazos finos.
      let fuente: HTMLCanvasElement = aparte;
      while (fuente.width / 2 > dispositivo) {
        const medio = document.createElement('canvas');
        medio.width = Math.round(fuente.width / 2); medio.height = Math.round(fuente.height / 2);
        const m = medio.getContext('2d')!; m.imageSmoothingQuality = 'high';
        m.drawImage(fuente, 0, 0, medio.width, medio.height);
        fuente = medio;
      }
      ctx.drawImage(fuente, 0, 0, lienzo.current.width, lienzo.current.height);
      lienzo.current.dataset.pagina = String(pagina);
      const visible = lienzo.current;
      // Lista: la hoja nueva ya se ve entera. Recién ahí se avisa (la descarga espera) y sube la versión
      // (la batería de verificación la usa para saber que la vista previa se rehízo).
      const lista = () => {
        if (cancelado) return;
        visible.dataset.version = String(Number(visible.dataset.version ?? 0) + 1);
        const dibujado = blobDelDocumento.current;
        if (dibujado) onDibujada?.(dibujado);
      };
      const conDibujo = pendienteDibujo.current && !reducido() && boceto.current;
      pendienteDibujo.current = false;
      setDibujada(true);
      setProporcionDibujada(p);
      if (!conDibujo) {
        // Si hay un dibujo animado en curso (se reinició por un cambio de tamaño), se espera a que termine.
        const previo = dibujoEnCurso.current ?? Promise.resolve();
        previo.then(() => { if (!cancelado) aviso = setTimeout(lista, 220); });
        return;
      }
      onDibujada?.(null);
      // Al pasar de página, la nueva se empieza a dibujar cuando la anterior ya se dio vuelta.
      const demora = saliente ? 0.34 : 0;
      // El boceto en lápiz: la misma página en grises, con más contraste.
      const lapiz = boceto.current!;
      lapiz.width = visible.width; lapiz.height = visible.height;
      const b = lapiz.getContext('2d')!;
      b.filter = 'grayscale(1) contrast(1.45) brightness(1.07)';
      b.drawImage(visible, 0, 0);
      // Arranca tapado (el color y el lápiz) y se descubre de arriba abajo.
      visible.style.clipPath = 'inset(0% 0% 100% 0%)';
      lapiz.style.clipPath = 'inset(0% 0% 100% 0%)';
      lapiz.style.opacity = '1';
      const trazo = [0.65, 0, 0.35, 1] as const;
      const relleno = [0.33, 1, 0.68, 1] as const;
      const animacion = Promise.all([
        animar(lapiz, { clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 0.75, ease: trazo, delay: demora }),
        animar('[data-linea="lapiz"]', { top: ['0%', '100%'], opacity: [0, 1, 1, 0] }, { duration: 0.75, ease: trazo, delay: demora, times: [0, 0.08, 0.9, 1] }),
        animar(visible, { clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 0.85, ease: relleno, delay: demora + 0.38 }),
        animar('[data-linea="color"]', { top: ['0%', '100%'], opacity: [0, 1, 1, 0] }, { duration: 0.85, ease: relleno, delay: demora + 0.38, times: [0, 0.08, 0.9, 1] }),
      ]);
      dibujoEnCurso.current = animacion;
      animacion.then(() => {
        if (dibujoEnCurso.current === animacion) dibujoEnCurso.current = null;
        lapiz.style.opacity = '0';
        visible.style.clipPath = '';
        lista();
      }).catch(() => { if (dibujoEnCurso.current === animacion) dibujoEnCurso.current = null; visible.style.clipPath = ''; lista(); });
    }).catch(() => !cancelado && onErrorVista?.());
    return () => { cancelado = true; clearTimeout(aviso); };
  }, [documento, pagina, anchoHoja, proporcion]);

  // Miniaturas de todas las páginas (solo si hay más de una).
  useEffect(() => {
    if (!documento || documento.numPages < 2) { setMiniaturas([]); return; }
    let cancelado = false;
    Promise.all(Array.from({ length: documento.numPages }, (_, i) => dibujar(documento, i + 1, 120)))
      .then(ls => !cancelado && setMiniaturas(ls.map(l => l.lienzo.toDataURL('image/png'))))
      .catch(() => {});
    return () => { cancelado = true; };
  }, [documento]);

  const total = documento?.numPages ?? 1;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={mesa} className="relative grid min-h-0 flex-1 place-items-center" style={{ perspective: 1800 }}>
        {/* La página que se va al cambiar de página: se da vuelta hacia el costado y se desvanece. */}
        <AnimatePresence>
          {saliente && (
            <motion.img
              key={saliente.clave}
              src={saliente.src}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute z-[2] bg-white shadow-[0_30px_60px_-20px_rgba(0,0,0,.4)]"
              // Se da vuelta desde el lomo, como una página: opaca, y al pasar los 90° su dorso no se ve.
              style={{ width: saliente.ancho, height: saliente.alto, transformOrigin: saliente.sentido > 0 ? 'left center' : 'right center', backfaceVisibility: 'hidden' }}
              initial={{ rotateY: 0, opacity: 1 }}
              animate={{ rotateY: saliente.sentido * -105, opacity: [1, 1, 0] }}
              transition={{ duration: 0.55, ease: [0.45, 0, 0.7, 0.3], opacity: { duration: 0.55, times: [0, 0.75, 1] } }}
              onAnimationComplete={() => setSaliente(null)}
            />
          )}
        </AnimatePresence>
        <motion.div
          ref={alcance}
          className="relative bg-white"
          style={{ boxShadow: '0 1px 1px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.06), 0 18px 40px -12px rgba(0,0,0,.35), 0 40px 80px -24px rgba(0,0,0,.25)', transformStyle: 'preserve-3d' }}
          // Entrada: la hoja se apoya en la mesa (viene inclinada, de un poco más abajo y más chica).
          initial={{ opacity: 0, y: 46, rotateX: 22, scale: 0.92 }}
          animate={{ width: anchoHoja, height: altoHoja, opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={{ ...RESORTE_PANEL, rotateX: { type: 'spring', stiffness: 110, damping: 17 }, y: { type: 'spring', stiffness: 140, damping: 19 }, opacity: { duration: 0.35 } }}
        >
          <div ref={hoja} className="absolute inset-0">
          {/* El boceto en lápiz (debajo del color mientras se dibuja) y las dos líneas de trazado. */}
          <canvas ref={boceto} aria-hidden="true" className="absolute inset-0 size-full object-contain opacity-0" />
          <canvas
            ref={lienzo}
            role="img"
            aria-label={`Vista previa de la página ${pagina} de ${total}`}
            className={`absolute inset-0 size-full object-contain transition-opacity duration-200 ${dibujada && Math.abs(proporcionDibujada - proporcion) < 0.01 ? 'opacity-100' : 'opacity-0'}`}
          />
          <span data-linea="lapiz" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[#15171a]/55 opacity-0 shadow-[0_0_0_0.5px_rgba(21,23,26,.15)]" />
          <span data-linea="color" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[var(--vial)] opacity-0 shadow-[0_0_14px_3px_color-mix(in_srgb,var(--vial)_55%,transparent)]" />
          {(!dibujada || Math.abs(proporcionDibujada - proporcion) >= 0.01) && !error && <div className="absolute inset-0 animate-pulse bg-[#f3f4f1]" />}
          {/* Error: un aviso centrado sobre la hoja, con la salida a mano. */}
          {error && (
            <div role="alert" className="absolute inset-0 grid place-items-center bg-white/85 backdrop-blur-[2px]">
              <div className="flex max-w-[360px] flex-col items-center gap-3 px-6 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-[var(--danger)]/10 text-[var(--danger)]"><WarningCircle size={26} weight="bold" /></span>
                <p className="text-[17px] font-semibold leading-snug text-[#15171a]">{error}</p>
                {explicacion && <p className="text-[14px] leading-snug text-[#5e646b]">{explicacion}</p>}
                {accion ? (
                  <button type="button" onClick={accion.alElegir} className="mt-1 flex h-11 items-center gap-2 rounded-full bg-[#15171a] px-5 text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171a]">
                    {accion.icono} {accion.texto}
                  </button>
                ) : onReintentar && (
                  <button type="button" onClick={onReintentar} className="mt-1 flex h-11 items-center gap-2 rounded-full bg-[#15171a] px-5 text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171a]">
                    <ArrowClockwise size={17} weight="bold" /> Reintentar
                  </button>
                )}
              </div>
            </div>
          )}
          </div>
        </motion.div>

        <AnimatePresence>
          {ocupado && !error && (
            <motion.span
              key="estado"
              role="status"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={RESORTE_PANEL}
              className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-[var(--superficie)] px-3.5 py-2 text-[13px] font-medium shadow-[var(--sombra)]"
            >
              <Spinner size="sm" /> {textoOcupado}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {(total > 1 || conMiniaturas) && (
        <nav aria-label="Páginas" className="flex shrink-0 items-end justify-center gap-4 pb-5" style={{ height: ALTO_MINIATURAS }}>
          {Array.from({ length: total }, (_, i) => (
            <motion.button
              key={i}
              type="button"
              // Entran en cascada, desde abajo.
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...RESORTE_PANEL, delay: 0.08 + i * 0.06 }}
              onClick={() => cambiarPagina(i + 1)}
              aria-current={pagina === i + 1 ? 'page' : undefined}
              aria-label={`Página ${i + 1}`}
              className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
            >
              <span className={`block overflow-hidden rounded-[3px] bg-white shadow-[0_1px_3px_rgba(0,0,0,.18)] ring-offset-2 ring-offset-[var(--superficie-2)] transition-all duration-200 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-[5px] group-focus-visible:outline-dashed group-focus-visible:outline-[var(--tinta)] ${pagina === i + 1 ? 'ring-2 ring-[var(--vial)]' : 'opacity-70 group-hover:opacity-100'}`}>
                {miniaturas[i] ? <img src={miniaturas[i]} alt="" className="block h-[64px] w-auto" /> : <span className="block h-[64px] w-[46px] animate-pulse bg-[#f3f4f1]" />}
              </span>
              <span className={`text-[12px] font-medium tabular-nums ${pagina === i + 1 ? 'text-[var(--tinta)]' : 'text-[var(--tinta-3)]'}`}>{i + 1}</span>
            </motion.button>
          ))}
        </nav>
      )}
    </div>
  );
}
