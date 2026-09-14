import * as THREE from 'three';
import { barkTexture, colorMat, fabricTexture, knitBeanieTexture, leatherTexture, metalTexture, pbrMat, rockTexture, skinTexture } from './Textures';

const skinCache = new Map<string, THREE.MeshStandardMaterial>();

function skin(hex: number): THREE.MeshStandardMaterial {
  let m = skinCache.get(String(hex));
  if (m) return m;
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  m = pbrMat(skinTexture([r, g, b], String(hex)), { roughness: 0.5, bump: 0.45 });
  skinCache.set(String(hex), m);
  return m;
}

function cloth(hex: number, name: string): THREE.MeshStandardMaterial {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return pbrMat(fabricTexture([r, g, b], name), { roughness: 0.88 });
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

function cap(r: number, len: number, mat: THREE.Material, segs = 12): THREE.Mesh {
  return mesh(new THREE.CapsuleGeometry(r, len, 8, segs), mat);
}

function sph(r: number, mat: THREE.Material, w = 18, h = 14): THREE.Mesh {
  return mesh(new THREE.SphereGeometry(r, w, h), mat);
}

export interface Humanoid {
  group: THREE.Group;
  head: THREE.Group;
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  handR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  height: number;
  animate(t: number, speed: number): void;
  setAttack(t01: number): void;
}

export interface Look {
  skin: number;
  hair: number;
  shirt: number;
  pants: number;
  shoes: number;
  beard?: boolean;
  glasses?: boolean;
  beanie?: boolean;
  goblin?: boolean;
  muscular?: number;
  elon?: boolean;
  crown?: boolean;
  cape?: number;
  lanyard?: boolean;
  cookie?: boolean;
  resume?: boolean;
  laptop?: boolean;
  popcorn?: boolean;
  sleeveless?: boolean;
  hoodie?: boolean;
  scale?: number;
}

function fingerBone(len: number, r: number, mat: THREE.Material, claw = false): THREE.Group {
  const g = new THREE.Group();
  const p = cap(r, len * 0.82, mat, 8);
  p.position.y = -len * 0.48;
  g.add(p);
  if (claw) {
    const c = mesh(new THREE.ConeGeometry(r * 0.7, 0.03, 6), colorMat(0xf0e6d0, { roughness: 0.28 }));
    c.position.y = -len - 0.008;
    c.rotation.x = Math.PI;
    g.add(c);
  }
  return g;
}

function makeHand(sMat: THREE.Material, side: number, musc: number, claws: boolean): { root: THREE.Group; palm: THREE.Group; mcp: THREE.Group[]; pip: THREE.Group[] } {
  const root = new THREE.Group();
  const palm = new THREE.Group();
  const mcp: THREE.Group[] = [];
  const pip: THREE.Group[] = [];
  const palmM = sph(0.036 * musc, sMat, 12, 10);
  palmM.scale.set(1.2, 1.45, 0.68);
  palmM.position.y = -0.032;
  palm.add(palmM);
  const lens = [0.046, 0.054, 0.05, 0.042];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.0175 * musc;
    const knuckle = sph(0.008 * musc, sMat, 8, 6);
    knuckle.position.set(x, -0.07, 0.01);
    palm.add(knuckle);
    const b0 = fingerBone(lens[i] * 0.42, 0.0074 * musc, sMat);
    b0.position.set(x, -0.078, 0.008);
    b0.rotation.z = (i - 1.5) * 0.05 * side;
    b0.rotation.x = 0.12;
    palm.add(b0);
    mcp.push(b0);
    const b1 = fingerBone(lens[i] * 0.32, 0.0064 * musc, sMat);
    b1.position.y = -lens[i] * 0.4;
    b0.add(b1);
    pip.push(b1);
    const b2 = fingerBone(lens[i] * 0.24, 0.0054 * musc, sMat, claws);
    b2.position.y = -lens[i] * 0.3;
    b2.rotation.x = 0.18;
    b1.add(b2);
  }
  const thumb0 = fingerBone(0.038, 0.009 * musc, sMat);
  thumb0.position.set(side * 0.036 * musc, -0.018, 0.014);
  thumb0.rotation.set(0.45, side * 0.35, side * 0.75);
  palm.add(thumb0);
  mcp.push(thumb0);
  const thumb1 = fingerBone(0.03, 0.0075 * musc, sMat, claws);
  thumb1.position.y = -0.036;
  thumb1.rotation.x = 0.25;
  thumb0.add(thumb1);
  pip.push(thumb1);
  root.add(palm);
  return { root, palm, mcp, pip };
}

