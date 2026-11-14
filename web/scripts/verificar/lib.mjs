// Herramientas comunes de la batería de verificación: abrir el visor con una preferencia ya elegida,
// esperar por condición (nunca con pausas fijas largas) y juntar consola, red y fallas de cada página.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
export const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

// Chromium: TPI_CHROMIUM si está; si no, el de playwright-core; si no, el headless shell más nuevo
// descargado en la caché de Playwright (macOS y Linux).
function buscarChromium() {
  if (process.env.TPI_CHROMIUM) return process.env.TPI_CHROMIUM;
  const propio = chromium.executablePath();
  if (fs.existsSync(propio)) return propio;
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH
    ?? (process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Caches/ms-playwright') : path.join(os.homedir(), '.cache/ms-playwright'));
  const carpetas = fs.existsSync(cache) ? fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse() : [];
  for (const c of carpetas) {
    for (const sub of fs.readdirSync(path.join(cache, c))) {
      const exe = path.join(cache, c, sub, 'chrome-headless-shell');
      if (fs.existsSync(exe)) return exe;
    }
  }
  throw new Error('No encontré Chromium: instalalo con "npx playwright-core install chromium-headless-shell" o pasá TPI_CHROMIUM.');
}

export const lanzar = () => chromium.launch({ executablePath: buscarChromium() });

// Encuentra el estado del visor recorriendo el árbol de React (sirve en dev y en el build).
const VISOR_JS = `window.__visor = () => { if (window.__v) return window.__v; const root=document.getElementById('root'); const k=Object.keys(root).find(k=>k.startsWith('__reactContainer')); const st=[root[k]]; let n=0; while(st.length && n<300000){ const f=st.pop(); n++; if(!f) continue; let h=f.memoizedState; let g=0; while(h && typeof h==='object' && g<80){ const s=h.memoizedState; if(s && s.mapa && s.dibujo && s.mapa.getView){ window.__v=s; return s; } h=h.next; g++; } if(f.child) st.push(f.child); if(f.sibling) st.push(f.sibling);} return null; };`;

// Abre una página en un contexto nuevo. `modo` null deja la bienvenida a la vista.
export async function abrir(navegador, { url, w, h, modo = 'simple', tema = 'claro', guiaVista = true, sinCache = false }) {
  const ctx = await navegador.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([m, t, g]) => {
    if (sessionStorage.getItem('verificar')) return;
    localStorage.clear();
    if (m) localStorage.setItem('visor-preferencias', JSON.stringify({ interfaz: m, guiaVista: g }));
    localStorage.setItem('tema', t);
    sessionStorage.setItem('verificar', '1');
  }, [modo, tema, guiaVista]);
  await ctx.addInitScript(() => {
    window.__lcp = 0;
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
  });
  await ctx.addInitScript(VISOR_JS);
  const p = await ctx.newPage();
  const registro = { errores: [], externos: [], fallas: [] };
  p.on('pageerror', e => registro.errores.push('pageerror ' + String(e).slice(0, 200)));
  p.on('console', m => (m.type() === 'error' || m.type() === 'warning') && registro.errores.push(`${m.type()} ${m.text().slice(0, 200)}`));
  p.on('request', r => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname) && !/^(data|blob):/.test(u.protocol)) registro.externos.push(r.url()); });
  p.on('response', r => { if (r.status() >= 400) registro.fallas.push(`${r.status()} ${r.url().slice(0, 140)}`); });
  let cdp;
  if (sinCache) {
    // Medición de carga: sin caché del navegador, con pedidos, bytes transferidos y bytes de JS.
    cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    registro.red = { pedidos: 0, bytes: 0, js: 0 };
    const tipos = new Map();
    cdp.on('Network.requestWillBeSent', () => registro.red.pedidos++);
    cdp.on('Network.responseReceived', e => tipos.set(e.requestId, e.type));
    cdp.on('Network.loadingFinished', e => {
      registro.red.bytes += e.encodedDataLength;
      if (tipos.get(e.requestId) === 'Script') registro.red.js += e.encodedDataLength;
    });
  }
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  if (modo) await esperarMapa(p);
  else await p.waitForSelector('#bienvenida-titulo', { timeout: 20000 });
  return { ctx, p, registro, cdp };
}

