import { useEffect, useState } from 'react';
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
export default function FormObra({ visor, punto, guardando, onGuardar, onCancelar }: Props) {
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