function addHair(head: THREE.Group, look: Look, headR: number, hairM: THREE.Material): void {
  if (look.beanie) {
    const knit = pbrMat(knitBeanieTexture(), { roughness: 1 });
    const hat = mesh(new THREE.SphereGeometry(headR * 1.16, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.68), knit);
    hat.position.y = 0.03;
    head.add(hat);
    const brim = mesh(new THREE.TorusGeometry(headR * 0.95, 0.018, 8, 20), knit);
    brim.rotation.x = Math.PI / 2;
    brim.position.y = -0.01;
    head.add(brim);
    const pom = sph(0.048, colorMat(0x1a1a1e, { roughness: 1 }), 12, 10);
    pom.position.y = headR + 0.09;
    head.add(pom);
    for (const side of [-1, 1]) {
      const flap = mesh(new THREE.SphereGeometry(0.058, 12, 10), knit);
      flap.scale.set(0.65, 1.35, 0.42);
      flap.position.set(side * (headR * 0.88), -0.05, 0.02);
      head.add(flap);
      const braid = new THREE.Group();
      braid.position.set(side * (headR * 0.92), -0.12, 0.02);
      for (let i = 0; i < 5; i++) {
        const bead = sph(0.012 - i * 0.001, knit, 8, 6);
        bead.position.y = -i * 0.038;
        braid.add(bead);
      }
      head.add(braid);
    }
    const sideHair = mesh(new THREE.SphereGeometry(headR * 0.95, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.35), hairM);
    sideHair.position.y = -0.02;
    head.add(sideHair);
    return;
  }
  if (look.elon) {
    const fringe = mesh(new THREE.SphereGeometry(headR * 0.98, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.28), hairM);
    fringe.position.set(0, 0.06, 0.01);
    fringe.scale.set(0.95, 0.4, 1);
    head.add(fringe);
    const sides = mesh(new THREE.SphereGeometry(headR * 1.02, 16, 12, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.45), hairM);
    sides.scale.set(1.05, 0.75, 0.92);
    head.add(sides);
    return;
  }
  const capHair = mesh(new THREE.SphereGeometry(headR * 1.06, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.7), hairM);
  capHair.position.y = 0.016;
  capHair.scale.set(1.04, 0.92, 1.06);
  head.add(capHair);
  const fringe = mesh(new THREE.SphereGeometry(headR * 0.95, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.34), hairM);
  fringe.position.set(0, 0.05, 0.018);
  fringe.scale.set(1.02, 0.38, 1.08);
  head.add(fringe);
  for (let i = 0; i < 5; i++) {
    const bang = sph(0.02, hairM, 8, 6);
    bang.scale.set(0.65, 0.85, 0.4);
    bang.position.set((i - 2) * 0.024, 0.05, headR * 0.86);
    bang.rotation.x = 0.55;
    head.add(bang);
  }
  for (const side of [-1, 1]) {
    const sideH = sph(headR * 0.32, hairM, 10, 8);
    sideH.scale.set(0.42, 1.15, 0.7);
    sideH.position.set(side * headR * 0.88, -0.01, -0.01);
    head.add(sideH);
  }
  if (look.crown) {
    const gold = pbrMat(metalTexture(), { color: 0xffd24a, metalness: 0.88, roughness: 0.22, emissive: 0x553300, emissiveIntensity: 0.18 });
    const band = mesh(new THREE.CylinderGeometry(headR * 1.14, headR * 1.14, 0.055, 18, 1, true), gold);
    band.position.y = headR * 0.52;
    head.add(band);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.022, 0.11, 7), gold);
      spike.position.set(Math.sin(a) * headR * 1.08, headR * 0.68, Math.cos(a) * headR * 1.08);
      head.add(spike);
    }
    const gem = sph(0.026, colorMat(0xff2a4a, { roughness: 0.18, metalness: 0.35, emissive: 0xff1040, emissiveIntensity: 0.85 }), 12, 10);
    gem.position.set(0, headR * 0.55, headR * 1.14);
    head.add(gem);
  }
}

