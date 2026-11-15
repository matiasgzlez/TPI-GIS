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
      hasta: 1_500_000, simbolo: linea(AGUA, 0.9, undefined, 0.85) },
    // En la vista inicial (Chaco entero) los arroyos eran una maraña: entre 1:1.500.000 y la región, solo los ríos.
    { titulo: 'Río', filtro: todos(igual('regimen', 'Permanente'), como('nombre', 'Río %')),
      desde: 1_500_000, hasta: REGION, sinLeyenda: true, simbolo: linea(AGUA, 0.8, undefined, 0.8) },
    { titulo: 'Acequia, canal o zanjón', filtro: todos(igual('regimen', 'Permanente'), no(igual('tipo', 'Corriente de Agua Perenne'))),
      hasta: PROVINCIA, simbolo: linea(AGUA, 0.9, undefined, 0.85) },
    // De lejos (región y país) solo los ríos troncales: los "Río …" permanentes eran una telaraña.
    { titulo: 'Río troncal', filtro: cualquiera('nombre', RIOS_TRONCALES),
      desde: REGION, hasta: 12_000_000, sinLeyenda: true, simbolo: linea(AGUA, 0.8, undefined, 0.7) },
    { titulo: 'Curso intermitente', filtro: igual('regimen', 'Intermitente'), hasta: 1_500_000, simbolo: linea(AGUA, 0.6, '3 2.5', 0.6) },
  ],
  espejo_de_agua_hid: [
    { titulo: 'Lago o laguna perenne', filtro: igual('tipo', 'Lago o Laguna Perenne'), simbolo: relleno(AGUA_CLARA) },
    // Son 26 000 polígonos: de lejos los chicos e intermitentes eran un salpicado sin información.
    { titulo: 'Lago o laguna intermitente', filtro: igual('tipo', 'Lago o Laguna Intermitente'), hasta: REGION, simbolo: relleno(AGUA_CLARA, 0.55) },
    { titulo: 'Bañado y estero', filtro: cualquiera('tipo', ['Bañado Perenne', 'Bañado Intermitente', 'Estero']), hasta: PROVINCIA, simbolo: relleno('#b9d3c4', 0.6) },
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
    // El nombre de la provincia lo pinta el visor (rotulosProvincia): en teselas se repetía en cada una.
  ],
  localidades: [
    { titulo: 'Paraje o caserío', filtro: PARAJE, hasta: 1_000_000, simbolo: punto('#BDBDBD', 3, 'circle', '#ffffff', 0) },
    { titulo: 'Rótulo de paraje', filtro: PARAJE, hasta: 300_000, sinLeyenda: true, simbolo: rotulo({ campo: 'nombre', tamano: 9, dx: 5 }) },
    { titulo: 'Localidad, pueblo o colonia', filtro: MENOR, hasta: 1_500_000, simbolo: punto('#EF9A9A', 4, 'circle', '#B71C1C', 0.5) },
    { titulo: 'Rótulo de localidad', filtro: MENOR, hasta: 600_000, sinLeyenda: true, simbolo: rotulo({ campo: 'nombre', tamano: 9, dx: 5, prioridad: 'canthab' }) },
    { titulo: 'Ciudad o cabecera menor', filtro: CIUDAD_CHICA, hasta: 1_500_000, simbolo: punto(ROJO_CIUDAD, 4, 'circle', '#FFFFFF', 0.8) },
    { titulo: 'Rótulo de ciudad menor', filtro: CIUDAD_CHICA, hasta: PROVINCIA, sinLeyenda: true, simbolo: rotulo({ campo: 'nombre', tamano: 10, dx: 5, prioridad: 'canthab' }) },
    { titulo: 'Ciudad de 20.000 a 100.000 hab.', filtro: CIUDAD_MEDIANA, hasta: REGION, simbolo: punto(ROJO_CIUDAD, 6, 'circle', '#FFFFFF', 0.8) },
    { titulo: 'Rótulo de ciudad mediana', filtro: CIUDAD_MEDIANA, hasta: REGION, sinLeyenda: true, simbolo: rotulo({ campo: 'nombre', tamano: 10, dx: 5, prioridad: 'canthab' }) },
    { titulo: 'Ciudad de 100.000 hab. o más', filtro: CIUDAD_GRANDE, hasta: 10_000_000, simbolo: punto(ROJO_CIUDAD, 8, 'circle', '#FFFFFF', 0.8) },
    // A escala país hablan los nombres de provincia (los pinta el visor): los de ciudad se pisaban con ellos.
    { titulo: 'Rótulo de ciudad grande', filtro: CIUDAD_GRANDE, hasta: PAIS, sinLeyenda: true, simbolo: rotulo({ campo: 'nombre', tamano: 10, dx: 6, prioridad: 'canthab' }) },
    // Las capitales van en un FeatureTypeStyle aparte para dibujarse encima del resto.
    { titulo: 'Capital nacional o provincial', filtro: CAPITAL, encima: true, simbolo: punto('#B71C1C', 12, 'star', '#FFFFFF', 0.8) },
    // El nombre de las capitales lo pinta el visor (CAPITALES en provincias.ts): en teselas se perdía en
    // el borde entre dos y Resistencia quedaba sin rótulo.
  ],
  red_vial: [
    // Los caminos de tierra son 93 000 tramos: solo se dibujan de 1:1.500.000 en adelante.
    { titulo: 'Camino de tierra', filtro: igual('tipo', 'Camino de Tierra, Camino sin Pavimentar de Transitavilidad Temporaria'),
      hasta: 1_500_000, simbolo: linea('#BCAAA4', 0.6) },
    { titulo: 'Camino consolidado', filtro: igual('tipo', 'Camino Consolidado, Camino sin Pavimentar de Transitavilidad Permanente'),
      hasta: REGION, simbolo: linea('#8D6E63', 1, '4 2') },
    { titulo: 'Camino pavimentado vecinal', filtro: VIAL_VECINAL, hasta: REGION, simbolo: linea(NARANJA, 1.6) },
    { titulo: 'Camino pavimentado provincial', filtro: VIAL_PROVINCIAL, hasta: REGION, simbolo: linea(NARANJA, 1.6) },
    { titulo: 'Camino pavimentado nacional', filtro: VIAL_NACIONAL, hasta: REGION, simbolo: linea(NARANJA, 1.6) },
    { titulo: 'Camino pavimentado nacional', filtro: VIAL_NACIONAL, desde: REGION, hasta: PAIS, sinLeyenda: true, simbolo: linea(NARANJA, 1.3) },
    { titulo: 'Camino pavimentado nacional', filtro: VIAL_NACIONAL, desde: PAIS, sinLeyenda: true, simbolo: linea(NARANJA, 1) },
    { titulo: 'Autopista', filtro: igual('tipo', 'Autopista con Camino Pavimentado Dual con Separador'), hasta: REGION, simbolo: linea('#C0392B', 2.8) },
    { titulo: 'Autopista', filtro: igual('tipo', 'Autopista con Camino Pavimentado Dual con Separador'), desde: REGION, sinLeyenda: true, simbolo: linea('#C0392B', 2) },
  ],
  isla: [{ titulo: 'Isla', simbolo: relleno('#dfe3d5') }],
  // Con el estilo por defecto de GeoServer eran manchas negras y cuadrados rojos en la vista inicial.
  veg_hidrofila: [{ titulo: 'Vegetación hidrófila', hasta: REGION, simbolo: relleno('#b9d3c4', 0.55) }],
  infraestructura_hidro: [{ titulo: 'Infraestructura hídrica', hasta: 1_500_000, simbolo: punto(AGUA, 7, 'square') }],
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

