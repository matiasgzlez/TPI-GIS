import { NAMESPACE, URL_WFS, URL_WFST, WORKSPACE } from './config';

// Lo que aprende el buscador, compartido por el equipo en edicion.aprendizaje (WFS para leer,
// WFS-T por el proxy /wfst para escribir). Si GeoServer no responde, el visor sigue andando sin
// lo aprendido.

export type TipoAprendizaje = 'frase' | 'sinonimo' | 'consulta';

export interface Aprendido {
  gid: string;
  tipo: TipoAprendizaje;
  clave: string;
  valor: string;
  usos: number;
}

let memoria: Aprendido[] = [];
let carga: Promise<Aprendido[]> | undefined;

export function cargarAprendizaje(): Promise<Aprendido[]> {
  carga ??= fetch(`${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${WORKSPACE}:aprendizaje`
    + '&outputFormat=application/json&propertyName=tipo,clave,valor,usos&count=2000')
    .then(r => r.json())
    .then(datos => {
      memoria = datos.features.map((f: { id: string; properties: Omit<Aprendido, 'gid'> }) => ({ gid: f.id, ...f.properties }));
      return memoria;
    })
    .catch(() => memoria);
  return carga;
}

export const aprendidos = (tipo: TipoAprendizaje) => memoria.filter(a => a.tipo === tipo);

const escapar = (texto: string) => texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

async function transaccion(cuerpo: string) {
  const respuesta = await fetch(URL_WFST, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: `<wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:${WORKSPACE}="${NAMESPACE}">${cuerpo}</wfs:Transaction>`,
  });
  return respuesta.text();
}

// Suma un uso si ya existe (tipo + clave) o lo crea. La lista en memoria se actualiza al instante.
export async function aprender(tipo: TipoAprendizaje, clave: string, valor: string) {
  const ahora = new Date().toISOString();
  const existente = memoria.find(a => a.tipo === tipo && a.clave === clave);
  try {
    if (existente) {
      existente.usos += 1;
      existente.valor = valor;
      const id = existente.gid;
      await transaccion(`<wfs:Update typeName="${WORKSPACE}:aprendizaje">`
        + `<wfs:Property><wfs:Name>usos</wfs:Name><wfs:Value>${existente.usos}</wfs:Value></wfs:Property>`
        + `<wfs:Property><wfs:Name>valor</wfs:Name><wfs:Value>${escapar(valor)}</wfs:Value></wfs:Property>`
        + `<wfs:Property><wfs:Name>actualizado</wfs:Name><wfs:Value>${ahora}</wfs:Value></wfs:Property>`
        + `<ogc:Filter><ogc:FeatureId fid="${id}"/></ogc:Filter></wfs:Update>`);
      return;
    }
    const nuevo: Aprendido = { gid: '', tipo, clave, valor, usos: 1 };
    memoria.push(nuevo);
    const respuesta = await transaccion(`<wfs:Insert><${WORKSPACE}:aprendizaje>`
      + `<${WORKSPACE}:tipo>${tipo}</${WORKSPACE}:tipo><${WORKSPACE}:clave>${escapar(clave)}</${WORKSPACE}:clave>`
      + `<${WORKSPACE}:valor>${escapar(valor)}</${WORKSPACE}:valor><${WORKSPACE}:usos>1</${WORKSPACE}:usos>`
      + `<${WORKSPACE}:actualizado>${ahora}</${WORKSPACE}:actualizado></${WORKSPACE}:aprendizaje></wfs:Insert>`);
    nuevo.gid = respuesta.match(/fid="([^"]+)"/)?.[1] ?? '';
  } catch {
    // Sin GeoServer: lo aprendido vale solo para esta sesión.
  }
}
