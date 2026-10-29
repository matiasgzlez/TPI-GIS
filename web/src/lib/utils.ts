import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utilidad de clases que usan los componentes de Aceternity (convención de shadcn).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
