import { lanzar, abrir, esperarQuietud, pausa, pixel, centrar, esperarResultados, esperarMapa, axe } from './lib.mjs';
const S = '/private/tmp/claude-501/-Users-matiasgonzalez-repos-TPI-GIS/b2a28479-eeeb-4e81-998d-f5325f5e51f6/scratchpad/pro-v1/';
const RES = [-58.986, -27.452];
const [w, h, tema] = process.argv.slice(2).map((x, i) => i < 2 ? +x : x);
const b = await lanzar();
const { p, ctx, registro } = await abrir(b, { url: 'http://localhost:8081/', w, h, modo: 'pro', tema });
const foto = async n => { await esperarQuietud(p); await pausa(250); await p.screenshot({ path: `${S}${w}-${tema}-${n}.png` }); };
const out = {};
await foto('00-inicio');
// medidas
out.medidas = await p.evaluate(() => {
  const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  const f = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontSize : null; };
  const chips = document.querySelector('.chips-fila');
  return { riel: r('.riel-pro'), buscador: r('.buscador-pro'), chips: r('.chips-pro'), chipsScroll: chips && [chips.scrollWidth, chips.clientWidth], mini: r('.minimapa-pro'), zoom: r('.controles-pro'), estado: r('.estado-pro'), fEstado: f('.estado-tecnico'), interruptor: [...document.querySelectorAll('[role=switch],[aria-label*="modo" i],[aria-label*="Simple" i]')].map(e => (e.getAttribute('aria-label')||e.textContent).slice(0,40)+' '+JSON.stringify(e.getBoundingClientRect().toJSON?.()||{})).slice(0,3), estadoTxt: document.querySelector('.estado-tecnico')?.innerText.replace(/\s+/g,' ') };
});
await p.mouse.move(w * 0.55, h * 0.5); await pausa(200);
out.estadoCursor = await p.evaluate(() => document.querySelector('.estado-tecnico')?.innerText.replace(/\s+/g, ' '));
// capas
await p.getByRole('button', { name: 'Capas', exact: true }).click(); await foto('01-capas');
out.cajonCapas = await p.evaluate(() => { const e = document.querySelector('#cajon-pro'); const b = e.getBoundingClientRect(); return [b.x, b.width, document.querySelector('.buscador-pro').getBoundingClientRect().x]; });
await p.getByRole('button', { name: 'Leyenda', exact: true }).click(); await foto('02-leyenda');
await p.getByRole('button', { name: 'Leyenda', exact: true }).click(); await esperarQuietud(p);
// punto
await centrar(p, ...RES, 11);
await p.keyboard.press('2');
const [x, y] = await pixel(p, ...RES);
await p.mouse.click(x, y); await esperarResultados(p).catch(() => {}); await foto('03-punto');
out.punto = await p.evaluate(() => document.querySelector('[aria-label="Cerrar resultados"]')?.closest('section')?.innerText.slice(0, 300));
await p.keyboard.press('3');
await p.mouse.move(x - 120, y - 90); await p.mouse.down(); await p.mouse.move(x + 120, y + 90, { steps: 10 }); await p.mouse.up();
await pausa(400); await esperarResultados(p).catch(() => {}); await foto('04-rect');
out.rect = await p.evaluate(() => document.querySelector('[aria-label="Cerrar resultados"]')?.closest('section')?.innerText.slice(0, 300));
await p.keyboard.press('Escape'); await p.keyboard.press('4');
await p.mouse.click(x - 150, y); await pausa(250); await p.mouse.dblclick(x + 150, y + 40); await pausa(800); await foto('05-medir');
await p.keyboard.press('Escape'); await p.keyboard.press('t'); await pausa(2500); await foto('06-tabla');
out.tabla = await p.evaluate(() => ({ mini: document.querySelector('.minimapa-pro')?.getBoundingClientRect().bottom, zoom: document.querySelector('.controles-pro')?.getBoundingClientRect().bottom, tablaTop: document.querySelector('[aria-label*="tabla" i], .tabla-datos')?.getBoundingClientRect().top }));
await p.keyboard.press('t'); await pausa(800);
await p.keyboard.press('c'); await pausa(2000); await foto('07-comparar');
await p.keyboard.press('c'); await pausa(800);
await p.keyboard.press('6'); await pausa(400); await foto('08-alta-ayuda');
await p.mouse.click(x + 5, y + 5); await pausa(1200); await foto('09-alta-form');
await p.keyboard.press('Escape'); await pausa(500); await p.keyboard.press('1');
await p.keyboard.press('p'); await pausa(3000); await foto('10-exportar');
await p.keyboard.press('Escape'); await pausa(800);
await p.keyboard.press('/'); await p.keyboard.type('resis'); await pausa(1500); await foto('11-buscar');
await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
await p.keyboard.type('zzzxq'); 
await p.keyboard.press('/'); await p.keyboard.press('ControlOrMeta+a'); await p.keyboard.type('zzqxw'); await pausa(1500); await foto('12-buscar-vacio');
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.mouse.click(w*0.6,h*0.5);
// foco
await p.locator('body').focus();
const focos = [];
for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); focos.push(await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return (a.getAttribute('aria-label') || a.innerText || a.tagName).split('\n')[0].slice(0, 30) + ` [${cs.outlineStyle} ${cs.outlineWidth} ${cs.boxShadow !== 'none' ? 'sh' : ''}]`; })); if (i === 5) await foto('13-foco'); }
out.focos = focos;
out.axe = await axe(p);
out.errores = registro.errores; out.fallas = registro.fallas;
console.log(JSON.stringify(out, null, 1));
await ctx.close(); await b.close();
