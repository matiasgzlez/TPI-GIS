// Batería de verificación del visor (consignas, tablero, teclado, accesibilidad y rendimiento).
// La usan los revisores independientes como red de regresión: corre lo repetitivo en paralelo y deja
// un informe; el revisor dedica su tiempo a atacar lo que se corrigió.
//
//   npm run verificar                         nivel rápido (verificación de una corrección), ~3–5 min
//   npm run verificar -- --nivel completo     cierre de ticket: la matriz entera y el alta por WFS-T
//   opciones: --salida DIR · --url URL · --sin-build · --con-alta · --solo vista,tablero,consignas,teclado,exportar,integridad,calor,tabla,distancia,rendimiento · --paralelo N
//
// Por defecto mide el build servido por nginx (http://localhost:8081, `docker compose up -d`), que es lo
// que se presenta: carga más rápido que el servidor de desarrollo y tiene el proxy de WFS-T.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enParalelo, lanzar } from './lib.mjs';
import { calor, consignas, distancia, tabla, exportar, exportarIntegridad, rendimiento, tablero, teclado, vista } from './pruebas.mjs';

const args = process.argv.slice(2);
const opcion = (nombre, defecto) => { const i = args.indexOf(`--${nombre}`); return i >= 0 ? args[i + 1] : defecto; };
const bandera = nombre => args.includes(`--${nombre}`);

const nivel = opcion('nivel', 'rapido');
if (!['rapido', 'completo'].includes(nivel)) throw new Error('--nivel tiene que ser "rapido" o "completo"');
const url = opcion('url', 'http://localhost:8081/');
const salida = path.resolve(opcion('salida', path.join(os.tmpdir(), `verificar-${new Date().toISOString().replace(/[:.]/g, '-')}`)));
const paralelo = Number(opcion('paralelo', '4'));
const solo = opcion('solo', '')?.split(',').filter(Boolean);
const conAlta = bandera('con-alta') || nivel === 'completo';
fs.mkdirSync(salida, { recursive: true });

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (!bandera('sin-build')) {
  console.log('Build de producción (npm run build)…');
  execSync('npm run build', { cwd: web, stdio: ['ignore', 'ignore', 'inherit'] });
}
try {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
} catch (e) {
  console.error(`No responde ${url} (${e.message}). Levantá el entorno: docker compose up -d (o pasá --url).`);
  process.exit(2);
}

// --- Combinaciones ---
const TAMANOS = [[1366, 768], [1536, 864], [2560, 1440]];
const todas = ['simple', 'pro'].flatMap(modo => ['claro', 'oscuro'].flatMap(tema => TAMANOS.map(([w, h]) => ({ modo, tema, w, h }))));
const elegir = lista => lista.map(([modo, w, h, tema]) => ({ modo, w, h, tema }));
const PLAN = nivel === 'completo'
  ? {
    vista: todas,
    tablero: todas,
    consignas: elegir([['simple', 1366, 768, 'claro'], ['simple', 1536, 864, 'oscuro'], ['simple', 2560, 1440, 'oscuro'], ['pro', 1366, 768, 'oscuro'], ['pro', 1536, 864, 'claro'], ['pro', 2560, 1440, 'oscuro']]),
    teclado: elegir([['simple', 1366, 768, 'claro'], ['simple', 2560, 1440, 'oscuro'], ['pro', 1366, 768, 'oscuro'], ['pro', 2560, 1440, 'claro'], [null, 1366, 768, 'claro'], [null, 2560, 1440, 'oscuro']]),
    exportar: [...elegir([['simple', 1366, 768, 'claro'], ['simple', 2560, 1440, 'oscuro'], ['pro', 1366, 768, 'oscuro'], ['pro', 2560, 1440, 'claro']]),
      ...elegir([['simple', 1536, 864, 'claro'], ['pro', 1536, 864, 'oscuro']]).map(c => ({ ...c, conTablero: true }))],
    integridad: elegir([['simple', 1366, 768, 'claro'], ['pro', 2560, 1440, 'oscuro']]),
    calor: elegir([['simple', 1366, 768, 'claro'], ['simple', 2560, 1440, 'oscuro'], ['pro', 1536, 864, 'oscuro'], ['pro', 2560, 1440, 'claro']]),
    tabla: elegir([['pro', 1366, 768, 'claro'], ['pro', 1536, 864, 'oscuro'], ['pro', 2560, 1440, 'claro']]),
    distancia: elegir([['simple', 1366, 768, 'claro'], ['simple', 2560, 1440, 'oscuro'], ['pro', 1536, 864, 'oscuro'], ['pro', 2560, 1440, 'claro']]),
    rendimiento: elegir([['simple', 1440, 900, 'claro'], ['pro', 1440, 900, 'claro'], ['simple', 2560, 1440, 'claro'], ['pro', 2560, 1440, 'claro']]),
  }
  : {
    vista: todas,
    tablero: elegir([['simple', 1366, 768, 'claro'], ['pro', 2560, 1440, 'oscuro']]),
    consignas: elegir([['simple', 1366, 768, 'claro'], ['pro', 2560, 1440, 'oscuro']]),
    teclado: elegir([['simple', 1366, 768, 'claro'], ['pro', 2560, 1440, 'oscuro'], [null, 1536, 864, 'claro']]),
    exportar: [...elegir([['pro', 1366, 768, 'oscuro']]), ...elegir([['simple', 2560, 1440, 'claro']]).map(c => ({ ...c, conTablero: true }))],
    integridad: elegir([['simple', 1536, 864, 'claro']]),
    calor: elegir([['simple', 1366, 768, 'claro'], ['pro', 2560, 1440, 'oscuro']]),
    tabla: elegir([['pro', 1366, 768, 'oscuro']]),
    distancia: elegir([['simple', 1536, 864, 'claro']]),
    rendimiento: elegir([['simple', 1440, 900, 'claro'], ['pro', 1440, 900, 'claro']]),
  };
