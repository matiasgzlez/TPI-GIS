// Las provincias del IGN, con lo que el visor necesita sin pedir sus 1,8 MB de geometría:
// - `nombre`: como está en la base (sin tildes), para los filtros CQL;
// - `titulo`: como se escribe;
// - `rotulo`: un punto interior para el nombre en el mapa (ST_PointOnSurface en PostGIS);
// - `rutas`: rutas nacionales con número que la cruzan (red_vial, administra = 'Nacional').
//
// Generado el 13/11/2026 con:
//   select provincia, st_x(st_pointonsurface(geom)), st_y(st_pointonsurface(geom)) from ign.provincias;
//   select p.provincia, string_agg(distinct v.nro_ruta, ',') from ign.red_vial v join ign.provincias p
//     on st_intersects(v.geom, p.geom) where v.administra = 'Nacional' and v.nro_ruta ~ '^[0-9]+$' group by 1;
// Los nombres de rótulo se pintan en el cliente: en teselas WMS cada tesela repetía el nombre.

export interface Provincia {
  nombre: string;
  titulo: string;
  rotulo: [lon: number, lat: number];
  // Superficie en km², para dar más peso al rótulo de las grandes.
  km2: number;
  rutas: string[];
}

const r = (texto: string) => texto.split(',');

export const PROVINCIAS: Provincia[] = [
  { nombre: 'Buenos Aires', titulo: 'Buenos Aires', rotulo: [-60.136, -37.146], km2: 305_774, rutas: r('3,5,7,8,9,12,22,33,35,178,188,191,193,195,202,205,215,226,228,229,249') },
  { nombre: 'Santa Cruz', titulo: 'Santa Cruz', rotulo: [-70.401, -49.194], km2: 244_358, rutas: r('3,26,40,281,288,293') },
  { nombre: 'Chubut', titulo: 'Chubut', rotulo: [-68.469, -44.001], km2: 224_354, rutas: r('3,25,26,40,258,259,270') },
  { nombre: 'Rio Negro', titulo: 'Río Negro', rotulo: [-66.439, -39.792], km2: 202_313, rutas: r('3,22,23,40,151,154,237,250,251,258') },
  { nombre: 'Cordoba', titulo: 'Córdoba', rotulo: [-63.632, -32.25], km2: 164_665, rutas: r('7,8,9,19,20,35,36,38,60,148,158') },
  { nombre: 'Salta', titulo: 'Salta', rotulo: [-63.251, -24.196], km2: 155_516, rutas: r('9,16,34,40,50,51,68,81,86') },
  { nombre: 'Mendoza', titulo: 'Mendoza', rotulo: [-68.468, -34.77], km2: 148_713, rutas: r('7,20,40,142,143,144,146,188') },
  { nombre: 'La Pampa', titulo: 'La Pampa', rotulo: [-65.816, -37.154], km2: 142_948, rutas: r('5,22,35,141,143,151,152,154,188') },
  { nombre: 'Santiago del Estero', titulo: 'Santiago del Estero', rotulo: [-63.438, -28.062], km2: 136_913, rutas: r('9,16,34,37,64,89,157') },
  { nombre: 'Santa Fe', titulo: 'Santa Fe', rotulo: [-60.996, -31.188], km2: 133_098, rutas: r('7,8,9,11,19,33,34,95,98,173,174,175,178') },
  { nombre: 'Catamarca', titulo: 'Catamarca', rotulo: [-67.499, -27.634], km2: 101_946, rutas: r('38,40,60,64,79,157') },
  { nombre: 'Chaco', titulo: 'Chaco', rotulo: [-60.691, -26.047], km2: 99_774, rutas: r('11,16,89,95') },
  { nombre: 'Neuquen', titulo: 'Neuquén', rotulo: [-69.54, -38.597], km2: 94_706, rutas: r('22,40,151,231,234,237') },
  { nombre: 'La Rioja', titulo: 'La Rioja', rotulo: [-66.809, -29.857], km2: 91_185, rutas: r('38,40,60,74,79,141,150') },
  { nombre: 'San Juan', titulo: 'San Juan', rotulo: [-68.818, -30.501], km2: 89_164, rutas: r('20,40,141,150') },
  { nombre: 'Corrientes', titulo: 'Corrientes', rotulo: [-57.804, -28.997], km2: 89_132, rutas: r('12,14,16,117,118,119,120,121,123,127') },
  { nombre: 'Entre Rios', titulo: 'Entre Ríos', rotulo: [-59.425, -32.101], km2: 78_463, rutas: r('12,14,18,127,130,131,135,136,174') },
  { nombre: 'San Luis', titulo: 'San Luis', rotulo: [-65.934, -33.932], km2: 75_845, rutas: r('7,8,20,79,146,147,148,188') },
  { nombre: 'Formosa', titulo: 'Formosa', rotulo: [-60.096, -24.659], km2: 75_760, rutas: r('11,81,86,95') },
  { nombre: 'Jujuy', titulo: 'Jujuy', rotulo: [-66.041, -23.195], km2: 53_238, rutas: r('9,34,40,51,52,66') },
  { nombre: 'Misiones', titulo: 'Misiones', rotulo: [-54.391, -26.824], km2: 29_733, rutas: r('12,14,101,103,105') },
  { nombre: 'Tucuman', titulo: 'Tucumán', rotulo: [-65.368, -27.036], km2: 22_540, rutas: r('9,34,38,40,157') },
  { nombre: 'Tierra del Fuego', titulo: 'Tierra del Fuego', rotulo: [-68.089, -53.849], km2: 20_202, rutas: r('3') },
  { nombre: 'Islas Malvinas', titulo: 'Islas Malvinas', rotulo: [-58.635, -51.8], km2: 10_735, rutas: [] },
  { nombre: 'Ciudad de Buenos Aires', titulo: 'CABA', rotulo: [-58.44, -34.62], km2: 204, rutas: r('3,205') },
];

