import { useState } from 'react';
import { PRIORIDADES, TIPOS_OBRA } from '../config';
import type { DatosObra } from '../obras';

interface Props {
  onGuardar: (datos: DatosObra) => void;
  onCancelar: () => void;
}

export default function FormObra({ onGuardar, onCancelar }: Props) {
  const [datos, setDatos] = useState<DatosObra>({ tipo_obra: TIPOS_OBRA[0], prioridad: 'media', descripcion: '' });
  const cambiar = (campo: keyof DatosObra) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDatos({ ...datos, [campo]: e.target.value });

  return (
    <div className="form-obra">
      <select value={datos.tipo_obra} onChange={cambiar('tipo_obra')}>
        {TIPOS_OBRA.map(t => <option key={t}>{t}</option>)}
      </select>
      <select value={datos.prioridad} onChange={cambiar('prioridad')}>
        {PRIORIDADES.map(p => <option key={p}>{p}</option>)}
      </select>
      <input placeholder="Descripción" value={datos.descripcion} onChange={cambiar('descripcion')} />
      <button onClick={() => onGuardar(datos)}>Guardar</button>{' '}
      <button onClick={onCancelar}>Cancelar</button>
    </div>
  );
}
