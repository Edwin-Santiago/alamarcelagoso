import { assetUrl } from '../assetUrl.js';
// Motor de render 3D (Three.js). Dibuja el estado que calcula GameCore.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameCore, ROAD_W, SLOT_W, CAR, SPAWN_Z, MAX_LIVES, levelSpeed } from './logic.js';
import { roadSurface, surface, rock as detailedRock, pothole as recessedPothole, cutRoad, updateHoles, shrub, mountains, sky, textureLoads } from './graphics.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sfx } from './sfx.js';

const STEP = 1 / 60;
const FOG = 0xc2bcb0;

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeRoadTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#3a3c41';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const g = Math.random() < 0.5 ? 0 : 255;
      ctx.fillStyle = `rgba(${g},${g},${g},${0.04 + Math.random() * 0.07})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      let x = Math.random() * w;
      let y = Math.random() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (Math.random() - 0.5) * 40;
        y += Math.random() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#ececec';
    ctx.fillRect(w * 0.022, 0, w * 0.014, h);
    ctx.fillRect(w * (1 - 0.036), 0, w * 0.014, h);
    ctx.fillStyle = '#f4f4f4';
    for (const x of [w / 3, (2 * w) / 3]) ctx.fillRect(x - w * 0.006, 0, w * 0.012, h * 0.33);
  });
}

function makeSandTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#dcb67f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) {
      const dark = Math.random() < 0.5;
      ctx.fillStyle = dark ? `rgba(120,80,40,${Math.random() * 0.12})` : `rgba(255,235,190,${Math.random() * 0.14})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2);
    }
    ctx.strokeStyle = 'rgba(140,95,50,0.10)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 5);
      ctx.stroke();
    }
  });
}

function makeHoleTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const pts = [];
    const N = 36;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      // rectángulo redondeado irregular
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      const k = 1 / Math.max(Math.abs(cx), Math.abs(cy));
      const rr = 0.9 + Math.random() * 0.1;
      pts.push([w / 2 + cx * k * (w / 2) * 0.86 * rr, h / 2 + cy * k * (h / 2) * 0.86 * rr]);
    }
    const path = () => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    path();
    ctx.fillStyle = '#1e1f22';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#2c2d31';
    ctx.stroke();
    ctx.save();
    path();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#6b4528');
    g.addColorStop(0.2, '#2a1a10');
    g.addColorStop(0.6, '#050302');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }, false);
}

function makePit(o) {
  const group = new THREE.Group();
  const rx = Math.max(0.95, o.w * 0.68);
  const rz = Math.max(1.25, o.len * 0.6);
  const segments = 40;
  const rings = [
    { r: 1.28, y: 0.015 },
    { r: 1.04, y: 0.075 },
    { r: 0.83, y: -0.08 },
    { r: 0.58, y: -0.42 },
    { r: 0.12, y: -0.55 },
  ];
  const points = rings.map((ring, ringIndex) => Array.from({ length: segments }, (_, i) => {
    const a = i / segments * Math.PI * 2;
    const wobble = 1 + 0.055 * Math.sin(a * 3 + o.seed * 12) + 0.035 * Math.cos(a * 7 + o.seed * 5);
    return [Math.cos(a) * rx * ring.r * wobble, ring.y, Math.sin(a) * rz * ring.r * wobble];
  }));
  const vertices = [];
  const indices = [];
  for (const ring of points) for (const p of ring) vertices.push(...p);
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < segments; i++) {
      const a = r * segments + i;
      const b = r * segments + (i + 1) % segments;
      const c = (r + 1) * segments + i;
      const d = (r + 1) * segments + (i + 1) % segments;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const rim = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  const colors = [];
  const palette = [new THREE.Color('#c9a06b'), new THREE.Color('#9a7049'), new THREE.Color('#50341f'), new THREE.Color('#21160f'), new THREE.Color('#100c09')];
  for (let r = 0; r < rings.length; r++) for (let i = 0; i < segments; i++) {
    const color = palette[r];
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  group.add(rim);

  // La carretera es plana; estos relieves superpuestos forman la boca oscura visible desde cámara.
  const mouth = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshStandardMaterial({ color: 0x100d0a, roughness: 1, side: THREE.DoubleSide }),
  );
  mouth.rotation.x = -Math.PI / 2;
  mouth.scale.set(rx * 0.63, rz * 0.63, 1);
  mouth.position.y = 0.026;
  group.add(mouth);

  const innerRim = new THREE.Mesh(
    new THREE.RingGeometry(0.63, 0.84, 40),
    new THREE.MeshStandardMaterial({ color: 0x49321f, roughness: 1, side: THREE.DoubleSide }),
  );
  innerRim.rotation.x = -Math.PI / 2;
  innerRim.scale.set(rx, rz, 1);
  innerRim.position.y = 0.028;
  group.add(innerRim);

  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshStandardMaterial({ color: 0x080706, roughness: 1, side: THREE.DoubleSide }),
  );
  bottom.rotation.x = -Math.PI / 2;
  bottom.scale.set(rx * 0.24, rz * 0.24, 1);
  bottom.position.y = -0.53;
  group.add(bottom);

  const dust = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 1.08, 40),
    new THREE.MeshStandardMaterial({ color: 0xe1bd84, roughness: 1, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  dust.rotation.x = -Math.PI / 2;
  dust.scale.set(rx, rz, 1);
  dust.position.y = 0.025;
  group.add(dust);
  return group;
}

function roundedBox(w, h, d, bevel = 0.08) {
  const shape = new THREE.Shape();
  const r = Math.min(bevel, w / 4, h / 4);
  shape.moveTo(-w / 2 + r, 0);
  shape.lineTo(w / 2 - r, 0);
  shape.quadraticCurveTo(w / 2, 0, w / 2, r);
  shape.lineTo(w / 2, h - r);
  shape.quadraticCurveTo(w / 2, h, w / 2 - r, h);
  shape.lineTo(-w / 2 + r, h);
  shape.quadraticCurveTo(-w / 2, h, -w / 2, h - r);
  shape.lineTo(-w / 2, r);
  shape.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: bevel * 0.45, bevelThickness: bevel * 0.45, curveSegments: 4 });
  geo.translate(0, 0, -d / 2);
  geo.computeVertexNormals();
  return geo;
}