export function makePerson(look: Look): Humanoid {
  const group = new THREE.Group();
  const musc = look.muscular ?? 1;
  const gob = !!look.goblin;
  const sMat = skin(look.skin);
  const shirt = cloth(look.shirt, `s${look.shirt}`);
  const pants = cloth(look.pants, `p${look.pants}`);
  const shoe = colorMat(look.shoes, { roughness: 0.65, metalness: 0.08 });
  const hairM = colorMat(look.hair, { roughness: 0.48 });

  const torsoW = 0.16 * musc * (gob ? 0.92 : 1);
  const headR = gob ? 0.155 : 0.118;

  const pelvis = new THREE.Group();
  pelvis.position.y = 0.92;
  group.add(pelvis);

  const hips = mesh(new THREE.SphereGeometry(torsoW * 1.05, 14, 10), pants);
  hips.scale.set(1.15, 0.55, 0.85);
  pelvis.add(hips);

  const spine = new THREE.Group();
  pelvis.add(spine);

  const body = new THREE.Group();
  body.position.y = 0.22;
  spine.add(body);

  const chest = mesh(new THREE.SphereGeometry(torsoW * 1.22, 18, 14), shirt);
  chest.scale.set(1.02, 1.32, 0.62);
  chest.position.y = 0.02;
  body.add(chest);
  const belly = mesh(new THREE.SphereGeometry(torsoW * 1.02, 14, 12), shirt);
  belly.scale.set(1, 1.05, 0.62);
  belly.position.y = -0.14;
  body.add(belly);

  if (look.sleeveless) {
    for (const side of [-1, 1]) {
      const pec = sph(torsoW * 0.55, sMat, 12, 10);
      pec.scale.set(1.1, 0.7, 0.7);
      pec.position.set(side * torsoW * 0.42, 0.06, torsoW * 0.55);
      body.add(pec);
      const strap = mesh(new THREE.BoxGeometry(0.045, 0.22, 0.02), shirt);
      strap.position.set(side * torsoW * 0.7, 0.12, 0);
      strap.rotation.z = side * 0.18;
      body.add(strap);
    }
    const hem = mesh(new THREE.TorusGeometry(torsoW * 1.05, 0.012, 6, 16), shirt);
    hem.rotation.x = Math.PI / 2;
    hem.position.y = -0.18;
    body.add(hem);
  } else {
    for (let i = 0; i < 4; i++) {
      const btn = sph(0.007, colorMat(0xc8c4b8, { roughness: 0.35, metalness: 0.45 }), 8, 6);
      btn.position.set(0, 0.1 - i * 0.048, torsoW * 1.08);
      body.add(btn);
    }
    for (const side of [-1, 1]) {
      const pocket = mesh(new THREE.BoxGeometry(0.058, 0.062, 0.01), shirt);
      pocket.position.set(side * torsoW * 0.58, -0.07, torsoW * 0.88);
      body.add(pocket);
      const flap = mesh(new THREE.BoxGeometry(0.06, 0.016, 0.012), shirt);
      flap.position.set(side * torsoW * 0.58, -0.038, torsoW * 0.9);
      body.add(flap);
    }
  }

  const beltM = pbrMat(leatherTexture(), { roughness: 0.68 });
  const belt = mesh(new THREE.TorusGeometry(torsoW * 1.08, 0.015, 8, 18), beltM);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = -0.22;
  body.add(belt);
  const buckle = mesh(new THREE.BoxGeometry(0.042, 0.028, 0.014), colorMat(0xd4b45a, { metalness: 0.82, roughness: 0.28 }));
  buckle.position.set(0, -0.22, torsoW * 1.05);
  body.add(buckle);

  const collar = mesh(new THREE.TorusGeometry(torsoW * 0.72, 0.018, 8, 16), shirt);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.16;
  body.add(collar);

  if (look.hoodie) {
    const hood = mesh(new THREE.SphereGeometry(headR * 0.95, 16, 12, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.55), shirt);
    hood.position.set(0, 0.2, -0.1);
    hood.scale.set(1.2, 0.65, 0.85);
    body.add(hood);
    const cordL = cap(0.004, 0.08, colorMat(0xeeeeee, { roughness: 0.7 }), 6);
    cordL.position.set(-0.04, 0.14, torsoW * 0.9);
    body.add(cordL);
    const cordR = cap(0.004, 0.08, colorMat(0xeeeeee, { roughness: 0.7 }), 6);
    cordR.position.set(0.04, 0.14, torsoW * 0.9);
    body.add(cordR);
  }

  let capeMesh: THREE.Mesh | null = null;
  if (look.cape) {
    const emblem = mesh(new THREE.CircleGeometry(0.03, 14), colorMat(look.cape, { emissive: look.cape, emissiveIntensity: 0.22, roughness: 0.35, metalness: 0.2 }));
    emblem.position.set(0, look.sleeveless ? 0.02 : 0.05, torsoW * 1.15);
    body.add(emblem);
    const ring = mesh(new THREE.RingGeometry(0.026, 0.034, 16), colorMat(0xf2d36b, { metalness: 0.7, roughness: 0.3 }));
    ring.position.copy(emblem.position);
    ring.position.z += 0.001;
    body.add(ring);
    capeMesh = mesh(
      new THREE.CylinderGeometry(torsoW * 0.95, torsoW * 1.25, 0.95, 10, 1, true, Math.PI * 1.18, Math.PI * 0.64),
      cloth(look.cape, `cape${look.cape}`),
    );
    capeMesh.position.set(0, -0.2, -0.04);
    body.add(capeMesh);
  }
  if (look.lanyard) {
    const strap = mesh(new THREE.TorusGeometry(0.09, 0.007, 6, 18, Math.PI), colorMat(0x222222, { roughness: 0.35 }));
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0, 0.14, 0.03);
    body.add(strap);
    const badge = mesh(new THREE.BoxGeometry(0.065, 0.09, 0.01), colorMat(0x111111, { roughness: 0.28, metalness: 0.45 }));
    badge.position.set(0.03, 0.02, torsoW * 0.95);
    body.add(badge);
    const clip = mesh(new THREE.BoxGeometry(0.03, 0.018, 0.012), colorMat(0xc0c0c8, { metalness: 0.8, roughness: 0.25 }));
    clip.position.set(0.03, 0.07, torsoW * 0.95);
    body.add(clip);
  }

  const neck = cap(0.04, 0.08, sMat, 12);
  neck.position.y = 0.2;
  body.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.32 + (gob ? 0.03 : 0);
  body.add(head);

  const skull = sph(headR, sMat, 22, 18);
  skull.scale.set(0.92, 1.08, 0.96);
  head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(headR * 0.72, 14, 10), sMat);
  jaw.scale.set(0.95, 0.55, 0.9);
  jaw.position.set(0, -0.055, 0.02);
  head.add(jaw);
  const chin = sph(headR * 0.28, sMat, 10, 8);
  chin.scale.set(1.1, 0.7, 1.15);
  chin.position.set(0, -0.09, headR * 0.45);
  head.add(chin);
  for (const side of [-1, 1]) {
    const cheek = sph(headR * 0.32, sMat, 10, 8);
    cheek.scale.set(0.85, 0.7, 0.7);
    cheek.position.set(side * headR * 0.55, -0.02, headR * 0.35);
    head.add(cheek);
  }

  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(gob ? 0.055 : 0.032, 12, 10), sMat);
    ear.scale.set(gob ? 0.45 : 0.45, gob ? 1.35 : 1.15, 0.55);
    ear.position.set(side * (headR + (gob ? 0.01 : 0.008)), gob ? 0.02 : 0, -0.01);
    ear.rotation.z = side * (gob ? -0.55 : -0.25);
    head.add(ear);
  }

  if (gob) {
    const nose = mesh(new THREE.ConeGeometry(0.04, 0.13, 10), sMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.01, headR * 0.88);
    head.add(nose);
    const wart = sph(0.012, sMat, 8, 6);
    wart.position.set(0.05, 0.01, headR * 0.7);
    head.add(wart);
    const fangM = colorMat(0xf5f0e6, { roughness: 0.28 });
    for (const side of [-1, 1]) {
      const fang = mesh(new THREE.ConeGeometry(0.011, 0.042, 7), fangM);
      fang.position.set(side * 0.028, -0.068, headR * 0.72);
      fang.rotation.x = Math.PI;
      head.add(fang);
    }
    const brow = mesh(new THREE.BoxGeometry(0.15, 0.022, 0.035), hairM);
    brow.position.set(0, 0.048, headR * 0.72);
    brow.rotation.z = 0.18;
    head.add(brow);
  } else {
    const nose = mesh(new THREE.SphereGeometry(0.02, 10, 8), sMat);
    nose.scale.set(0.75, 1.15, 1.45);
    nose.position.set(0, -0.008, headR * 0.95);
    head.add(nose);
    const bridge = mesh(new THREE.SphereGeometry(0.012, 8, 6), sMat);
    bridge.scale.set(0.7, 1.2, 1.1);
    bridge.position.set(0, 0.012, headR * 0.9);
    head.add(bridge);
  }

  const lids: THREE.Mesh[] = [];
  const lowerLids: THREE.Mesh[] = [];
  const eyeW = gob ? 0.026 : 0.02;
  const eyeZ = headR * (gob ? 0.8 : 0.9);
  for (const side of [-1, 1]) {
    const socket = mesh(new THREE.SphereGeometry(eyeW * 1.25, 12, 10), sMat);
    socket.scale.set(1, 0.75, 0.5);
    socket.position.set(side * headR * 0.36, 0.022, eyeZ - 0.01);
    head.add(socket);
    const white = sph(eyeW, colorMat(0xf7f7fb, { roughness: 0.18 }), 12, 10);
    white.position.set(side * headR * 0.36, 0.022, eyeZ);
    head.add(white);
    const iris = sph(eyeW * 0.58, colorMat(gob ? 0xa8ff44 : 0x3a2418, { roughness: 0.22, emissive: gob ? 0x335500 : 0, emissiveIntensity: gob ? 0.35 : 0 }), 10, 8);
    iris.position.set(side * headR * 0.36, 0.022, eyeZ + eyeW * 0.5);
    head.add(iris);
    const pupil = sph(eyeW * 0.28, colorMat(0x09090c, { roughness: 0.15 }), 8, 6);
    pupil.position.set(side * headR * 0.36, 0.022, eyeZ + eyeW * 0.72);
    head.add(pupil);
    const shine = sph(eyeW * 0.1, colorMat(0xffffff, { roughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.4 }), 6, 5);
    shine.position.set(side * headR * 0.36 - 0.006, 0.03, eyeZ + eyeW * 0.8);
    head.add(shine);
    const lid = mesh(new THREE.SphereGeometry(eyeW * 1.18, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), sMat);
    lid.position.set(side * headR * 0.36, 0.028, eyeZ);
    lid.rotation.x = -0.15;
    head.add(lid);
    lids.push(lid);
    const low = mesh(new THREE.SphereGeometry(eyeW * 1.1, 8, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), sMat);
    low.position.set(side * headR * 0.36, 0.012, eyeZ);
    head.add(low);
    lowerLids.push(low);
    const brow = mesh(new THREE.SphereGeometry(0.018, 8, 6), hairM);
    brow.scale.set(1.7, 0.32, 0.7);
    brow.position.set(side * headR * 0.36, 0.05, eyeZ - 0.008);
    brow.rotation.z = side * (gob ? 0.35 : -0.12);
    head.add(brow);
    const lash = mesh(new THREE.BoxGeometry(eyeW * 1.6, 0.004, 0.008), hairM);
    lash.position.set(side * headR * 0.36, 0.038, eyeZ + 0.006);
    head.add(lash);
  }

  const upperLip = mesh(new THREE.SphereGeometry(0.022, 10, 6), colorMat(0xb06060, { roughness: 0.45 }));
  upperLip.scale.set(1.5, 0.35, 0.7);
  upperLip.position.set(0, gob ? -0.048 : -0.042, headR * 0.88);
  head.add(upperLip);
  const lowerLip = mesh(new THREE.SphereGeometry(0.02, 10, 6), colorMat(0xa05050, { roughness: 0.45 }));
  lowerLip.scale.set(1.35, 0.32, 0.65);
  lowerLip.position.set(0, gob ? -0.062 : -0.055, headR * 0.86);
  head.add(lowerLip);

  if (look.beard) {
    const beard = mesh(new THREE.SphereGeometry(headR * 0.78, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), hairM);
    beard.position.set(0, -0.07, 0.025);
    beard.scale.set(1.05, 0.75, 0.9);
    head.add(beard);
    const stache = mesh(new THREE.SphereGeometry(0.028, 10, 6), hairM);
    stache.scale.set(1.6, 0.4, 0.7);
    stache.position.set(0, -0.038, headR * 0.86);
    head.add(stache);
  }

  if (look.glasses) {
    const frame = colorMat(0x111111, { roughness: 0.22, metalness: 0.4 });
    const glass = colorMat(0x88aacc, { roughness: 0.05, metalness: 0.12 });
    glass.transparent = true;
    glass.opacity = 0.18;
    for (const side of [-1, 1]) {
      const rim = mesh(new THREE.TorusGeometry(0.036, 0.0055, 8, 18), frame);
      rim.position.set(side * 0.046, 0.022, eyeZ + 0.012);
      head.add(rim);
      const lens = mesh(new THREE.CircleGeometry(0.032, 18), glass);
      lens.position.set(side * 0.046, 0.022, eyeZ + 0.014);
      head.add(lens);
    }
    const bridge = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.028, 8), frame);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.022, eyeZ + 0.012);
    head.add(bridge);
    for (const side of [-1, 1]) {
      const arm = mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 6), frame);
      arm.rotation.y = side * 0.2;
      arm.rotation.x = Math.PI / 2.4;
      arm.position.set(side * 0.078, 0.02, eyeZ - 0.025);
      head.add(arm);
    }
  }

  addHair(head, look, headR, hairM);

  const mkArm = (side: number) => {
    const sleeve = look.sleeveless ? sMat : shirt;
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (torsoW * 1.28), 0.1, 0);
    const ball = sph(0.042 * musc, look.sleeveless ? sMat : shirt, 14, 12);
    shoulder.add(ball);
    const upper = new THREE.Group();
    const upperM = cap(0.038 * musc, 0.18, sleeve, 14);
    upperM.position.y = -0.12;
    upper.add(upperM);
    if (look.sleeveless) {
      const deltoid = sph(0.05 * musc, sMat, 12, 10);
      deltoid.position.y = -0.03;
      upper.add(deltoid);
    } else {
      const cuff = mesh(new THREE.TorusGeometry(0.04 * musc, 0.007, 6, 12), shirt);
      cuff.position.y = -0.22;
      cuff.rotation.x = Math.PI / 2;
      upper.add(cuff);
    }
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.24;
    const elball = sph(0.03 * musc, sMat, 10, 8);
    elbow.add(elball);
    const lowerM = cap(0.032 * musc, 0.16, sMat, 14);
    lowerM.position.y = -0.11;
    elbow.add(lowerM);
    upper.add(elbow);
    const wrist = new THREE.Group();
    wrist.position.y = -0.22;
    const wristM = sph(0.028 * musc, sMat, 10, 8);
    wrist.add(wristM);
    elbow.add(wrist);
    const hand = makeHand(sMat, side, musc, gob);
    hand.root.position.y = -0.02;
    wrist.add(hand.root);
    return { shoulder, upper, elbow, wrist, hand: hand.root, palm: hand.palm, mcp: hand.mcp, pip: hand.pip };
  };
  const leftA = mkArm(-1);
  const rightA = mkArm(1);
  body.add(leftA.shoulder, rightA.shoulder);

  const mkLeg = (side: number) => {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.085 * musc, -0.02, 0);
    const thighM = cap(0.062 * musc, 0.24, pants, 14);
    thighM.position.y = -0.14;
    thigh.add(thighM);
    const pocket = mesh(new THREE.BoxGeometry(0.045, 0.06, 0.012), pants);
    pocket.position.set(side * 0.04, -0.1, 0.05);
    thigh.add(pocket);
    const shin = new THREE.Group();
    shin.position.y = -0.3;
    const knee = sph(0.042 * musc, pants, 10, 8);
    shin.add(knee);
    const shinM = cap(0.046 * musc, 0.22, pants, 12);
    shinM.position.y = -0.14;
    shin.add(shinM);
    thigh.add(shin);
    const foot = new THREE.Group();
    foot.position.y = -0.3;
    const shoeM = sph(0.046 * musc, shoe, 12, 8);
    shoeM.scale.set(0.85, 0.52, 1.55);
    shoeM.position.set(0, -0.016, 0.042);
    const heel = sph(0.028 * musc, shoe, 8, 6);
    heel.scale.set(0.9, 0.72, 0.75);
    heel.position.set(0, -0.008, -0.018);
    const sole = mesh(new THREE.BoxGeometry(0.062 * musc, 0.012, 0.14), colorMat(0x1a1a1e, { roughness: 0.9 }));
    sole.position.set(0, -0.032, 0.03);
    foot.add(shoeM, heel, sole);
    shin.add(foot);
    return { thigh, shin, foot };
  };
  const leftL = mkLeg(-1);
  const rightL = mkLeg(1);
  pelvis.add(leftL.thigh, rightL.thigh);

  if (look.cookie) {
    const c = makeCookie();
    c.position.set(0, -0.05, 0.05);
    leftA.hand.add(c);
  }
  if (look.resume) {
    const paper = makeResume();
    paper.position.set(0.02, -0.04, 0.06);
    paper.rotation.x = -0.4;
    rightA.hand.add(paper);
  }
  if (look.laptop) {
    const lap = makeLaptop();
    lap.position.set(0, -0.02, 0.08);
    leftA.hand.add(lap);
  }
  if (look.popcorn) {
    const b = makePopcorn();
    b.position.set(0, -0.06, 0.05);
    leftA.hand.add(b);
  }

  const sc = look.scale ?? 1;
  group.scale.setScalar(sc);
  const height = 1.82 * sc;
  const gobHunch = gob ? 0.28 : 0;
  let attackT = -1;

  return {
    group,
    head,
    body,
    armL: leftA.shoulder,
    armR: rightA.shoulder,
    handR: rightA.hand,
    legL: leftL.thigh,
    legR: rightL.thigh,
    height,
    animate(t, speed) {
      const moving = Math.min(1, Math.max(0, speed));
      const run = moving > 0.72;
      const freq = run ? 11.2 : 7.6;
      const cycle = t * freq;
      const s = Math.sin(cycle);
      const c = Math.cos(cycle);
      const s2 = Math.sin(cycle * 2);
      const amp = (run ? 0.88 : 0.55) * moving;

      const breath = Math.sin(t * 2.15) * (1 - moving * 0.55);
      const shift = Math.sin(t * 0.9) * (1 - moving);
      pelvis.position.y = 0.92 + Math.abs(s) * (run ? 0.055 : 0.038) * moving + breath * 0.008;
      pelvis.rotation.y = s * 0.16 * moving;
      pelvis.rotation.z = c * 0.06 * moving + shift * 0.03;
      pelvis.rotation.x = -0.04 * moving;
      spine.rotation.x = gobHunch + 0.14 * moving + breath * 0.04;
      spine.rotation.y = -s * 0.12 * moving;
      spine.rotation.z = -pelvis.rotation.z * 0.45;
      body.rotation.y = s * 0.06 * moving;
      chest.scale.y = 1.32 + breath * 0.03;
      chest.scale.x = 1.02 + breath * 0.012;

      leftL.thigh.rotation.x = s * amp;
      leftL.thigh.rotation.z = 0.04;
      rightL.thigh.rotation.x = -s * amp;
      rightL.thigh.rotation.z = -0.04;
      leftL.shin.rotation.x = 0.08 + Math.max(0, -s) * (run ? 1.15 : 0.92) * moving + Math.max(0, s) * 0.12 * moving;
      rightL.shin.rotation.x = 0.08 + Math.max(0, s) * (run ? 1.15 : 0.92) * moving + Math.max(0, -s) * 0.12 * moving;
      leftL.foot.rotation.x = -leftL.thigh.rotation.x * 0.28 - leftL.shin.rotation.x * 0.32 + 0.06 + Math.max(0, s) * 0.18 * moving;
      rightL.foot.rotation.x = -rightL.thigh.rotation.x * 0.28 - rightL.shin.rotation.x * 0.32 + 0.06 + Math.max(0, -s) * 0.18 * moving;

      leftA.shoulder.rotation.x = -s * amp * (run ? 1.05 : 0.9);
      leftA.shoulder.rotation.z = 0.14 + Math.sin(t * 2.1) * 0.025 + moving * 0.04;
      leftA.shoulder.rotation.y = s * 0.08 * moving;
      leftA.elbow.rotation.x = (run ? 0.55 : 0.32) + Math.abs(s) * 0.45 * moving;
      leftA.wrist.rotation.x = -0.08 + s * 0.12 * moving;
      if (attackT < 0) {
        rightA.shoulder.rotation.x = s * amp * (run ? 1.05 : 0.9);
        rightA.shoulder.rotation.z = -0.14 - moving * 0.04;
        rightA.shoulder.rotation.y = -s * 0.08 * moving;
        rightA.elbow.rotation.x = (run ? 0.55 : 0.32) + Math.abs(c) * 0.45 * moving;
        rightA.wrist.rotation.x = -0.08 - s * 0.12 * moving;
      }

      head.rotation.y = Math.sin(t * 0.65) * 0.16 * (1 - moving);
      head.rotation.x = -s * 0.06 * moving + breath * 0.045;
      head.rotation.z = -pelvis.rotation.z * 0.55;

      const phase = (t * 0.52) % 4.2;
      const blink = phase > 4.02 ? Math.min(1, (phase - 4.02) / 0.06) : 0;
      const close = blink > 0.5 ? 1 - blink : blink;
      for (const lid of lids) lid.rotation.x = -0.15 + close * 1.25;
      for (const lid of lowerLids) lid.rotation.x = close * -0.35;

      const fist = 0.12 + moving * 0.18 + Math.sin(t * 2.4) * 0.04 * (1 - moving);
      for (const b of leftA.mcp) b.rotation.x = 0.14 + fist;
      for (const b of leftA.pip) b.rotation.x = 0.22 + fist * 0.8;
      if (attackT < 0) {
        for (const b of rightA.mcp) b.rotation.x = 0.1 + fist * 0.6;
        for (const b of rightA.pip) b.rotation.x = 0.18 + fist * 0.5;
      }
      leftA.palm.rotation.x = 0.08 + Math.sin(t * 2.6) * 0.05 * (1 - moving);
      if (capeMesh) capeMesh.rotation.x = s2 * 0.06 * moving + breath * 0.02;
    },
    setAttack(t01) {
      attackT = t01;
      if (t01 < 0) return;
      const wind = t01 < 0.28 ? t01 / 0.28 : 0;
      const slash = t01 >= 0.28 && t01 < 0.55 ? (t01 - 0.28) / 0.27 : t01 >= 0.55 ? 1 : 0;
      const rec = t01 >= 0.55 ? (t01 - 0.55) / 0.45 : 0;
      if (t01 < 0.28) {
        rightA.shoulder.rotation.x = -0.5 - wind * 1.85;
        rightA.shoulder.rotation.z = -0.25 - wind * 0.55;
        rightA.shoulder.rotation.y = wind * 0.4;
        rightA.elbow.rotation.x = 0.15 + wind * 0.2;
        rightA.wrist.rotation.x = -0.3 - wind * 0.4;
        spine.rotation.y = wind * 0.42;
        pelvis.rotation.y = wind * 0.12;
        for (const b of rightA.mcp) b.rotation.x = 0.55;
        for (const b of rightA.pip) b.rotation.x = 0.7;
      } else if (t01 < 0.55) {
        rightA.shoulder.rotation.x = -2.35 + slash * 3.15;
        rightA.shoulder.rotation.z = -0.8 + slash * 0.55;
        rightA.shoulder.rotation.y = 0.4 - slash * 0.7;
        rightA.elbow.rotation.x = 0.35 + slash * 0.55;
        rightA.wrist.rotation.x = -0.7 + slash * 0.9;
        spine.rotation.y = 0.42 - slash * 0.85;
        pelvis.rotation.y = 0.12 - slash * 0.28;
        for (const b of rightA.mcp) b.rotation.x = 0.35;
        for (const b of rightA.pip) b.rotation.x = 0.4;
      } else {
        rightA.shoulder.rotation.x = 0.8 * (1 - rec);
        rightA.shoulder.rotation.z = -0.25 * (1 - rec);
        rightA.shoulder.rotation.y = -0.3 * (1 - rec);
        rightA.elbow.rotation.x = 0.9 * (1 - rec) + 0.32 * rec;
        rightA.wrist.rotation.x = 0.2 * (1 - rec);
        spine.rotation.y = -0.43 * (1 - rec);
        pelvis.rotation.y = -0.16 * (1 - rec);
      }
    },
  };
}

