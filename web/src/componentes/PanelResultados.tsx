import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Spinner } from '@heroui/react';
import { X, CaretDown, ArrowsOutSimple, MagnifyingGlass, Ruler, WarningCircle } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { buffer } from 'ol/extent';
import type { Consulta, Entidad, Medicion } from '../herramientas';
import { volarA, type Visor } from '../visor';
import { datosClave, datosSimples, nombrePro, nombreSimple, rotulo, rotuloSimple, tipoSimple } from '../entidades';
import { Barras, NumeroAnimado } from './ui/graficos';
import { TEMATICAS, capaSimple, miniatura, sinSiglas, tituloSimple, useInterfaz, useVoz } from '../interfaz';
import { IconoTematica } from './simple/iconos';
import { RESORTE_SUAVE } from '../movimiento';
import { tituloDeCapa } from '../config';
import { ubicarEntidades } from '../cercanias';

export type EstadoResultados =
  | { tipo: 'cargando'; origen: Consulta['origen'] }
  | { tipo: 'consulta'; consulta: Consulta }
  | { tipo: 'medicion'; medicion: Medicion }
  | { tipo: 'error'; mensaje: string };

interface Props {
  visor: Visor;
  estado: EstadoResultados;
  onCerrar: () => void;
}

type Hablar = ReturnType<typeof useVoz>;

// El escritorio del modo simple tiene su propia versión, negra y grande como las pastillas (ResultadosSimple,
// más abajo); el profesional y el celular siguen con este panel.
const ANCHO_ESCRITORIO = '(min-width: 1024px)';
const escucharAncho = (avisar: () => void) => { const m = matchMedia(ANCHO_ESCRITORIO); m.addEventListener('change', avisar); return () => m.removeEventListener('change', avisar); };
export default function PanelResultados(props: Props) {
  const simple = useInterfaz() === 'simple';
  const escritorio = useSyncExternalStore(escucharAncho, () => matchMedia(ANCHO_ESCRITORIO).matches);
  return simple && escritorio ? <ResultadosSimple {...props} /> : <PanelComun {...props} />;
}

function PanelComun({ visor, estado, onCerrar }: Props) {
  const voz = useVoz();
  return (
    <section className="entra panel flex max-h-full min-h-0 flex-col overflow-hidden" style={{ '--desde': '8px' } as React.CSSProperties} aria-live="polite">
      <header className="flex items-start gap-3 border-b border-[var(--linea)] py-4 pl-5 pr-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[19px] font-semibold leading-tight tracking-[-0.02em]">{titulo(estado, voz)}</h2>
          <p className="mt-0.5 truncate text-[14px] text-[var(--tinta-3)]">{subtitulo(estado, voz)}</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar resultados"
          className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--tinta-2)] transition-colors hover:bg-[var(--superficie-2)] hover:text-[var(--tinta)]"
        >
          <X size={19} />
        </button>
      </header>

      <div className="desplazable min-h-0 flex-1 overflow-y-auto">
        {estado.tipo === 'cargando' && (
          <div className="flex items-center gap-3 px-5 py-7 text-[15px] text-[var(--tinta-2)]">
            <Spinner size="sm" /> {voz('cargando')}
          </div>
        )}
        {estado.tipo === 'error' && (
          <div className="px-5 py-6 text-[15px] leading-relaxed">
            <p className="font-medium text-[var(--danger)]">{estado.mensaje}</p>
            <p className="mt-2 text-[var(--tinta-2)]">{voz('errorAyuda')}</p>
          </div>
        )}
        {estado.tipo === 'medicion' && <Medida medicion={estado.medicion} />}
        {estado.tipo === 'consulta' && <Lista visor={visor} consulta={estado.consulta} />}
      </div>
    </section>
  );
}

const ORIGEN = { punto: 'origenPunto', rectangulo: 'origenRectangulo', lenguaje: 'origenLenguaje' } as const;

function titulo(estado: EstadoResultados, voz: Hablar) {
  if (estado.tipo === 'medicion') {
    if (voz('capa') === 'tema') return estado.medicion.tipo === 'distancia' ? 'Qué tan lejos' : 'Qué tan grande';
    return estado.medicion.tipo === 'distancia' ? 'Longitud geodésica' : 'Área geodésica';
  }
  // Las respuestas a preguntas dicen "la RN11": en el modo simple, "la ruta 11".
  if (estado.tipo === 'consulta' && estado.consulta.titulo) {
    if (voz('capa') !== 'tema') return estado.consulta.titulo;
    return tituloSimple(estado.consulta.titulo, estado.consulta.capas);
  }
  if (estado.tipo === 'consulta' || estado.tipo === 'cargando') {
    return voz(ORIGEN[estado.tipo === 'consulta' ? estado.consulta.origen : estado.origen]);
  }
  return voz('origenPunto');
}