// Lo que el estilo dibuja de una capa a una escala (denominador como lo calcula GeoServer, ver
// denominadorWms), para que las consultas devuelvan solo lo que se ve:
// - false: a esta escala la capa no dibuja nada;
// - null: dibuja todas sus entidades (alguna regla activa no tiene filtro, o es el "resto");
// - un fragmento de filtro OGC: el OR de los filtros de las reglas activas.
export function filtroVisible(nombre: string, denominador: number): string | null | false {
  const reglas = REGLAS[nombre];
  if (!reglas) {
    const umbral = UMBRALES_PUBLICADOS[nombre];
    return umbral !== undefined && denominador >= umbral ? false : null;
  }
  const activas = reglas.filter(r => (!r.desde || denominador >= r.desde) && (!r.hasta || denominador < r.hasta));
  if (!activas.length) return false;
  if (activas.some(r => r.filtro === undefined || r.filtro === RESTO)) return null;
  const filtros = [...new Set(activas.map(r => r.filtro!))];
  return filtros.length === 1 ? filtros[0] : `<ogc:Or>${filtros.join('')}</ogc:Or>`;
}

// En pantallas grandes (factorPantalla) los rótulos y símbolos del WMS crecen con la interfaz. Solo
// cambian tamaños: las escalas de las reglas siguen iguales, así la consulta sigue la misma lógica.
let factorMapa = 1;
export const ponerFactorMapa = (factor: number) => {
  factorMapa = factor;
};
export const tamanoMapa = (px: number) => px * factorMapa;
function agrandarSld(xml: string) {
  if (factorMapa === 1) return xml;
  const f = factorMapa;
  const trazo = 1 + (f - 1) * 0.6;
  return xml
    .replace(/(<CssParameter name="font-size">)([\d.]+)/g, (_, a, n) => `${a}${(Number(n) * f).toFixed(1)}`)
    .replace(/<Size>([\d.]+)<\/Size>/g, (_, n) => `<Size>${(Number(n) * f).toFixed(1)}</Size>`)
    .replace(/(<CssParameter name="stroke-width">)([\d.]+)/g, (_, a, n) => `${a}${(Number(n) * trazo).toFixed(2)}`)
    .replace(/(<Radius>)([\d.]+)/g, (_, a, n) => `${a}${(Number(n) * f).toFixed(1)}`);
}

