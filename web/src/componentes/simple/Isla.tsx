// La pastilla de arriba del escritorio del modo simple: el buscador, colgado del borde superior con los mismos
// filetes cóncavos que Capas, Ajustes y Herramientas. El campo es del mismo negro que la pastilla (sin un gris
// adentro): solo se enciende el borde naranja al escribir. Su lista de sugerencias cuelga por debajo.
export default function Isla({ style, children }: { style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className="isla superficie-notch entra pointer-events-none absolute inset-x-0 top-0 z-20" style={style}>
      <span aria-hidden="true" className="isla-filete" data-borde="izquierda" />
      <span aria-hidden="true" className="isla-filete" data-borde="derecha" />
      <div className="isla-fondo" />
      <div className="isla-buscador" data-guia="buscar">{children}</div>
    </div>
  );
}
