import * as THREE from 'three';
import type { HeroDef } from './Data';
import { attachToHand, makeDumbbell, makeHumanoid, makeSword, P, type Humanoid } from './Models';
import type { World } from './World';

const GRAVITY = 28;
const JUMP = 9.2;
const WALK = 4.6;

export class Player {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  inWater = false;

  readonly width = 0.6;
  readonly height = 1.8;
  readonly eye = 1.62;

  keys = new Set<string>();
  thirdPerson = false;

  readonly model: Humanoid;
  readonly viewModel = new THREE.Group();
  private viewArm: THREE.Group;
  private swingT = -1;
  private walkT = 0;
  private bobT = 0;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private world: World,
    readonly hero: HeroDef,
  ) {
    this.model = makeHumanoid(hero.palette, 0.9);
    this.model.group.visible = false;
    attachToHand(this.model, this.makeWeapon());

    // Braço + arma em primeira pessoa
    // O braço "sai" do canto inferior direito apontando para frente; a arma fica na mão, lâmina para cima.
    this.viewArm = new THREE.Group();
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.BoxGeometry(4 * P, 10 * P, 4 * P), (this.model.armR.children[0] as THREE.Mesh).material);
    upper.position.set(0, -5 * P, 0);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(4.2 * P, 4 * P, 4.2 * P), (this.model.armR.children[1] as THREE.Mesh).material);
    hand.position.set(0, -12 * P, 0);
    arm.add(upper, hand);
    const weapon = this.makeWeapon();
    weapon.position.set(0, -12 * P, 0);
    weapon.rotation.x = -1.25 - 0.45;
    arm.add(weapon);
    arm.rotation.x = 1.25;
    arm.scale.setScalar(0.72);
    this.viewArm.add(arm);
    this.viewArm.position.set(0.4, -0.36, -0.6);
    this.viewArm.rotation.set(0, -0.35, 0.12);
    this.viewModel.add(this.viewArm);
    this.viewModel.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    camera.add(this.viewModel);
  }

  private makeWeapon(): THREE.Group {
    switch (this.hero.weapon) {
      case 'bigsword':
        return makeSword(0xf2e2a0, 1.35);
      case 'dumbbell':
        return makeDumbbell();
      default:
        return makeSword();
    }
  }

  get eyePos(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eye, this.pos.z);
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize();
  }

  get forwardFlat(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  teleport(x: number, y: number, z: number): void {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx * 0.0022;
    this.pitch -= dy * 0.0022;
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
  }

  /** Tenta iniciar o golpe. Retorna true se iniciou. */
  swing(): boolean {
    if (this.swingT >= 0) return false;
    this.swingT = 0;
    return true;
  }

  get swinging(): boolean {
    return this.swingT >= 0;
  }

  update(dt: number, moveSpeedMul: number): void {
    // Direção de movimento
    const fwd = this.forwardFlat;
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(fwd);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(fwd);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
    const moving = wish.lengthSq() > 0;
    if (moving) wish.normalize();

    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    let speed = WALK * this.hero.speed * moveSpeedMul * (sprint ? 1.55 : 1);

    this.inWater = this.world.isWaterAt(this.pos.x, this.pos.y + 0.4, this.pos.z);
    if (this.inWater) speed *= 0.55;

    // Aceleração horizontal
    const accel = this.onGround ? 14 : 5;
    const targetX = wish.x * speed;
    const targetZ = wish.z * speed;
    this.vel.x += (targetX - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (targetZ - this.vel.z) * Math.min(1, accel * dt);

    // Gravidade / pulo / nado
    if (this.inWater) {
      this.vel.y += (-3 - this.vel.y) * Math.min(1, 4 * dt);
      if (this.keys.has('Space')) this.vel.y = 4;
    } else {
      this.vel.y -= GRAVITY * dt;
      if (this.keys.has('Space') && this.onGround) {
        this.vel.y = JUMP;
        this.onGround = false;
      }
    }
    this.vel.y = Math.max(this.vel.y, -40);

    // Movimento com colisão por eixo
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.onGround = false;
    this.moveAxis('y', this.vel.y * dt);

    // Limites do mundo
    this.pos.x = Math.max(1, Math.min(this.world.sizeX - 1, this.pos.x));
    this.pos.z = Math.max(1, Math.min(this.world.sizeZ - 1, this.pos.z));
    if (this.pos.y < -10) this.pos.y = this.world.surfaceY(this.pos.x, this.pos.z) + 1;

    // Animações
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    const walkAmt = Math.min(1, horizSpeed / (WALK * 1.2));
    this.walkT += dt * (0.6 + walkAmt);
    this.bobT += dt * horizSpeed * 1.6;
    if (this.swingT >= 0) {
      this.swingT += dt / 0.32;
      if (this.swingT >= 1) this.swingT = -1;
    }

    // Câmera
    if (this.thirdPerson) {
      const back = this.forward.clone().multiplyScalar(-4.2);
      const target = this.eyePos.add(back).add(new THREE.Vector3(0, 0.5, 0));
      // Não atravessar blocos: aproxima se colidir
      const eye = this.eyePos;
      const dir = target.clone().sub(eye);
      const len = dir.length();
      dir.normalize();
      let dist = len;
      for (let d = 0.3; d < len; d += 0.2) {
        const p = eye.clone().add(dir.clone().multiplyScalar(d));
        if (this.world.isSolidAt(p.x, p.y, p.z)) {
          dist = Math.max(0.3, d - 0.35);
          break;
        }
      }
      this.camera.position.copy(eye.add(dir.multiplyScalar(dist)));
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.model.group.visible = dist > 1.2;
      this.viewModel.visible = false;
      this.model.group.position.copy(this.pos);
      this.model.group.rotation.y = this.yaw + Math.PI;
      this.model.animate(this.walkT, walkAmt);
      this.model.setAttack(this.swingT);
      this.model.head.rotation.x = -this.pitch * 0.6;
    } else {
      this.camera.position.set(this.pos.x, this.pos.y + this.eye + Math.sin(this.bobT) * 0.035 * walkAmt, this.pos.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.model.group.visible = false;
      this.viewModel.visible = true;
      // bob da arma
      const bobX = Math.sin(this.bobT) * 0.02 * walkAmt;
      const bobY = Math.abs(Math.cos(this.bobT)) * 0.02 * walkAmt;
      this.viewArm.position.set(0.4 + bobX, -0.36 - bobY, -0.6);
      if (this.swingT >= 0) {
        const t = this.swingT;
        // sobe rápido, desce em arco para o centro da tela
        const s = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
        const chop = t < 0.3 ? 0 : Math.sin(((t - 0.3) / 0.7) * Math.PI);
        this.viewArm.rotation.set(-s * 0.9 + chop * 0.6, -0.35 - chop * 0.9, 0.12 + s * 0.4);
        this.viewArm.position.x -= chop * 0.22;
        this.viewArm.position.y += s * 0.08 - chop * 0.12;
      } else {
        this.viewArm.rotation.set(0, -0.35, 0.12);
      }
    }
  }

  private moveAxis(axis: 'x' | 'y' | 'z', delta: number): void {
    if (delta === 0) return;
    this.pos[axis] += delta;
    if (this.collides()) {
      // volta em passos pequenos até desencaixar
      const step = Math.sign(delta) * 0.02;
      let guard = 0;
      while (this.collides() && guard++ < 80) this.pos[axis] -= step;
      if (axis === 'y') {
        if (delta < 0) this.onGround = true;
        this.vel.y = 0;
      } else {
        this.vel[axis] = 0;
      }
    }
  }

  private collides(): boolean {
    const hw = this.width / 2;
    const minX = Math.floor(this.pos.x - hw);
    const maxX = Math.floor(this.pos.x + hw - 0.001);
    const minY = Math.floor(this.pos.y);
    const maxY = Math.floor(this.pos.y + this.height - 0.001);
    const minZ = Math.floor(this.pos.z - hw);
    const maxZ = Math.floor(this.pos.z + hw - 0.001);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.isSolidAt(x, y, z)) return true;
        }
      }
    }
    return false;
  }
}
