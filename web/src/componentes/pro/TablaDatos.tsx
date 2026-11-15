// Tabla de datos (T4, modo profesional): un cajón abajo, entre las capas y el inspector, con los datos
// de una capa por WFS. Buscar, filtrar por columna o por lo que se ve, ordenar, paginar, exportar todo lo
// filtrado (CSV o GeoJSON) e "ir a la entidad" (un clic en la fila: vuela hasta ella y la muestra en el
// inspector). Las obras de la RN11 además se editan y se borran (WFS-T).
import { lazy, Suspense, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Spinner, Table, toast } from '@heroui/react';
import {
  ArrowsInSimple, ArrowsOutSimple, CaretLeft, CaretRight, Crosshair, DownloadSimple, FunnelSimple, MagnifyingGlass,
  PencilSimple, Plus, Table as IconoTabla, X,
} from '@phosphor-icons/react';
import { buffer } from 'ol/extent';
import { unByKey } from 'ol/Observable';
import { tituloDeCapa } from '../../config';
import { rotulo } from '../../entidades';
import { armarResultado, mostrar, type Consulta } from '../../herramientas';
import { RESORTE, RESORTE_PANEL } from '../../movimiento';
import { cambiarCapas, capasVisibles, extensionLibre, refrescarMapa, suscribirCapas, volarA, type Visor } from '../../visor';
import {
  columnasDe, EDITABLE, entidadCompleta, ETIQUETAS_OBRA, exportar, pedirPagina, POR_PAGINA, TOPE_EXPORTAR,
  type Columna, type Criterios, type Filtro, type Operador, type Pagina,
} from '../../tabla';
// El editor de obras (con los controles de formulario de HeroUI) se baja recién al editar una.
const EditarObra = lazy(() => import('./EditarObra'));

const OPERADORES: Record<Operador, string> = { contiene: 'contiene', es: 'es igual a', mayor: 'mayor que', menor: 'menor que', vacio: 'está vacío', conDato: 'tiene dato' };
const OPERADORES_TEXTO: Operador[] = ['contiene', 'es', 'vacio', 'conDato'];
const OPERADORES_NUMERO: Operador[] = ['es', 'mayor', 'menor', 'vacio', 'conDato'];
const sinValor = (o: Operador) => o === 'vacio' || o === 'conDato';


const formatoNumero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
function textoCelda(capa: string, columna: Columna, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '';
  if (columna.tipo === 'numero' && typeof valor === 'number') return formatoNumero.format(valor);
  if (columna.tipo === 'fecha') return new Date(String(valor)).toLocaleDateString('es-AR', { timeZone: 'UTC' });
  if (capa === EDITABLE && ETIQUETAS_OBRA[String(valor)]) return ETIQUETAS_OBRA[String(valor)];
  return String(valor);
}

const ahora = () => new Date().toISOString().slice(0, 10);
function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

interface Props {
  visor: Visor;
  capa: string;
  onCapa: (capa: string) => void;
  amplia: boolean;
  onAmplia: (amplia: boolean) => void;
  onCerrar: () => void;
  // "Ir a la entidad": la consulta con esa sola entidad, para el inspector.
  onIrA: (consulta: Consulta) => void;
  // Lo que muestra el inspector dejó de existir (se borró la obra): se cierra.
  onLimpiar: () => void;
  // Sube cuando se da de alta una obra (herramienta Nueva obra): la tabla de obras vuelve a pedir.
  recargaObras: number;
  // Cambia cuando se pliegan o despliegan las capas o el inspector: cambia el rectángulo del mapa que se ve.
  bordes: string;
}

