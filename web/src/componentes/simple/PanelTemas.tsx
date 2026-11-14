import { useEffect, useReducer, useState } from 'react';
import { ArrowLeft, CaretRight, Check, Eye, EyeSlash, MagnifyingGlassPlus } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { unByKey } from 'ol/Observable';
import { TEMATICAS, miniatura, type Tematica } from '../../interfaz';
import { RESORTE, RESORTE_PANEL } from '../../movimiento';
import { escalaMinima } from '../../estilos';
import { acercarAEscala, cambiarCapas, cargarLeyenda, denominadorWms, suscribirCapas, type Visor } from '../../visor';
import { IconoTematica } from './iconos';

// "¿Qué querés ver?": el panel de capas del modo simple. Primero las temáticas, cada una con un dibujo
// y la miniatura de lo que trae; al tocar una, sus capas como tarjetas con miniatura, nombre de todos
// los días y una frase. Un toque prende o apaga. Nada de "capa", "entidad" ni nombres del IGN.
export default function PanelTemas({ visor }: { visor: Visor }) {
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  const [abierta, setAbierta] = useState<Tematica | null>(null);
  useEffect(() => suscribirCapas(visor, redibujar), [visor]);
  const ocultas = useOcultasPorEscala(visor);

  const viendo = visor.visibles.size;
  return (
    <section className="panel flex min-h-0 flex-col overflow-hidden" aria-label="Qué querés ver en el mapa">
      <AnimatePresence mode="popLayout" initial={false}>
        {!abierta ? (
          <motion.div
            key="tematicas"
            className="flex min-h-0 flex-col"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={RESORTE_PANEL}
          >
            <header className="px-5 pb-3 pt-5">
              <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.03em]">¿Qué querés ver?</h2>
              <div className="mt-1.5 flex items-center justify-between gap-3">
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
                        <img src={miniatura(t.capas[0].nombre)} alt="" loading="lazy" className="miniatura h-full w-full object-cover transition-transform duration-500 ease-[var(--ios)] group-hover:scale-[1.06]" />
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
            <Tematica visor={visor} tematica={abierta} ocultas={ocultas} onVolver={() => setAbierta(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
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
              {visible && ocultas.has(capa.nombre) && (
                <button
                  type="button"
                  onClick={() => acercarAEscala(visor, escalaMinima(capa.nombre)!)}
                  className="mt-1.5 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[var(--vial-suave)] text-[14px] font-semibold text-[var(--vial-texto)]"
                >
                  <MagnifyingGlassPlus size={17} weight="bold" /> Se ve de más cerca: acercarme
                </button>
              )}
              {visible && <Referencias nombre={capa.nombre} titulo={capa.titulo} />}
            </motion.li>
          );
        })}
      </ul>
    </>
  );
}

// La leyenda de una capa prendida, a pedido: "¿Qué significa cada color?".
export function Referencias({ nombre, titulo }: { nombre: string; titulo: string }) {
  const [abierta, setAbierta] = useState(false);
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    if (!abierta || src) return;
    const control = new AbortController();
    cargarLeyenda(nombre, control.signal, true).then(setSrc, () => {});
    return () => control.abort();
  }, [abierta, nombre, src]);
  return (
    <div className="px-2">
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        className="mt-1 flex h-8 items-center gap-1 rounded-lg px-1.5 text-[13px] font-medium text-[var(--tinta-2)] hover:text-[var(--tinta)]"
      >
        <CaretRight size={13} weight="bold" className={`transition-transform duration-300 ${abierta ? 'rotate-90' : ''}`} />
        ¿Qué significa cada color?
      </button>
      {abierta && src && <img className="leyenda-wms mb-1 ml-5 block max-w-[240px]" alt={`Qué significa cada color en ${titulo}`} src={src} />}
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
