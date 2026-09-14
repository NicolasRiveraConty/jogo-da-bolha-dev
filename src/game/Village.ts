import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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
 * Design system da vila: reboco creme, viga escura, base de pedra, telha terracota.
 * Casas com recuos, vidro, calhas e telha terracota — sem corpos de cubo nu.
 */
export const VILLAGE = {
  plaster: 0xe8dcc4,
  timber: 0x3a281c,
  stone: 0x8f8a82,
  door: 0x5c3a26,
  zinc: 0x6e746c,
  flower: [0xa33a32, 0xd4b45a, 0xf2efe8, 0xc45a72, 0x4a7a3a, 0xc47832] as const,
};

function rbox(w: number, h: number, d: number, mat: THREE.Material, radius = 0.045, segs = 2): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segs, Math.min(radius, Math.min(w, h, d) * 0.22)), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function glassMat(): THREE.MeshPhysicalMaterial {
  const m = colorMat(0x6a7c88, {
    roughness: 0.12,
    metalness: 0.08,
    env: 1.35,
    clearcoat: 0.65,
    emissive: 0x1c140c,
    emissiveIntensity: 0.18,
  });
  m.transparent = true;
  m.opacity = 0.55;
  return m;
}

function mats() {
  return {
    plaster: pbrMat(plasterTexture(), { color: VILLAGE.plaster, roughness: 0.86, bump: 0.85, env: 0.95 }),
    timber: pbrMat(woodTexture(), { color: VILLAGE.timber, roughness: 0.78, bump: 0.9 }),
    wood: pbrMat(woodTexture(), { roughness: 0.72, bump: 0.8 }),
    roof: pbrMat(roofTexture(), { roughness: 0.62, bump: 1.45, env: 0.9 }),
    stone: pbrMat(stoneBrickTexture(), { roughness: 0.9, bump: 1.25, env: 0.85 }),
    cobble: pbrMat(cobbleTexture(), { roughness: 0.88, bump: 1.3, env: 0.8 }),
    zinc: colorMat(0x5a5e58, { roughness: 0.42, metalness: 0.68, env: 1.2 }),
    glass: glassMat(),
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
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.07, 5), colorMat(0x3a5c2a, { roughness: 0.9 }));
    stem.position.set(x + Math.sin(i * 1.7) * spread, y + 0.04, z + Math.cos(i * 1.3) * spread);
    parent.add(stem);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.028 + (i % 3) * 0.008, 10, 8), colorMat(col, { roughness: 0.55, sheen: 0.35 }));
    bloom.position.copy(stem.position);
    bloom.position.y += 0.05;
    bloom.scale.set(1, 0.55, 1);
    bloom.castShadow = true;
    parent.add(bloom);
  }
}

function addFlowerBox(g: THREE.Group, x: number, y: number, z: number, w: number, mat: THREE.Material): void {
  const tray = rbox(w, 0.09, 0.18, mat, 0.02);
  tray.position.set(x, y, z);
  g.add(tray);
  const soil = rbox(w * 0.88, 0.04, 0.12, colorMat(0x3a2a1c, { roughness: 0.95 }), 0.01);
  soil.position.set(x, y + 0.05, z);
  g.add(soil);
  addFlowers(g, x, y + 0.06, z, 6, w * 0.28);
}

function addTimberFrame(g: THREE.Group, w: number, d: number, h: number, timber: THREE.Material): void {
  const t = 0.1;
  const xs = [-(w / 2 - t / 2), w / 2 - t / 2];
  const zs = [-(d / 2 - t / 2), d / 2 - t / 2];
  for (const px of xs) {
    for (const pz of zs) {
      const post = rbox(t, h, t, timber, 0.018);
      post.position.set(px, h / 2, pz);
      g.add(post);
    }
  }
  for (const py of [h * 0.38, h - t / 2]) {
    for (const pz of zs) {
      const beam = rbox(w - t, t, t, timber, 0.016);
      beam.position.set(0, py, pz);
      g.add(beam);
    }
    for (const px of xs) {
      const beam = rbox(t, t, d - t, timber, 0.016);
      beam.position.set(px, py, 0);
      g.add(beam);
    }
  }
  const brace = rbox(t * 0.85, h * 0.42, t * 0.85, timber, 0.012);
  brace.position.set(0, h * 0.52, d / 2 - t / 2 - 0.01);
  brace.rotation.z = 0.55;
  g.add(brace);
}

