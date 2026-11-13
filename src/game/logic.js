// Núcleo del juego SIN gráficos: física, obstáculos, vidas, dificultad y registro de datos.
// Se puede probar en Node (scripts/sim-bot.mjs) y el motor 3D solo lo dibuja.

export const ROAD_W = 13;
export const SLOTS = 5;
export const SLOT_W = ROAD_W / SLOTS; // 2.6 m por carril "virtual"
export const SLOT_X = Array.from({ length: SLOTS }, (_, i) => (i - (SLOTS - 1) / 2) * SLOT_W);
export const SPAWN_Z = -260;
export const DESPAWN_Z = 30;
export const CAR = { halfW: 0.95, halfL: 2.15 };
export const X_MAX = ROAD_W / 2 - 1.05;
export const LEVEL_DIST = 600; // cada 600 m sube el nivel
export const SAMPLE_DT = 0.5; // se guarda un dato cada 0.5 s de juego
export const MAX_LIVES = 3;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const levelOf = (d) => 1 + Math.floor(d / LEVEL_DIST);
// la velocidad base sube por escalones (cada nivel), no de forma continua
export const levelSpeed = (L) => 20 + 3.4 * (Math.min(L, 12) - 1);
export const rowGap = (L) => Math.max(22, 40 - 2.2 * (L - 1));
export const blockedTarget = (L) => 1 + (L - 1) * 0.38;
export const holeProb = (L) => Math.min(0.55, 0.3 + 0.03 * (L - 1));

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GameCore {
  constructor(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.seed = seed;
    this.reset();
  }

  reset() {
    this.rng = mulberry32(this.seed);
    this.status = 'playing'; // 'playing' | 'over'
    this.time = 0;
    this.dist = 0;
    this.v = levelSpeed(1);
    this.x = 0;
    this.vx = 0;
    this.level = 1;
    this.lives = MAX_LIVES;
    this.invuln = 0;
    this.boostT = 0;
    this.respawnT = 0;
    this.respawnMax = 1;
    this.deathCause = null;
    this.pendingOver = false;
    this.obstacles = [];
    this.pickups = [];
    this.nextId = 1;
    this.rowId = 0;
    this.prevFree = 2;
    this.samples = [{ t: 0, d: 0, v: this.v, level: 1 }];
    this.sampleIdx = 1;
    this.deaths = [];
    this.levelUps = [];
    this.stats = { rocks: 0, holes: 0, rows: 0, pickups: 0, passed: 0 };
    this.nextPickupT = 12 + this.rng() * 8;

    // Carretera inicial ya poblada (primera fila a 70 m del carro)
    let z = -70;
    while (z > SPAWN_Z) {
      this.spawnRow(z, true);
      z -= rowGap(1) + this.rng() * 6;
    }
    this.nextRowDist = SPAWN_Z - z;
  }

  spawnRow(z, initial = false) {
    const r = this.rng;
    const L = levelOf(this.dist);
    const free = clamp(this.prevFree + Math.floor(r() * 3) - 1, 0, SLOTS - 1);
    this.prevFree = free;
    const k = clamp(Math.round(blockedTarget(L) + (r() - 0.5) * 1.2), 1, SLOTS - 1);
    const slots = [];
    for (let i = 0; i < SLOTS; i++) if (i !== free) slots.push(i);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const rowId = ++this.rowId;
    for (const s of slots.slice(0, k)) {
      const isHole = r() < holeProb(L);
      const o = {
        id: this.nextId++,
        rowId,
        type: isHole ? 'hole' : 'rock',
        x: SLOT_X[s],
        z,
        freeX: SLOT_X[free],
        seed: r(),
        passed: false,
      };
      if (isHole) {
        o.w = SLOT_W * 0.96;
        o.len = 4 + r() * 3;
        this.stats.holes++;
      } else {
        o.r = 0.85 + r() * 0.3;
        this.stats.rocks++;
      }
      this.obstacles.push(o);
    }
    this.stats.rows++;
    // Pickup de nitro: raro (cada 14-28 s) y siempre en el carril libre
    if (!initial && this.time >= this.nextPickupT) {
      this.pickups.push({ id: this.nextId++, x: SLOT_X[free], z: z - 8 });
      this.nextPickupT = this.time + 14 + r() * 14;
    }
  }

  die(cause, ev) {
    this.lives -= 1;
    this.deaths.push({
      n: MAX_LIVES - this.lives,
      cause,
      t: this.time,
      d: this.dist,
      v: this.v,
      level: this.level,
    });
    this.deathCause = cause;
    this.respawnMax = cause === 'hueco' ? 1.1 : 0.8;
    this.respawnT = this.respawnMax;
    this.pendingOver = this.lives <= 0;
    ev.push({ type: 'death', cause, lives: this.lives });
  }

  update(dt, input) {
    const ev = [];
    if (this.status !== 'playing') return ev;
    const prevT = this.time;
    const prevD = this.dist;
    const prevV = this.v;
    this.time += dt;
    const dead = this.respawnT > 0;

    // ----- velocidad -----
    const baseV = levelSpeed(this.level);
    let target;
    if (dead) target = baseV * 0.22;
    else {
      let m = input.up ? 1.22 : input.down ? 0.62 : 1;
      if (this.boostT > 0) m *= 1.35;
      target = baseV * m;
    }
    const rate = this.v < target ? 15 : 30;
    this.v += clamp(target - this.v, -rate * dt, rate * dt);
    this.boostT = Math.max(0, this.boostT - dt);
    this.invuln = Math.max(0, this.invuln - dt);

    // ----- dirección -----
    const steer = dead ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const maxVx = 11.5 * (0.55 + 0.45 * Math.min(1, this.v / 28));
    this.vx += (steer * maxVx - this.vx) * Math.min(1, 12 * dt);
    this.x += this.vx * dt;
    if (this.x > X_MAX) {
      this.x = X_MAX;
      this.vx = Math.min(this.vx, 0);
    } else if (this.x < -X_MAX) {
      this.x = -X_MAX;
      this.vx = Math.max(this.vx, 0);
    }

    // ----- avance del mundo -----
    const dz = this.v * dt;
    this.dist += dz;
    for (const o of this.obstacles) {
      o.z += dz;
      if (!o.passed && o.z > CAR.halfL + 2) {
        o.passed = true;
        this.stats.passed++;
      }
    }
    for (const p of this.pickups) p.z += dz;
    this.obstacles = this.obstacles.filter((o) => o.z < DESPAWN_Z);
    this.pickups = this.pickups.filter((p) => p.z < DESPAWN_Z);

    // ----- nivel (la dificultad sube con el recorrido) -----
    const L = levelOf(this.dist);
    if (L > this.level) {
      this.level = L;
      this.levelUps.push({ level: L, t: this.time, d: this.dist });
      ev.push({ type: 'levelup', level: L });
    }

    // ----- generación de filas de obstáculos -----
    while (this.dist >= this.nextRowDist) {
      this.spawnRow(SPAWN_Z + (this.dist - this.nextRowDist));
      this.nextRowDist += rowGap(this.level) + this.rng() * 6;
    }

    // ----- colisiones -----
    if (!dead && this.invuln <= 0) {
      for (const o of this.obstacles) {
        if (o.type === 'rock') {
          if (
            Math.abs(this.x - o.x) < CAR.halfW + o.r * 0.85 &&
            Math.abs(o.z) < CAR.halfL + o.r * 0.85
          ) {
            this.obstacles = this.obstacles.filter((q) => q !== o);
            this.die('roca', ev);
            break;
          }
        } else if (Math.abs(o.z) < o.len / 2 && Math.abs(this.x - o.x) < o.w / 2 - 0.35) {
          this.die('hueco', ev);
          break;
        }
      }
    }
    if (!dead) {
      for (const p of this.pickups) {
        if (Math.abs(p.z) < 2.6 && Math.abs(this.x - p.x) < 1.6) {
          this.pickups = this.pickups.filter((q) => q !== p);
          this.boostT = 5;
          this.stats.pickups++;
          ev.push({ type: 'boost' });
          break;
        }
      }
    }

    // ----- fin de la animación de muerte -----
    if (dead) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        this.respawnT = 0;
        if (this.pendingOver) {
          this.status = 'over';
          ev.push({ type: 'gameover' });
        } else {
          this.invuln = 2.2;
          if (this.deathCause === 'hueco') {
            this.x = 0;
            this.vx = 0;
          }
          this.obstacles = this.obstacles.filter((o) => o.z < -40 || o.z > 15);
          ev.push({ type: 'respawn' });
        }
      }
    }

    // ----- muestreo uniforme cada 0.5 s (interpolado) -----
    while (this.sampleIdx * SAMPLE_DT <= this.time) {
      const tb = this.sampleIdx * SAMPLE_DT;
      const a = (tb - prevT) / dt;
      this.samples.push({
        t: tb,
        d: prevD + (this.dist - prevD) * a,
        v: prevV + (this.v - prevV) * a,
        level: this.level,
      });
      this.sampleIdx++;
    }
    return ev;
  }

  result() {
    return {
      samples: this.samples,
      deaths: this.deaths,
      levelUps: this.levelUps,
      stats: { ...this.stats },
      dist: this.dist,
      time: this.time,
      level: this.level,
      maxV: Math.max(...this.samples.map((s) => s.v)),
    };
  }
}
