import * as THREE from 'three';
import { makeTree } from './Characters';
import {
  cobbleTexture,
  colorMat,
  pbrMat,
  plasterTexture,
  roofTexture,
  stoneBrickTexture,
  woodTexture,
} from './Textures';

/**
 * Design system da vila (referência: vilarejo isométrico).
 * Paleta: reboco creme, viga escura, base de pedra, telha terracota, flores.
 * Gramática: casa = plinto + corpo + enxaimel + duas águas + chaminé + porta + floreiras.
 * Urbano: praça circular, árvore no centro, casas viradas para dentro, postes de pedra.
 */
export const VILLAGE = {
  plaster: 0xf2ead6,
  timber: 0x3c2a1c,
  stone: 0x9a958c,
  door: 0x5a3a28,
  flower: [0xc62828, 0xf4d03f, 0xfafafa, 0xec407a, 0x43a047, 0xfb8c00] as const,
};

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function mats() {
  return {
    plaster: pbrMat(plasterTexture(), { color: VILLAGE.plaster, roughness: 0.9, bump: 0.7 }),
    timber: pbrMat(woodTexture(), { color: VILLAGE.timber, roughness: 0.82 }),
    wood: pbrMat(woodTexture(), { roughness: 0.75 }),
    roof: pbrMat(roofTexture(), { roughness: 0.72, bump: 1.1 }),
    stone: pbrMat(stoneBrickTexture(), { roughness: 0.88, bump: 1.15 }),
    cobble: pbrMat(cobbleTexture(), { roughness: 0.86, bump: 1.2 }),
  };
}

export interface CottageSpec {
  x: number;
  y: number;
  z: number;
  yaw: number;
  w?: number;
  d?: number;
  h?: number;
  stories?: 1 | 2;
}

function addFlowers(parent: THREE.Object3D, x: number, y: number, z: number, n = 7, spread = 0.28): void {
  for (let i = 0; i < n; i++) {
    const col = VILLAGE.flower[i % VILLAGE.flower.length];
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.045 + (i % 3) * 0.012, 6, 5), colorMat(col, { roughness: 0.7 }));
    bloom.position.set(x + Math.sin(i * 1.7) * spread, y + 0.04, z + Math.cos(i * 1.3) * spread);
    bloom.castShadow = true;
    parent.add(bloom);
  }
}

function addFlowerBox(g: THREE.Group, x: number, y: number, z: number, w: number, mat: THREE.Material): void {
  const tray = box(w, 0.08, 0.16, mat);
  tray.position.set(x, y, z);
  g.add(tray);
  addFlowers(g, x, y + 0.06, z, 6, w * 0.28);
}

function addTimberFrame(g: THREE.Group, w: number, d: number, h: number, timber: THREE.Material): void {
  const t = 0.11;
  const inset = 0.02;
  const xs = [-(w / 2 - t / 2), w / 2 - t / 2];
  const zs = [-(d / 2 - t / 2), d / 2 - t / 2];
  for (const px of xs) {
    for (const pz of zs) {
      const post = box(t, h, t, timber);
      post.position.set(px, h / 2, pz);
      g.add(post);
    }
  }
  for (const py of [h * 0.38, h - t / 2]) {
    for (const pz of zs) {
      const beam = box(w - t, t, t, timber);
      beam.position.set(0, py, pz);
      g.add(beam);
    }
    for (const px of xs) {
      const beam = box(t, t, d - t, timber);
      beam.position.set(px, py, 0);
      g.add(beam);
    }
  }
  const midZ = box(t, h * 0.72, t, timber);
  midZ.position.set(0, h * 0.48, d / 2 - t / 2 - inset);
  g.add(midZ);
}

function addGableRoof(g: THREE.Group, w: number, d: number, bodyH: number, roofMat: THREE.Material, plaster: THREE.Material, timber: THREE.Material): void {
  const over = 0.3;
  const rise = 1.28;
  const hd = d / 2 + over;
  const len = Math.hypot(hd, rise);
  const angle = Math.atan2(rise, hd);
  for (const side of [-1, 1]) {
    const slab = box(w + over * 2, 0.1, len, roofMat);
    slab.rotation.x = -side * angle;
    slab.position.set(0, bodyH + rise * 0.48, side * (hd * 0.48));
    g.add(slab);
  }
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0);
  shape.lineTo(d / 2, 0);
  shape.lineTo(0, rise);
  const geo = new THREE.ShapeGeometry(shape);
  for (const side of [-1, 1]) {
    const face = new THREE.Mesh(geo, plaster);
    face.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    face.position.set(side * (w / 2 + 0.01), bodyH, 0);
    face.castShadow = true;
    g.add(face);
    const ridge = box(0.08, rise, 0.08, timber);
    ridge.position.set(side * (w / 2), bodyH + rise * 0.45, 0);
    g.add(ridge);
  }
  const chimney = box(0.32, 0.85, 0.32, plaster);
  chimney.position.set(w * 0.22, bodyH + rise * 0.55, -d * 0.12);
  g.add(chimney);
  const cap = box(0.4, 0.08, 0.4, timber);
  cap.position.set(w * 0.22, bodyH + rise * 0.55 + 0.46, -d * 0.12);
  g.add(cap);
}

