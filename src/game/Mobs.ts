import * as THREE from 'three';
import { attachToHand, LOOKS, makePerson, makePhone, makeSword, type Humanoid } from './Characters';
import { MOBS, type MobDef, type MobKind } from './Data';
import type { World } from './World';

export class Mob {
  readonly def: MobDef;
  readonly model: Humanoid;
  readonly group: THREE.Group;
  readonly pos = new THREE.Vector3();
  readonly knock = new THREE.Vector3();
  hp: number;
  maxHp: number;
  yaw = 0;
  state: 'idle' | 'wander' | 'chase' | 'return' = 'idle';
  attackCd = 0;
  rangedCd = 0;
  flash = 0;
  attackAnim = -1;
  dead = false;
  wanderDir = new THREE.Vector3();
  wanderT = 0;
  sayCd = 0;
  home = new THREE.Vector3();
  leash = 0;
  animT = Math.random() * 10;
  moving = 0;
  stunned = 0;
  weak = 0;
  private materials: THREE.MeshStandardMaterial[] = [];
  private origEmissive = new Map<THREE.MeshStandardMaterial, number>();

  constructor(kind: MobKind, x: number, y: number, z: number, hpMul = 1) {
    this.def = MOBS[kind];
    const look = kind === 'pedro' ? LOOKS.pedro : kind === 'elon' ? LOOKS.elon : kind === 'deyvin' ? LOOKS.deyvin : kind === 'helio' ? LOOKS.helio : LOOKS.boss;
    this.model = makePerson({ ...look, scale: this.def.scale });
    if (kind === 'pedro' || kind === 'helio') attachToHand(this.model, makeSword());
    if (kind === 'elon' || kind === 'boss') attachToHand(this.model, makePhone(kind === 'boss' ? 0xff3d7a : 0xffffff));
    this.group = this.model.group;
    this.pos.set(x, y, z);
    this.home.copy(this.pos);
    this.maxHp = Math.round(this.def.hp * hpMul);
    this.hp = this.maxHp;
    const clones = new Map<string, THREE.MeshStandardMaterial>();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
        let c = clones.get(o.material.uuid);
        if (!c) {
          c = o.material.clone();
          clones.set(o.material.uuid, c);
          this.materials.push(c);
          this.origEmissive.set(c, c.emissive.getHex());
        }
        o.material = c;
      }
    });
    this.syncTransform();
  }

  get isBoss(): boolean {
    return this.def.kind === 'boss' || this.def.kind === 'helio';
  }

  get center(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.model.height * 0.55, this.pos.z);
  }

  get radius(): number {
    return 0.45 * this.def.scale;
  }

  takeDamage(amount: number, from: THREE.Vector3 | null, knockPower = 6): void {
    const mul = this.weak > 0 ? 1.35 : 1;
    this.hp -= amount * mul;
    this.flash = 0.16;
    if (from) {
      const dir = this.pos.clone().sub(from);
      dir.y = 0;
      dir.normalize();
      const mass = this.def.kind === 'boss' ? 0.22 : this.def.kind === 'helio' ? 0.45 : 1;
      this.knock.add(dir.multiplyScalar(knockPower * mass));
    }
    if (this.hp <= 0) this.dead = true;
  }

  syncTransform(): void {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
  }

  faceTowards(target: THREE.Vector3, dt: number): void {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    if (Math.abs(dx) + Math.abs(dz) < 0.01) return;
    const want = Math.atan2(dx, dz);
    let diff = want - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += diff * Math.min(1, dt * 10);
  }

  tryMove(world: World, dx: number, dz: number): boolean {
    const nx = this.pos.x + dx;
    const nz = this.pos.z + dz;
    if (nx < 4 || nz < 4 || nx > world.sizeX - 4 || nz > world.sizeZ - 4) return false;
    const ground = world.heightAt(nx, nz);
    if (ground - this.pos.y > 1.1) return false;
    if (world.isWaterAt(nx, ground, nz) && world.heightAt(nx, nz) < world.waterLevel - 1.2) return false;
    if (world.blocked(nx, this.pos.y + 0.4, nz, 0.35, 1.4)) return false;
    this.pos.x = nx;
    this.pos.z = nz;
    return true;
  }

  updateVertical(world: World, dt: number): void {
    const ground = world.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y > ground + 0.02) this.pos.y = Math.max(ground, this.pos.y - 16 * dt);
    else this.pos.y = ground;
  }

  updateVisuals(dt: number): void {
    this.animT += dt;
    this.model.animate(this.animT, this.moving);
    if (this.attackAnim >= 0) {
      this.attackAnim += dt / 0.4;
      if (this.attackAnim >= 1) {
        this.attackAnim = -1;
        this.model.setAttack(-1);
      } else this.model.setAttack(this.attackAnim);
    }
    if (this.flash > 0) {
      this.flash -= dt;
      const on = this.flash > 0;
      for (const m of this.materials) m.emissive.setHex(on ? 0xff2222 : this.origEmissive.get(m) ?? 0);
    }
  }
}