function sportsCarBodyGeometry() {
  const keys = [
    [-2.34, 0.08, 0.96, 0.80, 0.43], [-2.12, 0.64, 1.04, 0.85, 0.31],
    [-1.48, 0.88, 1.10, 0.89, 0.27], [-0.72, 0.99, 1.13, 0.90, 0.27],
    [0.72, 0.99, 1.17, 0.92, 0.27], [1.55, 0.92, 1.12, 0.89, 0.30],
    [2.12, 0.66, 1.02, 0.82, 0.37], [2.32, 0.08, 0.97, 0.77, 0.44],
  ];
  const sections = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    for (let step = 0; step < 5; step++) {
      const raw = step / 5;
      const t = raw * raw * (3 - 2 * raw);
      sections.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  sections.push(keys[keys.length - 1]);
  const perimeter = [
    [0, 1], [0.43, 1], [0.78, 0.98], [0.95, 0.82], [1, 0.62],
    [0.96, 0.34], [0.78, 0.08], [0, 0], [-0.78, 0.08],
    [-0.96, 0.34], [-1, 0.62], [-0.95, 0.82], [-0.78, 0.98], [-0.43, 1],
  ];
  const vertices = [];
  const indices = [];
  for (const [z, width, top, shoulder, bottom] of sections) {
    for (const [xRatio, yRatio] of perimeter) {
      const y = yRatio > 0.62
        ? shoulder + (top - shoulder) * ((yRatio - 0.62) / 0.38)
        : bottom + (shoulder - bottom) * (yRatio / 0.62);
      vertices.push(xRatio * width, y, z);
    }
  }
  const ring = perimeter.length;
  for (let s = 0; s < sections.length - 1; s++) for (let p = 0; p < ring; p++) {
    const a = s * ring + p;
    const b = s * ring + (p + 1) % ring;
    const c = (s + 1) * ring + p;
    const d = (s + 1) * ring + (p + 1) % ring;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeShadowTexture() {
  return canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, false);
}

function makePlateTexture() {
  return canvasTex(128, 48, (ctx, w, h) => {
    ctx.fillStyle = '#f3f3ef';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NUM-ANL', w / 2, h / 2 + 2);
  }, false);
}

function rockGeometry(seedOffset) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seedOffset * 11.1) * 43758.5453;
    const k = 0.78 + (n - Math.floor(n)) * 0.42;
    pos.setXYZ(i, x * k, y * k * 0.85, z * k);
  }
  g.computeVertexNormals();
  return g;
}

export class Engine {
  constructor(container, { onHud, onEvent }) {
    this.container = container;
    this.onHud = onHud;
    this.onEvent = onEvent;
    this.core = new GameCore();
    this.sfx = new Sfx();
    this.input = { up: false, down: false, left: false, right: false };
    this.paused = false;
    this.raf = 0;
    this.acc = 0;
    this.last = 0;
    this.hudT = 0;
    this.shake = 0;
    this.particles = [];
    this.props = [];
    this.posts = [];
    this.environmentAssets = {};
    this.fallbackCurbs = [];
    this.propAcc = 0;
    this.postAcc = 0;
    this.obsMap = new Map();
    this.pickMap = new Map();
    this.fov = 60;
    this.t = 0;
    this.disposed = false;
    this.overSent = false;
    this.setup();
  }

