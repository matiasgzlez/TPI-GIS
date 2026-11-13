// Estilos de las capas de contexto que en GeoServer usan el estilo por defecto (azul puro, gris con
// borde negro). Viajan en el pedido WMS dentro del SLD_BODY, así no se toca la configuración de A.2.
// El nombre de la capa va sin prefijo: el visor pide al servicio virtual del workspace (/tpi/wms).
//
// Generalización por escala: cada capa densa se dibuja por bandas (país, región, provincia, local).
// Cambia qué se dibuja y con cuánto peso, no la paleta.

// Límites de las bandas, como denominador de escala.
export const ESCALAS = { pais: 6_000_000, region: 2_500_000, provincia: 800_000 } as const;
const { pais: PAIS, region: REGION, provincia: PROVINCIA } = ESCALAS;

export function bandaDeEscala(denominador: number): string {
  if (denominador > PAIS) return 'Vista país';
  if (denominador > REGION) return 'Región';
  if (denominador > PROVINCIA) return 'Provincia';
  return 'Local';
}

interface Regla {
  titulo: string;
  // Fragmento de filtro (ver igual, cualquiera, todos…) o RESTO. Sin filtro, la regla alcanza a todo.
  filtro?: string;
  // Solo se dibuja a esta escala o más alejada (MinScaleDenominator).
  desde?: number;
  // Solo se dibuja más cerca que esta escala (MaxScaleDenominator).
  hasta?: number;
  simbolo: string;
  // Va en un segundo FeatureTypeStyle: se dibuja sobre el resto de la capa.
  encima?: boolean;
  // Duplica el símbolo de otra regla (otra banda) o es solo un rótulo: no aparece en la leyenda.
  sinLeyenda?: boolean;
}

const RESTO = '<ElseFilter/>';

// Fragmentos de filtro: se combinan y capa() los envuelve en <ogc:Filter>.
const propiedad = (campo: string) => `<ogc:PropertyName>${campo}</ogc:PropertyName>`;
const comparar = (operador: string, campo: string, valor: string | number) =>
  `<ogc:${operador}>${propiedad(campo)}<ogc:Literal>${valor}</ogc:Literal></ogc:${operador}>`;

const igual = (campo: string, valor: string) => comparar('PropertyIsEqualTo', campo, valor);
const mayorIgual = (campo: string, n: number) => comparar('PropertyIsGreaterThanOrEqualTo', campo, n);
const menor = (campo: string, n: number) => comparar('PropertyIsLessThan', campo, n);
const como = (campo: string, patron: string) =>
  `<ogc:PropertyIsLike wildCard="%" singleChar="_" escape="!">${propiedad(campo)}<ogc:Literal>${patron}</ogc:Literal></ogc:PropertyIsLike>`;
const cualquiera = (campo: string, valores: string[]) =>
  valores.length === 1 ? igual(campo, valores[0]) : `<ogc:Or>${valores.map(v => igual(campo, v)).join('')}</ogc:Or>`;
const todos = (...filtros: string[]) => `<ogc:And>${filtros.join('')}</ogc:And>`;
const no = (filtro: string) => `<ogc:Not>${filtro}</ogc:Not>`;

// Los parámetros con su valor por defecto no se escriben: el SLD viaja en la URL de cada tesela.
const parametro = (nombre: string, valor: string | number) => `<CssParameter name="${nombre}">${valor}</CssParameter>`;

const linea = (color: string, ancho: number, trazos?: string, opacidad = 1) =>
  `<LineSymbolizer><Stroke>${parametro('stroke', color)}${parametro('stroke-width', ancho)}`
  + `${opacidad < 1 ? parametro('stroke-opacity', opacidad) : ''}${trazos ? parametro('stroke-dasharray', trazos) : ''}</Stroke></LineSymbolizer>`;

const relleno = (color: string, opacidad = 1, borde?: [color: string, ancho: number]) =>
  `<PolygonSymbolizer><Fill>${parametro('fill', color)}${opacidad < 1 ? parametro('fill-opacity', opacidad) : ''}</Fill>`
  + `${borde ? `<Stroke>${parametro('stroke', borde[0])}${parametro('stroke-width', borde[1])}</Stroke>` : ''}</PolygonSymbolizer>`;

