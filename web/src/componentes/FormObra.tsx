import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bridge, CircleNotch, DotsThree, Drop, Path, RoadHorizon, Signpost, TrafficCone, X } from '@phosphor-icons/react';
import { Button, Label, ListBox, Select, TextArea, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Button as BotonConEstado } from './ui/stateful-button';
import type Point from 'ol/geom/Point';
import { PRIORIDADES, TIPOS_OBRA } from '../config';
import type { DatosObra } from '../obras';
import { formatoCoordenada, volarA, type Visor } from '../visor';
import { useInterfaz } from '../interfaz';
import EscudoRuta from './EscudoRuta';

// Modo simple: la prioridad como urgencia.
// Cortas, para que las tres entren a lo ancho debajo de "¿Qué tan urgente es?".
const URGENCIA: Record<string, string> = { alta: 'Mucho', media: 'Algo', baja: 'Poco' };

const ETIQUETA_TIPO: Record<string, string> = {
  bacheo: 'Bacheo',
  repavimentacion: 'Repavimentación',
  banquina: 'Banquina',
  senalizacion: 'Señalización',
  puente: 'Puente',
  drenaje: 'Drenaje',
  otro: 'Otro',
};

interface Props {
  visor: Visor;
  punto: Point;
  guardando: boolean;
  onGuardar: (datos: DatosObra) => Promise<void>;
  onCancelar: () => void;
}

// El formulario de una obra nueva, acoplado donde van los paneles de cada modo (el inspector en el
// profesional, el panel de la derecha en el simple, una hoja desde abajo en el celular). Antes era una
// tarjeta anclada al punto con un Overlay de OpenLayers, y según dónde se hiciera el clic quedaba debajo
// del buscador, de la barra de capas o fuera de la pantalla. El punto se centra en el área libre del mapa.
const ANCHO_ESCRITORIO = '(min-width: 1024px)';
const escucharAncho = (avisar: () => void) => {
  const consulta = matchMedia(ANCHO_ESCRITORIO);
  consulta.addEventListener('change', avisar);
  return () => consulta.removeEventListener('change', avisar);
};

export default function FormObra(props: Props) {
  const simple = useInterfaz() === 'simple';
  const escritorio = useSyncExternalStore(escucharAncho, () => matchMedia(ANCHO_ESCRITORIO).matches);
  return simple && escritorio ? <FormObraSimple {...props} /> : <FormObraComun {...props} />;
}

