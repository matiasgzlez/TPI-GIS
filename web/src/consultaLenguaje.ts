import GeoJSON from 'ol/format/GeoJSON';
import { toLonLat } from 'ol/proj';
import { getCenter } from 'ol/extent';
import { URL_WFS, WORKSPACE } from './config';
import { gmlLineas, gmlPoligonos, pedir, provincia, trazaRn11 } from './analisisRn11';
import { distanciaALineas, type Linea, type LonLat, type Poligono } from './geodesia';
import { armarResultado, mostrar, type Consulta } from './herramientas';
import { describir, geometriaDeCapa, type Interpretacion, type Lugar } from './lenguaje';
import type { Visor } from './visor';

const MAXIMO = 1000;

// El lugar como geometría: la traza o una localidad (líneas, para medir distancias) o una provincia.
async function geometriaDe(lugar: Lugar): Promise<{ lineas?: Linea[]; poligonos?: Poligono[]; punto?: LonLat; recorte?: Poligono[]; nombre: string }> {
  // La RN11 se analiza en Chaco, como en la parte B: los resultados se recortan a la provincia.
  if (lugar.tipo === 'rn11') {
    const { lineas, chaco } = await trazaRn11();
    return { lineas, recorte: chaco, nombre: 'la RN11' };
  }
  if (lugar.tipo === 'provincia') return { poligonos: await provincia(lugar.nombre), nombre: lugar.nombre };
  const filtro = encodeURIComponent(`nombre ILIKE '${lugar.nombre.replaceAll("'", "''")}'`);
  let datos = await pedir(`${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:localidades&outputFormat=application/json&srsName=CRS:84&count=1&sortBy=canthab+D&propertyName=geom,nombre&CQL_FILTER=${filtro}`);
  if (!datos.features.length) {
    const parecido = encodeURIComponent(`nombre ILIKE '%${lugar.nombre.replaceAll("'", "''")}%'`);
    datos = await pedir(`${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:localidades&outputFormat=application/json&srsName=CRS:84&count=1&sortBy=canthab+D&propertyName=geom,nombre&CQL_FILTER=${parecido}`);
  }
  const encontrada = datos.features[0];
  if (!encontrada) throw new Error(`No encontré la localidad "${lugar.nombre}".`);
  const p = encontrada.geometry.coordinates as LonLat;
  return { lineas: [[p, p]], punto: p, nombre: String(encontrada.properties.nombre) };
}

export async function ejecutar(visor: Visor, i: Interpretacion): Promise<Consulta> {
  const lugar = await geometriaDe(i.lugar);
  const margen = i.relacion.hasta * 0.03 + 200;
  // Una localidad va como punto GML: una línea de largo cero GeoServer la descarta.
  const referencia = lugar.punto
    ? `<gml:Point srsName="urn:ogc:def:crs:EPSG::4326"><gml:pos>${lugar.punto[1]} ${lugar.punto[0]}</gml:pos></gml:Point>`
    : lugar.lineas ? gmlLineas(lugar.lineas) : '';
  const condiciones = [
    lugar.poligonos
      ? `<fes:Intersects><fes:ValueReference>geom</fes:ValueReference>${gmlPoligonos(lugar.poligonos)}</fes:Intersects>`
      : `<fes:DWithin><fes:ValueReference>geom</fes:ValueReference>${referencia}<fes:Distance uom="m">${i.relacion.hasta + margen}</fes:Distance></fes:DWithin>`,
    lugar.recorte ? `<fes:Intersects><fes:ValueReference>geom</fes:ValueReference>${gmlPoligonos(lugar.recorte)}</fes:Intersects>` : '',
  ].filter(Boolean);
  const filtro = condiciones.length > 1 ? `<fes:And>${condiciones.join('')}</fes:And>` : condiciones[0];
  const cuerpo = `<wfs:GetFeature service="WFS" version="2.0.0" outputFormat="application/json" count="${MAXIMO}"
    xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2">
    <wfs:Query typeNames="${WORKSPACE}:${i.capa}" srsName="EPSG:3857"><fes:Filter>${filtro}</fes:Filter></wfs:Query></wfs:GetFeature>`;
  const datos = await pedir(URL_WFS, cuerpo) as unknown as { features: { id: string; properties: Record<string, unknown> }[] };

  // Distancia exacta (geodésica) al lugar, para los puntos; las líneas y polígonos quedan con el
  // filtro de GeoServer, que alcanza a esa escala.
  let features = datos.features;
  if (lugar.lineas && geometriaDeCapa(i.capa) === 'punto') {
    const ol = new GeoJSON().readFeatures(datos, { dataProjection: 'EPSG:3857' });
    features = features
      .map((f, n) => {
        const d = distanciaALineas(toLonLat(getCenter(ol[n].getGeometry()!.getExtent())) as LonLat, lugar.lineas!);
        return { ...f, properties: { distancia: `${(d / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km`, ...f.properties }, d };
      })
      .filter(f => f.d >= i.relacion.desde && f.d <= i.relacion.hasta)
      .sort((a, b) => a.d - b.d)
      .map(({ d: _d, ...f }) => f);
  }
  const resultado = armarResultado(i.capa, features.length, { type: 'FeatureCollection', features } as never);
  return { origen: 'lenguaje', titulo: describir(i), capas: mostrar(visor, resultado.total ? [resultado] : []) };
}
