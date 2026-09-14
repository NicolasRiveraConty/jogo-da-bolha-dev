import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeRock, makeTree } from './Characters';
import { cottageFootprint, makeCottage, makePlaza, type CottageSpec } from './Village';
import { Noise2D, Rng } from './Noise';
import {
  cobbleTexture,
  colorMat,
  darkBrickTexture,
  dirtPathTexture,
  fabricTexture,
  flameTexture,
  grassTexture,
  pbrMat,
  plasterTexture,
  rockTexture,
  roofTexture,
  sandTexture,
  snowTexture,
  stoneBrickTexture,
  waterNormalTexture,
  woodTexture,
} from './Textures';

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type Obstacle =
  | { kind: 'cyl'; x: number; z: number; r: number; y0: number; y1: number }
  | { kind: 'box'; minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };

export class World {
  readonly sizeX = 176;
  readonly sizeZ = 176;
  readonly res = 160;
  readonly waterLevel = 7.4;
  readonly group = new THREE.Group();
  readonly heights: Float32Array;
  readonly spawn = new THREE.Vector3();
  readonly tower: Landmark = { x: 0, y: 0, z: 0 };
  readonly castle: Landmark = { x: 0, y: 0, z: 0 };
  readonly castleGate: Landmark = { x: 0, y: 0, z: 0 };
  readonly throne: Landmark = { x: 0, y: 0, z: 0 };
  readonly npcSpots: Record<'banhos' | 'almeida' | 'anderson', THREE.Vector3> = {
    banhos: new THREE.Vector3(),
    almeida: new THREE.Vector3(),
    anderson: new THREE.Vector3(),
  };
  readonly bossSpots: Record<'deyvin' | 'elon' | 'pedro', THREE.Vector3> = {
    deyvin: new THREE.Vector3(),
    elon: new THREE.Vector3(),
    pedro: new THREE.Vector3(),
  };
  readonly dens: Record<'deyvin' | 'elon' | 'pedro', Landmark> = {
    deyvin: { x: 0, y: 0, z: 0 },
    elon: { x: 0, y: 0, z: 0 },
    pedro: { x: 0, y: 0, z: 0 },
  };
  readonly castleBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  readonly obstacles: Obstacle[] = [];
  gateOpen = false;
  private gateLeft!: THREE.Object3D;
  private gateRight!: THREE.Object3D;
  private water!: THREE.Mesh;
  private waterN1: THREE.Texture;
  private waterN2: THREE.Texture;
  private noise = new Noise2D(913);
  private noise2 = new Noise2D(1337);
  private rng = new Rng(20260913);
  private gateObstacle: Obstacle | null = null;
  private fireLights: THREE.PointLight[] = [];

  constructor() {
    this.heights = new Float32Array(this.res * this.res);
    this.waterN1 = waterNormalTexture();
    this.waterN2 = waterNormalTexture();
    this.waterN1.wrapS = this.waterN1.wrapT = THREE.RepeatWrapping;
    this.waterN2.wrapS = this.waterN2.wrapT = THREE.RepeatWrapping;
  }

  private hi(ix: number, iz: number): number {
    const x = Math.max(0, Math.min(this.res - 1, ix));
    const z = Math.max(0, Math.min(this.res - 1, iz));
    return this.heights[z * this.res + x];
  }

  heightAt(x: number, z: number): number {
    const gx = (x / this.sizeX) * (this.res - 1);
    const gz = (z / this.sizeZ) * (this.res - 1);
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const tx = gx - x0;
    const tz = gz - z0;
    return this.hi(x0, z0) * (1 - tx) * (1 - tz) + this.hi(x0 + 1, z0) * tx * (1 - tz) + this.hi(x0, z0 + 1) * (1 - tx) * tz + this.hi(x0 + 1, z0 + 1) * tx * tz;
  }

  surfaceY(x: number, z: number): number {
    return this.heightAt(x, z);
  }

  isWaterAt(x: number, y: number, z: number): boolean {
    const h = this.heightAt(x, z);
    return h < this.waterLevel - 0.15 && y <= this.waterLevel + 0.2;
  }

  isSolidAt(x: number, y: number, z: number): boolean {
    if (y < this.heightAt(x, z) - 0.02) return true;
    return this.blocked(x, y, z, 0.08, 0.08);
  }

  insideCastle(x: number, z: number): boolean {
    const b = this.castleBounds;
    return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
  }

