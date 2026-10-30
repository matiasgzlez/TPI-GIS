// Cómo se nombra y se describe una entidad del IGN en lenguaje humano. Lo usan el cartel al pasar
// el mouse, la ficha de la consulta y la lista de resultados.

// El campo que mejor nombra a la entidad.
const CAMPOS_NOMBRE = ['nombre', 'fna', 'gna', 'nam', 'provincia', 'tipo', 'tipo_obra'];

export function nombreDe(atributos: [string, string][] | Record<string, unknown>): string | undefined {
  const lista = Array.isArray(atributos) ? atributos : Object.entries(atributos).map(([k, v]) => [k, v == null ? '' : String(v)] as [string, string]);
  return CAMPOS_NOMBRE.map(c => lista.find(([k]) => k === c)?.[1]).find(v => v && v.trim() !== '');
}

// Los nombres de campo del IGN, legibles.
const ROTULOS: Record<string, string> = {
  canthab: 'Habitantes', distancia: 'Distancia', departamen: 'Departamento', provincia: 'Provincia', tipo: 'Tipo', precision: 'Precisión',
  escala: 'Escala', fuente: 'Fuente', nro_ruta: 'N.º de ruta', administra: 'Administración', situacin: 'Situación',
  tipo_obra: 'Tipo de obra', prioridad: 'Prioridad', descripcion: 'Descripción', regimen: 'Régimen', navegable: 'Navegable',
  revestimie: 'Revestimiento', carriles: 'Carriles', trfico: 'Tránsito', estado: 'Estado', prov: 'Código',
};
export const rotulo = (campo: string) => ROTULOS[campo] ?? campo.charAt(0).toUpperCase() + campo.slice(1).replaceAll('_', ' ');

// Los datos que más dicen, en el orden en que se leen. Lo demás queda en "ver más".
const CLAVE = ['distancia', 'tipo', 'canthab', 'departamen', 'provincia', 'nro_ruta', 'administra', 'revestimie', 'regimen', 'tipo_obra', 'prioridad', 'descripcion'];

export function datosClave(atributos: [string, string][], maximo = 3): [string, string][] {
  const nombre = nombreDe(atributos);
  return atributos
    .filter(([k, v]) => CLAVE.includes(k) && v !== nombre && v !== '0')
    .sort(([a], [b]) => CLAVE.indexOf(a) - CLAVE.indexOf(b))
    .slice(0, maximo);
}
