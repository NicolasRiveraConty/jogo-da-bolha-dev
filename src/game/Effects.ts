import * as THREE from 'three';
import type { World } from './World';

// ---------------------------------------------------------------- Partículas

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

const particleGeo = new THREE.BoxGeometry(1, 1, 1);
const particleMats = new Map<number, THREE.MeshBasicMaterial>();
function pmat(color: number): THREE.MeshBasicMaterial {
  let m = particleMats.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    particleMats.set(color, m);
  }
  return m;
}

export class Particles {
  readonly group = new THREE.Group();
  private list: Particle[] = [];

  constructor(private world: World) {}

  burst(pos: THREE.Vector3, color: number, count = 12, speed = 4, size = 0.14, life = 0.8, gravity = 14): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(particleGeo, pmat(color));
      const s = size * (0.6 + Math.random() * 0.8);
      mesh.scale.setScalar(s);
      mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4));
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.group.add(mesh);
      this.list.push({ mesh, vel, life: life * (0.7 + Math.random() * 0.6), maxLife: life, gravity });
    }
  }

  ring(pos: THREE.Vector3, color: number, radius: number, count = 24): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const mesh = new THREE.Mesh(particleGeo, pmat(color));
      mesh.scale.setScalar(0.22);
      mesh.position.copy(pos);
      const vel = new THREE.Vector3(Math.cos(a), 0.4, Math.sin(a)).multiplyScalar(radius * 1.8);
      this.group.add(mesh);
      this.list.push({ mesh, vel, life: 0.55, maxLife: 0.55, gravity: 6 });
    }
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.group.remove(p.mesh);
        this.list.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      const next = p.mesh.position.clone().addScaledVector(p.vel, dt);
      if (this.world.isSolidAt(next.x, next.y, next.z)) {
        p.vel.multiplyScalar(-0.3);
        p.vel.y = Math.abs(p.vel.y) * 0.3;
      } else {
        p.mesh.position.copy(next);
      }
      p.mesh.rotation.x += dt * 5;
      p.mesh.rotation.y += dt * 3;
      const k = Math.min(1, p.life / (p.maxLife * 0.4));
      p.mesh.scale.setScalar(Math.max(0.01, p.mesh.scale.x * (k < 1 ? 0.96 : 1)));
    }
  }
}

// ---------------------------------------------------------------- Projéteis

export interface Projectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  damage: number;
  life: number;
  fromPlayer: boolean;
  color: number;
  light?: THREE.PointLight;
}

export class Projectiles {
  readonly group = new THREE.Group();
  readonly list: Projectile[] = [];

  constructor(private world: World) {}

  spawn(pos: THREE.Vector3, vel: THREE.Vector3, damage: number, color: number, size: number, fromPlayer = false): Projectile {
    const geo = new THREE.BoxGeometry(size, size, size * 2.2);
    const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 1.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.lookAt(pos.clone().add(vel));
    mesh.castShadow = true;
    this.group.add(mesh);
    const p: Projectile = { mesh, vel: vel.clone(), damage, life: 4, fromPlayer, color };
    this.list.push(p);
    return p;
  }

  remove(p: Projectile): void {
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
    this.group.remove(p.mesh);
    p.mesh.geometry.dispose();
    (p.mesh.material as THREE.Material).dispose();
  }

  update(dt: number, onHitWorld: (p: Projectile) => void): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.z += dt * 8;
      if (p.life <= 0 || this.world.isSolidAt(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z)) {
        onHitWorld(p);
        this.remove(p);
      }
    }
  }
}

// ---------------------------------------------------------------- Texto flutuante

interface FloatText {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
}

export class FloatingText {
  readonly group = new THREE.Group();
  private list: FloatText[] = [];

  private makeSprite(text: string, color: string, size: number, outline = '#000'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const font = size > 40 ? `700 ${size}px 'Press Start 2P', monospace` : `800 ${size}px Rubik, sans-serif`;
    const ctx = canvas.getContext('2d')!;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 24;
    canvas.width = Math.max(32, w);
    canvas.height = size + 24;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeStyle = outline;
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    const scale = size / 60;
    sprite.scale.set((canvas.width / canvas.height) * scale, scale, 1);
    return sprite;
  }

  damage(pos: THREE.Vector3, amount: number, crit = false): void {
    const sprite = this.makeSprite(String(Math.round(amount)), crit ? '#ffd54f' : '#ffffff', crit ? 52 : 40);
    sprite.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.3, (Math.random() - 0.5) * 0.5));
    this.group.add(sprite);
    this.list.push({ sprite, vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, 2.4, (Math.random() - 0.5) * 1.2), life: 0.9 });
  }

  heal(pos: THREE.Vector3, amount: number): void {
    const sprite = this.makeSprite(`+${Math.round(amount)}`, '#66bb6a', 42);
    sprite.position.copy(pos).add(new THREE.Vector3(0, 0.5, 0));
    this.group.add(sprite);
    this.list.push({ sprite, vel: new THREE.Vector3(0, 1.6, 0), life: 1.1 });
  }

  say(pos: THREE.Vector3, text: string, color = '#ffffff'): void {
    const sprite = this.makeSprite(text, color, 30);
    sprite.position.copy(pos);
    this.group.add(sprite);
    this.list.push({ sprite, vel: new THREE.Vector3(0, 0.5, 0), life: 2.2 });
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.group.remove(f.sprite);
        (f.sprite.material as THREE.SpriteMaterial).map?.dispose();
        f.sprite.material.dispose();
        this.list.splice(i, 1);
        continue;
      }
      f.sprite.position.addScaledVector(f.vel, dt);
      f.vel.y -= dt * 1.5;
      (f.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, f.life / 0.35);
    }
  }
}
