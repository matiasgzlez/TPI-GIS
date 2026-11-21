import fs from 'node:fs';
import { lanzar, abrir, esperarQuietud, pausa, pixel, esperarResultados } from './lib.mjs';
const S='/private/tmp/claude-501/-Users-matiasgonzalez-repos-TPI-GIS/b2a28479-eeeb-4e81-998d-f5325f5e51f6/scratchpad/ronda4/';
const nav = await lanzar();
for (const [w,h,tema] of [[1366,768,'claro'],[1536,864,'oscuro'],[2560,1440,'claro'],[2560,1440,'oscuro']]) {
 for (let rep=0; rep<2; rep++) {
  const { p, ctx, registro } = await abrir(nav, { url: 'http://localhost:8081/', w, h, modo: 'simple', tema });
  await esperarQuietud(p);
  await p.keyboard.press('2');
  const [x, y] = await pixel(p, -60.44 + rep*0.3, -26.79);
  await p.mouse.click(x, y);
  await esperarResultados(p).catch(() => {}); await esperarQuietud(p); await pausa(300);
  const estadoAbierto = await p.evaluate(() => { return !!document.querySelector('.notch-contenedor:not(.notch-resultados) .notch-pastilla[aria-label=Ajustes]'); });
  // muestreo rAF
  await p.evaluate(() => { window.__m=[]; const t0=performance.now(); const f=()=>{ const der=document.querySelector('.notch-contenedor:not(.notch-resultados)[data-lado="derecha"] .notch-pastilla'); const izq=document.querySelector('.notch-contenedor[data-lado="izquierda"] .notch-pastilla'); if (der && izq) { const a=der.getBoundingClientRect(), b=izq.getBoundingClientRect(); const cont=der.closest('.notch-contenedor'); const notch=der.closest('.notch'); const cs=getComputedStyle(notch); window.__m.push([Math.round(performance.now()-t0), +(a.top+a.height/2 - (b.top+b.height/2)).toFixed(1), Math.round(a.height), getComputedStyle(cont).opacity, cs.clipPath.slice(0,60), getComputedStyle(der).opacity, Math.round(a.width)]); } else window.__m.push([Math.round(performance.now()-t0), der?'der':'-', izq?'izq':'-']); if (performance.now()-t0<2200) requestAnimationFrame(f); }; window.__arranque=()=>requestAnimationFrame(f); });
  const cdp = await ctx.newCDPSession(p);
  let t0 = 0; const marcos = [];
  cdp.on('Page.screencastFrame', async f => { if (t0) marcos.push([Date.now() - t0, f.data]); await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  if (rep===0) { await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 }); await pausa(200); }
  await p.evaluate(() => window.__arranque());
  t0 = Date.now();
  await p.click('[aria-label="Cerrar resultados"]');
  await pausa(2300);
  if (rep===0) await cdp.send('Page.stopScreencast');
  const m = await p.evaluate(() => window.__m);
  const visibles = m.filter(r => typeof r[1]==='number');
  const desv = visibles.map(r=>Math.abs(r[1]));
  console.log(w,h,tema,'rep',rep,'abierto',JSON.stringify(estadoAbierto),'muestras',m.length,'max|dy|',Math.max(...desv));
  // imprimir los primeros 25 cuadros compactos
  const i0=m.findIndex(r=>typeof r[1]==='number'); console.log('   aparece en', m[i0]?.[0], 'ms'); for (const r of m.slice(i0,i0+8)) console.log('    ', JSON.stringify(r)); console.log('     ultimo', JSON.stringify(m.at(-1)));
  if (rep===0) { const d=S+`p1-${w}-${tema}/`; fs.mkdirSync(d,{recursive:true}); for (const [t, dd] of marcos.slice(0,30)) fs.writeFileSync(d+`${String(t).padStart(4,'0')}.png`, Buffer.from(dd,'base64')); }
  if (registro.errores.length) console.log('  errores', registro.errores);
  await ctx.close();
 }
}
await nav.close();