export function attachToHand(h: Humanoid, weapon: THREE.Object3D): void {
  weapon.position.set(0.01, -0.06, 0.04);
  weapon.rotation.x = Math.PI / 2;
  h.handR.add(weapon);
}

export function makeSword(): THREE.Group {
  const g = new THREE.Group();
  const steel = pbrMat(metalTexture(), { color: 0xdde4f0, metalness: 0.92, roughness: 0.22 });
  const gold = pbrMat(metalTexture(), { color: 0xe6c35a, metalness: 0.85, roughness: 0.28 });
  const leather = pbrMat(leatherTexture(), { roughness: 0.7 });

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.028, 0.02, 0.032, 0.08, 0.03, 0.18);
  shape.lineTo(0.022, 0.62);
  shape.lineTo(0, 0.78);
  shape.lineTo(-0.022, 0.62);
  shape.lineTo(-0.03, 0.18);
  shape.bezierCurveTo(-0.032, 0.08, -0.028, 0.02, 0, 0);
  const blade = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, steps: 1 }), steel);
  blade.position.z = -0.005;
  g.add(blade);
  const fuller = mesh(new THREE.BoxGeometry(0.006, 0.5, 0.012), colorMat(0x9aa8bb, { metalness: 0.95, roughness: 0.15 }));
  fuller.position.y = 0.34;
  g.add(fuller);
  const guard = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 10), gold);
  guard.rotation.z = Math.PI / 2;
  guard.position.y = 0.02;
  g.add(guard);
  const guardMid = mesh(new THREE.SphereGeometry(0.022, 10, 8), gold);
  guardMid.position.y = 0.02;
  g.add(guardMid);
  const grip = mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.12, 10), leather);
  grip.position.y = -0.06;
  g.add(grip);
  const pommel = mesh(new THREE.SphereGeometry(0.022, 12, 10), gold);
  pommel.position.y = -0.13;
  g.add(pommel);
  return g;
}