function subtitulo(estado: EstadoResultados, voz: Hablar) {
  if (estado.tipo === 'cargando') return voz('buscando');
  if (estado.tipo === 'error') return 'No se pudo consultar';
  if (estado.tipo === 'medicion') {
    if (!estado.medicion.terminada) return 'Midiendo…';
    // ol/sphere: sobre la esfera de radio medio del WGS 84 (no el elipsoide). Sin números con unidad: la
    // batería toma el primero que aparece como la medida.
    return voz('capa') === 'tema' ? 'Medido sobre la forma real de la Tierra' : 'Sobre la esfera de radio medio del WGS 84 · ol/sphere';
  }
  const total = estado.consulta.capas.reduce((s, c) => s + c.total, 0);
  if (!total) return voz('sinEntidades');
  const capas = estado.consulta.capas.length;
  const conteo = `${total.toLocaleString('es-AR')} ${total === 1 ? voz('entidad') : voz('entidades')} en ${capas} ${capas === 1 ? voz('capa') : voz('capas')}`;
  if (voz('capa') === 'tema') return conteo;
  // En el profesional, con qué servicio se consultó.
  const servicio = { punto: 'WMS GetFeatureInfo', rectangulo: 'WFS GetFeature · BBOX', lenguaje: 'WFS GetFeature' }[estado.consulta.origen];
  return `${conteo} · ${servicio}`;
}

function Medida({ medicion }: { medicion: Medicion }) {
  const voz = useVoz();
  const partes = medicion.texto.split(' ');
  return (
    <div className="px-5 pb-6 pt-5">
      <div className="flex items-baseline gap-2">
        <span className="text-[44px] font-semibold leading-none tracking-[-0.03em]">{partes.slice(0, -1).join(' ')}</span>
        <span className="text-[18px] font-medium text-[var(--tinta-2)]">{partes.at(-1)}</span>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-[var(--tinta-2)]">
        {voz('capa') === 'tema'
          ? (medicion.terminada ? 'Tocá el mapa de nuevo para medir otra vez.' : 'Tocá dos veces para terminar.')
          : (medicion.terminada ? 'Hacé clic de nuevo en el mapa para empezar otra medición.' : 'Doble clic para terminar.')}
      </p>
    </div>
  );
}

