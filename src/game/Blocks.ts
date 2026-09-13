import * as THREE from 'three';
import { Rng } from './Noise';

export const TILE = 16;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;

/** Índices de tiles no atlas de texturas. */
export enum Tile {
  GrassTop,
  GrassSide,
  Dirt,
  Stone,
  Sand,
  Water,
  LogSide,
  LogTop,
  Leaves,
  Brick,
  Plank,
  Gold,
  Cobble,
  Carpet,
  Popcorn,
  DarkBrick,
  Gravel,
  Lava,
  Screen,
  Snow,
}

export enum Block {
  Air = 0,
  Grass,
  Dirt,
  Stone,
  Sand,
  Water,
  Log,
  Leaves,
  Brick,
  Plank,
  Gold,
  Cobble,
  Carpet,
  Popcorn,
  DarkBrick,
  Gravel,
  Lava,
  Screen,
  Snow,
}

/** [topo, base, lados] */
export const BLOCK_TILES: Record<number, [Tile, Tile, Tile]> = {
  [Block.Grass]: [Tile.GrassTop, Tile.Dirt, Tile.GrassSide],
  [Block.Dirt]: [Tile.Dirt, Tile.Dirt, Tile.Dirt],
  [Block.Stone]: [Tile.Stone, Tile.Stone, Tile.Stone],
  [Block.Sand]: [Tile.Sand, Tile.Sand, Tile.Sand],
  [Block.Water]: [Tile.Water, Tile.Water, Tile.Water],
  [Block.Log]: [Tile.LogTop, Tile.LogTop, Tile.LogSide],
  [Block.Leaves]: [Tile.Leaves, Tile.Leaves, Tile.Leaves],
  [Block.Brick]: [Tile.Brick, Tile.Brick, Tile.Brick],
  [Block.Plank]: [Tile.Plank, Tile.Plank, Tile.Plank],
  [Block.Gold]: [Tile.Gold, Tile.Gold, Tile.Gold],
  [Block.Cobble]: [Tile.Cobble, Tile.Cobble, Tile.Cobble],
  [Block.Carpet]: [Tile.Carpet, Tile.Carpet, Tile.Carpet],
  [Block.Popcorn]: [Tile.Popcorn, Tile.Popcorn, Tile.Popcorn],
  [Block.DarkBrick]: [Tile.DarkBrick, Tile.DarkBrick, Tile.DarkBrick],
  [Block.Gravel]: [Tile.Gravel, Tile.Gravel, Tile.Gravel],
  [Block.Lava]: [Tile.Lava, Tile.Lava, Tile.Lava],
  [Block.Screen]: [Tile.Screen, Tile.Screen, Tile.Screen],
  [Block.Snow]: [Tile.Snow, Tile.Dirt, Tile.Snow],
};

export const isSolid = (b: number): boolean => b !== Block.Air && b !== Block.Water;
export const isOpaque = (b: number): boolean => isSolid(b);

// ---------------------------------------------------------------------------
// Pintura procedural dos tiles (estilo Minecraft, 16x16)
// ---------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function px(ctx: Ctx, x: number, y: number, r: number, g: number, b: number) {
  ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
  ctx.fillRect(x, y, 1, 1);
}

/** Preenche o tile com uma cor base e ruído por pixel. */
function noisy(ctx: Ctx, ox: number, oy: number, base: number, variance: number, rng: Rng, w = TILE, h = TILE) {
  const [r, g, b] = hexToRgb(base);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = 1 + (rng.next() * 2 - 1) * variance;
      px(ctx, ox + x, oy + y, r * v, g * v, b * v);
    }
  }
}

function speckle(ctx: Ctx, ox: number, oy: number, color: number, count: number, rng: Rng) {
  const [r, g, b] = hexToRgb(color);
  for (let i = 0; i < count; i++) px(ctx, ox + rng.int(0, 15), oy + rng.int(0, 15), r, g, b);
}

