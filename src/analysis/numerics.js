// =====================================================================
//  MÉTODOS NUMÉRICOS (implementados desde cero, con todos los pasos)
//  1. Regresión lineal            5. Ensayo y error (bisección)
//  2. Regresión polinomial (g=2)  6. Punto fijo
//  3. Integración por trapecio    7. Newton-Raphson
//  4. Simpson 1/3
// =====================================================================

// ---------- utilidades ----------
export const fmt = (x, d = 4) => {
  if (x === undefined || x === null || !Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e9 || a < 10 ** -d)) return x.toExponential(2);
  return x.toFixed(d);
};
export const polyEval = (c, x) => c.reduceRight((acc, ci) => acc * x + ci, 0);
export const polyDeriv = (c) => c.slice(1).map((ci, i) => ci * (i + 1));
// devuelve filas para mostrar: primeras `head`, un null (…) y las últimas `tail`
export const preview = (rows, head = 8, tail = 2) =>
  rows.length <= head + tail + 1 ? rows : [...rows.slice(0, head), null, ...rows.slice(-tail)];

function r2Of(xs, ys, f) {
  const n = ys.length;
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  let sse = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    sse += (ys[i] - f(xs[i])) ** 2;
    sst += (ys[i] - ybar) ** 2;
  }
  return { sse, sst, r2: sst === 0 ? 1 : 1 - sse / sst };
}

// ---------- 1. Regresión lineal  y = a + b·x ----------
export function linearRegression(xs, ys) {
  const n = xs.length;
  let Sx = 0, Sy = 0, Sxx = 0, Sxy = 0;
  const rows = [];
  for (let i = 0; i < n; i++) {
    Sx += xs[i];
    Sy += ys[i];
    Sxx += xs[i] * xs[i];
    Sxy += xs[i] * ys[i];
    rows.push({ i: i + 1, x: xs[i], y: ys[i], x2: xs[i] * xs[i], xy: xs[i] * ys[i] });
  }
  const den = n * Sxx - Sx * Sx;
  const b = (n * Sxy - Sx * Sy) / den;
  const a = (Sy - b * Sx) / n;
  const f = (x) => a + b * x;
  return { n, Sx, Sy, Sxx, Sxy, den, a, b, f, rows, ...r2Of(xs, ys, f) };
}

// ---------- eliminación de Gauss con pivoteo parcial ----------
export function gaussSolve(Ab) {
  const n = Ab.length;
  const M = Ab.map((r) => r.slice());
  const initial = Ab.map((r) => r.slice());
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    if (Math.abs(M[p][k]) < 1e-14) throw new Error('Matriz singular');
    [M[k], M[p]] = [M[p], M[k]];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return { x, initial, triangular: M };
}

// ---------- 2. Regresión polinomial  y = c0 + c1·x + … + cg·x^g ----------
export function polyRegression(xs, ys, degree = 2) {
  const m = degree + 1;
  const S = Array(2 * degree + 1).fill(0); // Σ x^j
  const T = Array(m).fill(0); // Σ x^j · y
  for (let k = 0; k < xs.length; k++) {
    let p = 1;
    for (let j = 0; j <= 2 * degree; j++) {
      S[j] += p;
      if (j <= degree) T[j] += p * ys[k];
      p *= xs[k];
    }
  }
  const aug = Array.from({ length: m }, (_, i) => [...Array.from({ length: m }, (_, j) => S[i + j]), T[i]]);
  const { x: coef, initial, triangular } = gaussSolve(aug);
  const f = (x) => polyEval(coef, x);
  return { degree, n: xs.length, S, T, initial, triangular, coef, f, ...r2Of(xs, ys, f) };
}

// ---------- 3. Integración: regla del trapecio compuesta ----------
export function trapezoid(ts, vs) {
  const rows = [];
  let total = 0;
  for (let i = 0; i < ts.length - 1; i++) {
    const h = ts[i + 1] - ts[i];
    const area = (h * (vs[i] + vs[i + 1])) / 2;
    total += area;
    rows.push({ i, t0: ts[i], t1: ts[i + 1], v0: vs[i], v1: vs[i + 1], h, area, acc: total });
  }
  return { rows, total, n: ts.length - 1 };
}

// ---------- 4. Integración: Simpson 1/3 compuesta ----------
export function simpson13(ts, vs) {
  const N = ts.length - 1; // subintervalos
  const h = (ts[N] - ts[0]) / N;
  const M = N % 2 === 0 ? N : N - 1; // Simpson necesita N par
  const tail = N % 2 === 1 ? (h * (vs[N - 1] + vs[N])) / 2 : 0;
  let odd = 0;
  let even = 0;
  for (let i = 1; i < M; i++) (i % 2 ? (odd += vs[i]) : (even += vs[i]));
  const core = (h / 3) * (vs[0] + 4 * odd + 2 * even + vs[M]);
  const rows = [];
  let acc = 0;
  for (let i = 0; i < M; i += 2) {
    const area = (h / 3) * (vs[i] + 4 * vs[i + 1] + vs[i + 2]);
    acc += area;
    rows.push({ k: i / 2 + 1, t0: ts[i], t2: ts[i + 2], v0: vs[i], v1: vs[i + 1], v2: vs[i + 2], area, acc });
  }
  return { N, M, h, odd, even, core, tail, usedTail: N % 2 === 1, total: core + tail, rows, v0: vs[0], vM: vs[M] };
}