function Lista({ visor, consulta }: { visor: Visor; consulta: Consulta }) {
  const voz = useVoz();
  const simple = useInterfaz() === 'simple';
  const ubicaciones = useUbicaciones(consulta, simple);

  // En el modo simple, cada grupo se llama como en "¿Qué querés ver?" (Escuelas, no Educación).
  if (simple) consulta = { ...consulta, capas: consulta.capas.map(c => ({ ...c, titulo: capaSimple(c.capa)?.titulo ?? c.titulo })) };
  if (!consulta.capas.length) {
    return (
      <p className="px-5 py-6 text-[15px] leading-relaxed text-[var(--tinta-2)]">
        {consulta.origen === 'punto'
          ? voz('vacioPunto')
          : consulta.origen === 'lenguaje'
            ? 'No hay resultados para esa pregunta. Probá con una distancia mayor u otro lugar.'
            : voz('vacioRectangulo')}
      </p>
    );
  }
  const { destacada, capas } = repartir(consulta);
  return (
    <div className="pb-2">
      {destacada && <Ficha visor={visor} entidad={destacada} capa={consulta.capas[0].titulo} />}
      {consulta.origen !== 'punto' && <Resumen visor={visor} consulta={consulta} />}
      {capas.map(capa => (
        <section key={capa.capa}>
          <div className="sticky top-0 z-[1] flex items-baseline gap-2 border-b border-[var(--linea)] bg-[var(--superficie)] px-5 pb-2 pt-3.5">
            <h3 className="flex-1 text-[13px] font-semibold text-[var(--tinta-3)]">{capa.titulo}</h3>
            <span className="text-[13px] font-medium text-[var(--tinta-3)]">
              {capa.entidades.length < capa.total
                ? `${capa.entidades.length} de ${capa.total.toLocaleString('es-AR')}`
                : capa.total.toLocaleString('es-AR')}
            </span>
          </div>
          <ul className="divide-y divide-[var(--linea)]">
            {capa.entidades.map(entidad => <Fila key={entidad.id} visor={visor} entidad={entidad} donde={ubicaciones.get(entidad.id)} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

// En la consulta por punto, lo de más arriba se presenta como ficha y el resto queda listado abajo.
function repartir(consulta: Consulta) {
  const destacada: Entidad | undefined = consulta.origen === 'punto' ? consulta.capas[0].entidades[0] : undefined;
  const otras = consulta.capas.flatMap(c => c.entidades).filter(e => e !== destacada);
  const capas = consulta.origen === 'punto'
    ? consulta.capas.map(c => ({ ...c, entidades: c.entidades.filter(e => otras.includes(e)) })).filter(c => c.entidades.length)
    : consulta.capas;
  return { destacada, capas };
}

// Las cosas que se llaman igual en la lista ("Escuela Provincial" ×12) se distinguen por el pueblo más cercano.
function useUbicaciones(consulta: Consulta, simple: boolean) {
  const repetidas = useMemo(() => {
    // Repetidas dentro de la misma capa: la provincia "Corrientes" no se confunde con la ciudad.
    const nombrar = simple ? nombreSimple : nombrePro;
    return consulta.capas.flatMap(c => {
      const cuenta = new Map<string, number>();
      for (const e of c.entidades) { const n = nombrar(e.atributos) ?? ''; cuenta.set(n, (cuenta.get(n) ?? 0) + 1); }
      return c.entidades.filter(e => (cuenta.get(nombrar(e.atributos) ?? '') ?? 0) > 1);
    });
  }, [consulta, simple]);
  const [ubicaciones, setUbicaciones] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    setUbicaciones(new Map());
    if (!repetidas.length) return;
    const control = new AbortController();
    ubicarEntidades(repetidas, control.signal).then(setUbicaciones).catch(() => {});
    return () => control.abort();
  }, [repetidas]);
  return ubicaciones;
}

const VISIBLES = 4;

// Resumen de la consulta por rectángulo: totales, cuántas entidades hay por capa y de qué tipo son
// las de la capa con más resultados. Pasar el mouse por una barra las resalta en el mapa.
function Resumen({ visor, consulta }: { visor: Visor; consulta: Consulta }) {
  const simple = useInterfaz() === 'simple';
  const voz = useVoz();
  const total = consulta.capas.reduce((s, c) => s + c.total, 0);
  const localidades = consulta.capas.find(c => c.capa === 'localidades');
  const habitantes = localidades && localidades.entidades.length === localidades.total
    ? localidades.entidades.reduce((s, e) => s + Number(e.atributos.find(([k]) => k === 'canthab')?.[1].replace(/\./g, '') ?? 0), 0)
    : undefined;
  const mayor = [...consulta.capas].sort((a, b) => b.total - a.total)[0];
  const tipos = new Map<string, number>();
  for (const e of mayor.entidades) {
    const original = e.atributos.find(([k]) => k === 'tipo')?.[1];
    // En el modo simple, el tipo del IGN traducido ("Laguna que a veces se seca", no "Lago o Laguna Intermitente").
    const tipo = original && (simple ? tipoSimple(original) : original);
    if (tipo) tipos.set(tipo, (tipos.get(tipo) ?? 0) + 1);
  }
  const resaltar = (capa: string | null) => {
    visor.foco.clear();
    const encontrada = consulta.capas.find(c => c.capa === capa);
    if (encontrada) visor.foco.addFeatures(encontrada.entidades.map(e => e.feature));
  };
  return (
    <section className="border-b border-[var(--linea)] px-5 pb-5 pt-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-3">
        <Cifra titulo={mayuscula(voz('entidades'))}><NumeroAnimado valor={total} /></Cifra>
        <Cifra titulo={mayuscula(voz('capas'))}><NumeroAnimado valor={consulta.capas.length} /></Cifra>
        {habitantes !== undefined && <Cifra titulo={simple ? 'Personas' : 'Habitantes'}><NumeroAnimado valor={habitantes} /></Cifra>}
      </div>
      <h3 className="mb-3 mt-5 text-[13px] font-semibold text-[var(--tinta-3)]">Por {voz('capa')}</h3>
      <Barras
        datos={[...consulta.capas].sort((a, b) => b.total - a.total).map(c => ({ id: c.capa, etiqueta: c.titulo, valor: c.total }))}
        onApuntar={dato => resaltar(dato?.id ?? null)}
      />
      {tipos.size > 1 && (
        <>
          <h3 className="mb-3 mt-5 text-[13px] font-semibold text-[var(--tinta-3)]">
            {simple ? `${mayor.titulo}: qué hay` : `${mayor.titulo} por tipo`}{mayor.entidades.length < mayor.total ? ` (de ${simple ? 'los' : 'las'} ${mayor.entidades.length} ${simple ? 'que se ven' : 'mostradas'})` : ''}
          </h3>
          <Barras datos={[...tipos].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tipo, n]) => ({ id: tipo, etiqueta: tipo, valor: n, color: 'var(--dato-2)' }))} />
        </>
      )}
    </section>
  );
}

function Cifra({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--superficie-2)] px-3 py-2.5">
      <div className="text-[12px] font-medium text-[var(--tinta-3)]">{titulo}</div>
      <div className="mt-0.5 text-[22px] font-semibold leading-tight tracking-[-0.02em]">{children}</div>
    </div>
  );
}

