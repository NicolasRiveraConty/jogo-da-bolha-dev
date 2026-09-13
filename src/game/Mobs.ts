import * as THREE from 'three';
import { MOBS, type MobDef, type MobKind } from './Data';
import { at, attachToHand, box, makeBug, makeHumanoid, makeMeeting, makePhone, makePopcornBucket, makeShield, makeSword, makeTablet, P, type Creature } from './Models';
import type { World } from './World';

export function buildMobModel(kind: MobKind): Creature {
  switch (kind) {
    case 'bug':
      return makeBug();
    case 'reuniao':
      return makeMeeting();
    case 'cliente': {
      const h = makeHumanoid({ skin: 0xe0b48a, hair: 0x3a2a1a, shirt: 0xd9c8a8, pants: 0x8a7a5a, shoes: 0x3a2a1a, sleeves: 0xd9c8a8, glasses: true, belt: 0x5a3a1a }, 0.95);
      const tablet = makeTablet();
      attachToHand(h, tablet, Math.PI / 2 - 0.3);
      // gravata
      h.body.add(at(box(1.6, 7, 0.6, 0xc62828, { variance: 0.03 }), 0, 7, 2.4));
      return { group: h.group, height: h.height, animate: h.animate, setAttack: h.setAttack };
    }
    case 'elio': {
      const h = makeHumanoid({ skin: 0xd9a066, hair: 0x2a1d14, shirt: 0x2c4c8a, pants: 0x4a3a2a, shoes: 0x2a1d14, sleeves: 0x2c4c8a, belt: 0xd9b53d, armor: true, beard: 0x2a1d14 }, 1);
      attachToHand(h, makeSword(0xd8dde3, 0.9));
      const shield = makeShield();
      shield.position.set(0, -6 * P, -2.5 * P);
      shield.rotation.y = Math.PI;
      h.armL.add(shield);
      // saco de moedas
      const bag = new THREE.Mesh(new THREE.BoxGeometry(4 * P, 4 * P, 3 * P), new THREE.MeshLambertMaterial({ color: 0xd9b53d, emissive: 0x332200, emissiveIntensity: 0.3 }));
      bag.position.set(4 * P, 2 * P, -3 * P);
      bag.castShadow = true;
      h.body.add(bag);
      return { group: h.group, height: h.height, animate: h.animate, setAttack: h.setAttack };
    }
    case 'boss': {
      const h = makeHumanoid(
        { skin: 0xd9a066, hair: 0x2a1d14, shirt: 0xb3202a, pants: 0x3a1a1a, shoes: 0x1a1010, sleeves: 0xb3202a, cape: 0x7a0f18, belt: 0x8a2be2, crown: true, big: true, eyeColor: 0xff2a2a, eyeGlow: 0xff0000 },
        1.9,
      );
      const bucket = makePopcornBucket();
      bucket.position.set(0, -13 * P, 3 * P);
      h.armL.add(bucket);
      const phone = makePhone(0xff3d7a);
      attachToHand(h, phone, Math.PI / 2 - 0.6);
      // Colar de "play"
      const badge = new THREE.Mesh(new THREE.BoxGeometry(4 * P, 4 * P, 1 * P), new THREE.MeshLambertMaterial({ color: 0xff3d5a, emissive: 0xff1040, emissiveIntensity: 1.2 }));
      badge.position.set(0, 9 * P, 4 * P);
      h.body.add(badge);
      return { group: h.group, height: h.height, animate: h.animate, setAttack: h.setAttack };
    }
  }
}

export type MobState = 'idle' | 'wander' | 'chase' | 'return';

export class Mob {
  readonly def: MobDef;
  readonly model: Creature;
  readonly group: THREE.Group;
  readonly pos = new THREE.Vector3();
  readonly knock = new THREE.Vector3();
  hp: number;
  maxHp: number;
  yaw = 0;
  state: MobState = 'idle';
  attackCd = 0;
  rangedCd = 0;
  flash = 0;
  attackAnim = -1;
  dead = false;
  wanderDir = new THREE.Vector3();
  wanderT = 0;
  sayCd = 0;
  home = new THREE.Vector3();
  leash = 0; // 0 = livre
  animT = Math.random() * 10;
  moving = 0;
  private materials: THREE.MeshLambertMaterial[] = [];

