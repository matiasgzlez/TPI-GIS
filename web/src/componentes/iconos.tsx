import {
  ArrowCounterClockwise, CornersOut, Crosshair, EyeSlash, Hand, MapPin, MapPinPlus, MoonStars,
  Polygon, Ruler, SelectionPlus, Stack, type Icon,
} from '@phosphor-icons/react';
import type { Modo } from '../herramientas';

// Un ícono por herramienta: el mismo en el dock y en el buscador.
export const ICONOS_HERRAMIENTA: Record<Modo, Icon> = {
  navegar: Hand,
  punto: Crosshair,
  rectangulo: SelectionPlus,
  distancia: Ruler,
  area: Polygon,
  alta: MapPinPlus,
};

export const ICONOS_ACCION: Record<string, Icon> = {
  'accion:chaco': CornersOut,
  'accion:apagar': EyeSlash,
  'accion:restablecer': ArrowCounterClockwise,
  'accion:tema': MoonStars,
};

export const IconoCapa = Stack;
export const IconoLugar = MapPin;
