// Las pruebas de la batería. Cada una recibe una combinación (modo, tamaño, tema) y devuelve sus
// chequeos: { que, estado: 'ok' | 'falla' | 'aviso', detalle }. Las capturas van a la carpeta de salida.
import path from 'node:path';
import {
  abrir, axe, centrar, esperarMapa, esperarQuietud, esperarResultados, foco, hayResultados, pausa, pixel,
} from './lib.mjs';

// Números de referencia del tablero de la RN11 (docs/plans/visor-inteligente.md, PostGIS geodésico).
export const REFERENCIA_RN11 = { km: '172,4', hasta10: ['22', '363.320'], de10a20: ['15', '26.080'], puentes: '17' };
// Línea de base de rendimiento (docs/optimizacion-visor.md, 29/10/2026, build en nginx a 1440×900).
export const BASE_RENDIMIENTO = { fcp: 180, lcp: 1052, jsMover: 23, jsKB: 320 };
// Resistencia: punto fijo para consultas, mediciones y altas.
const RESISTENCIA = [-58.986, -27.452];

const etiqueta = c => `${c.modo ?? 'bienvenida'}-${c.tema}-${c.w}${c.conTablero ? '-tablero' : ''}`;

function nuevoInforme(prueba, combo) {
  const chequeos = [];
  const informe = { prueba, combo: etiqueta(combo), chequeos, capturas: [] };
  const anotar = (que, ok, detalle = '', aviso = false) => chequeos.push({ que, estado: ok ? 'ok' : aviso ? 'aviso' : 'falla', detalle });
  return { informe, anotar };
}

async function capturar(p, informe, salida, nombre) {
  const archivo = path.join(salida, `${informe.prueba}-${informe.combo}-${nombre}.png`);
  await p.screenshot({ path: archivo });
  informe.capturas.push(archivo);
}

function cerrarRegistro(informe, anotar, registro) {
  anotar('consola sin errores ni avisos', registro.errores.length === 0, registro.errores.slice(0, 3).join(' · '));
  anotar('ningún pedido fuera de localhost', registro.externos.length === 0, registro.externos.slice(0, 3).join(' · '));
  anotar('ninguna respuesta HTTP ≥ 400', registro.fallas.length === 0, registro.fallas.slice(0, 3).join(' · '));
}

// El foco vuelve en el cuadro siguiente al cierre: se espera hasta 1 s a que deje el body.
const esperarFoco = p => p.waitForFunction(() => document.activeElement && document.activeElement !== document.body, null, { timeout: 1000 }).catch(() => {});

const herramientaActiva = p => p.evaluate(() => [...document.querySelectorAll('[aria-pressed="true"]')]
  .map(b => b.getAttribute('aria-label') || b.innerText.split('\n')[0]).join(', '));

async function envolver(prueba, combo, cuerpo, { navegador, url, salida }, opciones = {}) {
  const { informe, anotar } = nuevoInforme(prueba, combo);
  const { ctx, p, registro, cdp } = await abrir(navegador, { url, ...combo, ...opciones });
  try {
    await cuerpo({ p, anotar, informe, registro, cdp });
  } catch (e) {
    anotar('la prueba terminó sin excepciones', false, String(e).split('\n')[0].slice(0, 240));
    await capturar(p, informe, salida, 'error').catch(() => {});
  }
  cerrarRegistro(informe, anotar, registro);
  await ctx.close();
  return informe;
}

// --- Vista inicial: captura, escala gráfica exacta, texto guía del buscador y axe ---
export function vista(combo, entorno) {
  return envolver('vista', combo, async ({ p, anotar, informe }) => {
    await esperarQuietud(p);
    await capturar(p, informe, entorno.salida, 'inicio');
    // La barra tiene una transición de ancho: se mide cuando dos lecturas seguidas coinciden.
    await p.waitForFunction(() => new Promise(r => {
      const ancho = () => [...document.querySelectorAll('.ol-scale-line-inner')].find(x => x.getBoundingClientRect().width > 0)?.getBoundingClientRect().width;
      const a = ancho(); setTimeout(() => r(a !== undefined && a === ancho()), 350);
    }), null, { timeout: 5000 }).catch(() => {});
    const escala = await p.evaluate(() => {
      const v = window.__visor();
      const e = [...document.querySelectorAll('.ol-scale-line-inner')].find(x => x.getBoundingClientRect().width > 0);
      if (!e) return null;
      const txt = e.textContent; const metros = parseFloat(txt) * (/km/.test(txt) ? 1000 : 1);
      const vw = v.mapa.getView(); const lat = Math.atan(Math.sinh(vw.getCenter()[1] / 6378137));
      return { txt, pantalla: e.getBoundingClientRect().width, correcto: metros / (vw.getResolution() * Math.cos(lat)) };
    });
    anotar('escala gráfica visible', !!escala);
    if (escala) anotar('escala gráfica mide lo que dice (±2 %)', Math.abs(escala.pantalla / escala.correcto - 1) <= 0.02, `${escala.txt}: ${escala.pantalla.toFixed(1)} px contra ${escala.correcto.toFixed(1)} px`);
    const guia = await p.evaluate(() => {
      const i = document.querySelector('input[aria-label="Buscar"]');
      const c = document.createElement('canvas').getContext('2d'); const e = getComputedStyle(i, '::placeholder');
      c.font = `${e.fontWeight} ${e.fontSize} ${e.fontFamily}`;
      return { texto: i.placeholder, ancho: c.measureText(i.placeholder).width, campo: i.clientWidth };
    });
    anotar('el texto guía del buscador entra', guia.ancho <= guia.campo, `"${guia.texto}": ${Math.round(guia.ancho)} de ${guia.campo} px`);
    const v = await axe(p);
    anotar('axe sin violaciones (inicio)', v.length === 0, v.join(' · '));
  }, entorno, combo);
}

// --- Tablero de la RN11: números de referencia y axe ---
export function tablero(combo, entorno) {
  return envolver('tablero', combo, async ({ p, anotar, informe }) => {
    await p.locator('button[aria-pressed]').filter({ hasText: /ruta 11|RN11/ }).first().click();
    // Los números se animan al aparecer: se espera a que estén todos (o a que se termine el tiempo).
    const todos = [REFERENCIA_RN11.km, ...REFERENCIA_RN11.hasta10, ...REFERENCIA_RN11.de10a20];
    await p.waitForFunction(ns => ns.every(n => document.body.innerText.includes(n)), todos, { timeout: 30000 }).catch(() => {});
    await esperarQuietud(p);
    const t = await p.evaluate(() => document.body.innerText);
    const r = REFERENCIA_RN11;
    anotar(`longitud ${r.km} km`, t.includes(r.km));
    anotar(`hasta 10 km: ${r.hasta10.join(' localidades, ')} hab.`, r.hasta10.every(n => t.includes(n)));
    anotar(`de 10 a 20 km: ${r.de10a20.join(' localidades, ')} hab.`, r.de10a20.every(n => t.includes(n)));
    anotar(`${r.puentes} puentes`, new RegExp(`\\b${r.puentes}\\b`).test(t));
    await esperarMapa(p);
    await capturar(p, informe, entorno.salida, 'tablero');
    const v = await axe(p);
    anotar('axe sin violaciones (tablero)', v.length === 0, v.join(' · '));
  }, entorno, combo);
}

