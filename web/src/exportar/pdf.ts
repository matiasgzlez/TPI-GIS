// La hoja en PDF (A4, horizontal o vertical): título, mapa con grilla de coordenadas, norte, escala
// gráfica y numérica, leyenda de las capas prendidas, fuente y autores. Si hay una respuesta abierta
// (consulta, medición o el tablero de una ruta), sigue en páginas verticales con sus cifras, un
// gráfico y la tabla. Texto vectorial con Instrument Sans incrustada; todo se arma en el navegador.
import { jsPDF } from 'jspdf';
import { toLonLat } from 'ol/proj';
import regularUrl from '../fuentes/InstrumentSans-Regular.ttf?url';
import seminegritaUrl from '../fuentes/InstrumentSans-SemiBold.ttf?url';
import type { Consulta, Medicion } from '../herramientas';
import type { AnalisisRuta } from '../analisisRuta';
import { datosClave, datosSimples, nombrePro, nombreSimple, rotulo, rotuloSimple, tipoSimple } from '../entidades';
import type { MapaImpreso } from './mapaImpreso';
import { capaSimple } from '../interfaz';

export type Orientacion = 'horizontal' | 'vertical';

export type Contenido =
  | { tipo: 'consulta'; titulo: string; consulta: Consulta }
  | { tipo: 'medicion'; titulo: string; medicion: Medicion }
  | { tipo: 'tablero'; titulo: string; analisis: AnalisisRuta };

export interface Leyenda { titulo: string; imagen: string; ancho: number; alto: number }

export interface OpcionesPdf {
  titulo: string;
  descripcion?: string; // una línea opcional bajo el título
  norte?: boolean; // por defecto, sí
  escalaGrafica?: boolean; // por defecto, sí
  autores: string;
  orientacion: Orientacion;
  simple: boolean;
  grilla: boolean;
  mapa: MapaImpreso;
  leyendas: Leyenda[] | null; // null: sin leyenda
  contenido: Contenido | null;
  // Pueblo más cercano de las cosas que se llaman igual ("En Lapacho"), por id de entidad.
  ubicaciones?: Map<string, string>;
  fecha?: Date;
}

// --- Medidas de la hoja (mm) ---
const MARGEN = 12;
const LEYENDA_ANCHO = 64;
const GRILLA_IZQ = 12; // rótulos de latitud a la izquierda
const GRILLA_ARRIBA = 4.5;

// El marco del mapa en cada orientación (lo usa también el panel para pedir el mapa del tamaño justo).
export function marcoMapa(orientacion: Orientacion, grilla: boolean, conLeyenda: boolean) {
  const [W, H] = orientacion === 'horizontal' ? [297, 210] : [210, 297];
  const izq = MARGEN + (grilla ? GRILLA_IZQ : 0);
  const arriba = 33 + (grilla ? GRILLA_ARRIBA : 0);
  const der = W - MARGEN - (grilla ? 4 : 0) - (orientacion === 'horizontal' && conLeyenda ? LEYENDA_ANCHO + 6 : 0);
  const abajo = orientacion === 'horizontal' ? H - MARGEN - 12 - (grilla ? GRILLA_ARRIBA : 0) : arriba + (der - izq) * (conLeyenda ? 0.92 : 1.25);
  return { x: izq, y: arriba, ancho: der - izq, alto: abajo - arriba, W, H };
}

// --- Colores ---
const TINTA = '#15171a';
const TINTA_2 = '#3d4248';
const TINTA_3 = '#5e646b';
const LINEA = '#d6d9d5';
const VIAL = '#c2410c';
const VIAL_SUAVE = '#ec8455';

let fuentes: Promise<[string, string]> | null = null;
const base64 = async (url: string) => {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
};
const cargarFuentes = () => (fuentes ??= Promise.all([base64(regularUrl), base64(seminegritaUrl)]));

const formatoFecha = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
const miles = (n: number) => n.toLocaleString('es-AR');

// Grados y minutos para la grilla. La fuente no tiene ′ ni ″: van ' y ".
function gm(valor: number, pos: string, neg: string) {
  const total = Math.round(Math.abs(valor) * 60);
  const g = Math.floor(total / 60);
  const m = total % 60;
  return `${g}°${m ? `${String(m).padStart(2, '0')}'` : ''} ${valor < 0 ? neg : pos}`;
}