function addWindow(
  g: THREE.Group,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  m: ReturnType<typeof mats>,
  withBox = true,
): void {
  const reveal = rbox(w + 0.1, h + 0.12, 0.1, m.timber, 0.02);
  reveal.position.set(x, y, z);
  g.add(reveal);
  const interior = colorMat(0x2a1c14, { roughness: 1, emissive: 0x24160e, emissiveIntensity: 0.22 });
  const room = rbox(w * 0.92, h * 0.92, 0.04, interior, 0.01);
  room.position.set(x, y, z - 0.02);
  g.add(room);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m.glass);
  pane.position.set(x, y, z + 0.04);
  g.add(pane);
  const mull = rbox(0.028, h, 0.035, m.timber, 0.006);
  mull.position.set(x, y, z + 0.045);
  g.add(mull);
  const transom = rbox(w, 0.028, 0.035, m.timber, 0.006);
  transom.position.set(x, y + h * 0.08, z + 0.045);
  g.add(transom);
  const sill = rbox(w + 0.18, 0.055, 0.16, m.stone, 0.018);
  sill.position.set(x, y - h / 2 - 0.04, z + 0.05);
  g.add(sill);
  const lintel = rbox(w + 0.2, 0.07, 0.12, m.timber, 0.016);
  lintel.position.set(x, y + h / 2 + 0.05, z + 0.02);
  g.add(lintel);
  if (withBox) addFlowerBox(g, x, y - h / 2 - 0.12, z + 0.16, w + 0.12, m.wood);
}

function addDoor(g: THREE.Group, x: number, y: number, z: number, m: ReturnType<typeof mats>): void {
  const frame = rbox(0.96, 1.58, 0.12, m.timber, 0.025);
  frame.position.set(x, y, z);
  g.add(frame);
  const leaf = rbox(0.78, 1.42, 0.055, m.wood, 0.02);
  leaf.position.set(x, y - 0.02, z + 0.04);
  g.add(leaf);
  const panelMat = pbrMat(woodTexture(), { color: 0x4a3020, roughness: 0.7, bump: 0.7 });
  for (const [px, py] of [
    [-0.16, 0.28],
    [0.16, 0.28],
    [-0.16, -0.28],
    [0.16, -0.28],
  ] as const) {
    const panel = rbox(0.26, 0.42, 0.02, panelMat, 0.012);
    panel.position.set(x + px, y + py - 0.02, z + 0.07);
    g.add(panel);
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), colorMat(0xc4a056, { metalness: 0.86, roughness: 0.22, env: 1.5 }));
  knob.position.set(x + 0.28, y - 0.06, z + 0.1);
  knob.castShadow = true;
  g.add(knob);
  const plate = rbox(0.05, 0.12, 0.012, colorMat(0xb89648, { metalness: 0.8, roughness: 0.28 }), 0.006);
  plate.position.set(x + 0.28, y - 0.06, z + 0.075);
  g.add(plate);
  const step = rbox(1.05, 0.1, 0.38, m.stone, 0.03);
  step.position.set(x, y - 0.78, z + 0.18);
  g.add(step);
}

