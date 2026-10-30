import { useEffect, useState } from 'react';
import { unByKey } from 'ol/Observable';
import { tituloDeCapa, URL_WFS, WORKSPACE } from './config';
import type { Sugerencia } from './comandos';
import type { Visor } from './visor';

// Consultas predichas según lo que se ve: cuando el mapa se queda quieto, se cuenta (WFS
// resultType=hits, sin bajar entidades) cuántos elementos de algunas capas útiles hay en la vista.
const CANDIDATAS = ['puente_red_vial_puntos', 'localidades', 'edif_educacion', 'edificio_de_salud_ips', 'obras_rn11', 'curso_de_agua_hid'];
const ESPERA = 700;
const SUSTANTIVO: Record<string, [string, string]> = {
  puente_red_vial_puntos: ['puente', 'puentes'], localidades: ['localidad', 'localidades'], edif_educacion: ['escuela', 'escuelas'],
  edificio_de_salud_ips: ['establecimiento de salud', 'establecimientos de salud'], obras_rn11: ['obra de la RN11', 'obras de la RN11'],
  curso_de_agua_hid: ['curso de agua', 'cursos de agua'],
};

async function contar(capa: string, extension: number[], señal: AbortSignal) {
  const url = `${URL_WFS}?service=WFS&version=2.0.0&request=GetFeature&resultType=hits&typeNames=${WORKSPACE}:${capa}`
    + `&bbox=${extension.map(n => Math.round(n)).join(',')},EPSG:3857`;
  const texto = await (await fetch(url, { signal: señal })).text();
  return Number(texto.match(/numberMatched="(\d+)"/)?.[1] ?? 0);
}

export function usePrediccion(visor: Visor | null): Sugerencia[] {
  const [predichas, setPredichas] = useState<Sugerencia[]>([]);
  useEffect(() => {
    if (!visor) return;
    let espera: ReturnType<typeof setTimeout> | undefined;
    let control: AbortController | undefined;
    const calcular = () => {
      clearTimeout(espera);
      control?.abort();
      espera = setTimeout(async () => {
        control = new AbortController();
        const extension = visor.mapa.getView().calculateExtent(visor.mapa.getSize());
        try {
          const cuentas = await Promise.all(CANDIDATAS.map(async capa => [capa, await contar(capa, extension, control!.signal)] as const));
          setPredichas(cuentas
            .filter(([, n]) => n > 0 && n <= 5000)
            .slice(0, 3)
            .map(([capa, n]) => ({
              id: `vista:${capa}`,
              tipo: 'pregunta',
              titulo: `${n.toLocaleString('es-AR')} ${SUSTANTIVO[capa]?.[n === 1 ? 0 : 1] ?? tituloDeCapa(capa).toLowerCase()} en esta vista`,
              detalle: 'Listarlas y resaltarlas en el mapa',
            })));
        } catch {
          // Movimiento nuevo o GeoServer sin respuesta: quedan las anteriores.
        }
      }, ESPERA);
    };
    // Sin cálculo inicial: la entrada animada termina en un moveend, que ya lo dispara.
    const clave = visor.mapa.on('moveend', calcular);
    return () => {
      clearTimeout(espera);
      control?.abort();
      unByKey(clave);
    };
  }, [visor]);
  return predichas;
}