function FormObraComun({ visor, punto, guardando, onGuardar, onCancelar }: Props) {
  const simple = useInterfaz() === 'simple';
  const [datos, setDatos] = useState<DatosObra>({ tipo_obra: 'bacheo', prioridad: 'media', descripcion: '' });

  useEffect(() => {
    const [x, y] = punto.getCoordinates();
    const zoom = visor.mapa.getView().getZoom();
    volarA(visor, [x, y, x, y], { maxZoom: zoom, duracion: 500, conPanel: true });
  }, [visor, punto]);

  const coordenada = formatoCoordenada(punto.getCoordinates());

  return (
    <form
      className="entra panel desplazable max-h-full min-h-0 overflow-y-auto p-5"
      style={{ '--desde': '8px' } as React.CSSProperties}
      onSubmit={e => e.preventDefault()}
      onKeyDown={e => e.key === 'Escape' && onCancelar()}
    >
      <header className="mb-4 flex items-center gap-3">
        <EscudoRuta className="h-9 w-auto shrink-0" />
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{simple ? 'Una obra nueva en la ruta' : 'Nueva obra'}</h2>
          <p className="truncate text-[13px] text-[var(--tinta-3)]">{coordenada}</p>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <Select
          selectedKey={datos.tipo_obra}
          onSelectionChange={k => setDatos({ ...datos, tipo_obra: String(k) })}
          fullWidth
        >
          <Label className="text-[14px] font-medium text-[var(--tinta-2)]">{simple ? '¿Qué hay que arreglar?' : 'Tipo de obra'}</Label>
          <Select.Trigger className="h-12 rounded-xl text-[15px]">
            <Select.Value className="text-[15px]" />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            {/* El popover va en un portal, fuera de .interfaz: usa el zoom de la interfaz, igual que el disparador. */}
            <ListBox className="p-1">
              {TIPOS_OBRA.map(t => (
                <ListBox.Item key={t} id={t} textValue={ETIQUETA_TIPO[t]} className="min-h-[calc(44px*var(--zoom-interfaz))] rounded-lg text-[calc(15px*var(--zoom-interfaz))]">
                  {ETIQUETA_TIPO[t]}
                  <ListBox.ItemIndicator className="size-[calc(16px*var(--zoom-interfaz))] [&_svg]:size-full" />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium text-[var(--tinta-2)]" id="etiqueta-prioridad">{simple ? '¿Qué tan urgente es?' : 'Prioridad'}</span>
          <ToggleButtonGroup
            aria-labelledby="etiqueta-prioridad"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([datos.prioridad])}
            onSelectionChange={k => setDatos({ ...datos, prioridad: String([...k][0]) })}
            fullWidth
            size="lg"
          >
            {PRIORIDADES.map(p => (
              <ToggleButton key={p} id={p} className={`h-11 text-[15px] ${simple ? '' : 'capitalize'}`}>
                <span className={`size-2 rounded-full ${p === 'alta' ? 'bg-[var(--vial)]' : p === 'media' ? 'bg-[var(--warning)]' : 'bg-[var(--tinta-3)]'}`} />
                {simple ? URGENCIA[p] : p}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium text-[var(--tinta-2)]">{simple ? 'Contá qué pasa' : 'Descripción'} <span className="font-normal text-[var(--tinta-3)]">(opcional)</span></span>
          <TextArea
            rows={2}
            value={datos.descripcion}
            onChange={e => setDatos({ ...datos, descripcion: e.target.value })}
            placeholder="Ej.: bache profundo en el carril norte"
            className="resize-none rounded-xl text-[15px]"
          />
        </label>
      </div>

      {/* Al pie y siempre a la vista, aunque el formulario se desplace (en el celular no entra entero). */}
      <footer className="sticky -bottom-5 -mx-5 -mb-5 mt-5 flex gap-2.5 bg-[var(--superficie)] px-5 pb-5 pt-3">
        <Button type="button" variant="secondary" size="lg" onPress={onCancelar} className="h-12 flex-1 text-[15px]" isDisabled={guardando}>
          Cancelar
        </Button>
        {/* Stateful Button de Aceternity: spinner mientras viaja el WFS-T y tilde al confirmarse. */}
        <BotonConEstado type="button" onClick={() => onGuardar(datos)} disabled={guardando} className="h-12 min-w-0 flex-[1.5] rounded-xl text-[15px]">
          Guardar obra
        </BotonConEstado>
      </footer>
    </form>
  );
}

// --- Escritorio del modo simple ---
// Va adentro del notch negro de la derecha (NotchResultados), como los resultados: todo grande y a la vista,
// sin menús que se despliegan. Qué hay que arreglar, como pastillas con su dibujo; qué tan urgente, tres
// botones grandes; lo que pasa, opcional; y abajo "Guardar obra" en blanco. Lo elegido va en blanco.
const ICONO_TIPO: Record<string, React.ReactNode> = {
  bacheo: <TrafficCone size={22} weight="bold" />,
  repavimentacion: <RoadHorizon size={22} weight="bold" />,
  banquina: <Path size={22} weight="bold" />,
  senalizacion: <Signpost size={22} weight="bold" />,
  puente: <Bridge size={22} weight="bold" />,
  drenaje: <Drop size={22} weight="bold" />,
  otro: <DotsThree size={22} weight="bold" />,
};
const COLOR_URGENCIA: Record<string, string> = { alta: 'var(--vial)', media: 'var(--warning)', baja: '#9aa0a8' };

function FormObraSimple({ visor, punto, guardando, onGuardar, onCancelar }: Props) {
  const [datos, setDatos] = useState<DatosObra>({ tipo_obra: 'bacheo', prioridad: 'media', descripcion: '' });
  const cuerpo = useRef<HTMLDivElement>(null);
  // Con algo escrito, el primer Escape avisa y recién el segundo descarta (no se pierde el texto sin querer).
  const [avisoDescartar, setAvisoDescartar] = useState(false);
  useEffect(() => {
    if (!avisoDescartar) return;
    const reloj = setTimeout(() => setAvisoDescartar(false), 3000);
    return () => clearTimeout(reloj);
  }, [avisoDescartar]);
  const alEscape = () => {
    if (datos.descripcion.trim() && !avisoDescartar) setAvisoDescartar(true);
    else onCancelar();
  };
  // Al abrir, el foco va a lo elegido en "¿Qué hay que arreglar?" (después de que el notch se abra: inerte no
  // recibe foco). Al cerrar, NotchResultados lo devuelve a Ajustes.
  useEffect(() => {
    const reloj = setTimeout(() => cuerpo.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus({ preventScroll: true }), 120);
    return () => clearTimeout(reloj);
  }, []);

  useEffect(() => {
    const [x, y] = punto.getCoordinates();
    const zoom = visor.mapa.getView().getZoom();
    volarA(visor, [x, y, x, y], { maxZoom: zoom, duracion: 500, conPanel: true });
  }, [visor, punto]);

  return (
    <form
      className="obra-simple flex max-h-full min-h-0 flex-col text-[var(--tinta)]"
      onSubmit={e => { e.preventDefault(); if (!guardando) onGuardar(datos); }}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); alEscape(); } }}
    >
      <header className="flex items-center gap-4 pb-3 pl-6 pr-5 pt-5">
        <EscudoRuta className="h-11 w-auto shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[26px] font-bold leading-[1.1] tracking-[-0.025em]">Una obra nueva</h2>
          <p className="mt-1 truncate text-[16px] font-semibold text-[var(--tinta-3)]">En la ruta · {formatoCoordenada(punto.getCoordinates())}</p>
        </div>
        <button
          type="button"
          onClick={onCancelar}
          aria-label="Cancelar la obra"
          title="Cancelar"
          className="boton-cerrar-simple grid size-12 shrink-0 place-items-center rounded-full bg-[var(--superficie-2)] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X size={22} weight="bold" />
        </button>
      </header>

      <div ref={cuerpo} className="desplazable flex min-h-0 flex-col gap-3.5 overflow-y-auto px-5 pb-1">
        <Opciones
          titulo="¿Qué hay que arreglar?"
          valor={datos.tipo_obra}
          onCambiar={tipo_obra => setDatos({ ...datos, tipo_obra })}
          className="flex flex-wrap gap-2"
          opciones={TIPOS_OBRA.map(t => ({ id: t, contenido: <>{ICONO_TIPO[t]}{ETIQUETA_TIPO[t]}</> }))}
          claseOpcion="h-11 gap-2 pl-3.5 pr-4"
        />
        <Opciones
          titulo="¿Qué tan urgente es?"
          valor={datos.prioridad}
          onCambiar={prioridad => setDatos({ ...datos, prioridad })}
          className="grid grid-cols-3 gap-2"
          opciones={PRIORIDADES.map(p => ({
            id: p,
            contenido: <><span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: COLOR_URGENCIA[p] }} />{URGENCIA[p]}</>,
          }))}
          claseOpcion="h-12 justify-center gap-2.5"
        />
        <label className="flex flex-col gap-2">
          <span className="obra-titulo text-[17px] font-bold">Contá qué pasa <span className="font-semibold text-[var(--tinta-3)]">(si querés)</span></span>
          <textarea
            rows={2}
            value={datos.descripcion}
            onChange={e => { setDatos({ ...datos, descripcion: e.target.value }); setAvisoDescartar(false); }}
            placeholder="Ej.: bache profundo en el carril norte"
            className="obra-texto resize-none rounded-[18px] bg-[var(--superficie-2)] min-h-[60px] px-4 py-3 text-[17px] font-medium leading-snug text-[var(--tinta)] outline-none placeholder:text-[var(--tinta-3)]"
          />
        </label>
      </div>

      <p role="status" aria-live="polite" className={`shrink-0 px-6 text-[16px] font-semibold text-[#ff6a2b] transition-[opacity,max-height] duration-300 ${avisoDescartar ? 'max-h-10 pt-3 opacity-100' : 'max-h-0 opacity-0'}`}>
        {avisoDescartar ? 'Escape otra vez para descartar lo escrito' : ''}
      </p>
      <footer className="flex shrink-0 gap-2.5 px-5 pb-5 pt-4">
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          className="boton-ajuste h-[52px] flex-1 rounded-[18px] bg-[var(--superficie-2)] text-[17px] font-bold hover:bg-[var(--superficie-3)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="boton-ajuste flex h-[52px] flex-[1.6] items-center justify-center gap-2.5 rounded-[18px] bg-white text-[17px] font-bold text-[#0b0c0e] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-80"
        >
          {guardando && <CircleNotch size={22} weight="bold" className="animate-spin" />}
          {guardando ? 'Guardando…' : 'Guardar obra'}
        </button>
      </footer>
    </form>
  );
}