export function makeCottage(spec: CottageSpec): THREE.Group {
  const m = mats();
  const w = spec.w ?? 4.1;
  const d = spec.d ?? 3.35;
  const stories = spec.stories ?? 1;
  const h = spec.h ?? (stories === 2 ? 3.35 : 2.35);
  const g = new THREE.Group();
  g.position.set(spec.x, spec.y, spec.z);
  g.rotation.y = spec.yaw;

  const plinth = box(w + 0.22, 0.38, d + 0.22, m.stone);
  plinth.position.y = 0.19;
  g.add(plinth);

  const body = box(w, h, d, m.plaster);
  body.position.y = 0.38 + h / 2;
  g.add(body);

  const frame = new THREE.Group();
  frame.position.y = 0.38;
  addTimberFrame(frame, w, d, h, m.timber);
  g.add(frame);

  addGableRoof(g, w, d, 0.38 + h, m.roof, m.plaster, m.timber);

  const door = box(0.72, 1.35, 0.08, m.wood);
  door.position.set(0, 0.38 + 0.68, d / 2 + 0.04);
  g.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), colorMat(0xd4b24a, { metalness: 0.7, roughness: 0.3 }));
  knob.position.set(0.24, 0.38 + 0.62, d / 2 + 0.1);
  g.add(knob);

  const winY = 0.38 + h * 0.62;
  for (const wx of [-w * 0.28, w * 0.28]) {
    const pane = box(0.55, 0.48, 0.05, colorMat(0x8ecae6, { roughness: 0.2, metalness: 0.15, emissive: 0x335566, emissiveIntensity: 0.12 }));
    pane.position.set(wx, winY, d / 2 + 0.03);
    g.add(pane);
    const trim = box(0.64, 0.08, 0.08, m.timber);
    trim.position.set(wx, winY - 0.28, d / 2 + 0.05);
    g.add(trim);
    addFlowerBox(g, wx, winY - 0.34, d / 2 + 0.16, 0.62, m.wood);
  }

  addFlowers(g, -w * 0.35, 0.42, d / 2 + 0.35, 8, 0.22);
  addFlowers(g, w * 0.32, 0.42, d / 2 + 0.32, 7, 0.2);

  return g;
}

export function makePlaza(x: number, y: number, z: number, radius = 5.4): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.15, 0.1, 32), m.cobble);
  floor.position.set(x, y + 0.05, z);
  floor.receiveShadow = true;
  g.add(floor);

  const garden = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.2, 0.16, 20), colorMat(0x3d8a32, { roughness: 0.92 }));
  garden.position.set(x, y + 0.12, z);
  garden.receiveShadow = true;
  g.add(garden);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.12, 8, 24), m.stone);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y + 0.2, z);
  g.add(ring);

  const tree = makeTree(11);
  tree.position.set(x, y + 0.18, z);
  tree.scale.setScalar(1.15);
  g.add(tree);
  addFlowers(g, x, y + 0.22, z + 0.9, 10, 0.7);
  addFlowers(g, x + 0.8, y + 0.22, z - 0.5, 8, 0.55);
  addFlowers(g, x - 0.7, y + 0.22, z - 0.4, 8, 0.5);

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.2;
    if (i % 5 === 0) continue;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.72, 8), m.stone);
    post.position.set(x + Math.cos(a) * (radius - 0.35), y + 0.42, z + Math.sin(a) * (radius - 0.35));
    post.castShadow = true;
    g.add(post);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.28), m.stone);
    cap.position.copy(post.position);
    cap.position.y += 0.4;
    g.add(cap);
  }
  return g;
}

export function cottageFootprint(spec: CottageSpec): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const w = spec.w ?? 4.1;
  const d = spec.d ?? 3.35;
  const c = Math.abs(Math.cos(spec.yaw));
  const s = Math.abs(Math.sin(spec.yaw));
  const hw = (w * c + d * s) / 2 + 0.25;
  const hd = (w * s + d * c) / 2 + 0.25;
  return { minX: spec.x - hw, maxX: spec.x + hw, minZ: spec.z - hd, maxZ: spec.z + hd };
}