  // ------------------------------------------------------------------
  setup() {
    const { container } = this;
    const w = container.clientWidth || 960;
    const h = container.clientHeight || 540;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const studio = new RoomEnvironment();
    this.environmentMap = pmrem.fromScene(studio, 0.07);
    this.scene.environment = this.environmentMap.texture;
    this.scene.environmentIntensity = 0.35;
    studio.dispose(); pmrem.dispose();
    this.scene.fog = new THREE.Fog(FOG, 160, 850);
    this.scene.add(sky());
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 900);

    this.scene.add(new THREE.HemisphereLight(0xe5f2ff, 0x817362, 1.65));
    const sun = new THREE.DirectionalLight(0xffefda, 2.0);
    sun.position.set(-35, 65, 28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {left:-45,right:45,top:60,bottom:-60,near:1,far:180});
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.00015;
    this.scene.add(sun);

    // texturas / materiales compartidos
    this.roadMaps = roadSurface();
    this.roadTex = this.roadMaps.map;
    this.texturesReady = () => Promise.all(textureLoads);
    this.roadTex.repeat.set(1, 700 / 12);
    this.sandMaps = surface('sand');
    this.sandTex = this.sandMaps.map;
    for (const key of ["map","normalMap","roughnessMap"]) this.sandMaps[key].repeat.set(900 / 6, 700 / 6);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W, 700),
      new THREE.MeshStandardMaterial({ ...this.roadMaps, roughness:0.94 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -300);
    road.receiveShadow = true;
    cutRoad(road.material);
    this.scene.add(road);
    this.roadMesh = road;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 700),
      new THREE.MeshStandardMaterial({ ...this.sandMaps, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.06, -300);
    ground.receiveShadow = true;
    cutRoad(ground.material);
    this.scene.add(ground);

    // Dunas onduladas a ambos lados de la carretera, fundidas con la arena del horizonte.
    const duneMaps = surface("sand");
    const duneMat = new THREE.MeshStandardMaterial({ ...duneMaps, roughness: 1, metalness: 0 });
    for (const side of [-1, 1]) {
      const width = 450;
      const depth = 700;
      const nx = 56;
      const nz = 100;
      const vertices = [];
      const uvs = [];
      const indices = [];
      for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
        const x = ix / nx * width;
        const z = -650 + iz / nz * depth;
        const fade = Math.sin(Math.min(1, x / 30) * Math.PI / 2);
        const wave = Math.sin(z * 0.022 + side * 1.7 + x * 0.012) * 1.25 + Math.sin(z * 0.009 - x * 0.018) * 2.1;
        const y = Math.max(0, (wave + 1.6) * fade * Math.min(1, x / 90));
        vertices.push(side * (ROAD_W / 2 + x), y - 0.045, z);
        uvs.push(x / 6, (z + 700) / 6);
        if (ix < nx && iz < nz) {
          const a = iz * (nx + 1) + ix;
          const b = a + 1;
          const c = a + nx + 1;
          const d = c + 1;
          indices.push(a, side > 0 ? c : b, side > 0 ? b : c, b, side > 0 ? c : d, side > 0 ? d : c);
        }
      }
      const duneGeo = new THREE.BufferGeometry();
      duneGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      duneGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      duneGeo.setIndex(indices);
      duneGeo.computeVertexNormals();
      this.scene.add(new THREE.Mesh(duneGeo, duneMat));
    }

    // bordillos
    const curbMat = new THREE.MeshLambertMaterial({ color: 0xc9b79a });
    for (const s of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 700), curbMat);
      curb.position.set(s * (ROAD_W / 2 + 0.25), 0.05, -300);
      this.scene.add(curb);
      this.fallbackCurbs.push(curb);
    }

    // Cordillera continua con relieve y profundidad atmosférica.
    this.scene.add(mountains());

    // geometrías de utilería
    this.rockGeos = [0, 1, 2, 3].map(rockGeometry);
    this.rockMats = [0x8d7a66, 0x7b6a58, 0x9a8470, 0x6f625a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.94, flatShading: true }));
    this.cactusMat = new THREE.MeshStandardMaterial({ color: 0x527a48, roughness: 0.78, flatShading: true });
    this.cactusGeo = {
      trunk: new THREE.CylinderGeometry(0.32, 0.4, 1, 8),
      arm: new THREE.CylinderGeometry(0.2, 0.22, 1, 7),
    };
    this.postGeo = new THREE.BoxGeometry(0.16, 1.2, 0.16);
    this.postMat = new THREE.MeshLambertMaterial({ color: 0xe9e3d3 });
    this.reflMat = new THREE.MeshBasicMaterial({ color: 0xff9a2a });
    this.rubbleGeo = new THREE.DodecahedronGeometry(0.3, 0);
    this.rubbleMat = new THREE.MeshStandardMaterial({ color: 0x886744, roughness: 1, flatShading: true });
    this.partGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);

    this.buildCar();
    this.populateInitialProps();
    this.loadEnvironmentAssets();
    this.updateCamera(1);

    // entrada
    this.onKeyDown = (e) => this.key(e, true);
    this.onKeyUp = (e) => this.key(e, false);
    this.onBlur = () => { this.input = { up: false, down: false, left: false, right: false }; this.setPaused(true); };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
  }

  loadEnvironmentAssets() {
    new GLTFLoader().load(assetUrl('models/desert_environment.glb'), (gltf) => {
      if (this.disposed) return;
      const names = {
        cactusA: 'Cactus_Saguaro_A', cactusB: 'Cactus_Saguaro_B', cactusColumn: 'Cactus_Columnar',
        rock: 'Rock_Desert', pothole: 'Pothole', streetLight: 'StreetLight',
      };
      for (const [key, name] of Object.entries(names)) {
        const source = gltf.scene.getObjectByName(name);
        if (source) this.environmentAssets[key] = source;
      }

      const roadSource = gltf.scene.getObjectByName('RoadSurface');
      if (roadSource?.isMesh) {
        const road = roadSource.clone();
        road.name = 'Carretera Blender';
        road.material = new THREE.MeshStandardMaterial({...this.roadMaps,roughness:0.94});
        road.position.set(0, 0.025, -300);
        this.scene.remove(this.roadMesh);
        road.receiveShadow = true;
    cutRoad(road.material);
    this.scene.add(road);
        this.roadMesh = road;
      }
      for (const name of ['RoadShoulderLeft', 'RoadShoulderRight']) {
        const source = gltf.scene.getObjectByName(name);
        if (!source?.isMesh) continue;
        const shoulder = source.clone();
        shoulder.material = new THREE.MeshStandardMaterial({ map:this.sandTex, color: 0xa49b89, roughness: 0.95 });
        shoulder.position.z = -300;
        this.scene.add(shoulder);
      }
      for (const curb of this.fallbackCurbs) this.scene.remove(curb);
      this.fallbackCurbs.length = 0;

      for (let i = 0; i < this.props.length; i++) {
        const old = this.props[i];
        const kind = old.userData.assetKind;
        if (!kind) continue;
        let replacement;
        if (kind === 'cactus') replacement = this.makeCactus();
        else if (kind === 'shrub') replacement = shrub(Math.random());
        else {
          replacement = new THREE.Group();
          replacement.add(this.makeRockMesh(old.userData.assetRadius || 1.25, Math.random()));
        }
        replacement.position.copy(old.position);
        replacement.rotation.copy(old.rotation);
        if (kind === 'rock') replacement.scale.copy(old.scale);
        replacement.userData.assetKind = kind;
        this.scene.add(replacement);
        this.scene.remove(old);
        this.props[i] = replacement;
      }

      const postPositions = [...new Set(this.posts.map((post) => post.position.z))];
      for (const post of this.posts) this.scene.remove(post);
      this.posts.length = 0;
      for (const z of postPositions) this.spawnPosts(z);

      for (const [id, old] of this.obsMap) {
        const obstacle = this.core.obstacles.find((o) => o.id === id);
        if (!obstacle) continue;
        this.scene.remove(old);
        const replacement = this.createObstacle(obstacle);
        replacement.position.z = old.position.z;
        this.obsMap.set(id, replacement);
      }
    }, undefined, (error) => {
      console.warn('No se pudo cargar el kit Blender; se mantienen los modelos provisionales.', error);
    });
  }

  cloneEnvironmentAsset(key) {
    const source = this.environmentAssets[key];
    if (!source) return null;
    const clone = source.clone(true);
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    clone.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return clone;
  }

  buildCar() {
    const car = new THREE.Group();
    const cyanBody = new THREE.MeshStandardMaterial({ color: 0x087f9e, roughness: 0.25, metalness: 0.38 });
    const cyanTrim = new THREE.MeshStandardMaterial({ color: 0x28b9d5, roughness: 0.22, metalness: 0.32 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x14232d, roughness: 0.13, metalness: 0.62, side: THREE.DoubleSide });
    const black = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.55, metalness: 0.12 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0x90979b, roughness: 0.22, metalness: 0.85 });
    const red = new THREE.MeshStandardMaterial({ color: 0xff1d14, emissive: 0x790700, emissiveIntensity: 0.85, roughness: 0.22 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.88 });

    const shell = new THREE.Mesh(sportsCarBodyGeometry(), cyanBody);
    car.add(shell);
    const hoodRidge = new THREE.Mesh(roundedBox(0.045, 0.03, 1.08, 0.02), cyanTrim);
    hoodRidge.position.set(0, 1.12, -1.52);
    car.add(hoodRidge);
    for (const sx of [-1, 1]) {
      const hoodVent = new THREE.Mesh(roundedBox(0.09, 0.025, 0.4, 0.025), black);
      hoodVent.position.set(sx * 0.56, 1.105, -1.48);
      car.add(hoodVent);
    }

    // Cabina esculpida: el techo se estrecha y el parabrisas y la luneta quedan inclinados.
    const cabPositions = [
      -0.79, 0.98, -1.04, 0.79, 0.98, -1.04, 0.79, 0.98, 0.98, -0.79, 0.98, 0.98,
      -0.65, 1.58, -0.53, 0.65, 1.58, -0.53, 0.65, 1.58, 0.61, -0.65, 1.58, 0.61,
    ];
    const cabGeo = new THREE.BufferGeometry();
    cabGeo.setAttribute('position', new THREE.Float32BufferAttribute(cabPositions, 3));
    cabGeo.setIndex([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
    cabGeo.computeVertexNormals();
    car.add(new THREE.Mesh(cabGeo, cyanBody));
    const roof = new THREE.Mesh(roundedBox(1.31, 0.09, 1.14, 0.12), cyanTrim);
    roof.position.set(0, 1.58, 0.04);
    car.add(roof);

    // Cristales oscuros triangulados en la luneta trasera, parabrisas y ventanillas.
    const addPanel = (coords) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      car.add(new THREE.Mesh(geo, glass));
    };
    addPanel([-0.58, 1.05, 0.91, 0.58, 1.05, 0.91, 0.55, 1.49, 0.58, -0.55, 1.49, 0.58]);
    addPanel([-0.58, 1.05, -0.97, -0.52, 1.49, -0.48, 0.52, 1.49, -0.48, 0.58, 1.05, -0.97]);
    for (const sx of [-1, 1]) {
      addPanel([sx * 0.80, 1.08, -0.79, sx * 0.57, 1.48, -0.43, sx * 0.57, 1.48, 0.48, sx * 0.80, 1.08, 0.85]);

      const sill = new THREE.Mesh(roundedBox(0.13, 0.18, 2.65, 0.055), cyanTrim);
      sill.position.set(sx * 0.91, 0.35, 0.02);
      car.add(sill);
      const sideVent = new THREE.Mesh(roundedBox(0.045, 0.2, 0.62, 0.04), black);
      sideVent.position.set(sx * 0.985, 0.58, 0.72);
      car.add(sideVent);

      const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 8), black);
      mirrorStem.rotation.z = Math.PI / 2;
      mirrorStem.position.set(sx * 0.94, 1.05, -0.55);
      car.add(mirrorStem);
      const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), cyanTrim);
      mirror.scale.set(1.25, 0.62, 0.8);
      mirror.position.set(sx * 1.08, 1.1, -0.58);
      car.add(mirror);
    }

    const grille = new THREE.Mesh(roundedBox(1.24, 0.19, 0.06, 0.045), black);
    grille.position.set(0, 0.57, -2.29);
    car.add(grille);
    for (let i = -3; i <= 3; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.14, 0.018), chrome);
      bar.position.set(i * 0.15, 0.585, -2.33);
      car.add(bar);
    }
    const headlight = new THREE.MeshStandardMaterial({ color: 0xe8f3ff, emissive: 0x6a8ba3, emissiveIntensity: 0.55, roughness: 0.18, metalness: 0.4 });
    for (const sx of [-1, 1]) {
      const lamp = new THREE.Mesh(roundedBox(0.43, 0.13, 0.055, 0.06), headlight);
      lamp.position.set(sx * 0.62, 0.84, -2.27);
      car.add(lamp);
      const intake = new THREE.Mesh(roundedBox(0.25, 0.09, 0.05, 0.035), black);
      intake.position.set(sx * 0.75, 0.48, -2.28);
      car.add(intake);
    }

    // Fascia trasera, alerón bajo y difusor inspirado en el coche de referencia.
    const diffuser = new THREE.Mesh(roundedBox(1.86, 0.27, 0.32, 0.07), black);
    diffuser.position.set(0, 0.36, 2.12);
    car.add(diffuser);
    const lip = new THREE.Mesh(roundedBox(1.92, 0.09, 0.43, 0.07), cyanBody);
    lip.position.set(0, 1.06, 2.03);
    car.add(lip);
    const lightBar = new THREE.Mesh(roundedBox(1.5, 0.12, 0.07, 0.055), red);
    lightBar.position.set(0, 0.91, 2.22);
    car.add(lightBar);
    for (const sx of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.1), red);
      lamp.position.set(sx * 0.7, 1.04, 2.16);
      car.add(lamp);
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 16), chrome);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(sx * 0.39, 0.52, 2.28);
      car.add(exhaust);
    }
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.2), new THREE.MeshBasicMaterial({ map: makePlateTexture() }));
    plate.position.set(0, 0.69, 2.285);
    car.add(plate);
    for (const sx of [-0.49, -0.16, 0.16, 0.49]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.26, 0.32), chrome);
      fin.position.set(sx, 0.36, 2.17);
      car.add(fin);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.34, 28);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const sx of [-1, 1]) for (const z of [-1.4, 1.4]) {
      const wheel = new THREE.Group();
      const wh = new THREE.Mesh(wheelGeo, tire);
      wh.position.set(sx * 0.98, 0.49, 0);
      wheel.add(wh);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.36, 24), chrome);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(sx * 0.98, 0.49, 0);
      wheel.add(rim);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.38, 16), black);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(sx * 0.98, 0.49, 0);
      wheel.add(hub);
      const sidewall = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.026, 7, 28), black);
      sidewall.rotation.y = Math.PI / 2;
      sidewall.position.set(sx * 1.17, 0.49, 0);
      wheel.add(sidewall);
      for (let spokeIndex = 0; spokeIndex < 5; spokeIndex++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.22, 0.045), chrome);
        spoke.position.set(sx * 1.18, 0.49, 0);
        spoke.rotation.x = spokeIndex * Math.PI * 2 / 5;
        wheel.add(spoke);
      }
      wheel.position.set(0, 0, z);
      car.add(wheel);
    }

    // llamas de nitro
    this.flames = [];
    for (const sx of [-0.55, 0.55]) {
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 1.6, 8),
        new THREE.MeshBasicMaterial({ color: 0x59d2ff, transparent: true, opacity: 0.9 }),
      );
      f.rotation.x = -Math.PI / 2;
      f.position.set(sx, 0.5, 3.1);
      f.visible = false;
      car.add(f);
      this.flames.push(f);
    }

    this.car = new THREE.Group();
    this.car.add(car);
    this.carBody = car;
    this.scene.add(this.car);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 5.8),
      new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    this.shadow = shadow;
    this.car.add(shadow);

    // Sustituye el modelo provisional por el coche exportado desde Blender cuando está disponible.
    new GLTFLoader().load(assetUrl('models/road_rush_car.glb'), (gltf) => {
      if (this.disposed) {
        gltf.scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        });
        return;
      }
      const model = gltf.scene;
      model.name = 'Coche Blender';
      model.rotation.y = Math.PI;
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      for (const flame of this.flames) {
        car.remove(flame);
        this.car.add(flame);
      }
      this.car.remove(car);
      const visualPivot = new THREE.Group();
      visualPivot.name = 'Animación del vehículo';
      visualPivot.add(model);
      this.car.add(visualPivot);
      this.carBody = visualPivot;
    }, undefined, (error) => {
      console.warn('No se pudo cargar el modelo Blender; se mantiene el coche provisional.', error);
    });
  }

  // ---------------- utilería decorativa ----------------
  makeCactus() {
    const variants = ['cactusA', 'cactusB', 'cactusColumn'];
    const model = this.cloneEnvironmentAsset(variants[Math.floor(Math.random() * variants.length)]);
    if (model) {
      model.scale.setScalar(0.72 + Math.random() * 0.45);
      model.rotation.y = Math.random() * Math.PI * 2;
      return model;
    }
    const g = new THREE.Group();
    const h = 2 + Math.random() * 2.2;
    const t = new THREE.Mesh(this.cactusGeo.trunk, this.cactusMat);
    t.scale.set(1, h, 1);
    t.position.y = h / 2;
    g.add(t);
    const arms = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < arms; i++) {
      const s = i === 0 ? 1 : -1;
      const hy = h * (0.4 + Math.random() * 0.25);
      const hor = new THREE.Mesh(this.cactusGeo.arm, this.cactusMat);
      hor.scale.set(1, 0.9, 1);
      hor.rotation.z = Math.PI / 2;
      hor.position.set(s * 0.6, hy, 0);
      const ver = new THREE.Mesh(this.cactusGeo.arm, this.cactusMat);
      ver.scale.set(1, 0.9 + Math.random() * 0.8, 1);
      ver.position.set(s * 1.0, hy + 0.5, 0);
      g.add(hor, ver);
    }
    g.rotation.y = Math.random() * Math.PI;
    return g;
  }

  makeRockMesh(radius, seed) {
    return detailedRock(radius, seed);
  }

  spawnProp(z) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (ROAD_W / 2 + 3 + Math.random() * Math.random() * 70);
    const r = Math.random();
    let obj;
    if (r < 0.75) {
      obj = shrub(Math.random());
      obj.userData.assetKind = 'shrub';
    } else if (r < 0.90) {
      obj = this.makeCactus();
      obj.userData.assetKind = 'cactus';
    }
    else {
      obj = new THREE.Group();
      const rad = 0.9 + Math.random() * (Math.abs(x) > 40 ? 5 : 2.2);
      obj.add(this.makeRockMesh(rad, Math.random()));
      obj.userData.assetKind = 'rock';
      obj.userData.assetRadius = rad;
    }
    obj.position.set(x, 0, z);
    this.scene.add(obj);
    this.props.push(obj);
  }

  spawnPosts(z) {
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      const p = new THREE.Mesh(this.postGeo, this.postMat);
      p.position.y = 0.6;
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.04), this.reflMat);
      r.position.set(0, 0.95, s * 0.09 * 0 + 0.09);
      g.add(p, r);
      const lamp = this.cloneEnvironmentAsset('streetLight');
      if (lamp) {
        if (s < 0) lamp.rotation.y = Math.PI;
        lamp.position.set(s * 3.9, 0, 0);
        g.add(lamp);
      }
      g.position.set(s * (ROAD_W / 2 + 1.1), 0, z);
      this.scene.add(g);
      this.posts.push(g);
    }
  }

  populateInitialProps() {
    for (let z = 20; z > SPAWN_Z - 40; z -= 2 + Math.random() * 2) this.spawnProp(z);
    for (let z = 20; z > SPAWN_Z - 40; z -= 36) this.spawnPosts(z);
  }

  // ---------------- obstáculos / pickups ----------------
  createObstacle(o) {
    const g = new THREE.Group();
    if (o.type === 'rock') {
      g.add(this.makeRockMesh(o.r, o.seed));
    } else {
      g.add(recessedPothole(o));
    }
    g.position.set(o.x, 0, o.z);
    this.scene.add(g);
    return g;
  }

  createPickup() {
    const g = new THREE.Group();
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.9, 12),
      new THREE.MeshBasicMaterial({ color: 0x3ad0ff }),
    );
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.25, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    cap.position.y = 0.58;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    ring.rotation.x = Math.PI / 2;
    g.add(bottle, cap, ring);
    g.userData = { ring };
    this.scene.add(g);
    return g;
  }

  syncWorld() {
    const core = this.core;
    updateHoles(core.obstacles);
    const seen = new Set();
    for (const o of core.obstacles) {
      seen.add(o.id);
      let m = this.obsMap.get(o.id);
      if (!m) {
        m = this.createObstacle(o);
        this.obsMap.set(o.id, m);
      }
      m.position.z = o.z;
    }
    for (const [id, m] of this.obsMap) {
      if (!seen.has(id)) {
        this.scene.remove(m);
        m.traverse((child) => { child.userData.ownedGeometry?.dispose(); if (child.isInstancedMesh) child.dispose(); });
        this.obsMap.delete(id);
      }
    }
    const seenP = new Set();
    for (const p of core.pickups) {
      seenP.add(p.id);
      let m = this.pickMap.get(p.id);
      if (!m) {
        m = this.createPickup();
        this.pickMap.set(p.id, m);
      }
      m.position.set(p.x, 1.2 + Math.sin(this.t * 4) * 0.15, p.z);
      m.rotation.y = this.t * 2.5;
      m.userData.ring.rotation.z = this.t * 3;
    }
    for (const [id, m] of this.pickMap) {
      if (!seenP.has(id)) {
        this.scene.remove(m);
        this.pickMap.delete(id);
      }
    }
  }

  // ---------------- efectos ----------------
  burst(x, z, color = 0xffa040, n = 26) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.partGeo, new THREE.MeshBasicMaterial({ color: i % 3 ? color : 0x777777 }));
      m.position.set(x, 0.8, z);
      this.scene.add(m);
      this.particles.push({
        m, life: 0.9 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 12, vy: 4 + Math.random() * 8, vz: (Math.random() - 0.5) * 12,
      });
    }
  }

  stepParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy -= 22 * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y = Math.max(0.1, p.m.position.y + p.vy * dt);
      p.m.position.z += p.vz * dt + this.core.v * dt * 0.9;
      p.m.rotation.x += dt * 8;
    }
    this.particles = this.particles.filter((p) => {
      if (p.life <= 0) {
        this.scene.remove(p.m);
        p.m.material.dispose();
        return false;
      }
      return true;
    });
  }

  // ---------------- bucle ----------------
  start() {
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  frame(now) {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const core = this.core;
    this.t += dt;

    if (!this.paused && core.status === 'playing') {
      this.acc += dt;
      while (this.acc >= STEP && core.status === 'playing') {
        const ev = core.update(STEP, this.input);
        this.acc -= STEP;
        this.advanceVisuals(STEP);
        for (const e of ev) this.handle(e);
      }
    }
    this.stepParticles(dt);
    this.syncWorld();
    this.poseCar();
    this.updateCamera(dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.sfx.engine(core.v, core.boostT > 0, !this.paused && core.status === 'playing');
    this.renderer.render(this.scene, this.camera);

    this.hudT += dt;
    if (this.hudT > 0.08) {
      this.hudT = 0;
      this.onHud({
        dist: core.dist, v: core.v, level: core.level, lives: core.lives, time: core.time,
        boost: core.boostT, invuln: core.invuln, status: core.status,
        nextLevelSpeed: levelSpeed(core.level + 1),
      });
    }
  }

  advanceVisuals(dt) {
    const dz = this.core.v * dt;
    // El asfalto y el terreno permanecen anclados; no se deslizan sus texturas.
    for (const arr of [this.props, this.posts]) {
      for (const o of arr) o.position.z += dz;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].position.z > 25) {
          arr[i].traverse(child => { if (child.isInstancedMesh) child.dispose(); });
          this.scene.remove(arr[i]);
          arr.splice(i, 1);
        }
      }
    }
    this.propAcc += dz;
    while (this.propAcc > 3) {
      this.propAcc -= 3 - Math.random();
      this.spawnProp(SPAWN_Z - 40 + this.propAcc * 0);
    }
    this.postAcc += dz;
    while (this.postAcc > 36) {
      this.postAcc -= 36;
      this.spawnPosts(SPAWN_Z - 40 + this.postAcc);
    }
  }

  handle(e) {
    const core = this.core;
    if (e.type === 'death') {
      this.shake = 1;
      if (e.cause === 'roca') {
        this.burst(core.x, 0, 0xffa040, 30);
        this.sfx.crash();
      } else {
        this.sfx.fall();
      }
    } else if (e.type === 'boost') this.sfx.boost();
    else if (e.type === 'levelup') this.sfx.levelup();
    this.onEvent(e);
    if (e.type === 'gameover' && !this.overSent) {
      this.overSent = true;
      this.onEvent({ type: 'result', result: core.result() });
    }
  }

  poseCar() {
    const core = this.core;
    const car = this.car;
    car.position.x = core.x;
    car.position.y = 0;
    car.rotation.set(0, 0, 0);
    this.carBody.rotation.set(0, 0, 0);
    this.carBody.position.set(0, 0, 0);
    this.carBody.rotation.z = -core.vx * 0.018;
    this.carBody.rotation.y = -core.vx * 0.03;
    const dead = core.respawnT > 0;
    if (dead) {
      const el = core.respawnMax - core.respawnT;
      if (core.deathCause === 'hueco') {
        const k = Math.min(1, el / core.respawnMax);
        this.carBody.position.y = -(k * k) * 4.5;
        this.carBody.rotation.x = -k * 0.55;
        this.carBody.rotation.z += k * 0.35;
      } else {
        const k = Math.min(1, el / core.respawnMax);
        this.carBody.rotation.y += k * Math.PI * 2;
        this.carBody.position.y = Math.sin(k * Math.PI) * 0.9;
      }
    }
    car.visible = core.invuln > 0 ? Math.floor(this.t * 14) % 2 === 0 : true;
    this.shadow.visible = !(dead && core.deathCause === 'hueco');
    const boosting = core.boostT > 0;
    for (const f of this.flames) {
      f.visible = boosting;
      if (boosting) {
        f.scale.set(1, 0.7 + Math.random() * 0.7, 1);
        f.material.color.setHex(Math.random() < 0.5 ? 0x59d2ff : 0xffd06a);
      }
    }
  }

  updateCamera(dt) {
    const core = this.core;
    const cx = core.x;
    const targetFov = 60 + (core.v - 20) * 0.28 + (core.boostT > 0 ? 7 : 0);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 4);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    const s = this.shake * 0.35;
    this.camera.position.set(cx * 0.6 + (Math.random() - 0.5) * s, 4.7 + (Math.random() - 0.5) * s, 10.8);
    this.camera.lookAt(cx * 0.45, 1.3, -16);
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  key(e, down) {
    const map = {
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    };
    if (map[e.code]) {
      this.input[map[e.code]] = down;
      e.preventDefault();
      if (down) this.sfx.init();
    } else if (down && (e.code === 'KeyP' || e.code === 'Escape')) {
      this.setPaused(!this.paused);
    } else if (down && e.code === 'KeyM') {
      this.sfx.setMuted(!this.sfx.muted);
      this.onEvent({ type: 'mute', muted: this.sfx.muted });
    }
  }

  setPaused(p) {
    if (this.core.status !== 'playing') return;
    this.paused = p;
    this.onEvent({ type: 'pause', paused: p });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.ro && this.ro.disconnect();
    this.sfx.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.environmentMap?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export { MAX_LIVES, CAR, SLOT_W };
