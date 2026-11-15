// Editar o borrar una obra de la RN11 desde la tabla de datos (T4, WFS-T). Va en su propio fragmento: los
// controles de formulario de HeroUI se bajan recién al editar una obra.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Label, ListBox, Select, Spinner, TextArea, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Trash, X } from '@phosphor-icons/react';
import { PRIORIDADES, TIPOS_OBRA } from '../../config';
import { RESORTE_PANEL } from '../../movimiento';
import { actualizarObra, borrarObra, ESTADOS_OBRA, ETIQUETAS_OBRA, type CambiosObra } from '../../tabla';

// Editar o borrar una obra (WFS-T). Al lado de la tabla, sin taparla.
export default function EditarObra({ id, valores, onCerrar, onListo }: { id: string; valores: Record<string, unknown>; onCerrar: () => void; onListo: (mensaje: string, borrada: boolean) => void }) {
  const [cambios, setCambios] = useState<CambiosObra>({
    tipo_obra: String(valores.tipo_obra ?? 'otro'), prioridad: String(valores.prioridad ?? 'media'),
    estado: String(valores.estado ?? 'relevado'), descripcion: String(valores.descripcion ?? ''),
  });
  const [ocupado, setOcupado] = useState<'guardar' | 'borrar' | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const numero = id.split('.')[1];
  const primero = useRef<HTMLDivElement>(null);
  useEffect(() => { primero.current?.querySelector<HTMLElement>('button')?.focus(); }, []);

  async function hacer(accion: 'guardar' | 'borrar') {
    setOcupado(accion); setError(null);
    try {
      if (accion === 'guardar') await actualizarObra(id, cambios);
      else await borrarObra(id);
      onListo(accion === 'guardar' ? `Obra ${numero} actualizada` : `Obra ${numero} borrada`, accion === 'borrar');
    } catch (e) {
      setError(`GeoServer no aceptó el cambio${(e as Error).message ? `: ${(e as Error).message}` : '.'}`);
      setOcupado(null);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={RESORTE_PANEL}
      onSubmit={e => { e.preventDefault(); hacer('guardar'); }}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } }}
      aria-label={`Editar la obra ${numero}`}
      className="desplazable flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-[var(--linea)] bg-[var(--superficie)] p-3.5"
    >
      <header className="flex items-center gap-2">
        <h3 className="flex-1 text-[15px] font-semibold">Obra {numero}</h3>
        <button type="button" onClick={onCerrar} aria-label="Cerrar sin guardar" className="grid size-8 place-items-center rounded-lg text-[var(--tinta-2)] hover:bg-[var(--superficie-2)] focus-visible:outline-2"><X size={15} weight="bold" /></button>
      </header>
      <div ref={primero}>
        <Select selectedKey={cambios.tipo_obra} onSelectionChange={k => setCambios({ ...cambios, tipo_obra: String(k) })} fullWidth>
          <Label className="text-[12.5px] font-medium text-[var(--tinta-3)]">Tipo de obra</Label>
          <Select.Trigger className="h-10 rounded-xl text-[13.5px]"><Select.Value className="text-[13.5px]" /><Select.Indicator /></Select.Trigger>
          <Select.Popover>
            <ListBox className="p-1">
              {TIPOS_OBRA.map(t => (
                <ListBox.Item key={t} id={t} textValue={ETIQUETAS_OBRA[t]} className="min-h-[calc(36px*var(--zoom-interfaz))] rounded-lg text-[calc(14px*var(--zoom-interfaz))]">
                  {ETIQUETAS_OBRA[t]}<ListBox.ItemIndicator className="size-[calc(16px*var(--zoom-interfaz))] [&_svg]:size-full" />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      <Grupo etiqueta="Prioridad" valor={cambios.prioridad} opciones={PRIORIDADES} onCambiar={v => setCambios({ ...cambios, prioridad: v })} />
      <Select selectedKey={cambios.estado} onSelectionChange={k => setCambios({ ...cambios, estado: String(k) })} fullWidth>
        <Label className="text-[12.5px] font-medium text-[var(--tinta-3)]">Estado</Label>
        <Select.Trigger className="h-10 rounded-xl text-[13.5px]"><Select.Value className="text-[13.5px]" /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox className="p-1">
            {ESTADOS_OBRA.map(t => (
              <ListBox.Item key={t} id={t} textValue={ETIQUETAS_OBRA[t]} className="min-h-[calc(36px*var(--zoom-interfaz))] rounded-lg text-[calc(14px*var(--zoom-interfaz))]">
                {ETIQUETAS_OBRA[t]}<ListBox.ItemIndicator className="size-[calc(16px*var(--zoom-interfaz))] [&_svg]:size-full" />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <label className="flex flex-col gap-1 text-[12.5px] font-medium text-[var(--tinta-3)]">Descripción
        <TextArea rows={2} value={cambios.descripcion} onChange={e => setCambios({ ...cambios, descripcion: e.target.value })} className="resize-none rounded-xl text-[13.5px]" />
      </label>
      {error && <p role="alert" className="text-[12.5px] font-medium text-[var(--danger)]">{error}</p>}
      <div className="mt-auto flex flex-col gap-2 pt-1">
        <button type="submit" disabled={!!ocupado} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--tinta)] text-[13.5px] font-semibold text-[var(--superficie)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">
          {ocupado === 'guardar' && <Spinner size="sm" />} Guardar cambios
        </button>
        {confirmar ? (
          <div role="group" aria-label="Confirmar el borrado" className="flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] p-1.5 pl-3">
            <span className="flex-1 text-[12.5px] font-medium text-[var(--danger)]">¿Borrar la obra {numero}?</span>
            <button type="button" onClick={() => setConfirmar(false)} className="h-8 rounded-lg px-2.5 text-[12.5px] font-medium text-[var(--tinta-2)] hover:bg-[var(--superficie)] focus-visible:outline-2">No</button>
            <button type="button" onClick={() => hacer('borrar')} disabled={!!ocupado} autoFocus className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--danger)] px-2.5 text-[12.5px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">
              {ocupado === 'borrar' && <Spinner size="sm" color="current" />} Sí, borrar
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmar(true)} disabled={!!ocupado} className="flex h-9 items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] focus-visible:outline-2 disabled:opacity-50">
            <Trash size={15} weight="bold" /> Borrar la obra
          </button>
        )}
      </div>
    </motion.form>
  );
}

function Grupo({ etiqueta, valor, opciones, onCambiar }: { etiqueta: string; valor: string; opciones: string[]; onCambiar: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12.5px] font-medium text-[var(--tinta-3)]" id={`grupo-${etiqueta}`}>{etiqueta}</span>
      <ToggleButtonGroup aria-labelledby={`grupo-${etiqueta}`} selectionMode="single" disallowEmptySelection selectedKeys={new Set([valor])} onSelectionChange={k => onCambiar(String([...k][0]))} fullWidth size="sm">
        {opciones.map(o => (
          <ToggleButton key={o} id={o} className="h-9 text-[13px]">
            <span className={`size-2 rounded-full ${o === 'alta' ? 'bg-[var(--vial)]' : o === 'media' ? 'bg-[var(--warning)]' : 'bg-[var(--tinta-3)]'}`} />{ETIQUETAS_OBRA[o] ?? o}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

