import * as THREE from 'three';
import { attachToHand, LOOKS, makeDumbbell, makePerson, makeSword, type Humanoid } from './Characters';
import type { HeroDef } from './Data';
import type { World } from './World';

const GRAVITY = 26;
const JUMP = 8.6;
const WALK = 5.2;

export class Player {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = 0;
  pitch = -0.18;
  onGround = false;
  inWater = false;
  readonly width = 0.45;
  readonly height = 1.78;
  readonly eye = 1.55;
  keys = new Set<string>();
  readonly model: Humanoid;
  private swingT = -1;
  private walkT = 0;
  speedMul = 1;
  dmgMul = 1;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private world: World,
    readonly hero: HeroDef,
  ) {
    this.model = makePerson(hero.id === 'matheus' ? LOOKS.matheus : LOOKS.nicolas);
    attachToHand(this.model, hero.weapon === 'dumbbell' ? makeDumbbell() : makeSword());
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
    this.yaw -= dx * 0.002;
    this.pitch -= dy * 0.002;
    this.pitch = Math.max(-1.15, Math.min(0.45, this.pitch));
  }

  swing(): boolean {
    if (this.swingT >= 0) return false;
    this.swingT = 0;
    return true;
  }

  get swinging(): boolean {
    return this.swingT >= 0;
  }

  update(dt: number): void {
    const fwd = this.forwardFlat;
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(fwd);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(fwd);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    let speed = WALK * this.hero.speed * this.speedMul * (sprint ? 1.5 : 1);
    this.inWater = this.world.isWaterAt(this.pos.x, this.pos.y + 0.4, this.pos.z);
    if (this.inWater) speed *= 0.55;

    const accel = this.onGround ? 16 : 6;
    this.vel.x += (wish.x * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z * speed - this.vel.z) * Math.min(1, accel * dt);

    if (this.inWater) {
      this.vel.y += (3.2 - this.vel.y) * Math.min(1, 4 * dt);
      if (this.keys.has('Space')) this.vel.y = 4.2;
    } else {
      this.vel.y -= GRAVITY * dt;
      if (this.keys.has('Space') && this.onGround) {
        this.vel.y = JUMP;
        this.onGround = false;
      }
    }
    this.vel.y = Math.max(this.vel.y, -36);

    this.moveXZ(this.vel.x * dt, this.vel.z * dt);
    this.moveY(this.vel.y * dt);

    this.pos.x = Math.max(4, Math.min(this.world.sizeX - 4, this.pos.x));
    this.pos.z = Math.max(4, Math.min(this.world.sizeZ - 4, this.pos.z));

    const horiz = Math.hypot(this.vel.x, this.vel.z);
    const walkAmt = Math.min(1, horiz / (WALK * 1.15));
    this.walkT += dt * (0.7 + walkAmt);
    if (this.swingT >= 0) {
      this.swingT += dt / 0.34;
      if (this.swingT >= 1) this.swingT = -1;
    }

    this.model.group.position.copy(this.pos);
    this.model.group.rotation.y = this.yaw + Math.PI;
    this.model.animate(this.walkT, walkAmt);
    this.model.setAttack(this.swingT);
    this.model.head.rotation.x = -this.pitch * 0.45;

    const eye = this.eyePos;
    const back = this.forward.clone().multiplyScalar(-3.8).add(new THREE.Vector3(0, 0.45, 0));
    let dist = back.length();
    const dir = back.normalize();
    for (let d = 0.4; d < dist; d += 0.18) {
      const p = eye.clone().addScaledVector(dir, d);
      if (this.world.isSolidAt(p.x, p.y, p.z) || p.y < this.world.heightAt(p.x, p.z) + 0.3) {
        dist = Math.max(1.3, d - 0.25);
        break;
      }
    }
    this.camera.position.copy(eye).addScaledVector(dir, dist);
    this.camera.lookAt(eye.x, eye.y - 0.05, eye.z);
  }

  private moveXZ(dx: number, dz: number): void {
    const nx = this.pos.x + dx;
    const nz = this.pos.z + dz;
    const ground = this.world.heightAt(nx, nz);
    const step = ground - this.pos.y;
    if (this.onGround && step > 0.95) return;
    if (this.world.blocked(nx, this.pos.y + 0.15, nz, this.width, this.height - 0.2)) {
      if (!this.world.blocked(this.pos.x + dx, this.pos.y + 0.15, this.pos.z, this.width, this.height - 0.2)) {
        this.pos.x += dx;
        this.vel.z = 0;
      } else if (!this.world.blocked(this.pos.x, this.pos.y + 0.15, this.pos.z + dz, this.width, this.height - 0.2)) {
        this.pos.z += dz;
        this.vel.x = 0;
      } else {
        this.vel.x = this.vel.z = 0;
      }
      return;
    }
    this.pos.x = nx;
    this.pos.z = nz;
  }

  private moveY(dy: number): void {
    const ground = this.world.heightAt(this.pos.x, this.pos.z);
    this.pos.y += dy;
    this.onGround = false;
    if (this.pos.y <= ground) {
      this.pos.y = ground;
      if (this.vel.y < 0) this.vel.y = 0;
      this.onGround = true;
    }
  }
}