// Un punto chico con borde blanco; las capas densas aparecen recién al acercarse.
const punto = (color: string, tamano = 7, forma = 'circle', borde = '#ffffff', anchoBorde = 1.2) =>
  `<PointSymbolizer><Graphic><Mark><WellKnownName>${forma}</WellKnownName><Fill>${parametro('fill', color)}</Fill>`
  + `${anchoBorde ? `<Stroke>${parametro('stroke', borde)}${parametro('stroke-width', anchoBorde)}</Stroke>` : ''}</Mark><Size>${tamano}</Size></Graphic></PointSymbolizer>`;

interface OpcionesRotulo {
  campo: string;
  tamano: number;
  negrita?: boolean;
  color?: string;
  // Un número fijo, o el campo numérico que ordena los rótulos (los más grandes ganan).
  prioridad?: number | string;
  // Desplazamiento horizontal desde el punto; sin él, el rótulo va centrado en la geometría.
  dx?: number;
  // Ajuste de línea para rótulos largos (px).
  ajuste?: number;
}

// Rótulo con halo del papel. spaceAround deja aire entre rótulos; partials=false (por defecto) evita
// los rótulos cortados en el borde de la tesela, y conflictResolution (por defecto) descarta los que se pisan.
const rotulo = ({ campo, tamano, negrita, color = '#333333', prioridad, dx, ajuste }: OpcionesRotulo) =>
  `<TextSymbolizer><Label>${propiedad(campo)}</Label>`
  + `<Font>${parametro('font-family', 'SansSerif')}${parametro('font-size', tamano)}${negrita ? parametro('font-weight', 'bold') : ''}</Font>`
  + `<LabelPlacement><PointPlacement><AnchorPoint><AnchorPointX>${dx === undefined ? 0.5 : 0}</AnchorPointX><AnchorPointY>0.5</AnchorPointY></AnchorPoint>`
  + `${dx === undefined ? '' : `<Displacement><DisplacementX>${dx}</DisplacementX><DisplacementY>0</DisplacementY></Displacement>`}</PointPlacement></LabelPlacement>`
  + `<Halo><Radius>1.5</Radius><Fill>${parametro('fill', '#FFFFFF')}</Fill></Halo><Fill>${parametro('fill', color)}</Fill>`
  + `${prioridad === undefined ? '' : `<Priority>${typeof prioridad === 'number' ? prioridad : propiedad(prioridad)}</Priority>`}`
  + `<VendorOption name="spaceAround">6</VendorOption>${ajuste ? `<VendorOption name="autoWrap">${ajuste}</VendorOption>` : ''}</TextSymbolizer>`;

function regla(r: Regla, conTitulos: boolean) {
  const filtro = r.filtro === undefined ? '' : r.filtro === RESTO ? RESTO : `<ogc:Filter>${r.filtro}</ogc:Filter>`;
  return `<Rule>${conTitulos ? `<Title>${r.titulo}</Title>` : ''}${filtro}`
    + `${r.desde ? `<MinScaleDenominator>${r.desde}</MinScaleDenominator>` : ''}`
    + `${r.hasta ? `<MaxScaleDenominator>${r.hasta}</MaxScaleDenominator>` : ''}${r.simbolo}</Rule>`;
}

// Un NamedLayer con estilo propio. Sin reglas, GeoServer usa el estilo por defecto de la capa.
// Los títulos de las reglas solo hacen falta en la leyenda, que además omite las que repiten símbolo.
function capa(nombre: string, reglas?: Regla[], conTitulos = false) {
  if (!reglas) return `<NamedLayer><Name>${nombre}</Name></NamedLayer>`;
  const usadas = conTitulos ? reglas.filter(r => !r.sinLeyenda) : reglas;
  const estilo = (rs: Regla[]) => (rs.length ? `<FeatureTypeStyle>${rs.map(r => regla(r, conTitulos)).join('')}</FeatureTypeStyle>` : '');
  return `<NamedLayer><Name>${nombre}</Name><UserStyle>${estilo(usadas.filter(r => !r.encima))}${estilo(usadas.filter(r => r.encima))}</UserStyle></NamedLayer>`;
}

const sld = (capas: string) =>
  `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">${capas}</StyledLayerDescriptor>`;

const AGUA = '#5f97bf';
const AGUA_CLARA = '#a9c9de';