export function makeDumbbell(): THREE.Group {
  const g = new THREE.Group();
  const iron = pbrMat(metalTexture(), { color: 0x3a3d44, metalness: 0.7, roughness: 0.4 });
  const bar = pbrMat(metalTexture(), { color: 0xb0b6c0, metalness: 0.85, roughness: 0.25 });
  g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.38, 10), bar));
  for (const y of [-0.16, 0.16]) {
    const w = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 14), iron);
    w.position.y = y;
    g.add(w);
    const w2 = mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.04, 14), iron);
    w2.position.y = y + Math.sign(y) * 0.045;
    g.add(w2);
  }
  return g;
}

export function makeCookie(): THREE.Group {
  const g = new THREE.Group();
  const dough = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.018, 16), colorMat(0xc48a3a, { roughness: 0.85 }));
  dough.rotation.x = Math.PI / 2;
  g.add(dough);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const chip = sph(0.01, colorMat(0x3a2212, { roughness: 0.6 }), 6, 5);
    chip.position.set(Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0.01);
    g.add(chip);
  }
  return g;
}

export function makeResume(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.16, 0.004), colorMat(0xf4f1e6, { roughness: 0.9 })));
  const lineM = colorMat(0x3a5a8a, { roughness: 1 });
  for (let i = 0; i < 5; i++) {
    const line = mesh(new THREE.BoxGeometry(0.08, 0.006, 0.005), lineM);
    line.position.y = 0.04 - i * 0.025;
    g.add(line);
  }
  return g;
}

