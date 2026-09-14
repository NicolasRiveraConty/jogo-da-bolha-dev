import * as THREE from 'three';
import { Noise2D, Rng } from './Noise';

export interface TextureSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

type Painter = (x: number, y: number, u: number, v: number) => { color: [number, number, number]; height: number; roughness?: number };

const cache = new Map<string, TextureSet>();
const noise = new Noise2D(2024);
const noiseB = new Noise2D(777);

function fbm(x: number, y: number, oct = 4): number {
  return noise.fbm(x, y, oct) * 0.5 + 0.5;
}

/** Ruído com repetição perfeita (tileável) usando 4 amostras em toro. */
function tileNoise(u: number, v: number, freq: number, oct = 4): number {
  const a = u * Math.PI * 2;
  const b = v * Math.PI * 2;
  const r = freq / (Math.PI * 2);
  const x = Math.cos(a) * r;
  const y = Math.sin(a) * r;
  const z = Math.cos(b) * r;
  const w = Math.sin(b) * r;
  return (noise.fbm(x + z, y + w, oct) + noiseB.fbm(x - w, y + z, oct)) * 0.25 + 0.5;
}

function makeTexture(data: Uint8ClampedArray, size: number, srgb: boolean, repeat = 1): THREE.Texture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Gera mapa de cor, normal (a partir da altura) e rugosidade. */
export function buildTextureSet(name: string, size: number, painter: Painter, normalStrength = 2, repeat = 1): TextureSet {
  const key = `${name}-${size}-${repeat}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const color = new Uint8ClampedArray(size * size * 4);
  const rough = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const r = painter(x, y, x / size, y / size);
      color[i * 4] = r.color[0];
      color[i * 4 + 1] = r.color[1];
      color[i * 4 + 2] = r.color[2];
      color[i * 4 + 3] = 255;
      height[i] = r.height;
      const rg = Math.round((r.roughness ?? 0.85) * 255);
      rough[i * 4] = rg;
      rough[i * 4 + 1] = rg;
      rough[i * 4 + 2] = rg;
      rough[i * 4 + 3] = 255;
    }
  }
  const normal = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = (dx: number, dy: number) => height[((y + dy + size) % size) * size + ((x + dx + size) % size)];
      const gx = (h(1, 0) - h(-1, 0)) * normalStrength;
      const gy = (h(0, 1) - h(0, -1)) * normalStrength;
      const n = new THREE.Vector3(-gx, -gy, 1).normalize();
      const i = (y * size + x) * 4;
      normal[i] = (n.x * 0.5 + 0.5) * 255;
      normal[i + 1] = (n.y * 0.5 + 0.5) * 255;
      normal[i + 2] = (n.z * 0.5 + 0.5) * 255;
      normal[i + 3] = 255;
    }
  }
  const set: TextureSet = {
    map: makeTexture(color, size, true, repeat),
    normalMap: makeTexture(normal, size, false, repeat),
    roughnessMap: makeTexture(rough, size, false, repeat),
  };
  cache.set(key, set);
  return set;
}

const mix = (a: number[], b: number[], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rngTex = new Rng(31337);

// --------------------------------------------------------------------------- materiais do terreno

export function grassTexture(): TextureSet {
  return buildTextureSet(
    'grass',
    256,
    (_x, _y, u, v) => {
      const n1 = tileNoise(u, v, 18, 4);
      const n2 = tileNoise(u + 0.3, v + 0.7, 60, 3);
      const streak = Math.pow(tileNoise(u * 1.0, v * 6, 40, 2), 3);
      const t = n1 * 0.6 + n2 * 0.4;
      const dark = [46, 96, 34];
      const light = [122, 176, 62];
      const yellow = [150, 168, 70];
      let c = mix(dark, light, t);
      c = mix(c, yellow, streak * 0.6);
      return { color: c, height: t * 0.6 + streak * 0.4, roughness: 0.9 };
    },
    1.5,
  );
}

export function rockTexture(): TextureSet {
  return buildTextureSet(
    'rock',
    256,
    (_x, _y, u, v) => {
      const n1 = tileNoise(u, v, 8, 5);
      const cracks = 1 - Math.pow(Math.abs(tileNoise(u, v, 22, 3) - 0.5) * 2, 0.35);
      const t = n1 * (1 - cracks * 0.6);
      const dark = [72, 70, 68];
      const light = [150, 145, 138];
      return { color: mix(dark, light, t), height: t, roughness: 0.85 - n1 * 0.15 };
    },
    3,
  );
}

export function sandTexture(): TextureSet {
  return buildTextureSet(
    'sand',
    256,
    (_x, _y, u, v) => {
      const n = tileNoise(u, v, 40, 3);
      const ripple = Math.sin((u + tileNoise(u, v, 6, 2) * 0.1) * Math.PI * 30) * 0.5 + 0.5;
      const t = n * 0.6 + ripple * 0.4;
      return { color: mix([196, 176, 122], [232, 214, 160], t), height: t, roughness: 0.95 };
    },
    1.2,
  );
}

export function snowTexture(): TextureSet {
  return buildTextureSet(
    'snow',
    128,
    (_x, _y, u, v) => {
      const n = tileNoise(u, v, 30, 3);
      return { color: mix([222, 232, 242], [250, 252, 255], n), height: n, roughness: 0.6 };
    },
    1,
  );
}

// --------------------------------------------------------------------------- construções

export function stoneBrickTexture(): TextureSet {
  return buildTextureSet(
    'stonebrick',
    256,
    (_x, _y, u, v) => {
      const rows = 6;
      const cols = 3;
      const row = Math.floor(v * rows);
      const offset = row % 2 === 0 ? 0 : 0.5 / cols;
      const bu = ((u + offset) * cols) % 1;
      const bv = (v * rows) % 1;
      const mortarW = 0.06;
      const edge = Math.min(bu, 1 - bu, bv * (cols / rows) * 2, (1 - bv) * (cols / rows) * 2);
      const isMortar = edge < mortarW;
      const cell = Math.floor((u + offset) * cols) + row * 13;
      const shade = 0.75 + ((cell * 7919) % 100) / 400;
      const n = tileNoise(u, v, 40, 3);
      const wear = tileNoise(u, v, 8, 2);
      if (isMortar) {
        return { color: mix([90, 84, 78], [120, 112, 104], n), height: 0.2 + n * 0.1, roughness: 0.95 };
      }
      const base = mix([120, 116, 110], [168, 160, 150], n * 0.6 + wear * 0.4);
      const c: [number, number, number] = [base[0] * shade, base[1] * shade, base[2] * shade];
      const bevel = Math.min(1, (edge - mortarW) / 0.08);
      return { color: c, height: 0.5 + bevel * 0.4 + n * 0.1, roughness: 0.8 };
    },
    3,
  );
}

export function darkBrickTexture(): TextureSet {
  return buildTextureSet(
    'darkbrick',
    256,
    (_x, _y, u, v) => {
      const rows = 8;
      const cols = 4;
      const row = Math.floor(v * rows);
      const offset = row % 2 === 0 ? 0 : 0.5 / cols;
      const bu = ((u + offset) * cols) % 1;
      const bv = (v * rows) % 1;
      const edge = Math.min(bu, 1 - bu, bv * 2, (1 - bv) * 2);
      const n = tileNoise(u, v, 50, 3);
      if (edge < 0.07) return { color: mix([60, 52, 50], [80, 72, 70], n), height: 0.2, roughness: 0.95 };
      const cell = Math.floor((u + offset) * cols) + row * 17;
      const shade = 0.8 + ((cell * 104729) % 100) / 500;
      const base = mix([128, 58, 46], [172, 90, 70], n);
      return { color: [base[0] * shade, base[1] * shade, base[2] * shade], height: 0.55 + Math.min(1, (edge - 0.07) / 0.08) * 0.35 + n * 0.1, roughness: 0.85 };
    },
    3,
  );
}

export function cobbleTexture(): TextureSet {
  // pedras arredondadas com voronoi simples
  const pts: [number, number, number][] = [];
  const rng = new Rng(555);
  for (let i = 0; i < 40; i++) pts.push([rng.next(), rng.next(), 0.7 + rng.next() * 0.3]);
  return buildTextureSet(
    'cobble',
    256,
    (_x, _y, u, v) => {
      let d1 = 9;
      let d2 = 9;
      let shade = 1;
      for (const [px, py, s] of pts) {
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const dx = u - (px + ox);
            const dy = v - (py + oy);
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < d1) {
              d2 = d1;
              d1 = d;
              shade = s;
            } else if (d < d2) d2 = d;
          }
        }
      }
      const edge = d2 - d1;
      const n = tileNoise(u, v, 40, 3);
      const stone = Math.min(1, edge / 0.05);
      const base = mix([84, 82, 80], [150, 146, 140], n * 0.5 + 0.3);
      const c = mix([70, 66, 62], [base[0] * shade, base[1] * shade, base[2] * shade], stone);
      return { color: c, height: stone * 0.8 + n * 0.2, roughness: 0.85 };
    },
    3,
  );
}

export function woodTexture(): TextureSet {
  return buildTextureSet(
    'wood',
    256,
    (_x, _y, u, v) => {
      const grain = Math.sin((v * 1.0 + tileNoise(u, v, 6, 2) * 0.35) * Math.PI * 24) * 0.5 + 0.5;
      const n = tileNoise(u, v, 30, 3);
      const plank = Math.floor(u * 4);
      const pu = (u * 4) % 1;
      const gap = Math.min(pu, 1 - pu) < 0.03 ? 0 : 1;
      const shade = 0.85 + ((plank * 7) % 4) * 0.05;
      const base = mix([96, 62, 34], [160, 112, 66], grain * 0.6 + n * 0.4);
      return { color: [base[0] * shade * gap, base[1] * shade * gap, base[2] * shade * gap], height: gap * (0.6 + grain * 0.3), roughness: 0.7 };
    },
    2,
  );
}

export function barkTexture(): TextureSet {
  return buildTextureSet(
    'bark',
    256,
    (_x, _y, u, v) => {
      const ridges = Math.pow(tileNoise(u * 3, v * 0.5, 30, 3), 1.5);
      const n = tileNoise(u, v, 12, 4);
      const c = mix([54, 38, 26], [118, 88, 60], ridges * 0.7 + n * 0.3);
      return { color: c, height: ridges, roughness: 0.95 };
    },
    3,
  );
}

export function roofTexture(): TextureSet {
  return buildTextureSet(
    'roof',
    256,
    (_x, _y, u, v) => {
      const rows = 10;
      const row = Math.floor(v * rows);
      const offset = row % 2 === 0 ? 0 : 0.1;
      const tu = ((u + offset) * 5) % 1;
      const tv = (v * rows) % 1;
      const curve = 1 - Math.pow(Math.abs(tu - 0.5) * 2, 2);
      const lip = tv < 0.12 ? 0 : 1;
      const n = tileNoise(u, v, 30, 3);
      const cell = Math.floor((u + offset) * 5) + row * 11;
      const shade = 0.75 + ((cell * 7919) % 100) / 300;
      const base = mix([124, 46, 38], [190, 84, 60], n);
      return { color: [base[0] * shade * (lip ? 1 : 0.6), base[1] * shade * (lip ? 1 : 0.6), base[2] * shade * (lip ? 1 : 0.6)], height: lip * (0.4 + curve * 0.5), roughness: 0.75 };
    },
    2.5,
  );
}

export function fabricTexture(color: [number, number, number], name: string): TextureSet {
  return buildTextureSet(
    `fabric-${name}`,
    128,
    (x, y) => {
      const weave = ((x % 4 < 2) !== (y % 4 < 2) ? 1 : 0.85) as number;
      const n = fbm(x * 0.05, y * 0.05, 2);
      return { color: [color[0] * weave * (0.9 + n * 0.2), color[1] * weave * (0.9 + n * 0.2), color[2] * weave * (0.9 + n * 0.2)], height: weave, roughness: 1 };
    },
    0.8,
  );
}

export function dirtPathTexture(): TextureSet {
  return buildTextureSet(
    'dirt',
    256,
    (_x, _y, u, v) => {
      const n = tileNoise(u, v, 20, 4);
      const pebbles = Math.pow(tileNoise(u, v, 80, 2), 6);
      const c = mix([98, 74, 50], [150, 122, 84], n);
      return { color: mix(c, [160, 150, 140], pebbles), height: n * 0.6 + pebbles * 0.4, roughness: 0.95 };
    },
    1.5,
  );
}

/** Normal map de ondas para a água (tileável). */
export function waterNormalTexture(): THREE.Texture {
  const size = 256;
  const data = new Uint8ClampedArray(size * size * 4);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      h[y * size + x] = tileNoise(u, v, 14, 4) * 0.6 + tileNoise(u + 0.5, v + 0.2, 40, 3) * 0.4;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const g = (dx: number, dy: number) => h[((y + dy + size) % size) * size + ((x + dx + size) % size)];
      const n = new THREE.Vector3(-(g(1, 0) - g(-1, 0)) * 6, -(g(0, 1) - g(0, -1)) * 6, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  return makeTexture(data, size, false, 1);
}

/** Textura de partícula suave (círculo com gradiente). */
export function softParticleTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Textura de chama para a fogueira. */
export function flameTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size * 0.6, 0, size / 2, size * 0.6, size / 2);
  g.addColorStop(0, 'rgba(255,240,180,1)');
  g.addColorStop(0.3, 'rgba(255,160,40,0.9)');
  g.addColorStop(0.7, 'rgba(220,60,10,0.4)');
  g.addColorStop(1, 'rgba(120,20,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function metalTexture(): TextureSet {
  return buildTextureSet(
    'metal',
    256,
    (_x, _y, u, v) => {
      const n = tileNoise(u, v, 18, 4);
      const scratch = Math.pow(tileNoise(u * 2, v * 0.4, 50, 2), 8);
      const c = mix([140, 148, 160], [220, 226, 236], n * 0.7 + scratch * 0.3);
      return { color: c, height: n * 0.4 + scratch, roughness: 0.25 - n * 0.1 };
    },
    2,
  );
}

export function leatherTexture(): TextureSet {
  return buildTextureSet(
    'leather',
    128,
    (_x, _y, u, v) => {
      const n = tileNoise(u, v, 22, 4);
      return { color: mix([72, 42, 28], [130, 86, 52], n), height: n, roughness: 0.7 };
    },
    1.4,
  );
}

export function knitBeanieTexture(): TextureSet {
  return buildTextureSet(
    'beanie',
    256,
    (_x, _y, u, v) => {
      const knit = ((Math.floor(u * 48) + Math.floor(v * 48)) % 2) * 0.08;
      const band = v > 0.78 && v < 0.88 ? 1 : 0;
      const flake = Math.sin(u * Math.PI * 8) * Math.sin(v * Math.PI * 6);
      const snow = flake > 0.55 && v > 0.25 && v < 0.7 ? 1 : 0;
      const base = mix([18, 18, 22], [40, 42, 48], knit + tileNoise(u, v, 10, 2) * 0.3);
      const c = snow || band ? mix(base, [236, 236, 242], 0.85) : base;
      return { color: c, height: knit + snow * 0.2, roughness: 1 };
    },
    1.2,
  );
}

export function skinTexture(base: [number, number, number], name: string): TextureSet {
  return buildTextureSet(
    `skin-${name}`,
    128,
    (_x, _y, u, v) => {
      const n = tileNoise(u, v, 12, 3);
      const pores = tileNoise(u, v, 70, 2);
      const c = mix(base, [Math.min(255, base[0] + 18), Math.min(255, base[1] + 12), Math.min(255, base[2] + 8)], n * 0.5 + pores * 0.2);
      return { color: c, height: pores * 0.15, roughness: 0.55 };
    },
    0.6,
  );
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();

export function pbrMat(
  tex: TextureSet,
  opts: { color?: number; metalness?: number; roughness?: number; emissive?: number; emissiveIntensity?: number; bump?: number } = {},
): THREE.MeshStandardMaterial {
  const key = `${tex.map.uuid}-${opts.color ?? 0xffffff}-${opts.metalness ?? 0}-${opts.roughness ?? 1}-${opts.emissive ?? 0}-${opts.emissiveIntensity ?? 0}`;
  const cached = matCache.get(key);
  if (cached) return cached;
  const m = new THREE.MeshStandardMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    roughnessMap: tex.roughnessMap,
    color: opts.color ?? 0xffffff,
    metalness: opts.metalness ?? 0,
    roughness: opts.roughness ?? 1,
    emissive: opts.emissive ?? 0,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    envMapIntensity: 1.1,
    normalScale: new THREE.Vector2(opts.bump ?? 1, opts.bump ?? 1),
  });
  matCache.set(key, m);
  return m;
}

export function colorMat(
  color: number,
  opts: { roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number; map?: THREE.Texture } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    ...(opts.map ? { map: opts.map } : {}),
    roughness: opts.roughness ?? 0.6,
    metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? 0,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    envMapIntensity: 1,
  });
}

export { rngTex };