// Ríos que se ven a escala país (verificados contra ign.curso_de_agua_hid: los grandes del Paraná, Paraguay
// y Uruguay están, en parte, como polígono en espejo_de_agua_hid).
const RIOS_TRONCALES = [
  'Río Paraná', 'Río Paraná Guazú', 'Río Paraná De Las Palmas', 'Río Paraguay', 'Río Uruguay', 'Río Iguazú',
  'Río Bermejo', 'Río Pilcomayo', 'Río Salado', 'Río Dulce', 'Río Colorado', 'Río Negro', 'Río Limay',
  'Río Neuquén', 'Río Chubut', 'Río Senguer', 'Río Deseado', 'Río Santa Cruz', 'Río Gallegos',
];

// Localidades: la jerarquía es el tamaño (canthab), no el tipo administrativo.
const CAPITAL = cualquiera('tipo', ['Capital de Nación', 'Capital de Provincia']);
const CIUDAD = cualquiera('tipo', ['Ciudad', 'Cabecera de Partido o Departamento']);
const MENOR = cualquiera('tipo', ['Localidad', 'Pueblo', 'Villa', 'Colonia', 'Barrio']);
const PARAJE = cualquiera('tipo', ['Lugar o Paraje', 'Caserío']);
const CIUDAD_GRANDE = todos(CIUDAD, mayorIgual('canthab', 100_000));
const CIUDAD_MEDIANA = todos(CIUDAD, mayorIgual('canthab', 20_000), menor('canthab', 100_000));
const CIUDAD_CHICA = todos(CIUDAD, no(mayorIgual('canthab', 20_000)));
const ROJO_CIUDAD = '#E53935';

// Red vial: pavimentado por jurisdicción. Lo que no es provincial ni vecinal cuenta como nacional.
const PAVIMENTADO = igual('tipo', 'Camino Pavimentado');
const VIAL_VECINAL = todos(PAVIMENTADO, igual('administra', 'Vecinal'));
const VIAL_PROVINCIAL = todos(PAVIMENTADO, igual('administra', 'Provincial'));
const VIAL_NACIONAL = todos(PAVIMENTADO, no(cualquiera('administra', ['Provincial', 'Vecinal'])));
const NARANJA = '#E67E22';

