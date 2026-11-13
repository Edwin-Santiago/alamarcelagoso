import React, { useMemo, useState } from 'react';
import { runAnalysis, fmt, preview, polyEval, polyDeriv } from './numerics.js';
import { LineChart, BarChart, C } from './charts.jsx';
import { levelSpeed, rowGap, blockedTarget, holeProb } from '../game/logic.js';

const TABS = [
  ['resumen', 'Resumen'],
  ['lineal', '1 · Regresión lineal'],
  ['poli', '2 · Regresión polinomial'],
  ['trap', '3 · Trapecio'],
  ['simp', '4 · Simpson 1/3'],
  ['bis', '5 · Ensayo y error'],
  ['fp', '6 · Punto fijo'],
  ['nw', '7 · Newton-Raphson'],
  ['comp', 'Comparación'],
];

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const mat = (M) =>
  M.map((r) => r.map((x, j) => (j === r.length - 1 ? '│ ' : '') + x.toExponential(3).padStart(11)).join('  ')).join('\n');

function Card({ title, children, className = '' }) {
  const hasChart = React.Children.toArray(children).some(child => child.type === LineChart || child.type === BarChart);
  return (
    <section className={`card ${hasChart ? 'card--chart' : ''} ${className}`}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}
const Pre = ({ children }) => <pre className="formula">{children}</pre>;
const Note = ({ children, kind = 'info' }) => <div className={`note ${kind}`}>{children}</div>;

function DataTable({ cols, rows }) {
  return (
    <div className="tablewrap">
      <table className="dt">
        <thead>
          <tr>{cols.map((c) => <th key={c.k}>{c.h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) =>
            r === null ? (
              <tr key={i} className="gap"><td colSpan={cols.length}>⋮</td></tr>
            ) : (
              <tr key={i}>{cols.map((c) => <td key={c.k}>{c.f ? c.f(r[c.k], r) : r[c.k]}</td>)}</tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

const Stat = ({ label, value, sub }) => (
  <div className="stat">
    <small>{label}</small>
    <b>{value}</b>
    {sub && <span>{sub}</span>}
  </div>
);

export default function AnalysisView({ result, onRetry, onMenu }) {
  const [tab, setTab] = useState('resumen');
  const A = useMemo(() => runAnalysis(result), [result]);

  const header = (
    <header className="an-head">
      <div>
        <p className="kicker">PARTIDA TERMINADA</p>
        <h1>Análisis numérico de tu recorrido</h1>
      </div>
      <div className="row">
        <button className="btn" onClick={onRetry}>↻ Jugar otra vez</button>
        <button className="btn ghost" onClick={onMenu}>Menú</button>
      </div>
    </header>
  );

  if (!A.ok) {
    return (
      <div className="analysis">
        {header}
        <Card><Note kind="warn">{A.reason}</Note></Card>
      </div>
    );
  }

  const deathLines = result.deaths.map((d, i) => ({ x: d.t, label: `vida ${i + 1}: ${d.cause}`, color: C.red }));
  const R = A.root;
  const noRoot = !R.ok && (
    <Card><Note kind="warn">{R.reason || 'No se pudo plantear el problema de raíces con esta partida.'}</Note></Card>
  );

  // ------------------------------------------------------------------ panels
  const panels = {
    // ================================================================ RESUMEN
    resumen: () => {
      const st = result.stats;
      const totalObs = st.rocks + st.holes;
      const nDeaths = result.deaths.length;
      const byCause = { hueco: 0, roca: 0 };
      result.deaths.forEach((d) => { byCause[d.cause]++; });
      const levels = [];
      for (let L = 1; L <= Math.min(12, Math.max(result.level + 1, 4)); L++) levels.push({ L });
      return (
        <>
          <div className="stats">
            <Stat label="Distancia" value={`${Math.floor(result.dist)} m`} sub={`${(result.dist / 1000).toFixed(2)} km`} />
            <Stat label="Tiempo jugado" value={mmss(result.time)} sub={`${result.time.toFixed(1)} s`} />
            <Stat label="Velocidad máx." value={`${(result.maxV * 3.6).toFixed(0)} km/h`} sub={`${result.maxV.toFixed(1)} m/s`} />
            <Stat label="Nivel alcanzado" value={result.level} sub="cada 600 m" />
            <Stat label="Datos guardados" value={A.n} sub="1 cada 0.5 s" />
            <Stat label="Nitros recogidos" value={st.pickups} />
          </div>

          <Card title="¿Cómo murió tu carro?">
            <DataTable
              cols={[
                { k: 'n', h: 'Vida' },
                { k: 'cause', h: 'Causa', f: (v) => (v === 'hueco' ? '🕳️ hueco' : '💥 roca') },
                { k: 't', h: 'Tiempo (s)', f: (v) => fmt(v, 1) },
                { k: 'd', h: 'Distancia (m)', f: (v) => fmt(v, 0) },
                { k: 'v', h: 'Velocidad (km/h)', f: (v) => fmt(v * 3.6, 0) },
                { k: 'level', h: 'Nivel' },
              ]}
              rows={result.deaths}
            />
            <h4>Probabilidades empíricas de esta partida</h4>
            <Pre>{`Obstáculos generados:  ${st.rocks} rocas + ${st.holes} huecos = ${totalObs}
P(obstáculo = hueco)  = ${st.holes}/${totalObs} = ${fmt(st.holes / totalObs, 3)}      P(roca) = ${fmt(st.rocks / totalObs, 3)}
Obstáculos esquivados: ${st.passed}
P(chocar por obstáculo) = vidas perdidas / (esquivados + vidas perdidas)
                        = ${nDeaths}/(${st.passed}+${nDeaths}) = ${fmt(nDeaths / (st.passed + nDeaths), 4)}
Causa de muerte:  huecos ${byCause.hueco} (${fmt((byCause.hueco / nDeaths) * 100, 0)} %)   rocas ${byCause.roca} (${fmt((byCause.roca / nDeaths) * 100, 0)} %)
Muertes por kilómetro = ${nDeaths}/${fmt(result.dist / 1000, 3)} km = ${fmt(nDeaths / (result.dist / 1000), 3)}`}</Pre>
          </Card>

          <Card title="Datos que recolectó el juego (alimentan todos los métodos)">
            <DataTable
              cols={[
                { k: 'i', h: 'i' },
                { k: 't', h: 't (s)', f: (v) => fmt(v, 1) },
                { k: 'd', h: 'distancia d (m)', f: (v) => fmt(v, 2) },
                { k: 'v', h: 'velocidad v (m/s)', f: (v) => fmt(v, 3) },
                { k: 'level', h: 'nivel' },
              ]}
              rows={preview(result.samples.map((s, i) => ({ ...s, i })), 8, 2)}
            />
          </Card>

          <Card title="Velocidad durante la partida">
            <LineChart
              xLabel="tiempo t (s)" yLabel="velocidad (m/s)"
              vlines={deathLines}
              series={[{ name: 'v(t) medida', color: C.cyan, points: A.ts.map((t, i) => [t, A.vs[i]]), mode: 'area' }]}
            />
            <p className="dim">Las líneas rojas son los momentos en que perdiste una vida. La velocidad baja ahí y luego se recupera; cada nivel sube la velocidad base.</p>
          </Card>

          <Card title="¿Por qué se vuelve más difícil?">
            <DataTable
              cols={[
                { k: 'L', h: 'Nivel' },
                { k: 'v', h: 'Velocidad base (km/h)', f: (_, r) => fmt(levelSpeed(r.L) * 3.6, 0) },
                { k: 'g', h: 'Separación entre filas (m)', f: (_, r) => fmt(rowGap(r.L), 1) },
                { k: 'b', h: 'Obstáculos por fila (prom.)', f: (_, r) => fmt(Math.min(4, blockedTarget(r.L)), 2) },
                { k: 'h', h: 'Prob. de que sea hueco', f: (_, r) => `${fmt(holeProb(r.L) * 100, 0)} %` },
                { k: 'ti', h: 'Tiempo entre filas (s)', f: (_, r) => fmt((rowGap(r.L) + 3) / levelSpeed(r.L), 2) },
              ]}
              rows={levels}
            />
          </Card>
        </>
      );
    },

    // ================================================================ LINEAL
    lineal: () => {
      const L = A.linV;
      const num = A.n * L.Sxy - L.Sx * L.Sy;
      const pts = A.ts.map((t, i) => [t, A.vs[i]]);
      const future = A.tF + 30;
      return (
        <>
          <Card title="Idea">
            <p>
              Queremos una <b>recta</b> que resuma cómo cambia tu velocidad con el tiempo: <code>v(t) = a + b·t</code>.
              El método de <b>mínimos cuadrados</b> escoge la recta que hace mínima la suma de los errores al cuadrado.
            </p>
            <Pre>{`b = ( n·Σ(t·v) − Σt·Σv ) / ( n·Σt² − (Σt)² )
a = ( Σv − b·Σt ) / n
R² = 1 − SSE/SST      (qué tan bien se ajusta: 1 = perfecto)`}</Pre>
          </Card>
          <Card title="Procedimiento con tus datos">
            <DataTable
              cols={[
                { k: 'i', h: 'i' },
                { k: 'x', h: 't (s)', f: (v) => fmt(v, 1) },
                { k: 'y', h: 'v (m/s)', f: (v) => fmt(v, 3) },
                { k: 'x2', h: 't²', f: (v) => fmt(v, 2) },
                { k: 'xy', h: 't·v', f: (v) => fmt(v, 3) },
              ]}
              rows={preview(L.rows, 6, 2)}
            />
            <Pre>{`n = ${L.n}
Σt = ${fmt(L.Sx, 2)}      Σv = ${fmt(L.Sy, 3)}
Σt² = ${fmt(L.Sxx, 2)}    Σt·v = ${fmt(L.Sxy, 3)}

b = (${L.n}·${fmt(L.Sxy, 3)} − ${fmt(L.Sx, 2)}·${fmt(L.Sy, 3)}) / (${L.n}·${fmt(L.Sxx, 2)} − ${fmt(L.Sx, 2)}²)
b = ${fmt(num, 3)} / ${fmt(L.den, 3)} = ${fmt(L.b, 6)}
a = (${fmt(L.Sy, 3)} − ${fmt(L.b, 6)}·${fmt(L.Sx, 2)}) / ${L.n} = ${fmt(L.a, 6)}

SSE = ${fmt(L.sse, 3)}   SST = ${fmt(L.sst, 3)}   →   R² = ${fmt(L.r2, 5)}

RESULTADO:  v(t) = ${fmt(L.a, 4)} + ${fmt(L.b, 5)}·t`}</Pre>
          </Card>
          <Card title="Gráfica">
            <LineChart
              xLabel="tiempo t (s)" yLabel="velocidad (m/s)" vlines={deathLines}
              series={[
                { name: 'datos del juego', color: C.cyan, points: pts, mode: 'dots', opacity: 0.55 },
                { name: `recta  v = ${fmt(L.a, 2)} + ${fmt(L.b, 3)}·t`, color: C.orange, points: [[0, L.f(0)], [A.tF, L.f(A.tF)]], mode: 'line', width: 3 },
              ]}
            />
            <Note>
              La pendiente <b>b = {fmt(L.b, 4)} m/s²</b> es la <b>aceleración media</b> del juego: cada segundo jugado la velocidad sube
              {' '}{fmt(L.b * 3.6, 3)} km/h en promedio. Con R² = {fmt(L.r2, 3)}, {L.r2 > 0.9 ? 'la tendencia lineal explica muy bien tu partida.' : 'la velocidad tiene escalones por nivel y caídas por choques, por eso no es una recta perfecta.'}
              {' '}Predicción: a los {fmt(future, 0)} s la velocidad sería ≈ {fmt(L.f(future), 1)} m/s ({fmt(L.f(future) * 3.6, 0)} km/h).
            </Note>
          </Card>
        </>
      );
    },

    // ================================================================ POLINOMIAL
    poli: () => {
      const P = A.poly;
      const c = P.coef;
      const curve = Array.from({ length: 80 }, (_, i) => { const t = (A.tF * i) / 79; return [t, P.f(t)]; });
      const vModel = polyEval(polyDeriv(c), A.tF);
      return (
        <>
          <Card title="Idea">
            <p>
              La distancia recorrida cuando aceleras no crece en línea recta, sino como una <b>parábola</b>:
              {' '}<code>d(t) = c₀ + c₁·t + c₂·t²</code>. Se ajusta resolviendo las <b>ecuaciones normales</b> con eliminación de Gauss.
            </p>
            <Pre>{`⎡ n     Σt    Σt² ⎤ ⎡c₀⎤   ⎡ Σd    ⎤
⎢ Σt    Σt²   Σt³ ⎥ ⎢c₁⎥ = ⎢ Σt·d  ⎥
⎣ Σt²   Σt³   Σt⁴ ⎦ ⎣c₂⎦   ⎣ Σt²·d ⎦`}</Pre>
          </Card>
          <Card title="Procedimiento con tus datos">
            <p><b>Paso 1.</b> Sumatorias:</p>
            <Pre>{`n = ${P.n}
Σt = ${fmt(P.S[1], 2)}   Σt² = ${fmt(P.S[2], 2)}   Σt³ = ${fmt(P.S[3], 2)}   Σt⁴ = ${fmt(P.S[4], 2)}
Σd = ${fmt(P.T[0], 2)}   Σt·d = ${fmt(P.T[1], 2)}   Σt²·d = ${fmt(P.T[2], 2)}`}</Pre>
            <p><b>Paso 2.</b> Matriz aumentada del sistema:</p>
            <Pre>{mat(P.initial)}</Pre>
            <p><b>Paso 3.</b> Eliminación de Gauss (pivoteo parcial) → matriz triangular superior:</p>
            <Pre>{mat(P.triangular)}</Pre>
            <p><b>Paso 4.</b> Sustitución hacia atrás:</p>
            <Pre>{`c₂ = ${fmt(c[2], 8)}
c₁ = ${fmt(c[1], 6)}
c₀ = ${fmt(c[0], 6)}

RESULTADO:  d(t) = ${fmt(c[0], 3)} + ${fmt(c[1], 4)}·t + ${fmt(c[2], 5)}·t²
R² (parábola) = ${fmt(P.r2, 6)}        R² (recta) = ${fmt(A.linD.r2, 6)}`}</Pre>
          </Card>
          <Card title="Gráfica">
            <LineChart
              xLabel="tiempo t (s)" yLabel="distancia d (m)" vlines={deathLines}
              series={[
                { name: 'datos del juego', color: C.cyan, points: A.ts.map((t, i) => [t, A.ds[i]]), mode: 'dots', opacity: 0.5 },
                { name: 'recta', color: C.grey, points: [[0, A.linD.f(0)], [A.tF, A.linD.f(A.tF)]], mode: 'line', dash: true },
                { name: 'parábola (grado 2)', color: C.pink, points: curve, mode: 'line', width: 3 },
              ]}
            />
            <Note>
              La parábola se ajusta {P.r2 > A.linD.r2 ? 'mejor' : 'igual'} que la recta (R² {fmt(P.r2, 5)} vs {fmt(A.linD.r2, 5)}).
              Además, su derivada <code>d′(t) = c₁ + 2·c₂·t</code> es el modelo de la velocidad: en t = {fmt(A.tF, 0)} s da
              {' '}{fmt(vModel, 1)} m/s ({fmt(vModel * 3.6, 0)} km/h) y tú registraste {fmt(A.vs[A.n - 1], 1)} m/s.
            </Note>
          </Card>
        </>
      );
    },

    // ================================================================ TRAPECIO
    trap: () => {
      const T = A.trap;
      const h = A.ts[1] - A.ts[0];
      const pts = A.ts.map((t, i) => [t, A.vs[i]]);
      return (
        <>
          <Card title="Idea">
            <p>
              La distancia es el <b>área bajo la curva de velocidad</b>: <code>d = ∫ v(t) dt</code>. La regla del trapecio
              reemplaza cada tramo por un trapecio y suma sus áreas.
            </p>
            <Pre>{`Cada tramo:   Aᵢ = h·(vᵢ + vᵢ₊₁)/2
Compuesta:    ∫ v dt ≈ (h/2)·[ v₀ + 2·(v₁ + … + vₙ₋₁) + vₙ ]      h = ${fmt(h, 2)} s`}</Pre>
          </Card>
          <Card title="Procedimiento con tus datos">
            <DataTable
              cols={[
                { k: 'i', h: 'tramo', f: (v) => v + 1 },
                { k: 't0', h: 't₀', f: (v) => fmt(v, 1) },
                { k: 't1', h: 't₁', f: (v) => fmt(v, 1) },
                { k: 'v0', h: 'v₀ (m/s)', f: (v) => fmt(v, 3) },
                { k: 'v1', h: 'v₁ (m/s)', f: (v) => fmt(v, 3) },
                { k: 'area', h: 'área = h(v₀+v₁)/2', f: (v) => fmt(v, 4) },
                { k: 'acc', h: 'acumulado (m)', f: (v) => fmt(v, 3) },
              ]}
              rows={preview(T.rows, 6, 2)}
            />
            <Pre>{`Número de tramos n = ${T.n}     h = ${fmt(h, 2)} s
Distancia por TRAPECIO = Σ Aᵢ = ${fmt(T.total, 4)} m
Distancia REAL (odómetro del juego) = ${fmt(A.realD, 4)} m
Error absoluto = |${fmt(T.total, 4)} − ${fmt(A.realD, 4)}| = ${fmt(A.errTrap, 4)} m
Error relativo = ${fmt((A.errTrap / A.realD) * 100, 4)} %`}</Pre>
          </Card>
          <Card title="Gráfica: el área es la distancia">
            <LineChart
              xLabel="tiempo t (s)" yLabel="velocidad (m/s)" vlines={deathLines}
              series={[
                { name: `área bajo v(t) ≈ ${fmt(T.total, 1)} m`, color: C.green, points: pts, mode: 'area', group: 'integral' },
                { color: C.green, points: pts.filter((_, i) => i % 2 === 0), mode: 'stems', group: 'integral' },
              ]}
            />
          </Card>
        </>
      );
    },

    // ================================================================ SIMPSON
    simp: () => {
      const S = A.simp;
      return (
        <>
          <Card title="Idea">
            <p>
              Simpson 1/3 es más fino: en vez de unir puntos con rectas, ajusta una <b>parábola</b> por cada 3 puntos consecutivos.
              Necesita un número <b>par</b> de tramos y una separación constante h (tus datos se guardan cada 0.5 s, así que se cumple).
            </p>
            <Pre>{`∫ v dt ≈ (h/3)·[ v₀ + 4·(v₁ + v₃ + v₅ + …) + 2·(v₂ + v₄ + …) + vₙ ]
h = ${fmt(S.h, 2)} s`}</Pre>
          </Card>
          <Card title="Procedimiento con tus datos">
            <DataTable
              cols={[
                { k: 'k', h: 'parábola' },
                { k: 't0', h: 't₀', f: (v) => fmt(v, 1) },
                { k: 't2', h: 't₂', f: (v) => fmt(v, 1) },
                { k: 'v0', h: 'v₀', f: (v) => fmt(v, 3) },
                { k: 'v1', h: 'v₁', f: (v) => fmt(v, 3) },
                { k: 'v2', h: 'v₂', f: (v) => fmt(v, 3) },
                { k: 'area', h: '(h/3)(v₀+4v₁+v₂)', f: (v) => fmt(v, 4) },
                { k: 'acc', h: 'acumulado', f: (v) => fmt(v, 3) },
              ]}
              rows={preview(S.rows, 5, 2)}
            />
            <Pre>{`Tramos N = ${S.N}${S.usedTail ? `  (impar → Simpson en los primeros ${S.M} y trapecio en el último tramo)` : '  (par ✔)'}
v₀ = ${fmt(S.v0, 4)}     v${S.M} = ${fmt(S.vM, 4)}
Σ índices impares (×4) = ${fmt(S.odd, 4)}
Σ índices pares   (×2) = ${fmt(S.even, 4)}

d ≈ (${fmt(S.h, 2)}/3)·[ ${fmt(S.v0, 3)} + 4·${fmt(S.odd, 3)} + 2·${fmt(S.even, 3)} + ${fmt(S.vM, 3)} ]${S.usedTail ? `  + tramo final ${fmt(S.tail, 3)}` : ''}
d ≈ ${fmt(S.total, 4)} m

Distancia REAL = ${fmt(A.realD, 4)} m
Error absoluto = ${fmt(A.errSimp, 4)} m      Error relativo = ${fmt((A.errSimp / A.realD) * 100, 4)} %`}</Pre>
          </Card>
          <Card title="Gráfica: error de cada método">
            <BarChart
              unit=" m"
              items={[
                { label: 'Trapecio', value: A.errTrap, color: C.green },
                { label: 'Simpson 1/3', value: A.errSimp, color: C.violet },
              ]}
            />
            <Note>
              {A.errSimp < A.errTrap
                ? `Simpson fue más preciso que el trapecio (${fmt(A.errSimp, 4)} m vs ${fmt(A.errTrap, 4)} m).`
                : `En esta partida el trapecio quedó igual o más cerca que Simpson (${fmt(A.errTrap, 4)} m vs ${fmt(A.errSimp, 4)} m): la velocidad tiene escalones y choques bruscos, y ahí la parábola no siempre gana.`}
              {' '}Ambos son «más exactos» mientras más pequeño sea h.
            </Note>
          </Card>
        </>
      );
    },

    // ================================================================ BISECCIÓN
    bis: () => {
      if (!R.ok) return noRoot;
      const B = R.bis;
      const lo = R.a - (R.b - R.a) * 0.1;
      const hi = R.b + (R.b - R.a) * 0.1;
      const curve = Array.from({ length: 80 }, (_, i) => { const t = lo + ((hi - lo) * i) / 79; return [t, R.f(t)]; });
      const need = Math.ceil(Math.log2((R.b - R.a) / 1e-4));
      return (
        <>
          <Card title="El problema (con tu partida)">
            <p>
              <b>¿En qué instante habrías llegado a {R.Dstar} m si hubieras seguido vivo?</b> Usamos el modelo de la regresión
              ({R.model.name}) y buscamos el cero de
            </p>
            <Pre>{`f(t) = d̂(t) − ${R.Dstar} = ${fmt(R.model.coef[0], 3)} + ${fmt(R.model.coef[1], 4)}·t${R.model.coef[2] !== undefined ? ` + ${fmt(R.model.coef[2], 5)}·t²` : ''} − ${R.Dstar}`}</Pre>
          </Card>
          <Card title="Ensayo y error (bisección)">
            <p>Se prueba el punto medio y se descarta la mitad donde <b>no</b> hay cambio de signo:</p>
            <Pre>{`Intervalo inicial [a, b] = [${fmt(R.a, 3)}, ${fmt(R.b, 3)}]
f(a) = ${fmt(R.f(R.a), 3)} < 0      f(b) = ${fmt(R.f(R.b), 3)} > 0      → hay una raíz dentro ✔

c = (a + b)/2
si f(a)·f(c) < 0  →  b = c;   si no  →  a = c
error = (b − a)/2        Pasos necesarios ≈ log₂((b−a)/10⁻⁴) = ${need}`}</Pre>
            <DataTable
              cols={[
                { k: 'i', h: 'it' },
                { k: 'a', h: 'a', f: (v) => fmt(v, 5) },
                { k: 'b', h: 'b', f: (v) => fmt(v, 5) },
                { k: 'c', h: 'c = (a+b)/2', f: (v) => fmt(v, 5) },
                { k: 'fc', h: 'f(c)', f: (v) => fmt(v, 5) },
                { k: 'err', h: 'error', f: (v) => fmt(v, 6) },
              ]}
              rows={preview(B.rows, 10, 3)}
            />
            <Pre>{`RESULTADO: t* ≈ ${fmt(B.root, 5)} s  en ${B.rows.length} iteraciones   (|f(t*)| = ${fmt(Math.abs(R.f(B.root)), 6)})`}</Pre>
          </Card>
          <Card title="Gráfica">
            <LineChart
              xLabel="tiempo t (s)" yLabel="f(t) = d̂(t) − D*"
              hlines={[{ y: 0, color: C.grey }]}
              series={[
                { name: 'f(t)', color: C.cyan, points: curve, mode: 'line' },
                { name: 'puntos medios c (n.º de iteración)', color: C.orange, points: B.rows.slice(0, 8).map((r) => [r.c, R.f(r.c)]), mode: 'dots', r: 4.5, labels: B.rows.slice(0, 8).map((r) => r.i) },
              ]}
            />
          </Card>
        </>
      );
    },

    // ================================================================ PUNTO FIJO
    fp: () => {
      if (!R.ok) return noRoot;
      const F = R.fp;
      const rows = F.rows;
      const path = [];
      rows.slice(0, 14).forEach((r) => {
        if (!path.length) path.push([r.x, r.x]);
        path.push([r.x, r.gx]);
        path.push([r.gx, r.gx]);
      });
      const span = R.ref - R.a;
      const lo = R.a - span * 0.1;
      const hi = R.ref + span * 0.15;
      const gcurve = Array.from({ length: 60 }, (_, i) => { const t = lo + ((hi - lo) * i) / 59; return [t, R.g(t)]; });
      return (
        <>
          <Card title="Idea">
            <p>
              Se reescribe <code>f(t) = 0</code> como <code>t = g(t)</code> y se itera <code>tₙ₊₁ = g(tₙ)</code>. Si converge, el
              límite es un <b>punto fijo</b> (g(t*) = t*) y por tanto una raíz de f.
            </p>
            <Pre>{`Elegimos  g(t) = t − f(t)/m      con  m = (f(b) − f(a))/(b − a) = ${fmt(R.m, 5)}   (pendiente de la secante)
Condición de convergencia:  |g′(t*)| < 1,   g′(t) = 1 − f′(t)/m
|g′(t*)| = |1 − ${fmt(R.df(R.ref), 4)}/${fmt(R.m, 4)}| = ${fmt(Math.abs(R.gPrime(R.ref)), 5)}  ${Math.abs(R.gPrime(R.ref)) < 1 ? '< 1  ✔ converge' : '≥ 1  ✘ puede diverger'}`}</Pre>
          </Card>
          <Card title="Procedimiento">
            <Pre>{`t₀ = ${fmt(R.a, 4)} (el instante en que murió el último intento)   tolerancia = 10⁻⁶`}</Pre>
            <DataTable
              cols={[
                { k: 'i', h: 'n' },
                { k: 'x', h: 'tₙ', f: (v) => fmt(v, 6) },
                { k: 'gx', h: 'g(tₙ) = tₙ₊₁', f: (v) => fmt(v, 6) },
                { k: 'err', h: '|g(tₙ) − tₙ|', f: (v) => fmt(v, 8) },
              ]}
              rows={preview(rows, 10, 3)}
            />
            <Pre>{`RESULTADO: t* ≈ ${fmt(F.root, 6)} s  en ${rows.length} iteraciones`}</Pre>
          </Card>
          <Card title="Gráfica: la «telaraña» del punto fijo">
            <LineChart
              xLabel="tₙ" yLabel="g(t)" xDomain={[lo, hi]} yDomain={[lo, hi]}
              series={[
                { name: 'y = g(t)', color: C.cyan, points: gcurve, mode: 'line' },
                { name: 'y = t', color: C.grey, points: [[lo, lo], [hi, hi]], mode: 'line', dash: true },
                { name: 'iteraciones', color: C.orange, points: path, mode: 'line', width: 1.6 },
              ]}
            />
            <Note>Cada escalón es una iteración: sube hasta la curva g y se mueve horizontalmente hasta la diagonal. Los escalones se achican hasta llegar a la intersección (el punto fijo).</Note>
          </Card>
        </>
      );
    },

    // ================================================================ NEWTON
    nw: () => {
      if (!R.ok) return noRoot;
      const N = R.nw;
      const rows = N.rows;
      const xs = rows.map((r) => r.x).concat(R.ref);
      const lo = Math.min(...xs) - (R.ref - R.a) * 0.08;
      const hi = Math.max(...xs) + (R.ref - R.a) * 0.12;
      const curve = Array.from({ length: 80 }, (_, i) => { const t = lo + ((hi - lo) * i) / 79; return [t, R.f(t)]; });
      const tangents = rows.slice(0, 5).map((r, i) => ({
        color: i % 2 ? C.pink : C.orange, mode: 'line', width: 1.6, group: 'tangents',
        points: [[r.x, 0], [r.x, r.fx], [r.xn, 0]],
      }));
      return (
        <>
          <Card title="Idea">
            <p>
              Newton-Raphson dibuja la <b>tangente</b> a f en el punto actual y salta hasta donde esa tangente corta al eje.
              Aquí tiene un significado de juego: <i>«lo que me falta de distancia ÷ mi velocidad»</i>.
            </p>
            <Pre>{`tₙ₊₁ = tₙ − f(tₙ)/f′(tₙ)        f′(t) = d̂′(t) = ${fmt(R.model.coef[1], 4)}${R.model.coef[2] !== undefined ? ` + ${fmt(2 * R.model.coef[2], 6)}·t` : ''}   (velocidad del modelo, m/s)`}</Pre>
          </Card>
          <Card title="Procedimiento">
            <Pre>{`t₀ = ${fmt(R.a, 4)}      tolerancia = 10⁻¹⁰`}</Pre>
            <DataTable
              cols={[
                { k: 'i', h: 'n' },
                { k: 'x', h: 'tₙ', f: (v) => fmt(v, 8) },
                { k: 'fx', h: 'f(tₙ)', f: (v) => fmt(v, 6) },
                { k: 'dfx', h: 'f′(tₙ)', f: (v) => fmt(v, 5) },
                { k: 'xn', h: 'tₙ₊₁', f: (v) => fmt(v, 8) },
                { k: 'err', h: '|tₙ₊₁ − tₙ|', f: (v) => fmt(v, 10) },
              ]}
              rows={rows}
            />
            <Pre>{`RESULTADO: t* ≈ ${fmt(N.root, 8)} s  en ${rows.length} iteraciones
Interpretación: según el modelo llegarías a ${R.Dstar} m a los ${fmt(N.root, 1)} s, yendo a ${fmt(R.df(N.root) * 3.6, 0)} km/h.`}</Pre>
          </Card>
          <Card title="Gráfica: tangentes de Newton">
            <LineChart
              xLabel="tiempo t (s)" yLabel="f(t)" xDomain={[lo, hi]}
              hlines={[{ y: 0, color: C.grey }]}
              series={[
                { name: 'f(t)', color: C.cyan, points: curve, mode: 'line' },
                { name: 'tangentes (primeras 5)', color: C.orange, points: tangents[0].points, mode: 'line', width: 1.6, group: 'tangents' },
                ...tangents.slice(1),
                { color: C.yellow, points: rows.slice(0, 5).map((r) => [r.x, r.fx]), mode: 'dots', r: 4 },
              ]}
            />
          </Card>
        </>
      );
    },

    // ================================================================ COMPARACIÓN
    comp: () => {
      if (!R.ok) return noRoot;
      const colors = [C.orange, C.violet, C.green];
      return (
        <>
          <Card title="Los tres métodos resolvieron el mismo problema">
            <p>Instante en que se alcanzan <b>{R.Dstar} m</b> según el modelo de tu partida:</p>
            <DataTable
              cols={[
                { k: 'name', h: 'Método' },
                { k: 'iters', h: 'Iteraciones' },
                { k: 'root', h: 't* (s)', f: (v) => fmt(v, 6) },
                { k: 'fr', h: '|f(t*)|', f: (v) => fmt(v, 8) },
                { k: 'err', h: 'Error vs. raíz exacta', f: (v) => fmt(v, 10) },
                { k: 'order', h: 'Velocidad de convergencia' },
              ]}
              rows={R.compare}
            />
          </Card>
          <Card title="Gráfica: ¿qué tan rápido baja el error?">
            <LineChart
              logY xLabel="iteración" yLabel="error |tₙ − t*|"
              series={R.compare.map((c, i) => ({ name: c.name, color: colors[i], points: c.curve, mode: 'both', r: 3.2 }))}
            />
            <Note>
              Newton-Raphson llega a la precisión máxima en {R.compare[2].iters} pasos porque su error se <b>eleva al cuadrado</b> en cada
              iteración; el punto fijo ({R.compare[1].iters}) mejora una fracción constante; la bisección ({R.compare[0].iters}) solo
              divide el intervalo entre 2, pero <b>nunca falla</b> mientras haya cambio de signo.
            </Note>
          </Card>
          <Card title="Conclusión de tu partida">
            <Pre>{`• Regresión lineal:       v(t) = ${fmt(A.linV.a, 3)} + ${fmt(A.linV.b, 4)}·t     (R² = ${fmt(A.linV.r2, 4)})
• Regresión polinomial:   d(t) = ${fmt(A.poly.coef[0], 2)} + ${fmt(A.poly.coef[1], 3)}·t + ${fmt(A.poly.coef[2], 5)}·t²   (R² = ${fmt(A.poly.r2, 5)})
• Trapecio:               ${fmt(A.trap.total, 2)} m   (error ${fmt(A.errTrap, 3)} m)
• Simpson 1/3:            ${fmt(A.simp.total, 2)} m   (error ${fmt(A.errSimp, 3)} m)
• Raíz (3 métodos):       t* = ${fmt(R.ref, 4)} s para llegar a ${R.Dstar} m`}</Pre>
          </Card>
        </>
      );
    },
  };

  return (
    <div className="analysis">
      {header}
      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={id === tab ? 'on' : ''} onClick={() => { setTab(id); window.scrollTo({ top: 0 }); }}>
            {label}
          </button>
        ))}
      </nav>
      <main className="an-body" key={tab}>{panels[tab]()}</main>
    </div>
  );
}