  blocked(x: number, y: number, z: number, r: number, h: number): boolean {
    for (const o of this.obstacles) {
      if (this.gateOpen && o === this.gateObstacle) continue;
      if (o.kind === 'cyl') {
        if (y + h < o.y0 || y > o.y1) continue;
        const dx = x - o.x;
        const dz = z - o.z;
        if (dx * dx + dz * dz < (o.r + r) * (o.r + r)) return true;
      } else {
        if (y + h < o.minY || y > o.maxY) continue;
        if (x + r > o.minX && x - r < o.maxX && z + r > o.minZ && z - r < o.maxZ) return true;
      }
    }
    return false;
  }

  openGate(): void {
    this.gateOpen = true;
  }

  update(dt: number, time: number): void {
    if (this.water) {
      const m = this.water.material as THREE.MeshPhysicalMaterial;
      if (m.normalMap) {
        m.normalMap.offset.x = time * 0.03;
        m.normalMap.offset.y = time * 0.02;
      }
    }
    if (this.gateOpen) {
      this.gateLeft.rotation.y = THREE.MathUtils.lerp(this.gateLeft.rotation.y, -1.35, 1 - Math.pow(0.001, dt));
      this.gateRight.rotation.y = THREE.MathUtils.lerp(this.gateRight.rotation.y, 1.35, 1 - Math.pow(0.001, dt));
    }
    for (const l of this.fireLights) l.intensity = 6 + Math.sin(time * 9 + l.position.x) * 1.4;
  }

  generate(onProgress?: (p: number) => void): void {
    this.spawn.set(36, 0, 38);
    this.tower.x = 108;
    this.tower.z = 68;
    this.castle.x = 142;
    this.castle.z = 142;
    this.dens.deyvin.x = 26;
    this.dens.deyvin.z = 148;
    this.dens.elon.x = 154;
    this.dens.elon.z = 28;
    this.dens.pedro.x = 50;
    this.dens.pedro.z = 102;

    const { res, sizeX, sizeZ } = this;
    for (let z = 0; z < res; z++) {
      for (let x = 0; x < res; x++) {
        const wx = (x / (res - 1)) * sizeX;
        const wz = (z / (res - 1)) * sizeZ;
        const n = this.noise.fbm(wx * 0.012, wz * 0.012, 5);
        const d = this.noise2.fbm(wx * 0.045, wz * 0.045, 3);
        let h = 9.2 + n * 6.5 + d * 1.6;
        const dx = wx - sizeX * 0.82;
        const dz = wz - sizeZ * 0.82;
        const ridge = Math.max(0, 1 - Math.hypot(dx, dz) / 62);
        h += ridge * ridge * 8;
        const lake = this.noise.fbm(wx * 0.02 + 40, wz * 0.02, 3);
        if (lake > 0.35 && wx < 70 && wz < 90) h -= (lake - 0.35) * 10;
        this.heights[z * res + x] = h;
      }
    }
    onProgress?.(0.25);

    const flatten = (cx: number, cz: number, radius: number, level: number) => {
      const gx = (cx / sizeX) * (res - 1);
      const gz = (cz / sizeZ) * (res - 1);
      const gr = (radius / sizeX) * (res - 1);
      for (let z = 0; z < res; z++) {
        for (let x = 0; x < res; x++) {
          const d = Math.hypot(x - gx, z - gz);
          if (d < gr) this.heights[z * res + x] = level;
          else if (d < gr + 8) {
            const t = (d - gr) / 8;
            this.heights[z * res + x] = this.heights[z * res + x] * t + level * (1 - t);
          }
        }
      }
    };

    const spawnH = this.heightAt(this.spawn.x, this.spawn.z);
    flatten(this.spawn.x, this.spawn.z, 17, spawnH);
    this.spawn.y = spawnH;
    const towerH = Math.max(spawnH + 1, this.heightAt(this.tower.x, this.tower.z));
    flatten(this.tower.x, this.tower.z, 10, towerH);
    this.tower.y = towerH;
    const castleH = Math.max(towerH + 1.5, this.heightAt(this.castle.x, this.castle.z));
    flatten(this.castle.x, this.castle.z, 22, castleH);
    this.castle.y = castleH;

    this.carvePath(this.spawn.x, this.spawn.z, this.tower.x, this.tower.z);
    this.carvePath(this.tower.x, this.tower.z, this.castle.x - 18, this.castle.z);
    this.carvePath(this.spawn.x, this.spawn.z, this.dens.deyvin.x, this.dens.deyvin.z);
    this.carvePath(this.spawn.x, this.spawn.z, this.dens.elon.x, this.dens.elon.z);
    this.carvePath(this.spawn.x, this.spawn.z, this.dens.pedro.x, this.dens.pedro.z);
    this.carvePath(this.dens.pedro.x, this.dens.pedro.z, this.tower.x, this.tower.z);

    const placeArena = (spot: Landmark, radius: number) => {
      const h = Math.max(spawnH + 0.4, this.heightAt(spot.x, spot.z));
      flatten(spot.x, spot.z, radius, h);
      spot.y = h;
    };
    placeArena(this.dens.deyvin, 11);
    placeArena(this.dens.elon, 11);
    placeArena(this.dens.pedro, 11);
    onProgress?.(0.4);

    this.buildTerrain();
    onProgress?.(0.55);
    this.buildWater();
    this.scatterNature();
    onProgress?.(0.7);
    this.buildCamp(spawnH);
    this.buildTower(towerH);
    this.buildCastle(castleH);
    this.buildDeyvinCafe(this.dens.deyvin.y);
    this.buildElonPad(this.dens.elon.y);
    this.buildPedroHq(this.dens.pedro.y);
    onProgress?.(0.95);
  }