export default function TablaDatos({ visor, capa, onCapa, amplia, onAmplia, onCerrar, onIrA, onLimpiar, recargaObras, bordes }: Props) {
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);

  const [columnas, setColumnas] = useState<{ capa: string; lista: Columna[] } | null>(null);
  const [errorEsquema, setErrorEsquema] = useState<string | null>(null);
  const [escrito, setEscrito] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const [armando, setArmando] = useState(false);
  const [soloVista, setSoloVista] = useState(false);
  const [vista, setVista] = useState<number[] | null>(null);
  const [orden, setOrden] = useState<Criterios['orden']>(null);
  const [pagina, setPagina] = useState(0);
  const [datos, setDatos] = useState<(Pagina & { clave: string }) | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  // Volver a pedir la página (después de editar o borrar una obra), sin perder búsqueda, filtros ni orden.
  const [recarga, setRecarga] = useState(0);
  const [elegida, setElegida] = useState<string | null>(null);
  const [yendo, setYendo] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [exportando, setExportando] = useState<'csv' | 'geojson' | null>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const listaPestanas = useRef<HTMLDivElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  // La pestaña abierta siempre a la vista (con muchas capas prendidas quedaba tapada).
  useEffect(() => {
    listaPestanas.current?.querySelector<HTMLElement>(`[data-capa="${capa}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [capa]);
  // El foco vuelve a la tabla (a la fila elegida o a la grilla) cuando se cierra el editor de una obra.
  const volverALaTabla = () => requestAnimationFrame(() => {
    const grilla = cuerpo.current?.querySelector<HTMLElement>('[role=grid]');
    const fila = elegida ? grilla?.querySelector<HTMLElement>(`[data-key="${CSS.escape(elegida)}"]`) : null;
    (fila ?? grilla?.querySelector<HTMLElement>('[role=row][tabindex]') ?? grilla)?.focus();
  });

  // Al cambiar de capa, todo arranca de cero.
  useEffect(() => {
    setColumnas(null); setErrorEsquema(null); setEscrito(''); setBusqueda(''); setFiltros([]); setOrden(null); setPagina(0);
    setDatos(null); setElegida(null); setEditando(null); setArmando(false);
    let vigente = true;
    columnasDe(capa).then(lista => vigente && setColumnas({ capa, lista }), () => vigente && setErrorEsquema('No se pudieron leer las columnas de la capa.'));
    return () => { vigente = false; };
  }, [capa, reintento]);

  // La búsqueda espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(escrito), 280);
    return () => clearTimeout(t);
  }, [escrito]);

  // "Solo lo que se ve": la extensión del mapa, cada vez que se queda quieto.
  useEffect(() => {
    if (!soloVista) { setVista(null); return; }
    // El rectángulo del mapa que de verdad se ve: sin lo que tapan los paneles ni la propia tabla.
    const leer = () => setVista(extensionLibre(visor, false));
    leer();
    const clave = visor.mapa.on('moveend', leer);
    // Al agrandar o achicar la tabla cambia lo que tapa (después de la transición de alto).
    const t = setTimeout(leer, 520);
    return () => { unByKey(clave); clearTimeout(t); };
  }, [visor, soloVista, amplia, bordes]);

  const lista = columnas?.capa === capa ? columnas.lista : null;
  const criterios: Criterios = useMemo(() => ({ capa, busqueda, filtros, extension: vista, orden }), [capa, busqueda, filtros, vista, orden]);
  const claveCriterios = JSON.stringify(criterios);
  // Otros criterios: de vuelta a la primera página.
  useEffect(() => setPagina(0), [claveCriterios]);

  const clave = `${claveCriterios}|${pagina}|${reintento}|${recarga}|${capa === EDITABLE ? recargaObras : 0}`;
  useEffect(() => {
    if (!lista) return;
    const control = new AbortController();
    setCargando(true); setError(null);
    pedirPagina(criterios, lista, pagina, control.signal)
      .then(p => { setDatos({ ...p, clave }); setCargando(false); })
      .catch(e => { if ((e as Error).name !== 'AbortError') { setError('GeoServer no pudo responder la tabla.'); setCargando(false); } });
    return () => control.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, clave]);

  const total = datos?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = total ? pagina * POR_PAGINA + 1 : 0;
  const hasta = Math.min(total, (pagina + 1) * POR_PAGINA);
  const filtrado = !!(busqueda.trim() || filtros.length || soloVista);
  const editable = capa === EDITABLE;

  // Pestañas: las capas prendidas (de la de más arriba a la de más abajo) y la abierta, aunque esté apagada.
  const pestanas = [...capasVisibles(visor)].reverse();
  if (!pestanas.includes(capa)) pestanas.unshift(capa);

  async function irA(id: string) {
    setElegida(id); setYendo(id);
    try {
      const datos = await entidadCompleta(id);
      if (!datos.features.length) throw new Error();
      if (!visor.visibles.has(capa)) cambiarCapas(visor, [capa], true);
      const resultado = armarResultado(capa, 1, datos as never);
      const consulta: Consulta = { origen: 'rectangulo', titulo: `${tituloDeCapa(capa)} · desde la tabla`, capas: mostrar(visor, [resultado]) };
      onIrA(consulta);
      const entidad = resultado.entidades[0];
      visor.foco.clear();
      visor.foco.addFeature(entidad.feature);
      const extension = entidad.feature.getGeometry()?.getExtent();
      // Un punto con su entorno (antes quedaba a 1:30.000, sin nada alrededor); una línea o un polígono, entero.
      if (extension?.every(Number.isFinite)) volarA(visor, buffer(extension, 5000), { maxZoom: 12, duracion: 900, conPanel: true });
    } catch {
      toast.danger('No se pudo traer la entidad.', { timeout: 4000 });
    } finally {
      setYendo(null);
    }
  }

  async function bajar(formato: 'csv' | 'geojson') {
    if (!lista || exportando) return;
    setExportando(formato);
    try {
      const blob = await exportar(criterios, lista, formato);
      descargar(blob, `${capa}-${ahora()}.${formato === 'csv' ? 'csv' : 'geojson'}`);
      toast(total > TOPE_EXPORTAR
        ? `${TOPE_EXPORTAR.toLocaleString('es-AR')} de ${total.toLocaleString('es-AR')} entidades exportadas (el tope): filtrá para bajar el resto`
        : `${total.toLocaleString('es-AR')} entidades exportadas a ${formato === 'csv' ? 'CSV' : 'GeoJSON'}`, { timeout: total > TOPE_EXPORTAR ? 6000 : 3000 });
    } catch {
      toast.danger('No se pudo exportar. Revisá que GeoServer esté andando.', { timeout: 5000 });
    } finally {
      setExportando(null);
    }
  }

  const filaEditando = editando ? datos?.filas.find(f => f.id === editando) : undefined;

  return (
    <section aria-label={`Tabla de datos: ${tituloDeCapa(capa)}`} className="panel flex h-full min-h-0 flex-col overflow-hidden">
      {/* Pestañas de capa y cerrar. */}
      <div className="flex items-center gap-2 border-b border-[var(--linea)] py-1.5 pl-3 pr-1.5">
        <IconoTabla size={17} weight="bold" className="shrink-0 text-[var(--vial-texto)]" aria-hidden="true" />
        <div ref={listaPestanas} role="tablist" aria-label="Capa de la tabla" className="pestanas-tabla flex min-w-0 flex-1 gap-1 overflow-x-auto px-2 py-0.5 [scrollbar-width:none]"
          onKeyDown={e => {
            const i = pestanas.indexOf(capa);
            const destino = e.key === 'ArrowRight' ? (i + 1) % pestanas.length : e.key === 'ArrowLeft' ? (i - 1 + pestanas.length) % pestanas.length
              : e.key === 'Home' ? 0 : e.key === 'End' ? pestanas.length - 1 : -1;
            if (destino < 0) return;
            e.preventDefault();
            // El elemento se guarda antes: dentro del rAF, React ya dejó e.currentTarget en null.
            const lista = e.currentTarget;
            const siguiente = pestanas[destino];
            onCapa(siguiente);
            requestAnimationFrame(() => (lista.querySelector(`[data-capa="${siguiente}"]`) as HTMLElement | null)?.focus());
          }}>
          {pestanas.map(n => {
            const activa = n === capa;
            return (
              <button key={n} type="button" role="tab" id={`pestana-tabla-${n}`} aria-controls="panel-tabla" aria-selected={activa} tabIndex={activa ? 0 : -1} data-capa={n} onClick={() => onCapa(n)}
                className={`relative h-8 shrink-0 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${activa ? 'text-[var(--tinta)]' : 'text-[var(--tinta-3)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta-2)]'}`}>
                {activa && <motion.span layoutId="tabla-pestana" transition={RESORTE} className="absolute inset-0 rounded-lg bg-[var(--superficie-2)] shadow-[inset_0_0_0_1px_var(--linea)]" />}
                <span className="relative">{tituloDeCapa(n)}{!visor.visibles.has(n) && <span className="ml-1 text-[var(--tinta-3)]">(apagada)</span>}</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => onAmplia(!amplia)} aria-label={amplia ? 'Achicar la tabla' : 'Agrandar la tabla'} title={amplia ? 'Achicar' : 'Agrandar'}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)] focus-visible:outline-2">
          {amplia ? <ArrowsInSimple size={17} weight="bold" /> : <ArrowsOutSimple size={17} weight="bold" />}
        </button>
        <button type="button" onClick={onCerrar} aria-label="Cerrar la tabla (T)" title="Cerrar (T)"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)] focus-visible:outline-2">
          <X size={17} weight="bold" />
        </button>
      </div>

      <div id="panel-tabla" role="tabpanel" aria-labelledby={`pestana-tabla-${capa}`} className="flex min-h-0 flex-1 flex-col">
      {/* Herramientas: buscar, solo lo visible, filtros, exportar. */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-2 pt-2.5">
        <label className="relative flex h-9 min-w-[180px] max-w-[300px] flex-1 items-center">
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 text-[var(--tinta-3)]" aria-hidden="true" />
          <input ref={buscador} type="search" value={escrito} onChange={e => setEscrito(e.target.value)} placeholder={`Buscar en ${tituloDeCapa(capa)}`}
            aria-label={`Buscar en ${tituloDeCapa(capa)}`}
            onKeyDown={e => { if (e.key === 'Escape' && escrito) { e.stopPropagation(); setEscrito(''); } }}
            className="h-full w-full rounded-xl bg-[var(--superficie-2)] pl-9 pr-3 text-[13.5px] outline-none placeholder:text-[var(--tinta-3)] focus-visible:shadow-[0_0_0_2px_var(--focus)]" />
        </label>
        <button type="button" aria-pressed={soloVista} onClick={() => setSoloVista(v => !v)}
          className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${soloVista ? 'bg-[var(--tinta)] text-[var(--superficie)]' : 'bg-[var(--superficie-2)] text-[var(--tinta-2)] hover:bg-[var(--superficie-3)]'}`}>
          <Crosshair size={15} weight="bold" /> Solo lo que se ve
        </button>
        <button type="button" aria-expanded={armando} onClick={() => setArmando(a => !a)} disabled={!lista}
          className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 ${armando ? 'bg-[var(--superficie-3)] text-[var(--tinta)]' : 'bg-[var(--superficie-2)] text-[var(--tinta-2)] hover:bg-[var(--superficie-3)]'}`}>
          <FunnelSimple size={15} weight="bold" /> Filtrar{filtros.length ? ` (${filtros.length})` : ''}
        </button>
        {filtros.length > 0 && (
          <ul aria-label="Filtros aplicados" className="flex flex-wrap items-center gap-1.5">
            {filtros.map((f, i) => (
              <li key={`${f.columna}-${i}`} className="flex h-7 items-center gap-1 rounded-full bg-[var(--vial-suave)] pl-3 pr-1 text-[12.5px] text-[var(--vial-texto)]">
                <span><strong className="font-semibold">{rotulo(f.columna)}</strong> {OPERADORES[f.operador]}{sinValor(f.operador) ? '' : ` «${f.valor}»`}</span>
                <button type="button" onClick={() => setFiltros(fs => fs.filter((_, j) => j !== i))} aria-label={`Quitar el filtro ${rotulo(f.columna)} ${OPERADORES[f.operador]} ${f.valor}`}
                  className="grid size-6 place-items-center rounded-full hover:bg-[color-mix(in_srgb,var(--vial)_18%,transparent)] focus-visible:outline-2"><X size={12} weight="bold" /></button>
              </li>
            ))}
            <li><button type="button" onClick={() => setFiltros([])} className="h-7 rounded-full px-2 text-[12.5px] font-medium text-[var(--tinta-3)] underline underline-offset-2 hover:text-[var(--tinta)]">Quitar todos</button></li>
          </ul>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-xl bg-[var(--superficie-2)] p-0.5" role="group" aria-label={`Exportar ${filtrado ? 'lo filtrado' : 'toda la capa'}`}>
          <span className="flex items-center gap-1 pl-2 pr-1 text-[12.5px] font-medium text-[var(--tinta-3)]"><DownloadSimple size={14} weight="bold" aria-hidden="true" /> Exportar</span>
          {(['csv', 'geojson'] as const).map(f => (
            <button key={f} type="button" onClick={() => bajar(f)} disabled={!lista || !total || !!exportando}
              aria-label={total > TOPE_EXPORTAR ? `Exportar ${TOPE_EXPORTAR.toLocaleString('es-AR')} de ${total.toLocaleString('es-AR')} entidades (tope) a ${f === 'csv' ? 'CSV' : 'GeoJSON'}` : `Exportar ${total.toLocaleString('es-AR')} entidades ${filtrado ? 'filtradas ' : ''}a ${f === 'csv' ? 'CSV' : 'GeoJSON'}`}
              title={total > TOPE_EXPORTAR ? `Se exportan las primeras ${TOPE_EXPORTAR.toLocaleString('es-AR')} de ${total.toLocaleString('es-AR')}: filtrá para bajar el resto` : undefined}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-[var(--tinta-2)] hover:bg-[var(--superficie)] hover:text-[var(--tinta)] focus-visible:outline-2 disabled:opacity-40">
              {exportando === f && <Spinner size="sm" />}{f === 'csv' ? 'CSV' : 'GeoJSON'}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {armando && lista && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={RESORTE_PANEL} className="overflow-hidden">
            <NuevoFiltro columnas={lista} onAgregar={f => setFiltros(fs => [...fs, f])} onListo={() => setArmando(false)} />
          </motion.div>
        )}
      </AnimatePresence>


      {/* La tabla y, en las obras, el panel para editar. */}
      <div className="relative flex min-h-0 flex-1 border-t border-[var(--linea)]">
        <div ref={cuerpo} className="relative min-w-0 flex-1 overflow-hidden">
          {errorEsquema || error ? (
            <Estado icono="error" titulo={errorEsquema ?? error!} accion={{ texto: 'Reintentar', alElegir: () => setReintento(r => r + 1) }} />
          ) : !lista || (!datos && cargando) ? (
            <Esqueleto />
          ) : (
            <Table className="h-full" variant="primary">
              <Table.ScrollContainer className={`desplazable h-full overflow-auto transition-opacity duration-200 ${cargando ? 'opacity-55' : ''}`}>
                <Table.Content
                  aria-label={`${tituloDeCapa(capa)}: ${total.toLocaleString('es-AR')} entidades`}
                  aria-describedby="tabla-ayuda"
                  keyboardNavigationBehavior="arrow"
                  sortDescriptor={orden ? { column: orden.columna, direction: orden.descendente ? 'descending' : 'ascending' } : undefined}
                  onSortChange={d => setOrden({ columna: String(d.column), descendente: d.direction === 'descending' })}
                  onRowAction={k => { irA(String(k)); if (editable) { setEditando(String(k)); if (!amplia) onAmplia(true); } }}
                  className="min-w-full text-[13px]"
                >
                  <Table.Header className="sticky top-0 z-[1] bg-[var(--superficie)]">
                    {[
                      ...lista.map((c, i) => (
                        <Table.Column key={c.nombre} id={c.nombre} allowsSorting isRowHeader={i === 0}
                          className={`h-9 whitespace-nowrap border-b border-[var(--linea)] bg-[var(--superficie)] px-3 text-[12px] font-semibold text-[var(--tinta-3)] ${c.tipo === 'numero' ? 'text-right' : 'text-left'} ${i === 0 ? 'sticky left-0 z-[2] shadow-[1px_0_0_var(--linea)]' : ''}`}>
                          {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection} className={`inline-flex items-center gap-1 whitespace-nowrap ${c.tipo === 'numero' ? 'flex-row-reverse' : ''}`}>{rotulo(c.nombre)}</Table.SortableColumnHeader>}
                        </Table.Column>
                      )),
                      ...(editable ? [<Table.Column key="_acciones" id="_acciones" className="h-9 w-[1%] border-b border-[var(--linea)] px-3 text-right text-[12px] font-semibold text-[var(--tinta-3)]">Editar</Table.Column>] : []),
                    ]}
                  </Table.Header>
                  <Table.Body
                    items={datos?.filas ?? []}
                    dependencies={[elegida, yendo, editando, lista]}
                    renderEmptyState={() => (
                      <Estado icono="vacio" titulo={filtrado ? 'Nada coincide con la búsqueda o los filtros.' : editable ? 'Todavía no hay obras cargadas.' : 'La capa no tiene entidades.'}
                        detalle={filtrado ? undefined : editable ? 'Cargá una con Nueva obra (6), sobre la ruta.' : undefined}
                        accion={filtrado ? { texto: 'Quitar búsqueda y filtros', alElegir: () => { setEscrito(''); setBusqueda(''); setFiltros([]); setSoloVista(false); } } : undefined} />
                    )}
                  >
                    {fila => (
                      <Table.Row id={fila.id} data-elegida={fila.id === elegida || undefined}
                        className="group cursor-pointer border-b border-[var(--linea)] outline-none transition-colors hover:bg-[var(--superficie-2)] data-[elegida]:bg-[var(--vial-suave)] data-[focus-visible]:shadow-[inset_0_0_0_2px_var(--focus)]">
                        {[
                          ...lista.map((c, i) => {
                            const texto = textoCelda(capa, c, fila.valores[c.nombre]);
                            return (
                              <Table.Cell key={c.nombre} className={`h-9 max-w-[280px] truncate whitespace-nowrap px-3 ${c.tipo === 'numero' ? 'text-right tabular-nums' : ''} ${i === 0 ? 'sticky left-0 z-[1] border-b border-[var(--linea)] bg-[var(--superficie)] align-middle font-medium text-[var(--tinta)] shadow-[1px_0_0_var(--linea)] group-hover:bg-[var(--superficie-2)] group-data-[elegida]:bg-[var(--vial-suave)]' : 'text-[var(--tinta-2)]'} data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-[-2px]`}>
                                <span title={texto.length > 32 ? texto : undefined} className="inline-flex items-center gap-1.5">
                                  {i === 0 && yendo === fila.id && <Spinner size="sm" />}
                                  {texto || <span className="text-[var(--tinta-3)] opacity-60" aria-label="sin dato">—</span>}
                                </span>
                              </Table.Cell>
                            );
                          }),
                          ...(editable ? [
                            // Sin botón adentro (la celda ya es enfocable): la fila entera abre la edición.
                            <Table.Cell key="_acciones" className="h-9 px-3 text-right">
                              <span className={`inline-flex items-center gap-1 text-[12.5px] font-medium ${editando === fila.id ? 'text-[var(--vial-texto)]' : 'text-[var(--tinta-3)] group-hover:text-[var(--tinta)]'}`}>
                                <PencilSimple size={14} weight="bold" aria-hidden="true" /> {editando === fila.id ? 'Editando' : 'Editar'}
                              </span>
                            </Table.Cell>,
                          ] : []),
                        ]}
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}
        </div>
        <AnimatePresence>
          {editable && filaEditando && (
            <Suspense key={filaEditando.id} fallback={null}><EditarObra key={filaEditando.id} id={filaEditando.id} valores={filaEditando.valores}
              onCerrar={() => { setEditando(null); volverALaTabla(); }}
              onListo={(mensaje, borrada) => {
                const id = editando!;
                setEditando(null); setRecarga(r => r + 1); refrescarMapa(visor); toast.success(mensaje, { timeout: 3000 });
                // El inspector muestra la obra: con los datos nuevos, o se cierra si se borró.
                if (elegida === id) { if (borrada) { setElegida(null); onLimpiar(); } else irA(id); }
                volverALaTabla();
              }} /></Suspense>
          )}
        </AnimatePresence>
      </div>

      {/* Pie: cuántas, ayuda y páginas. */}
      <footer className="flex items-center gap-3 border-t border-[var(--linea)] px-3 py-1.5 text-[12.5px] text-[var(--tinta-3)]">
        <span role="status" aria-live="polite" className="tabular-nums">
          {errorEsquema || error ? 'Sin datos' : datos ? (total ? <><strong className="font-semibold text-[var(--tinta-2)]">{desde.toLocaleString('es-AR')}–{hasta.toLocaleString('es-AR')}</strong> de {total.toLocaleString('es-AR')}{filtrado ? ' filtradas' : ''}</> : '0 entidades') : 'Cargando…'}
        </span>
        <span id="tabla-ayuda" className="min-w-0 flex-1 truncate">{editable ? 'Clic o Enter en una obra: ir a ella y editarla.' : 'Clic o Enter en una fila: ir a la entidad.'} Clic en un encabezado: ordenar.</span>
        <nav aria-label="Páginas de la tabla" className="flex items-center gap-1">
          <button type="button" onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0} aria-label="Página anterior"
            className="grid size-8 place-items-center rounded-lg text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] focus-visible:outline-2 disabled:opacity-35"><CaretLeft size={15} weight="bold" /></button>
          <span className="min-w-[92px] text-center tabular-nums">Página {(pagina + 1).toLocaleString('es-AR')} de {paginas.toLocaleString('es-AR')}</span>
          <button type="button" onClick={() => setPagina(p => Math.min(paginas - 1, p + 1))} disabled={pagina >= paginas - 1} aria-label="Página siguiente"
            className="grid size-8 place-items-center rounded-lg text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] focus-visible:outline-2 disabled:opacity-35"><CaretRight size={15} weight="bold" /></button>
        </nav>
      </footer>
      </div>
    </section>
  );
}

// Una fila para armar un filtro: columna, condición y valor.
function NuevoFiltro({ columnas, onAgregar, onListo }: { columnas: Columna[]; onAgregar: (f: Filtro) => void; onListo: () => void }) {
  const [columna, setColumna] = useState(columnas[0]?.nombre ?? '');
  const tipo = columnas.find(c => c.nombre === columna)?.tipo ?? 'texto';
  const operadores = tipo === 'numero' ? OPERADORES_NUMERO : OPERADORES_TEXTO;
  const [operador, setOperador] = useState<Operador>('contiene');
  const [valor, setValor] = useState('');
  useEffect(() => { if (!operadores.includes(operador)) setOperador(operadores[0]); }, [operadores, operador]);
  const valido = sinValor(operador) || valor.trim() !== '';
  const agregar = () => { if (!valido) return; onAgregar({ columna, operador, valor: valor.trim() }); setValor(''); onListo(); };
  const campo = 'h-9 rounded-xl bg-[var(--superficie-2)] px-3 text-[13px] outline-none focus-visible:shadow-[0_0_0_2px_var(--focus)]';
  return (
    <form onSubmit={e => { e.preventDefault(); agregar(); }} className="flex flex-wrap items-end gap-2 px-3 pb-2.5" aria-label="Nuevo filtro">
      <label className="flex flex-col gap-1 text-[12px] font-medium text-[var(--tinta-3)]">Columna
        <select value={columna} onChange={e => setColumna(e.target.value)} className={`${campo} min-w-[160px] text-[var(--tinta)]`}>
          {columnas.map(c => <option key={c.nombre} value={c.nombre}>{rotulo(c.nombre)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-medium text-[var(--tinta-3)]">Condición
        <select value={operador} onChange={e => setOperador(e.target.value as Operador)} className={`${campo} text-[var(--tinta)]`}>
          {operadores.map(o => <option key={o} value={o}>{OPERADORES[o]}</option>)}
        </select>
      </label>
      {!sinValor(operador) && (
        <label className="flex flex-col gap-1 text-[12px] font-medium text-[var(--tinta-3)]">Valor
          <input value={valor} onChange={e => setValor(e.target.value)} inputMode={tipo === 'numero' ? 'decimal' : undefined} placeholder={tipo === 'numero' ? 'Ej.: 20.000' : 'Ej.: Chaco'}
            className={`${campo} w-[180px] text-[var(--tinta)] placeholder:text-[var(--tinta-3)]`} autoFocus />
        </label>
      )}
      <button type="submit" disabled={!valido} className="flex h-9 items-center gap-1.5 rounded-xl bg-[var(--tinta)] px-3.5 text-[13px] font-semibold text-[var(--superficie)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40">
        <Plus size={14} weight="bold" /> Agregar filtro
      </button>
    </form>
  );
}

function Estado({ icono, titulo, detalle, accion }: { icono: 'error' | 'vacio'; titulo: string; detalle?: string; accion?: { texto: string; alElegir: () => void } }) {
  return (
    <div role={icono === 'error' ? 'alert' : undefined} className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-6 py-6 text-center">
      <span className={`grid size-10 place-items-center rounded-xl ${icono === 'error' ? 'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]' : 'bg-[var(--superficie-2)] text-[var(--tinta-3)]'}`}>
        {icono === 'error' ? <X size={18} weight="bold" /> : <IconoTabla size={18} weight="bold" />}
      </span>
      <p className="text-[14px] font-semibold text-[var(--tinta)]">{titulo}</p>
      {detalle && <p className="text-[13px] text-[var(--tinta-3)]">{detalle}</p>}
      {accion && <button type="button" onClick={accion.alElegir} className="mt-1 h-8 rounded-lg bg-[var(--superficie-2)] px-3 text-[12.5px] font-semibold text-[var(--tinta)] hover:bg-[var(--superficie-3)] focus-visible:outline-2">{accion.texto}</button>}
    </div>
  );
}

// Mientras llegan las columnas o la primera página: filas grises que respiran.
function Esqueleto() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando la tabla" className="flex h-full flex-col gap-0 overflow-hidden px-3 pt-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex h-9 items-center gap-6 border-b border-[var(--linea)]">
          {[38, 18, 22, 14].map((w, j) => <span key={j} className="esqueleto h-3 rounded-full bg-[var(--superficie-2)]" style={{ width: `${w - (i % 3) * 3}%`, animationDelay: `${i * 60}ms` }} />)}
        </div>
      ))}
    </div>
  );
}

