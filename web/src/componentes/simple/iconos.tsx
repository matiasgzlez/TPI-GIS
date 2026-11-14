import { Buildings, Factory, FirstAidKit, Lightning, Mountains, RoadHorizon, Tree, Waves } from '@phosphor-icons/react';
import EscudoRuta from '../EscudoRuta';

// Un dibujo por temática del modo simple.
export function IconoTematica({ id, size = 20 }: { id: string; size?: number }) {
  if (id === 'ruta') {
    return <EscudoRuta className="h-[22px] w-auto" />;
  }
  const Icono = { pueblos: Buildings, caminos: RoadHorizon, agua: Waves, servicios: FirstAidKit, naturaleza: Tree, relieve: Mountains, energia: Lightning, trabajo: Factory }[id] ?? Buildings;
  return <Icono size={size} weight="fill" />;
}
