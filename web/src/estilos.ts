// Estilos de las capas de contexto que en GeoServer usan el estilo por defecto (azul puro, gris con
// borde negro). Viajan en el pedido WMS dentro del SLD_BODY, así no se toca la configuración de A.2.
// El nombre de la capa va sin prefijo: el visor pide al servicio virtual del workspace (/tpi/wms).

interface Regla {
  titulo: string;
  filtro?: string;
  // Solo se dibuja más cerca que esta escala (denominador).
  hasta?: number;
  simbolo: string;
}

const igual = (campo: string, valor: string) =>
  `<ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>${campo}</ogc:PropertyName><ogc:Literal>${valor}</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>`;

// Los parámetros con su valor por defecto no se escriben: el SLD viaja en la URL de cada tesela.
const parametro = (nombre: string, valor: string | number) => `<CssParameter name="${nombre}">${valor}</CssParameter>`;

const linea = (color: string, ancho: number, trazos?: string, opacidad = 1) =>
  `<LineSymbolizer><Stroke>${parametro('stroke', color)}${parametro('stroke-width', ancho)}`
  + `${opacidad < 1 ? parametro('stroke-opacity', opacidad) : ''}${trazos ? parametro('stroke-dasharray', trazos) : ''}</Stroke></LineSymbolizer>`;

const relleno = (color: string, opacidad = 1) =>
  `<PolygonSymbolizer><Fill>${parametro('fill', color)}${opacidad < 1 ? parametro('fill-opacity', opacidad) : ''}</Fill></PolygonSymbolizer>`;

// Un NamedLayer con estilo propio. Sin reglas, GeoServer usa el estilo por defecto de la capa.
// Los títulos de las reglas solo hacen falta en la leyenda.
function capa(nombre: string, reglas?: Regla[], conTitulos = false) {
  if (!reglas) return `<NamedLayer><Name>${nombre}</Name></NamedLayer>`;
  const cuerpo = reglas.map(r => `<Rule>${conTitulos ? `<Title>${r.titulo}</Title>` : ''}${r.filtro ?? ''}`
    + `${r.hasta ? `<MaxScaleDenominator>${r.hasta}</MaxScaleDenominator>` : ''}${r.simbolo}</Rule>`).join('');
  return `<NamedLayer><Name>${nombre}</Name><UserStyle><FeatureTypeStyle>${cuerpo}</FeatureTypeStyle></UserStyle></NamedLayer>`;
}

const sld = (capas: string) =>
  `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">${capas}</StyledLayerDescriptor>`;

const AGUA = '#5f97bf';
const AGUA_CLARA = '#a9c9de';

const REGLAS: Record<string, Regla[]> = {
  curso_de_agua_hid: [
    { titulo: 'Curso perenne', filtro: igual('regimen', 'Permanente'), hasta: 12_000_000, simbolo: linea(AGUA, 0.9, undefined, 0.85) },
    { titulo: 'Curso intermitente', filtro: igual('regimen', 'Intermitente'), hasta: 2_500_000, simbolo: linea(AGUA, 0.6, '3 2.5', 0.6) },
  ],
  espejo_de_agua_hid: [
    { titulo: 'Lago o laguna perenne', filtro: igual('tipo', 'Lago o Laguna Perenne'), simbolo: relleno(AGUA_CLARA) },
    { titulo: 'Lago o laguna intermitente', filtro: igual('tipo', 'Lago o Laguna Intermitente'), simbolo: relleno(AGUA_CLARA, 0.55) },
    { titulo: 'Bañado y estero', filtro: '<ogc:Filter><ogc:Or>'
        + ['Bañado Perenne', 'Bañado Intermitente', 'Estero'].map(v => `<ogc:PropertyIsEqualTo><ogc:PropertyName>tipo</ogc:PropertyName><ogc:Literal>${v}</ogc:Literal></ogc:PropertyIsEqualTo>`).join('')
        + '</ogc:Or></ogc:Filter>', simbolo: relleno('#b9d3c4', 0.6) },
  ],
  limite_politico_administrativo_lim: [
    { titulo: 'Límite internacional', filtro: igual('tipo', 'Limite Internacional'), simbolo: linea('#3b4047', 1.4, '7 3 1.5 3') },
    { titulo: 'Límite provincial', filtro: igual('tipo', 'Limite Provincial'), simbolo: linea('#5d636b', 1, '5 3') },
    { titulo: 'Costa', filtro: igual('tipo', 'Costa'), simbolo: linea(AGUA, 0.8, undefined, 0.7) },
  ],
  isla: [{ titulo: 'Isla', simbolo: relleno('#dfe3d5') }],
};

// Un solo SLD con todas las capas prendidas, en orden de dibujo: GeoServer devuelve una imagen por
// tesela en lugar de una por capa, y resuelve juntos los rótulos de todas las capas.
export const sldDeCapas = (nombres: string[]) => sld(nombres.map(n => capa(n, REGLAS[n])).join(''));

// Para GetLegendGraphic: solo las capas con estilo propio necesitan mandarlo.
export const sldDeLeyenda = (nombre: string) => (REGLAS[nombre] ? sld(capa(nombre, REGLAS[nombre], true)) : undefined);

// Minimapa: provincias en gris y Chaco en naranja vial, legible a 130 px.
export const ESTILO_MINIMAPA = sld(capa('provincias', [
  { titulo: 'Chaco', filtro: igual('provincia', 'Chaco'), simbolo: relleno('#e5521f', 0.9) },
  { titulo: 'Otras provincias', filtro: '<ElseFilter/>', simbolo: relleno('#cfd4cd') + linea('#f6f7f4', 0.8) },
]));
