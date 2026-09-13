import * as THREE from 'three';
import { Block, BLOCK_TILES, buildAtlas, isOpaque, isSolid, tileUv } from './Blocks';
import { Noise2D, Rng } from './Noise';

export const CHUNK = 16;

interface Face {
  dir: [number, number, number];
  corners: [number, number, number][]; // BL, BR, TR, TL vistos de fora
  tile: 0 | 1 | 2; // índice em BLOCK_TILES: topo, base, lado
  shade: number;
}

const FACES: Face[] = [
  { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], tile: 2, shade: 0.8 },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], tile: 2, shade: 0.8 },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], tile: 2, shade: 0.9 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], tile: 2, shade: 0.9 },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], tile: 0, shade: 1.0 },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], tile: 1, shade: 0.55 },
];

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export class World {
  readonly sizeX = 192;
  readonly sizeZ = 192;
  readonly height = 48;
  readonly waterLevel = 10;

  readonly blocks: Uint8Array;
  readonly group = new THREE.Group();

  private chunks = new Map<string, { solid: THREE.Mesh | null; water: THREE.Mesh | null }>();
  private dirty = new Set<string>();
  private solidMat: THREE.Material;
  private waterMat: THREE.Material;

  readonly spawn = new THREE.Vector3();
  readonly tower: Landmark = { x: 0, y: 0, z: 0 };
  readonly castle: Landmark = { x: 0, y: 0, z: 0 };
  readonly castleGate: Landmark = { x: 0, y: 0, z: 0 };
  readonly throne: Landmark = { x: 0, y: 0, z: 0 };
  readonly gateBlocks: [number, number, number][] = [];
  readonly castleBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

  private rng = new Rng(20260913);
  private noise = new Noise2D(913);
  private noise2 = new Noise2D(1337);

  constructor() {
    this.blocks = new Uint8Array(this.sizeX * this.sizeZ * this.height);
    const atlas = buildAtlas();
    this.solidMat = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
    this.waterMat = new THREE.MeshLambertMaterial({
      map: atlas,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      vertexColors: true,
    });
  }

  // ------------------------------------------------------------------ acesso

  private idx(x: number, y: number, z: number): number {
    return (y * this.sizeZ + z) * this.sizeX + x;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && z >= 0 && y >= 0 && x < this.sizeX && z < this.sizeZ && y < this.height;
  }

  get(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return y < 0 ? Block.Stone : Block.Air;
    return this.blocks[this.idx(x, y, z)];
  }

  set(x: number, y: number, z: number, b: number, markDirty = false): void {
    if (!this.inBounds(x, y, z)) return;
    this.blocks[this.idx(x, y, z)] = b;
    if (markDirty) {
      const cx = Math.floor(x / CHUNK);
      const cz = Math.floor(z / CHUNK);
      this.dirty.add(`${cx},${cz}`);
      if (x % CHUNK === 0) this.dirty.add(`${cx - 1},${cz}`);
      if (x % CHUNK === CHUNK - 1) this.dirty.add(`${cx + 1},${cz}`);
      if (z % CHUNK === 0) this.dirty.add(`${cx},${cz - 1}`);
      if (z % CHUNK === CHUNK - 1) this.dirty.add(`${cx},${cz + 1}`);
    }
  }

  isSolidAt(x: number, y: number, z: number): boolean {
    return isSolid(this.get(Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  isWaterAt(x: number, y: number, z: number): boolean {
    return this.get(Math.floor(x), Math.floor(y), Math.floor(z)) === Block.Water;
  }

  /** Altura do chão (y do topo do bloco sólido mais alto + 1). */
  surfaceY(x: number, z: number): number {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    for (let y = this.height - 1; y >= 0; y--) {
      if (isSolid(this.get(bx, y, bz))) return y + 1;
    }
    return 0;
  }

  /** Bloco sólido mais alto que não seja folha (para spawn de mobs). */
  groundBlock(x: number, z: number): { y: number; block: number } {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    for (let y = this.height - 1; y >= 0; y--) {
      const b = this.get(bx, y, bz);
      if (b !== Block.Air && b !== Block.Leaves) return { y, block: b };
    }
    return { y: 0, block: Block.Air };
  }

  insideCastle(x: number, z: number): boolean {
    const b = this.castleBounds;
    return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
  }

  // -------------------------------------------------------------- geração

  private terrainHeight(x: number, z: number): number {
    const n = this.noise.fbm(x * 0.011, z * 0.011, 4);
    const detail = this.noise2.fbm(x * 0.05, z * 0.05, 2);
    let h = 13 + n * 7 + detail * 1.4;
    // Montanhas ao fundo (lado +x +z), onde fica o castelo
    const dx = x - this.sizeX * 0.82;
    const dz = z - this.sizeZ * 0.82;
    const dCastle = Math.sqrt(dx * dx + dz * dz);
    const ridge = Math.max(0, 1 - dCastle / 70);
    h += ridge * ridge * 9;
    return h;
  }

  generate(onProgress?: (p: number) => void): void {
    const { sizeX, sizeZ } = this;
    const heights = new Float32Array(sizeX * sizeZ);
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) heights[z * sizeX + x] = this.terrainHeight(x, z);
    }

    // Planaltos das estruturas
    this.spawn.set(34, 0, 34);
    this.tower.x = 118;
    this.tower.z = 62;
    this.castle.x = Math.round(sizeX * 0.8);
    this.castle.z = Math.round(sizeZ * 0.8);

    const flatten = (cx: number, cz: number, radius: number, level: number) => {
      for (let z = cz - radius - 6; z <= cz + radius + 6; z++) {
        for (let x = cx - radius - 6; x <= cx + radius + 6; x++) {
          if (x < 0 || z < 0 || x >= sizeX || z >= sizeZ) continue;
          const d = Math.max(Math.abs(x - cx), Math.abs(z - cz));
          const i = z * sizeX + x;
          if (d <= radius) heights[i] = level;
          else {
            const t = (d - radius) / 6;
            heights[i] = heights[i] * t + level * (1 - t);
          }
        }
      }
    };

    const spawnLevel = Math.max(13, Math.round(heights[this.spawn.z * sizeX + this.spawn.x]));
    flatten(this.spawn.x - 4, this.spawn.z, 11, spawnLevel);
    const towerLevel = Math.max(13, Math.round(heights[this.tower.z * sizeX + this.tower.x]));
    flatten(this.tower.x, this.tower.z, 9, towerLevel);
    this.tower.y = towerLevel;
    const castleLevel = Math.max(15, Math.round(heights[this.castle.z * sizeX + this.castle.x]));
    flatten(this.castle.x, this.castle.z, 20, castleLevel);
    this.castle.y = castleLevel;

    // Preenchimento
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const h = Math.max(2, Math.min(this.height - 12, Math.round(heights[z * sizeX + x])));
        for (let y = 0; y <= h; y++) {
          let b: number = Block.Stone;
          if (y === h) {
            if (h <= this.waterLevel + 1) b = Block.Sand;
            else if (h >= 30) b = Block.Snow;
            else b = Block.Grass;
          } else if (y > h - 3) b = h <= this.waterLevel + 1 ? Block.Sand : Block.Dirt;
          else if (this.rng.next() < 0.03) b = Block.Gravel;
          this.set(x, y, z, b);
        }
        for (let y = h + 1; y <= this.waterLevel; y++) this.set(x, y, z, Block.Water);
      }
      if (z % 16 === 0) onProgress?.((z / sizeZ) * 0.6);
    }

    this.spawn.y = spawnLevel + 1;
    this.plantTrees();
    onProgress?.(0.7);
    this.buildCamp(spawnLevel);
    this.buildTower(towerLevel);
    this.buildCastle(castleLevel);
    onProgress?.(0.8);
  }

  private plantTrees() {
    const rng = new Rng(777);
    for (let z = 3; z < this.sizeZ - 3; z++) {
      for (let x = 3; x < this.sizeX - 3; x++) {
        if (rng.next() > 0.0085) continue;
        const g = this.groundBlock(x, z);
        if (g.block !== Block.Grass) continue;
        if (this.nearLandmark(x, z, 12)) continue;
        const trunk = rng.int(4, 6);
        for (let y = 1; y <= trunk; y++) this.set(x, g.y + y, z, Block.Log);
        const top = g.y + trunk;
        for (let dy = -2; dy <= 2; dy++) {
          const r = dy === 2 ? 1 : dy === -2 ? 1 : 2;
          for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
              if (Math.abs(dx) === r && Math.abs(dz) === r && rng.next() < 0.5) continue;
              if (dx === 0 && dz === 0 && dy <= 0) continue;
              if (this.get(x + dx, top + dy, z + dz) === Block.Air) this.set(x + dx, top + dy, z + dz, Block.Leaves);
            }
          }
        }
      }
    }
  }

  private nearLandmark(x: number, z: number, r: number): boolean {
    const d = (l: { x: number; z: number }) => Math.max(Math.abs(x - l.x), Math.abs(z - l.z));
    return d(this.spawn) < r || d(this.tower) < r || d(this.castle) < r + 14;
  }

  private buildCamp(level: number) {
    const { x, z } = this.spawn;
    // Fogueira (ao lado, fora da linha de visão inicial)
    const fx = x + 1;
    const fz = z - 5;
    this.set(fx, level + 1, fz, Block.Log);
    this.set(fx, level + 2, fz, Block.Lava);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) this.set(fx + dx, level + 1, fz + dz, Block.Cobble);
    // Cabana (atrás do spawn)
    const hx = x - 13;
    const hz = z - 3;
    for (let dx = 0; dx < 6; dx++) {
      for (let dz = 0; dz < 6; dz++) {
        this.set(hx + dx, level, hz + dz, Block.Plank);
        for (let dy = 1; dy <= 3; dy++) {
          const wall = dx === 0 || dz === 0 || dx === 5 || dz === 5;
          if (!wall) continue;
          const door = dx === 5 && (dz === 2 || dz === 3) && dy <= 2;
          const window = dy === 2 && ((dz === 0 && dx === 2) || (dx === 0 && dz === 3));
          if (door || window) continue;
          this.set(hx + dx, level + dy, hz + dz, dy === 3 || (dx === 0 || dx === 5) ? Block.Log : Block.Plank);
        }
        this.set(hx + dx, level + 4, hz + dz, Block.Plank);
      }
    }
    for (let dx = 1; dx < 5; dx++) for (let dz = 1; dz < 5; dz++) this.set(hx + dx, level + 5, hz + dz, Block.Plank);
    // Tochas (lava para brilhar)
    this.set(hx + 6, level + 3, hz + 1, Block.Lava);
    this.set(hx + 6, level + 3, hz + 4, Block.Lava);
  }

  private buildTower(level: number) {
    const { x: cx, z: cz } = this.tower;
    const R = 4;
    const H = 15;
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > R + 0.5) continue;
        const wall = d > R - 1.2;
        for (let dy = 0; dy <= H; dy++) {
          if (dy === 0) {
            this.set(cx + dx, level + dy, cz + dz, Block.Cobble);
            continue;
          }
          if (!wall) {
            this.set(cx + dx, level + dy, cz + dz, Block.Air);
            continue;
          }
          // porta voltada para o spawn (-x)
          const door = dx <= -R + 1 && Math.abs(dz) <= 1 && dy <= 3;
          const window = dy % 5 === 2 && (Math.abs(dx) < 1 || Math.abs(dz) < 1) && dy > 3;
          if (door || window) continue;
          this.set(cx + dx, level + dy, cz + dz, dy === H && (dx + dz) % 2 === 0 ? Block.Air : Block.Cobble);
        }
      }
    }
    // Andar do topo + tocha
    this.set(cx, level + H + 1, cz, Block.Lava);
    // Placa: moedas de ouro na entrada
    this.set(cx - R - 2, level + 1, cz - 2, Block.Gold);
    this.set(cx - R - 2, level + 1, cz + 2, Block.Gold);
  }

  private buildCastle(level: number) {
    const { x: cx, z: cz } = this.castle;
    const half = 17;
    const wallH = 9;
    const b = this.castleBounds;
    b.minX = cx - half;
    b.maxX = cx + half;
    b.minZ = cz - half;
    b.maxZ = cz + half;

    // Piso
    for (let x = cx - half; x <= cx + half; x++) {
      for (let z = cz - half; z <= cz + half; z++) {
        this.set(x, level, z, Block.DarkBrick);
        for (let y = level + 1; y < level + 16; y++) this.set(x, y, z, Block.Air);
      }
    }
    // Muralhas
    for (let x = cx - half; x <= cx + half; x++) {
      for (let z = cz - half; z <= cz + half; z++) {
        const edgeX = x === cx - half || x === cx + half;
        const edgeZ = z === cz - half || z === cz + half;
        if (!edgeX && !edgeZ) continue;
        for (let y = 1; y <= wallH; y++) this.set(x, level + y, z, Block.Brick);
        // ameias
        const along = edgeX ? z : x;
        if (along % 2 === 0) this.set(x, level + wallH + 1, z, Block.Brick);
      }
    }
    // Torres nos cantos
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const tx = cx + sx * half;
      const tz = cz + sz * half;
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (let y = 1; y <= wallH + 5; y++) {
            const outer = Math.abs(dx) === 2 || Math.abs(dz) === 2;
            const top = y === wallH + 5 && (dx + dz) % 2 !== 0;
            if (y === wallH + 5 && !outer) continue;
            if (top) continue;
            this.set(tx + dx, level + y, tz + dz, outer || y > wallH ? Block.DarkBrick : Block.Air);
          }
        }
      }
      this.set(tx, level + wallH + 6, tz, Block.Lava);
    }

    // Portão (lado -x, voltado para o mundo) selado com ouro até o Élio cair
    const gx = cx - half;
    this.castleGate.x = gx;
    this.castleGate.y = level + 1;
    this.castleGate.z = cz;
    for (let dz = -2; dz <= 2; dz++) {
      for (let y = 1; y <= 5; y++) {
        this.set(gx, level + y, cz + dz, Block.Gold);
        this.gateBlocks.push([gx, level + y, cz + dz]);
      }
      this.set(gx, level + 6, cz + dz, Block.DarkBrick);
    }
    // Tapete até o trono
    for (let x = gx + 1; x <= cx + half - 6; x++) for (let dz = -1; dz <= 1; dz++) this.set(x, level, cz + dz, Block.Carpet);

    // Trono no lado +x
    const tx = cx + half - 5;
    this.throne.x = tx - 3;
    this.throne.y = level + 1;
    this.throne.z = cz;
    for (let dz = -3; dz <= 3; dz++) for (let dx = 0; dx <= 3; dx++) this.set(tx + dx, level + 1, cz + dz, Block.Gold);
    for (let dz = -2; dz <= 2; dz++) this.set(tx + 3, level + 2, cz + dz, Block.Gold);
    for (let dz = -2; dz <= 2; dz++) for (let y = 3; y <= 5; y++) if (Math.abs(dz) === 2 || y === 5) this.set(tx + 3, level + y, cz + dz, Block.Gold);
    for (let dz = -1; dz <= 1; dz++) this.set(tx + 3, level + 3, cz + dz, Block.Carpet);
    this.set(tx + 3, level + 6, cz, Block.Gold);

    // Telões
    for (const side of [-1, 1]) {
      const z = cz + side * half;
      for (let x = cx - 10; x <= cx - 4; x++) for (let y = 3; y <= 6; y++) this.set(x, level + y, z - side, Block.Screen);
      for (let x = cx + 2; x <= cx + 8; x++) for (let y = 3; y <= 6; y++) this.set(x, level + y, z - side, Block.Screen);
    }
    // Pilares
    for (const [px, pz] of [[cx - 8, cz - 8], [cx - 8, cz + 8], [cx + 4, cz - 8], [cx + 4, cz + 8]]) {
      for (let y = 1; y <= 7; y++) this.set(px, level + y, pz, Block.Cobble);
      this.set(px, level + 8, pz, Block.Lava);
    }
    // Baldes de pipoca espalhados
    const rng = new Rng(99);
    for (let i = 0; i < 14; i++) {
      const px = cx + rng.int(-half + 3, half - 8);
      const pz = cz + rng.int(-half + 3, half - 3);
      if (this.get(px, level + 1, pz) === Block.Air) this.set(px, level + 1, pz, Block.Popcorn);
    }
  }

  /** Remove o portão de ouro (chamado quando o Élio é derrotado). */
  openGate(): void {
    for (const [x, y, z] of this.gateBlocks) this.set(x, y, z, Block.Air, true);
    this.rebuildDirty();
  }

  // ------------------------------------------------------------------ mesh

  buildAll(onProgress?: (p: number) => void): void {
    const nx = this.sizeX / CHUNK;
    const nz = this.sizeZ / CHUNK;
    let done = 0;
    for (let cz = 0; cz < nz; cz++) {
      for (let cx = 0; cx < nx; cx++) {
        this.buildChunk(cx, cz);
        done++;
      }
      onProgress?.(0.8 + (done / (nx * nz)) * 0.2);
    }
  }

  rebuildDirty(): void {
    for (const key of this.dirty) {
      const [cx, cz] = key.split(',').map(Number);
      if (cx < 0 || cz < 0 || cx >= this.sizeX / CHUNK || cz >= this.sizeZ / CHUNK) continue;
      this.buildChunk(cx, cz);
    }
    this.dirty.clear();
  }

  private buildChunk(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    const old = this.chunks.get(key);
    if (old) {
      for (const m of [old.solid, old.water]) {
        if (!m) continue;
        this.group.remove(m);
        m.geometry.dispose();
      }
    }

    const solid = new MeshBuilder();
    const water = new MeshBuilder();
    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;

    for (let y = 0; y < this.height; y++) {
      for (let z = z0; z < z0 + CHUNK; z++) {
        for (let x = x0; x < x0 + CHUNK; x++) {
          const b = this.get(x, y, z);
          if (b === Block.Air) continue;
          const tiles = BLOCK_TILES[b];
          if (!tiles) continue;
          const isWater = b === Block.Water;
          for (const f of FACES) {
            const nb = this.get(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
            if (isWater) {
              if (nb !== Block.Air) continue;
            } else if (isOpaque(nb)) continue;
            const builder = isWater ? water : solid;
            // Oclusão simples: escurece faces laterais com bloco sólido acima do vizinho
            let ao = 1;
            if (f.dir[1] === 0 && isOpaque(this.get(x + f.dir[0], y + 1, z + f.dir[2]))) ao = 0.82;
            const glow = b === Block.Lava ? 2.2 : b === Block.Screen ? 1.4 : 1;
            builder.addFace(x, y, z, f, tileUv(tiles[f.tile]), f.shade * ao * glow);
          }
        }
      }
    }

    const entry = { solid: null as THREE.Mesh | null, water: null as THREE.Mesh | null };
    if (solid.count > 0) {
      entry.solid = new THREE.Mesh(solid.build(), this.solidMat);
      entry.solid.castShadow = true;
      entry.solid.receiveShadow = true;
      this.group.add(entry.solid);
    }
    if (water.count > 0) {
      entry.water = new THREE.Mesh(water.build(), this.waterMat);
      entry.water.receiveShadow = true;
      this.group.add(entry.water);
    }
    this.chunks.set(key, entry);
  }
}

class MeshBuilder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];
  count = 0;

  addFace(x: number, y: number, z: number, f: Face, uv: [number, number, number, number], shade: number) {
    const base = this.count * 4;
    const [u0, v0, u1, v1] = uv;
    const uvList = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (let i = 0; i < 4; i++) {
      const c = f.corners[i];
      this.positions.push(x + c[0], y + c[1], z + c[2]);
      this.normals.push(f.dir[0], f.dir[1], f.dir[2]);
      this.uvs.push(uvList[i][0], uvList[i][1]);
      this.colors.push(shade, shade, shade);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.count++;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.indices);
    g.computeBoundingSphere();
    return g;
  }
}
