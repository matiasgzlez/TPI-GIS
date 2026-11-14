// Genera las miniaturas de las 48 capas (web/public/miniaturas/<capa>.png) desde GeoServer, con las
// mismas reglas de estilo que el visor (sldMiniatura). Se guardan como archivos estáticos: cargan al
// instante, la demo anda sin GeoServer para mostrarlas y no suman 48 pedidos al abrir el panel.
//
// Uso, con GeoServer levantado (docker compose up -d), desde web/:
//   node scripts/miniaturas.ts
// Volver a correrlo si cambian los estilos de estilos.ts o los datos.

import { mkdir, writeFile } from 'node:fs/promises';
import { CAPAS } from '../src/config.ts';
import { sldMiniatura } from '../src/estilos.ts';

const GEOSERVER = process.env.GEOSERVER ?? 'http://localhost:8080/geoserver/tpi/wms';
const SALIDA = new URL('../public/miniaturas/', import.meta.url);
const ANCHO = 320;
const ALTO = 200;

// Capas con menos de 5 entidades dentro de Chaco (consulta del 13/11/2026): se encuadran sobre su
// propia extensión; el resto, sobre Chaco.
const DISPERSAS = new Set([
  'actividades_agropecuarias', 'complejo_de_energia_ene', 'edif_depor_y_esparcimiento', 'edificio_de_salud_ips',
  'edificio_publico_ips', 'estructuras_portuarias', 'lineas_de_conduccion_ene', 'muro_embalse', 'obra_de_comunicacion',
  'obra_portuaria', 'pais_lim', 'puntos_de_alturas_topograficas', 'senalizaciones', 'sue_congelado', 'sue_consolidado',
  'sue_costero', 'sue_hidromorfologico', 'sue_no_consolidado', 'veg_suelo_desnudo',
]);
const CHACO: Extension = [-63.5, -28.1, -58.3, -24.0];
// Capas de elementos chicos o densos que a escala provincia no se distinguen: se encuadran sobre el
// Gran Resistencia y Corrientes, donde se ven las islas del Paraná, los ejidos y los espejos de agua.
const RESISTENCIA: Extension = [-59.25, -27.72, -58.55, -27.22];
const CERCA = new Set(['isla', 'ejido', 'espejo_de_agua_hid', 'otras_edificaciones']);
// Capas de puntos con pocas entidades a la vista: símbolos más grandes (sldMiniatura con realce).
const REALCE = new Set([...DISPERSAS, 'edif_construcciones_turisticas', 'infraestructura_hidro', 'estructuras_portuarias', 'obra_portuaria']);

type Extension = [number, number, number, number];

const R = 6378137;
const aMercator = ([lon, lat]: [number, number]) => [
  (lon * Math.PI * R) / 180,
  R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];

// Extensión en EPSG:3857 con la proporción de la miniatura (16:10) y un margen del 6 %.
function encuadre([oeste, sur, este, norte]: Extension) {
  const [x1, y1] = aMercator([oeste, sur]);
  const [x2, y2] = aMercator([este, norte]);
  const [cx, cy] = [(x1 + x2) / 2, (y1 + y2) / 2];
  let [ancho, alto] = [(x2 - x1) * 1.12, (y2 - y1) * 1.12];
  if (ancho / alto > ANCHO / ALTO) alto = (ancho * ALTO) / ANCHO;
  else ancho = (alto * ANCHO) / ALTO;
  return [cx - ancho / 2, cy - alto / 2, cx + ancho / 2, cy + alto / 2];
}

async function extensiones() {
  const xml = await (await fetch(`${GEOSERVER}?service=WMS&version=1.1.1&request=GetCapabilities`)).text();
  const mapa = new Map<string, Extension>();
  for (const bloque of xml.split('<Layer').slice(1)) {
    const nombre = bloque.match(/<Name>(?:tpi:)?([^<]+)<\/Name>/)?.[1];
    const caja = bloque.match(/<LatLonBoundingBox minx="([^"]+)" miny="([^"]+)" maxx="([^"]+)" maxy="([^"]+)"/);
    if (nombre && caja) mapa.set(nombre, [Number(caja[1]), Number(caja[2]), Number(caja[3]), Number(caja[4])]);
  }
  return mapa;
}

await mkdir(SALIDA, { recursive: true });
const cajas = await extensiones();
let bien = 0;
for (const capa of CAPAS) {
  const extension = CERCA.has(capa.nombre) ? RESISTENCIA : DISPERSAS.has(capa.nombre) ? cajas.get(capa.nombre) ?? CHACO : CHACO;
  const parametros = new URLSearchParams({
    service: 'WMS', version: '1.1.1', request: 'GetMap', srs: 'EPSG:3857', format: 'image/png',
    bbox: encuadre(extension).join(','), width: String(ANCHO), height: String(ALTO),
    bgcolor: '0xECEEEB', transparent: 'false', format_options: 'antialias:full',
    SLD_BODY: sldMiniatura(capa.nombre, capa.geometria, REALCE.has(capa.nombre) && capa.geometria === 'punto'),
  });
  const respuesta = await fetch(GEOSERVER, { method: 'POST', body: parametros });
  const tipo = respuesta.headers.get('content-type') ?? '';
  if (!respuesta.ok || !tipo.startsWith('image/')) {
    console.error(`✗ ${capa.nombre}: ${respuesta.status} ${(await respuesta.text()).slice(0, 200)}`);
    continue;
  }
  await writeFile(new URL(`${capa.nombre}.png`, SALIDA), Buffer.from(await respuesta.arrayBuffer()));
  bien++;
}
console.log(`${bien} de ${CAPAS.length} miniaturas en public/miniaturas/`);
