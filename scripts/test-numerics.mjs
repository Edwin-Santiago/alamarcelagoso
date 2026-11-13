// Pruebas de los métodos numéricos con problemas de solución conocida
// y con una partida simulada de verdad.
import {
  linearRegression, polyRegression, trapezoid, simpson13, bisection, fixedPoint, newton, runAnalysis,
} from '../src/analysis/numerics.js';
import { GameCore } from '../src/game/logic.js';

let fails = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✔' : '✘'} ${name} ${extra}`);
  if (!cond) fails++;
};
const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// 1. lineal: y = 3 + 2x exacta
{
  const xs = [0, 1, 2, 3, 4, 5];
  const r = linearRegression(xs, xs.map((x) => 3 + 2 * x));
  ok('Regresión lineal recupera a=3, b=2, R²=1', close(r.a, 3) && close(r.b, 2) && close(r.r2, 1));
}
// 2. polinomial: y = 1 − 2x + 0.5x²
{
  const xs = Array.from({ length: 40 }, (_, i) => i * 0.5);
  const r = polyRegression(xs, xs.map((x) => 1 - 2 * x + 0.5 * x * x), 2);
  ok('Regresión polinomial recupera [1, −2, 0.5]', close(r.coef[0], 1) && close(r.coef[1], -2) && close(r.coef[2], 0.5, 1e-7), r.coef.map((c) => c.toFixed(4)).join(', '));
}
// 3 y 4. integrales de x² en [0,10] = 333.333…
{
  const ts = Array.from({ length: 21 }, (_, i) => i * 0.5);
  const vs = ts.map((t) => t * t);
  const tr = trapezoid(ts, vs);
  const si = simpson13(ts, vs);
  ok('Simpson 1/3 es exacto para x²', close(si.total, 1000 / 3, 1e-10), si.total.toFixed(6));
  // error teórico del trapecio: h²(b−a)f″/12 = 0.25·10·2/12 = 0.41667
  ok('Trapecio tiene el error teórico esperado (0.41667) para x²', close(tr.total - 1000 / 3, 0.25 * 10 * 2 / 12, 1e-6), tr.total.toFixed(6));
  const ts2 = ts.slice(0, 20); // 19 subintervalos (impar) → usa trapecio al final
  const si2 = simpson13(ts2, ts2.map((t) => t * t));
  ok('Simpson con N impar usa el trapecio en el último tramo', si2.usedTail && close(si2.total, 9.5 ** 3 / 3, 1e-4), si2.total.toFixed(5));
}
// 5-7. raíz de t² − 2 (√2)
{
  const f = (x) => x * x - 2;
  const df = (x) => 2 * x;
  const b = bisection(f, 1, 2, 1e-8);
  const nw = newton(f, df, 1, 1e-12);
  const m = (f(2) - f(1)) / 1;
  const fp = fixedPoint((x) => x - f(x) / m, 1, 1e-10);
  ok('Bisección → √2', close(b.root, Math.SQRT2, 1e-7), `${b.rows.length} it.`);
  ok('Newton → √2', close(nw.root, Math.SQRT2, 1e-12), `${nw.rows.length} it.`);
  ok('Punto fijo → √2', close(fp.root, Math.SQRT2, 1e-8), `${fp.rows.length} it.`);
  ok('Newton converge en menos pasos que bisección', nw.rows.length < b.rows.length);
}
// Partida real simulada (bot) → análisis completo
{
  const core = new GameCore(2024);
  while (core.status === 'playing' && core.time < 90) {
    let best = null;
    for (const o of core.obstacles) if (o.z <= 3.8 && (!best || o.z > best.z)) best = o;
    const dx = (best ? best.freeX : 0) - core.x;
    core.update(1 / 60, { left: dx < -0.12, right: dx > 0.12 });
  }
  // fuerza una muerte para tener datos de choque
  const A = runAnalysis(core.result());
  ok('runAnalysis devuelve ok', A.ok, `n=${A.n}, t=${A.tF}s, d=${A.dF.toFixed(0)}m`);
  ok('Simpson ≈ distancia real (error < 1 %)', A.errSimp / A.realD < 0.01, `err=${A.errSimp.toFixed(3)} m`);
  ok('Trapecio ≈ distancia real (error < 1 %)', A.errTrap / A.realD < 0.01, `err=${A.errTrap.toFixed(3)} m`);
  ok('Hay raíz y los 3 métodos coinciden', A.root.ok &&
    A.root.compare.every((c) => Math.abs(c.root - A.root.ref) < 1e-3),
  A.root.ok ? `t*=${A.root.ref.toFixed(3)} s para D*=${A.root.Dstar} m (${A.root.model.name}) it: ${A.root.compare.map((c) => c.iters).join('/')}` : '');
  ok('R² polinomio ≥ R² recta para d(t)', A.poly.r2 >= A.linD.r2 - 1e-9, `${A.poly.r2.toFixed(5)} vs ${A.linD.r2.toFixed(5)}`);
}
if (fails) {
  console.error(`\n${fails} prueba(s) fallaron`);
  process.exit(1);
}
console.log('\nTodas las pruebas numéricas pasaron ✔');