// El mapa está listo cuando existe el visor, terminó la animación de entrada y se dibujaron todas
// las teselas (rendercomplete de OpenLayers).
export async function esperarMapa(p, tope = 25000) {
  await p.waitForFunction(() => window.__visor && window.__visor(), null, { timeout: tope });
  // El vuelo de entrada arranca ~0,6 s después de cargar: hay que esperar a que termine (App.tsx marca
  // data-entrada="lista" en <html>), no solo a que no haya animación en ese instante.
  await p.waitForFunction(() => document.documentElement.dataset.entrada === 'lista', null, { timeout: tope }).catch(() => {});
  await p.evaluate(tope => new Promise(listo => {
    const v = window.__visor();
    const fin = setTimeout(listo, tope);
    const probar = () => {
      if (v.mapa.getView().getAnimating()) return setTimeout(probar, 100);
      v.mapa.once('rendercomplete', () => { clearTimeout(fin); listo(); });
      v.mapa.render();
    };
    probar();
  }), tope);
}

// Espera a que no haya animaciones CSS ni de motion corriendo en la interfaz (paneles que entran o salen).
export const esperarQuietud = (p, tope = 3000) => p.waitForFunction(
  () => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).length === 0,
  null, { timeout: tope },
).catch(() => {});

export const pausa = ms => new Promise(r => setTimeout(r, ms));

// Píxel de pantalla de una coordenada lon/lat.
export const pixel = (p, lon, lat) => p.evaluate(([lon, lat]) => {
  const c = [lon * 20037508.34 / 180, Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 6378137];
  const v = window.__visor();
  const r = v.mapa.getViewport().getBoundingClientRect();
  const q = v.mapa.getPixelFromCoordinate(c);
  return [Math.round(q[0] + r.left), Math.round(q[1] + r.top)];
}, [lon, lat]);

export const centrar = (p, lon, lat, zoom) => p.evaluate(([lon, lat, zoom]) => {
  const c = [lon * 20037508.34 / 180, Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 6378137];
  window.__visor().mapa.getView().animate({ center: c, zoom, duration: 0 });
}, [lon, lat, zoom]).then(() => esperarMapa(p));

// Foco actual, legible.
export const foco = p => p.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return 'BODY';
  return (a.getAttribute('aria-label') || a.innerText || a.tagName).split('\n')[0].trim().slice(0, 50);
});

export const hayResultados = p => p.evaluate(() => !!document.querySelector('[aria-label="Cerrar resultados"]'));

// Espera la respuesta de una consulta: el panel de resultados con su subtítulo ya resuelto.
export const esperarResultados = (p, tope = 20000) => p.waitForFunction(() => {
  const b = document.querySelector('[aria-label="Cerrar resultados"]');
  const s = b?.closest('section');
  const sub = s?.querySelector('header p')?.textContent ?? '';
  return !!s && /\d|no hay|ningun|nada|medido|geodésica|midiendo/i.test(sub) && !/buscando|consultando/i.test(sub);
}, null, { timeout: tope });

export async function axe(p, excluir = [['.ol-layers']]) {
  // Con transiciones de color o de opacidad en curso, axe mide colores intermedios (falsos contrastes).
  await esperarQuietud(p);
  await p.addScriptTag({ content: AXE }).catch(() => {});
  return p.evaluate(async excluir => {
    const r = await window.axe.run({ exclude: excluir }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    return r.violations.map(v => `${v.id} (${v.impact}, ${v.nodes.length}): ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ').slice(0, 160)}`);
  }, excluir);
}

// Pool simple: corre `tareas` (funciones async) con `n` a la vez.
export async function enParalelo(tareas, n) {
  const resultados = new Array(tareas.length);
  let siguiente = 0;
  await Promise.all(Array.from({ length: Math.min(n, tareas.length) }, async () => {
    while (siguiente < tareas.length) {
      const i = siguiente++;
      resultados[i] = await tareas[i]();
    }
  }));
  return resultados;
}