const REGLAS: Record<string, Regla[]> = {
  curso_de_agua_hid: [
    { titulo: 'Curso perenne', filtro: todos(igual('regimen', 'Permanente'), igual('tipo', 'Corriente de Agua Perenne')),
      hasta: REGION, simbolo: linea(AGUA, 0.9, undefined, 0.85) },
    { titulo: 'Acequia, canal o zanjón', filtro: todos(igual('regimen', 'Permanente'), no(igual('tipo', 'Corriente de Agua Perenne'))),
      hasta: PROVINCIA, simbolo: linea(AGUA, 0.9, undefined, 0.85) },
    { titulo: 'Río', filtro: todos(igual('regimen', 'Permanente'), como('nombre', 'Río %')),
      desde: REGION, hasta: PAIS, sinLeyenda: true, simbolo: linea(AGUA, 0.7, undefined, 0.75) },
    { titulo: 'Río troncal', filtro: cualquiera('nombre', RIOS_TRONCALES),
      desde: PAIS, hasta: 12_000_000, sinLeyenda: true, simbolo: linea(AGUA, 0.7, undefined, 0.6) },
    { titulo: 'Curso intermitente', filtro: igual('regimen', 'Intermitente'), hasta: 1_500_000, simbolo: linea(AGUA, 0.6, '3 2.5', 0.6) },
  ],
  espejo_de_agua_hid: [
    { titulo: 'Lago o laguna perenne', filtro: igual('tipo', 'Lago o Laguna Perenne'), simbolo: relleno(AGUA_CLARA) },
    { titulo: 'Lago o laguna intermitente', filtro: igual('tipo', 'Lago o Laguna Intermitente'), simbolo: relleno(AGUA_CLARA, 0.55) },
    { titulo: 'Bañado y estero', filtro: cualquiera('tipo', ['Bañado Perenne', 'Bañado Intermitente', 'Estero']), simbolo: relleno('#b9d3c4', 0.6) },
  ],
  limite_politico_administrativo_lim: [
    { titulo: 'Límite internacional', filtro: igual('tipo', 'Limite Internacional'), simbolo: linea('#3b4047', 1.4, '7 3 1.5 3') },
    { titulo: 'Límite provincial', filtro: igual('tipo', 'Limite Provincial'), simbolo: linea('#5d636b', 1, '5 3') },
    // A escala país la costa se duplica con los ríos y espejos de agua.
    { titulo: 'Costa', filtro: igual('tipo', 'Costa'), hasta: PAIS, simbolo: linea(AGUA, 0.8, undefined, 0.7) },
  ],
  provincias: [
    { titulo: 'Provincia del Chaco', filtro: igual('provincia', 'Chaco'), simbolo: relleno('#FBEFD5', 1, ['#8C6D46', 1.6]) },
    { titulo: 'Otras provincias', filtro: RESTO, simbolo: relleno('#F2F0EC', 1, ['#9A9087', 0.8]) },
    // Más cerca el nombre de la provincia compite con las localidades.
    { titulo: 'Nombre de provincia', desde: REGION, encima: true, sinLeyenda: true,
      simbolo: rotulo({ campo: 'provincia', tamano: 11, color: '#5D4E3F', ajuste: 80 }) },
  ],
  localidades: [
    { titulo: 'Paraje o caserío', filtro: PARAJE, hasta: 1_000_000, simbolo: punto('#BDBDBD', 3, 'circle', '#ffffff', 0) },
    { titulo: 'Rótulo de paraje', filtro: PARAJE, hasta: 300_000, sinLeyenda: true, simbolo: rotulo({ campo: 'nombre', tamano: 9, dx: 5 }) },
    { titulo: 'Localidad, pueblo o colonia', filtro: MENOR, hasta: 1_500_000, simbolo: punto('#EF9A9A', 4, 'circle', '#B71C1C', 0.5) },
    { titulo: 'Rótulo de localidad', filtro: MENOR, hasta: 600_000, sinLeyenda: true, simbolo: rotulo({ campo: 'nombre', tamano: 9, dx: 5, prioridad: 'canthab' }) },
    { titulo: 'Ciudad o cabecera menor', filtro: CIUDAD_CHICA, hasta: 1_500_000, simbolo: punto(ROJO_CIUDAD, 4, 'circle', '#FFFFFF', 0.8) },
    { titulo: 'Rótulo de ciudad menor', filtro: CIUDAD_CHICA, hasta: PROVINCIA, sinLeyenda: true, simbolo: rotulo({ campo: 'nombre', tamano: 10, dx: 5, prioridad: 'canthab' }) },
    { titulo: 'Ciudad de 20.000 a 100.000 hab.', filtro: CIUDAD_MEDIANA, hasta: REGION,
      simbolo: punto(ROJO_CIUDAD, 6, 'circle', '#FFFFFF', 0.8) + rotulo({ campo: 'nombre', tamano: 10, dx: 5, prioridad: 'canthab' }) },
    { titulo: 'Ciudad de 100.000 hab. o más', filtro: CIUDAD_GRANDE, hasta: 10_000_000,
      simbolo: punto(ROJO_CIUDAD, 8, 'circle', '#FFFFFF', 0.8) + rotulo({ campo: 'nombre', tamano: 10, dx: 6, prioridad: 'canthab' }) },
    // Las capitales van en un FeatureTypeStyle aparte para dibujarse encima del resto.
    { titulo: 'Capital nacional o provincial', filtro: CAPITAL, encima: true,
      simbolo: punto('#B71C1C', 12, 'star', '#FFFFFF', 0.8) + rotulo({ campo: 'nombre', tamano: 11, negrita: true, color: '#222222', dx: 8, prioridad: 100_000 }) },
  ],
  red_vial: [
    // Los caminos de tierra son 93 000 tramos: solo se dibujan de 1:1.500.000 en adelante.
    { titulo: 'Camino de tierra', filtro: igual('tipo', 'Camino de Tierra, Camino sin Pavimentar de Transitavilidad Temporaria'),
      hasta: 1_500_000, simbolo: linea('#BCAAA4', 0.6) },
    { titulo: 'Camino consolidado', filtro: igual('tipo', 'Camino Consolidado, Camino sin Pavimentar de Transitavilidad Permanente'),
      hasta: REGION, simbolo: linea('#8D6E63', 1, '4 2') },
    { titulo: 'Camino pavimentado vecinal', filtro: VIAL_VECINAL, hasta: REGION, simbolo: linea(NARANJA, 1.6) },
    { titulo: 'Camino pavimentado provincial', filtro: VIAL_PROVINCIAL, hasta: REGION, simbolo: linea(NARANJA, 1.6) },
    { titulo: 'Camino pavimentado provincial', filtro: VIAL_PROVINCIAL, desde: REGION, hasta: PAIS, sinLeyenda: true, simbolo: linea(NARANJA, 1) },
    { titulo: 'Camino pavimentado nacional', filtro: VIAL_NACIONAL, hasta: REGION, simbolo: linea(NARANJA, 1.6) },
    { titulo: 'Camino pavimentado nacional', filtro: VIAL_NACIONAL, desde: REGION, hasta: PAIS, sinLeyenda: true, simbolo: linea(NARANJA, 1.3) },
    { titulo: 'Camino pavimentado nacional', filtro: VIAL_NACIONAL, desde: PAIS, sinLeyenda: true, simbolo: linea(NARANJA, 1) },
    { titulo: 'Autopista', filtro: igual('tipo', 'Autopista con Camino Pavimentado Dual con Separador'), hasta: REGION, simbolo: linea('#C0392B', 2.8) },
    { titulo: 'Autopista', filtro: igual('tipo', 'Autopista con Camino Pavimentado Dual con Separador'), desde: REGION, sinLeyenda: true, simbolo: linea('#C0392B', 2) },
  ],
  isla: [{ titulo: 'Isla', simbolo: relleno('#dfe3d5') }],
  edif_educacion: [{ titulo: 'Establecimiento educativo', hasta: 1_500_000, simbolo: punto('#3d6fb0', 7) }],
  edificio_de_salud_ips: [{ titulo: 'Establecimiento de salud', hasta: 3_000_000, simbolo: punto('#2f8f6b', 9, 'cross') }],
  edificio_de_seguridad_ips: [{ titulo: 'Seguridad', hasta: 1_500_000, simbolo: punto('#5b5f66', 7, 'square') }],
  otras_edificaciones: [{ titulo: 'Edificación', hasta: 250_000, simbolo: punto('#8a8f96', 5) }],
  marcas_y_senales: [{ titulo: 'Marca o señal', hasta: 750_000, simbolo: punto('#8a8f96', 5) }],
  puntos_del_terreno: [{ titulo: 'Punto del terreno', hasta: 750_000, simbolo: punto('#9a7b4f', 5) }],
};