export const tituloProvincia = (nombre: string) => PROVINCIAS.find(p => p.nombre === nombre)?.titulo ?? nombre;

// Capitales (localidades con tipo "Capital de Provincia" o "Capital de Nación"). El rótulo lo pinta el
// visor: en teselas WMS, cuando cruzaba el borde de una tesela GeoServer lo descartaba (partials=false)
// y Resistencia se quedaba sin nombre justo donde aterriza el buscador (1:136.000). La estrella sigue
// saliendo del WMS.
// Generado el 13/11/2026 con:
//   select nombre, provincia, st_x(geom), st_y(geom) from ign.localidades
//   where tipo in ('Capital de Provincia', 'Capital de Nación');
export interface Capital {
  nombre: string;
  provincia: string;
  punto: [lon: number, lat: number];
  // Capitales que en el IGN figuran como "Ciudad" o "Cabecera": el WMS no les pone estrella y la dibuja el visor.
  estrella?: boolean;
}

export const CAPITALES: Capital[] = [
  { nombre: 'Resistencia', provincia: 'Chaco', punto: [-58.9957, -27.4555] },
  { nombre: 'La Plata', provincia: 'Buenos Aires', punto: [-57.9453, -34.9201] },
  { nombre: 'Ciudad de Buenos Aires', provincia: 'Ciudad de Buenos Aires', punto: [-58.4258, -34.6217] },
  { nombre: 'San Fernando del Valle de Catamarca', provincia: 'Catamarca', punto: [-65.7408, -28.4518] },
  { nombre: 'Córdoba', provincia: 'Cordoba', punto: [-64.2075, -31.3988] },
  { nombre: 'Corrientes', provincia: 'Corrientes', punto: [-58.8271, -27.4701] },
  { nombre: 'Paraná', provincia: 'Entre Rios', punto: [-60.5207, -31.7392] },
  { nombre: 'Formosa', provincia: 'Formosa', punto: [-58.1726, -26.1759] },
  { nombre: 'San Salvador de Jujuy', provincia: 'Jujuy', punto: [-65.2944, -24.1962] },
  { nombre: 'Santa Rosa', provincia: 'La Pampa', punto: [-64.2906, -36.6361] },
  { nombre: 'La Rioja', provincia: 'La Rioja', punto: [-66.8474, -29.4132] },
  { nombre: 'Mendoza', provincia: 'Mendoza', punto: [-68.8448, -32.8753] },
  { nombre: 'Posadas', provincia: 'Misiones', punto: [-55.8989, -27.3797] },
  { nombre: 'Neuquén', provincia: 'Neuquen', punto: [-68.0751, -38.9543] },
  { nombre: 'Viedma', provincia: 'Rio Negro', punto: [-62.9934, -40.813] },
  { nombre: 'Salta', provincia: 'Salta', punto: [-65.4225, -24.8284] },
  { nombre: 'San Juan', provincia: 'San Juan', punto: [-68.5112, -31.5189] },
  { nombre: 'San Luis', provincia: 'San Luis', punto: [-66.3331, -33.3039] },
  { nombre: 'Santa Fe', provincia: 'Santa Fe', punto: [-60.7092, -31.6377] },
  { nombre: 'Santiago del Estero', provincia: 'Santiago del Estero', punto: [-64.2676, -27.7917] },
  { nombre: 'Ushuaia', provincia: 'Tierra del Fuego', punto: [-68.3291, -54.8158] },
  // En el IGN no tienen tipo "Capital de Provincia" (consulta del 13/11/2026).
  { nombre: 'San Miguel de Tucumán', provincia: 'Tucuman', punto: [-65.2025, -26.824], estrella: true },
  { nombre: 'Rawson', provincia: 'Chubut', punto: [-65.0937, -43.2988], estrella: true },
  { nombre: 'Río Gallegos', provincia: 'Santa Cruz', punto: [-69.2219, -51.6197], estrella: true },
];
