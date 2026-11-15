// La capa de calor (OpenLayers Heatmap, con WebGL). Va en su propio módulo para que el WebGL se baje
// recién al prender el primer mapa de calor, no al abrir el visor.
//
// Es un grupo: la mancha y, en la de población, los nombres de los lugares (al pasar las localidades a
// calor salen del WMS y con ellas sus rótulos). De lejos solo las ciudades grandes; de cerca, todos.
import Heatmap from 'ol/layer/Heatmap';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Text } from 'ol/style';
import type { FeatureLike } from 'ol/Feature';
import type RenderEvent from 'ol/render/Event';
import { esPoblacion, pesoDensidad } from './calor';
import { GRADIENTES } from './calorColores';

const esOscuro = () => document.documentElement.classList.contains('dark');
// En la hoja impresa todo es claro, aunque la pantalla esté en oscuro.
let forzarClaro = false;

// Población: de lejos, cada lugar pesa menos (a escala país, la mitad norte saturaba); desde escala
// provincia, el peso entero.
const PESO_POBLACION = ['*', ['get', 'peso'], ['clamp', ['/', 1500, ['resolution']], 0.3, 1]];
// Densidad: el peso de cada punto es la variable `densidad`, según cuántos hay a la vista.
const PESO_DENSIDAD = ['*', ['get', 'peso'], ['var', 'densidad']];

// Desde qué cantidad de habitantes se rotula, según la resolución (metros por píxel).
const umbral = (resolucion: number) => (resolucion > 1500 ? 250_000 : resolucion > 600 ? 40_000 : resolucion > 250 ? 8_000 : resolucion > 90 ? 1_500 : 0);

function estiloNombre(f: FeatureLike, resolucion: number) {
  const habitantes = Number(f.get('canthab')) || 0;
  if (habitantes < umbral(resolucion)) return undefined;
  const oscuro = esOscuro() && !forzarClaro;
  return new Style({
    text: new Text({
      text: f.get('nombre'),
      font: `${habitantes > 100_000 ? 700 : 600} ${habitantes > 100_000 ? 13 : 12}px "Instrument Sans Variable", sans-serif`,
      fill: new Fill({ color: oscuro ? '#f4f1ea' : '#15171a' }),
      stroke: new Stroke({ color: oscuro ? 'rgba(14,16,18,.85)' : 'rgba(255,255,255,.92)', width: 3.5 }),
    }),
    // En el declutter gana el de más habitantes.
    zIndex: habitantes,
  });
}

// El tamaño de la mancha es en metros (no cambia lo que abarca según la pantalla); `factor` (el de pantalla:
// la tele 2K agranda la interfaz) solo agranda sus topes en píxeles. `claro`: para la
// hoja impresa (rampa y nombres del tema claro).
export function crearCapaCalor(nombre: string, fuente: VectorSource, factor = 1, claro = false) {
  const oscuro = esOscuro() && !claro;
  const poblacion = esPoblacion(nombre);
  const mancha = new Heatmap({
    source: fuente,
    gradient: [...GRADIENTES[esPoblacion(nombre) ? 'poblacion' : 'densidad'][oscuro ? 'oscuro' : 'claro']],
    // La densidad, con manchas más chicas: con miles de puntos, una mancha grande lo tapaba todo.
    radius: ['clamp', ['/', 20000 * (poblacion ? 1 : 0.6), ['resolution']], 9 * factor, 48 * factor],
    blur: ['clamp', ['/', 28000 * (poblacion ? 1 : 0.6), ['resolution']], 14 * factor, 70 * factor],
    weight: (esPoblacion(nombre) ? PESO_POBLACION : PESO_DENSIDAD) as never,
    opacity: 0.88,
    variables: { densidad: 0.7 },
  });
  if (!esPoblacion(nombre)) {
    // Cuando el mapa queda quieto (o llegan puntos nuevos), se cuentan los que se ven y se ajusta el peso.
    // Así la intensidad no depende de cómo se llegó a la vista. Solo se vuelve a pintar si cambió.
    let actual = 0.7;
    mancha.on('prerender', (e: RenderEvent) => {
      const f = e.frameState;
      if (!f?.extent || f.viewHints[0] || f.viewHints[1]) return;
      const peso = pesoDensidad(fuente.getFeaturesInExtent(f.extent).length);
      if (Math.abs(peso - actual) / actual > 0.05) { actual = peso; mancha.updateStyleVariables({ densidad: peso }); }
    });
  }
  const capas = [mancha];
  if (esPoblacion(nombre)) {
    const estilo = claro ? (f: FeatureLike, r: number) => { forzarClaro = true; try { return estiloNombre(f, r); } finally { forzarClaro = false; } } : estiloNombre;
    capas.push(new VectorLayer({ source: fuente, style: estilo, declutter: true }) as never);
  }
  const grupo = new LayerGroup({ layers: capas, zIndex: 12 });
  grupo.set('calor', nombre);
  grupo.set('mancha', mancha);
  return grupo;
}

// Al cambiar de tema: la rampa del oscuro va hacia los claros (en oscuro, el extremo alto oscuro se perdía).
export function aplicarTemaCalor(grupo: LayerGroup) {
  const mancha = grupo.get('mancha') as Heatmap;
  const nombre = grupo.get('calor') as string;
  mancha.setGradient([...GRADIENTES[esPoblacion(nombre) ? 'poblacion' : 'densidad'][esOscuro() ? 'oscuro' : 'claro']]);
  grupo.getLayers().forEach(c => c.changed());
}