// --- Consignas A.3: navegación, capas, leyenda, punto, rectángulo, medición y (opcional) alta ---
export function consignas(combo, entorno) {
  return envolver('consignas', combo, async ({ p, anotar, informe }) => {
    const { w, h, modo } = combo;
    const vista = () => p.evaluate(() => { const v = window.__visor().mapa.getView(); return { z: v.getZoom(), c: v.getCenter() }; });
    // Navegación: rueda, botón + y arrastre.
    const a = await vista();
    // La rueda y el botón animan el zoom con un pequeño retraso: se espera a que cambie y después al dibujo.
    const cambioZoom = z => p.waitForFunction(z => Math.abs(window.__visor().mapa.getView().getZoom() - z) > 0.2 && !window.__visor().mapa.getView().getAnimating(), z, { timeout: 4000 }).catch(() => {});
    await p.mouse.move(w * 0.55, h * 0.5); await p.mouse.wheel(0, -500); await cambioZoom(a.z); await esperarMapa(p);
    const b = await vista();
    await p.getByRole('button', { name: /^Acercar/ }).first().click(); await cambioZoom(b.z); await esperarMapa(p);
    const c = await vista();
    await p.mouse.move(w * 0.55, h * 0.5); await p.mouse.down(); await p.mouse.move(w * 0.55 - 150, h * 0.5 - 50, { steps: 8 }); await p.mouse.up(); await esperarMapa(p);
    const d = await vista();
    anotar('zoom con la rueda', b.z > a.z, `${a.z.toFixed(2)} → ${b.z.toFixed(2)}`);
    anotar('zoom con el botón +', c.z > b.z, `${b.z.toFixed(2)} → ${c.z.toFixed(2)}`);
    anotar('paneo arrastrando', Math.hypot(d.c[0] - c.c[0], d.c[1] - c.c[1]) > 0);

    // Leyenda.
    if (modo === 'simple') await p.locator('button[title^="Referencias"]').first().click();
    // En pro, con el inspector vacío y poco ancho (1366), el inspector se pliega a un botón "Leyenda".
    else await p.getByRole('radio', { name: /Leyenda/ }).or(p.getByRole('button', { name: /^Leyenda$/ })).first().click();
    const imagenesLeyenda = () => [...document.querySelectorAll('section[aria-label^="Referencias"] img, section[aria-label^="Leyenda"] img')]
      .filter(i => i.complete && i.naturalWidth > 0 && i.getBoundingClientRect().width > 0).length;
    await p.waitForFunction(imagenesLeyenda, null, { timeout: 15000 }).catch(() => {});
    const leyendas = await p.evaluate(imagenesLeyenda);
    anotar('leyenda con imágenes', leyendas > 0, `${leyendas} imágenes`);
    await capturar(p, informe, entorno.salida, 'leyenda');
    if (modo === 'simple') { await p.keyboard.press('Escape'); await esperarQuietud(p); }
    else await p.getByRole('radio', { name: /Información/ }).first().click();

    // Prender y apagar capas.
    const capas = () => p.evaluate(() => window.__visor().visibles.size);
    const n0 = await capas();
    if (modo === 'simple') {
      await p.getByRole('button', { name: /^Escuelas, salud/ }).first().click();
      const tarjeta = p.locator('[data-guia=temas] button[aria-pressed]').first();
      await tarjeta.waitFor(); await tarjeta.click();
    } else await p.getByLabel('Prender todo Relieve').click({ force: true });
    await p.waitForFunction(n => window.__visor().visibles.size !== n, n0, { timeout: 5000 }).catch(() => {});
    const n1 = await capas();
    if (modo === 'simple') { await p.locator('[data-guia=temas] button[aria-pressed]').first().click(); await p.getByRole('button', { name: 'Volver a todos los temas' }).click(); }
    else await p.getByLabel('Apagar todo Relieve').click({ force: true });
    await p.waitForFunction(n => window.__visor().visibles.size === n, n0, { timeout: 5000 }).catch(() => {});
    const n2 = await capas();
    anotar('prender y apagar capas', n1 > n0 && n2 === n0, `${n0} → ${n1} → ${n2}`);

    // Consulta por punto sobre Resistencia.
    await p.keyboard.press('Escape');
    await centrar(p, ...RESISTENCIA, 11);
    await p.keyboard.press('2');
    const [x, y] = await pixel(p, ...RESISTENCIA);
    await p.mouse.click(x, y);
    await esperarResultados(p).catch(() => {});
    const punto = await p.evaluate(() => document.querySelector('[aria-label="Cerrar resultados"]')?.closest('section')?.querySelector('header')?.innerText.replace(/\s+/g, ' '));
    anotar('consulta por punto', !!punto && /\d/.test(punto), punto ?? 'sin respuesta');
    await capturar(p, informe, entorno.salida, 'punto');

    // Consulta por rectángulo.
    await p.keyboard.press('3');
    await p.mouse.move(x - 120, y - 90); await p.mouse.down(); await p.mouse.move(x + 120, y + 90, { steps: 10 }); await p.mouse.up();
    await p.waitForFunction(() => /rect|zona|vista/i.test(document.querySelector('[aria-label="Cerrar resultados"]')?.closest('section')?.querySelector('h2')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => {});
    await esperarResultados(p).catch(() => {});
    const rect = await p.evaluate(() => document.querySelector('[aria-label="Cerrar resultados"]')?.closest('section')?.querySelector('header')?.innerText.replace(/\s+/g, ' '));
    anotar('consulta por rectángulo', !!rect && /\d/.test(rect), rect ?? 'sin respuesta');
    await capturar(p, informe, entorno.salida, 'rectangulo');

    // Medición de distancia, contra la geodésica calculada aparte (haversine, radio medio).
    await p.keyboard.press('Escape'); await p.keyboard.press('4');
    await p.mouse.click(x - 150, y); await pausa(250); await p.mouse.dblclick(x + 150, y);
    await p.waitForFunction(() => /\d[\d.,]*\s?k?m\b/.test(document.querySelector('[aria-label="Cerrar resultados"]')?.closest('section')?.innerText ?? ''), null, { timeout: 5000 }).catch(() => {});
    const medida = await p.evaluate(() => document.querySelector('[aria-label="Cerrar resultados"]')?.closest('section')?.innerText.match(/(\d[\d.,]*)\s?(km|m)\b/));
    const esperada = await p.evaluate(([x, y]) => {
      const v = window.__visor(); const r = v.mapa.getViewport().getBoundingClientRect();
      const ll = px => { const c = v.mapa.getCoordinateFromPixel([px - r.left, y - r.top]); return [c[0] * 180 / 20037508.34, Math.atan(Math.exp(c[1] / 6378137)) * 360 / Math.PI - 90]; };
      const [A, B] = [ll(x - 150), ll(x + 150)]; const q = Math.PI / 180;
      return 2 * 6371.0088 * Math.asin(Math.sqrt(Math.sin((B[1] - A[1]) * q / 2) ** 2 + Math.cos(A[1] * q) * Math.cos(B[1] * q) * Math.sin((B[0] - A[0]) * q / 2) ** 2));
    }, [x, y]);
    const km = medida ? parseFloat(medida[1].replace(/\./g, '').replace(',', '.')) / (medida[2] === 'm' ? 1000 : 1) : NaN;
    anotar('medición de distancia (±1 % de la geodésica)', Math.abs(km / esperada - 1) <= 0.01, `${medida?.[0] ?? '—'} contra ${esperada.toFixed(2)} km`);
    await capturar(p, informe, entorno.salida, 'medicion');

    // Alta de obra por WFS-T: se guarda y después se borra (solo con --con-alta o en nivel completo).
    if (entorno.conAlta) {
      const marca = `verificar ${informe.combo} ${Date.now()}`;
      await p.keyboard.press('Escape'); await p.keyboard.press('6');
      await p.mouse.click(x + 40, y + 40);
      await p.locator('form textarea').first().waitFor({ timeout: 8000 });
      await p.locator('form textarea').first().fill(marca);
      await p.getByRole('button', { name: /Guardar/ }).click();
      const aviso = await p.waitForFunction(() => document.body.innerText.match(/Guardamos la obra|Obra guardada/)?.[0], null, { timeout: 15000 }).then(r => r.jsonValue()).catch(() => null);
      anotar('alta de obra por WFS-T', !!aviso, aviso ?? 'sin aviso de guardado');
      await capturar(p, informe, entorno.salida, 'alta');
      const borradas = await p.evaluate(async marca => {
        const xml = '<wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:tpi="https://github.com/matiasgzlez/TPI-GIS">'
          + '<wfs:Delete typeName="tpi:obras_rn11"><ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>descripcion</ogc:PropertyName>'
          + `<ogc:Literal>${marca}</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter></wfs:Delete></wfs:Transaction>`;
        const r = await fetch('/wfst', { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml });
        return (await r.text()).match(/totalDeleted>(\d+)/)?.[1] ?? '0';
      }, marca);
      anotar('la obra de prueba se borró', borradas === '1', `${borradas} borradas`);
    }
  }, entorno, combo);
}

// --- Teclado: diálogos modales, atajos, foco y desplazamiento ---
export function teclado(combo, entorno) {
  if (!combo.modo) return bienvenida(combo, entorno);
  return envolver('teclado', combo, async ({ p, anotar, informe }) => {
    const enDialogo = () => p.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
    const valorBuscador = () => p.evaluate(() => document.querySelector('input[aria-label="Buscar"]')?.value ?? '');
    const tabsDentro = async n => { for (let i = 0; i < n; i++) { await p.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab'); if (!(await enDialogo())) return false; } return true; };

    // Atajos sin diálogos.
    await p.keyboard.press('4');
    anotar('sin diálogos, "4" elige Medir', /Medir/.test(await herramientaActiva(p)), await herramientaActiva(p));
    await p.keyboard.press('Escape');
    anotar('Escape vuelve a navegar', /Navegar|Mover/.test(await herramientaActiva(p)), await herramientaActiva(p));
    await p.keyboard.press('/');
    anotar('"/" lleva al buscador', (await foco(p)) === 'Buscar', await foco(p));
    await p.keyboard.press('Escape');

    if (combo.modo === 'simple') {
      // Referencias: Escape la cierra y devuelve el foco.
      await p.locator('button[title^="Referencias"]').first().click();
      await p.waitForSelector('section[aria-label^="Referencias"]');
      await p.keyboard.press('Escape');
      await p.waitForSelector('section[aria-label^="Referencias"]', { state: 'detached', timeout: 3000 }).catch(() => {});
      anotar('Escape cierra Referencias', !(await p.$('section[aria-label^="Referencias"]')));
      anotar('el foco vuelve a Referencias', /Referencias/.test(await foco(p)), await foco(p));

      // Guía con una respuesta y Referencias abiertas detrás.
      await centrar(p, ...RESISTENCIA, 11);
      await p.keyboard.press('2');
      const [x, y] = await pixel(p, ...RESISTENCIA);
      await p.mouse.click(x, y); await esperarResultados(p).catch(() => {});
      // Sin "1": elegir Mover cierra la respuesta a propósito.
      await p.locator('button[title^="Referencias"]').first().click();
      await p.waitForSelector('section[aria-label^="Referencias"]');
      await p.getByRole('button', { name: 'Ayuda: cómo se usa' }).click();
      await p.waitForSelector('#guia-titulo');
      await esperarQuietud(p);
      anotar('al abrir la guía, el foco está adentro', await enDialogo(), await foco(p));
      const v = await axe(p);
      anotar('axe sin violaciones (guía)', v.length === 0, v.join(' · '));
      await capturar(p, informe, entorno.salida, 'guia');
      await p.keyboard.press('4'); await p.keyboard.press('/'); await p.keyboard.type('xy');
      anotar('con la guía, los atajos no actúan detrás', !/Medir/.test(await herramientaActiva(p)) && (await valorBuscador()) === '', `${await herramientaActiva(p)} · buscador "${await valorBuscador()}"`);
      anotar('con la guía, el Tab no sale de la burbuja', await tabsDentro(8));
      await p.keyboard.press('Escape');
      await p.waitForSelector('#guia-titulo', { state: 'detached', timeout: 3000 }).catch(() => {});
      anotar('Escape cierra la guía', !(await p.$('#guia-titulo')));
      anotar('lo de atrás sigue abierto (respuesta y Referencias)', (await hayResultados(p)) && !!(await p.$('section[aria-label^="Referencias"]')));
      await esperarFoco(p);
      anotar('el foco vuelve a "Ayuda: cómo se usa"', (await foco(p)) === 'Ayuda: cómo se usa', await foco(p));
      await p.keyboard.press('Escape'); await esperarQuietud(p);
    }

    // Configuración: modal, atajos bloqueados, Tab atrapado, manual desplazable, foco de vuelta.
    if (!(await hayResultados(p))) {
      await centrar(p, ...RESISTENCIA, 11);
      await p.keyboard.press('2');
      const [x, y] = await pixel(p, ...RESISTENCIA);
      await p.mouse.click(x, y); await esperarResultados(p).catch(() => {});
    }
    await p.getByRole('button', { name: 'Configuración y ayuda' }).first().click();
    await p.waitForSelector('[role=dialog][aria-label="Configuración y ayuda"]');
    await esperarQuietud(p);
    await p.keyboard.press('4'); await p.keyboard.press('/'); await p.keyboard.type('xy'); await p.keyboard.press('Meta+k');
    anotar('con Configuración, los atajos no actúan detrás', !/Medir/.test(await herramientaActiva(p)) && (await valorBuscador()) === '' && (await enDialogo()), `${await herramientaActiva(p)} · buscador "${await valorBuscador()}"`);
    anotar('con Configuración, el Tab no sale de la hoja', await tabsDentro(30));
    await p.getByRole('radio', { name: /Cómo se usa|Manual/ }).first().click();
    const region = p.locator('[aria-label="Contenido de Configuración"]');
    await region.focus(); await p.keyboard.press('End');
    // El desplazamiento es suave: se espera a que llegue al final (o a que se quede quieto), no un tiempo fijo.
    const desplazado = await region.evaluate(e => new Promise(listo => {
      let ultimo = -1, quieto = 0; const t0 = performance.now();
      const mirar = () => {
        const fin = e.scrollHeight <= e.clientHeight || e.scrollTop + e.clientHeight >= e.scrollHeight - 2;
        quieto = e.scrollTop === ultimo ? quieto + 1 : 0; ultimo = e.scrollTop;
        if (fin || quieto > 20 || performance.now() - t0 > 4000) listo(fin); else requestAnimationFrame(mirar);
      };
      mirar();
    }));
    anotar('el manual se recorre con el teclado hasta el final', desplazado);
    const v = await axe(p);
    anotar('axe sin violaciones (Configuración, manual)', v.length === 0, v.join(' · '));
    await capturar(p, informe, entorno.salida, 'configuracion');
    await p.keyboard.press('Escape');
    await p.waitForSelector('[role=dialog][aria-label="Configuración y ayuda"]', { state: 'detached', timeout: 3000 }).catch(() => {});
    anotar('Escape cierra Configuración y deja la respuesta', !(await p.$('[role=dialog][aria-label="Configuración y ayuda"]')) && (await hayResultados(p)));
    await esperarFoco(p);
    anotar('el foco vuelve al engranaje', (await foco(p)) === 'Configuración y ayuda', await foco(p));
  }, entorno, combo);
}

// Bienvenida: Tab atrapado, atajos bloqueados, axe y foco después de elegir Profesional.
function bienvenida(combo, entorno) {
  return envolver('bienvenida', combo, async ({ p, anotar, informe }) => {
    await esperarQuietud(p);
    await capturar(p, informe, entorno.salida, 'inicio');
    const v = await axe(p);
    anotar('axe sin violaciones (bienvenida)', v.length === 0, v.join(' · '));
    let dentro = true;
    for (let i = 0; i < 6; i++) { await p.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab'); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))) dentro = false; }
    anotar('el Tab no sale de la bienvenida', dentro);
    await p.keyboard.press('4');
    await p.getByRole('button', { name: /Profesional/ }).first().focus();
    await p.keyboard.press('Enter');
    await p.waitForSelector('#bienvenida-titulo', { state: 'detached', timeout: 5000 }).catch(() => {});
    await pausa(200);
    anotar('el "4" no actuó detrás de la bienvenida', !/Medir/.test(await herramientaActiva(p)), await herramientaActiva(p));
    anotar('después de elegir Profesional, el foco queda en "Pro"', (await foco(p)) === 'Pro', await foco(p));
  }, entorno, { modo: null });
}

// --- Rendimiento: carga sin caché y JS al mover el mouse sobre el mapa ---
export function rendimiento(combo, entorno) {
  return envolver('rendimiento', combo, async ({ p, anotar, registro, cdp }) => {
    const fcp = await p.evaluate(() => Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0));
    const lcp = await p.evaluate(() => Math.round(window.__lcp));
    const red = { ...registro.red };
    anotar(`FCP ≤ ${BASE_RENDIMIENTO.fcp} ms`, fcp <= BASE_RENDIMIENTO.fcp, `${fcp} ms`, fcp <= BASE_RENDIMIENTO.fcp * 1.5);
    anotar(`LCP ≤ ${BASE_RENDIMIENTO.lcp} ms`, lcp <= BASE_RENDIMIENTO.lcp, `${lcp} ms`);
    const jsKB = Math.round(red.js / 1024);
    anotar(`JS al abrir ≤ ${BASE_RENDIMIENTO.jsKB} KB`, jsKB <= BASE_RENDIMIENTO.jsKB, `${jsKB} KB · ${red.pedidos} pedidos · ${(red.bytes / 1e6).toFixed(2)} MB`, true);
    await cdp.send('Performance.enable');
    await p.evaluate(() => { window.__lentos = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (/pointer|mouse/.test(e.name)) window.__lentos++; }).observe({ type: 'event', durationThreshold: 16 }); });
    const { w, h } = combo;
    // Calentamiento (descartado): la primera tanda compila y llena cachés, y salía 5 a 7 veces más lenta.
    for (let i = 0; i < 120; i++) await p.mouse.move(w * 0.45 + (i % 60) * 4, h * 0.45 + (i % 7));
    await pausa(500);
    await p.evaluate(() => { window.__lentos = 0; });
    const tandas = [];
    for (let t = 0; t < 3; t++) {
      const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      for (let i = 0; i < 120; i++) await p.mouse.move(w * 0.45 + (i % 60) * 4, h * 0.45 + Math.floor(i / 60) * 30 + (i % 7));
      const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      tandas.push({ js: (m1.ScriptDuration - m0.ScriptDuration) * 1000, layout: (m1.LayoutDuration - m0.LayoutDuration) * 1000 });
      await pausa(400);
    }
    const mediana = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const js = mediana(tandas.map(t => t.js));
    anotar(`JS al mover el mouse (mediana de 3 × 120) ≤ ${BASE_RENDIMIENTO.jsMover} ms`, js <= BASE_RENDIMIENTO.jsMover * 1.3,
      `${tandas.map(t => Math.round(t.js)).join(' / ')} ms de JS · ${tandas.map(t => Math.round(t.layout)).join(' / ')} ms de layout`, js <= BASE_RENDIMIENTO.jsMover * 1.6);
    const lentos = await p.evaluate(() => window.__lentos);
    anotar('ningún movimiento sobre el mapa tarda más de 16 ms', lentos === 0, `${lentos} eventos`, true);
  }, entorno, { sinCache: true });
}

// --- Imprimir / exportar a PDF (T2): ventana, vista previa, encuadre, escala, descarga y archivo ---
export function exportar(combo, entorno) {
  return envolver('exportar', combo, async ({ p, anotar, informe }) => {
    const conTablero = combo.conTablero;
    if (conTablero) {
      await p.locator('button[aria-pressed]').filter({ hasText: /ruta 11|RN11/ }).first().click();
      await p.waitForFunction(n => document.body.innerText.includes(n), REFERENCIA_RN11.hasta10[1], { timeout: 30000 });
      await esperarMapa(p);
    }
    const lienzo = 'canvas[aria-label^="Vista previa"]';
    const version = () => p.evaluate(s => Number(document.querySelector(s)?.dataset.version ?? 0), lienzo);
    const listo = (desde = 0) => p.waitForFunction(([s, v]) => {
      const c = document.querySelector(s);
      return c && Number(c.dataset.version ?? 0) > v && !document.querySelector('[role=dialog] [role=status]');
    }, [lienzo, desde], { timeout: 45000 });
    const boton = combo.modo === 'simple' ? 'Imprimir el mapa' : 'Exportar a PDF';
    const t0 = Date.now();
    await p.getByRole('button', { name: boton, exact: true }).first().click();
    // Cuadro a cuadro hasta que esté lista: nunca la descarga habilitada mientras la hoja se dibuja
    // (lápiz visible o color todavía recortado).
    const adelantos = [];
    const vigilar = (async () => {
      for (let i = 0; i < 200; i++) {
        const e = await p.evaluate(() => {
          const b = [...document.querySelectorAll('[role=dialog] button')].find(x => /Descargar/.test(x.textContent ?? ''));
          const c = document.querySelector('canvas[aria-label^="Vista previa"]');
          const lapiz = c?.previousElementSibling;
          // Un recorte en cero (inset(0%) u otra forma equivalente) es la hoja entera: no se está dibujando.
          const recortada = !!c?.style.clipPath && !/^inset\(0%( 0%)*\)$/.test(c.style.clipPath);
          const dibujando = (lapiz && getComputedStyle(lapiz).opacity !== '0') || recortada;
          return { habilitada: b?.getAttribute('aria-disabled') === 'false', dibujando: !!dibujando, version: Number(c?.dataset.version ?? 0) };
        }).catch(() => null);
        if (e?.habilitada && e.dibujando) adelantos.push(i);
        if (e?.habilitada && !e.dibujando && e.version > 0) break;
        await pausa(40);
      }
    })();
    await listo();
    await vigilar;
    anotar('la descarga no se habilita mientras la hoja se dibuja', adelantos.length === 0, adelantos.length ? `${adelantos.length} cuadros adelantados` : '');
    const segundos = (Date.now() - t0) / 1000;
    anotar(`"${boton}" abre la ventana y la vista previa aparece`, true, `${segundos.toFixed(1)} s`);
    anotar('la vista previa tarda menos de 8 s', segundos < 8, `${segundos.toFixed(1)} s`, true);
    const ventana = await p.evaluate(() => {
      const d = document.querySelector('[role=dialog][aria-labelledby="imprimir-titulo"]'); const caja = d?.firstElementChild?.nextElementSibling?.getBoundingClientRect();
      const hoja = document.querySelector('canvas[aria-label^="Vista previa"]')?.getBoundingClientRect();
      const b = [...(d?.querySelectorAll('button') ?? [])].find(x => /Descargar/.test(x.textContent ?? ''))?.getBoundingClientRect();
      return d && caja && hoja && b ? {
        modal: d.getAttribute('aria-modal') === 'true',
        dentro: caja.left >= 0 && caja.right <= innerWidth + 1 && caja.top >= 0 && caja.bottom <= innerHeight + 1,
        hojaProtagonista: (hoja.width * hoja.height) / (innerWidth * innerHeight),
        descargaVisible: b.bottom <= innerHeight && b.top >= 0,
        foco: document.activeElement?.tagName === 'INPUT' && !!document.activeElement.closest('[role=dialog]'),
      } : null;
    });
    anotar('es una ventana modal que entra en la pantalla', !!ventana?.modal && !!ventana?.dentro, JSON.stringify(ventana));
    anotar('la hoja es protagonista (≥ 25 % de la pantalla)', (ventana?.hojaProtagonista ?? 0) >= 0.25, `${Math.round((ventana?.hojaProtagonista ?? 0) * 100)} %`);
    anotar('el botón de descarga se ve', !!ventana?.descargaVisible);
    anotar('el foco empieza en el título', !!ventana?.foco);
    await capturar(p, informe, entorno.salida, 'ventana');
    const v = await axe(p);
    anotar('axe sin violaciones (imprimir)', v.length === 0, v.join(' · '));

    // Atajos bajo la ventana: no actúan. El Tab no sale.
    await p.keyboard.press('4');
    anotar('con la ventana abierta, "4" no actúa detrás', !/Medir/.test(await herramientaActiva(p)), await herramientaActiva(p));
    let dentro = true;
    for (let i = 0; i < 24; i++) { await p.keyboard.press(i % 4 === 3 ? 'Shift+Tab' : 'Tab'); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))) dentro = false; }
    anotar('el Tab no sale de la ventana', dentro);

    // Encuadre y escala rehacen la vista previa.
    const escala = () => p.evaluate(() => [...document.querySelectorAll('[role=dialog] *')].map(e => e.childElementCount === 0 ? e.textContent : '').find(t => /^1:[\d.]+$/.test(t ?? '')));
    const e0 = await escala();
    let antes = await version();
    const ventana2 = p.getByRole('dialog', { name: /Imprimir el mapa|Exportar a PDF/ });
    await ventana2.getByRole('radio', { name: /Todo el Chaco|Chaco completo/ }).click();
    anotar('cambiar el encuadre rehace la vista previa', await listo(antes).then(() => true).catch(() => false));
    const e1 = await escala();
    antes = await version();
    await ventana2.getByRole('button', { name: /Acercar|más cerca/ }).click();
    // Lo que se descarga es lo que se ve: apenas cambia la escala, el PDF anterior ya no se puede bajar.
    const bloqueada = await ventana2.getByRole('button', { name: /Descargar/ }).getAttribute('aria-disabled');
    anotar('justo después de un cambio, la descarga queda bloqueada', bloqueada === 'true', `aria-disabled=${bloqueada}`);
    const cambio = await listo(antes).then(() => true).catch(() => false);
    const e2 = await escala();
    const n = t => Number((t ?? '').replace(/\D/g, ''));
    anotar('acercar baja el denominador y rehace la hoja', cambio && n(e2) < n(e1), `${e0} → ${e1} → ${e2}`);

    // Paso de página (si hay varias): ningún cuadro con la descarga habilitada desde el clic hasta que
    // la página nueva termina de dibujarse.
    if (await ventana2.getByRole('button', { name: 'Página 2' }).count()) {
      await listo(await version()).catch(() => {});
      await p.evaluate(() => {
        window.__adelantos = 0; window.__midiendo = true; window.__clic = false;
        // Se cuenta desde el clic en la miniatura (antes, con la página 1 entera, la descarga va habilitada).
        document.addEventListener('pointerdown', () => { window.__clic = true; }, { capture: true, once: true });
        const mirar = () => {
          const b = [...document.querySelectorAll('[role=dialog] button')].find(x => /Descargar/.test(x.textContent ?? ''));
          const c = document.querySelector('canvas[aria-label^="Vista previa"]');
          if (window.__clic && (c?.dataset.pagina !== '2' || Number(c.dataset.version) <= window.__versionInicial)) { if (b?.getAttribute('aria-disabled') === 'false') window.__adelantos++; }
          if (window.__midiendo) requestAnimationFrame(mirar);
        };
        window.__versionInicial = Number(document.querySelector('canvas[aria-label^="Vista previa"]')?.dataset.version ?? 0);
        requestAnimationFrame(mirar);
      });
      await ventana2.getByRole('button', { name: 'Página 2' }).click();
      await p.waitForFunction(() => { const c = document.querySelector('canvas[aria-label^="Vista previa"]'); return c?.dataset.pagina === '2' && Number(c.dataset.version) > window.__versionInicial; }, null, { timeout: 15000 }).catch(() => {});
      const adelantosPagina = await p.evaluate(() => { window.__midiendo = false; return window.__adelantos; });
      anotar('al pasar de página, la descarga espera a la página nueva', adelantosPagina === 0, adelantosPagina ? `${adelantosPagina} cuadros adelantados` : '');
      await ventana2.getByRole('button', { name: 'Página 1' }).click();
      await listo(await version()).catch(() => {});
    }

    // Título y orientación.
    antes = await version();
    await ventana2.getByLabel(/^(Título del mapa|Cómo se llama)$/).fill('Prueba de la batería');
    anotar('editar el título rehace la vista previa', await listo(antes).then(() => true).catch(() => false));
    antes = await version();
    await ventana2.getByRole('radio', { name: /Vertical|Parada/ }).click();
    await listo(antes);
    // La proporción de la página dibujada (el cuadro que la contiene se anima con un resorte).
    const proporcion = await p.evaluate(s => { const c = document.querySelector(s); return c.height / c.width; }, lienzo);
    anotar('la hoja vertical se ve vertical', proporcion > 1.3, proporcion.toFixed(2));
    await capturar(p, informe, entorno.salida, 'vertical');

    // Descarga.
    const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.getByRole('button', { name: /Descargar/ }).click()]);
    const ruta = path.join(entorno.salida, `exportar-${informe.combo}.pdf`);
    await descarga.saveAs(ruta);
    const datos = (await import('node:fs')).readFileSync(ruta);
    const texto = datos.toString('latin1');
    const paginas = (texto.match(/\/Type \/Page[^s]/g) ?? []).length;
    anotar('el archivo es un PDF con el nombre del título', texto.startsWith('%PDF-') && /prueba-de-la-bateria/.test(descarga.suggestedFilename()), `${Math.round(datos.length / 1024)} KB · ${descarga.suggestedFilename()}`);
    anotar('trae el mapa como imagen y la letra incrustada', /\/Subtype \/Image/.test(texto) && /\/FontFile2/.test(texto));
    anotar(conTablero ? 'con el tablero abierto suma páginas con la tabla' : 'una sola página sin respuesta abierta', conTablero ? paginas >= 2 : paginas === 1, `${paginas} páginas`);
    informe.capturas.push(ruta);

    await p.keyboard.press('Escape');
    await p.waitForSelector('#imprimir-titulo', { state: 'detached', timeout: 3000 }).catch(() => {});
    anotar('Escape cierra la ventana', !(await p.$('#imprimir-titulo')));
    await esperarFoco(p);
    anotar('el foco vuelve al botón que la abrió', (await foco(p)) === boton, await foco(p));
  }, entorno, combo);
}