// Intervalo de grilla: el que da entre 3 y 7 líneas en el lado más corto del marco.
function intervalo(grados: number) {
  const pasos = [1 / 12, 1 / 6, 1 / 4, 1 / 2, 1, 2, 5, 10, 15, 30];
  return pasos.find(p => grados / p <= 6) ?? 30;
}

export async function generarPdf(o: OpcionesPdf): Promise<Blob> {
  const [regular, seminegrita] = await cargarFuentes();
  const doc = new jsPDF({ orientation: o.orientacion === 'horizontal' ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('InstrumentSans-Regular.ttf', regular);
  doc.addFileToVFS('InstrumentSans-SemiBold.ttf', seminegrita);
  doc.addFont('InstrumentSans-Regular.ttf', 'Instrument', 'normal');
  doc.addFont('InstrumentSans-SemiBold.ttf', 'Instrument', 'bold');
  doc.setProperties({ title: o.titulo, author: o.autores, subject: 'Mapa del Visor SIG RN11 Chaco', creator: 'Visor SIG RN11 Chaco' });
  const fecha = o.fecha ?? new Date();
  const letra = (peso: 'normal' | 'bold', pt: number, color = TINTA) => { doc.setFont('Instrument', peso); doc.setFontSize(pt); doc.setTextColor(color); };

  const marco = marcoMapa(o.orientacion, o.grilla, !!o.leyendas);
  const { W, H } = marco;

  // Encabezado.
  letra('bold', 18);
  doc.text(recortar(doc, o.titulo || 'Mapa', W - 2 * MARGEN - 60), MARGEN, 20);
  // Bajo el título, la descripción si hay; si no, la escala y la fecha (que entonces van a la derecha).
  const descripcion = o.descripcion?.trim();
  const escalaYFecha = `Escala 1:${miles(o.mapa.denominador)} · ${formatoFecha(fecha)}`;
  letra('normal', 9, descripcion ? TINTA_2 : TINTA_3);
  doc.text(recortar(doc, descripcion || escalaYFecha, W - 2 * MARGEN - 62), MARGEN, 26.5);
  letra('bold', 8.5, TINTA);
  doc.text('Visor SIG · RN11 Chaco', W - MARGEN, descripcion ? 17.5 : 19.5, { align: 'right' });
  letra('normal', 7.5, TINTA_3);
  doc.text('IGN SIG 250 · UTN FRRe 2026', W - MARGEN, descripcion ? 22 : 24, { align: 'right' });
  if (descripcion) doc.text(escalaYFecha, W - MARGEN, 26.5, { align: 'right' });
  doc.setDrawColor(TINTA); doc.setLineWidth(0.35);
  doc.line(MARGEN, 29.5, W - MARGEN, 29.5);

  // Mapa.
  doc.addImage(o.mapa.imagen, 'JPEG', marco.x, marco.y, marco.ancho, marco.alto, 'mapa', 'FAST');
  if (o.grilla) dibujarGrilla(doc, o.mapa, marco);
  doc.setDrawColor(TINTA); doc.setLineWidth(0.3);
  doc.rect(marco.x, marco.y, marco.ancho, marco.alto, 'S');
  if (o.norte !== false) dibujarNorte(doc, marco.x + marco.ancho - 9, marco.y + 10);
  if (o.escalaGrafica !== false) dibujarEscala(doc, o.mapa.denominador, marco.x + 4, marco.y + marco.alto - 4);

  // Leyenda.
  if (o.leyendas) {
    const caja = o.orientacion === 'horizontal'
      ? { x: W - MARGEN - LEYENDA_ANCHO, y: marco.y, ancho: LEYENDA_ANCHO, alto: marco.alto, columnas: 1 }
      : { x: MARGEN, y: marco.y + marco.alto + (o.grilla ? GRILLA_ARRIBA + 4 : 6), ancho: W - 2 * MARGEN, alto: H - MARGEN - 12 - (marco.y + marco.alto + (o.grilla ? GRILLA_ARRIBA + 4 : 6)), columnas: 3 };
    dibujarLeyenda(doc, o.leyendas, caja, o.simple ? 'Qué significa cada color' : 'Leyenda', letra);
  }

  // Pie: fuente y autores.
  doc.setDrawColor(LINEA); doc.setLineWidth(0.2);
  doc.line(MARGEN, H - MARGEN - 6.5, W - MARGEN, H - MARGEN - 6.5);
  letra('normal', 7, TINTA_2);
  const fuente = o.simple
    ? 'Fuente: Instituto Geográfico Nacional (IGN), SIG 250, 2010.'
    : 'Fuente: IGN, SIG 250 (2010), por WMS/WFS de GeoServer. WGS 84 / Pseudo-Mercator (EPSG:3857); escala corregida por latitud.';
  doc.text(recortar(doc, fuente, W - 2 * MARGEN), MARGEN, H - MARGEN - 2.5);
  // Más corto que el ancho: a la derecha va el número de página cuando hay más de una.
  doc.text(recortar(doc, `${o.simple ? 'Hecho por' : 'Autores'}: ${o.autores || '—'} · Visor SIG RN11 Chaco, ${formatoFecha(fecha)}`, W - 2 * MARGEN - 16), MARGEN, H - MARGEN + 1.5);

  if (o.contenido) paginasDeContenido(doc, o, fecha, letra);
  numerarPaginas(doc, letra);
  return doc.output('blob');
}

type Letra = (peso: 'normal' | 'bold', pt: number, color?: string) => void;

function recortar(doc: jsPDF, texto: string, ancho: number) {
  if (doc.getTextWidth(texto) <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > ancho) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// Grilla de meridianos y paralelos: en EPSG:3857 son rectas verticales y horizontales. Rótulos afuera
// del marco: longitud arriba y abajo, latitud a la izquierda y a la derecha.
function dibujarGrilla(doc: jsPDF, mapa: MapaImpreso, marco: { x: number; y: number; ancho: number; alto: number }) {
  const [minx, miny, maxx, maxy] = mapa.extension;
  const [oeste, sur] = toLonLat([minx, miny]);
  const [este, norte] = toLonLat([maxx, maxy]);
  const paso = intervalo(Math.min(este - oeste, norte - sur));
  const aX = (x: number) => marco.x + ((x - minx) / (maxx - minx)) * marco.ancho;
  const aY = (y: number) => marco.y + ((maxy - y) / (maxy - miny)) * marco.alto;
  const merc = (lon: number, lat: number) => [lon * 20037508.34 / 180, Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 6378137];
  doc.saveGraphicsState();
  // GState es un constructor en tiempo de ejecución (los tipos de jsPDF lo declaran como método).
  doc.setGState(new (doc.GState as unknown as new (p: { opacity: number }) => unknown)({ opacity: 0.45 }));
  doc.setDrawColor(TINTA); doc.setLineWidth(0.12);
  doc.setLineDashPattern([0.8, 0.8], 0);
  const lons: number[] = []; const lats: number[] = [];
  for (let lon = Math.ceil(oeste / paso) * paso; lon <= este; lon += paso) lons.push(lon);
  for (let lat = Math.ceil(sur / paso) * paso; lat <= norte; lat += paso) lats.push(lat);
  for (const lon of lons) { const x = aX(merc(lon, 0)[0]); doc.line(x, marco.y, x, marco.y + marco.alto); }
  for (const lat of lats) { const y = aY(merc(0, lat)[1]); doc.line(marco.x, y, marco.x + marco.ancho, y); }
  doc.restoreGraphicsState();
  doc.setLineDashPattern([], 0);
  doc.setFont('Instrument', 'normal'); doc.setFontSize(6.5); doc.setTextColor(TINTA_2);
  doc.setDrawColor(TINTA); doc.setLineWidth(0.2);
  for (const lon of lons) {
    const x = aX(merc(lon, 0)[0]);
    const t = gm(lon, 'E', 'O');
    doc.line(x, marco.y - 1.2, x, marco.y); doc.line(x, marco.y + marco.alto, x, marco.y + marco.alto + 1.2);
    doc.text(t, x, marco.y - 1.8, { align: 'center' });
    doc.text(t, x, marco.y + marco.alto + 3.6, { align: 'center' });
  }
  for (const lat of lats) {
    const y = aY(merc(0, lat)[1]);
    const t = gm(lat, 'N', 'S');
    doc.line(marco.x - 1.2, y, marco.x, y); doc.line(marco.x + marco.ancho, y, marco.x + marco.ancho + 1.2, y);
    doc.text(t, marco.x - 1.8, y + 0.9, { align: 'right' });
    doc.text(t, marco.x + marco.ancho + 1.8, y + 0.9, { angle: -90 });
  }
}

// Flecha de norte: en EPSG:3857 el norte está arriba en todo el mapa.
function dibujarNorte(doc: jsPDF, x: number, y: number) {
  doc.setFillColor('#ffffff'); doc.setDrawColor(LINEA); doc.setLineWidth(0.2);
  doc.circle(x, y, 5.6, 'FD');
  doc.setFillColor(TINTA); doc.setDrawColor(TINTA); doc.setLineWidth(0.25);
  doc.triangle(x, y - 3.2, x - 2, y + 2.6, x, y + 1.3, 'F');
  doc.setFillColor('#ffffff');
  doc.triangle(x, y - 3.2, x + 2, y + 2.6, x, y + 1.3, 'FD');
  doc.setFont('Instrument', 'bold'); doc.setFontSize(7); doc.setTextColor(TINTA);
  doc.text('N', x, y - 6.6, { align: 'center' });
}

// Escala gráfica (cuatro tramos alternados) y numérica, sobre una placa blanca en la esquina.
function dibujarEscala(doc: jsPDF, denominador: number, x: number, yBase: number) {
  const kmPorMm = denominador / 1e6;
  const objetivo = 32 * kmPorMm;
  const potencia = 10 ** Math.floor(Math.log10(objetivo));
  const km = [1, 2, 5, 10].map(p => p * potencia).filter(v => v <= objetivo).pop() ?? potencia;
  const largo = km / kmPorMm;
  const placa = { x, y: yBase - 11, ancho: largo + 14, alto: 11 };
  doc.setFillColor('#ffffff'); doc.setDrawColor(LINEA); doc.setLineWidth(0.2);
  doc.roundedRect(placa.x, placa.y, placa.ancho, placa.alto, 1.2, 1.2, 'FD');
  const x0 = x + 4; const y0 = yBase - 5;
  doc.setDrawColor(TINTA); doc.setLineWidth(0.2);
  for (let i = 0; i < 4; i++) {
    doc.setFillColor(i % 2 ? '#ffffff' : TINTA);
    doc.rect(x0 + (largo / 4) * i, y0, largo / 4, 1.4, 'FD');
  }
  doc.setFont('Instrument', 'normal'); doc.setFontSize(6.5); doc.setTextColor(TINTA);
  const formato = (v: number) => (v >= 1 ? miles(Number(v.toFixed(2))) : miles(Math.round(v * 1000)));
  const unidad = km >= 1 ? 'km' : 'm';
  doc.text('0', x0, y0 - 1, { align: 'center' });
  doc.text(formato(km / 2), x0 + largo / 2, y0 - 1, { align: 'center' });
  doc.text(`${formato(km)} ${unidad}`, x0 + largo, y0 - 1, { align: 'center' });
  doc.setFont('Instrument', 'bold'); doc.setFontSize(6.5);
  doc.text(`1:${miles(denominador)}`, x0, y0 + 4.4);
}

function dibujarLeyenda(doc: jsPDF, leyendas: Leyenda[], caja: { x: number; y: number; ancho: number; alto: number; columnas: number }, titulo: string, letra: Letra) {
  if (!leyendas.length) return; // sin leyendas (no llegaron o no hay capas), sin título suelto
  letra('bold', 10);
  doc.text(titulo, caja.x, caja.y + 3.5);
  const sep = 3;
  const anchoCol = (caja.ancho - sep * (caja.columnas - 1)) / caja.columnas;
  const arriba = caja.y + 8.5;
  const fondo = caja.y + caja.alto;
  const TITULO = 4.2; const ESPACIO = 2;

  // Ubica cada leyenda con `k` mm por píxel (las imágenes vienen a 192 ppp con letra de 12 px: con
  // 0,1 la letra queda en ~7 pt). Devuelve las posiciones de las que entran.
  const ubicar = (k: number) => {
    const lugares: { x: number; y: number; ancho: number; alto: number }[] = [];
    let col = 0; let y = arriba;
    for (const l of leyendas) {
      let ancho = l.ancho * k; let alto = l.alto * k;
      if (ancho > anchoCol) { alto *= anchoCol / ancho; ancho = anchoCol; }
      if (y + TITULO + alto > fondo) {
        if (col + 1 >= caja.columnas) break;
        col++; y = arriba;
        if (y + TITULO + alto > fondo) break;
      }
      lugares.push({ x: caja.x + col * (anchoCol + sep), y, ancho, alto });
      y += TITULO + alto + ESPACIO;
    }
    return lugares;
  };
  // La escala más grande en la que entran todas, sin bajar de 0,065 (letra de ~4,5 pt).
  let lugares = ubicar(0.1);
  for (let k = 0.095; lugares.length < leyendas.length && k >= 0.065 - 1e-9; k -= 0.005) lugares = ubicar(k);
  // Si ni así entran, se deja lugar para el aviso.
  const faltan = leyendas.length - lugares.length;
  if (faltan) { const quitar = lugares.filter(l => l.y + TITULO + l.alto > fondo - 5).length; lugares = lugares.slice(0, lugares.length - quitar); }

  lugares.forEach((lugar, i) => {
    letra('bold', 7.5, TINTA);
    doc.text(recortar(doc, leyendas[i].titulo, anchoCol), lugar.x, lugar.y + 2.6);
    doc.addImage(leyendas[i].imagen, 'PNG', lugar.x, lugar.y + TITULO - 0.3, lugar.ancho, lugar.alto, `leyenda-${i}`, 'FAST');
  });
  const restantes = leyendas.length - lugares.length;
  if (restantes) {
    letra('normal', 7, TINTA_3);
    doc.text(`Y ${restantes} ${restantes === 1 ? 'capa más' : 'capas más'}.`, caja.x, fondo - 1);
  }
}

// --- Páginas de la respuesta ---

function paginasDeContenido(doc: jsPDF, o: OpcionesPdf, fecha: Date, letra: Letra) {
  const c = o.contenido!;
  doc.addPage('a4', 'portrait');
  const W = 210; const H = 297;
  let y = 20;
  letra('bold', 16);
  for (const linea of doc.splitTextToSize(c.titulo, W - 2 * MARGEN).slice(0, 2)) { doc.text(linea, MARGEN, y); y += 7; }
  letra('normal', 8.5, TINTA_3);
  // Si el mapa se llama igual que la respuesta, no se repite.
  doc.text(o.titulo && o.titulo !== c.titulo ? `Del mapa «${o.titulo}» · ${formatoFecha(fecha)}` : formatoFecha(fecha), MARGEN, y - 1.5);
  doc.setDrawColor(TINTA); doc.setLineWidth(0.35);
  doc.line(MARGEN, y + 1.5, W - MARGEN, y + 1.5);
  y += 9;

  // Si lo que sigue no entra en lo que queda de la página, pasa a la siguiente (así un subtítulo o el
  // encabezado de una tabla nunca quedan solos al pie).
  const asegurar = (alto: number) => { if (y + alto > H - MARGEN - 8) { doc.addPage('a4', 'portrait'); y = 18; } };
  const cifras = (lista: [string, string][]) => {
    asegurar(22);
    const ancho = (W - 2 * MARGEN - 4 * (lista.length - 1)) / lista.length;
    lista.forEach(([titulo, valor], i) => {
      const x = MARGEN + i * (ancho + 4);
      doc.setFillColor('#f1f2ef'); doc.roundedRect(x, y, ancho, 16, 2, 2, 'F');
      letra('normal', 7.5, TINTA_3); doc.text(titulo, x + 3.5, y + 5.5);
      letra('bold', 15); doc.text(valor, x + 3.5, y + 12.8);
    });
    y += 22;
  };
  // El subtítulo arrastra consigo lo que encabeza: `siguiente` es el alto mínimo que tiene que entrar debajo.
  const subtitulo = (t: string, siguiente = 6.5 + 2 * 5.8) => { asegurar(5 + siguiente); letra('bold', 9.5, TINTA_2); doc.text(t, MARGEN, y); y += 5; };
  const barras = (datos: { etiqueta: string; valor: number; color?: string }[]) => {
    asegurar(datos.length * 6.4 + 4);
    const max = Math.max(...datos.map(d => d.valor), 1);
    const anchoEtiqueta = 58; const anchoBarra = W - 2 * MARGEN - anchoEtiqueta - 18;
    for (const d of datos) {
      letra('normal', 8, TINTA_2); doc.text(recortar(doc, d.etiqueta, anchoEtiqueta - 3), MARGEN, y + 3.2);
      doc.setFillColor('#eceeeb'); doc.roundedRect(MARGEN + anchoEtiqueta, y, anchoBarra, 4.2, 1, 1, 'F');
      doc.setFillColor(d.color ?? VIAL); doc.roundedRect(MARGEN + anchoEtiqueta, y, Math.max(1.5, (d.valor / max) * anchoBarra), 4.2, 1, 1, 'F');
      letra('bold', 8, TINTA); doc.text(miles(d.valor), W - MARGEN, y + 3.2, { align: 'right' });
      y += 6.4;
    }
    y += 4;
  };
  const tabla = (columnas: { titulo: string; ancho: number; alinear?: 'right' }[], filas: string[][]) => {
    const encabezado = () => {
      doc.setFillColor('#15171a'); doc.rect(MARGEN, y, W - 2 * MARGEN, 6.5, 'F');
      letra('bold', 7.5, '#ffffff');
      let x = MARGEN + 2;
      for (const c of columnas) { doc.text(c.titulo, c.alinear ? x + c.ancho - 4 : x, y + 4.4, { align: c.alinear ?? 'left' }); x += c.ancho; }
      y += 6.5;
    };
    asegurar(6.5 + 5.8);
    encabezado();
    filas.forEach((fila, i) => {
      if (y + 6 > H - MARGEN - 8) { doc.addPage('a4', 'portrait'); y = 18; encabezado(); }
      if (i % 2) { doc.setFillColor('#f4f5f2'); doc.rect(MARGEN, y, W - 2 * MARGEN, 5.8, 'F'); }
      letra('normal', 7.5, TINTA);
      let x = MARGEN + 2;
      fila.forEach((celda, j) => {
        const c = columnas[j];
        doc.text(recortar(doc, celda, c.ancho - 4), c.alinear ? x + c.ancho - 4 : x, y + 4, { align: c.alinear ?? 'left' });
        x += c.ancho;
      });
      y += 5.8;
    });
    y += 6;
  };
  const nombrar = (a: [string, string][]) => (o.simple ? nombreSimple(a) : nombrePro(a)) ?? 'Sin nombre';
  const datos = (a: [string, string][]) => (o.simple ? datosSimples(a).slice(0, 3).map(([k, v]) => `${rotuloSimple(k)}: ${v}`) : datosClave(a, 3).map(([k, v]) => `${rotulo(k)}: ${v}`)).join(' · ');

  if (c.tipo === 'medicion') {
    cifras([[c.medicion.tipo === 'distancia' ? (o.simple ? 'Qué tan lejos' : 'Distancia') : (o.simple ? 'Qué tan grande' : 'Área'), c.medicion.texto]]);
    letra('normal', 8.5, TINTA_2);
    doc.text(o.simple ? 'Medido sobre la forma real de la Tierra.' : 'Medición geodésica sobre el elipsoide WGS 84.', MARGEN, y);
  } else if (c.tipo === 'tablero') {
    const a = c.analisis;
    const franja = (n: 1 | 2) => a.localidades.filter(l => l.franja === n);
    const hab = (ls: typeof a.localidades) => ls.reduce((s, l) => s + l.habitantes, 0);
    cifras([
      [o.simple ? 'Largo en la provincia' : 'Longitud de la traza', `${a.km.toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`],
      [o.simple ? 'Gente cerca de la ruta' : 'Población a 20 km', miles(hab(a.localidades))],
      [o.simple ? 'Puentes en la ruta' : 'Puentes a < 100 m', miles(a.puentes.length)],
    ]);
    subtitulo(o.simple ? 'Cuánta gente vive cerca' : 'Población por franja', 2 * 6.4);
    barras([
      { etiqueta: `Hasta 10 km (${franja(1).length} ${o.simple ? 'pueblos' : 'localidades'})`, valor: hab(franja(1)), color: VIAL },
      { etiqueta: `De 10 a 20 km (${franja(2).length} ${o.simple ? 'pueblos' : 'localidades'})`, valor: hab(franja(2)), color: VIAL_SUAVE },
    ]);
    subtitulo(o.simple ? 'Pueblos y ciudades cerca de la ruta' : 'Localidades a menos de 20 km');
    tabla(
      [{ titulo: o.simple ? 'Lugar' : 'Localidad', ancho: 62 }, { titulo: 'Departamento', ancho: 50 }, { titulo: o.simple ? 'Gente' : 'Habitantes', ancho: 30, alinear: 'right' }, { titulo: 'Distancia', ancho: 22, alinear: 'right' }, { titulo: o.simple ? 'Zona' : 'Franja', ancho: 22 }],
      [...a.localidades].sort((p, q) => p.distancia - q.distancia).map(l => [
        /^sin nombre$/i.test(l.nombre) ? 'Lugar sin nombre' : l.nombre, l.departamento, l.habitantes ? miles(l.habitantes) : 'sin dato',
        `${(l.distancia / 1000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`, l.franja === 1 ? 'Hasta 10 km' : '10 a 20 km',
      ]),
    );
    if (a.puentes.length) {
      subtitulo(o.simple ? 'Puentes en la ruta' : 'Puentes a menos de 100 m de la traza');
      tabla(
        [{ titulo: 'Puente', ancho: 92 }, { titulo: 'Tipo', ancho: 70 }, { titulo: 'Distancia', ancho: 24, alinear: 'right' }],
        a.puentes.map(p => [/^sin nombre$/i.test(p.nombre) ? 'Puente sin nombre' : p.nombre, o.simple ? tipoSimple(p.tipo) ?? 'Puente' : p.tipo, `${Math.round(p.distancia)} m`]),
      );
    }
  } else {
    // En simple, cada capa se llama como en "¿Qué querés ver?" (Rutas y caminos, no Red vial).
    const tituloCapa = (k: { capa: string; titulo: string }) => (o.simple ? capaSimple(k.capa)?.titulo ?? k.titulo : k.titulo);
    const consulta = c.consulta;
    const total = consulta.capas.reduce((s, k) => s + k.total, 0);
    cifras([[o.simple ? 'Cosas encontradas' : 'Entidades', miles(total)], [o.simple ? 'Temas' : 'Capas', miles(consulta.capas.length)]]);
    if (consulta.capas.length > 1) {
      const datosBarras = [...consulta.capas].sort((p, q) => q.total - p.total).slice(0, 10).map(k => ({ etiqueta: tituloCapa(k), valor: k.total }));
      subtitulo(o.simple ? 'Por tema' : 'Por capa', datosBarras.length * 6.4);
      barras(datosBarras);
    }
    for (const capa of consulta.capas) {
      subtitulo(`${tituloCapa(capa)} (${capa.entidades.length < capa.total ? `${capa.entidades.length} de ${miles(capa.total)}` : miles(capa.total)})`);
      tabla(
        [{ titulo: '#', ancho: 10 }, { titulo: 'Nombre', ancho: 66 }, { titulo: o.simple ? 'Datos' : 'Datos principales', ancho: 110 }],
        capa.entidades.map((e, i) => {
          const donde = o.ubicaciones?.get(e.id);
          return [String(i + 1), nombrar(e.atributos), [donde, datos(e.atributos)].filter(Boolean).join(' · ')];
        }),
      );
    }
  }
}

function numerarPaginas(doc: jsPDF, letra: Letra) {
  const total = doc.getNumberOfPages();
  if (total < 2) return;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
    letra('normal', 7, TINTA_3);
    doc.text(`${i} / ${total}`, W - MARGEN, H - MARGEN + 1.5, { align: 'right' });
  }
}