function addGableRoof(g: THREE.Group, w: number, d: number, bodyH: number, m: ReturnType<typeof mats>): void {
  const over = 0.48;
  const rise = 1.42;
  const hd = d / 2 + over;
  const len = Math.hypot(hd, rise);
  const angle = Math.atan2(rise, hd);
  for (const side of [-1, 1] as const) {
    const slab = rbox(w + over * 2, 0.11, len + 0.08, m.roof, 0.02);
    slab.rotation.x = -side * angle;
    slab.position.set(0, bodyH + rise * 0.48 + 0.02, side * (hd * 0.48));
    g.add(slab);
  }
  const ridge = rbox(w + over * 2 + 0.06, 0.08, 0.14, m.roof, 0.02);
  ridge.position.set(0, bodyH + rise + 0.02, 0);
  g.add(ridge);

  const fascia = rbox(w + over * 2 + 0.08, 0.08, 0.06, m.timber, 0.012);
  for (const side of [-1, 1] as const) {
    const f = fascia.clone();
    f.position.set(0, bodyH + 0.04, side * (d / 2 + over * 0.92));
    g.add(f);
    const gutter = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, w + over * 1.5, 10), m.zinc);
    gutter.rotation.z = Math.PI / 2;
    gutter.position.set(0, bodyH - 0.01, side * (d / 2 + over * 0.96));
    gutter.castShadow = true;
    g.add(gutter);
  }
  for (const sx of [-1, 1] as const) {
    const down = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, bodyH - 0.2, 8), m.zinc);
    down.position.set(sx * (w / 2 + 0.06), bodyH * 0.52, d / 2 + over * 0.94);
    down.castShadow = true;
    g.add(down);
  }

  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0);
  shape.lineTo(d / 2, 0);
  shape.lineTo(0, rise);
  const geoFace = new THREE.ShapeGeometry(shape);
  for (const side of [-1, 1] as const) {
    const face = new THREE.Mesh(geoFace, m.plaster);
    face.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    face.position.set(side * (w / 2 + 0.012), bodyH, 0);
    face.castShadow = face.receiveShadow = true;
    g.add(face);
    const barge = rbox(0.07, rise + 0.08, 0.07, m.timber, 0.012);
    barge.position.set(side * (w / 2 + 0.02), bodyH + rise * 0.48, 0);
    g.add(barge);
  }

  const chimney = rbox(0.38, 1.05, 0.38, m.stone, 0.04);
  chimney.position.set(w * 0.22, bodyH + rise * 0.42, -d * 0.14);
  g.add(chimney);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.22, 10), m.stone);
  pot.position.set(w * 0.22, bodyH + rise * 0.42 + 0.6, -d * 0.14);
  pot.castShadow = true;
  g.add(pot);
  const cap = rbox(0.46, 0.06, 0.46, m.zinc, 0.02);
  cap.position.set(w * 0.22, bodyH + rise * 0.42 + 0.74, -d * 0.14);
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

  const plinth = rbox(w + 0.28, 0.42, d + 0.28, m.stone, 0.06);
  plinth.position.y = 0.2;
  g.add(plinth);
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const quoin = rbox(0.18, 0.42, 0.18, m.stone, 0.03);
    quoin.position.set(sx * (w / 2 + 0.08), 0.2, sz * (d / 2 + 0.08));
    g.add(quoin);
  }

  const body = rbox(w, h, d, m.plaster, 0.055, 3);
  body.position.y = 0.42 + h / 2;
  g.add(body);

  const frame = new THREE.Group();
  frame.position.y = 0.42;
  addTimberFrame(frame, w, d, h, m.timber);
  g.add(frame);

  addGableRoof(g, w, d, 0.42 + h, m);

  addDoor(g, 0, 0.42 + 0.78, d / 2 + 0.02, m);

  const winY = 0.42 + h * (stories === 2 ? 0.38 : 0.62);
  const upperY = stories === 2 ? 0.42 + h * 0.78 : winY;
  for (const wx of [-w * 0.28, w * 0.28]) {
    addWindow(g, wx, winY, d / 2 + 0.02, 0.52, 0.58, m, true);
    if (stories === 2) addWindow(g, wx, upperY, d / 2 + 0.02, 0.46, 0.48, m, false);
  }

  addFlowers(g, -w * 0.35, 0.46, d / 2 + 0.42, 8, 0.22);
  addFlowers(g, w * 0.32, 0.46, d / 2 + 0.38, 7, 0.2);

  return g;
}

export function makePlaza(x: number, y: number, z: number, radius = 5.4): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.18, 0.12, 48), m.cobble);
  floor.position.set(x, y + 0.05, z);
  floor.receiveShadow = true;
  g.add(floor);

  const garden = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.12, 0.14, 28), colorMat(0x2f5c28, { roughness: 0.92 }));
  garden.position.set(x, y + 0.12, z);
  garden.receiveShadow = true;
  g.add(garden);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.1, 10, 32), m.stone);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y + 0.2, z);
  ring.castShadow = true;
  g.add(ring);

  const tree = makeTree(11);
  tree.position.set(x, y + 0.18, z);
  tree.scale.setScalar(1.18);
  g.add(tree);
  addFlowers(g, x, y + 0.22, z + 0.9, 10, 0.7);
  addFlowers(g, x + 0.8, y + 0.22, z - 0.5, 8, 0.55);
  addFlowers(g, x - 0.7, y + 0.22, z - 0.4, 8, 0.5);

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.2;
    if (i % 5 === 0) continue;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.78, 12), m.stone);
    post.position.set(x + Math.cos(a) * (radius - 0.35), y + 0.45, z + Math.sin(a) * (radius - 0.35));
    post.castShadow = true;
    g.add(post);
    const cap = rbox(0.26, 0.07, 0.26, m.stone, 0.03);
    cap.position.copy(post.position);
    cap.position.y += 0.42;
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
