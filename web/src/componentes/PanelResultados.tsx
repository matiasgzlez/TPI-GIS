import { useState } from 'react';
import { Spinner } from '@heroui/react';
import { X, CaretDown, ArrowsOutSimple } from '@phosphor-icons/react';
import { buffer } from 'ol/extent';
import type { Consulta, Entidad, Medicion } from '../herramientas';
import { volarA, type Visor } from '../visor';
import { datosClave, nombreDe, rotulo } from '../entidades';
import { Barras, NumeroAnimado } from './ui/graficos';

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

const ORIGEN = { punto: 'Consulta por punto', rectangulo: 'Consulta por rectángulo', lenguaje: 'Pregunta' };

export default function PanelResultados({ visor, estado, onCerrar }: Props) {
  return (
    <section className="entra panel flex max-h-full min-h-0 flex-col overflow-hidden" style={{ '--desde': '8px' } as React.CSSProperties} aria-live="polite">
      <header className="flex items-start gap-3 border-b border-[var(--linea)] py-4 pl-5 pr-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[19px] font-semibold leading-tight tracking-[-0.02em]">{titulo(estado)}</h2>
          <p className="mt-0.5 truncate text-[14px] text-[var(--tinta-3)]">{subtitulo(estado)}</p>
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
            <Spinner size="sm" /> Consultando GeoServer…
          </div>
        )}
        {estado.tipo === 'error' && (
          <div className="px-5 py-6 text-[15px] leading-relaxed">
            <p className="font-medium text-[var(--danger)]">{estado.mensaje}</p>
            <p className="mt-2 text-[var(--tinta-2)]">Revisá que GeoServer esté levantado (docker compose up -d) y volvé a consultar.</p>
          </div>
        )}
        {estado.tipo === 'medicion' && <Medida medicion={estado.medicion} />}
        {estado.tipo === 'consulta' && <Lista visor={visor} consulta={estado.consulta} />}
      </div>
    </section>
  );
}

function titulo(estado: EstadoResultados) {
  if (estado.tipo === 'medicion') return estado.medicion.tipo === 'distancia' ? 'Distancia' : 'Área';
  if (estado.tipo === 'consulta' && estado.consulta.titulo) return estado.consulta.titulo;
  if (estado.tipo === 'consulta' || estado.tipo === 'cargando') {
    return ORIGEN[estado.tipo === 'consulta' ? estado.consulta.origen : estado.origen];
  }
  return 'Consulta';
}

function subtitulo(estado: EstadoResultados) {
  if (estado.tipo === 'cargando') return 'Buscando entidades…';
  if (estado.tipo === 'error') return 'No se pudo consultar';
  if (estado.tipo === 'medicion') return estado.medicion.terminada ? 'Geodésica, sobre el elipsoide WGS 84' : 'Midiendo…';
  const total = estado.consulta.capas.reduce((s, c) => s + c.total, 0);
  if (!total) return 'Sin entidades en ese lugar';
  const capas = estado.consulta.capas.length;
  return `${total.toLocaleString('es-AR')} ${total === 1 ? 'entidad' : 'entidades'} en ${capas} ${capas === 1 ? 'capa' : 'capas'}`;
}

function Medida({ medicion }: { medicion: Medicion }) {
  const partes = medicion.texto.split(' ');
  return (
    <div className="px-5 pb-6 pt-5">
      <div className="flex items-baseline gap-2">
        <span className="text-[44px] font-semibold leading-none tracking-[-0.03em]">{partes.slice(0, -1).join(' ')}</span>
        <span className="text-[18px] font-medium text-[var(--tinta-2)]">{partes.at(-1)}</span>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-[var(--tinta-2)]">
        {medicion.terminada ? 'Hacé clic de nuevo en el mapa para empezar otra medición.' : 'Doble clic para terminar.'}
      </p>
    </div>
  );
}