export function makeLaptop(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.18, 0.012, 0.12), colorMat(0x1c1c22, { roughness: 0.35, metalness: 0.4 })));
  const screen = mesh(new THREE.BoxGeometry(0.18, 0.12, 0.008), colorMat(0x1c1c22, { roughness: 0.35, metalness: 0.4 }));
  screen.position.set(0, 0.06, -0.055);
  screen.rotation.x = -0.35;
  g.add(screen);
  const glow = mesh(new THREE.PlaneGeometry(0.16, 0.1), colorMat(0x3cff8a, { emissive: 0x22aa55, emissiveIntensity: 1.4, roughness: 0.3 }));
  glow.position.set(0, 0.06, -0.05);
  glow.rotation.x = -0.35;
  g.add(glow);
  return g;
}

export function makePopcorn(): THREE.Group {
  const g = new THREE.Group();
  const stripes = fabricTexture([216, 38, 46], 'pop');
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.12, 12), pbrMat(stripes, { roughness: 0.8 })));
  const top = mesh(new THREE.SphereGeometry(0.075, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), colorMat(0xf2dc9a, { roughness: 0.9 }));
  top.position.y = 0.06;
  g.add(top);
  return g;
}

export function makePhone(glow = 0x3cff7a): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.055, 0.11, 0.01), colorMat(0x1a1a1e, { roughness: 0.25, metalness: 0.5 })));
  const screen = mesh(new THREE.PlaneGeometry(0.046, 0.095), colorMat(glow, { emissive: glow, emissiveIntensity: 0.7, roughness: 0.2 }));
  screen.position.z = 0.006;
  g.add(screen);
  return g;
}

