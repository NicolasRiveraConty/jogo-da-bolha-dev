import * as THREE from 'three';
import { Rng } from './Noise';

/** 1 pixel de "skin" = 1/16 de bloco. */
export const P = 1 / 16;

const texCache = new Map<string, THREE.CanvasTexture>();

/** Textura pixelada com ruído sutil, para o visual de blocos. */
export function pixelTexture(color: number, variance = 0.07, size = 8, seed = 1): THREE.CanvasTexture {
  const key = `${color}-${variance}-${size}-${seed}`;
  const cached = texCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = new Rng(seed * 7919 + color);
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = 1 + (rng.next() * 2 - 1) * variance;
      ctx.fillStyle = `rgb(${(r * v) | 0},${(g * v) | 0},${(b * v) | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

export function stripedTexture(a: number, b: number, stripes = 4): THREE.CanvasTexture {
  const key = `stripe-${a}-${b}-${stripes}`;
  const cached = texCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  for (let x = 0; x < 8; x++) {
    ctx.fillStyle = `#${((Math.floor(x / (8 / stripes)) % 2 === 0 ? a : b) as number).toString(16).padStart(6, '0')}`;
    ctx.fillRect(x, 0, 1, 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

export interface BoxOpts {
  emissive?: number;
  emissiveIntensity?: number;
  variance?: number;
  map?: THREE.Texture;
  transparent?: boolean;
  opacity?: number;
}

const matCache = new Map<string, THREE.MeshLambertMaterial>();

export function blockMaterial(color: number, opts: BoxOpts = {}): THREE.MeshLambertMaterial {
  const key = `${color}-${opts.emissive ?? 0}-${opts.emissiveIntensity ?? 0}-${opts.variance ?? 0.07}-${opts.map?.uuid ?? ''}-${opts.opacity ?? 1}`;
  const cached = matCache.get(key);
  if (cached) return cached;
  const m = new THREE.MeshLambertMaterial({
    map: opts.map ?? pixelTexture(color, opts.variance ?? 0.07),
    color: opts.map ? 0xffffff : 0xffffff,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
  matCache.set(key, m);
  return m;
}

/** Caixa em pixels (1/16 bloco), com origem no centro. */
export function box(w: number, h: number, d: number, color: number, opts: BoxOpts = {}): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w * P, h * P, d * P);
  const mesh = new THREE.Mesh(geo, blockMaterial(color, opts));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function at<T extends THREE.Object3D>(mesh: T, x: number, y: number, z: number): T {
  mesh.position.set(x * P, y * P, z * P);
  return mesh;
}

// ---------------------------------------------------------------------------
// Humanoide (estilo Steve): frente = +Z
// ---------------------------------------------------------------------------

export interface HumanoidPalette {
  skin: number;
  hair: number;
  shirt: number;
  pants: number;
  shoes: number;
  sleeves?: number;
  cape?: number;
  headband?: number;
  glasses?: boolean;
  crown?: boolean;
  belt?: number;
  armor?: boolean;
  big?: boolean; // corpo largo (boss / Mateus)
  eyeColor?: number;
  eyeGlow?: number;
  beard?: number;
}

export interface Humanoid {
  group: THREE.Group;
  head: THREE.Group;
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  height: number;
  /** Animação de caminhada / idle. speed em [0,1]. */
  animate(t: number, speed: number): void;
  setAttack(t01: number): void;
}

export function makeHumanoid(p: HumanoidPalette, scale = 1): Humanoid {
  const group = new THREE.Group();
  const bw = p.big ? 12 : 8;
  const bd = p.big ? 7 : 4;
  const armW = p.big ? 5 : 4;

  // Cabeça (pivot na base do pescoço)
  const head = new THREE.Group();
  at(head, 0, 24, 0);
  const headMesh = at(box(8, 8, 8, p.skin), 0, 4, 0);
  head.add(headMesh);
  const hair = at(box(8.4, 3, 8.4, p.hair), 0, 6.8, 0);
  head.add(hair);
  const hairBack = at(box(8.4, 4, 1.2, p.hair), 0, 3.5, -3.8);
  head.add(hairBack);
  // olhos
  const eyeC = p.eyeColor ?? 0x222233;
  const eyeOpts: BoxOpts = p.eyeGlow ? { emissive: p.eyeGlow, emissiveIntensity: 1.5, variance: 0 } : { variance: 0 };
  head.add(at(box(1.6, 1.6, 0.6, eyeC, eyeOpts), -2, 3.5, 4.1));
  head.add(at(box(1.6, 1.6, 0.6, eyeC, eyeOpts), 2, 3.5, 4.1));
  head.add(at(box(1, 1, 0.6, 0xffffff, { variance: 0 }), -2.5, 3.8, 4.15));
  head.add(at(box(1, 1, 0.6, 0xffffff, { variance: 0 }), 1.5, 3.8, 4.15));
  // boca
  head.add(at(box(3, 0.8, 0.6, 0x7a3b2e, { variance: 0 }), 0, 1.2, 4.1));
  if (p.glasses) {
    head.add(at(box(8.6, 2.2, 1, 0x111111, { variance: 0 }), 0, 3.6, 4.3));
  }
  if (p.headband) {
    head.add(at(box(8.6, 1.4, 8.6, p.headband, { variance: 0.03 }), 0, 5.6, 0));
    head.add(at(box(1.4, 4, 1, p.headband, { variance: 0.03 }), 3.5, 4, -4.5));
  }
  if (p.crown) {
    const gold = 0xf2c230;
    head.add(at(box(9, 1.6, 9, gold, { emissive: 0x553300, emissiveIntensity: 0.4 }), 0, 8.8, 0));
    for (const [dx, dz] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5], [0, -3.8], [0, 3.8], [-3.8, 0], [3.8, 0]]) {
      head.add(at(box(1.5, 2.4, 1.5, gold, { emissive: 0x553300, emissiveIntensity: 0.4 }), dx, 10.5, dz));
    }
    head.add(at(box(1.4, 1.4, 1, 0xe0282f, { emissive: 0x660000, emissiveIntensity: 0.6, variance: 0 }), 0, 9.2, 4.6));
  }
  if (p.beard) head.add(at(box(6, 2, 1, p.beard), 0, 0.6, 4.2));
  group.add(head);

  // Corpo
  const body = new THREE.Group();
  at(body, 0, 12, 0);
  body.add(at(box(bw, 12, bd, p.shirt), 0, 6, 0));
  if (p.armor) {
    body.add(at(box(bw + 0.8, 6, bd + 0.8, 0xb9c2cc, { variance: 0.05 }), 0, 8.5, 0));
    body.add(at(box(bw + 1, 1.2, bd + 1, 0xd9b53d, { variance: 0.03 }), 0, 5.4, 0));
  }
  if (p.belt) body.add(at(box(bw + 0.6, 1.6, bd + 0.6, p.belt, { variance: 0.03 }), 0, 1, 0));
  if (p.cape) {
    const cape = at(box(bw + 0.5, 15, 1, p.cape, { variance: 0.05 }), 0, 4.5, -(bd / 2 + 0.8));
    body.add(cape);
  }
  group.add(body);

  // Braços (pivot no ombro)
  const mkArm = (side: number) => {
    const g = new THREE.Group();
    at(g, side * (bw / 2 + armW / 2), 22, 0);
    g.add(at(box(armW, 12, armW, p.sleeves ?? p.skin), 0, -4, 0));
    g.add(at(box(armW, 4, armW, p.skin), 0, -8, 0));
    if (p.armor) g.add(at(box(armW + 1, 3, armW + 1, 0xb9c2cc, { variance: 0.05 }), 0, 1, 0));
    return g;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  group.add(armL, armR);

  // Pernas (pivot no quadril)
  const mkLeg = (side: number) => {
    const g = new THREE.Group();
    at(g, side * (bw / 4), 12, 0);
    g.add(at(box(bw / 2 - 0.2, 10, bd, p.pants), 0, -5, 0));
    g.add(at(box(bw / 2 - 0.2, 2.4, bd + 0.6, p.shoes), 0, -10.8, 0.3));
    return g;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);
  group.add(legL, legR);

  group.scale.setScalar(scale);
  const height = 32 * P * scale;

  let attackT = -1;
  return {
    group,
    head,
    body,
    armL,
    armR,
    legL,
    legR,
    height,
    animate(t, speed) {
      const s = Math.sin(t * 9);
      const amp = 0.7 * speed;
      legL.rotation.x = s * amp;
      legR.rotation.x = -s * amp;
      armL.rotation.x = -s * amp * 0.9;
      if (attackT < 0) armR.rotation.x = s * amp * 0.9;
      const idle = Math.sin(t * 2.2) * 0.03;
      body.rotation.x = idle;
      head.rotation.y = Math.sin(t * 0.7) * 0.08 * (1 - speed);
      head.rotation.x = idle * 2;
      armL.rotation.z = 0.06 + Math.sin(t * 2.2) * 0.02;
      armR.rotation.z = -0.06 - Math.sin(t * 2.2) * 0.02;
    },
    setAttack(t01) {
      attackT = t01;
      if (t01 < 0) return;
      // Golpe de cima para baixo
      const swing = t01 < 0.35 ? -2.2 * (t01 / 0.35) : -2.2 + 2.6 * ((t01 - 0.35) / 0.65);
      armR.rotation.x = swing;
      armR.rotation.z = -0.3;
    },
  };
}

// ---------------------------------------------------------------------------
// Armas
// ---------------------------------------------------------------------------

export function makeSword(color = 0xd8dde3, size = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(at(box(1.4, 14 * size, 2.6, color, { variance: 0.04 }), 0, 9 * size, 0));
  g.add(at(box(1.6, 2, 1.4, color, { variance: 0.04 }), 0, 16 * size, 0));
  g.add(at(box(5, 1.4, 1.6, 0xd9b53d), 0, 1.5, 0));
  g.add(at(box(1.4, 4, 1.4, 0x5b3a1e), 0, -1.5, 0));
  g.add(at(box(2, 1.4, 2, 0xd9b53d), 0, -4, 0));
  return g;
}

export function makeDumbbell(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(box(1.6, 12, 1.6, 0x8a8f96, { variance: 0.04 }), 0, 6, 0));
  g.add(at(box(5, 4, 5, 0x3a3d44, { variance: 0.05 }), 0, 11, 0));
  g.add(at(box(5, 4, 5, 0x3a3d44, { variance: 0.05 }), 0, 1, 0));
  return g;
}

export function makeTablet(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(box(6, 8, 0.8, 0x1c1c22, { variance: 0.02 }), 0, 4, 0));
  g.add(at(box(5, 7, 0.4, 0x3aa0ff, { emissive: 0x2266cc, emissiveIntensity: 1.2, variance: 0.1 }), 0, 4, 0.5));
  return g;
}

