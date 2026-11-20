import { useEffect, useRef, useState } from 'react';

// Los resultados del escritorio del modo simple (qué hay acá, la zona, la medida y las preguntas): salen del
// notch de la derecha, en el lugar de "Ajustes". Mientras hay resultados, la pastilla de Ajustes se cambia por
// esta (misma forma, mismo lugar), que se estira hasta ser el panel; al cerrarlos se recoge en la pastilla y
// vuelve Ajustes. Usa el mismo armado que Notch (.notch-contenedor, recorte animado y filetes cóncavos), pero
// la abren y la cierran los resultados, no el cursor. El ancho es fijo y el alto, el de lo de adentro
// (como mucho, hasta el minimapa): se mide acá y se pasa al recorte como --alto (estilos.css).
// `onRecogida`: avisa cuando terminó de recogerse, para que vuelva la pastilla de Ajustes.
const RECOGER = 480;

export default function NotchResultados({ contenido, onRecogida }: { contenido: React.ReactNode | null; onRecogida: () => void }) {
  const [mostrado, setMostrado] = useState<React.ReactNode | null>(contenido);
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const medir = () => caja.current?.style.setProperty('--alto', `${cuerpo.current?.offsetHeight ?? 0}px`);
    const observador = new ResizeObserver(medir);
    if (cuerpo.current) observador.observe(cuerpo.current);
    medir();
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (contenido) {
      setMostrado(contenido);
      // Un cuadro cerrada (la pastilla) y después abierta: así el recorte se anima desde la pastilla.
      let cuadro = requestAnimationFrame(() => { cuadro = requestAnimationFrame(() => setAbierta(true)); });
      return () => cancelAnimationFrame(cuadro);
    }
    setAbierta(false);
    // Si el foco estaba adentro, queda en la caja mientras se recoge (no en la nada); al terminar pasa a Ajustes.
    if (caja.current?.contains(document.activeElement)) caja.current.focus({ preventScroll: true });
    const reloj = setTimeout(() => { setMostrado(null); onRecogida(); }, RECOGER);
    return () => clearTimeout(reloj);
  }, [contenido, onRecogida]);

  return (
    <div ref={caja} tabIndex={-1} className="notch-contenedor notch-resultados relative outline-none" data-lado="derecha" data-alto="contenido" data-abierta={abierta || undefined}>
      <span aria-hidden="true" className="notch-filete" data-borde="arriba" />
      <span aria-hidden="true" className="notch-filete" data-borde="abajo" />
      <div className="notch dark pointer-events-auto" data-abierta={abierta || undefined}>
        <div ref={cuerpo} className="notch-cuerpo flex min-h-0 flex-col" inert={!abierta}>{mostrado}</div>
      </div>
    </div>
  );
}
