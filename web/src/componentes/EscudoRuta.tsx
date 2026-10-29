// Escudo de ruta nacional argentina: el sello de la RN11 en todo el visor.
export default function EscudoRuta({ numero = '11', className = '' }: { numero?: string; className?: string }) {
  return (
    <svg viewBox="0 0 32 36" className={className} aria-hidden="true">
      <path
        d="M2 3h28v15c0 8-6.5 13.5-14 16C8.5 31.5 2 26 2 18z"
        fill="var(--escudo-fondo, #fff)"
        stroke="var(--escudo-tinta, #15181c)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M4.5 5.5h23v5h-23z" fill="var(--escudo-tinta, #15181c)" />
      <text
        x="16" y="26.2" textAnchor="middle" fill="var(--escudo-tinta, #15181c)"
        style={{ font: '700 12.5px "Schibsted Grotesk Variable", sans-serif', letterSpacing: '-0.04em' }}
      >
        {numero}
      </text>
    </svg>
  );
}
