import { memo } from 'react';
import { BookOpen, Check, GridFour, ListBullets, MapTrifold, Moon, Pause, Question, Sun } from '@phosphor-icons/react';
import type { Preferencias, Tamano } from '../../preferencias';
import Notch from './Notch';

// "Ajustes" en el escritorio del modo simple: la pastilla del borde derecho, espejo de "Capas" (ver Notch).
// Pensado para alguien que no es del tema: todo grande, en dos columnas y sin palabras técnicas. A la
// izquierda cómo se ve (dos tarjetas con un dibujito del mapa claro y oscuro, y tres "Aa" de tamaños), a la
// derecha las ayudas del mapa como interruptores grandes, y abajo las referencias, la guía y el manual.
interface Props {
  preferencias: Preferencias;
  onCambiar: <K extends keyof Preferencias>(clave: K, valor: Preferencias[K]) => void;
  oscuro: boolean;
  onTema: (oscuro: boolean) => void;
  onGuia: () => void;
  onManual: () => void;
  onReferencias: () => void;
}

const TAMANOS: { valor: Tamano; etiqueta: string; letra: number }[] = [
  { valor: 'compacto', etiqueta: 'Chico', letra: 19 },
  { valor: 'normal', etiqueta: 'Normal', letra: 25 },
  { valor: 'grande', etiqueta: 'Grande', letra: 32 },
];

