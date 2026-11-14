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

// --- Modo simple: qué es cada cosa, con palabras de todos los días ---

// Los tipos del IGN más frecuentes, traducidos. Lo que no está acá y es largo o técnico no se muestra.
const TIPOS_SIMPLES: Record<string, string> = {
  'Corriente de Agua Perenne': 'Río o arroyo con agua todo el año',
  'Corriente de Agua Intermitente': 'Arroyo que a veces se seca',
  'Acequia o Zanja': 'Zanja con agua', Canal: 'Canal de agua', Zanjón: 'Zanjón',
  'Lago o Laguna Perenne': 'Laguna', 'Lago o Laguna Intermitente': 'Laguna que a veces se seca',
  'Bañado Perenne': 'Bañado', 'Bañado Intermitente': 'Bañado que a veces se seca', Estero: 'Estero',
  'Capital de Nación': 'Capital del país', 'Capital de Provincia': 'Capital de la provincia',
  'Cabecera de Partido o Departamento': 'Ciudad importante de la zona', Ciudad: 'Ciudad', Localidad: 'Pueblo', Pueblo: 'Pueblo',
  Villa: 'Villa', Colonia: 'Colonia', Barrio: 'Barrio', 'Lugar o Paraje': 'Paraje', Caserío: 'Caserío',
  'Camino Pavimentado': 'Ruta de asfalto',
  'Camino Consolidado, Camino sin Pavimentar de Transitavilidad Permanente': 'Camino de ripio',
  'Camino de Tierra, Camino sin Pavimentar de Transitavilidad Temporaria': 'Camino de tierra',
  'Autopista con Camino Pavimentado Dual con Separador': 'Autopista',
  'Limite Provincial': 'Borde entre provincias', 'Limite Internacional': 'Borde con otro país', Costa: 'Costa',
  'Puentes Para toda Clase de Vehículos': 'Puente para autos y camiones', Colgante: 'Puente colgante', Viaducto: 'Viaducto', Túnel: 'Túnel',
};

export function tipoSimple(valor: string): string | undefined {
  if (TIPOS_SIMPLES[valor]) return TIPOS_SIMPLES[valor];
  return valor.length <= 28 && !valor.includes(',') ? valor : undefined;
}

const ROTULOS_SIMPLES: Record<string, string> = {
  tipo: 'Qué es', canthab: 'Gente que vive', distancia: 'Distancia', departamen: 'Departamento', provincia: 'Provincia',
  tipo_obra: 'Arreglo', prioridad: 'Urgencia', descripcion: 'Qué pasa',
};
export const rotuloSimple = (campo: string) => ROTULOS_SIMPLES[campo] ?? rotulo(campo);

// Solo lo que entiende cualquiera: qué es, cuánta gente vive, dónde queda y, en las obras, qué arreglo
// es. Precisión, escala, fuente y los códigos quedan para el modo profesional.
const CLAVE_SIMPLE = ['tipo', 'canthab', 'distancia', 'departamen', 'provincia', 'tipo_obra', 'prioridad', 'descripcion'];
export function datosSimples(atributos: [string, string][]): [string, string][] {
  const nombre = nombreDe(atributos);
  const mostrado = nombreSimple(atributos);
  return atributos
    .filter(([k, v]) => CLAVE_SIMPLE.includes(k) && v !== '0' && v !== nombre)
    .map(([k, v]): [string, string] | null => (k === 'tipo' ? (tipoSimple(v) ? [k, tipoSimple(v)!] : null) : [k, v]))
    .filter((x): x is [string, string] => x !== null && x[1] !== mostrado)
    .sort(([a], [b]) => CLAVE_SIMPLE.indexOf(a) - CLAVE_SIMPLE.indexOf(b));
}

// El nombre en el modo simple: si la cosa no tiene nombre propio y se la nombra por su tipo, el tipo traducido.
export function nombreSimple(atributos: [string, string][] | Record<string, unknown>): string | undefined {
  const nombre = nombreDe(atributos);
  // Sin nombre propio: se lo nombra por lo que es ("Escuela Provincial"), y si tampoco hay tipo, "Lugar sin nombre".
  if (nombre && /^sin nombre$/i.test(nombre)) {
    const lista = Array.isArray(atributos) ? atributos : Object.entries(atributos).map(([k, v]) => [k, String(v ?? '')] as [string, string]);
    const tipo = lista.find(([k]) => k === 'tipo')?.[1];
    return (tipo && tipoSimple(tipo)) || 'Lugar sin nombre';
  }
  return nombre && (TIPOS_SIMPLES[nombre] ?? nombre);
}

// El nombre en el modo profesional: el del IGN, salvo "Sin Nombre", que se reemplaza por el tipo
// ("Escuela Provincial sin nombre"); si no, catorce filas iguales no dicen nada.
export function nombrePro(atributos: [string, string][] | Record<string, unknown>): string | undefined {
  const nombre = nombreDe(atributos);
  if (nombre && /^sin nombre$/i.test(nombre)) {
    const lista = Array.isArray(atributos) ? atributos : Object.entries(atributos).map(([k, v]) => [k, String(v ?? '')] as [string, string]);
    const tipo = lista.find(([k]) => k === 'tipo')?.[1];
    return tipo ? `${tipo} sin nombre` : 'Sin nombre';
  }
  return nombre;
}