  constructor(kind: MobKind, x: number, y: number, z: number, hpMul = 1) {
    this.def = MOBS[kind];
    this.model = buildMobModel(kind);
    this.group = this.model.group;
    this.pos.set(x, y, z);
    this.home.set(x, y, z);
    this.maxHp = Math.round(this.def.hp * hpMul);
    this.hp = this.maxHp;
    // Clona materiais para o flash de dano não afetar outros mobs (materiais são compartilhados via cache)
    const clones = new Map<string, THREE.MeshLambertMaterial>();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) {
        let c = clones.get(o.material.uuid);
        if (!c) {
          c = o.material.clone();
          clones.set(o.material.uuid, c);
          this.materials.push(c);
        }
        o.material = c;
      }
    });
    this.captureEmissive();
    this.syncTransform();
  }

  get isBoss(): boolean {
    return this.def.kind === 'boss' || this.def.kind === 'elio';
  }

  get center(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + (this.model.height * 0.55) + (this.def.hover ?? 0), this.pos.z);
  }

  get radius(): number {
    return 0.5 * this.def.scale + (this.def.kind === 'reuniao' ? 0.4 : 0);
  }

  takeDamage(amount: number, from: THREE.Vector3 | null, knockPower = 6): void {
    this.hp -= amount;
    this.flash = 0.18;
    if (from) {
      const dir = this.pos.clone().sub(from);
      dir.y = 0;
      dir.normalize();
      const mass = this.def.kind === 'boss' ? 0.25 : this.def.kind === 'elio' ? 0.5 : 1;
      this.knock.add(dir.multiplyScalar(knockPower * mass));
    }
    if (this.hp <= 0) this.dead = true;
  }

  syncTransform(): void {
    this.group.position.set(this.pos.x, this.pos.y + (this.def.hover ?? 0), this.pos.z);
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

  /** Move no plano respeitando o terreno (não sobe mais que 1 bloco). */
  tryMove(world: World, dx: number, dz: number, flying: boolean): boolean {
    const nx = this.pos.x + dx;
    const nz = this.pos.z + dz;
    if (nx < 2 || nz < 2 || nx > world.sizeX - 2 || nz > world.sizeZ - 2) return false;
    const ground = world.surfaceY(nx, nz);
    if (!flying && ground - this.pos.y > 1.25) return false;
    if (world.isWaterAt(nx, ground - 0.5, nz) && !flying) {
      // não entra em água funda
      if (world.isWaterAt(nx, ground - 1.5, nz)) return false;
    }
    // cabeça não pode bater em bloco
    if (world.isSolidAt(nx, this.pos.y + 1.2 + (this.def.hover ?? 0), nz)) return false;
    this.pos.x = nx;
    this.pos.z = nz;
    return true;
  }

  updateVertical(world: World, dt: number): void {
    const ground = world.surfaceY(this.pos.x, this.pos.z);
    const flying = !!this.def.hover;
    if (flying) {
      this.pos.y += (ground - this.pos.y) * Math.min(1, dt * 4);
    } else if (this.pos.y > ground + 0.01) {
      this.pos.y = Math.max(ground, this.pos.y - 18 * dt);
    } else {
      this.pos.y = ground;
    }
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
      for (const m of this.materials) {
        m.emissive.setHex(on ? 0xff2222 : 0x000000);
      }
      if (!on) this.restoreEmissive();
    }
    if (this.def.hover) this.group.position.y = this.pos.y + this.def.hover + Math.sin(this.animT * 2.5) * 0.15;
  }

  private originalEmissive: Map<THREE.MeshLambertMaterial, number> | null = null;
  private restoreEmissive(): void {
    if (!this.originalEmissive) return;
    for (const [m, e] of this.originalEmissive) m.emissive.setHex(e);
  }
  captureEmissive(): void {
    this.originalEmissive = new Map();
    for (const m of this.materials) this.originalEmissive.set(m, m.emissive.getHex());
  }
}