// Lo más importante del lugar consultado, para entenderlo de un vistazo.
function Ficha({ visor, entidad, capa }: { visor: Visor; entidad: Entidad; capa: string }) {
  const simple = useInterfaz() === 'simple';
  const nombre = (simple ? nombreSimple(entidad.atributos) : nombrePro(entidad.atributos)) ?? 'Sin nombre';
  const datos = simple ? datosSimples(entidad.atributos).slice(0, 4) : datosClave(entidad.atributos, 3);
  const nombreCampo = simple ? rotuloSimple : rotulo;
  const encuadrar = () => volarA(visor, buffer(entidad.feature.getGeometry()!.getExtent(), 2500), { maxZoom: 13 });
  return (
    <section className="border-b border-[var(--linea)] px-5 pb-5 pt-4">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--vial-suave)] px-2.5 py-1 text-[12px] font-semibold text-[var(--vial-texto)]">
        <span className="size-1.5 rounded-full bg-[var(--vial)]" />
        {capa}
      </span>
      <h3 className="mt-2.5 text-[24px] font-semibold leading-tight tracking-[-0.02em]">{nombre}</h3>
      {datos.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5">
          {datos.map(([clave, valor]) => (
            <div key={clave} className={valor.length > 22 ? 'col-span-2' : ''}>
              <dt className="text-[12px] font-medium text-[var(--tinta-3)]">{nombreCampo(clave)}</dt>
              <dd className={`mt-0.5 font-semibold leading-snug ${clave === 'canthab' ? 'text-[22px] tracking-[-0.02em]' : 'text-[15px]'}`}>{valor}</dd>
            </div>
          ))}
        </dl>
      )}
      <button
        type="button"
        onClick={encuadrar}
        className="mt-4 flex h-10 items-center gap-2 rounded-xl bg-[var(--superficie-2)] px-3.5 text-[14px] font-medium hover:bg-[var(--superficie-3)]"
      >
        <ArrowsOutSimple size={16} /> Acercar
      </button>
    </section>
  );
}

