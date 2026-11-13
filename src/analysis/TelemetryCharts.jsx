import React, { useId, useEffect, useRef, useState } from 'react';
import './charts.css';

export const C = {
  cyan: '#2de2d2', orange: '#ffb35b', green: '#65e8a0', pink: '#ff87c7',
  yellow: '#f8d76c', red: '#ff647f', violet: '#b5a1ff', grey: '#9babbe',
};
const M = { l: 68, r: 24, t: 30, b: 54 };
const number = (value) => {
  const a = Math.abs(value);
  if (a === 0) return '0';
  if (a >= 1e6 || a < .001) return value.toExponential(2);
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(value);
};
function ticks(lo, hi, target = 6) {
  const raw = (hi - lo) / target, mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1.5 ? 1 : norm <= 3 ? 2 : norm <= 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6 && out.length < 50; v += step) out.push(+v.toPrecision(12));
  return out;
}
const nearest = (points, x) => points.reduce((best, p) => !best || Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best, null);

/** Conserva puntos, rectas y escalones reales; no suaviza ni interpola los datos. */
export function LineChart({ series, vlines = [], hlines = [], xLabel, yLabel, height = 340, logY = false, xDomain, yDomain }) {
  const uid = useId().replace(/:/g, '');
  const wrap = useRef(null);
  const [W, setWidth] = useState(900);
  const [hidden, setHidden] = useState(new Set());
  const [cursor, setCursor] = useState(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, Math.round(entry.contentRect.width))));
    if (wrap.current) observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);

  const valid = ([x, y]) => Number.isFinite(x) && Number.isFinite(y) && (!logY || y > 0);
  const clean = series.map(s => ({ ...s, points: s.points.filter(valid) }));
  const points = clean.flatMap(s => s.points);
  const tf = y => logY ? Math.log10(y) : y;
  const H = W < 500 ? Math.max(height, 310) : height;
  const iw = W - M.l - M.r, ih = H - M.t - M.b, base = M.t + ih;
  const xs = points.map(p => p[0]).concat(vlines.filter(v => Number.isFinite(v.x)).map(v => v.x));
  const ys = points.map(p => tf(p[1])).concat(hlines.filter(h => Number.isFinite(h.y) && (!logY || h.y > 0)).map(h => tf(h.y)));
  // Un área de integración debe partir del cero, no del mínimo de la muestra.
  if (!logY && series.some(s => s.mode === 'area')) ys.push(0);
  let [x0, x1] = xDomain || [Math.min(...xs), Math.max(...xs)];
  let [y0, y1] = yDomain ? yDomain.map(tf) : [Math.min(...ys), Math.max(...ys)];
  if (!(x1 > x0)) x1 = x0 + 1;
  if (!(y1 > y0)) y1 = y0 + 1;
  if (!xDomain) { const pad = (x1 - x0) * .025; x0 -= pad; x1 += pad; }
  if (!yDomain) { const pad = (y1 - y0) * .09; y0 -= pad; y1 += pad; }
  const sx = x => M.l + (x - x0) / (x1 - x0) * iw;
  const sy = y => M.t + ih - (tf(y) - y0) / (y1 - y0) * ih;
  const areaBase = logY ? base : Math.min(base, Math.max(M.t, sy(0)));
  const xt = ticks(x0, x1, Math.max(2, Math.floor(iw / 110)));
  const yt = logY ? ticks(Math.ceil(y0), Math.floor(y1) > Math.ceil(y0) ? Math.floor(y1) : Math.ceil(y0) + 1, 5).filter(t => Number.isInteger(t) && t >= y0 && t <= y1) : ticks(y0, y1, 5);
  const yTick = t => logY ? M.t + ih - (t - y0) / (y1 - y0) * ih : sy(t);
  const path = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`).join(' ');
  const segments = s => {
    const result = []; let part = [];
    for (const p of s.points) { if (valid(p)) part.push(p); else if (part.length) { result.push(part); part = []; } }
    if (part.length) result.push(part);
    return result;
  };
  const named = clean.map((s, i) => ({ ...s, i })).filter(s => s.name);
  const visible = clean.map((s, i) => ({ ...s, i })).filter(s => !hidden.has(s.i));
  const sampleXs = [...new Set(visible.flatMap(s => s.points.map(p => p[0])))].sort((a, b) => a - b);
  const active = cursor === null ? null : nearest(sampleXs.map(x => [x, 0]), cursor)?.[0] ?? null;
  const rows = active === null ? [] : visible.filter(s => s.name).map(s => ({ ...s, point: nearest(s.points, active) })).filter(s => s.point);
  const onPointer = event => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width * W;
    setCursor(x0 + (Math.max(M.l, Math.min(W - M.r, x)) - M.l) / iw * (x1 - x0));
  };
  const onKey = event => {
    if (!sampleXs.length) return;
    let index = Math.max(0, sampleXs.indexOf(active));
    if (event.key === 'ArrowRight') index = Math.min(sampleXs.length - 1, index + 1);
    else if (event.key === 'ArrowLeft') index = Math.max(0, index - 1);
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = sampleXs.length - 1;
    else if (event.key === 'Escape') { setCursor(null); return; }
    else return;
    event.preventDefault(); setCursor(sampleXs[index]);
  };
  const omitted = logY && series.some(s => s.points.some(([x, y]) => Number.isFinite(x) && y <= 0));

  return <figure className="telemetry-chart">
    <figcaption className="telemetry-toolbar">
      <div className="telemetry-legend">{named.map(s => <button type="button" key={s.i} aria-pressed={!hidden.has(s.i)} style={{ '--series': s.color }} onClick={() => setHidden(old => {
        const next = new Set(old), hide = !next.has(s.i);
        clean.forEach((item, i) => { if (i === s.i || (s.group && item.group === s.group)) { hide ? next.add(i) : next.delete(i); } });
        return next;
      })}><i className={s.dash ? 'is-dashed' : ''} /><span>{s.name}</span></button>)}</div>
      <span className="telemetry-scale">{logY ? 'ESCALA LOGARÍTMICA' : 'ESCALA LINEAL'}</span>
    </figcaption>
    <div className="telemetry-plot" ref={wrap}>
      {!points.length ? <p className="telemetry-empty">No hay datos válidos para esta gráfica.</p> : <>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" tabIndex="0" aria-label={`${yLabel || 'Valores'} frente a ${xLabel || 'muestras'}. Usa las flechas para consultar datos.`} aria-describedby={`hint${uid}`} onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={() => setCursor(null)} onFocus={() => setCursor(sampleXs[0] ?? null)} onBlur={() => setCursor(null)} onKeyDown={onKey}>
          <title>{yLabel} · {xLabel}</title>
          <defs>
            <clipPath id={`plot${uid}`}><rect x={M.l} y={M.t} width={iw} height={ih} /></clipPath>
            {clean.map((s, i) => <linearGradient key={i} id={`area${uid}-${i}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={s.color} stopOpacity=".3" /><stop offset="1" stopColor={s.color} stopOpacity=".015" /></linearGradient>)}
          </defs>
          {yt.map(t => <g key={`y${t}`}><line x1={M.l} x2={W - M.r} y1={yTick(t)} y2={yTick(t)} className="telemetry-grid" /><text x={M.l - 12} y={yTick(t) + 4} textAnchor="end" className="telemetry-tick">{logY ? <>10<tspan baselineShift="super" fontSize="8">{t}</tspan></> : number(t)}</text></g>)}
          {xt.map(t => <g key={`x${t}`}><line x1={sx(t)} x2={sx(t)} y1={M.t} y2={base} className="telemetry-grid telemetry-grid--vertical" /><text x={sx(t)} y={base + 23} textAnchor="middle" className="telemetry-tick">{number(t)}</text></g>)}
          <line x1={M.l} x2={W - M.r} y1={base} y2={base} className="telemetry-axis" />
          <text x={M.l + iw / 2} y={H - 7} textAnchor="middle" className="telemetry-label">{xLabel}</text>
          <text transform={`translate(17 ${M.t + ih / 2}) rotate(-90)`} textAnchor="middle" className="telemetry-label">{yLabel}</text>
          <g clipPath={`url(#plot${uid})`}>
            {visible.map(s => <g key={s.i}>
              {segments(series[s.i]).map((part, j) => <g key={j}>
                {s.mode === 'area' && part.length > 1 && <path d={`${path(part)} L${sx(part.at(-1)[0])},${areaBase} L${sx(part[0][0])},${areaBase}Z`} fill={`url(#area${uid}-${s.i})`} />}
                {(!s.mode || ['line', 'both', 'area'].includes(s.mode)) && <path d={path(part)} fill="none" stroke={s.color} strokeWidth={s.width || 2.7} strokeDasharray={s.dash ? '7 6' : undefined} strokeLinejoin="round" strokeLinecap="round" />}
              </g>)}
              {s.mode === 'stems' && s.points.map(([x, y], i) => <line key={i} x1={sx(x)} x2={sx(x)} y1={areaBase} y2={sy(y)} stroke={s.color} opacity=".25" />)}
              {['dots', 'both'].includes(s.mode) && s.points.map(([x, y], i) => <circle key={i} cx={sx(x)} cy={sy(y)} r={s.r || 3} fill={s.color} fillOpacity={s.opacity ?? .95} stroke="#0b1828" strokeWidth="1" />)}
              {s.labels && series[s.i].points.map((p, i) => valid(p) && <text key={i} x={Math.min(W - M.r - 15, sx(p[0]) + 7)} y={Math.max(M.t + 12, sy(p[1]) - 8)} className="telemetry-point-label" fill={s.color}>{s.labels[i]}</text>)}
            </g>)}
            {hlines.filter(h => valid([0, h.y])).map((h, i) => <g key={i}><line x1={M.l} x2={W - M.r} y1={sy(h.y)} y2={sy(h.y)} stroke={h.color || C.grey} strokeDasharray="5 5" />{h.label && <text x={W - M.r - 8} y={sy(h.y) - 6} textAnchor="end" className="telemetry-point-label" fill={h.color || C.grey}>{h.label}</text>}</g>)}
            {vlines.map((v, i) => <line key={i} x1={sx(v.x)} x2={sx(v.x)} y1={M.t} y2={base} stroke={v.color || C.red} strokeDasharray="4 6" opacity=".65" />)}
            {active !== null && <g><line x1={sx(active)} x2={sx(active)} y1={M.t} y2={base} stroke="#d1ebf7" strokeDasharray="3 4" opacity=".65" />{rows.map(s => <g key={s.i}><circle cx={sx(s.point[0])} cy={sy(s.point[1])} r="8" fill={s.color} opacity=".18" /><circle cx={sx(s.point[0])} cy={sy(s.point[1])} r="4" fill={s.color} stroke="#f5fcff" strokeWidth="1.5" /></g>)}</g>}
          </g>
          {vlines.map((v, i) => <g key={i} transform={`translate(${Math.max(M.l + 10, Math.min(W - M.r - 10, sx(v.x)))},${M.t + 9 + (i % 2) * 22})`}><circle r="9" fill="#2e1929" stroke={v.color || C.red} /><text textAnchor="middle" y="3.5" fontSize="10" fill="#ffdce3" fontWeight="800">{i + 1}</text></g>)}
        </svg>
        {!!rows.length && <div className="telemetry-tooltip" style={sx(active) > W * .55 ? { right: `${Math.min(45, (1 - sx(active) / W) * 100 + 2)}%` } : { left: `${Math.min(48, sx(active) / W * 100 + 2)}%` }}>
          <strong>{xLabel || 'x'}: {number(active)}</strong>
          {rows.map(s => <div key={s.i}><span><i style={{ background: s.color }} />{s.name}</span><b>{number(s.point[1])}</b>{s.point[0] !== active && <small>Muestra en x = {number(s.point[0])}</small>}</div>)}
        </div>}
      </>}
    </div>
    {!!vlines.length && <div className="telemetry-events" aria-label="Eventos señalados">{vlines.map((v, i) => <span key={i}><b>{i + 1}</b>{v.label || 'Evento'}<small>{number(v.x)} s</small></span>)}</div>}
    <div className="telemetry-foot" id={`hint${uid}`}><span>● Pasa el cursor o toca para ver valores · ← → con teclado</span><span>{points.length} puntos{omitted ? ' · valores ≤ 0 omitidos en escala logarítmica' : ''}</span></div>
  </figure>;
}