// Un grupo de opciones de a una (radio): con las flechas se pasa a la siguiente, como un radio de verdad.
function Opciones({ titulo, valor, onCambiar, opciones, className, claseOpcion }: {
  titulo: string;
  valor: string;
  onCambiar: (valor: string) => void;
  opciones: { id: string; contenido: React.ReactNode }[];
  className: string;
  claseOpcion: string;
}) {
  const grupo = useRef<HTMLDivElement>(null);
  const mover = (e: React.KeyboardEvent, i: number) => {
    const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!paso) return;
    e.preventDefault();
    const siguiente = (i + paso + opciones.length) % opciones.length;
    onCambiar(opciones[siguiente].id);
    grupo.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[siguiente]?.focus();
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="obra-titulo text-[17px] font-bold">{titulo}</span>
      <div ref={grupo} role="radiogroup" aria-label={titulo} className={className}>
        {opciones.map((o, i) => {
          const elegida = o.id === valor;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={elegida}
              tabIndex={elegida ? 0 : -1}
              onClick={() => onCambiar(o.id)}
              onKeyDown={e => mover(e, i)}
              className={`opcion-obra flex items-center rounded-[16px] text-[17px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 ${claseOpcion}`}
              data-elegida={elegida || undefined}
            >
              {o.contenido}
            </button>
          );
        })}
      </div>
    </div>
  );
}
