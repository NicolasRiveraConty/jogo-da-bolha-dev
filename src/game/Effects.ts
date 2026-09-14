import * as THREE from 'three';
import type { World } from './World';

function makePopcornKernel(): THREE.Group {
  const g = new THREE.Group();
  const palettes = [
    { color: 0xf6ead0, roughness: 0.94 },
    { color: 0xf0c14a, roughness: 0.78 },
    { color: 0x8a5a22, roughness: 0.96 },
  ];
  const n = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const pal = i === 0 ? palettes[0] : palettes[Math.random() < 0.28 ? 2 : 1];
    const mat = new THREE.MeshStandardMaterial({ color: pal.color, roughness: pal.roughness, metalness: 0.02 });
    const r = 0.055 + Math.random() * 0.05;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), mat);
    m.scale.set(0.65 + Math.random() * 0.75, 0.5 + Math.random() * 0.85, 0.65 + Math.random() * 0.7);
    m.position.set((Math.random() - 0.5) * 0.09, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.09);
    m.castShadow = true;
    g.add(m);
  }
  g.scale.setScalar(1.2 + Math.random() * 0.45);
  return g;
}

// ---------------------------------------------------------------- Partículas

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

const particleGeo = new THREE.SphereGeometry(1, 8, 6);
const particleMats = new Map<number, THREE.MeshStandardMaterial>();
function pmat(color: number): THREE.MeshStandardMaterial {
  let m = particleMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.4 });
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
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  damage: number;
  life: number;
  fromPlayer: boolean;
  color: number;
  gravity?: number;
  kind?: 'popcorn';
  light?: THREE.PointLight;
}

export class Projectiles {
  readonly group = new THREE.Group();
  readonly list: Projectile[] = [];

  constructor(private world: World) {}

  spawn(pos: THREE.Vector3, vel: THREE.Vector3, damage: number, color: number, size: number, fromPlayer = false): Projectile {
    const geo = new THREE.SphereGeometry(size, 10, 8);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.35 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.lookAt(pos.clone().add(vel));
    mesh.castShadow = true;
    this.group.add(mesh);
    const p: Projectile = { mesh, vel: vel.clone(), damage, life: 4, fromPlayer, color };
    this.list.push(p);
    return p;
  }

  spawnPopcorn(pos: THREE.Vector3, vel: THREE.Vector3, damage: number, gravity = 22): Projectile {
    const kernel = makePopcornKernel();
    kernel.position.copy(pos);
    kernel.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    this.group.add(kernel);
    const p: Projectile = { mesh: kernel, vel: vel.clone(), damage, life: 3.8, fromPlayer: false, color: 0xf2dc9a, gravity, kind: 'popcorn' };
    this.list.push(p);
    return p;
  }

  remove(p: Projectile): void {
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
    this.group.remove(p.mesh);
    p.mesh.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      const mat = o.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else (mat as THREE.Material).dispose();
    });
  }

  update(dt: number, onHitWorld: (p: Projectile) => void): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.gravity) p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * (p.kind === 'popcorn' ? 9 : 8);
      p.mesh.rotation.z += dt * (p.kind === 'popcorn' ? 6 : 8);
      if (p.life <= 0 || this.world.isSolidAt(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z)) {
        onHitWorld(p);
        this.remove(p);
      }
    }
  }
}

// ---------------------------------------------------------------- Texto flutuante

function wrapSpeech(text: string, max = 36): string[] {
  if (text.length <= max) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

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
    const lines = text.split('\n');
    let w = 32;
    for (const line of lines) w = Math.max(w, Math.ceil(ctx.measureText(line).width) + 24);
    const lineH = size + 8;
    canvas.width = Math.max(32, w);
    canvas.height = lineH * lines.length + 16;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeStyle = outline;
    ctx.fillStyle = color;
    lines.forEach((line, i) => {
      const y = 8 + lineH * i + lineH / 2;
      ctx.strokeText(line, canvas.width / 2, y);
      ctx.fillText(line, canvas.width / 2, y);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    const scale = (size / 60) * Math.min(1.35, 0.85 + lines.length * 0.18);
    sprite.scale.set((canvas.width / canvas.height) * scale, scale, 1);
    return sprite;
  }

  damage(pos: THREE.Vector3, amount: number, crit = false): void {
    const sprite = this.makeSprite(String(Math.round(amount)), crit ? '#ffd54f' : '#ffffff', crit ? 58 : 46);
    sprite.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.3, (Math.random() - 0.5) * 0.5));
    this.group.add(sprite);
    this.list.push({ sprite, vel: new THREE.Vector3((Math.random() - 0.5) * 1.4, 3.1, (Math.random() - 0.5) * 1.4), life: 1.05 });
  }

  heal(pos: THREE.Vector3, amount: number): void {
    const sprite = this.makeSprite(`+${Math.round(amount)}`, '#66bb6a', 42);
    sprite.position.copy(pos).add(new THREE.Vector3(0, 0.5, 0));
    this.group.add(sprite);
    this.list.push({ sprite, vel: new THREE.Vector3(0, 1.6, 0), life: 1.1 });
  }

  say(pos: THREE.Vector3, text: string, color = '#ffffff'): void {
    const wrapped = wrapSpeech(text, 36);
    const size = wrapped.length > 1 || text.length > 36 ? 24 : 30;
    const sprite = this.makeSprite(wrapped.join('\n'), color, size);
    sprite.position.copy(pos);
    this.group.add(sprite);
    this.list.push({ sprite, vel: new THREE.Vector3(0, 0.45, 0), life: Math.min(3.6, 2.1 + text.length * 0.018) });
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