function Lista({ visor, consulta }: { visor: Visor; consulta: Consulta }) {
  if (!consulta.capas.length) {
    return (
      <p className="px-5 py-6 text-[15px] leading-relaxed text-[var(--tinta-2)]">
        {consulta.origen === 'punto'
          ? 'Ninguna capa prendida tiene entidades en ese punto. Probá acercarte o prender otras capas.'
          : consulta.origen === 'lenguaje'
            ? 'No hay resultados para esa pregunta. Probá con una distancia mayor u otro lugar.'
            : 'Ninguna capa prendida tiene entidades dentro del rectángulo.'}
      </p>
    );
  }
  // En la consulta por punto, lo de más arriba se presenta como ficha y el resto queda listado abajo.
  const destacada: Entidad | undefined = consulta.origen === 'punto' ? consulta.capas[0].entidades[0] : undefined;
  const otras = consulta.capas.flatMap(c => c.entidades).filter(e => e !== destacada);
  const capas = consulta.origen === 'punto'
    ? consulta.capas.map(c => ({ ...c, entidades: c.entidades.filter(e => otras.includes(e)) })).filter(c => c.entidades.length)
    : consulta.capas;
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
            {capa.entidades.map(entidad => <Fila key={entidad.id} visor={visor} entidad={entidad} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

const VISIBLES = 4;

// Resumen de la consulta por rectángulo: totales, cuántas entidades hay por capa y de qué tipo son
// las de la capa con más resultados. Pasar el mouse por una barra las resalta en el mapa.
function Resumen({ visor, consulta }: { visor: Visor; consulta: Consulta }) {
  const total = consulta.capas.reduce((s, c) => s + c.total, 0);
  const localidades = consulta.capas.find(c => c.capa === 'localidades');
  const habitantes = localidades && localidades.entidades.length === localidades.total
    ? localidades.entidades.reduce((s, e) => s + Number(e.atributos.find(([k]) => k === 'canthab')?.[1].replace(/\./g, '') ?? 0), 0)
    : undefined;
  const mayor = [...consulta.capas].sort((a, b) => b.total - a.total)[0];
  const tipos = new Map<string, number>();
  for (const e of mayor.entidades) {
    const tipo = e.atributos.find(([k]) => k === 'tipo')?.[1];
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
        <Cifra titulo="Entidades"><NumeroAnimado valor={total} /></Cifra>
        <Cifra titulo="Capas"><NumeroAnimado valor={consulta.capas.length} /></Cifra>
        {habitantes !== undefined && <Cifra titulo="Habitantes"><NumeroAnimado valor={habitantes} /></Cifra>}
      </div>
      <h3 className="mb-3 mt-5 text-[13px] font-semibold text-[var(--tinta-3)]">Por capa</h3>
      <Barras
        datos={[...consulta.capas].sort((a, b) => b.total - a.total).map(c => ({ id: c.capa, etiqueta: c.titulo, valor: c.total }))}
        onApuntar={dato => resaltar(dato?.id ?? null)}
      />
      {tipos.size > 1 && (
        <>
          <h3 className="mb-3 mt-5 text-[13px] font-semibold text-[var(--tinta-3)]">
            {mayor.titulo} por tipo{mayor.entidades.length < mayor.total ? ` (de las ${mayor.entidades.length} mostradas)` : ''}
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
  const nombre = nombreDe(entidad.atributos) ?? 'Sin nombre';
  const datos = datosClave(entidad.atributos, 3);
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
              <dt className="text-[12px] font-medium text-[var(--tinta-3)]">{rotulo(clave)}</dt>
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

function Fila({ visor, entidad }: { visor: Visor; entidad: Entidad }) {
  const [abierta, setAbierta] = useState(false);
  const nombre = nombreDe(entidad.atributos);
  const atributos = entidad.atributos.filter(([, v]) => v !== nombre);
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
        <div className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">{nombre ?? 'Sin nombre'}</div>
        <button
          type="button"
          onClick={encuadrar}
          aria-label={`Acercar a ${nombre ?? entidad.id}`}
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
              <dt className="truncate text-[var(--tinta-3)]">{rotulo(clave)}</dt>
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