function Fila({ visor, entidad, donde }: { visor: Visor; entidad: Entidad; donde?: string }) {
  const [abierta, setAbierta] = useState(false);
  // En el modo simple, solo los datos que entiende cualquiera (sin "ver más" con los campos del IGN).
  const simple = useInterfaz() === 'simple';
  const nombre = simple ? nombreSimple(entidad.atributos) : nombrePro(entidad.atributos);
  const atributos = simple ? datosSimples(entidad.atributos) : entidad.atributos.filter(([, v]) => v !== nombre && !/^sin nombre$/i.test(v));
  const nombreCampo = simple ? rotuloSimple : rotulo;
  const mostrados = abierta ? atributos : atributos.slice(0, VISIBLES);

  const enfocar = () => {
    visor.foco.clear();
    visor.foco.addFeature(entidad.feature);
  };
  const encuadrar = () => volarA(visor, buffer(entidad.feature.getGeometry()!.getExtent(), 2500), { maxZoom: 13 });

  return (
    <li
      onMouseEnter={enfocar}
      onMouseLeave={() => visor.foco.clear()}
      onFocus={enfocar}
      className="group px-5 py-3.5 transition-colors hover:bg-[var(--superficie-2)]"
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold leading-snug">{nombre ?? 'Sin nombre'}</div>
          {donde && <div className="truncate text-[13.5px] font-medium text-[var(--tinta-2)]">{donde}</div>}
        </div>
        <button
          type="button"
          onClick={encuadrar}
          aria-label={`Acercar a ${nombre ?? entidad.id}${donde ? `, ${donde.charAt(0).toLowerCase()}${donde.slice(1)}` : ''}`}
          title="Acercar"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--tinta-3)] transition-colors hover:bg-[var(--superficie-3)] hover:text-[var(--tinta)]"
        >
          <ArrowsOutSimple size={17} />
        </button>
      </div>
      {mostrados.length > 0 && (
        <dl className="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[14px]">
          {mostrados.map(([clave, valor]) => (
            <div key={clave} className="contents">
              <dt className="truncate text-[var(--tinta-3)]">{nombreCampo(clave)}</dt>
              <dd className="truncate text-[var(--tinta)]" title={valor}>{valor}</dd>
            </div>
          ))}
        </dl>
      )}
      {atributos.length > VISIBLES && (
        <button
          type="button"
          onClick={() => setAbierta(!abierta)}
          className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--tinta-2)] hover:text-[var(--tinta)]"
        >
          {abierta ? 'Ver menos' : `Ver ${atributos.length - VISIBLES} datos más`}
          <CaretDown size={12} weight="bold" className={`transition-transform ${abierta ? 'rotate-180' : ''}`} />
        </button>
      )}
    </li>
  );
}

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

// --- Escritorio del modo simple ---
// Va adentro del notch de la derecha (NotchResultados.tsx), que reemplaza al de Ajustes: arriba lo tocado, como
// una ficha (foto del tema, nombre bien grande, la gente que vive ahí contada desde cero, los datos y "Acercar"),
// y abajo lo demás que hay cerca, agrupado por tema con su color y su dibujo. El notch tiene tamaño
// fijo (todo el alto hasta el minimapa) y la lista se desplaza. La zona marcada: los
// números y una barra por tema, y abajo la lista. La medida, una sola fila con el número grande.
const temaDe = (capa: string) => TEMATICAS.find(t => t.capas.some(c => c.nombre === capa));
const numero = (texto: string) => { const n = Number(texto.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : undefined; };

function ResultadosSimple({ visor, estado, onCerrar }: Props) {
  const voz = useVoz();
  return (
    <section
      className="resultados-simple flex max-h-full min-h-0 flex-col overflow-hidden text-[var(--tinta)]"
      aria-live="polite"
    >
      <header className="flex items-center gap-4 pb-4 pl-7 pr-5 pt-5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[26px] font-bold leading-[1.1] tracking-[-0.025em]">{titulo(estado, voz)}</h2>
          <p className="mt-1 truncate text-[16px] font-semibold text-[var(--tinta-3)]">{subtitulo(estado, voz)}</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar resultados"
          title="Cerrar"
          className="boton-cerrar-simple grid size-12 shrink-0 place-items-center rounded-full bg-[var(--superficie-2)] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X size={22} weight="bold" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
        {estado.tipo === 'cargando' && <Esqueleto />}
        {estado.tipo === 'error' && <Aviso icono={<WarningCircle size={30} weight="fill" />} titulo={estado.mensaje} texto={voz('errorAyuda')} />}
        {estado.tipo === 'medicion' && <MedidaSimple medicion={estado.medicion} />}
        {estado.tipo === 'consulta' && <ListaSimple visor={visor} consulta={estado.consulta} />}
      </div>
    </section>
  );
}

// Mientras busca: la forma de lo que va a aparecer, con un brillo que la recorre.
function Esqueleto() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-[26px] bg-[var(--superficie-2)] p-4">
        <div className="flex items-center gap-4">
          <div className="esqueleto size-[96px] shrink-0 rounded-[18px]" />
          <div className="flex flex-1 flex-col gap-2.5"><div className="esqueleto h-5 w-1/3 rounded-full" /><div className="esqueleto h-8 w-3/4 rounded-[10px]" /></div>
        </div>
        <div className="grid grid-cols-3 gap-2"><div className="esqueleto h-[68px] rounded-[16px]" /><div className="esqueleto h-[68px] rounded-[16px]" /><div className="esqueleto h-[68px] rounded-[16px]" /></div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="esqueleto h-6 w-1/2 rounded-full" />
        <div className="esqueleto h-[64px] rounded-[18px]" />
        <div className="esqueleto h-[64px] rounded-[18px]" />
      </div>
    </div>
  );
}