// --- Imprimir: integridad. Nunca se descarga un PDF incompleto ni distinto de lo que se ve ---
export function exportarIntegridad(combo, entorno) {
  return envolver('integridad', combo, async ({ p, anotar, informe, registro }) => {
    const ventana = p.getByRole('dialog', { name: /Imprimir el mapa|Exportar a PDF/ });
    const descargar = () => ventana.getByRole('button', { name: /Descargar/ });
    const habilitada = (tope = 45000) => p.waitForFunction(() => [...document.querySelectorAll('[role=dialog] button')].find(b => /Descargar/.test(b.textContent ?? ''))?.getAttribute('aria-disabled') === 'false', null, { timeout: tope });
    const version = () => p.evaluate(() => Number(document.querySelector('canvas[aria-label^="Vista previa"]')?.dataset.version ?? 0));
    const ctx = p.context();

    // 1. Respuestas de GeoServer cortadas a la mitad (200 con media imagen).
    let n = 0;
    await ctx.route(/GetMap/, async r => {
      const respuesta = await r.fetch();
      const cuerpo = await respuesta.body();
      await r.fulfill({ response: respuesta, body: ++n % 3 === 0 ? cuerpo.subarray(0, Math.floor(cuerpo.length * 0.4)) : cuerpo });
    });
    await p.keyboard.press('p');
    const alerta = await p.waitForSelector('[role=dialog] [role=alert]', { timeout: 40000 }).then(() => true).catch(() => false);
    anotar('una tesela cortada se avisa como error', alerta);
    anotar('con una tesela cortada no se puede descargar', (await descargar().getAttribute('aria-disabled')) === 'true');
    await ctx.unroute(/GetMap/);
    await ventana.getByRole('button', { name: 'Reintentar' }).click().catch(() => {});
    anotar('Reintentar recupera la hoja', await habilitada().then(() => true).catch(() => false));
    await capturar(p, informe, entorno.salida, 'recuperada');

    // 2. Descargar solo cuando la vista previa ya muestra la hoja nueva.
    const antes = await version();
    await ventana.getByText(/^(Norte|Flecha del norte)$/).click();
    await habilitada();
    anotar('la descarga se habilita después de dibujar la hoja nueva', (await version()) > antes, `versión ${antes} → ${await version()}`);
    await p.keyboard.press('Escape');
    await p.waitForSelector('#imprimir-titulo', { state: 'detached', timeout: 3000 }).catch(() => {});

    // 3. Cercanías caídas en una pregunta: error, no una tabla de filas iguales.
    await ctx.route(/typeNames=tpi:localidades.*BBOX/, r => r.abort());
    const buscador = p.locator('input[aria-label="Buscar"]');
    await buscador.click(); await buscador.fill('escuelas cerca de la ruta 11'); await pausa(1200); await p.keyboard.press('Enter');
    await esperarResultados(p).catch(() => {});
    // Ctrl+P y no "p": el foco sigue en el buscador (una "p" ahí se escribe) y Escape cerraría la respuesta.
    await p.keyboard.press('Control+p');
    const alertaCerc = await p.waitForSelector('[role=dialog] [role=alert]', { timeout: 40000 }).then(() => true).catch(() => false);
    anotar('sin los pueblos cercanos, la pregunta se avisa como error', alertaCerc);
    anotar('sin los pueblos cercanos no se puede descargar', (await descargar().getAttribute('aria-disabled')) === 'true');
    await ctx.unroute(/typeNames=tpi:localidades.*BBOX/);
    // Los pedidos que esta prueba corta a propósito dejan su error en la consola: no cuentan.
    registro.errores.splice(0, Infinity, ...registro.errores.filter(e => !/ERR_FAILED|Failed to load resource/.test(e)));
  }, entorno, combo);
}

