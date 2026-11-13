// Sonidos sintetizados con WebAudio (sin archivos externos).
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.eng = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      // zumbido del motor
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      const g = this.ctx.createGain();
      g.gain.value = 0.0;
      osc.connect(lp).connect(g).connect(this.master);
      osc.start();
      this.eng = { osc, g };
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }

  engine(v, boost, active) {
    if (!this.eng) return;
    const t = this.ctx.currentTime;
    this.eng.osc.frequency.setTargetAtTime(45 + v * 2.6 + (boost ? 25 : 0), t, 0.08);
    this.eng.g.gain.setTargetAtTime(active ? 0.035 : 0, t, 0.1);
  }

  blip(f0, f1, dur, type = 'square', vol = 0.12) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.25) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(g).connect(this.master);
    s.start();
  }

  crash() { this.noise(0.45, 0.35); this.blip(180, 40, 0.4, 'sawtooth', 0.2); }
  fall() { this.blip(700, 60, 1.0, 'sine', 0.18); }
  boost() { this.blip(300, 1200, 0.35, 'sawtooth', 0.12); }
  levelup() { this.blip(520, 780, 0.12, 'square', 0.1); setTimeout(() => this.blip(780, 1040, 0.18, 'square', 0.1), 120); }

  dispose() {
    try { this.ctx && this.ctx.close(); } catch { /* nada */ }
    this.ctx = null;
    this.eng = null;
  }
}
