import { useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { CAPAS, GRUPOS } from '../../../config';

// Piezas compartidas por los paneles del cajón del modo profesional (Análisis, Datos, Navegación y Base de
// datos): el armazón con título y bajada, los campos y los botones, con la letra grande del profesional.

export function PanelCajon({ titulo, bajada, children, pie }: { titulo: string; bajada: string; children: React.ReactNode; pie?: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="px-5 pb-4 pt-[18px] pr-16">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{titulo}</h2>
        <p className="mt-1.5 text-[15px] leading-snug text-[var(--tinta-3)]">{bajada}</p>
      </header>
      <div tabIndex={-1} className="desplazable min-h-0 flex-1 overflow-y-auto border-t border-[var(--linea)] px-5 py-4">
        {children}
      </div>
      {pie && <div className="shrink-0 border-t border-[var(--linea)] px-5 py-3 text-[14px] leading-snug text-[var(--tinta-3)]">{pie}</div>}
    </section>
  );
}

export const campo = 'h-11 w-full rounded-xl bg-[var(--superficie-2)] px-3 text-[16px] text-[var(--tinta)] outline-none placeholder:text-[var(--tinta-3)] focus-visible:shadow-[0_0_0_2px_var(--focus)]';

export function Campo({ rotulo, children, ayuda }: { rotulo: string; children: React.ReactNode; ayuda?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[15px] font-semibold text-[var(--tinta-2)]">{rotulo}</span>
      {children}
      {ayuda && <span className="text-[14px] text-[var(--tinta-3)]">{ayuda}</span>}
    </label>
  );
}

export function Boton({ children, principal, className = '', ...props }: React.ComponentProps<'button'> & { principal?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[16px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-50 ${principal
        ? 'bg-[var(--vial-fuerte)] text-white hover:bg-[color-mix(in_srgb,var(--vial-fuerte),#000_18%)]'
        : 'bg-[var(--superficie-2)] text-[var(--tinta)] hover:bg-[var(--superficie-3)]'} ${className}`}
    >
      {children}
    </button>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--tinta-3)]">{titulo}</h3>
      {children}
    </section>
  );
}

// Las 48 capas, agrupadas por tema, para elegir en un <select>.
export function OpcionesCapas({ filtro }: { filtro?: (nombre: string) => boolean }) {
  return GRUPOS.map(g => {
    const capas = g.capas.filter(c => !filtro || filtro(c.nombre));
    return capas.length ? (
      <optgroup key={g.id} label={g.titulo}>
        {capas.map(c => <option key={c.nombre} value={c.nombre}>{c.titulo}</option>)}
      </optgroup>
    ) : null;
  });
}

export const geometriaDe = (nombre: string) => CAPAS.find(c => c.nombre === nombre)?.geometria;

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Un valor técnico (una URL, una coordenada) con su botón de copiar.
export function Copiable({ rotulo, valor }: { rotulo: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--superficie-2)] py-2 pl-3 pr-1.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[var(--tinta-3)]">{rotulo}</div>
        <div className="truncate font-mono text-[14.5px] text-[var(--tinta)]" title={valor}>{valor}</div>
      </div>
      <button
        type="button"
        aria-label={`Copiar ${rotulo}`}
        title="Copiar"
        onClick={() => navigator.clipboard.writeText(valor).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); })}
        className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--tinta-2)] transition-colors hover:bg-[var(--superficie-3)] hover:text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
      >
        {copiado ? <Check size={18} weight="bold" className="text-[var(--acento-tinta)]" /> : <Copy size={18} weight="bold" />}
      </button>
    </div>
  );
}

export const miles = (n: number, decimales = 0) => n.toLocaleString('es-AR', { maximumFractionDigits: decimales });
