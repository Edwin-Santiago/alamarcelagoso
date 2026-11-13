// Simula partidas con un "bot" perfecto para comprobar que el juego es justo
// (siempre hay un carril libre) y medir cómo crece la dificultad.
import { GameCore, CAR, levelOf, levelSpeed, rowGap } from '../src/game/logic.js';

const STEP = 1 / 60;

function botInput(core) {
  let best = null;
  for (const o of core.obstacles) {
    if (o.z <= 3.8 && (!best || o.z > best.z)) best = o;
  }
  const target = best ? best.freeX : 0;
  const dx = target - core.x;
  return { left: dx < -0.12, right: dx > 0.12, up: false, down: false };
}

// bot con "reacción humana": solo mira filas a menos de `look` metros y se mueve tarde
function humanInput(core, look, wobble, rng) {
  let best = null;
  for (const o of core.obstacles) {
    if (o.z <= 3.8 && o.z > -look && (!best || o.z > best.z)) best = o;
  }
  const target = best ? best.freeX + (rng() - 0.5) * wobble : 0;
  const dx = target - core.x;
  return { left: dx < -0.3, right: dx > 0.3, up: false, down: false };
}

function run(seed, mode, maxSeconds = 600) {
  const core = new GameCore(seed);
  let rng = (() => { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const look = 38;
  while (core.status === 'playing' && core.time < maxSeconds) {
    const inp = mode === 'perfect' ? botInput(core) : humanInput(core, look, 1.4, rng);
    core.update(STEP, inp);
  }
  return core;
}

console.log('— Tabla de dificultad (fórmulas del juego) —');
for (const L of [1, 2, 3, 4, 6, 8, 10, 12]) {
  console.log(
    `Nivel ${String(L).padStart(2)}  vel=${(levelSpeed(L) * 3.6).toFixed(0).padStart(3)} km/h  separación filas=${rowGap(L).toFixed(1)} m`,
  );
}

for (const mode of ['perfect', 'human']) {
  const dists = [];
  const levels = [];
  const causes = { hueco: 0, roca: 0 };
  let overs = 0;
  for (let s = 1; s <= 40; s++) {
    const c = run(s * 7919, mode);
    dists.push(c.dist);
    levels.push(c.level);
    if (c.status === 'over') overs++;
    c.deaths.forEach((d) => causes[d.cause]++);
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(
    `\nBot ${mode.padEnd(7)} · 40 partidas · distancia media ${avg(dists).toFixed(0)} m · nivel medio ${avg(levels).toFixed(1)} · ` +
      `partidas terminadas ${overs}/40 · muertes ${JSON.stringify(causes)}`,
  );
  console.log(`  distancia mín/máx: ${Math.min(...dists).toFixed(0)} / ${Math.max(...dists).toFixed(0)} m`);
}

// Comprobaciones duras
const c = run(12345, 'perfect', 40);
if (c.samples.length < 70) throw new Error('muy pocas muestras');
const dts = c.samples.slice(1).map((s, i) => +(s.t - c.samples[i].t).toFixed(6));
if (!dts.every((d) => Math.abs(d - 0.5) < 1e-9)) throw new Error('las muestras no son uniformes (h=0.5)');
// primer nivel: el bot perfecto no debe morir nunca
for (let s = 1; s <= 30; s++) {
  const core = new GameCore(s * 31);
  while (core.status === 'playing' && core.level < 4 && core.time < 200) core.update(STEP, botInput(core));
  if (core.deaths.length) throw new Error(`el bot perfecto murió en niveles 1-3 (seed ${s * 31}): el juego no es justo`);
}
console.log('\n✔ Muestras uniformes y niveles 1-3 siempre superables');