  private carvePath(x0: number, z0: number, x1: number, z1: number) {
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const h = this.heightAt(x, z);
      const gx = (x / this.sizeX) * (this.res - 1);
      const gz = (z / this.sizeZ) * (this.res - 1);
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          const ix = Math.round(gx + dx);
          const iz = Math.round(gz + dz);
          if (ix < 0 || iz < 0 || ix >= this.res || iz >= this.res) continue;
          const fall = 1 - Math.hypot(dx, dz) / 4;
          if (fall <= 0) continue;
          const idx = iz * this.res + ix;
          this.heights[idx] = this.heights[idx] * (1 - fall * 0.7) + h * fall * 0.7;
        }
      }
    }
  }

  private buildTerrain() {
    const geo = new THREE.PlaneGeometry(this.sizeX, this.sizeZ, this.res - 1, this.res - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const color = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(0x355c2c);
    const dirt = new THREE.Color(0x6e5436);
    const sand = new THREE.Color(0xc2b07a);
    const rock = new THREE.Color(0x7a7670);
    const snow = new THREE.Color(0xe8eef4);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + this.sizeX / 2;
      const z = pos.getZ(i) + this.sizeZ / 2;
      const ix = Math.round((x / this.sizeX) * (this.res - 1));
      const iz = Math.round((z / this.sizeZ) * (this.res - 1));
      const h = this.hi(ix, iz);
      pos.setY(i, h);
      const slope = Math.abs(this.hi(ix + 1, iz) - this.hi(ix - 1, iz)) + Math.abs(this.hi(ix, iz + 1) - this.hi(ix, iz - 1));
      if (h < this.waterLevel + 0.6) tmp.copy(sand);
      else if (h > 22) tmp.copy(snow);
      else if (slope > 2.4) tmp.copy(rock);
      else {
        const path = this.nearPath(x, z);
        tmp.copy(grass).lerp(dirt, path);
      }
      color[i * 3] = tmp.r;
      color[i * 3 + 1] = tmp.g;
      color[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geo.computeVertexNormals();
    const grassSet = grassTexture();
    grassSet.map.repeat.set(42, 42);
    grassSet.normalMap.repeat.set(42, 42);
    grassSet.roughnessMap.repeat.set(42, 42);
    const mat = pbrMat(grassSet, { roughness: 0.9, bump: 1.7, env: 0.7 });
    mat.vertexColors = true;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(this.sizeX / 2, 0, this.sizeZ / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.group.add(mesh);
  }

  private nearPath(x: number, z: number): number {
    const segs: [number, number, number, number][] = [
      [this.spawn.x, this.spawn.z, this.tower.x, this.tower.z],
      [this.tower.x, this.tower.z, this.castle.x - 18, this.castle.z],
      [this.spawn.x, this.spawn.z, this.dens.deyvin.x, this.dens.deyvin.z],
      [this.spawn.x, this.spawn.z, this.dens.elon.x, this.dens.elon.z],
      [this.spawn.x, this.spawn.z, this.dens.pedro.x, this.dens.pedro.z],
      [this.dens.pedro.x, this.dens.pedro.z, this.tower.x, this.tower.z],
    ];
    let d = 999;
    for (const [ax, az, bx, bz] of segs) d = Math.min(d, distToSeg(x, z, ax, az, bx, bz));
    return THREE.MathUtils.clamp(1 - (d - 1.2) / 2.2, 0, 1);
  }

  private buildWater() {
    const geo = new THREE.PlaneGeometry(this.sizeX + 20, this.sizeZ + 20, 32, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x1a4e72,
      roughness: 0.12,
      metalness: 0.02,
      transmission: 0.42,
      ior: 1.333,
      thickness: 1.6,
      transparent: true,
      opacity: 0.92,
      envMapIntensity: 1.15,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
      normalMap: this.waterN1,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.set(this.sizeX / 2, this.waterLevel, this.sizeZ / 2);
    this.water.receiveShadow = true;
    this.group.add(this.water);
  }

  private scatterNature() {
    const rng = this.rng;
    for (let i = 0; i < 140; i++) {
      const x = rng.range(8, this.sizeX - 8);
      const z = rng.range(8, this.sizeZ - 8);
      if (this.nearLandmark(x, z, 14)) continue;
      if (this.nearPath(x, z) > 0.4) continue;
      const h = this.heightAt(x, z);
      if (h < this.waterLevel + 0.5 || h > 20) continue;
      const tree = makeTree(rng.int(0, 99));
      tree.position.set(x, h, z);
      tree.rotation.y = rng.range(0, Math.PI * 2);
      const s = rng.range(0.85, 1.25);
      tree.scale.setScalar(s);
      this.group.add(tree);
      this.obstacles.push({ kind: 'cyl', x, z, r: 0.28 * s, y0: h, y1: h + 3.5 * s });
    }
    for (let i = 0; i < 80; i++) {
      const x = rng.range(6, this.sizeX - 6);
      const z = rng.range(6, this.sizeZ - 6);
      if (this.nearLandmark(x, z, 10)) continue;
      const h = this.heightAt(x, z);
      if (h < this.waterLevel - 0.2) continue;
      const rock = makeRock(rng.int(0, 20));
      rock.position.set(x, h + 0.05, z);
      rock.rotation.set(rng.range(0, 0.4), rng.range(0, 6), rng.range(0, 0.4));
      const s = rng.range(0.6, 1.6);
      rock.scale.setScalar(s);
      this.group.add(rock);
    }
  }

  private nearLandmark(x: number, z: number, r: number): boolean {
    const d = (l: { x: number; z: number }) => Math.hypot(x - l.x, z - l.z);
    return d(this.spawn) < r + 5 || d(this.tower) < r || d(this.castle) < r + 16 || d(this.dens.deyvin) < r || d(this.dens.elon) < r || d(this.dens.pedro) < r;
  }

  private addBoxObs(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number) {
    this.obstacles.push({ kind: 'box', minX, maxX, minY, maxY, minZ, maxZ });
  }

  private buildCamp(level: number) {
    const { x, z } = this.spawn;
    this.group.add(makePlaza(x, level, z, 5.5));
    this.obstacles.push({ kind: 'cyl', x, z, r: 0.45, y0: level, y1: level + 3.6 });

    const houses: CottageSpec[] = [
      { x: x - 8.6, y: level, z: z - 1.4, yaw: Math.PI / 2, w: 4.4, d: 3.5, stories: 1 },
      { x: x + 8.8, y: level, z: z + 0.6, yaw: -Math.PI / 2, w: 3.9, d: 3.3, stories: 1 },
      { x: x - 3.2, y: level, z: z + 8.8, yaw: Math.PI, w: 4.2, d: 3.4, stories: 2, h: 3.2 },
      { x: x + 4.6, y: level, z: z + 8.6, yaw: Math.PI, w: 3.7, d: 3.2 },
      { x: x + 0.8, y: level, z: z - 9.0, yaw: 0, w: 4.6, d: 3.5 },
    ];
    for (const spec of houses) {
      this.group.add(makeCottage(spec));
      const f = cottageFootprint(spec);
      this.addBoxObs(f.minX, f.maxX, level, level + 4.2, f.minZ, f.maxZ);
    }

    this.placeRoadCottages();
    this.addCampfire(x + 2.4, level, z - 3.6);

    this.npcSpots.banhos.set(x + 3.1, level, z - 1.6);
    this.npcSpots.almeida.set(x - 2.4, level, z + 3.0);
    this.npcSpots.anderson.set(x + 4.2, level, z + 3.2);
  }

  private placeRoadCottages() {
    const { x, z } = this.spawn;
    const tx = this.tower.x - x;
    const tz = this.tower.z - z;
    const len = Math.hypot(tx, tz) || 1;
    const px = -tz / len;
    const pz = tx / len;
    const spots: [number, number][] = [
      [0.22, 1],
      [0.38, -1],
    ];
    for (const [t, side] of spots) {
      const cx = x + tx * t + px * 7.2 * side;
      const cz = z + tz * t + pz * 7.2 * side;
      const y = this.heightAt(cx, cz);
      if (y < this.waterLevel + 0.4) continue;
      const yaw = Math.atan2(x + tx * t - cx, z + tz * t - cz);
      const spec: CottageSpec = { x: cx, y, z: cz, yaw, w: 3.8, d: 3.2 };
      this.group.add(makeCottage(spec));
      const f = cottageFootprint(spec);
      this.addBoxObs(f.minX, f.maxX, y, y + 4, f.minZ, f.maxZ);
    }
  }

  private addCampfire(x: number, y: number, z: number) {
    const stone = pbrMat(rockTexture(), { roughness: 0.9 });
    const ring = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), stone);
      s.position.set(x + Math.cos(a) * 0.55, y + 0.1, z + Math.sin(a) * 0.55);
      s.castShadow = true;
      ring.add(s);
    }
    const log = pbrMat(woodTexture(), { roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 6), log);
      l.position.set(x, y + 0.12, z);
      l.rotation.set(0.2, (i / 3) * Math.PI, Math.PI / 2);
      ring.add(l);
    }
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flame.position.set(x, y + 0.55, z);
    flame.scale.set(0.9, 1.3, 1);
    ring.add(flame);
    const light = new THREE.PointLight(0xff7a30, 7, 12, 1.6);
    light.position.set(x, y + 0.7, z);
    ring.add(light);
    this.fireLights.push(light);
    this.group.add(ring);
  }

  private rbox(w: number, h: number, d: number, mat: THREE.Material, radius = 0.05): THREE.Mesh {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, Math.min(w, h, d) * 0.2)), mat);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  private buildTower(level: number) {
    const { x, z } = this.tower;
    const stone = pbrMat(stoneBrickTexture(), { roughness: 0.86, bump: 1.35, env: 0.8 });
    const dark = pbrMat(cobbleTexture(), { roughness: 0.88, bump: 1.1 });
    const roof = pbrMat(roofTexture(), { roughness: 0.68, bump: 1.2 });
    const wood = pbrMat(woodTexture(), { roughness: 0.72 });
    const r = 3.45;
    const h = 11;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.32, h, 28, 1, true), stone);
    wall.position.set(x, level + h / 2, z);
    wall.castShadow = wall.receiveShadow = true;
    this.group.add(wall);
    for (const y of [0.35, 3.6, 7.1, 10.2]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(r + 0.08, 0.08, 8, 28), stone);
      band.rotation.x = Math.PI / 2;
      band.position.set(x, level + y, z);
      band.castShadow = true;
      this.group.add(band);
    }
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.08, r - 0.08, 0.22, 24), dark);
    floor.position.set(x, level + 0.11, z);
    floor.receiveShadow = true;
    this.group.add(floor);
    const merlonR = r + 0.12;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (i % 2 === 0) continue;
      const merlon = this.rbox(0.38, 0.72, 0.28, stone, 0.04);
      merlon.position.set(x + Math.cos(a) * merlonR, level + h + 0.36, z + Math.sin(a) * merlonR);
      merlon.rotation.y = -a;
      this.group.add(merlon);
    }
    const top = new THREE.Mesh(new THREE.ConeGeometry(r + 0.55, 3.3, 24), roof);
    top.position.set(x, level + h + 2.05, z);
    top.castShadow = true;
    this.group.add(top);
    const glass = colorMat(0x8aa8b8, { roughness: 0.08, transmission: 0.7, ior: 1.5, thickness: 0.05, env: 1.5, clearcoat: 0.8 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const wx = x + Math.cos(a) * (r - 0.02);
      const wz = z + Math.sin(a) * (r - 0.02);
      const frame = this.rbox(0.62, 0.95, 0.12, wood, 0.02);
      frame.position.set(wx, level + 4.6 + (i % 2) * 2.4, wz);
      frame.lookAt(x, frame.position.y, z);
      this.group.add(frame);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.78), glass);
      pane.position.copy(frame.position);
      pane.lookAt(x, pane.position.y, z);
      pane.position.addScaledVector(new THREE.Vector3(wx - x, 0, wz - z).normalize(), 0.08);
      this.group.add(pane);
    }
    const door = this.rbox(1.45, 2.55, 0.18, wood, 0.03);
    door.position.set(x - r + 0.05, level + 1.28, z);
    this.group.add(door);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.08, 8, 16, Math.PI), stone);
    arch.rotation.y = Math.PI / 2;
    arch.position.set(x - r + 0.02, level + 2.55, z);
    this.group.add(arch);
    this.obstacles.push({ kind: 'cyl', x, z, r: r - 0.15, y0: level + 0.4, y1: level + h });
    this.addCampfire(x - r - 3.5, level, z);
  }

  private buildDeyvinCafe(level: number) {
    const { x, z } = this.dens.deyvin;
    const wood = pbrMat(woodTexture(), { roughness: 0.75 });
    const roof = pbrMat(roofTexture(), { roughness: 0.7 });
    const orange = colorMat(0xc45a1a, { roughness: 0.55 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 0.18, 9), wood);
    deck.position.set(x, level + 0.09, z);
    deck.receiveShadow = true;
    this.group.add(deck);
    const stall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.4), wood);
    stall.position.set(x + 2.6, level + 1.2, z + 2.8);
    stall.castShadow = true;
    this.group.add(stall);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 3.2), orange);
    awning.position.set(x + 2.6, level + 2.4, z + 2.6);
    this.group.add(awning);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 2.8), roof);
    top.position.set(x + 2.6, level + 2.55, z + 2.8);
    this.group.add(top);
    this.addBoxObs(x + 1.1, x + 4.1, level, level + 2.6, z + 1.7, z + 4.0);
    const stage = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.35, 2.2), wood);
    stage.position.set(x - 2.4, level + 0.28, z - 2.2);
    this.group.add(stage);
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 8), colorMat(0x222226, { metalness: 0.6, roughness: 0.3 }));
    mic.position.set(x - 2.4, level + 1.1, z - 2.2);
    this.group.add(mic);
    this.addCampfire(x - 3.6, level, z + 1.2);
    for (const [sx, sz] of [
      [-1.2, 1.4],
      [0.2, 1.8],
      [1.4, 0.6],
    ] as const) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.55, 10), wood);
      st.position.set(x + sx, level + 0.4, z + sz);
      this.group.add(st);
    }
    this.bossSpots.deyvin.set(x - 0.4, level, z + 0.2);
  }

  private buildElonPad(level: number) {
    const { x, z } = this.dens.elon;
    const steel = colorMat(0xb8c0cc, { metalness: 0.82, roughness: 0.28 });
    const dark = colorMat(0x1a1a22, { metalness: 0.4, roughness: 0.45 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.4, 0.28, 24), dark);
    pad.position.set(x, level + 0.14, z);
    pad.receiveShadow = true;
    this.group.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.12, 8, 28), steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, level + 0.32, z);
    this.group.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.4, 0.35), steel);
      pylon.position.set(x + Math.cos(a) * 5.4, level + 1.7, z + Math.sin(a) * 5.4);
      pylon.castShadow = true;
      this.group.add(pylon);
    }
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 4.2, 12), steel);
    body.position.set(x + 4.2, level + 2.3, z + 3.6);
    body.castShadow = true;
    this.group.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 12), colorMat(0xffffff, { metalness: 0.3, roughness: 0.35 }));
    nose.position.set(x + 4.2, level + 5.1, z + 3.6);
    this.group.add(nose);
    this.addBoxObs(x + 3.5, x + 4.9, level, level + 5.5, z + 2.9, z + 4.3);
    const light = new THREE.PointLight(0xa8d8ff, 7, 16, 1.6);
    light.position.set(x, level + 3.2, z);
    this.group.add(light);
    this.fireLights.push(light);
    this.bossSpots.elon.set(x, level, z);
  }

  private buildPedroHq(level: number) {
    const { x, z } = this.dens.pedro;
    const wall = pbrMat(plasterTexture(), { color: 0xc8b898, roughness: 0.86, bump: 0.8 });
    const gold = colorMat(0xc4a24a, { metalness: 0.72, roughness: 0.35, emissive: 0x553300, emissiveIntensity: 0.06 });
    const cobble = pbrMat(cobbleTexture(), { roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 8.4), cobble);
    floor.position.set(x, level + 0.1, z);
    floor.receiveShadow = true;
    this.group.add(floor);
    const h = 3.6;
    const back = new THREE.Mesh(new THREE.BoxGeometry(10, h, 0.35), wall);
    back.position.set(x, level + h / 2, z + 4);
    back.castShadow = true;
    this.group.add(back);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 8.4), wall);
    left.position.set(x - 4.85, level + h / 2, z);
    this.group.add(left);
    const right = left.clone();
    right.position.x = x + 4.85;
    this.group.add(right);
    this.addBoxObs(x - 5.1, x + 5.1, level, level + h, z + 3.7, z + 4.3);
    this.addBoxObs(x - 5.15, x - 4.55, level, level + h, z - 4.2, z + 4.2);
    this.addBoxObs(x + 4.55, x + 5.15, level, level + h, z - 4.2, z + 4.2);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.22, 8.8), gold);
    roof.position.set(x, level + h + 0.1, z);
    this.group.add(roof);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.12), gold);
    sign.position.set(x, level + h + 0.55, z - 4.1);
    this.group.add(sign);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.1), pbrMat(woodTexture(), { roughness: 0.7 }));
    desk.position.set(x, level + 0.55, z + 1.6);
    this.group.add(desk);
    this.addCampfire(x - 6.2, level, z - 2.4);
    this.bossSpots.pedro.set(x, level, z - 2.4);
  }

  private buildCastle(level: number) {
    const { x: cx, z: cz } = this.castle;
    const half = 16;
    const b = this.castleBounds;
    b.minX = cx - half;
    b.maxX = cx + half;
    b.minZ = cz - half;
    b.maxZ = cz + half;
    const brick = pbrMat(darkBrickTexture(), { roughness: 0.8, bump: 1.1 });
    const stone = pbrMat(stoneBrickTexture(), { roughness: 0.82 });
    const cobble = pbrMat(cobbleTexture(), { roughness: 0.85 });
    const gold = colorMat(0xe6c35a, { metalness: 0.8, roughness: 0.3, emissive: 0x553300, emissiveIntensity: 0.12 });
    const carpet = pbrMat(fabricTexture([179, 32, 42], 'carpet'), { roughness: 0.95 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(half * 2 - 0.4, 0.25, half * 2 - 0.4), cobble);
    floor.position.set(cx, level + 0.12, cz);
    floor.receiveShadow = true;
    this.group.add(floor);

    const wallH = 8;
    const thick = 1.4;
    const walls: [number, number, number, number, number, number][] = [
      [cx, level + wallH / 2, cz - half, half * 2, wallH, thick],
      [cx, level + wallH / 2, cz + half, half * 2, wallH, thick],
      [cx + half, level + wallH / 2, cz, thick, wallH, half * 2],
    ];
    for (const [wx, wy, wz, sx, sy, sz] of walls) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), brick);
      w.position.set(wx, wy, wz);
      w.castShadow = w.receiveShadow = true;
      this.group.add(w);
      this.addBoxObs(wx - sx / 2, wx + sx / 2, wy - sy / 2, wy + sy / 2, wz - sz / 2, wz + sz / 2);
      const alongX = sx > sz;
      const span = alongX ? sx : sz;
      const n = Math.floor(span / 1.6);
      for (let i = 0; i < n; i++) {
        if (i % 2 === 0) continue;
        const t = (i + 0.5) / n - 0.5;
        const merlon = this.rbox(alongX ? 0.7 : thick + 0.12, 0.7, alongX ? thick + 0.12 : 0.7, brick, 0.04);
        merlon.position.set(alongX ? wx + t * span : wx, level + wallH + 0.35, alongX ? wz : wz + t * span);
        this.group.add(merlon);
      }
      for (let i = 0; i < 4; i++) {
        const t = (i + 0.5) / 4 - 0.5;
        const slit = this.rbox(alongX ? 0.22 : 0.18, 1.15, alongX ? 0.18 : 0.22, colorMat(0x1a1a18, { roughness: 0.9 }), 0.02);
        slit.position.set(alongX ? wx + t * span * 0.7 : wx + (sx > 0 ? -0.55 : 0.55), level + 4.2, alongX ? wz + (sz > 0 ? 0.55 : -0.55) : wz + t * span * 0.7);
        this.group.add(slit);
      }
    }
    // parede da frente com buraco de portão
    const gx = cx - half;
    const leftW = new THREE.Mesh(new THREE.BoxGeometry(thick, wallH, half - 2.2), brick);
    leftW.position.set(gx, level + wallH / 2, cz - (half + 2.2) / 2 + 0.1);
    leftW.castShadow = true;
    this.group.add(leftW);
    const rightW = leftW.clone();
    rightW.position.z = cz + (half + 2.2) / 2 - 0.1;
    this.group.add(rightW);
    this.addBoxObs(gx - thick / 2, gx + thick / 2, level, level + wallH, cz - half, cz - 2.4);
    this.addBoxObs(gx - thick / 2, gx + thick / 2, level, level + wallH, cz + 2.4, cz + half);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(thick, 2.2, 5.2), brick);
    lintel.position.set(gx, level + 6.5, cz);
    this.group.add(lintel);

    this.castleGate.x = gx;
    this.castleGate.y = level + 1;
    this.castleGate.z = cz;
    this.gateLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.2, 2.4), gold);
    this.gateLeft.position.set(gx, level + 2.7, cz - 1.2);
    this.group.add(this.gateLeft);
    this.gateRight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.2, 2.4), gold);
    this.gateRight.position.set(gx, level + 2.7, cz + 1.2);
    this.group.add(this.gateRight);
    this.addBoxObs(gx - 0.4, gx + 0.4, level, level + 5.4, cz - 2.4, cz + 2.4);
    this.gateObstacle = this.obstacles[this.obstacles.length - 1];

    const rug = new THREE.Mesh(new THREE.BoxGeometry(half * 1.4, 0.04, 2.4), carpet);
    rug.position.set(cx - 2, level + 0.26, cz);
    rug.receiveShadow = true;
    this.group.add(rug);

    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const tx = cx + sx * half;
      const tz = cz + sz * half;
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.65, wallH + 4, 20), stone);
      tw.position.set(tx, level + (wallH + 4) / 2, tz);
      tw.castShadow = true;
      this.group.add(tw);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        if (i % 2 === 0) continue;
        const merlon = this.rbox(0.42, 0.7, 0.28, stone, 0.04);
        merlon.position.set(tx + Math.cos(a) * 2.45, level + wallH + 4.15, tz + Math.sin(a) * 2.45);
        merlon.rotation.y = -a;
        this.group.add(merlon);
      }
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.85, 2.7, 16), pbrMat(roofTexture(), { roughness: 0.68, bump: 1.15 }));
      cone.position.set(tx, level + wallH + 5.1, tz);
      cone.castShadow = true;
      this.group.add(cone);
      this.obstacles.push({ kind: 'cyl', x: tx, z: tz, r: 2.3, y0: level, y1: level + wallH + 4 });
      const torch = new THREE.PointLight(0xff7a30, 8, 14, 1.8);
      torch.position.set(tx, level + wallH + 2, tz);
      this.group.add(torch);
      this.fireLights.push(torch);
    }

    const throneX = cx + half - 5;
    this.throne.x = throneX - 2;
    this.throne.y = level + 0.3;
    this.throne.z = cz;
    const seat = this.rbox(2.2, 0.5, 2.4, gold, 0.08);
    seat.position.set(throneX, level + 0.7, cz);
    this.group.add(seat);
    const back = this.rbox(0.38, 2.6, 2.4, gold, 0.06);
    back.position.set(throneX + 0.9, level + 1.8, cz);
    this.group.add(back);

    for (const side of [-1, 1]) {
      const screens = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 0.12), colorMat(0x3a1a60, { emissive: 0x6a2fb8, emissiveIntensity: 0.55, roughness: 0.3 }));
      screens.position.set(cx - 4, level + 3.4, cz + side * (half - 1.1));
      this.group.add(screens);
    }
  }

  /** Fecha o portão no respawn/reset. */
  resetGate(): void {
    this.gateOpen = false;
    if (this.gateLeft) this.gateLeft.rotation.y = 0;
    if (this.gateRight) this.gateRight.rotation.y = 0;
  }

  gateBlocking(): boolean {
    return !this.gateOpen;
  }
}

function distToSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const t = THREE.MathUtils.clamp(((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz + 1e-6), 0, 1);
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

void dirtPathTexture;
void sandTexture;
void snowTexture;