// --- Mapas de calor (T3) ---
export function calor(combo, entorno) {
  return envolver('calor', combo, async ({ p, anotar, informe, registro }) => {
    const ctx = p.context();
    const estado = nombre => p.evaluate(n => {
      const v = window.__visor(); const g = v.calor.get(n); const m = g?.get('mancha');
      return { activo: v.calor.has(n), puntos: m?.getSource().getFeatures().length ?? 0, enWms: (v.wms.getSource().get('sld') ?? '').includes(`<Name>${n}<`), visible: v.visibles.has(n), fase: m?.getSource().get('estado')?.fase ?? null };
    }, nombre);
    const conPuntos = n => p.waitForFunction(n => (window.__visor().calor.get(n)?.get('mancha')?.getSource().getFeatures().length ?? 0) > 0, n, { timeout: 30000 }).catch(() => {});
    const ventana = () => p.getByRole('dialog', { name: /Imprimir el mapa|Exportar a PDF/ });

    if (combo.modo === 'pro') {
      await p.getByRole('button', { name: /^Límites y localidades/ }).first().click();
      // El panel se está abriendo (animado): se confirma que el radio quedó elegido, y si no, se vuelve a tocar.
      const radioCalor = p.getByRole('radiogroup', { name: /Ver Localidades como/ }).getByRole('radio', { name: 'Calor' });
      await esperarQuietud(p).catch(() => {});
      await radioCalor.click();
      if (!await p.waitForFunction(() => window.__visor().calor.has('localidades'), null, { timeout: 3000 }).then(() => true).catch(() => false)) await radioCalor.click();
      await conPuntos('localidades'); await esperarMapa(p);
      const e = await estado('localidades');
      anotar('Calor: la mancha de población carga sus puntos por WFS', e.activo && e.puntos > 0, `${e.puntos} localidades`);
      anotar('Calor: el WMS deja de dibujar los puntos', !e.enWms);
      await capturar(p, informe, entorno.salida, 'calor');
      await p.getByRole('radio', { name: /^Leyenda$/ }).first().click().catch(() => p.getByRole('button', { name: /^Leyenda$/ }).first().click());
      const leyenda = await p.waitForFunction(() => /Más habitantes/.test(document.body.innerText), null, { timeout: 5000 }).then(() => true).catch(() => false);
      anotar('la leyenda explica la mancha (menos / más habitantes)', leyenda);
      // La rampa de la leyenda sigue al tema (la del mapa cambia): en oscuro, el extremo alto es claro.
      const rampaLeyenda = () => p.evaluate(() => [...document.querySelectorAll('[aria-hidden=true]')].map(e => e.style.background).find(b => /gradient/.test(b) && /252, 253, 191|59, 15, 112/.test(b)) ?? '');
      const antesTema = await rampaLeyenda();
      const botonTema = p.getByRole('button', { name: /^Tema (claro|oscuro)$/ }).first();
      await botonTema.click(); await esperarMapa(p);
      const despuesTema = await rampaLeyenda();
      const oscuroAhora = await p.evaluate(() => document.documentElement.classList.contains('dark'));
      anotar('la rampa de la leyenda cambia con el tema, como la del mapa', antesTema !== despuesTema && /252, 253, 191/.test(despuesTema) === oscuroAhora, `${oscuroAhora ? 'oscuro' : 'claro'}`);
      await botonTema.click(); await esperarMapa(p);
      // Consulta por punto sobre la mancha, de lejos (z7): encuentra la localidad (la mancha no tiene filtro de escala).
      await p.keyboard.press('2');
      const lugar = [-6737400, -3101000];
      await p.evaluate(c => { const v = window.__visor().mapa.getView(); v.setCenter(c); v.setZoom(7); }, lugar);
      await esperarMapa(p);
      const consulta = await p.evaluate(async c => {
        const v = window.__visor(); const px = v.mapa.getPixelFromCoordinate(c);
        const caja = v.mapa.getTargetElement().getBoundingClientRect();
        return [caja.left + px[0], caja.top + px[1]];
      }, lugar);
      await p.mouse.click(consulta[0], consulta[1]);
      const hallo = await p.waitForFunction(() => /Localidades/.test(document.querySelector('[aria-label*="Información"], aside')?.innerText ?? document.body.innerText) && /Consulta por punto/.test(document.body.innerText), null, { timeout: 15000 }).then(() => true).catch(() => false);
      anotar('consulta por punto sobre la mancha a escala región encuentra localidades', hallo && /entidades? en \d capas?/.test(await p.evaluate(() => document.body.innerText)) && await p.getByText('Localidades', { exact: true }).count() > 0);
      await p.keyboard.press('Escape');
      const v = await axe(p);
      anotar('axe sin violaciones (calor)', v.length === 0, v.join(' · '));

      // Imprimir con la mancha caída: error, sin descarga (la promesa de T2).
      await ctx.route(/typeNames=tpi:localidades.*canthab/, r => r.fulfill({ status: 503, body: 'caido' }));
      await p.keyboard.press('p');
      const alerta = await p.waitForSelector('[role=dialog] [role=alert]', { timeout: 40000 }).then(() => true).catch(() => false);
      anotar('imprimir con la mancha caída da error', alerta);
      anotar('…y no deja descargar', (await ventana().getByRole('button', { name: /Descargar/ }).getAttribute('aria-disabled')) === 'true');
      await p.keyboard.press('Escape');
      await p.waitForSelector('#imprimir-titulo', { state: 'detached', timeout: 3000 }).catch(() => {});

      // Con el WFS rechazado: nada de reintentos en bucle, y un aviso con "Reintentar" sobre el mapa.
      let pedidos = 0;
      p.on('request', r => { if (/typeNames=tpi:localidades.*canthab/.test(decodeURIComponent(r.url()))) pedidos++; });
      // Lejos de lo ya cargado (Tierra del Fuego), para que tenga que pedir.
      await p.evaluate(() => { const v = window.__visor().mapa.getView(); v.setCenter([-7600000, -7300000]); v.setZoom(9); });
      await esperarMapa(p); await pausa(4000);
      anotar('con el WFS caído no se repiten los pedidos', pedidos <= 2, `${pedidos} pedidos en 4 s`);
      anotar('aviso sobre el mapa con "Reintentar"', await p.getByRole('alert').filter({ hasText: /Reintentar|Probar de nuevo/ }).count() > 0);
      await ctx.unroute(/typeNames=tpi:localidades.*canthab/);
      // Los 503 son los que fingió la prueba.
      registro.errores.splice(0, Infinity, ...registro.errores.filter(e => !/503|Failed to load resource/.test(e)));
      registro.fallas.splice(0, Infinity, ...registro.fallas.filter(e => !/^503 .*typeNames=tpi:localidades/.test(e)));

      // Demasiados puntos (Otras edificaciones: 96.056) a escala país: sin mancha parcial, se pide acercarse.
      await p.evaluate(() => window.__visor().mapa.getView().setResolution(9000));
      await esperarMapa(p);
      await p.getByRole('button', { name: /^Edificaciones/ }).first().click().catch(() => {});
      await p.locator('label').filter({ hasText: /^Otras edificaciones/ }).first().click({ timeout: 5000 }).catch(() => {});
      const otras = p.getByRole('radiogroup', { name: /Ver Otras edificaciones como/ });
      if (await otras.count()) {
        await otras.getByRole('radio', { name: 'Calor' }).click();
        await p.waitForFunction(() => window.__visor().calor.get('otras_edificaciones')?.get('mancha')?.getSource().get('estado')?.fase === 'demasiados', null, { timeout: 30000 }).catch(() => {});
        const o = await estado('otras_edificaciones');
        anotar('Calor con demasiados puntos: mancha vacía, nunca parcial', o.fase === 'demasiados' && o.puntos === 0, `fase ${o.fase} · ${o.puntos} puntos`);
        anotar('…y un aviso con "Acercar"', await p.getByRole('alert').filter({ hasText: /Acercar/ }).count() > 0);
        await capturar(p, informe, entorno.salida, 'calor-demasiados');
        await otras.getByRole('radio', { name: 'Puntos' }).click();
      } else { await capturar(p, informe, entorno.salida, 'calor-sin-selector'); anotar('selector de calor para Otras edificaciones', false, 'no se encontró el radiogroup'); }
      await p.getByRole('radiogroup', { name: /Ver Localidades como/ }).getByRole('radio', { name: 'Puntos' }).click();
      await esperarMapa(p);
      const f = await estado('localidades');
      anotar('Puntos: vuelve a dibujarse con el WMS', !f.activo && f.enWms && f.visible);
    } else {
      const tarjeta = p.getByRole('button', { name: /^¿Dónde vive la gente/ });
      const antes = await estado('localidades');
      await tarjeta.click();
      await conPuntos('localidades'); await esperarMapa(p);
      const e = await estado('localidades');
      anotar('"¿Dónde vive la gente?" muestra la mancha de población', e.activo && e.puntos > 0 && (await tarjeta.getAttribute('aria-pressed')) === 'true', `${e.puntos} localidades`);
      await capturar(p, informe, entorno.salida, 'donde-vive');
      await tarjeta.click(); await esperarMapa(p);
      const f = await estado('localidades');
      anotar('al tocarla de nuevo vuelve a como estaba', !f.activo && f.visible === antes.visible && f.enWms === antes.enWms);
      // Densidad: escuelas como manchas.
      await p.getByRole('button', { name: /^Escuelas, salud y más/ }).click();
      const escuelas = p.locator('[data-guia=temas] li').filter({ hasText: /^Escuelas/ }).first();
      await escuelas.getByRole('button').first().click();
      await escuelas.getByRole('button', { name: /Ver como manchas/ }).click();
      await conPuntos('edif_educacion'); await esperarMapa(p);
      const d = await estado('edif_educacion');
      anotar('"Ver como manchas" muestra la densidad de escuelas', d.activo && d.puntos > 0, `${d.puntos} escuelas`);
      anotar('la leyenda de la densidad dice pocos / muchos', /Muchos/.test(await p.evaluate(() => document.body.innerText)));
      // La intensidad no depende de cómo se llegó: el peso es el mismo al volver de más lejos.
      const pesoEscuelas = () => p.evaluate(() => window.__visor().calor.get('edif_educacion')?.get('mancha')?.styleVariables_?.densidad);
      const vista = await p.evaluate(() => { const v = window.__visor().mapa.getView(); return [v.getCenter(), v.getZoom()]; });
      const peso0 = await pesoEscuelas();
      await p.evaluate(() => { const v = window.__visor().mapa.getView(); v.setZoom(v.getZoom() - 2); }); await esperarMapa(p);
      const pesoLejos = await pesoEscuelas();
      await p.evaluate(([c, z]) => { const v = window.__visor().mapa.getView(); v.setCenter(c); v.setZoom(z); }, vista); await esperarMapa(p);
      await p.waitForFunction(w => window.__visor().calor.get('edif_educacion')?.get('mancha')?.styleVariables_?.densidad === w, peso0, { timeout: 5000 }).catch(() => {});
      const peso1 = await pesoEscuelas();
      anotar('la densidad pesa según lo que se ve, no según el camino', peso0 === peso1 && pesoLejos < peso0, `${peso0?.toFixed(3)} → ${pesoLejos?.toFixed(3)} → ${peso1?.toFixed(3)}`);
      await capturar(p, informe, entorno.salida, 'manchas-escuelas');
      const v = await axe(p);
      anotar('axe sin violaciones (manchas)', v.length === 0, v.join(' · '));
    }
  }, entorno, combo);
}