function Aviso({ icono, titulo: texto1, texto }: { icono: React.ReactNode; titulo: string; texto: string }) {
  return (
    <div className="flex items-center gap-5 rounded-[24px] bg-[var(--superficie-2)] p-5">
      <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--superficie-3)] text-[var(--tinta)]">{icono}</span>
      <div className="min-w-0">
        <p className="text-[20px] font-bold leading-snug tracking-[-0.015em]">{texto1}</p>
        <p className="mt-1 text-[17px] font-medium leading-snug text-[var(--tinta-2)]">{texto}</p>
      </div>
    </div>
  );
}

function MedidaSimple({ medicion }: { medicion: Medicion }) {
  const partes = medicion.texto.split(' ');
  return (
    <div className="flex items-center gap-5 rounded-[24px] bg-[var(--superficie-2)] p-5">
      <span className="grid size-16 shrink-0 place-items-center rounded-full bg-[var(--vial)] text-white"><Ruler size={30} weight="fill" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-[56px] font-bold leading-none tracking-[-0.045em] tabular-nums">{partes.slice(0, -1).join(' ')}</span>
          <span className="text-[24px] font-bold text-[var(--tinta-2)]">{partes.at(-1)}</span>
        </div>
        <p className="mt-2 text-[17px] font-medium leading-snug text-[var(--tinta-2)]">
          {medicion.terminada ? 'Tocá el mapa de nuevo para medir otra vez.' : 'Tocá dos veces para terminar.'}
        </p>
      </div>
    </div>
  );
}