// Capas que mantienen el estilo por defecto de GeoServer pero con umbral de escala propio
// (los de geoserver/estilos). Solo sirve para avisar en el panel.
const UMBRALES_PUBLICADOS: Record<string, number> = {
  puente_red_vial_puntos: 5_000_000,
};

// Escala (denominador) por debajo de la cual la capa empieza a dibujarse, o undefined si ya se ve siempre.
export function escalaMinima(nombre: string): number | undefined {
  const reglas = REGLAS[nombre];
  if (!reglas) return UMBRALES_PUBLICADOS[nombre];
  if (reglas.some(r => !r.hasta)) return undefined;
  return Math.max(...reglas.map(r => r.hasta!));
}

// Un solo SLD con todas las capas prendidas, en orden de dibujo: GeoServer devuelve una imagen por
// tesela en lugar de una por capa, y resuelve juntos los rótulos de todas las capas.
export const sldDeCapas = (nombres: string[]) => sld(nombres.map(n => capa(n, REGLAS[n])).join(''));

// Para GetLegendGraphic: solo las capas con estilo propio necesitan mandarlo.
export const sldDeLeyenda = (nombre: string) => (REGLAS[nombre] ? sld(capa(nombre, REGLAS[nombre], true)) : undefined);

// Minimapa: provincias en gris y Chaco en naranja vial, legible a 130 px.
export const ESTILO_MINIMAPA = sld(capa('provincias', [
  { titulo: 'Chaco', filtro: igual('provincia', 'Chaco'), simbolo: relleno('#e5521f', 0.9) },
  { titulo: 'Otras provincias', filtro: RESTO, simbolo: relleno('#cfd4cd') + linea('#f6f7f4', 0.8) },
]));