/** Posiciona uma arma na mão direita (fim do braço). */
export function attachToHand(h: Humanoid, weapon: THREE.Object3D, tilt = Math.PI / 2 + 0.2): void {
  weapon.position.set(0, -10 * P, 1.5 * P);
  weapon.rotation.x = tilt;
  h.armR.add(weapon);
}

// ---------------------------------------------------------------------------
// Criaturas
// ---------------------------------------------------------------------------

export interface Creature {
  group: THREE.Group;
  height: number;
  animate(t: number, speed: number): void;
  setAttack(t01: number): void;
}

export function makeBug(): Creature {
  const group = new THREE.Group();
  const green = 0x5da832;
  const dark = 0x2c5a1b;
  const body = at(box(10, 7, 14, green), 0, 8, -1);
  group.add(body);
  group.add(at(box(6, 4, 8, dark, { variance: 0.1 }), 0, 12.5, -1)); // casco
  // "tela quebrada" com X vermelho
  group.add(at(box(4, 0.6, 4, 0x1a1a1a, { variance: 0 }), 0, 14.9, -1));
  group.add(at(box(0.8, 0.7, 4.2, 0xff3030, { emissive: 0xff0000, emissiveIntensity: 1.2, variance: 0 }), 0, 15.1, -1));
  const head = at(box(6, 5, 5, green), 0, 7.5, 7);
  group.add(head);
  group.add(at(box(1.6, 1.6, 0.8, 0xff3030, { emissive: 0xff0000, emissiveIntensity: 2, variance: 0 }), -1.8, 8, 9.6));
  group.add(at(box(1.6, 1.6, 0.8, 0xff3030, { emissive: 0xff0000, emissiveIntensity: 2, variance: 0 }), 1.8, 8, 9.6));
  group.add(at(box(1, 2.4, 1, dark), -1.5, 4.5, 9));
  group.add(at(box(1, 2.4, 1, dark), 1.5, 4.5, 9));
  const legs: THREE.Group[] = [];
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      at(g, side * 5, 7, 4 - i * 3.5);
      const seg = at(box(6, 1.6, 1.6, dark), side * 3, 0, 0);
      seg.rotation.z = side * -0.6;
      g.add(seg);
      const seg2 = at(box(1.6, 6, 1.6, dark), side * 6.5, -2.5, 0);
      g.add(seg2);
      group.add(g);
      legs.push(g);
    }
  }
  return {
    group,
    height: 1,
    animate(t, speed) {
      legs.forEach((l, i) => {
        l.rotation.y = Math.sin(t * 14 + i * 1.3) * 0.35 * Math.max(0.15, speed);
      });
      body.position.y = (8 + Math.sin(t * 6) * 0.3) * P;
    },
    setAttack(t01) {
      if (t01 < 0) {
        head.rotation.x = 0;
        return;
      }
      head.rotation.x = -Math.sin(t01 * Math.PI) * 0.8;
    },
  };
}

