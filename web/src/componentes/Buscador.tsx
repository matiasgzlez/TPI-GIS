import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Spinner } from '@heroui/react';
import { MagnifyingGlass, X, ClockCounterClockwise } from '@phosphor-icons/react';
import GeoJSON from 'ol/format/GeoJSON';
import { buffer } from 'ol/extent';
import { URL_WFS, WORKSPACE } from '../config';
import { borrarHistorial, buscar, DESTACADAS, guardarEnHistorial, leerHistorial, type Sugerencia } from '../comandos';
import type { Modo } from '../herramientas';
import EscudoRuta from './EscudoRuta';
import { ICONOS_ACCION, ICONOS_HERRAMIENTA, IconoCapa, IconoLugar } from './iconos';
import { GlowingEffect } from './ui/glowing-effect';

interface Seccion {
  titulo: string;
  items: Sugerencia[];
  borrable?: boolean;
}

interface Props {
  capaPrendida: (nombre: string) => boolean;
  onElegir: (sugerencia: Sugerencia) => void;
}

// Buscador central: con el campo vacío ofrece el historial y sugerencias; al escribir, acciones,
// herramientas, capas y lugares (WFS sobre localidades, sin servicios externos).
export default function Buscador({ capaPrendida, onElegir }: Props) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [lugares, setLugares] = useState<Sugerencia[]>([]);
  const [buscandoLugares, setBuscandoLugares] = useState(false);
  const [historial, setHistorial] = useState(leerHistorial);
  const entrada = useRef<HTMLInputElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const idLista = useId();

  // "/" o ⌘K desde cualquier parte del visor enfocan el buscador.
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      const escribiendo = e.target instanceof HTMLElement && e.target.closest('input, textarea');
      if ((e.key === '/' && !escribiendo) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        entrada.current?.focus();
      }
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, []);

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', afuera);
    return () => document.removeEventListener('pointerdown', afuera);
  }, [abierto]);

  useEffect(() => {
    const consulta = texto.trim();
    if (consulta.length < 2) {
      setLugares([]);
      return;
    }
    const control = new AbortController();
    const espera = setTimeout(async () => {
      setBuscandoLugares(true);
      // Los más poblados primero: "Resistencia" de Chaco antes que el paraje homónimo de Salta.
      const filtro = `nombre ILIKE '%${consulta.replaceAll("'", "''")}%'`;
      const url = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:localidades`
        + `&outputFormat=application/json&srsName=EPSG:3857&count=6&sortBy=canthab+D`
        + `&propertyName=geom,nombre,provincia,departamen,canthab&CQL_FILTER=${encodeURIComponent(filtro)}`;
      try {
        const datos = await (await fetch(url, { signal: control.signal })).json();
        const features = new GeoJSON().readFeatures(datos, { dataProjection: 'EPSG:3857' });
        setLugares(datos.features.map((f: { id: string; properties: Record<string, string | number> }, i: number) => {
          const habitantes = Number(f.properties.canthab) || 0;
          const lugar = [f.properties.departamen, f.properties.provincia].filter(Boolean).join(', ');
          return {
            id: `lugar:${f.id}`,
            tipo: 'lugar',
            titulo: String(f.properties.nombre),
            detalle: habitantes ? `${lugar} · ${habitantes.toLocaleString('es-AR')} hab.` : lugar,
            extension: buffer(features[i].getGeometry()!.getExtent(), 6000),
          } satisfies Sugerencia;
        }));
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setLugares([]);
      } finally {
        if (!control.signal.aborted) setBuscandoLugares(false);
      }
    }, 180);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [texto]);

  const secciones: Seccion[] = useMemo(() => {
    if (texto.trim().length === 0) {
      const destacadas = DESTACADAS.filter(d => !historial.some(h => h.id === d.id));
      return [
        { titulo: 'Recientes', items: historial, borrable: true },
        { titulo: 'Sugerencias', items: destacadas },
      ].filter(s => s.items.length);
    }
    const { acciones, capas } = buscar(texto);
    return [
      { titulo: 'Acciones', items: acciones },
      { titulo: 'Capas', items: capas },
      { titulo: 'Lugares', items: lugares },
    ].filter(s => s.items.length);
  }, [texto, lugares, historial]);

  const plano = secciones.flatMap(s => s.items);
  useEffect(() => setActivo(0), [texto]);

  function elegir(sugerencia: Sugerencia) {
    guardarEnHistorial(sugerencia);
    setHistorial(leerHistorial());
    setTexto('');
    setAbierto(false);
    entrada.current?.blur();
    onElegir(sugerencia);
  }

  function alPresionar(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAbierto(true);
      setActivo(i => (plano.length ? (i + 1) % plano.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo(i => (plano.length ? (i - 1 + plano.length) % plano.length : 0));
    } else if (e.key === 'Enter' && plano[activo]) {
      e.preventDefault();
      elegir(plano[activo]);
    } else if (e.key === 'Escape') {
      setAbierto(false);
      entrada.current?.blur();
    }
  }

  const sinResultados = abierto && texto.trim().length >= 2 && !plano.length && !buscandoLugares;
  let indice = -1;

  return (
    <div ref={contenedor} className="relative w-full">
      <div className="panel relative flex h-[60px] items-center gap-3 pl-5 pr-3 shadow-[var(--sombra-alta)]">
        <GlowingEffect variant="vial" spread={32} proximity={56} inactiveZone={0.3} borderWidth={2} glow disabled={false} />
        <MagnifyingGlass size={22} className="shrink-0 text-[var(--tinta-2)]" />
        <input
          ref={entrada}
          value={texto}
          onChange={e => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alPresionar}
          placeholder={window.matchMedia('(min-width: 640px)').matches ? 'Buscá un lugar, una capa o una herramienta' : 'Buscar en el mapa'}
          aria-label="Buscar"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-activedescendant={abierto && plano[activo] ? `${idLista}-${activo}` : undefined}
          aria-autocomplete="list"
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-medium text-[var(--tinta)] outline-none placeholder:font-normal placeholder:text-[var(--tinta-3)]"
        />
        {buscandoLugares && <Spinner size="sm" />}
        {texto ? (
          <button
            type="button"
            onClick={() => {
              setTexto('');
              entrada.current?.focus();
            }}
            aria-label="Borrar búsqueda"
            className="grid size-9 place-items-center rounded-full text-[var(--tinta-3)] hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]"
          >
            <X size={18} />
          </button>
        ) : (
          <kbd className="mr-1 rounded-lg bg-[var(--superficie-2)] px-2.5 py-1 text-[13px] font-medium text-[var(--tinta-3)] max-md:hidden">/</kbd>
        )}
      </div>

      {abierto && (secciones.length > 0 || sinResultados) && (
        <div id={idLista} role="listbox" aria-label="Sugerencias" className="despliega panel desplazable absolute inset-x-0 top-[68px] max-h-[min(560px,calc(100vh-120px))] overflow-y-auto p-2 shadow-[var(--sombra-alta)]">
          {sinResultados && (
            <p className="px-4 py-6 text-[15px] leading-relaxed text-[var(--tinta-2)]">
              No encontramos “{texto.trim()}”. Probá con una localidad (Resistencia), una capa (ríos, puentes) o una herramienta (medir).
            </p>
          )}
          {secciones.map(seccion => (
            <section key={seccion.titulo} className="pb-1">
              <div className="flex items-center justify-between px-3 pb-1.5 pt-3">
                <h3 className="text-[13px] font-semibold text-[var(--tinta-3)]">{seccion.titulo}</h3>
                {seccion.borrable && (
                  <button
                    type="button"
                    onClick={() => {
                      borrarHistorial();
                      setHistorial([]);
                    }}
                    className="rounded-md px-1.5 text-[13px] font-medium text-[var(--tinta-3)] hover:text-[var(--tinta)]"
                  >
                    Borrar
                  </button>
                )}
              </div>
              {seccion.items.map(item => {
                indice += 1;
                const i = indice;
                return (
                  <Fila
                    key={`${seccion.titulo}-${item.id}`}
                    id={`${idLista}-${i}`}
                    sugerencia={item}
                    reciente={!!seccion.borrable}
                    activa={i === activo}
                    prendida={item.tipo === 'capa' ? capaPrendida(item.id.slice(5)) : undefined}
                    onElegir={() => elegir(item)}
                    onApuntar={() => setActivo(i)}
                  />
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

interface FilaProps {
  id: string;
  sugerencia: Sugerencia;
  reciente: boolean;
  activa: boolean;
  prendida?: boolean;
  onElegir: () => void;
  onApuntar: () => void;
}

function Fila({ id, sugerencia, reciente, activa, prendida, onElegir, onApuntar }: FilaProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={activa}
      onPointerDown={e => e.preventDefault()}
      onClick={onElegir}
      onPointerMove={onApuntar}
      className={`flex min-h-[60px] cursor-pointer items-center gap-3.5 rounded-xl px-3 py-2 transition-colors ${activa ? 'bg-[var(--superficie-2)]' : ''}`}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-[11px] transition-colors ${activa ? 'bg-[var(--vial-suave)] text-[var(--vial-texto)]' : 'bg-[var(--superficie-2)] text-[var(--tinta-2)]'}`}>
        <Icono sugerencia={sugerencia} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-snug">{sugerencia.titulo}</span>
        <span className="flex items-center gap-1.5 truncate text-[13px] leading-snug text-[var(--tinta-3)]">
          {reciente && <ClockCounterClockwise size={13} className="shrink-0" />}
          {sugerencia.detalle}
        </span>
      </span>
      {prendida !== undefined && (
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${prendida ? 'bg-[var(--vial-suave)] text-[var(--vial-texto)]' : 'bg-[var(--superficie-2)] text-[var(--tinta-3)]'}`}>
          {prendida ? 'Prendida' : 'Apagada'}
        </span>
      )}
      {sugerencia.tecla && (
        <kbd className="shrink-0 rounded-lg bg-[var(--superficie-2)] px-2 py-0.5 text-[13px] font-medium text-[var(--tinta-3)]">{sugerencia.tecla}</kbd>
      )}
    </div>
  );
}

function Icono({ sugerencia }: { sugerencia: Sugerencia }) {
  if (sugerencia.id === 'accion:rn11') return <EscudoRuta className="h-[22px] w-auto" />;
  if (sugerencia.tipo === 'herramienta') {
    const Componente = ICONOS_HERRAMIENTA[sugerencia.id.slice(12) as Modo];
    return <Componente size={20} />;
  }
  if (sugerencia.tipo === 'capa') return <IconoCapa size={20} />;
  if (sugerencia.tipo === 'lugar') return <IconoLugar size={20} />;
  const Componente = ICONOS_ACCION[sugerencia.id] ?? IconoCapa;
  return <Componente size={20} />;
}