function ListaSimple({ visor, consulta }: { visor: Visor; consulta: Consulta }) {
  const voz = useVoz();
  const ubicaciones = useUbicaciones(consulta, true);
  consulta = { ...consulta, capas: consulta.capas.map(c => ({ ...c, titulo: capaSimple(c.capa)?.titulo ?? c.titulo })) };
  if (!consulta.capas.length) {
    const texto = consulta.origen === 'punto' ? voz('vacioPunto') : consulta.origen === 'lenguaje' ? 'Probá con una distancia mayor u otro lugar.' : voz('vacioRectangulo');
    return <Aviso icono={<MagnifyingGlass size={28} weight="bold" />} titulo="No encontramos nada" texto={texto} />;
  }
  const { destacada, capas } = repartir(consulta);
  const izquierda = destacada
    ? <FichaSimple visor={visor} entidad={destacada} capa={consulta.capas[0].capa} titulo={consulta.capas[0].titulo} />
    : <ResumenSimple visor={visor} consulta={consulta} />;
  if (!capas.length) return izquierda;
  let orden = 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0">{izquierda}</div>
      {/* Abajo, lo demás: crece con lo que haya hasta el alto del notch y después se desplaza. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="lado-lista desplazable min-h-0 flex-1 overflow-y-auto pr-1">
          <h3 className="px-1 pb-1 text-[20px] font-bold tracking-[-0.02em]">{destacada ? 'También acá cerca' : 'Una por una'}</h3>
          {capas.map(capa => {
            const tema = temaDe(capa.capa);
            return (
              <section key={capa.capa} aria-label={capa.titulo}>
                <div className="sticky top-0 z-[1] flex items-center gap-2.5 bg-[var(--notch-fondo)] px-1 pb-2 pt-3">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: tema?.color ?? 'var(--vial)' }}>
                    <IconoTematica id={tema?.id ?? ''} size={16} />
                  </span>
                  <h4 className="min-w-0 flex-1 truncate text-[17px] font-bold">{capa.titulo}</h4>
                  <span className="flex h-7 shrink-0 items-center rounded-full bg-[var(--superficie-2)] px-2.5 text-[15.5px] font-bold tabular-nums">
                    {capa.entidades.length < capa.total ? `${capa.entidades.length} de ${capa.total.toLocaleString('es-AR')}` : capa.total.toLocaleString('es-AR')}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {capa.entidades.map(entidad => <FilaSimple key={entidad.id} visor={visor} entidad={entidad} donde={ubicaciones.get(entidad.id)} orden={orden++} />)}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FichaSimple({ visor, entidad, capa, titulo: tituloCapa }: { visor: Visor; entidad: Entidad; capa: string; titulo: string }) {
  const nombre = nombreSimple(entidad.atributos) ?? 'Sin nombre';
  const tema = temaDe(capa);
  const datos = datosSimples(entidad.atributos);
  const tipo = datos.find(([k]) => k === 'tipo')?.[1];
  const gente = datos.find(([k]) => k === 'canthab');
  const habitantes = gente && numero(gente[1]);
  const resto = datos.filter(([k]) => k !== 'tipo' && k !== 'canthab').slice(0, 4);
  const [foto, setFoto] = useState(true);
  const encuadrar = () => volarA(visor, buffer(entidad.feature.getGeometry()!.getExtent(), 2500), { maxZoom: 13 });
  return (
    <article className="ficha-simple flex flex-col gap-3 rounded-[24px] bg-[var(--superficie-2)] p-3.5">
      {/* Compacta, para que la lista de abajo tenga lugar: foto chica, el tema y el tipo en una línea, el
          nombre grande y "Acercar" al costado. */}
      <div className="flex items-center gap-3.5">
        <div className="relative size-[64px] shrink-0 overflow-hidden rounded-[16px] bg-[var(--superficie-3)]">
          {foto && <img src={miniatura(capa)} alt="" onError={() => setFoto(false)} className="ficha-foto miniatura absolute inset-0 size-full object-cover" />}
          <span aria-hidden="true" className="absolute bottom-1 left-1 grid size-6 place-items-center rounded-full text-white shadow-[0_2px_8px_rgba(0,0,0,.35)]" style={{ backgroundColor: tema?.color ?? 'var(--vial)' }}>
            <IconoTematica id={tema?.id ?? ''} size={13} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-bold text-[var(--tinta-3)]">{tipo ? `${tituloCapa} · ${tipo}` : tituloCapa}</p>
          <h3 className="mt-0.5 line-clamp-2 text-[26px] font-bold leading-[1.05] tracking-[-0.03em] [overflow-wrap:anywhere]">{nombre}</h3>
        </div>
        <button
          type="button"
          onClick={encuadrar}
          className="boton-ajuste flex h-12 shrink-0 items-center gap-2 rounded-full bg-white pl-4 pr-5 text-[17px] font-bold text-[#0b0c0e] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ArrowsOutSimple size={20} weight="bold" /> Acercar
        </button>
      </div>
      {(gente || resto.length > 0) && (
        <dl className="flex flex-wrap gap-x-0 gap-y-2 rounded-[16px] bg-[var(--superficie-3)] py-2.5">
          {gente && (
            <div style={{ '--i': 0 } as React.CSSProperties} className="dato-simple min-w-[110px] flex-[1_1_auto] px-3.5">
              <dt className="truncate text-[15px] font-semibold text-[var(--tinta-3)]">Viven acá</dt>
              <dd className="truncate font-bold leading-tight tracking-[-0.02em] tabular-nums">
                {habitantes !== undefined ? <NumeroAnimado valor={habitantes} /> : gente[1]}
              </dd>
            </div>
          )}
          {resto.slice(0, gente ? 2 : 3).map(([clave, valor], i) => (
            <div key={clave} style={{ '--i': i + 1 } as React.CSSProperties} className="dato-simple min-w-[110px] max-w-full flex-[1_1_auto] border-l border-[var(--linea)] px-3.5 first:border-l-0">
              <dt className="truncate text-[15px] font-semibold text-[var(--tinta-3)]">{rotuloSimple(clave)}</dt>
              <dd className="truncate font-bold leading-tight tracking-[-0.01em]" title={valor}>{valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

function FilaSimple({ visor, entidad, donde, orden }: { visor: Visor; entidad: Entidad; donde?: string; orden: number }) {
  const nombre = nombreSimple(entidad.atributos);
  const datos = datosSimples(entidad.atributos).filter(([k]) => k !== 'distancia').slice(0, 2);
  const detalle = donde ?? datos.map(([, v]) => v).join(' · ');
  const enfocar = () => { visor.foco.clear(); visor.foco.addFeature(entidad.feature); };
  const encuadrar = () => volarA(visor, buffer(entidad.feature.getGeometry()!.getExtent(), 2500), { maxZoom: 13 });
  return (
    <li
      onMouseEnter={enfocar}
      onMouseLeave={() => visor.foco.clear()}
      onFocus={enfocar}
      style={{ '--i': Math.min(orden, 12) } as React.CSSProperties}
      className="fila-resultado flex items-center gap-3 rounded-[18px] bg-[var(--superficie-2)] py-2.5 pl-4 pr-2.5"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] font-bold leading-tight">{nombre ?? 'Sin nombre'}</div>
        {detalle && <div className="mt-0.5 truncate text-[15px] font-medium text-[var(--tinta-2)]" title={detalle}>{detalle}</div>}
      </div>
      <button
        type="button"
        onClick={encuadrar}
        aria-label={`Acercar a ${nombre ?? entidad.id}${donde ? `, ${donde.charAt(0).toLowerCase()}${donde.slice(1)}` : ''}`}
        title="Acercar"
        className="fila-resultado-ir grid size-11 shrink-0 place-items-center rounded-full bg-[var(--superficie-3)] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowsOutSimple size={19} weight="bold" />
      </button>
    </li>
  );
}

// La zona marcada con el rectángulo: tres números grandes en fila y una barra por tema, con su color (al pasar
// el cursor por una, se encienden en el mapa).
function ResumenSimple({ visor, consulta }: { visor: Visor; consulta: Consulta }) {
  const total = consulta.capas.reduce((s, c) => s + c.total, 0);
  const localidades = consulta.capas.find(c => c.capa === 'localidades');
  const habitantes = localidades && localidades.entidades.length === localidades.total
    ? localidades.entidades.reduce((s, e) => s + (numero(e.atributos.find(([k]) => k === 'canthab')?.[1] ?? '0') ?? 0), 0)
    : undefined;
  const ordenadas = [...consulta.capas].sort((a, b) => b.total - a.total).slice(0, 4);
  const maximo = Math.max(ordenadas[0]?.total ?? 1, 1);
  const [apuntada, setApuntada] = useState<string | null>(null);
  const resaltar = (capa: string | null) => {
    setApuntada(capa);
    visor.foco.clear();
    const encontrada = consulta.capas.find(c => c.capa === capa);
    if (encontrada) visor.foco.addFeatures(encontrada.entidades.map(e => e.feature));
  };
  return (
    // Compacto, como la ficha: las cifras en una franja y los cuatro temas con más cosas en dos columnas.
    <section className="ficha-simple flex flex-col gap-2.5 rounded-[24px] bg-[var(--superficie-2)] p-3.5">
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] rounded-[16px] bg-[var(--superficie-3)] py-2.5">
        {habitantes !== undefined && habitantes > 0 && <CifraSimple titulo="Viven acá"><NumeroAnimado valor={habitantes} /></CifraSimple>}
        <CifraSimple titulo="Cosas"><NumeroAnimado valor={total} /></CifraSimple>
        <CifraSimple titulo="Temas"><NumeroAnimado valor={consulta.capas.length} /></CifraSimple>
      </dl>
      <ul className="grid grid-cols-2 gap-x-2" onMouseLeave={() => resaltar(null)}>
        {ordenadas.map((c, i) => {
          const tema = temaDe(c.capa);
          return (
            <li key={c.capa} onMouseEnter={() => resaltar(c.capa)} className={`rounded-[14px] px-2 py-1.5 transition-colors ${apuntada === c.capa ? 'bg-[var(--superficie-3)]' : ''}`}>
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: tema?.color ?? 'var(--vial)' }}>
                  <IconoTematica id={tema?.id ?? ''} size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[16px] font-bold">{c.titulo}</span>
                <span className="shrink-0 text-[16px] font-bold tabular-nums">{c.total.toLocaleString('es-AR')}</span>
              </div>
              <div className="ml-[38px] mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--superficie-3)]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: tema?.color ?? 'var(--vial)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max((c.total / maximo) * 100, c.total ? 3 : 0)}%` }}
                  transition={{ ...RESORTE_SUAVE, delay: 0.1 + i * 0.05 }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CifraSimple({ titulo: texto, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-l border-[var(--linea)] px-4 first:border-l-0">
      <dt className="text-[15px] font-semibold text-[var(--tinta-3)]">{texto}</dt>
      <dd className="mt-1 truncate text-[24px] font-bold leading-none tracking-[-0.035em] tabular-nums">{children}</dd>
    </div>
  );
}
