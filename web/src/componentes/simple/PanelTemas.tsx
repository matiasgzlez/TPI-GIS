import { useEffect, useReducer, useState } from 'react';
import { ArrowLeft, CaretDown, CaretRight, Check, DotsNine, Eye, EyeSlash, Fire, MagnifyingGlassPlus, Palette } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { unByKey } from 'ol/Observable';
import { TEMATICAS, miniatura, type Tematica } from '../../interfaz';
import { RESORTE, RESORTE_PANEL } from '../../movimiento';
import { escalaMinima } from '../../estilos';
import { acercarAEscala, cambiarCalor, cambiarCapas, cargarLeyenda, denominadorWms, suscribirCapas, type Visor } from '../../visor';
import { IconoTematica } from './iconos';

// "¿Qué querés ver?": el panel de capas del modo simple. Primero las temáticas, cada una con un dibujo
// y la miniatura de lo que trae; al tocar una, sus capas como tarjetas con miniatura, nombre de todos
// los días y una frase. Un toque prende o apaga. Nada de "capa", "entidad" ni nombres del IGN.
import { BotonManchas, EstadoCalorLinea, LeyendaCalor, TarjetaDondeViveLaGente, admiteCalor, useCalor } from '../Calor';

// `desnudo`: dentro de la pastilla del escritorio, que ya pone el fondo y el título.
export default function PanelTemas({ visor, desnudo }: { visor: Visor; desnudo?: boolean }) {
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  const [abierta, setAbierta] = useState<Tematica | null>(null);
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);
  const ocultas = useOcultasPorEscala(visor);

  const viendo = visor.visibles.size;
  return (
    <section className={`${desnudo ? '' : 'panel '}flex min-h-0 flex-1 flex-col overflow-hidden`} aria-label="Qué querés ver en el mapa">
      <AnimatePresence mode="popLayout" initial={false}>
        {!abierta && desnudo ? (
          <motion.div
            key="tematicas"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={RESORTE_PANEL}
          >
            <GrillaTemas visor={visor} onAbrir={setAbierta} />
          </motion.div>
        ) : !abierta ? (
          <motion.div
            key="tematicas"
            className="flex min-h-0 flex-col"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={RESORTE_PANEL}
          >
            <header className={desnudo ? 'px-5 pb-3 pt-1' : 'px-5 pb-3 pt-5'}>
              {!desnudo && <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.03em]">¿Qué querés ver?</h2>}
              <div className={`${desnudo ? '' : 'mt-1.5 '}flex items-center justify-between gap-3`}>
                <p className="text-[15px] text-[var(--tinta-2)]">
                  {viendo ? <>Estás viendo <strong className="font-semibold text-[var(--tinta)]">{viendo}</strong> {viendo === 1 ? 'cosa' : 'cosas'}</> : 'El mapa está vacío'}
                </p>
                {viendo > 0 && (
                  <button
                    type="button"
                    onClick={() => cambiarCapas(visor, [...visor.visibles], false)}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--superficie-2)] px-3.5 text-[14px] font-medium text-[var(--tinta-2)] hover:bg-[var(--superficie-3)] hover:text-[var(--tinta)]"
                  >
                    <EyeSlash size={16} /> Borrar todo
                  </button>
                )}
              </div>
            </header>
            <ul className="desplazable grid min-h-0 flex-1 grid-cols-2 gap-2.5 overflow-y-auto px-4 pb-4">
              {/* T3: lo primero, a todo el ancho: dónde vive la gente, como manchas. */}
              <motion.li className="col-span-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={RESORTE}>
                <TarjetaDondeViveLaGente visor={visor} />
              </motion.li>
              {TEMATICAS.map((t, i) => {
                const prendidas = t.capas.filter(c => visor.visibles.has(c.nombre)).length;
                return (
                  <motion.li key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RESORTE, delay: 0.02 * i }}>
                    <button
                      type="button"
                      onClick={() => setAbierta(t)}
                      className="group relative flex h-full w-full flex-col overflow-hidden rounded-[18px] bg-[var(--superficie-2)] text-left transition-transform duration-300 ease-[var(--ios)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                      aria-label={`${t.titulo}: ${t.frase}. ${prendidas ? `${prendidas} a la vista` : 'Nada a la vista'}`}
                    >
                      <span className="relative block aspect-[16/9] overflow-hidden">
                        <img src={miniatura(t.capas[0].nombre)} alt="" loading={desnudo ? 'eager' : 'lazy'} decoding="async" className="miniatura h-full w-full object-cover transition-transform duration-500 ease-[var(--ios)] group-hover:scale-[1.06]" />
                        <span className="absolute left-2 top-2 grid size-9 place-items-center rounded-full text-white shadow-[0_2px_8px_rgba(0,0,0,.2)]" style={{ backgroundColor: t.color }}>
                          <IconoTematica id={t.id} />
                        </span>
                        {prendidas > 0 && (
                          <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--tinta)] px-1.5 text-[12px] font-semibold text-[var(--superficie)]">
                            {prendidas}
                          </span>
                        )}
                      </span>
                      <span className="flex flex-1 flex-col px-3 pb-3 pt-2">
                        <span className="text-[15px] font-semibold leading-tight">{t.titulo}</span>
                        <span className="mt-0.5 text-[13px] leading-snug text-[var(--tinta-3)]">{t.frase}</span>
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        ) : (
          <motion.div
            key={abierta.id}
            className="flex min-h-0 flex-col"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={RESORTE_PANEL}
          >
            {desnudo
              ? <TematicaGrande visor={visor} tematica={abierta} ocultas={ocultas} onVolver={() => setAbierta(null)} />
              : <Tematica visor={visor} tematica={abierta} ocultas={ocultas} onVolver={() => setAbierta(null)} />}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// Las categorías dentro de la pastilla de "Capas": todas a la vista, sin desplazar. La Ruta 11 (el tema del
// TPI) va a todo el ancho arriba y las otras ocho en dos columnas; las filas se reparten el alto que haya,
// así entra igual en la notebook y en la tele. Solo foto, ícono y nombre: la frase aparece al abrir una.
// Al abrirse la pastilla, las tarjetas entran escalonadas (.tarjeta-tema en estilos.css).
function GrillaTemas({ visor, onAbrir }: { visor: Visor; onAbrir: (t: Tematica) => void }) {
  return (
    <ul className="grid min-h-0 flex-1 grid-cols-2 grid-rows-5 gap-3 px-4 pb-4" aria-label="Categorías">
      {TEMATICAS.map((t, i) => {
        const prendidas = t.capas.filter(c => visor.visibles.has(c.nombre)).length;
        return (
          <li key={t.id} className={`min-h-0 ${i === 0 ? 'col-span-2' : ''}`}>
            <button
              type="button"
              onClick={() => onAbrir(t)}
              data-encendida={prendidas > 0 || undefined}
              style={{ '--i': i } as React.CSSProperties}
              className="tarjeta-tema group relative block h-full w-full overflow-hidden rounded-[20px] bg-[var(--superficie-2)] text-left focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label={`${t.titulo}. ${prendidas ? `${prendidas} a la vista` : 'Nada a la vista'}`}
            >
              <img src={miniatura(t.capas[0].nombre)} alt="" className="miniatura absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[var(--ios)] group-hover:scale-[1.07]" />
              <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_40%,rgba(0,0,0,.82)_100%)]" />
              <span className="absolute left-3 top-3 grid size-10 place-items-center rounded-full text-white shadow-[0_2px_8px_rgba(0,0,0,.25)]" style={{ backgroundColor: t.color }}>
                <IconoTematica id={t.id} />
              </span>
              {prendidas > 0 && (
                <span aria-hidden="true" className="absolute right-3 top-3 flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-2.5 text-[15px] font-bold text-[#0b0c0e]">{prendidas}</span>
              )}
              <span className="absolute inset-x-3.5 bottom-3 text-[19px] font-bold leading-[1.1] tracking-[-0.015em] text-white [text-wrap:balance]">{t.titulo}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Tematica({ visor, tematica, ocultas, onVolver }: { visor: Visor; tematica: Tematica; ocultas: Set<string>; onVolver: () => void }) {
  const nombres = tematica.capas.map(c => c.nombre);
  const todas = nombres.every(n => visor.visibles.has(n));
  return (
    <>
      <header className="flex items-center gap-2 px-3 pb-3 pt-4">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver a todos los temas"
          className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]"
        >
          <ArrowLeft size={22} weight="bold" />
        </button>
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: tematica.color }}>
          <IconoTematica id={tematica.id} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] font-semibold leading-tight tracking-[-0.02em]">{tematica.titulo}</h2>
          <p className="truncate text-[13px] text-[var(--tinta-3)]">{tematica.frase}</p>
        </div>
      </header>
      {nombres.length > 1 && (
        <div className="px-4 pb-2">
          <button
            type="button"
            onClick={() => cambiarCapas(visor, nombres, !todas)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--superficie-2)] text-[14px] font-semibold hover:bg-[var(--superficie-3)]"
          >
            {todas ? <><EyeSlash size={17} /> Sacar todo de {tematica.titulo.toLowerCase()}</> : <><Eye size={17} /> Mostrar todo</>}
          </button>
        </div>
      )}
      <ul className="desplazable flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
        {tematica.capas.map((capa, i) => {
          const visible = visor.visibles.has(capa.nombre);
          return (
            <motion.li key={capa.nombre} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RESORTE, delay: 0.03 * i }}>
              <button
                type="button"
                onClick={() => cambiarCapas(visor, [capa.nombre], !visible)}
                aria-pressed={visible}
                className={`flex w-full items-center gap-3 rounded-[16px] p-2 text-left transition-[background-color,box-shadow] duration-300 focus-visible:outline-2 ${
                  visible ? 'bg-[var(--superficie)] shadow-[0_0_0_2px_var(--tinta),var(--sombra)]' : 'bg-[var(--superficie-2)] hover:bg-[var(--superficie-3)]'
                }`}
              >
                <img src={miniatura(capa.nombre)} alt="" loading="lazy" className="miniatura aspect-[16/10] w-[92px] shrink-0 rounded-[11px] object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold leading-tight">{capa.titulo}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-[var(--tinta-3)]">{capa.frase}</span>
                </span>
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-300 ${visible ? 'bg-[var(--tinta)] text-[var(--superficie)]' : 'bg-[var(--superficie)] text-transparent shadow-[inset_0_0_0_2px_var(--linea)]'}`}
                  aria-hidden="true"
                >
                  <Check size={16} weight="bold" />
                </span>
              </button>
              {visible && ocultas.has(capa.nombre) && !visor.calor.has(capa.nombre) && (
                <button
                  type="button"
                  onClick={() => acercarAEscala(visor, escalaMinima(capa.nombre)!)}
                  className="mt-1.5 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[var(--vial-suave)] text-[14px] font-semibold text-[var(--vial-texto)]"
                >
                  <MagnifyingGlassPlus size={17} weight="bold" /> Se ve de más cerca: acercarme
                </button>
              )}
              {visible && admiteCalor(capa.nombre) && <BotonManchas visor={visor} nombre={capa.nombre} />}
              {visible && (visor.calor.has(capa.nombre)
                ? <LeyendaCalor visor={visor} nombre={capa.nombre} simple className="px-3.5 pb-1 pt-2" />
                : <Referencias nombre={capa.nombre} titulo={capa.titulo} />)}
            </motion.li>
          );
        })}
      </ul>
    </>
  );
}

// Una categoría abierta dentro de la pastilla "Capas" (escritorio), con el mismo lenguaje que Ajustes:
// - Portada: la foto de la categoría a todo el ancho, con su nombre grande, cuántas capas hay a la vista y
//   "Volver" con palabras.
// - "Todo lo de …": una fila con interruptor, como las de Ajustes.
// - Cada capa: una fila grande (foto, nombre en negrita, frase, interruptor). Prendida, se marca con un borde
//   blanco y debajo se despliegan sus opciones como pastillas grandes: acercarse (si a esta distancia no se
//   dibuja), verla como manchas y qué significa cada color (la leyenda, en una tarjeta blanca).
function TematicaGrande({ visor, tematica, ocultas, onVolver }: { visor: Visor; tematica: Tematica; ocultas: Set<string>; onVolver: () => void }) {
  const nombres = tematica.capas.map(c => c.nombre);
  const prendidas = nombres.filter(n => visor.visibles.has(n)).length;
  const todas = prendidas === nombres.length;
  return (
    <>
      <header className="portada-tema relative mx-4 mb-3 h-[136px] shrink-0 overflow-hidden rounded-[22px]">
        <img src={miniatura(tematica.capas[0].nombre)} alt="" className="miniatura absolute inset-0 h-full w-full object-cover" />
        <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.35)_0%,rgba(0,0,0,0)_38%,rgba(0,0,0,.85)_100%)]" />
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver a todos los temas"
          className="volver-tema absolute left-3 top-3 flex h-11 items-center gap-2 rounded-full bg-[rgba(11,12,14,.72)] pl-3 pr-4 text-[16px] font-bold text-white backdrop-blur-md focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ArrowLeft size={19} weight="bold" className="volver-tema-flecha" /> Volver
        </button>
        <span className="absolute right-3 top-3 flex h-11 items-center rounded-full bg-white px-4 text-[15px] font-bold text-[#0b0c0e]">
          {prendidas} de {nombres.length} a la vista
        </span>
        <div className="absolute inset-x-4 bottom-3.5 flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full text-white shadow-[0_2px_10px_rgba(0,0,0,.3)]" style={{ backgroundColor: tematica.color }}>
            <IconoTematica id={tematica.id} size={22} />
          </span>
          <div className="min-w-0 flex-1 text-white">
            <h3 className="truncate text-[25px] font-bold leading-tight tracking-[-0.02em]">{tematica.titulo}</h3>
            <p className="truncate text-[15px] font-medium text-white/80">{tematica.frase}</p>
          </div>
        </div>
      </header>
      {nombres.length > 1 && (
        <div className="px-4 pb-3">
          <button
            type="button"
            role="switch"
            aria-checked={todas}
            onClick={() => cambiarCapas(visor, nombres, !todas)}
            className="fila-llave flex min-h-[60px] w-full items-center gap-3.5 rounded-[18px] bg-[var(--superficie-2)] px-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[var(--superficie-3)]">
              {todas ? <Eye size={22} weight="bold" /> : <EyeSlash size={22} weight="bold" />}
            </span>
            <span className="min-w-0 flex-1 text-[17px] font-bold leading-tight">Todo lo de {tematica.titulo.toLowerCase()}</span>
            <span aria-hidden="true" className="llave-capa" data-prendida={todas || undefined}><span /></span>
          </button>
        </div>
      )}
      <ul className="desplazable flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-4">
        {tematica.capas.map((capa, i) => {
          const visible = visor.visibles.has(capa.nombre);
          return (
            <motion.li
              key={capa.nombre}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...RESORTE, delay: 0.03 * i }}
              className={`capa-simple rounded-[20px] bg-[var(--superficie-2)] ${visible ? 'capa-simple-prendida' : ''}`}
            >
              <button
                type="button"
                onClick={() => cambiarCapas(visor, [capa.nombre], !visible)}
                aria-pressed={visible}
                className="group flex w-full items-center gap-3.5 rounded-[20px] p-2.5 pr-3.5 text-left focus-visible:outline-2"
              >
                <img src={miniatura(capa.nombre)} alt="" loading="lazy" className="miniatura size-[68px] shrink-0 rounded-[15px] object-cover transition-transform duration-500 ease-[var(--ios)] group-hover:scale-[1.04]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] font-bold leading-tight tracking-[-0.01em]">{capa.titulo}</span>
                  <span className="mt-1 line-clamp-2 block text-[14.5px] leading-snug text-[var(--tinta-3)]">{capa.frase}</span>
                </span>
                <span aria-hidden="true" className="llave-capa" data-prendida={visible || undefined}><span /></span>
              </button>
              {visible && <OpcionesCapa visor={visor} nombre={capa.nombre} titulo={capa.titulo} oculta={ocultas.has(capa.nombre)} />}
            </motion.li>
          );
        })}
      </ul>
    </>
  );
}

// Lo que se puede hacer con una capa prendida, como pastillas grandes. Se despliega con una animación de
// alto (grid de 0fr a 1fr: sin medir, así no le afecta el zoom de la interfaz).
function OpcionesCapa({ visor, nombre, titulo, oculta }: { visor: Visor; nombre: string; titulo: string; oculta: boolean }) {
  const { activo: manchas } = useCalor(visor, nombre);
  const [colores, setColores] = useState(false);
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    if (!colores || src || manchas) return;
    const control = new AbortController();
    // Al doble de resolución: se muestra un 30 % más grande que la de GeoServer (letra de ~16 px) y nítida.
    cargarLeyenda(nombre, control.signal, true, 192).then(setSrc, () => {});
    return () => control.abort();
  }, [colores, nombre, src, manchas]);
  const chip = 'chip-capa flex h-12 w-full items-center gap-3 rounded-[16px] px-3.5 text-left text-[15.5px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2';
  return (
    <div className="capa-opciones">
      <div className="min-h-0 overflow-hidden">
        <div className="flex flex-col gap-2 px-2.5 pb-3 pt-0.5">
          {oculta && !manchas && (
            <button
              type="button"
              onClick={() => acercarAEscala(visor, escalaMinima(nombre)!)}
              className="flex min-h-12 w-full items-center gap-3 rounded-[16px] bg-[var(--vial-suave)] px-3.5 text-left text-[var(--vial-texto)] focus-visible:outline-2"
            >
              <MagnifyingGlassPlus size={22} weight="bold" className="shrink-0" />
              <span className="flex-1 text-[15.5px] font-bold leading-tight">Desde tan lejos no se ve: acercarme</span>
            </button>
          )}
          <div className="flex flex-col gap-2">
            {admiteCalor(nombre) && (
              <button type="button" onClick={() => cambiarCalor(visor, nombre, !manchas)} aria-pressed={manchas} className={chip}>
                {manchas ? <><DotsNine size={20} weight="bold" /> Ver como puntos</> : <><Fire size={20} weight="bold" /> Ver como manchas</>}
              </button>
            )}
            {!manchas && (
              <button type="button" onClick={() => setColores(!colores)} aria-expanded={colores} aria-label="¿Qué significa cada color?" className={chip}>
                <Palette size={20} weight="bold" /> <span className="flex-1">Qué es cada color</span>
                <CaretDown size={17} weight="bold" className={`transition-transform duration-300 ${colores ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          {admiteCalor(nombre) && <div className="px-1 [&_[role=status]]:text-[14.5px]"><EstadoCalorLinea visor={visor} nombre={nombre} simple /></div>}
          {manchas
            ? <LeyendaCalor visor={visor} nombre={nombre} simple className="leyenda-capa rounded-[16px] bg-[var(--superficie-3)] p-3.5" />
            : colores && (
              <div className="leyenda-capa leyenda-colores rounded-[16px] p-3.5">
                {src
                  ? <img className="leyenda-wms block max-w-full" alt={`Qué significa cada color en ${titulo}`} src={src} onLoad={e => { e.currentTarget.style.width = `${(e.currentTarget.naturalWidth / 2) * 1.3}px`; }} />
                  : <span className="block py-1 text-[15px] font-semibold text-[#5d6269] [html.dark_&]:text-[var(--tinta-3)]">Cargando los colores…</span>}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

// La leyenda de una capa prendida, a pedido: "¿Qué significa cada color?".
export function Referencias({ nombre, titulo, grande }: { nombre: string; titulo: string; grande?: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    if (!abierta || src) return;
    const control = new AbortController();
    cargarLeyenda(nombre, control.signal, true).then(setSrc, () => {});
    return () => control.abort();
  }, [abierta, nombre, src]);
  return (
    <div className={grande ? '' : 'px-2'}>
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        className={grande
          ? 'flex h-11 w-full items-center gap-2 rounded-xl px-3 text-[15.5px] font-semibold text-[var(--tinta-2)] transition-colors hover:bg-[var(--superficie-3)] hover:text-[var(--tinta)] focus-visible:outline-2'
          : 'mt-1 flex h-8 items-center gap-1 rounded-lg px-1.5 text-[13px] font-medium text-[var(--tinta-2)] hover:text-[var(--tinta)]'}
      >
        <CaretRight size={grande ? 16 : 13} weight="bold" className={`transition-transform duration-300 ${abierta ? 'rotate-90' : ''}`} />
        ¿Qué significa cada color?
      </button>
      {abierta && src && <img className={`leyenda-wms mb-1 block max-w-[240px] ${grande ? 'ml-3 rounded-lg bg-white p-2' : 'ml-5'}`} alt={`Qué significa cada color en ${titulo}`} src={src} />}
    </div>
  );
}

// Capas prendidas que a la escala actual no se dibujan (como "Aparece al acercarse" del panel pro).
export function useOcultasPorEscala(visor: Visor) {
  const [texto, setTexto] = useState('');
  useEffect(() => {
    const vista = visor.mapa.getView();
    const actualizar = () => {
      if (vista.getResolution() === undefined) return;
      const escala = denominadorWms(visor);
      setTexto([...visor.visibles].filter(n => (escalaMinima(n) ?? Infinity) <= escala).join(','));
    };
    actualizar();
    const clave = vista.on('change:resolution', actualizar);
    const desuscribir = suscribirCapas(visor, actualizar);
    return () => {
      unByKey(clave);
      desuscribir();
    };
  }, [visor]);
  return new Set(texto ? texto.split(',') : []);
}