// Un solo SLD con todas las capas prendidas, en orden de dibujo: GeoServer devuelve una imagen por
// tesela en lugar de una por capa, y resuelve juntos los rótulos de todas las capas.
// `sinRotulos`: capas cuyos rótulos se callan (las reglas "Rótulo de …"). Con el tablero abierto los
// nombres de localidades los pinta el visor junto a las burbujas: los del WMS quedaban tapados por ellas.
// `sinEscala`: capas que se consultan sin las reglas de escala (las que se ven como mapa de calor: la
// mancha muestra todos sus puntos a cualquier escala, así que la consulta también los encuentra).
const PUNTO_CONSULTA: Regla[] = [{ titulo: 'Punto', simbolo: punto('#000000', 8) }];
export const sldDeCapas = (nombres: string[], sinRotulos: ReadonlySet<string> = new Set(), sinEscala: ReadonlySet<string> = new Set()) =>
  agrandarSld(sld(nombres.map(n => capa(n, sinEscala.has(n) ? PUNTO_CONSULTA : sinRotulos.has(n) ? REGLAS[n]?.filter(r => !r.titulo.startsWith('Rótulo')) : REGLAS[n])).join('')));

// Modo simple: los títulos de la leyenda con palabras de todos los días (mismos símbolos y colores).
const TITULOS_SIMPLES: Record<string, string> = {
  'Curso perenne': 'Río o arroyo con agua todo el año', 'Acequia, canal o zanjón': 'Canal o zanja', 'Curso intermitente': 'Arroyo que a veces se seca',
  'Lago o laguna perenne': 'Laguna', 'Lago o laguna intermitente': 'Laguna que a veces se seca', 'Bañado y estero': 'Bañado',
  'Límite internacional': 'Borde con otro país', 'Límite provincial': 'Borde entre provincias', Costa: 'Costa',
  'Paraje o caserío': 'Paraje', 'Localidad, pueblo o colonia': 'Pueblo', 'Ciudad o cabecera menor': 'Ciudad chica',
  'Ciudad de 20.000 a 100.000 hab.': 'Ciudad mediana', 'Ciudad de 100.000 hab. o más': 'Ciudad grande', 'Capital nacional o provincial': 'Capital',
  'Camino de tierra': 'Camino de tierra', 'Camino consolidado': 'Camino de ripio', 'Camino pavimentado vecinal': 'Calle o camino de asfalto',
  'Camino pavimentado provincial': 'Ruta provincial', 'Camino pavimentado nacional': 'Ruta nacional', Autopista: 'Autopista',
  'Establecimiento educativo': 'Escuela', 'Establecimiento de salud': 'Hospital', Seguridad: 'Policía o bomberos', Edificación: 'Casa o galpón',
  'Marca o señal': 'Mojón', 'Punto del terreno': 'Punto medido', 'Vegetación hidrófila': 'Plantas de agua', 'Infraestructura hídrica': 'Obra de agua',
  'Provincia del Chaco': 'El Chaco', 'Otras provincias': 'Otras provincias',
};
// Las obras usan el estilo publicado en GeoServer (geoserver/estilos/obras_rn11.sld): para la leyenda
// simple se repiten sus reglas, con la urgencia en vez de "prioridad".
const OBRAS_SIMPLE: Regla[] = [
  { titulo: 'Poco urgente', filtro: igual('prioridad', 'baja'), simbolo: punto('#FBC02D', 12) },
  { titulo: 'Urgente', filtro: igual('prioridad', 'media'), simbolo: punto('#F57C00', 12) },
  { titulo: 'Muy urgente', filtro: igual('prioridad', 'alta'), simbolo: punto('#D32F2F', 14) },
  { titulo: 'Sin urgencia marcada', filtro: RESTO, simbolo: punto('#9E9E9E', 12) },
];

