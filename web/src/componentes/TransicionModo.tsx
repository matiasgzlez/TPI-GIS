import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Interfaz } from '../interfaz';

// El pase de Simple a Pro (y de vuelta): una pantalla blanca que nace del interruptor como un círculo y
// cubre todo; en el centro, el mismo interruptor en gigante cambia de lado. Con la pantalla tapada se cambia el modo
// (onCubierta) y después la pantalla blanca se levanta como un telón tirado del medio (1,7 s) y deja ver el modo nuevo.
// La entrada y la perilla son animaciones CSS de transform (estilos .pase en estilos.css) y el telón, un
// clip-path animado con Web Animations; el cambio de modo pasa con todo quieto, así no traba la perilla.
export interface Pase { de: Interfaz; a: Interfaz; x: number; y: number }

const NOMBRE: Record<Interfaz, string> = { simple: 'Simple', pro: 'Pro' };
// Para que sea un switch fluido, nada pesado pasa mientras algo se mueve: el círculo cubre (0,62 s) y la
// perilla viaja (de 0,45 a 1,17 s); recién con todo quieto se cambia el modo (React arma la otra pantalla y el
// mapa se redibuja, lo que antes trababa la perilla a mitad de camino). El telón sube cuando el navegador
// quedó libre: dos cuadros dibujados y una pausa corta (sin requestIdleCallback: Safari no lo tiene, y ahí la
// pantalla blanca se quedaba congelada). Seguro: pase lo que pase, a los 4,1 s el pase se cierra.
const CAMBIO = 1200;
const TELON = 1700;

// El telón como una tela agarrada del medio de abajo y tirada hacia arriba: el borde inferior es una curva
// (un clip-path, con más puntos cerca de la mano) con un pico donde está la mano, que sube primero; los costados cuelgan y suben
// después, y la tela se va juntando (el pico se abre) a medida que sube. Se calcula en 30 cuadros clave.
const entre = (t: number, desde: number, hasta: number) => Math.min(1, Math.max(0, (t - desde) / (hasta - desde)));
const enOut = (u: number, k: number) => 1 - (1 - u) ** k;
const enInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
// Las x del borde: cada 5 % en los costados y cada 1,5 % cerca de la mano (±12 %), donde la curva se dobla:
// suave en la tele sin sumar puntos de más (cada uno es trabajo por cuadro).
const XS = [...new Set([...Array.from({ length: 21 }, (_, i) => i * 5), ...Array.from({ length: 17 }, (_, i) => 38 + i * 1.5)])].sort((a, b) => b - a);
function borde(t: number, corrimiento = 0) {
  // La mano tira de entrada (arranque firme que frena) y termina arriba; los costados cuelgan, arrancan tarde y
  // terminan de salir justo al final (sin un tramo muerto). La punta, pellizcada y con flancos cóncavos.
  const centro = 100 - 110 * enOut(entre(t, 0, 0.8), 2.4);
  const costado = 100 - 102 * enInOut(entre(t, 0.12, 1));
  const ancho = 8 + 24 * t;
  const puntos = ['0% 0%', '100% 0%'];
  for (const x of XS) {
    const pico = 1 / (1 + (Math.abs(x - 50) / ancho) ** 1.6);
    const y = Math.max(0, costado - (costado - centro) * pico + corrimiento * (1 - t));
    puntos.push(`${x}% ${y.toFixed(2)}%`);
  }
  return `polygon(${puntos.join(', ')})`;
}
const cuadrosTelon = (corrimiento = 0) => Array.from({ length: 30 }, (_, i) => ({ clipPath: borde(i / 29, corrimiento) }));

export default function TransicionModo({ pase, onCubierta, onFin }: { pase: Pase; onCubierta: () => void; onFin: () => void }) {
  const [fase, setFase] = useState<'entra' | 'cambiado' | 'sale'>('entra');
  // El aviso para lectores de pantalla se escribe un instante después de montar la región viva: algunos
  // lectores no anuncian una región que aparece ya con el texto adentro.
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    const reloj = setTimeout(() => setAviso(`Cambiando a ${NOMBRE[pase.a]}`), 100);
    return () => clearTimeout(reloj);
  }, [pase.a]);
  const llamadas = useRef({ onCubierta, onFin });
  const tela = useRef<HTMLDivElement>(null);
  const sombras = useRef<HTMLDivElement>(null);
  const contenido = useRef<HTMLDivElement>(null);
  llamadas.current = { onCubierta, onFin };

  useEffect(() => {
    const reloj = setTimeout(() => {
      try { llamadas.current.onCubierta(); } finally { setFase('cambiado'); }
    }, CAMBIO);
    const seguro = setTimeout(() => llamadas.current.onFin(), CAMBIO + TELON + 1200);
    return () => { clearTimeout(reloj); clearTimeout(seguro); };
  }, []);
  useEffect(() => {
    if (fase === 'cambiado') {
      let pausa = 0;
      let cuadro = requestAnimationFrame(() => {
        cuadro = requestAnimationFrame(() => {
          pausa = window.setTimeout(() => setFase('sale'), 80);
        });
      });
      return () => { cancelAnimationFrame(cuadro); clearTimeout(pausa); };
    }
    if (fase === 'sale') {
      const opciones = { duration: TELON, easing: 'linear', fill: 'forwards' } as const;
      const animaciones = [
        tela.current?.animate(cuadrosTelon(), opciones),
        // La sombra que la tela proyecta sobre el mapa: una capa con el mismo borde, un poco más abajo.
        sombras.current?.animate(cuadrosTelon(2.2), opciones),
        // Lo de adentro sube con la mano y se desvanece.
        contenido.current?.animate(
          [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-38vh) scale(0.96)', opacity: 0 }],
          { duration: TELON * 0.36, easing: 'cubic-bezier(0.4, 0, 0.7, 0.2)', fill: 'forwards' },
        ),
      ];
      const reloj = setTimeout(() => llamadas.current.onFin(), TELON);
      return () => { clearTimeout(reloj); animaciones.forEach(a => a?.cancel()); };
    }
  }, [fase]);

  const haciaPro = pase.a === 'pro';
  return createPortal(
    <div
      className="pase"
      data-fase={fase}
      data-hacia={pase.a}
      style={{ '--x': `${pase.x}px`, '--y': `${pase.y}px` } as React.CSSProperties}
      role="status"
      aria-live="polite"
    >
      <div ref={sombras} aria-hidden="true" className="pase-sombra" />
      <div ref={tela} className="pase-tela">
      <span aria-hidden="true" className="pase-pliegues" />
      <div ref={contenido} className="pase-contenido">
        <span className="sr-only">{aviso}</span>
        <div aria-hidden="true" className="pase-carril" data-hacia={haciaPro ? 'derecha' : 'izquierda'}>
          <span className="pase-perilla" />
          <span className="pase-opcion" data-llega={!haciaPro || undefined} data-sale={haciaPro || undefined}>Simple</span>
          <span className="pase-opcion" data-llega={haciaPro || undefined} data-sale={!haciaPro || undefined}>Pro</span>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}