function bricks(ctx: Ctx, ox: number, oy: number, brick: number, mortar: number, rng: Rng, rows = 4) {
  noisy(ctx, ox, oy, mortar, 0.08, rng);
  const bh = TILE / rows;
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : 4;
    for (let bx = -8; bx < TILE; bx += 8) {
      const x0 = bx + offset;
      const [r, g, b] = hexToRgb(brick);
      for (let y = 0; y < bh - 1; y++) {
        for (let x = 0; x < 7; x++) {
          const xx = x0 + x;
          if (xx < 0 || xx >= TILE) continue;
          const v = 1 + (rng.next() * 2 - 1) * 0.1;
          px(ctx, ox + xx, oy + row * bh + y, r * v, g * v, b * v);
        }
      }
    }
  }
}

const PAINTERS: Record<Tile, (ctx: Ctx, ox: number, oy: number, rng: Rng) => void> = {
  [Tile.GrassTop]: (c, x, y, r) => {
    noisy(c, x, y, 0x5aa03c, 0.12, r);
    speckle(c, x, y, 0x76c04a, 14, r);
    speckle(c, x, y, 0x3f7a2a, 10, r);
  },
  [Tile.GrassSide]: (c, x, y, r) => {
    noisy(c, x, y, 0x8a5a33, 0.12, r);
    speckle(c, x, y, 0x6b4426, 12, r);
    noisy(c, x, y, 0x5aa03c, 0.12, r, TILE, 3);
    const [gr, gg, gb] = hexToRgb(0x5aa03c);
    for (let i = 0; i < TILE; i++) if (r.next() < 0.5) px(c, x + i, y + 3, gr, gg, gb);
    for (let i = 0; i < TILE; i++) if (r.next() < 0.2) px(c, x + i, y + 4, gr, gg, gb);
  },
  [Tile.Dirt]: (c, x, y, r) => {
    noisy(c, x, y, 0x8a5a33, 0.12, r);
    speckle(c, x, y, 0x6b4426, 14, r);
    speckle(c, x, y, 0xa06e3f, 8, r);
  },
  [Tile.Stone]: (c, x, y, r) => {
    noisy(c, x, y, 0x8a8a8a, 0.1, r);
    speckle(c, x, y, 0x6f6f6f, 20, r);
    speckle(c, x, y, 0x9d9d9d, 12, r);
  },
  [Tile.Sand]: (c, x, y, r) => {
    noisy(c, x, y, 0xdcc98a, 0.07, r);
    speckle(c, x, y, 0xc9b475, 12, r);
  },
  [Tile.Water]: (c, x, y, r) => {
    noisy(c, x, y, 0x3a7fd5, 0.08, r);
    speckle(c, x, y, 0x6fa8ea, 10, r);
  },
  [Tile.LogSide]: (c, x, y, r) => {
    noisy(c, x, y, 0x6b4a2b, 0.08, r);
    const [dr, dg, db] = hexToRgb(0x4e3520);
    for (let i = 0; i < TILE; i += 4) for (let j = 0; j < TILE; j++) if (r.next() < 0.7) px(c, x + i, y + j, dr, dg, db);
  },
  [Tile.LogTop]: (c, x, y, r) => {
    noisy(c, x, y, 0xb08a58, 0.08, r);
    c.strokeStyle = '#6b4a2b';
    c.lineWidth = 1;
    for (let rad = 2; rad < 8; rad += 2.5) {
      c.beginPath();
      c.arc(x + 8, y + 8, rad, 0, Math.PI * 2);
      c.stroke();
    }
  },
  [Tile.Leaves]: (c, x, y, r) => {
    noisy(c, x, y, 0x3e8a2e, 0.18, r);
    speckle(c, x, y, 0x2b6b1f, 24, r);
    speckle(c, x, y, 0x63b04a, 12, r);
  },
  [Tile.Brick]: (c, x, y, r) => bricks(c, x, y, 0x9b4f3c, 0xc9b9a6, r),
  [Tile.DarkBrick]: (c, x, y, r) => bricks(c, x, y, 0x4a4a52, 0x2b2b30, r),
  [Tile.Plank]: (c, x, y, r) => {
    noisy(c, x, y, 0xb58a4d, 0.06, r);
    const [dr, dg, db] = hexToRgb(0x7d5a2e);
    for (let j = 3; j < TILE; j += 4) for (let i = 0; i < TILE; i++) px(c, x + i, y + j, dr, dg, db);
    for (let i = 0; i < TILE; i++) if (r.next() < 0.15) px(c, x + i, y + r.int(0, 15), dr, dg, db);
  },
  [Tile.Gold]: (c, x, y, r) => {
    noisy(c, x, y, 0xe6b422, 0.08, r);
    speckle(c, x, y, 0xfff2a8, 10, r);
    speckle(c, x, y, 0xb88a10, 8, r);
    c.strokeStyle = '#b88a10';
    c.strokeRect(x + 0.5, y + 0.5, 15, 15);
  },
  [Tile.Cobble]: (c, x, y, r) => {
    noisy(c, x, y, 0x5e5e62, 0.08, r);
    for (let i = 0; i < 9; i++) {
      const sx = r.int(0, 12);
      const sy = r.int(0, 12);
      noisy(c, x + sx, y + sy, r.pick([0x8a8a8e, 0x777779, 0x9a9a9d]), 0.06, r, r.int(3, 5), r.int(3, 5));
    }
  },
  [Tile.Carpet]: (c, x, y, r) => {
    noisy(c, x, y, 0xb3202a, 0.08, r);
    const [gr, gg, gb] = hexToRgb(0xe0b030);
    for (let i = 0; i < TILE; i++) {
      px(c, x + i, y + 1, gr, gg, gb);
      px(c, x + i, y + 14, gr, gg, gb);
    }
  },
  [Tile.Popcorn]: (c, x, y, r) => {
    noisy(c, x, y, 0xf2dc9a, 0.1, r);
    for (let i = 0; i < 10; i++) {
      const sx = r.int(0, 13);
      const sy = r.int(0, 13);
      noisy(c, x + sx, y + sy, r.pick([0xfff7dc, 0xf5e6b8, 0xe8c56a]), 0.05, r, 3, 3);
    }
    speckle(c, x, y, 0xc99a3a, 6, r);
  },
  [Tile.Gravel]: (c, x, y, r) => {
    noisy(c, x, y, 0x7d7873, 0.14, r);
    speckle(c, x, y, 0x5a5652, 18, r);
    speckle(c, x, y, 0x9a948e, 12, r);
  },
  [Tile.Lava]: (c, x, y, r) => {
    noisy(c, x, y, 0xe8621a, 0.14, r);
    speckle(c, x, y, 0xffc93a, 18, r);
    speckle(c, x, y, 0xa82e08, 10, r);
  },
  [Tile.Screen]: (c, x, y, r) => {
    noisy(c, x, y, 0x1a1a24, 0.05, r);
    noisy(c, x + 1, y + 1, 0x6a2fb8, 0.2, r, 14, 14);
    speckle(c, x + 1, y + 1, 0xff3d7a, 14, r);
    speckle(c, x + 1, y + 1, 0x2fd4ff, 10, r);
    // botão de play
    c.fillStyle = '#ff3b3b';
    c.fillRect(x + 5, y + 5, 6, 6);
    c.fillStyle = '#ffffff';
    c.fillRect(x + 7, y + 6, 1, 4);
    c.fillRect(x + 8, y + 7, 1, 2);
  },
  [Tile.Snow]: (c, x, y, r) => {
    noisy(c, x, y, 0xf2f6fa, 0.04, r);
    speckle(c, x, y, 0xdde6ee, 10, r);
  },
};

let atlasCache: THREE.CanvasTexture | null = null;

/** Constrói (uma vez) o atlas de texturas dos blocos. */
export function buildAtlas(): THREE.CanvasTexture {
  if (atlasCache) return atlasCache;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE;
  canvas.height = ATLAS_ROWS * TILE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const rng = new Rng(4242);
  const tiles = Object.keys(PAINTERS).map(Number) as Tile[];
  for (const t of tiles) {
    const col = t % ATLAS_COLS;
    const row = Math.floor(t / ATLAS_COLS);
    PAINTERS[t](ctx, col * TILE, row * TILE, rng);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  atlasCache = tex;
  return tex;
}

/** UVs [u0, v0, u1, v1] de um tile no atlas (v cresce para cima). */
export function tileUv(t: Tile): [number, number, number, number] {
  const col = t % ATLAS_COLS;
  const row = Math.floor(t / ATLAS_COLS);
  const eps = 0.001;
  return [
    col / ATLAS_COLS + eps,
    1 - (row + 1) / ATLAS_ROWS + eps,
    (col + 1) / ATLAS_COLS - eps,
    1 - row / ATLAS_ROWS - eps,
  ];
}