// Para GetLegendGraphic: solo las capas con estilo propio necesitan mandarlo (y en el modo simple, las obras).
export function sldDeLeyenda(nombre: string, simple = false) {
  if (simple && nombre === 'obras_rn11') return sld(capa(nombre, OBRAS_SIMPLE, true));
  if (!REGLAS[nombre]) return undefined;
  const reglas = simple ? REGLAS[nombre].map(r => ({ ...r, titulo: TITULOS_SIMPLES[r.titulo] ?? r.titulo })) : REGLAS[nombre];
  return sld(capa(nombre, reglas, true));
}

// Miniaturas de las capas (las tarjetas del modo simple y el árbol del profesional): las provincias de
// fondo y la capa con sus mismas reglas, pero sin escalas (a 320 px casi todas quedarían vacías), sin
// rótulos y sin los duplicados por banda. Las que no tienen reglas propias van con un símbolo genérico
// por geometría: su estilo publicado en GeoServer tiene umbrales de escala y saldrían vacías.
const GENERICO = {
  punto: punto('#3d6fb0', 6),
  linea: linea('#5d636b', 1.2),
  poligono: relleno('#9bb07f', 0.7, ['#6f8a55', 0.5]),
};
const FONDO_MINIATURA = capa('provincias', [
  { titulo: 'Chaco', filtro: igual('provincia', 'Chaco'), simbolo: relleno('#FBEFD5', 1, ['#8C6D46', 1.2]) },
  { titulo: 'Otras', filtro: RESTO, simbolo: relleno('#F2F0EC', 1, ['#b9b1a6', 0.6]) },
]);
const sinRotulo = (simbolo: string) => simbolo.replace(/<TextSymbolizer>[\s\S]*?<\/TextSymbolizer>/g, '');

// `realce`: capas con pocos puntos (hospitales, turismo, puertos…): los símbolos se agrandan para que la
// miniatura no parezca vacía.
const agrandar = (simbolo: string) => simbolo.replace(/<Size>([\d.]+)<\/Size>/g, (_, n) => `<Size>${Math.max(14, Math.round(Number(n) * 2.2))}</Size>`);

export function sldMiniatura(nombre: string, geometria: 'punto' | 'linea' | 'poligono', realce = false) {
  if (nombre === 'provincias') return sld(FONDO_MINIATURA);
  // Las obras arrancan vacías: la miniatura muestra la traza de la RN11, que es dónde van.
  if (nombre === 'obras_rn11') {
    return sld(FONDO_MINIATURA + capa('red_vial', [{ titulo: 'RN11', filtro: todos(igual('nro_ruta', '11'), igual('administra', 'Nacional')), simbolo: linea('#e5521f', 3) }]));
  }
  // Las islas del Paraná son finitas: con el relleno del mapa casi no se distinguían del agua.
  if (nombre === 'isla') return sld(FONDO_MINIATURA + capa('isla', [{ titulo: 'Isla', simbolo: relleno('#b9c99a', 1, ['#5f7a45', 0.9]) }]));
  const reglas = REGLAS[nombre]
    ?.filter(r => !r.sinLeyenda && !r.titulo.startsWith('Rótulo'))
    .map(r => ({ ...r, desde: undefined, hasta: undefined, simbolo: realce ? agrandar(sinRotulo(r.simbolo)) : sinRotulo(r.simbolo) }))
    .filter(r => r.simbolo);
  // Los muros de embalse son 9 líneas cortas, invisibles a escala país: llevan además un marcador (un
  // PointSymbolizer sobre una línea se dibuja en su punto medio).
  const base = nombre === 'muro_embalse' ? GENERICO.linea + punto('#5d636b', 7, 'square') : GENERICO[geometria];
  const generico = realce ? agrandar(base) : base;
  return sld(FONDO_MINIATURA + capa(nombre, reglas?.length ? reglas : [{ titulo: nombre, simbolo: generico }]));
}

// Minimapa: provincias en gris claro y Chaco en gris oscuro, legible a 130 px.
export const ESTILO_MINIMAPA = sld(capa('provincias', [
  // Chaco en gris oscuro: el naranja queda para el recuadro de la vista, que si no se perdía encima.
  { titulo: 'Chaco', filtro: igual('provincia', 'Chaco'), simbolo: relleno('#7d857c') + linea('#f6f7f4', 0.8) },
  { titulo: 'Otras provincias', filtro: RESTO, simbolo: relleno('#cfd4cd') + linea('#f6f7f4', 0.8) },
]));
