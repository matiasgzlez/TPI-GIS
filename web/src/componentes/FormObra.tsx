import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Label, ListBox, Select, TextArea, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Button as BotonConEstado } from './ui/stateful-button';
import Overlay from 'ol/Overlay';
import type Point from 'ol/geom/Point';
import { PRIORIDADES, TIPOS_OBRA } from '../config';
import type { DatosObra } from '../obras';
import { formatoCoordenada, type Visor } from '../visor';
import EscudoRuta from './EscudoRuta';

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

// Tarjeta anclada al punto con un Overlay de OpenLayers: el formulario aparece donde va la obra.
export default function FormObra({ visor, punto, guardando, onGuardar, onCancelar }: Props) {
  const elemento = useMemo(() => document.createElement('div'), []);
  const [datos, setDatos] = useState<DatosObra>({ tipo_obra: 'bacheo', prioridad: 'media', descripcion: '' });

  useEffect(() => {
    const overlay = new Overlay({
      element: elemento,
      position: punto.getCoordinates(),
      positioning: 'bottom-center',
      offset: [0, -18],
      autoPan: { animation: { duration: 300 }, margin: 96 },
      stopEvent: true,
    });
    visor.mapa.addOverlay(overlay);
    return () => {
      visor.mapa.removeOverlay(overlay);
    };
  }, [visor, punto, elemento]);

  const coordenada = formatoCoordenada(punto.getCoordinates());

  return createPortal(
    <form
      className="entra panel w-[360px] p-5 shadow-[var(--sombra-alta)]"
      style={{ '--desde': '8px' } as React.CSSProperties}
      onSubmit={e => e.preventDefault()}
      onKeyDown={e => e.key === 'Escape' && onCancelar()}
    >
      <header className="mb-4 flex items-center gap-3">
        <EscudoRuta className="h-9 w-auto shrink-0" />
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Nueva obra</h2>
          <p className="truncate text-[13px] text-[var(--tinta-3)]">{coordenada}</p>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <Select
          selectedKey={datos.tipo_obra}
          onSelectionChange={k => setDatos({ ...datos, tipo_obra: String(k) })}
          fullWidth
        >
          <Label className="text-[14px] font-medium text-[var(--tinta-2)]">Tipo de obra</Label>
          <Select.Trigger className="h-12 rounded-xl text-[15px]">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox className="p-1">
              {TIPOS_OBRA.map(t => (
                <ListBox.Item key={t} id={t} textValue={ETIQUETA_TIPO[t]} className="min-h-11 rounded-lg text-[15px]">
                  {ETIQUETA_TIPO[t]}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium text-[var(--tinta-2)]" id="etiqueta-prioridad">Prioridad</span>
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
              <ToggleButton key={p} id={p} className="h-11 text-[15px] capitalize">
                <span className={`size-2 rounded-full ${p === 'alta' ? 'bg-[var(--vial)]' : p === 'media' ? 'bg-[var(--warning)]' : 'bg-[var(--tinta-3)]'}`} />
                {p}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium text-[var(--tinta-2)]">Descripción <span className="font-normal text-[var(--tinta-3)]">(opcional)</span></span>
          <TextArea
            rows={2}
            value={datos.descripcion}
            onChange={e => setDatos({ ...datos, descripcion: e.target.value })}
            placeholder="Ej.: bache profundo en el carril norte"
            className="resize-none rounded-xl text-[15px]"
          />
        </label>
      </div>

      <footer className="mt-5 flex gap-2.5">
        <Button type="button" variant="secondary" size="lg" onPress={onCancelar} className="h-12 flex-1 text-[15px]" isDisabled={guardando}>
          Cancelar
        </Button>
        {/* Stateful Button de Aceternity: spinner mientras viaja el WFS-T y tilde al confirmarse. */}
        <BotonConEstado type="button" onClick={() => onGuardar(datos)} disabled={guardando} className="h-12 min-w-0 flex-[1.5] rounded-xl text-[15px]">
          Guardar obra
        </BotonConEstado>
      </footer>
    </form>,
    elemento,
  );
}