export default memo(function NotchAjustes({ preferencias, onCambiar, oscuro, onTema, onGuia, onManual, onReferencias }: Props) {
  return (
    <Notch lado="derecha" alto="contenido" etiqueta="Ajustes" id="ajustes-simple" titulo={<h2 className="text-[26px] font-bold tracking-[-0.025em]">Ajustes</h2>}>
      <div className="grid grid-cols-2 gap-x-7 gap-y-5 px-6 pb-5">
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <h3 className="text-[16px] font-bold text-[var(--tinta-3)]">Colores</h3>
            <div role="radiogroup" aria-label="Colores" className="grid grid-cols-2 gap-3">
              <TarjetaTema oscuro={false} elegida={!oscuro} onElegir={() => onTema(false)} />
              <TarjetaTema oscuro elegida={oscuro} onElegir={() => onTema(true)} />
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <h3 className="text-[16px] font-bold text-[var(--tinta-3)]">Tamaño de las letras</h3>
            <div role="radiogroup" aria-label="Tamaño de los botones y las letras" className="grid grid-cols-3 gap-3">
              {TAMANOS.map(t => {
                const elegida = preferencias.tamano === t.valor;
                return (
                  <button
                    key={t.valor}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    aria-label={t.etiqueta}
                    onClick={() => onCambiar('tamano', t.valor)}
                    className="opcion-ajuste flex h-[84px] flex-col items-center justify-center gap-1 rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <span aria-hidden="true" className="flex h-[36px] items-end font-bold leading-none tracking-[-0.03em]" style={{ fontSize: t.letra }}>Aa</span>
                    <span className="text-[15px] font-bold">{t.etiqueta}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="text-[16px] font-bold text-[var(--tinta-3)]">En el mapa</h3>
          <div className="flex flex-col gap-2">
            <Llave titulo="Líneas para ubicarse" icono={<GridFour size={24} weight="bold" />} valor={preferencias.cuadricula} onCambiar={v => onCambiar('cuadricula', v)} />
            <Llave titulo="Mapa chiquito de dónde estás" icono={<MapTrifold size={24} weight="bold" />} valor={preferencias.minimapa} onCambiar={v => onCambiar('minimapa', v)} />
            <Llave titulo="Menos movimiento" icono={<Pause size={24} weight="bold" />} valor={preferencias.movimientoReducido} onCambiar={v => onCambiar('movimientoReducido', v)} />
          </div>
        </section>

        <div className="col-span-2 grid grid-cols-3 gap-3">
          <button type="button" onClick={onReferencias} className="boton-ajuste flex h-[56px] items-center justify-center gap-2.5 rounded-[18px] bg-white text-[17px] font-bold text-[#0b0c0e] focus-visible:outline-2 focus-visible:outline-offset-2">
            <ListBullets size={22} weight="bold" /> Referencias
          </button>
          <button type="button" onClick={onGuia} className="boton-ajuste flex h-[56px] items-center justify-center gap-2.5 rounded-[18px] bg-[var(--superficie-2)] text-[17px] font-bold hover:bg-[var(--superficie-3)] focus-visible:outline-2 focus-visible:outline-offset-2">
            <Question size={22} weight="bold" /> Ver la guía
          </button>
          <button type="button" onClick={onManual} className="boton-ajuste flex h-[56px] items-center justify-center gap-2.5 rounded-[18px] bg-[var(--superficie-2)] text-[17px] font-bold hover:bg-[var(--superficie-3)] focus-visible:outline-2 focus-visible:outline-offset-2">
            <BookOpen size={22} weight="bold" /> Manual
          </button>
        </div>
      </div>
    </Notch>
  );
});

// Claro u oscuro, con un dibujito del mapa en esos colores: se elige mirando, no leyendo.
function TarjetaTema({ oscuro, elegida, onElegir }: { oscuro: boolean; elegida: boolean; onElegir: () => void }) {
  const fondo = oscuro ? '#15181c' : '#f2efe8';
  const tierra = oscuro ? '#23272d' : '#fbf1da';
  const borde = oscuro ? '#4a5058' : '#b9b3a6';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegida}
      aria-label={oscuro ? 'Oscuro' : 'Claro'}
      onClick={onElegir}
      className="opcion-ajuste opcion-tema relative flex flex-col gap-2 rounded-[20px] p-2 pb-2.5 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <svg aria-hidden="true" viewBox="0 0 120 64" className="block h-[60px] w-full rounded-[14px]" preserveAspectRatio="xMidYMid slice">
        <rect width="120" height="64" fill={fondo} />
        <path d="M18 8 L70 6 L78 30 L96 40 L92 58 L30 60 L22 34 Z" fill={tierra} stroke={borde} strokeWidth="1.2" strokeDasharray="3 2" />
        <path d="M0 50 C 30 44, 50 30, 120 18" fill="none" stroke="#e8833a" strokeWidth="3" strokeLinecap="round" />
        <path d="M96 0 C 92 20, 104 36, 98 64" fill="none" stroke={oscuro ? '#4f7fa8' : '#8db4d6'} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="58" cy="34" r="3.2" fill="#d23c3c" />
      </svg>
      <span className="flex items-center justify-center gap-2 text-[17px] font-bold">
        {oscuro ? <Moon size={19} weight="fill" /> : <Sun size={19} weight="fill" />} {oscuro ? 'Oscuro' : 'Claro'}
      </span>
      <span aria-hidden="true" className="opcion-tema-marca absolute right-3.5 top-3.5 grid size-7 place-items-center rounded-full bg-white text-[#0b0c0e] shadow-[0_2px_8px_rgba(0,0,0,.3)]">
        <Check size={15} weight="bold" />
      </span>
    </button>
  );
}

// Un interruptor grande: toda la fila se toca, con un dibujo, el nombre en negrita y la llave a la derecha.
function Llave({ titulo, icono, valor, onCambiar }: { titulo: string; icono: React.ReactNode; valor: boolean; onCambiar: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      onClick={() => onCambiar(!valor)}
      className="fila-llave flex min-h-[64px] w-full items-center gap-3.5 rounded-[18px] bg-[var(--superficie-2)] px-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-[var(--superficie-3)]">{icono}</span>
      <span className="min-w-0 flex-1 text-[17px] font-bold leading-tight">{titulo}</span>
      <span aria-hidden="true" className="llave-capa" data-prendida={valor || undefined}><span /></span>
    </button>
  );
}
