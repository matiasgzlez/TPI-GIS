import { useState } from 'react';
import { Spinner } from '@heroui/react';
import { X, CaretDown, ArrowsOutSimple } from '@phosphor-icons/react';
import { buffer } from 'ol/extent';
import type { Consulta, Entidad, Medicion } from '../herramientas';
import { volarA, type Visor } from '../visor';

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

const ORIGEN = { punto: 'Consulta por punto', rectangulo: 'Consulta por rectángulo' };

export default function PanelResultados({ visor, estado, onCerrar }: Props) {
  return (
    <section className="entra panel flex max-h-full min-h-0 flex-col overflow-hidden" style={{ '--desde': '8px' } as React.CSSProperties} aria-live="polite">
      <header className="flex items-start gap-3 border-b border-[var(--linea)] py-4 pl-5 pr-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[19px] font-semibold tracking-[-0.02em]">{titulo(estado)}</h2>
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
          : 'Ninguna capa prendida tiene entidades dentro del rectángulo.'}
      </p>
    );
  }
  return (
    <div className="pb-2">
      {consulta.capas.map(capa => (
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

// El campo que mejor nombra a la entidad.
const CAMPOS_NOMBRE = ['nombre', 'fna', 'gna', 'nam', 'provincia', 'tipo', 'tipo_obra'];
const VISIBLES = 4;

// Los nombres de campo del IGN, legibles.
const ROTULOS: Record<string, string> = {
  canthab: 'Habitantes', departamen: 'Departamento', provincia: 'Provincia', tipo: 'Tipo', precision: 'Precisión',
  escala: 'Escala', fuente: 'Fuente', nro_ruta: 'N.º de ruta', administra: 'Administración', situacin: 'Situación',
  tipo_obra: 'Tipo de obra', prioridad: 'Prioridad', descripcion: 'Descripción', regimen: 'Régimen', navegable: 'Navegable',
  revestimie: 'Revestimiento', carriles: 'Carriles', trfico: 'Tránsito', estado: 'Estado', prov: 'Código',
};
const rotulo = (campo: string) => ROTULOS[campo] ?? campo.charAt(0).toUpperCase() + campo.slice(1).replaceAll('_', ' ');

function Fila({ visor, entidad }: { visor: Visor; entidad: Entidad }) {
  const [abierta, setAbierta] = useState(false);
  const nombre = CAMPOS_NOMBRE.map(c => entidad.atributos.find(([k]) => k === c)?.[1]).find(Boolean);
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