const PRUEBAS = { vista, tablero, consignas, teclado, exportar, integridad: exportarIntegridad, calor, tabla, distancia, rendimiento };

const navegador = await lanzar();
const entorno = { navegador, url, salida, conAlta };
const inicio = Date.now();
const tareas = Object.entries(PLAN)
  .filter(([nombre]) => !solo?.length || solo.includes(nombre))
  // El rendimiento se mide solo, al final: en paralelo con otras páginas los tiempos no sirven.
  .flatMap(([nombre, combos]) => combos.map(c => ({ nombre, c })));
const enGrupo = tareas.filter(t => t.nombre !== 'rendimiento').map(t => () => PRUEBAS[t.nombre](t.c, entorno));
const solas = tareas.filter(t => t.nombre === 'rendimiento').map(t => () => PRUEBAS[t.nombre](t.c, entorno));
const informes = [...await enParalelo(enGrupo, paralelo), ...await enParalelo(solas, 1)];
await navegador.close();

// --- Informe ---
const segundos = Math.round((Date.now() - inicio) / 1000);
const todos = informes.flatMap(i => i.chequeos.map(c => ({ ...c, prueba: i.prueba, combo: i.combo })));
const fallas = todos.filter(c => c.estado === 'falla');
const avisos = todos.filter(c => c.estado === 'aviso');
fs.writeFileSync(path.join(salida, 'informe.json'), JSON.stringify({ nivel, url, fecha: new Date().toISOString(), segundos, informes }, null, 2));

console.log(`\nVerificación ${nivel} · ${informes.length} páginas · ${todos.length} chequeos · ${segundos} s`);
for (const i of informes) {
  const f = i.chequeos.filter(c => c.estado === 'falla').length;
  const a = i.chequeos.filter(c => c.estado === 'aviso').length;
  console.log(`  ${f ? '✘' : a ? '△' : '✔'} ${i.prueba.padEnd(12)} ${i.combo.padEnd(22)} ${i.chequeos.length - f - a}/${i.chequeos.length}${a ? ` (${a} aviso${a > 1 ? 's' : ''})` : ''}`);
}
for (const [titulo, lista] of [['Fallas', fallas], ['Avisos', avisos]]) {
  if (!lista.length) continue;
  console.log(`\n${titulo}:`);
  for (const c of lista) console.log(`  · [${c.prueba} ${c.combo}] ${c.que}${c.detalle ? ` — ${c.detalle}` : ''}`);
}
const rend = informes.filter(i => i.prueba === 'rendimiento');
if (rend.length) {
  console.log('\nRendimiento (base: FCP 180 ms · LCP 1.052 ms · JS al mover 23 ms · JS al abrir 320 KB):');
  for (const i of rend) console.log(`  ${i.combo}: ${i.chequeos.filter(c => c.detalle && !/consola|pedido fuera|HTTP/.test(c.que)).map(c => c.detalle).join(' · ')}`);
}
console.log(`\nInforme y capturas: ${salida}`);
console.log(fallas.length ? `RESULTADO: ${fallas.length} falla${fallas.length > 1 ? 's' : ''}` : 'RESULTADO: sin fallas');
process.exit(fallas.length ? 1 : 0);
