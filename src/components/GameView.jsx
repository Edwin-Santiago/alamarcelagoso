import React, { useEffect, useRef, useState } from 'react';
import { Engine } from '../game/engine.js';
import { MAX_LIVES } from '../game/logic.js';
import VoxelHearts from './VoxelHearts.jsx';

const INITIAL = { dist: 0, v: 0, level: 1, lives: MAX_LIVES, time: 0, boost: 0, invuln: 0, status: 'playing' };
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function GameView({ onFinish, onExit }) {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const toastTimer = useRef(0);
  const [hud, setHud] = useState(INITIAL);
  const [toast, setToast] = useState(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const show = (text, kind) => {
      setToast({ text, kind, id: Math.random() });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 1900);
    };
    const engine = new Engine(mountRef.current, {
      onHud: setHud,
      onEvent: (e) => {
        if (e.type === 'death') {
          show(
            e.cause === 'hueco' ? '🕳️ ¡CAÍSTE EN UN HUECO!' : '💥 ¡CHOCASTE CON UNA ROCA!',
            'bad',
          );
        } else if (e.type === 'levelup') show(`NIVEL ${e.level} · más velocidad`, 'good');
        else if (e.type === 'boost') show('⚡ ¡NITRO!', 'nitro');
        else if (e.type === 'pause') setPaused(e.paused);
        else if (e.type === 'mute') setMuted(e.muted);
        else if (e.type === 'result') setResult(e.result);
      },
    });
    engineRef.current = engine;
    if (new URLSearchParams(location.search).has('debug')) window.__rr = engine;
    engine.start();
    return () => {
      clearTimeout(toastTimer.current);
      engine.dispose();
    };
  }, []);

  const kmh = Math.round(hud.v * 3.6);
  return (
    <div className="game">
      <div className="viewport" ref={mountRef} />

      <div className="hud">
        <div className="hud-left">
          <div className="pill"><span className="ico">🏁</span><b>{Math.floor(hud.dist)}</b> m</div>
          <div className="pill"><span className="ico">⏱</span><b>{mmss(hud.time)}</b></div>
          <div className="pill"><span className="ico">LV</span><b>{hud.level}</b></div>
        </div>

        <div className="hud-center">
          <div className="speed">
            <b>{kmh}</b><small>km/h</small>
          </div>
          <div className="bar"><i style={{ width: `${Math.min(100, (kmh / 230) * 100)}%` }} className={hud.boost > 0 ? 'boost' : ''} /></div>
          {hud.boost > 0 && <div className="nitro">⚡ NITRO {hud.boost.toFixed(1)}s</div>}
        </div>

        <div className="hud-right">
          <VoxelHearts lives={hud.lives} maxLives={MAX_LIVES} />
          <div className="mini">{muted ? '🔇' : '🔊'} · <kbd>P</kbd> pausa</div>
        </div>
      </div>

      <div className="controls-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> conducir</div>

      {toast && <div key={toast.id} className={`toast ${toast.kind}`}>{toast.text}</div>}

      {paused && (
        <div className="overlay">
          <div className="panel">
            <h2>PAUSA</h2>
            <p>Pulsa <kbd>P</kbd> para continuar</p>
            <div className="row">
              <button className="btn" onClick={() => engineRef.current.setPaused(false)}>Continuar</button>
              <button className="btn ghost" onClick={onExit}>Salir al menú</button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="overlay">
          <div className="panel">
            <h2 className="over">SIN VIDAS</h2>
            <p>
              Recorriste <b>{Math.floor(result.dist)} m</b> en <b>{mmss(result.time)}</b> y llegaste al{' '}
              <b>nivel {result.level}</b>.
            </p>
            <p className="dim">Ya guardamos los datos de tu partida (tiempo, distancia y velocidad cada 0.5 s).</p>
            <button className="btn" onClick={() => onFinish(result)}>VER ANÁLISIS NUMÉRICO →</button>
          </div>
        </div>
      )}
    </div>
  );
}
