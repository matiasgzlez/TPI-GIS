import Feature from 'ol/Feature';
import WFS from 'ol/format/WFS';
import type Point from 'ol/geom/Point';
import { NAMESPACE, URL_WFST, WORKSPACE } from './config';

export interface DatosObra {
  tipo_obra: string;
  prioridad: string;
  descripcion: string;
}

// WFS-T Insert sobre obras_rn11. Devuelve el id que asignó GeoServer.
export async function guardarObra(punto: Point, datos: DatosObra): Promise<string> {
  const obra = new Feature({ geom: punto.clone(), ...datos, descripcion: datos.descripcion || null });
  obra.setGeometryName('geom');

  const formato = new WFS();
  const xml = formato.writeTransaction([obra], [], [], {
    featureNS: NAMESPACE, featurePrefix: WORKSPACE, featureType: 'obras_rn11', srsName: 'EPSG:3857', nativeElements: [],
  });
  const respuesta = await fetch(URL_WFST, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: new XMLSerializer().serializeToString(xml),
  });
  const texto = await respuesta.text();
  const resultado = respuesta.ok && !texto.includes('Exception') ? formato.readTransactionResponse(texto) : undefined;
  if (resultado?.transactionSummary.totalInserted !== 1) throw new Error(texto);
  return resultado.insertIds[0];
}