export function makeMeeting(): Creature {
  const group = new THREE.Group();
  const gray = 0x6a6a72;
  const table = at(box(18, 2, 12, 0x555560), 0, 10, 0);
  group.add(table);
  for (const [dx, dz] of [[-7, -4], [7, -4], [-7, 4], [7, 4]]) group.add(at(box(1.4, 9, 1.4, gray), dx, 5, dz));
  // relógio
  const clock = new THREE.Group();
  at(clock, 0, 17, 0);
  clock.add(at(box(9, 9, 1.6, 0xe8e8e8, { variance: 0.02 }), 0, 0, 0));
  clock.add(at(box(10, 10, 1, 0x333340, { variance: 0.02 }), 0, 0, -0.5));
  clock.add(at(box(0.8, 3.5, 0.6, 0x222222, { variance: 0 }), 0, 1.5, 0.9));
  clock.add(at(box(3, 0.8, 0.6, 0x222222, { variance: 0 }), 1.3, 0, 0.9));
  // olhos cansados
  clock.add(at(box(2, 1, 0.6, 0x222233, { variance: 0 }), -2.2, 2.4, 0.95));
  clock.add(at(box(2, 1, 0.6, 0x222233, { variance: 0 }), 2.2, 2.4, 0.95));
  clock.add(at(box(4, 0.7, 0.6, 0x222233, { variance: 0 }), 0, -2.6, 0.95));
  group.add(clock);
  // projetor
  group.add(at(box(3, 2, 3, 0x2a2a30), 5, 12, 2));
  group.add(at(box(0.8, 0.8, 0.8, 0xc08cff, { emissive: 0x9b5cff, emissiveIntensity: 2, variance: 0 }), 5, 12, 3.8));
  // aura roxa
  const aura = at(box(20, 14, 14, 0x8a4dff, { transparent: true, opacity: 0.18, emissive: 0x6a2fd0, emissiveIntensity: 0.8, variance: 0 }), 0, 12, 0);
  aura.castShadow = false;
  group.add(aura);
  // post-its
  const notes: THREE.Object3D[] = [];
  for (const [c, dx, dy, dz] of [[0xfff176, -11, 13, 3], [0xff8a80, 10, 16, -4], [0x80d8ff, -9, 19, -3], [0xb9f6ca, 11, 10, 5]]) {
    const n = at(box(2.5, 2.5, 0.4, c, { variance: 0.02 }), dx, dy, dz);
    group.add(n);
    notes.push(n);
  }
  return {
    group,
    height: 1.4,
    animate(t) {
      clock.rotation.y = Math.sin(t * 1.5) * 0.25;
      notes.forEach((n, i) => {
        n.position.y += Math.sin(t * 3 + i) * 0.002;
        n.rotation.y = t * (0.5 + i * 0.2);
      });
      aura.rotation.y = t * 0.4;
      (aura.material as THREE.MeshLambertMaterial).opacity = 0.14 + Math.sin(t * 3) * 0.05;
    },
    setAttack(t01) {
      clock.rotation.x = t01 < 0 ? 0 : -Math.sin(t01 * Math.PI) * 0.6;
    },
  };
}