// --- Tabla de datos (T4, modo profesional) ---
// Los números se comparan con pedidos WFS hechos aparte (el mismo GeoServer), no con valores fijos.
export function tabla(combo, entorno) {
  return envolver('tabla', combo, async ({ p, anotar, informe }) => {
    const tablaSel = 'section[aria-label^="Tabla de datos:"]';
    const pie = () => p.locator(`${tablaSel} footer [role=status]`).innerText();
    const filas = () => p.locator(`${tablaSel} [role=row]`);
    const contar = cql => p.evaluate(async cql => {
      const r = await fetch(`/geoserver/tpi/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=tpi:localidades&resultType=hits${cql ? `&CQL_FILTER=${encodeURIComponent(cql)}` : ''}`);
      return Number((await r.text()).match(/numberMatched="(\d+)"/)?.[1]);
    }, cql);
    const esperarPie = re => p.waitForFunction(([s, re]) => new RegExp(re).test(document.querySelector(`${s} footer [role=status]`)?.textContent ?? ''), [tablaSel, re], { timeout: 15000 }).then(() => true).catch(() => false);
    const n = v => v.toLocaleString('es-AR');

    await p.keyboard.press('t');
    await p.waitForSelector(tablaSel, { timeout: 8000 });
    await p.getByRole('tab', { name: /^Localidades/ }).click();
    const total = await contar('');
    anotar('T abre la tabla y cuenta todas las localidades', await esperarPie(`de ${n(total)}$`), await pie());
    const margen = await p.evaluate(s => {
      const t = document.querySelector(s).getBoundingClientRect(); const z = document.querySelector('[aria-label="Acercar"]')?.getBoundingClientRect();
      return { arriba: t.top, zoom: z ? z.bottom : 0 };
    }, tablaSel);
    anotar('los botones de zoom suben sobre la tabla', margen.zoom > 0 && margen.zoom <= margen.arriba, `zoom ${Math.round(margen.zoom)} · tabla ${Math.round(margen.arriba)}`);
    await capturar(p, informe, entorno.salida, 'abierta');
    let v = await axe(p);
    anotar('axe sin violaciones (tabla)', v.length === 0, v.join(' · '));

    // Buscar: sin tildes ni mayúsculas.
    await p.getByLabel(/^Buscar en Localidades/).fill('resisténcia');
    const buscadas = await contar("strStripAccents(nombre) ILIKE '%resistencia%' OR strStripAccents(tipo) ILIKE '%resistencia%' OR strStripAccents(departamen) ILIKE '%resistencia%' OR strStripAccents(provincia) ILIKE '%resistencia%'");
    anotar('buscar «resisténcia» encuentra las Resistencia', await esperarPie(`de ${n(buscadas)} filtradas`) && /Resistencia/.test(await filas().nth(1).innerText()), await pie());
    await p.getByLabel(/^Buscar en Localidades/).fill('');

    // Filtro por columna + orden.
    await p.getByRole('button', { name: /^Filtrar/ }).click();
    const form = p.locator('form[aria-label="Nuevo filtro"]');
    await form.locator('select').first().selectOption('canthab');
    await form.locator('select').nth(1).selectOption('mayor');
    await form.locator('input').fill('100.000');
    await form.getByRole('button', { name: /Agregar filtro/ }).click();
    const grandes = await contar('canthab > 100000');
    anotar('filtro «Habitantes mayor que 100.000»', await esperarPie(`de ${n(grandes)} filtradas`), await pie());
    v = await axe(p);
    anotar('axe sin violaciones (con un filtro)', v.length === 0, v.join(' · '));
    await capturar(p, informe, entorno.salida, 'filtro');
    const encabezado = p.getByRole('columnheader', { name: /Habitantes/ });
    await encabezado.click(); await esperarPie('filtradas');
    await encabezado.click();
    await p.waitForFunction(s => document.querySelector(`${s} [role=columnheader][aria-sort="descending"]`), tablaSel, { timeout: 8000 }).catch(() => {});
    await p.waitForFunction(s => /1\.267\.521|\d{1,3}\.\d{3}\.\d{3}/.test(document.querySelectorAll(`${s} [role=row]`)[1]?.textContent ?? ''), tablaSel, { timeout: 8000 }).catch(() => {});
    const mayor = await p.evaluate(async () => {
      const r = await fetch('/geoserver/tpi/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=tpi:localidades&outputFormat=application/json&count=1&sortBy=canthab+D&propertyName=nombre,canthab');
      return (await r.json()).features[0].properties;
    });
    anotar('ordenar por habitantes (de mayor a menor)', (await filas().nth(1).innerText()).includes(n(mayor.canthab)), `${mayor.nombre} ${n(mayor.canthab)}`);
    if (grandes > 50) {
      await p.getByRole('button', { name: 'Página siguiente' }).click();
      anotar('página siguiente', await esperarPie(`^51–${n(Math.min(100, grandes))} de`), await pie());
      await p.getByRole('button', { name: 'Página anterior' }).click(); await esperarPie('^1–');
    }

    // Exportar lo filtrado a CSV.
    const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: /a CSV$/ }).click()]);
    const csv = await descarga.createReadStream().then(s => new Promise(r => { let t = ''; s.on('data', d => { t += d; }); s.on('end', () => r(t)); }));
    const lineas = csv.trim().split('\n');
    anotar('exportar a CSV: todo lo filtrado, con geometría', lineas.length - 1 === grandes && /geom/.test(lineas[0]) && /POINT/.test(lineas[1]), `${lineas.length - 1} filas · ${descarga.suggestedFilename()}`);

    // Ir a la entidad, con el teclado: la fila con foco y Enter.
    await filas().nth(1).focus();
    await p.keyboard.press('Enter');
    const fue = await p.waitForFunction(() => /desde la tabla/.test(document.body.innerText) && window.__visor().foco.getFeatures().length === 1, null, { timeout: 15000 }).then(() => true).catch(() => false);
    await esperarMapa(p);
    const ubicacion = await p.evaluate(s => {
      const v = window.__visor(); const f = v.foco.getFeatures()[0];
      const px = v.mapa.getPixelFromCoordinate(f.getGeometry().getFirstCoordinate());
      const caja = v.mapa.getTargetElement().getBoundingClientRect();
      return { y: caja.top + px[1], x: caja.left + px[0], arriba: document.querySelector(s).getBoundingClientRect().top };
    }, tablaSel);
    anotar('Enter en una fila: va a la entidad y la muestra en el inspector', fue);
    anotar('…y queda a la vista, arriba de la tabla', ubicacion.y > 80 && ubicacion.y < ubicacion.arriba, `y ${Math.round(ubicacion.y)} · tabla ${Math.round(ubicacion.arriba)}`);
    await capturar(p, informe, entorno.salida, 'ir-a');

    // Obras: editar y borrar por WFS-T (con --con-alta o en nivel completo).
    if (entorno.conAlta) {
      const marca = `verificar-tabla ${informe.combo} ${Date.now()}`;
      const ins = await p.evaluate(async marca => {
        const xml = '<wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:tpi="https://github.com/matiasgzlez/TPI-GIS">'
          + `<wfs:Insert><tpi:obras_rn11><tpi:tipo_obra>bacheo</tpi:tipo_obra><tpi:prioridad>baja</tpi:prioridad><tpi:estado>relevado</tpi:estado><tpi:descripcion>${marca}</tpi:descripcion><tpi:geom><gml:Point srsName="EPSG:4326"><gml:pos>-27.2 -59.4</gml:pos></gml:Point></tpi:geom></tpi:obras_rn11></wfs:Insert></wfs:Transaction>`;
        const r = await fetch('/wfst', { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml });
        return (await r.text()).match(/totalInserted>(\d+)/)?.[1];
      }, marca);
      await p.getByRole('tab', { name: /^Obras de mantenimiento/ }).click();
      await p.getByLabel(/^Buscar en Obras/).fill(marca);
      await esperarPie('de 1 filtradas');
      await filas().nth(1).click();
      const editor = p.locator('form[aria-label^="Editar la obra"]');
      await editor.getByRole('radio', { name: /Alta/ }).or(editor.getByRole('button', { name: /^Alta$/ })).first().click();
      await editor.getByRole('button', { name: 'Guardar cambios' }).click();
      const editada = await p.waitForFunction(s => /Alta/.test(document.querySelectorAll(`${s} [role=row]`)[1]?.textContent ?? ''), tablaSel, { timeout: 10000 }).then(() => true).catch(() => false);
      anotar('editar una obra desde la tabla (WFS-T)', ins === '1' && editada);
      await editor.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
      v = await axe(p);
      anotar('axe sin violaciones (tabla de obras)', v.length === 0, v.join(' · '));
      await filas().nth(1).click();
      await p.getByRole('button', { name: 'Borrar la obra' }).click();
      await p.getByRole('button', { name: 'Sí, borrar' }).click();
      anotar('borrar una obra desde la tabla (WFS-T)', await esperarPie('^0 entidades'), await pie());
    }

    // Con el foco adentro (en la pestaña), T la cierra y el foco vuelve al botón de la tabla.
    await p.locator(`${tablaSel} [role=tab][aria-selected=true]`).focus();
    await p.keyboard.press('t');
    anotar('T cierra la tabla', await p.waitForSelector(tablaSel, { state: 'detached', timeout: 4000 }).then(() => true).catch(() => false));
    await esperarFoco(p);
    anotar('…y el foco vuelve al botón de la tabla', await p.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Tabla de datos (T)');
  }, entorno, combo);
}