export const LOOKS = {
  nicolas: { skin: 0xd9a066, hair: 0x2a1d14, shirt: 0x1f3a6a, pants: 0x2b2b33, shoes: 0x1a1a22, cape: 0x142a52 } satisfies Look,
  matheus: { skin: 0xc98a5a, hair: 0x1e140c, shirt: 0x3a2a22, pants: 0x4a3226, shoes: 0xc62828, muscular: 1.22, cape: 0xb71c1c, sleeveless: true } satisfies Look,
  pedro: { skin: 0xd9a066, hair: 0x6b4423, shirt: 0xe8e8ee, pants: 0x2a2e36, shoes: 0x1a1a20, cape: 0xd4b24a } satisfies Look,
  elon: { skin: 0xe0b896, hair: 0x3a2a22, shirt: 0x111111, pants: 0x2a2a2a, shoes: 0x111111, elon: true } satisfies Look,
  deyvin: { skin: 0xc68642, hair: 0x1a1210, shirt: 0x1a1a22, pants: 0x2a2a30, shoes: 0x111111, beard: true, glasses: true, beanie: true, lanyard: true } satisfies Look,
  helio: { skin: 0x5a8a32, hair: 0x1a3010, shirt: 0x4a3020, pants: 0x3a2818, shoes: 0x2a1a10, goblin: true, muscular: 0.95 } satisfies Look,
  boss: { skin: 0xd9a066, hair: 0x2a1d14, shirt: 0xb3202a, pants: 0x3a1a1a, shoes: 0x1a1010, crown: true, cape: 0x7a0f18, popcorn: true, muscular: 1.25 } satisfies Look,
  banhos: { skin: 0xdeba8c, hair: 0x3a2818, shirt: 0x2a6a4a, pants: 0x3a3a44, shoes: 0x22222a, cookie: true, resume: true } satisfies Look,
  almeida: { skin: 0xc68642, hair: 0x1a1210, shirt: 0x2a4060, pants: 0x2b2b33, shoes: 0x22222a, muscular: 1.18, laptop: true } satisfies Look,
  anderson: { skin: 0xd9a066, hair: 0x2a1d14, shirt: 0x3a3a48, pants: 0x2b2b33, shoes: 0x22222a, hoodie: true } satisfies Look,
};