export function makePopcornBucket(): THREE.Group {
  const g = new THREE.Group();
  const stripes = stripedTexture(0xd8262e, 0xf5f5f5, 4);
  g.add(at(box(6, 7, 6, 0xffffff, { map: stripes, variance: 0 }), 0, 3.5, 0));
  g.add(at(box(6.6, 3, 6.6, 0xf2dc9a, { variance: 0.12 }), 0, 8, 0));
  g.add(at(box(2, 2, 2, 0xfff7dc, { variance: 0.05 }), -1.5, 10, 1));
  g.add(at(box(2, 2, 2, 0xfff7dc, { variance: 0.05 }), 1.5, 10.5, -1));
  return g;
}

export function makeShield(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(box(7, 9, 1.2, 0x6b4a2b), 0, 0, 0));
  g.add(at(box(5, 7, 0.6, 0x2c4c8a, { variance: 0.04 }), 0, 0, 0.8));
  g.add(at(box(1.2, 5, 0.6, 0xd9b53d, { variance: 0.02 }), 0, 0, 1.2));
  g.add(at(box(3.5, 1.2, 0.6, 0xd9b53d, { variance: 0.02 }), 0, 1, 1.2));
  return g;
}

export function makePhone(glow = 0x3cff7a): THREE.Group {
  const g = new THREE.Group();
  g.add(at(box(3.2, 6, 0.8, 0x1c1c22, { variance: 0.02 }), 0, 3, 0));
  g.add(at(box(2.6, 5, 0.4, glow, { emissive: glow, emissiveIntensity: 1.6, variance: 0.1 }), 0, 3, 0.5));
  return g;
}
