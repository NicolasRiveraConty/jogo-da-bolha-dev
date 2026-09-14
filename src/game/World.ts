import * as THREE from 'three';
import { makeRock, makeTree } from './Characters';
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
    flatten(this.spawn.x, this.spawn.z, 12, spawnH);
    this.spawn.y = spawnH;
    const towerH = Math.max(spawnH + 1, this.heightAt(this.tower.x, this.tower.z));
    flatten(this.tower.x, this.tower.z, 10, towerH);
    this.tower.y = towerH;
    const castleH = Math.max(towerH + 1.5, this.heightAt(this.castle.x, this.castle.z));
    flatten(this.castle.x, this.castle.z, 22, castleH);
    this.castle.y = castleH;

    this.carvePath(this.spawn.x, this.spawn.z, this.tower.x, this.tower.z);
    this.carvePath(this.tower.x, this.tower.z, this.castle.x - 18, this.castle.z);
    onProgress?.(0.4);

    this.buildTerrain();
    onProgress?.(0.55);
    this.buildWater();
    this.scatterNature();
    onProgress?.(0.7);
    this.buildCamp(spawnH);
    this.buildTower(towerH);
    this.buildCastle(castleH);
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
    const grass = new THREE.Color(0x4d8a38);
    const dirt = new THREE.Color(0x8a6a42);
    const sand = new THREE.Color(0xd2c08a);
    const rock = new THREE.Color(0x8a8680);
    const snow = new THREE.Color(0xeef4fa);
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
    const mat = pbrMat(grassSet, { roughness: 0.92, bump: 1.4 });
    mat.vertexColors = true;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(this.sizeX / 2, 0, this.sizeZ / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.group.add(mesh);
  }

  private nearPath(x: number, z: number): number {
    const d1 = distToSeg(x, z, this.spawn.x, this.spawn.z, this.tower.x, this.tower.z);
    const d2 = distToSeg(x, z, this.tower.x, this.tower.z, this.castle.x - 18, this.castle.z);
    const d = Math.min(d1, d2);
    return THREE.MathUtils.clamp(1 - (d - 1.2) / 2.2, 0, 1);
  }

  private buildWater() {
    const geo = new THREE.PlaneGeometry(this.sizeX + 20, this.sizeZ + 20, 32, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x1a5a88,
      roughness: 0.28,
      metalness: 0.02,
      transmission: 0.12,
      thickness: 0.8,
      transparent: true,
      opacity: 0.88,
      envMapIntensity: 0.35,
      normalMap: this.waterN1,
      normalScale: new THREE.Vector2(0.45, 0.45),
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
    return d(this.spawn) < r || d(this.tower) < r || d(this.castle) < r + 16;
  }

  private addBoxObs(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number) {
    this.obstacles.push({ kind: 'box', minX, maxX, minY, maxY, minZ, maxZ });
  }

  private buildCamp(level: number) {
    const { x, z } = this.spawn;
    const wood = pbrMat(woodTexture(), { roughness: 0.75 });
    const roof = pbrMat(roofTexture(), { roughness: 0.7 });
    const cabin = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 5.2), wood);
    floor.position.set(x - 8, level + 0.06, z - 1);
    floor.castShadow = floor.receiveShadow = true;
    cabin.add(floor);
    const wallH = 2.4;
    const walls = [
      [x - 8, level + wallH / 2, z - 3.5, 5.2, wallH, 0.18],
      [x - 8, level + wallH / 2, z + 1.5, 5.2, wallH, 0.18],
      [x - 10.5, level + wallH / 2, z - 1, 0.18, wallH, 5.2],
    ];
    for (const [wx, wy, wz, sx, sy, sz] of walls) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wood);
      w.position.set(wx, wy, wz);
      w.castShadow = w.receiveShadow = true;
      cabin.add(w);
    }
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.18, wallH, 1.7), wood);
    front.position.set(x - 5.5, level + wallH / 2, z - 2.4);
    front.castShadow = true;
    cabin.add(front);
    const front2 = front.clone();
    front2.position.z = z + 0.4;
    cabin.add(front2);
    const roofM = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.8, 4), roof);
    roofM.position.set(x - 8, level + wallH + 0.9, z - 1);
    roofM.rotation.y = Math.PI / 4;
    roofM.castShadow = true;
    cabin.add(roofM);
    this.group.add(cabin);
    this.addBoxObs(x - 10.7, x - 5.4, level, level + 4, z - 3.7, z + 1.7);

    this.addCampfire(x + 1.5, level, z - 4);

    this.npcSpots.banhos.set(x + 3.2, level, z - 1.5);
    this.npcSpots.almeida.set(x - 2.2, level, z + 3.2);
    this.npcSpots.anderson.set(x + 4.5, level, z + 3.5);
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
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    ring.add(light);
    this.fireLights.push(light);
    this.group.add(ring);
  }

  private buildTower(level: number) {
    const { x, z } = this.tower;
    const stone = pbrMat(stoneBrickTexture(), { roughness: 0.82, bump: 1.2 });
    const dark = pbrMat(cobbleTexture(), { roughness: 0.85 });
    const roof = pbrMat(roofTexture(), { roughness: 0.7 });
    const r = 3.4;
    const h = 11;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.25, h, 20, 1, true), stone);
    wall.position.set(x, level + h / 2, z);
    wall.castShadow = wall.receiveShadow = true;
    this.group.add(wall);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.05, r - 0.05, 0.2, 20), dark);
    floor.position.set(x, level + 0.1, z);
    floor.receiveShadow = true;
    this.group.add(floor);
    const top = new THREE.Mesh(new THREE.ConeGeometry(r + 0.5, 3.2, 20), roof);
    top.position.set(x, level + h + 1.5, z);
    top.castShadow = true;
    this.group.add(top);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.4), pbrMat(woodTexture(), { roughness: 0.7 }));
    door.position.set(x - r, level + 1.3, z);
    this.group.add(door);
    this.obstacles.push({ kind: 'cyl', x, z, r: r - 0.15, y0: level + 0.4, y1: level + h });
    this.addCampfire(x - r - 3.5, level, z);
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
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, wallH + 4, 14), stone);
      tw.position.set(tx, level + (wallH + 4) / 2, tz);
      tw.castShadow = true;
      this.group.add(tw);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.6, 12), pbrMat(roofTexture(), { roughness: 0.7 }));
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
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.4), gold);
    seat.position.set(throneX, level + 0.7, cz);
    this.group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.6, 2.4), gold);
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
