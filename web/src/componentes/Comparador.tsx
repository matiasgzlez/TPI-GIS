// Comparador deslizante (T6): una cortina divide el mapa en dos. A la izquierda, el mapa de siempre (las capas
// prendidas: el panel de capas lo sigue cambiando, y las consultas, el calor y la tabla andan igual); a la
// derecha, otro juego de capas. Abre con el atajo "Natural vs. Humano" y la cortina entra desde la derecha
// hasta el medio. Al cerrar, el mapa vuelve a las capas que tenía antes de abrirla.
//
// La cortina se mueve arrastrando la manija (o la línea) y con el teclado. Arriba, sobre la línea, el nombre
// de cada lado: tocándolo se elige qué mostrar de ese lado (pares listos, juegos y, en el profesional, capa
// por capa). Todo se mide en píxeles de pantalla (el mapa no tiene zoom) y se dibuja dividido por la escala
// de la interfaz (.interfaz sí tiene zoom).
import { useEffect, useId, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { AnimatePresence, animate, motion, useIsPresent } from 'motion/react';
import { ArrowsLeftRight, CaretDown, CaretLeft, CaretRight, Check, X } from '@phosphor-icons/react';
import { GRUPOS } from '../config';
import { JUEGOS_PROPIOS, PARES, juegoPorId, juegos, nombreLado, tituloJuego } from '../comparador';
import { capaSimple, escribiendoEn, hayDialogoModal, useInterfaz } from '../interfaz';
import { escalaActual, movimientoReducido } from '../preferencias';
import { RESORTE_PANEL } from '../movimiento';
import { areaLibre, cambiarCalor, cambiarCapas, capasDerecha, capasVisibles, moverCorte, ponerCapas, ponerComparacion, suscribirCapas, type Visor } from '../visor';

type Lado = 'izq' | 'der';

interface Props {
  visor: Visor;
  // Hay un panel abierto a la derecha (resultados o tablero): la cortina no se mete debajo.
  conPanel: boolean;
  // Cambia cuando la interfaz tapa otros bordes del mapa (modo, paneles plegados, tabla): se vuelve a medir.
  disposicion: string;
  onCerrar: () => void;
}

export default function Comparador({ visor, conPanel, disposicion, onCerrar }: Props) {
  const interfaz = useInterfaz();
  const simple = interfaz === 'simple';
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);
  // Las capas de antes de abrir: "Lo que estabas viendo", y adonde vuelve el mapa al cerrar.
  const antes = useRef<{ capas: string[]; calor: string[] }>({ capas: [], calor: [] });
  const [fraccion, setFraccion] = useState(1);
  const [area, setArea] = useState(() => areaLibre(visor, conPanel));
  const [abierto, setAbierto] = useState<Lado | null>(null);
  // Cada apertura monta una lista nueva (con su foco): si no, volver rápido a un lado revivía la lista que
  // estaba saliendo y el foco se quedaba en el nombre.
  const [apertura, setApertura] = useState(0);
  // Sin ninguna lista abierta, la tabla vuelve a su alto y los controles del mapa se ven (también al cerrar).
  const limpiarListas = () => {
    const interfazEl = document.querySelector<HTMLElement>('.interfaz');
    interfazEl?.style.removeProperty('--reserva-comparador');
    delete interfazEl?.dataset.listaSinLugar;
  };
  // Recién cuando terminó de salir la última lista (onExitComplete) y no se abrió otra: con una pausa fija,
  // una lista abierta mientras la tabla todavía volvía a su alto quedaba sin lugar.
  const abiertoActualRef = useRef(abierto);
  abiertoActualRef.current = abierto;
  useEffect(() => limpiarListas, []);
  const alternarLista = (lado: Lado) => {
    setApertura(n => n + 1);
    setAbierto(a => (a === lado ? null : lado));
  };
  const [arrastrando, setArrastrando] = useState(false);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  const raiz = useRef<HTMLDivElement>(null);
  const manija = useRef<HTMLDivElement>(null);
  const chipIzq = useRef<HTMLButtonElement>(null);
  const chipDer = useRef<HTMLButtonElement>(null);
  const fila = useRef<HTMLDivElement>(null);
  const [anchos, setAnchos] = useState({ fila: 0, izq: 0 });
  const animacion = useRef<{ stop: () => void } | null>(null);
  // Mientras la cortina entra (resorte), la fila de los lados espera y aparece cuando llegó: corriendo detrás de
  // la línea se cruzaba un cuadro con lo que encontraba.
  const [entrando, setEntrando] = useState(!movimientoReducido());
  // El foco va a la manija al abrir; si en ese momento estaba oculta (compacta, mientras entra), cuando aparece.
  const enfocarManija = useRef(false);

  const ancho = () => visor.mapa.getSize()?.[0] ?? window.innerWidth;
  // Media manija (26 px de diseño) de margen: en los bordes no se mete debajo de un panel.
  // Hasta dónde puede ir la línea (píxeles de pantalla), según lo que hay alrededor de la manija: el lugar
  // libre y, si un panel está a la altura de la manija, hasta su borde. Lo calcula el render.
  const rango = useRef<[number, number] | null>(null);
  const limitar = (f: number, a = area) => {
    const m = 26 * escalaActual();
    const [desde, hasta] = rango.current ?? [a[0] + m, a[2] - m];
    return Math.min(hasta / ancho(), Math.max(desde / ancho(), f));
  };
  // Las capas de antes, con sus manchas de calor (que ponerCapas no repone).
  const restaurarAntes = () => {
    ponerCapas(visor, antes.current.capas);
    antes.current.calor.forEach(n => cambiarCalor(visor, n, true));
  };
  // `pedida`: dónde la puso el usuario (o la entrada). Los límites pasajeros (una tabla que se acomoda) acotan
  // lo que se dibuja, pero no la pisan: cuando vuelve el lugar, la cortina vuelve a donde estaba.
  const pedida = useRef(1);
  const mover = (f: number) => {
    setFraccion(f);
    moverCorte(visor, f);
  };
  const pedir = (f: number) => {
    pedida.current = f;
    mover(limitar(f));
  };

  // Al abrir: Natural a la izquierda (el mapa) y Humano a la derecha; la cortina entra desde el borde
  // derecho hasta el medio del lugar libre. Al cerrar: sin cortina y con las capas (y manchas) de antes.
  useEffect(() => {
    antes.current = { capas: capasVisibles(visor), calor: [...visor.calor.keys()] };
    const origen = document.activeElement as HTMLElement | null;
    const a = areaLibre(visor, conPanel);
    const medio = (a[0] + a[2]) / 2 / ancho();
    const desde = movimientoReducido() ? medio : a[2] / ancho();
    ponerCapas(visor, juegoPorId('natural').capas);
    ponerComparacion(visor, { derecha: juegoPorId('humano').capas, fraccion: desde, titulos: ['', ''] });
    setFraccion(desde);
    pedida.current = desde;
    if (!movimientoReducido()) {
      animacion.current = animate(desde, medio, { type: 'spring', stiffness: 120, damping: 22, mass: 1, onUpdate: v => pedir(v), onComplete: () => { animacion.current = null; setEntrando(false); } });
    }
    // El foco va a la manija: con el teclado se puede mover enseguida.
    requestAnimationFrame(() => manija.current?.focus({ preventScroll: true }));
    enfocarManija.current = true;
    return () => {
      animacion.current?.stop();
      ponerComparacion(visor, null);
      restaurarAntes();
      const adentro = !document.activeElement || document.activeElement === document.body || !!raiz.current?.contains(document.activeElement);
      // Si quien la abrió ya no está (se cambió de modo con la cortina abierta), al botón de comparar del modo actual.
      if (adentro) requestAnimationFrame(() => {
        const destinoFoco = origen?.isConnected ? origen : [...document.querySelectorAll<HTMLElement>('button[aria-label^="Comparar dos"]')].find(b => b.getClientRects().length > 0);
        destinoFoco?.focus({ preventScroll: true });
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visor]);

  // El lugar libre cambia con la ventana y con lo que tapa la interfaz. ponerDisposicion corre en un efecto de
  // App, después de este: se mide en el cuadro siguiente.
  useEffect(() => {
    const medir = () => requestAnimationFrame(() => {
      const a = areaLibre(visor, conPanel);
      setArea(a);
      // Mientras entra, la animación manda.
      if (!animacion.current && visor.comparacion) mover(limitar(pedida.current, a));
    });
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visor, conPanel, disposicion]);

  // Lo que la cortina no puede tapar: todos los paneles a la vista (la barra de capas, el inspector, el panel
  // de la animación de distancia, la tabla, el bloque de zoom y minimapa, la indicación de la herramienta…). Se
  // miden en cada cuadro, porque varios llegan a su lugar con transiciones (la tabla, el zoom que sube con
  // ella, el panel de T5 que entra): con una medida vieja, la manija quedaba encima del minimapa. Solo se
  // vuelve a dibujar si algo se movió.
  const [obstaculos, setObstaculos] = useState<Caja[]>([]);
  const conPanelActual = useRef(conPanel);
  conPanelActual.current = conPanel;
  // useLayoutEffect: la primera medida es antes del primer pintado (si no, el primer cuadro la fila salía encima
  // del panel de T5).
  useLayoutEffect(() => {
    let cuadro = 0;
    let anterior = '';
    // Siempre sincrónico: la posición nueva se dibuja en el mismo cuadro en que se midió (el zoom que baja con
    // la tabla se mueve ~15 px por cuadro; un cuadro tarde, la fila lo pisaba).
    const medir = () => {
      const cajas = medirObstaculos();
      // El lugar libre también, en el mismo cuadro (medido un cuadro tarde, la fila se salía un cuadro).
      const libreAhora = areaLibre(visor, conPanelActual.current);
      const clave = [...cajas.map(c => `${Math.round(c.l)},${Math.round(c.t)},${Math.round(c.r)},${Math.round(c.b)}`), libreAhora.map(Math.round).join(',')].join('|');
      if (clave !== anterior) {
        anterior = clave;
        flushSync(() => { setObstaculos(cajas); setArea(libreAhora); });
      }
    };
    const mirar = () => {
      medir();
      cuadro = requestAnimationFrame(mirar);
    };
    // Un panel que aparece (el de T5) se mide antes de pintarse: si no, el primer cuadro la fila quedaba encima.
    const interfazEl = document.querySelector('.interfaz');
    const cambios = new MutationObserver(() => medir());
    if (interfazEl) cambios.observe(interfazEl, { childList: true, subtree: true });
    // También cuando reaparecen los controles del mapa (al cerrar una lista sin lugar se saca un atributo de
    // .interfaz, no cambia ningún nodo): la fila se había ubicado sin contarlos.
    const atributos = new MutationObserver(() => medir());
    if (interfazEl) atributos.observe(interfazEl, { attributes: true, attributeFilter: ['data-lista-sin-lugar'] });
    mirar();
    return () => { cancelAnimationFrame(cuadro); cambios.disconnect(); atributos.disconnect(); };
  }, []);

  // Cuando cambia lo que tapa la interfaz (la tabla, el inspector, el modo), se mide antes de pintar: un
  // setState en un efecto de layout se dibuja en el mismo cuadro.
  useLayoutEffect(() => {
    setObstaculos(medirObstaculos());
    setArea(areaLibre(visor, conPanel));
  }, [visor, conPanel, disposicion]);

  useEffect(() => {
    if (!enfocarManija.current || !manija.current) return;
    if (document.activeElement === manija.current) { enfocarManija.current = false; return; }
    if (getComputedStyle(manija.current).visibility === 'hidden') return;
    // Solo si nadie movió el foco a otra cosa (sigue en el botón que la abrió o en el body).
    const activo = document.activeElement;
    if (!activo || activo === document.body || /^Comparar dos/.test(activo.getAttribute('aria-label') ?? '')) manija.current.focus({ preventScroll: true });
    enfocarManija.current = false;
  });

  // Los nombres de cada lado.
  const izquierda = capasVisibles(visor);
  const derecha = capasDerecha(visor);
  const nombreIzq = nombreLado(izquierda, antes.current.capas, interfaz);
  const nombreDer = nombreLado(derecha, antes.current.capas, interfaz);
  useEffect(() => {
    if (visor.comparacion) visor.comparacion.titulos = [nombreIzq.titulo, nombreDer.titulo];
  });

  // El ancho de la fila de arriba (para centrar el botón de cambiar de lado sobre la línea). Se mide en cada
  // render, antes de pintar: al pasar a compacta la fila se ensancha, y con un ResizeObserver (un cuadro tarde)
  // se salía del lugar libre ese cuadro.
  useLayoutEffect(() => {
    const fila_ = fila.current?.offsetWidth ?? 0;
    const izq = chipIzq.current?.offsetWidth ?? 0;
    if (fila_ !== anchos.fila || izq !== anchos.izq) setAnchos({ fila: fila_, izq });
  });

  // Esc: primero cierra la lista abierta; si no hay y el foco está en la cortina, la cierra. Con el foco
  // afuera, el Esc general del visor va primero (herramienta, resultados) y cierra la cortina cuando no queda
  // nada adelante (App).
  const abiertoActual = useRef(abierto);
  abiertoActual.current = abierto;
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || hayDialogoModal() || (escribiendoEn(e.target) && !raiz.current?.contains(e.target as Node))) return;
      if (abiertoActual.current) {
        e.stopImmediatePropagation();
        const lado = abiertoActual.current;
        setAbierto(null);
        (lado === 'izq' ? chipIzq : chipDer).current?.focus();
        return;
      }
      if (!raiz.current?.contains(document.activeElement)) return;
      e.stopImmediatePropagation();
      cerrar.current();
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  }, []);

  // Arrastrar la manija o la línea.
  const empezar = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    animacion.current?.stop();
    animacion.current = null;
    setEntrando(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setArrastrando(true);
    setAbierto(null);
  };
  const seguir = (e: React.PointerEvent) => {
    if (!arrastrando) return;
    const caja = visor.mapa.getTargetElement()!.getBoundingClientRect();
    pedir((e.clientX - caja.left) / caja.width);
  };
  const soltar = () => setArrastrando(false);

  const teclas = (e: React.KeyboardEvent) => {
    const libre = (area[2] - area[0] - 52 * escalaActual()) / ancho();
    const pasos: Record<string, number> = { ArrowRight: 0.02, ArrowUp: 0.02, ArrowLeft: -0.02, ArrowDown: -0.02, PageUp: 0.1, PageDown: -0.1 };
    let destino: number | null = null;
    // Las teclas parten de donde se ve la cortina (no de la pedida, si está acotada).
    if (pasos[e.key] !== undefined) destino = fraccion + pasos[e.key] * libre;
    else if (e.key === 'Home') destino = 0;
    else if (e.key === 'End') destino = 1;
    if (destino === null) return;
    e.preventDefault();
    animacion.current?.stop();
    animacion.current = null;
    setEntrando(false);
    pedir(destino);
  };

  // Elegir qué va de cada lado.
  const ponerLado = (lado: Lado, capas: string[]) => {
    if (lado === 'izq') ponerCapas(visor, capas);
    else ponerComparacion(visor, { ...visor.comparacion!, derecha: capas });
  };
  const ponerPar = (izq: string, der: string) => {
    ponerCapas(visor, juegoPorId(izq).capas);
    ponerComparacion(visor, { ...visor.comparacion!, derecha: juegoPorId(der).capas });
  };
  const alternarCapa = (lado: Lado, nombre: string, prender: boolean) => {
    if (lado === 'izq') cambiarCapas(visor, [nombre], prender);
    else ponerLado('der', prender ? [...derecha, nombre] : derecha.filter(n => n !== nombre));
  };
  const intercambiar = () => {
    const izq = izquierda;
    ponerCapas(visor, derecha);
    ponerComparacion(visor, { ...visor.comparacion!, derecha: izq });
  };

  // Si el lugar de la manija se achicó (el bloque de zoom subió a su altura), vuelve adentro, antes de pintar.
  useLayoutEffect(() => {
    if (!visor.comparacion || animacion.current || arrastrando) return;
    const limitada = limitar(fraccion);
    if (Math.abs(limitada - fraccion) > 1e-6) mover(limitada);
  });
  // Cuando cambian los paneles o el lugar libre (y no en cada render: el límite depende de dónde está la línea
  // y oscilaba), la cortina vuelve hacia donde la había puesto el usuario, hasta donde se pueda.
  useLayoutEffect(() => {
    if (!visor.comparacion || animacion.current || arrastrando) return;
    const destino = limitar(pedida.current);
    if (Math.abs(destino - fraccion) > 1e-6) mover(destino);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obstaculos, area]);

  const destino = typeof document !== 'undefined' ? document.querySelector('.interfaz') : null;
  if (!destino) return null;

  // De píxeles de pantalla a las unidades de .interfaz (que tiene zoom).
  const e = escalaActual();
  const x = fraccion * ancho();
  const margen = 26 * e;
  const porcentaje = Math.max(0, Math.min(100, Math.round(((x - area[0] - margen) / Math.max(1, area[2] - area[0] - 2 * margen)) * 100)));
  const GAP = 8 * e;
  const separado = 10 * e;
  const libre: Caja = { l: area[0] + 12 * e, t: area[1] + 12 * e, r: area[2] - 12 * e, b: area[3] - 12 * e };
  const altoFila = 52 * e;
  const anchoFila = anchos.fila * e;
  const izqChip = anchos.izq * e;

  // La fila de los lados: arriba del lugar libre, con el botón de intercambiar sobre la línea; si choca con un
  // panel, se corre lo menos posible (abajo, a la izquierda o a la derecha) sin salir del lugar libre.
  const filaIdeal = { l: x - izqChip - GAP - 20 * e, t: libre.t };
  const filaPos = acomodar({ ...filaIdeal, w: anchoFila, h: altoFila }, obstaculos, libre, separado, true);
  const filaAbajo = filaPos.t + altoFila;
  // La manija: en el medio de lo que queda debajo de la fila. Sin lugar (por ejemplo, la animación de
  // distancia y la tabla agrandada en una notebook), va en la fila misma, entre los dos nombres ("compacta").
  // Lo que hay debajo de la fila en la columna de la manija (una tabla que todavía está saliendo, el zoom)
  // también acota la banda desde abajo.
  const columna = obstaculos.filter(o => o.l < x + margen + separado && o.r > x - margen - separado && o.t > filaAbajo);
  const banda = { t: filaAbajo + 12 * e, b: Math.min(libre.b, ...columna.map(o => o.t - separado)) };
  const compacta = banda.b - banda.t < 64 * e;
  let manijaY: number;
  let desde = area[0] + margen;
  let hasta = area[2] - margen;
  const cruzaEn = (t: number, b: number) => obstaculos.filter(o => o.t < b && o.b > t && o.r > area[0] && o.l < area[2]);
  if (!compacta) {
    manijaY = (banda.t + banda.b) / 2;
    // Los paneles a la altura de la manija limitan la línea (el bloque de zoom que sube con la tabla).
    for (const o of cruzaEn(manijaY - margen - separado, manijaY + margen + separado)) {
      if ((o.l + o.r) / 2 > (area[0] + area[2]) / 2) hasta = Math.min(hasta, o.l - margen - separado);
      else desde = Math.max(desde, o.r + margen + separado);
    }
  } else {
    // Compacta: la manija va en el hueco de la fila, así que la fila sigue a la línea y es la fila la que limita.
    manijaY = filaPos.t + altoFila / 2;
    const antes = izqChip + GAP + margen;
    const despues = anchoFila - antes;
    // Los tramos donde puede estar la línea (la fila va de x - antes a x + despues) sin pisar ningún panel a la
    // altura de la fila: se le restan al lugar libre los tramos prohibidos y se queda con el más cercano a x.
    let tramos: [number, number][] = [[Math.max(desde, libre.l + antes), Math.min(hasta, libre.r - despues)]];
    for (const o of cruzaEn(filaPos.t - separado, filaAbajo + separado)) {
      const [pa, pb] = [o.l - separado - despues, o.r + separado + antes];
      tramos = tramos.flatMap(([a, b]): [number, number][] => {
        const partes: [number, number][] = pb <= a || pa >= b ? [[a, b]] : [[a, Math.min(b, pa)], [Math.max(a, pb), b]];
        return partes.filter(([c, d]) => d > c);
      });
    }
    const distancia = ([a, b]: [number, number]) => (x < a ? a - x : x > b ? x - b : 0);
    const elegido = tramos.sort((p, q) => distancia(p) - distancia(q))[0];
    if (elegido) [desde, hasta] = elegido; else hasta = desde - 1;
  }
  rango.current = desde < hasta ? [desde, hasta] : null;
  // Compacta, la fila sigue a la línea, pero siempre dentro del lugar libre (en el cuadro en que pasa a
  // compacta la línea todavía no se acotó y la fila se salía sobre el inspector).
  // Sin ningún lugar sin cruces (por ejemplo, mientras la tabla se achica al entrar la animación de distancia),
  // la fila se oculta hasta que lo haya, salvo que tenga el foco. En compacta la manija va con ella.
  const conFoco = !!raiz.current?.contains(document.activeElement) && document.activeElement !== manija.current;
  // Con el foco adentro tampoco se muestra encima de un panel: se oculta solo por opacidad (sigue enfocable).
  const filaOculta = filaPos.choca || entrando;
  // En compacta, la fila y la manija usan ya la línea acotada en este mismo render (el acotado de la cortina
  // llega en el render siguiente: ese cuadro la fila pisaba el zoom).
  // La manija (y la fila compacta) siempre dentro de su rango, en este mismo render: en la primera apertura,
  // en frío, el primer cuadro la dibujaba en el borde, sobre el minimapa.
  const xFila = desde < hasta ? Math.min(hasta, Math.max(desde, x)) : x;
  const filaFinal = compacta ? { l: Math.min(libre.r - anchoFila, Math.max(libre.l, xFila - izqChip - GAP - margen)), t: filaPos.t } : filaPos;

  const botonIntercambiar = (
    <button type="button" onClick={intercambiar} aria-label={simple ? 'Dar vuelta los lados' : 'Intercambiar los lados'} title={simple ? 'Dar vuelta los lados' : 'Intercambiar los lados'}
      className="panel grid size-10 shrink-0 place-items-center rounded-full text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)] focus-visible:outline-2">
      <ArrowsLeftRight size={18} weight="bold" />
    </button>
  );

  return createPortal(
    <div ref={raiz} className="comparador" data-arrastrando={arrastrando || undefined}>
      {/* La línea del corte, de arriba abajo (los paneles la tapan). */}
      <div aria-hidden="true" className="comparador-linea pointer-events-none absolute inset-y-0 z-[5]" style={{ left: x / e - 1 }} />
      {/* La línea también se arrastra (una franja angosta, solo en el lugar libre). */}
      <div
        aria-hidden="true"
        className="pointer-events-auto absolute z-[6] w-4 -translate-x-1/2 cursor-ew-resize touch-none"
        style={{ left: x / e, top: area[1] / e, height: (area[3] - area[1]) / e }}
        onPointerDown={empezar} onPointerMove={seguir} onPointerUp={soltar} onPointerCancel={soltar}
      />
      {/* La manija. */}
      <div
        ref={manija}
        role="slider"
        tabIndex={0}
        aria-label={simple ? 'Cortina para comparar' : 'Cortina del comparador'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
        aria-valuetext={`${porcentaje} %: a la izquierda ${nombreIzq.titulo}, a la derecha ${nombreDer.titulo}`}
        aria-orientation="horizontal"
        title={simple ? 'Arrastrá para comparar' : 'Arrastrá o usá las flechas'}
        onPointerDown={empezar} onPointerMove={seguir} onPointerUp={soltar} onPointerCancel={soltar}
        onKeyDown={teclas}
        className={`comparador-manija ${compacta && filaOculta && document.activeElement !== manija.current ? 'invisible' : 'pointer-events-auto'} absolute z-[12] grid size-[52px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4`}
        style={{ left: xFila / e, top: manijaY / e }}
      >
        <span className="flex items-center text-[var(--tinta)]" aria-hidden="true">
          <CaretLeft size={17} weight="bold" /><CaretRight size={17} weight="bold" className="-ml-1" />
        </span>
      </div>

      {/* Arriba: qué hay de cada lado. */}
      <div ref={fila} className={`absolute z-[12] flex items-center gap-2 ${filaOculta ? `opacity-0 pointer-events-none ${conFoco ? '' : 'invisible'}` : 'pointer-events-auto opacity-100 transition-opacity duration-200'}`} style={{ left: filaFinal.l / e, top: filaFinal.t / e }}>
        <ChipLado refBoton={chipIzq} lado="izq" nombre={nombreIzq} abierto={abierto === 'izq'} onPress={() => alternarLista('izq')} simple={simple} />
        {/* Compacta: el hueco de la manija; el botón de intercambiar pasa después del nombre derecho. */}
        {compacta ? <span className="w-[52px] shrink-0" aria-hidden="true" /> : botonIntercambiar}
        <ChipLado refBoton={chipDer} lado="der" nombre={nombreDer} abierto={abierto === 'der'} onPress={() => alternarLista('der')} simple={simple} />
        {compacta && botonIntercambiar}
        <button type="button" onClick={onCerrar} aria-label={simple ? 'Dejar de comparar' : 'Cerrar el comparador (C)'} title={simple ? 'Dejar de comparar' : 'Cerrar el comparador (C)'}
          className="panel grid size-10 shrink-0 place-items-center rounded-full text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)] focus-visible:outline-2">
          <X size={17} weight="bold" />
        </button>
      </div>

      <AnimatePresence onExitComplete={() => { if (!abiertoActualRef.current) limpiarListas(); }}>
        {abierto && (
          <Opciones
            key={`${abierto}-${apertura}`}
            lado={abierto}
            ancla={(abierto === 'izq' ? chipIzq : chipDer).current}
            libre={libre}
            obstaculos={[...obstaculos, ...(manija.current ? [{ ...cajaDe(manija.current.getBoundingClientRect()), control: true }] : [])]}
            fila={fila.current?.getBoundingClientRect() ?? null}
            capas={abierto === 'izq' ? izquierda : derecha}
            antes={antes.current.capas}
            onJuego={capas => (abierto === 'izq' && capas === antes.current.capas ? restaurarAntes() : ponerLado(abierto, capas))}
            onPar={ponerPar}
            onCapa={(n, prender) => alternarCapa(abierto, n, prender)}
            onCerrar={(volver: boolean) => {
              const lado = abierto;
              setAbierto(null);
              if (volver) (lado === 'izq' ? chipIzq : chipDer).current?.focus();
            }}
          />
        )}
      </AnimatePresence>
      <p role="status" className="sr-only">{`A la izquierda: ${nombreIzq.titulo}. A la derecha: ${nombreDer.titulo}.`}</p>
    </div>,
    destino,
  );
}

function ChipLado({ refBoton, lado, nombre, abierto, onPress, simple }: { refBoton: React.RefObject<HTMLButtonElement | null>; lado: Lado; nombre: { titulo: string; color: string }; abierto: boolean; onPress: () => void; simple: boolean }) {
  const lugar = lado === 'izq' ? 'Izquierda' : 'Derecha';
  return (
    <button
      ref={refBoton}
      type="button"
      onClick={onPress}
      aria-expanded={abierto}
      aria-haspopup="dialog"
      aria-label={`${lugar}: ${nombre.titulo}. ${simple ? 'Elegir qué ver de este lado' : 'Cambiar el juego de capas'}`}
      className={`panel flex h-[52px] max-w-[260px] items-center gap-2.5 pl-3 pr-2.5 text-left transition-colors hover:bg-[var(--superficie-2)] focus-visible:outline-2 ${abierto ? 'ring-2 ring-[var(--tinta)]' : ''}`}
    >
      <span className="size-3 shrink-0 rounded-full" style={{ background: nombre.color }} aria-hidden="true" />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tinta-3)]">
          {lado === 'izq' && <CaretLeft size={10} weight="bold" aria-hidden="true" />}{lugar}{lado === 'der' && <CaretRight size={10} weight="bold" aria-hidden="true" />}
        </span>
        <span className="truncate text-[15px] font-semibold leading-tight">{nombre.titulo}</span>
      </span>
      <CaretDown size={14} weight="bold" className={`shrink-0 text-[var(--tinta-3)] transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
  );
}

interface PropsOpciones {
  lado: Lado;
  ancla: HTMLElement | null;
  libre: Caja;
  obstaculos: Caja[];
  fila: DOMRect | null;
  capas: string[];
  antes: string[];
  onJuego: (capas: string[]) => void;
  onPar: (izquierda: string, derecha: string) => void;
  onCapa: (nombre: string, prender: boolean) => void;
  onCerrar: (volverAlBoton: boolean) => void;
}

// Lo que se puede poner de un lado: pares listos, juegos y (profesional) capa por capa.
function Opciones({ lado, ancla, libre, obstaculos, fila, capas, antes, onJuego, onPar, onCapa, onCerrar }: PropsOpciones) {
  const interfaz = useInterfaz();
  const simple = interfaz === 'simple';
  const panel = useRef<HTMLElement>(null);
  const titulo = useId();
  const actual = new Set(capas);
  const lista = juegos(interfaz);
  const elegido = nombreLado(capas, antes, interfaz);
  const [aMedida, setAMedida] = useState(false);
  // Mientras sale (la animación dura ~0,3 s) ya no recibe clics ni foco: un clic rápido sobre el mapa caía
  // en la lista que se iba y cambiaba el lado.
  const presente = useIsPresent();
  // Las escuchas de abajo miran esto: la lista que sale ya no cierra nada (si no, al pasar al otro lado,
  // su onCerrar cerraba la lista nueva).
  const presenteRef = useRef(presente);
  presenteRef.current = presente;

  // Al abrir, el foco va a lo elegido (o a lo primero); un clic afuera o el foco que se va cierran.
  useEffect(() => {
    requestAnimationFrame(() => (panel.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? panel.current?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true }));
    const afuera = (e: PointerEvent) => {
      if (!presenteRef.current) return;
      if (panel.current?.contains(e.target as Node) || ancla?.contains(e.target as Node)) return;
      onCerrar(false);
    };
    // El foco que se va (Tab desde el último ítem, un clic en el buscador) también la cierra.
    const foco = (e: FocusEvent) => {
      if (!presenteRef.current) return;
      if (panel.current?.contains(e.target as Node) || ancla?.contains(e.target as Node)) return;
      onCerrar(false);
    };
    // Tab desde el último ítem saca el foco del documento (no hay focusin): si el foco salió sin destino y no
    // fue por un clic adentro de la lista (en una zona que no toma foco), también se cierra.
    let tocada = 0;
    const tocar = () => { tocada = Date.now(); };
    const salida = (e: FocusEvent) => {
      if (e.relatedTarget) return;
      requestAnimationFrame(() => {
        const activo = document.activeElement;
        if (Date.now() - tocada < 400 || !presenteRef.current) return;
        if (!activo || activo === document.body) onCerrar(false);
      });
    };
    const elemento = panel.current;
    elemento?.addEventListener('pointerdown', tocar);
    elemento?.addEventListener('focusout', salida);
    document.addEventListener('pointerdown', afuera, true);
    document.addEventListener('focusin', foco);
    return () => {
      elemento?.removeEventListener('pointerdown', tocar);
      elemento?.removeEventListener('focusout', salida);
      document.removeEventListener('pointerdown', afuera, true);
      document.removeEventListener('focusin', foco);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dónde va: dentro del lugar libre y sin pisar ningún panel. Se prueban, en píxeles de pantalla, debajo del
  // nombre (alineada a su izquierda o a su derecha) y al costado de la fila; gana la que deja más alto (hasta
  // el primer panel que tenga debajo). Si no entra todo, la lista se desplaza.
  const e = escalaActual();
  const caja = ancla?.getBoundingClientRect();
  const ANCHO = simple ? 360 : 380;
  // Lo que mide el contenido entero (para no preferir un lugar más alto si debajo del nombre ya entra todo).
  const [contenido, setContenido] = useState(0);
  useLayoutEffect(() => { if (panel.current) setContenido(panel.current.scrollHeight); }, [aMedida]);
  const MINIMO = 320 * e;
  // Primero contra todo; si así no hay lugar, sin los controles del mapa (que se ocultan mientras la lista está
  // abierta). Mientras están ocultos no se miden, así que se sigue usando la ubicación sin ellos.
  // Si la lista anterior ya ocultó los controles (al pasar de un lado al otro), esta sigue sin contarlos.
  const sinLugarActual = useRef(document.querySelector('.interfaz')?.hasAttribute('data-lista-sin-lugar') ?? false);
  const conTodo = ubicarLista(lado, caja ?? null, fila, ANCHO * e, libre, obstaculos, 8 * e, contenido || 600 * e);
  const sinControles = ubicarLista(lado, caja ?? null, fila, ANCHO * e, libre, obstaculos.filter(o => !o.control), 8 * e, contenido || 600 * e);
  const sinLugar = sinLugarActual.current || (conTodo.alto < MINIMO - 1 && sinControles.alto > conTodo.alto + 1);
  const { left, top, alto } = sinLugar ? sinControles : conTodo;
  // Ocultar los controles y achicar la tabla lo pone la lista, pero lo saca el Comparador cuando ya no queda
  // ninguna lista abierta (así, al pasar de un lado al otro, la que sale no borra lo que necesita la que entra).
  useLayoutEffect(() => {
    const interfazEl = document.querySelector<HTMLElement>('.interfaz');
    if (!interfazEl || !presente || !sinLugar) return;
    sinLugarActual.current = true;
    interfazEl.dataset.listaSinLugar = '';
  }, [sinLugar, presente]);
  // Si no queda lugar para una lista usable (por ejemplo, la animación de distancia y la tabla del profesional
  // abiertas en una notebook), la tabla se achica mientras haya una lista abierta (--reserva-comparador, que App
  // resta del alto de la tabla).
  const altoActual = useRef(alto);
  altoActual.current = alto;
  const topActual = useRef(top);
  topActual.current = top;
  const libreActual = useRef(libre);
  libreActual.current = libre;
  useEffect(() => {
    if (!presente || !caja) return;
    const interfazEl = document.querySelector<HTMLElement>('.interfaz');
    if (!interfazEl) return;
    // De ida y vuelta, y solo con todo quieto: se mira recién cuando el alto de la lista dio dos lecturas
    // iguales (no al montar, cuando la fila y la lista todavía se acomodan; con una reserva heredada eso la
    // sumaba dos veces). Si falta, se reserva lo que falta, sin dejar la tabla por debajo de su barra de
    // pestañas; si sobra (más de 16 px), se devuelve. Después de cada cambio se espera a que la tabla termine
    // de moverse (0,52 s).
    let ultimo = Number.NaN;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const reservar = () => {
      const a = altoActual.current;
      // Quietos la lista y la tabla (la tabla puede seguir moviéndose por la reserva de la lista anterior).
      const cajaTabla = document.querySelector('section[aria-label^="Tabla de datos:"]')?.getBoundingClientRect();
      const lectura = a * 10_000 + Math.round(cajaTabla?.top ?? 0);
      if (lectura !== ultimo) { ultimo = lectura; espera = setTimeout(reservar, 130); return; }
      const actual = parseFloat(interfazEl.style.getPropertyValue('--reserva-comparador')) || 0;
      const tabla = cajaTabla?.height ?? 0;
      // ¿Lo que acota la lista es el fondo del lugar libre (que sube con la tabla)? Si entre el fondo de la lista
      // y ese fondo queda lugar, la acota otra cosa y la reserva (heredada de la otra lista) sobra en esa medida.
      const holgura = libreActual.current.b - (topActual.current + a);
      let cambio = 0;
      if (MINIMO - a > 1 && holgura < 4) cambio = Math.min(MINIMO - a, Math.max(0, tabla - 56 * e));
      else if (actual > 0 && (a - MINIMO > 16 || holgura > 16)) cambio = -Math.min(actual * e, Math.max(a - MINIMO, holgura - 4));
      if (Math.abs(cambio) > 1) {
        interfazEl.style.setProperty('--reserva-comparador', `${Math.max(0, actual + cambio / e)}px`);
        ultimo = Number.NaN;
        espera = setTimeout(reservar, 520);
      } else espera = setTimeout(reservar, 260);
    };
    espera = setTimeout(reservar, 130);
    return () => clearTimeout(espera);
    // Solo al abrir (y si deja de estar presente, corta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presente, !!caja]);

  return (
    <motion.section
      ref={panel}
      role="dialog"
      aria-labelledby={titulo}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={RESORTE_PANEL}
      inert={!presente}
      className={`panel desplazable absolute z-30 overflow-y-auto shadow-[var(--sombra-alta)] ${presente ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ left: left / e, top: top / e, width: ANCHO, maxHeight: alto / e }}
    >
      <header className="border-b border-[var(--linea)] px-4 pb-3 pt-3.5">
        <h2 id={titulo} className="text-[16px] font-semibold">
          {simple ? `¿Qué querés ver a la ${lado === 'izq' ? 'izquierda' : 'derecha'}?` : `Lado ${lado === 'izq' ? 'izquierdo' : 'derecho'}`}
        </h2>
        <p className="mt-0.5 text-[13px] text-[var(--tinta-3)]">
          {lado === 'izq'
            ? (simple ? 'Es tu mapa: también cambia con «¿Qué querés ver?».' : 'Es el mapa: también lo cambia el panel de capas.')
            : (simple ? 'Lo que ves del otro lado de la cortina.' : 'Un juego de capas aparte, del otro lado del corte.')}
        </p>
      </header>

      <div className="px-2 py-2">
        <h3 className="px-2 pb-1 pt-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--tinta-3)]">{simple ? 'Ideas para comparar' : 'Pares listos'}</h3>
        <div className="flex flex-col gap-1">
          {PARES.map(p => {
            const izq = juegoPorId(p.izquierda);
            const der = juegoPorId(p.derecha);
            return (
              <button key={p.id} type="button" onClick={() => { onPar(p.izquierda, p.derecha); onCerrar(true); }}
                className="flex h-11 items-center gap-2 rounded-xl px-2.5 text-left text-[14.5px] font-medium hover:bg-[var(--superficie-2)] focus-visible:outline-2">
                <span className="size-2.5 rounded-full" style={{ background: izq.color }} aria-hidden="true" />
                {tituloJuego(izq, interfaz)}
                <span className="text-[var(--tinta-3)]">vs.</span>
                <span className="size-2.5 rounded-full" style={{ background: der.color }} aria-hidden="true" />
                {tituloJuego(der, interfaz)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--linea)] px-2 py-2">
        <h3 className="px-2 pb-1 pt-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--tinta-3)]">{simple ? 'Mostrar de este lado' : 'Juegos'}</h3>
        <div className="flex flex-col gap-0.5">
          {antes.length > 0 && (
            <OpcionJuego titulo="Lo que estabas viendo" frase={simple ? 'Lo que había antes de comparar' : `${antes.length} ${antes.length === 1 ? 'capa' : 'capas'} de antes de abrir el comparador`} color="var(--vial)"
              elegido={elegido.titulo === 'Lo que estabas viendo'} onPress={() => { onJuego(antes); onCerrar(true); }} />
          )}
          {lista.map((j, i) => (
            <div key={j.id}>
              {i === JUEGOS_PROPIOS.length && <div className="mx-2 my-1.5 h-px bg-[var(--linea)]" aria-hidden="true" />}
              <OpcionJuego titulo={tituloJuego(j, interfaz)} frase={j.frase} color={j.color} elegido={elegido.juego?.id === j.id} onPress={() => { onJuego(j.capas); onCerrar(true); }} />
            </div>
          ))}
        </div>
      </div>

      {!simple && (
        <div className="border-t border-[var(--linea)] px-2 py-2">
          <button type="button" onClick={() => setAMedida(v => !v)} aria-expanded={aMedida}
            className="flex h-10 w-full items-center justify-between rounded-xl px-2 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--tinta-3)] hover:bg-[var(--superficie-2)] focus-visible:outline-2">
            Capas a medida · {actual.size}
            <CaretDown size={13} weight="bold" className={`transition-transform duration-200 ${aMedida ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {aMedida && (
            <div className="flex flex-col gap-2 pb-1 pt-1">
              {GRUPOS.map(g => (
                <fieldset key={g.id} className="px-2">
                  <legend className="pb-0.5 text-[12.5px] font-semibold text-[var(--tinta-2)]">{g.titulo}</legend>
                  {g.capas.map(c => (
                    <label key={c.nombre} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 text-[13.5px] hover:bg-[var(--superficie-2)]">
                      <input type="checkbox" checked={actual.has(c.nombre)} onChange={ev => onCapa(c.nombre, ev.target.checked)} className="size-4 accent-[var(--tinta)]" />
                      <span className="truncate">{(simple && capaSimple(c.nombre)?.titulo) || c.titulo}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}

function OpcionJuego({ titulo, frase, color, elegido, onPress }: { titulo: string; frase: string; color: string; elegido: boolean; onPress: () => void }) {
  return (
    <button type="button" onClick={onPress} aria-pressed={elegido}
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-2 ${elegido ? 'bg-[var(--superficie-2)]' : 'hover:bg-[var(--superficie-2)]'}`}>
      <span className="size-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14.5px] font-semibold leading-tight">{titulo}</span>
        <span className="truncate text-[12.5px] leading-snug text-[var(--tinta-3)]">{frase}</span>
      </span>
      {elegido && <Check size={16} weight="bold" className="shrink-0" aria-hidden="true" />}
    </button>
  );
}

// `control`: zoom y minimapa (controles del mapa): una lista sin lugar puede ocultarlos mientras está abierta.
interface Caja { l: number; t: number; r: number; b: number; control?: boolean }

// Corre una caja lo menos posible para que no se cruce con ningún obstáculo (con `separado` de aire), sin salir
// de `libre`: prueba abajo del obstáculo y, si `deLado`, a su izquierda y a su derecha. Hasta 8 pasos.
function acomodar(c: { l: number; t: number; w: number; h: number }, obstaculos: Caja[], libre: Caja, separado: number, deLado: boolean) {
  const dentro = (l: number, t: number) => ({ l: Math.min(libre.r - c.w, Math.max(libre.l, l)), t: Math.min(libre.b - c.h, Math.max(libre.t, t)) });
  let pos = dentro(c.l, c.t);
  const choca = (p: { l: number; t: number }) => obstaculos.find(o => o.l < p.l + c.w + separado && o.r > p.l - separado && o.t < p.t + c.h + separado && o.b > p.t - separado);
  for (let i = 0; i < 8; i++) {
    const o = choca(pos);
    if (!o) break;
    const opciones = [{ l: pos.l, t: o.b + separado }];
    if (deLado) opciones.push({ l: o.l - separado - c.w, t: pos.t }, { l: o.r + separado, t: pos.t });
    const validas = opciones
      .filter(p => p.l >= libre.l - 0.5 && p.l + c.w <= libre.r + 0.5 && p.t >= libre.t - 0.5 && p.t + c.h <= libre.b + 0.5)
      .sort((a, b) => Math.hypot(a.l - pos.l, a.t - pos.t) - Math.hypot(b.l - pos.l, b.t - pos.t));
    if (!validas.length) break;
    pos = validas[0];
  }
  return { ...pos, choca: !!choca(pos) };
}

// La lista de un lado, siempre de su lado: debajo de su nombre (la izquierda, alineada por la derecha del nombre
// o por la izquierda; la derecha, al revés) o, si ahí no entra, al costado de la fila hacia su lado. Una candidata
// no sirve si un panel la pisa en su borde de arriba; su alto llega hasta el primer panel que tenga debajo o el
// fondo del lugar libre. Gana la primera en la que entra todo el contenido (o 320 px); si en ninguna, la más alta.
function ubicarLista(lado: 'izq' | 'der', chip: DOMRect | null, fila: DOMRect | null, ancho: number, libre: Caja, obstaculos: Caja[], aire: number, contenido: number) {
  const dentroX = (l: number) => Math.min(libre.r - ancho, Math.max(libre.l, l));
  const candidatas: { l: number; t: number }[] = [];
  if (chip) {
    const porDerecha = { l: dentroX(chip.right - ancho), t: chip.bottom + aire };
    const porIzquierda = { l: dentroX(chip.left), t: chip.bottom + aire };
    candidatas.push(...(lado === 'izq' ? [porDerecha, porIzquierda] : [porIzquierda, porDerecha]));
  }
  if (fila) candidatas.push(lado === 'izq' ? { l: fila.left - aire - ancho, t: fila.top } : { l: fila.right + aire, t: fila.top });
  const suficiente = Math.min(contenido, 320 * (aire / 8));
  let mejor = { left: candidatas[0]?.l ?? libre.l, top: candidatas[0]?.t ?? libre.t, alto: 0 };
  for (const c of candidatas) {
    if (c.l < libre.l - 0.5 || c.l + ancho > libre.r + 0.5) continue;
    const enFranja = obstaculos.filter(o => o.l < c.l + ancho && o.r > c.l);
    if (enFranja.some(o => o.t <= c.t + aire && o.b > c.t - aire)) continue;
    const fondo = Math.min(libre.b, ...enFranja.filter(o => o.t > c.t).map(o => o.t - aire));
    const alto = fondo - c.t;
    if (alto >= suficiente) return { left: c.l, top: c.t, alto };
    if (alto > mejor.alto + 1) mejor = { left: c.l, top: c.t, alto };
  }
  return { ...mejor, alto: Math.max(mejor.alto, 0) };
}

const cajaDe = (r: DOMRect): Caja => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });

// Los paneles a la vista que la cortina no puede tapar (sin filtrar por opacidad: un panel que entra arranca
// transparente; los ocultos de verdad usan visibility).
// Lo que se está moviendo (el zoom que sube con la tabla, la tabla que se achica) se mide en el
// requestAnimationFrame, pero su transición avanza después, en el mismo cuadro: se pintaba unos px más allá de
// lo medido. Por eso cada caja se estira hacia donde se movía en el cuadro anterior.
const ultimas = new WeakMap<Element, { t: number; caja: Caja; previa?: Caja }>();
function medirObstaculos(): Caja[] {
  const cajas: Caja[] = [];
  const ahora = performance.now();
  document.querySelectorAll<HTMLElement>('.interfaz .panel, .interfaz .minimapa').forEach(el => {
    if (el.closest('.comparador')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    if (getComputedStyle(el).visibility === 'hidden') return;
    const caja: Caja = { ...cajaDe(r), control: !!el.closest('.controles-mapa') };
    // La de referencia es la del cuadro anterior (varias medidas en el mismo cuadro no cuentan como movimiento).
    const guardada = ultimas.get(el);
    let previa = guardada?.previa;
    if (!guardada || ahora - guardada.t > 8) { previa = guardada?.caja; ultimas.set(el, { t: ahora, caja, previa }); }
    else ultimas.set(el, { t: guardada.t, caja, previa });
    if (previa) {
      const dl = caja.l - previa.l; const dt = caja.t - previa.t; const dr = caja.r - previa.r; const db = caja.b - previa.b;
      if (Math.abs(dl) + Math.abs(dt) + Math.abs(dr) + Math.abs(db) > 0.5 && Math.abs(dt) + Math.abs(db) < 200) {
        // 2,5 veces: las transiciones aceleran (ease), y el cuadro siguiente avanza más que el anterior.
        const k = 2.5;
        caja.l = Math.min(caja.l, caja.l + k * dl); caja.t = Math.min(caja.t, caja.t + k * dt);
        caja.r = Math.max(caja.r, caja.r + k * dr); caja.b = Math.max(caja.b, caja.b + k * db);
      }
    }
    cajas.push(caja);
  });
  return cajas;
}