/** Barras sobre una escala común; el valor cero conserva longitud cero. */
export function BarChart({ items, unit = '' }) {
  const valid = items.filter(it => Number.isFinite(it.value));
  const max = Math.max(...valid.map(it => Math.abs(it.value)), 1e-12);
  const min = Math.min(...valid.map(it => it.value));
  return <figure className="telemetry-chart telemetry-bars">
    <figcaption className="telemetry-toolbar"><span className="telemetry-scale">COMPARACIÓN DE RESULTADOS</span><span className="telemetry-scale">{unit.trim() ? `UNIDAD: ${unit.trim()}` : 'ESCALA COMÚN'}</span></figcaption>
    <div className="telemetry-bar-list">{valid.map((it, i) => <div className="telemetry-bar-row" key={it.label} style={{ '--bar-color': it.color, '--bar-width': `${Math.abs(it.value) / max * 100}%` }}>
      <div className="telemetry-bar-heading"><span><i />{it.label}</span><strong>{it.text ?? `${it.value.toFixed(4)}${unit}`}</strong></div>
      <div className="telemetry-bar-track" role="img" aria-label={`${it.label}: ${it.text ?? `${it.value}${unit}`}`}><span /></div>
      <div className="telemetry-bar-meta"><span>{it.value === min && valid.length > 1 ? 'MENOR VALOR' : `RESULTADO ${String(i + 1).padStart(2, '0')}`}</span><span>{it.value === 0 ? 'Valor cero' : `${(Math.abs(it.value) / max * 100).toFixed(1)} % del mayor valor absoluto`}</span></div>
    </div>)}</div>
  </figure>;
}