export function makeTree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const bark = pbrMat(barkTexture(), { roughness: 0.95 });
  const h = 2.2 + (seed % 7) * 0.18;
  const trunk = mesh(new THREE.CylinderGeometry(0.12, 0.18, h, 8), bark);
  trunk.position.y = h / 2;
  g.add(trunk);
  const leafCols = [0x3d8a32, 0x2f6e28, 0x4a9a38, 0x356e2a];
  const leaf = colorMat(leafCols[seed % leafCols.length], { roughness: 0.85 });
  const crownY = h * 0.72;
  for (let i = 0; i < 5; i++) {
    const r = 0.7 + (i % 3) * 0.18;
    const s = sph(r, leaf, 10, 8);
    s.position.set(Math.sin(i * 1.7) * 0.35, crownY + (i % 2) * 0.35, Math.cos(i * 1.3) * 0.35);
    s.scale.y = 0.85;
    g.add(s);
  }
  return g;
}

export function makeRock(seed: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(0.35 + (seed % 5) * 0.08, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = 0.85 + (Math.sin(x * 8 + seed) + Math.cos(z * 7)) * 0.08;
    pos.setXYZ(i, x * n, y * n * 0.7, z * n);
  }
  geo.computeVertexNormals();
  return mesh(geo, pbrMat(rockTexture(), { roughness: 0.95, bump: 1.4 }));
}