// --- Animación de distancia (T5) ---
// La franja crece de 0 a 20 km sobre el tablero de la RN11: a 10 y a 20 km, los mismos números de
// referencia del tablero (PostGIS geodésico).
export function distancia(combo, entorno) {
  return envolver('distancia', combo, async ({ p, anotar, informe }) => {
    const simple = combo.modo === 'simple';
    await p.getByRole('button', { name: /Ver RN11|Ver la ruta 11/ }).first().click();
    await p.waitForFunction(() => /Localidades, de la más|Pueblos, del más/.test(document.body.innerText), null, { timeout: 30000 });
    await esperarMapa(p);
    await p.getByRole('button', { name: /Animar la distancia|Ver crecer la franja/ }).click();
    const panel = p.locator('.crecer-franja');
    await panel.waitFor({ timeout: 5000 });
    const contador = () => panel.locator('.contador-franja').innerText();
    // Arranca en 0 y crece.
    await pausa(1200);
    const temprano = await p.locator('.crecer-franja input[type=range]').inputValue();
    anotar('la franja arranca en 0 y crece', Number(temprano) > 0 && Number(temprano) < 20000, `${temprano} m a los 1,2 s`);
    await capturar(p, informe, entorno.salida, 'creciendo');
    const llego = await p.waitForFunction(() => /A 20 km/.test(document.querySelector('.crecer-franja')?.textContent ?? ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
    const [h10, hab10] = REFERENCIA_RN11.hasta10; const [h20, hab20] = REFERENCIA_RN11.de10a20;
    const totalLoc = String(Number(h10) + Number(h20));
    const totalHab = (Number(hab10.replace(/\./g, '')) + Number(hab20.replace(/\./g, ''))).toLocaleString('es-AR');
    const final = await contador();
    anotar(`a 20 km: ${totalLoc} ${simple ? 'pueblos' : 'localidades'} y ${totalHab} hab., como el tablero`, llego && final.includes(totalLoc) && final.includes(totalHab) && final.includes(hab10) && final.includes(hab20), final.replace(/\n/g, ' '));
    await esperarMapa(p);
    await capturar(p, informe, entorno.salida, 'final');
    // A 10 km con el deslizador (flechas: medio km por paso).
    const deslizador = p.locator('.crecer-franja input[type=range]');
    await deslizador.focus();
    for (let i = 0; i < 20; i++) await p.keyboard.press('ArrowLeft');
    const texto = await deslizador.getAttribute('aria-valuetext');
    anotar(`a 10 km con las flechas: ${h10} y ${hab10}`, /^10,0 km/.test(texto) && texto.includes(` ${h10} `) && texto.includes(hab10), texto);
    const v = await axe(p);
    anotar('axe sin violaciones (animación de distancia)', v.length === 0, v.join(' · '));
    // La traza queda entera a la vista, debajo del panel.
    const visible = await p.evaluate(() => {
      const v = window.__visor(); const e = v.ruta.getSource().getExtent();
      const arriba = v.mapa.getPixelFromCoordinate([e[0], e[3]])[1] + v.mapa.getTargetElement().getBoundingClientRect().top;
      return { arriba, panel: document.querySelector('.crecer-franja').getBoundingClientRect().bottom };
    });
    anotar('la traza queda debajo del panel', visible.arriba >= visible.panel - 4, `traza desde ${Math.round(visible.arriba)} · panel hasta ${Math.round(visible.panel)}`);
    await p.keyboard.press('Escape');
    anotar('Esc cierra la animación', await panel.waitFor({ state: 'detached', timeout: 3000 }).then(() => true).catch(() => false));
  }, entorno, combo);
}
