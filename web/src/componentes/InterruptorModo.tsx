import { Segmentado } from './ui/segmentado';
import type { Interfaz } from '../interfaz';

// Simple / Pro, siempre a la vista arriba. El mapa, las capas y lo elegido se mantienen al cambiar.
export default function InterruptorModo({ valor, onCambiar, className }: { valor: Interfaz; onCambiar: (v: Interfaz) => void; className?: string }) {
  return (
    <Segmentado
      etiqueta="Tipo de pantalla"
      valor={valor}
      onCambiar={onCambiar}
      className={className}
      opciones={[{ valor: 'simple', etiqueta: 'Simple' }, { valor: 'pro', etiqueta: 'Pro' }]}
    />
  );
}