// ---------- 5. Ensayo y error: bisección ----------
export function bisection(f, a, b, tol = 1e-4, maxIter = 60) {
  let fa = f(a);
  let fb = f(b);
  if (fa * fb > 0) return { ok: false, rows: [], root: NaN };
  const rows = [];
  let c = a;
  for (let i = 1; i <= maxIter; i++) {
    c = (a + b) / 2;
    const fc = f(c);
    const err = (b - a) / 2;
    rows.push({ i, a, b, c, fa, fb, fc, err });
    if (Math.abs(fc) < 1e-12 || err < tol) break;
    if (fa * fc < 0) {
      b = c;
      fb = fc;
    } else {
      a = c;
      fa = fc;
    }
  }
  return { ok: true, rows, root: c };
}

// ---------- 6. Punto fijo  x_{n+1} = g(x_n) ----------
export function fixedPoint(g, x0, tol = 1e-6, maxIter = 100) {
  const rows = [];
  let x = x0;
  for (let i = 0; i < maxIter; i++) {
    const gx = g(x);
    const err = Math.abs(gx - x);
    rows.push({ i, x, gx, err });
    if (!Number.isFinite(gx)) return { ok: false, rows, root: NaN };
    x = gx;
    if (err < tol) break;
  }
  const last = rows[rows.length - 1];
  return { ok: last.err < tol * 10, rows, root: x };
}

// ---------- 7. Newton-Raphson  x_{n+1} = x_n − f/f' ----------
export function newton(f, df, x0, tol = 1e-10, maxIter = 50) {
  const rows = [];
  let x = x0;
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x);
    const dfx = df(x);
    if (Math.abs(dfx) < 1e-14) return { ok: false, rows, root: NaN };
    const xn = x - fx / dfx;
    const err = Math.abs(xn - x);
    rows.push({ i, x, fx, dfx, xn, err });
    x = xn;
    if (err < tol) break;
  }
  return { ok: true, rows, root: x };
}

// =====================================================================
//  Análisis completo de UNA partida
// =====================================================================
export function runAnalysis(result) {
  const S = result.samples;
  if (!S || S.length < 6) return { ok: false, reason: 'El recorrido fue demasiado corto para analizar (menos de 3 s).' };
  const ts = S.map((s) => s.t);
  const vs = S.map((s) => s.v);
  const ds = S.map((s) => s.d);
  const n = S.length;
  const tF = ts[n - 1];
  const dF = ds[n - 1];

  const linV = linearRegression(ts, vs); // v(t)
  const linD = linearRegression(ts, ds); // d(t) (para comparar)
  const poly = polyRegression(ts, ds, 2); // d(t) cuadrática
  const realD = ds[n - 1] - ds[0];
  const trap = trapezoid(ts, vs);
  const simp = simpson13(ts, vs);

  const A = {
    ok: true,
    n, ts, vs, ds, tF, dF, realD,
    linV, linD, poly, trap, simp,
    errTrap: Math.abs(trap.total - realD),
    errSimp: Math.abs(simp.total - realD),
  };
  A.root = buildRoot(poly, linD, tF, dF);
  return A;
}

// Problema de raíz: ¿en qué instante t el carro llegaría a la distancia D*?
//   f(t) = d̂(t) − D* = 0      (d̂ = modelo ajustado con regresión)
function buildRoot(poly, linD, tF, dF) {
  const Dstar = Math.max(100, Math.ceil((dF * 1.25) / 100) * 100);
  const tryModel = (name, coef) => {
    const dc = polyDeriv(coef);
    const f = (t) => polyEval(coef, t) - Dstar;
    const df = (t) => polyEval(dc, t);
    let a = tF;
    if (f(a) >= 0) a = 0;
    if (f(a) >= 0) return null;
    let b = a + Math.max(tF * 0.25, 5);
    for (let k = 0; k < 80 && f(b) < 0; k++) b = a + (b - a) * 1.5;
    if (!(f(b) > 0) || df(b) <= 0) return null;
    return { name, coef, dc, f, df, a, b };
  };
  const model = tryModel('polinomio de grado 2', poly.coef) || tryModel('recta (respaldo)', linD.f ? [linD.a, linD.b] : [0, 1]);
  if (!model) return { ok: false, Dstar, reason: 'El modelo no alcanza la distancia objetivo.' };
  const { f, df, a, b } = model;

  const bis = bisection(f, a, b, 1e-4);
  const m = (f(b) - f(a)) / (b - a); // pendiente de la secante: factor de relajación
  const g = (x) => x - f(x) / m;
  const fp = fixedPoint(g, a, 1e-6);
  const nw = newton(f, df, a, 1e-10);
  const ref = newton(f, df, b, 1e-13).root; // raíz "exacta" para medir errores

  const errCurve = (rows, key) => rows.map((r, i) => [i + 1, Math.max(Math.abs((key ? r[key] : r.x) - ref), 1e-16)]);
  const compare = [
    {
      name: 'Bisección (ensayo y error)', iters: bis.rows.length, root: bis.root,
      fr: Math.abs(f(bis.root)), err: Math.abs(bis.root - ref), order: 'Lineal (error ÷ 2 por paso)',
      curve: errCurve(bis.rows, 'c'),
    },
    {
      name: 'Punto fijo', iters: fp.rows.length, root: fp.root,
      fr: Math.abs(f(fp.root)), err: Math.abs(fp.root - ref), order: 'Lineal (depende de |g′|)',
      curve: errCurve(fp.rows),
    },
    {
      name: 'Newton-Raphson', iters: nw.rows.length, root: nw.root,
      fr: Math.abs(f(nw.root)), err: Math.abs(nw.root - ref), order: 'Cuadrática (dígitos ×2 por paso)',
      curve: errCurve(nw.rows),
    },
  ];
  return { ok: true, Dstar, model, f, df, g, m, a, b, bis, fp, nw, ref, compare, gPrime: (x) => 1 - df(x) / m };
}
