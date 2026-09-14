import * as THREE from 'three';
import { barkTexture, colorMat, fabricTexture, knitBeanieTexture, leatherTexture, metalTexture, pbrMat, rockTexture, skinTexture } from './Textures';

const skinCache = new Map<string, THREE.MeshStandardMaterial>();

function skin(hex: number): THREE.MeshStandardMaterial {
  let m = skinCache.get(String(hex));
  if (m) return m;
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  m = pbrMat(skinTexture([r, g, b], String(hex)), { roughness: 0.52, bump: 0.4 });
  skinCache.set(String(hex), m);
  return m;
}

function cloth(hex: number, name: string): THREE.MeshStandardMaterial {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return pbrMat(fabricTexture([r, g, b], name), { roughness: 0.9 });
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

function cap(r: number, len: number, mat: THREE.Material, segs = 10): THREE.Mesh {
  return mesh(new THREE.CapsuleGeometry(r, len, 6, segs), mat);
}

function sph(r: number, mat: THREE.Material, w = 16, h = 12): THREE.Mesh {
  return mesh(new THREE.SphereGeometry(r, w, h), mat);
}

export interface Humanoid {
  group: THREE.Group;
  head: THREE.Group;
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
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
  scale?: number;
}

export function makePerson(look: Look): Humanoid {
  const group = new THREE.Group();
  const musc = look.muscular ?? 1;
  const gob = !!look.goblin;
  const sMat = skin(look.skin);
  const shirt = cloth(look.shirt, `s${look.shirt}`);
  const pants = cloth(look.pants, `p${look.pants}`);
  const shoe = colorMat(look.shoes, { roughness: 0.7 });
  const hairM = colorMat(look.hair, { roughness: 0.55 });

  const torsoW = 0.2 * musc * (gob ? 0.95 : 1);
  const torsoH = 0.38;
  const headR = gob ? 0.17 : 0.132;

  const body = new THREE.Group();
  body.position.y = 0.95;
  const chest = cap(torsoW, torsoH, shirt, 14);
  chest.scale.z = 0.88;
  body.add(chest);
  if (look.cape) {
    const cape = mesh(
      new THREE.CylinderGeometry(torsoW * 1.15, torsoW * 1.55, 0.78, 10, 1, true, Math.PI * 0.65, Math.PI * 0.7),
      cloth(look.cape, `cape${look.cape}`),
    );
    cape.position.set(0, -0.06, 0.02);
    body.add(cape);
  }
  if (look.lanyard) {
    const strap = mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 16, Math.PI), colorMat(0x222222, { roughness: 0.4 }));
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0, 0.18, 0.04);
    body.add(strap);
    const badge = mesh(new THREE.BoxGeometry(0.07, 0.1, 0.012), colorMat(0x111111, { roughness: 0.3, metalness: 0.4 }));
    badge.position.set(0.02, 0.02, torsoW * 0.85);
    body.add(badge);
  }
  group.add(body);

  const head = new THREE.Group();
  head.position.y = 1.42 + (gob ? 0.04 : 0);
  const skull = sph(headR, sMat, 20, 16);
  skull.scale.set(0.92, 1.05, 0.95);
  head.add(skull);

  if (gob) {
    const nose = mesh(new THREE.ConeGeometry(0.045, 0.12, 8), sMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.01, headR * 0.85);
    head.add(nose);
    for (const side of [-1, 1]) {
      const ear = mesh(new THREE.SphereGeometry(0.07, 10, 8), sMat);
      ear.scale.set(0.45, 1.15, 0.55);
      ear.position.set(side * (headR + 0.02), 0.02, 0);
      ear.rotation.z = side * -0.5;
      head.add(ear);
    }
    const fangM = colorMat(0xf5f0e6, { roughness: 0.3 });
    for (const side of [-1, 1]) {
      const fang = mesh(new THREE.ConeGeometry(0.012, 0.045, 6), fangM);
      fang.position.set(side * 0.03, -0.07, headR * 0.7);
      fang.rotation.x = Math.PI;
      head.add(fang);
    }
    const brow = mesh(new THREE.BoxGeometry(0.16, 0.025, 0.04), hairM);
    brow.position.set(0, 0.05, headR * 0.7);
    brow.rotation.z = 0.15;
    head.add(brow);
  } else {
    const nose = mesh(new THREE.SphereGeometry(0.022, 8, 6), sMat);
    nose.scale.set(0.8, 1.1, 1.3);
    nose.position.set(0, -0.01, headR * 0.92);
    head.add(nose);
  }

  const eyeW = gob ? 0.028 : 0.022;
  const eyeZ = headR * (gob ? 0.78 : 0.88);
  for (const side of [-1, 1]) {
    const white = sph(eyeW, colorMat(0xf4f4f8, { roughness: 0.2 }), 10, 8);
    white.position.set(side * headR * 0.38, 0.02, eyeZ);
    head.add(white);
    const iris = sph(eyeW * 0.55, colorMat(gob ? 0x88ff44 : 0x2a1a12, { roughness: 0.25, emissive: gob ? 0x336600 : 0, emissiveIntensity: gob ? 0.4 : 0 }), 8, 6);
    iris.position.set(side * headR * 0.38, 0.02, eyeZ + eyeW * 0.55);
    head.add(iris);
  }

  const mouth = mesh(new THREE.BoxGeometry(gob ? 0.08 : 0.05, 0.012, 0.01), colorMat(0x7a3b3b, { roughness: 0.5 }));
  mouth.position.set(0, gob ? -0.055 : -0.05, headR * 0.85);
  head.add(mouth);

  if (look.beard) {
    const beard = mesh(new THREE.SphereGeometry(headR * 0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hairM);
    beard.position.set(0, -0.06, 0.02);
    beard.scale.set(1, 0.7, 0.85);
    head.add(beard);
  }

  if (look.elon) {
    const fringe = mesh(new THREE.SphereGeometry(headR * 0.92, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.35), hairM);
    fringe.position.y = 0.04;
    fringe.scale.set(1, 0.45, 1);
    head.add(fringe);
    const sides = mesh(new THREE.SphereGeometry(headR * 0.95, 12, 8, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4), hairM);
    sides.scale.set(1.02, 0.7, 0.9);
    head.add(sides);
  } else if (!look.beanie && !look.crown) {
    const hair = mesh(new THREE.SphereGeometry(headR * 1.06, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72), hairM);
    hair.position.y = 0.02;
    head.add(hair);
  } else if (look.crown) {
    const hair = mesh(new THREE.SphereGeometry(headR * 1.04, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
    hair.position.y = 0.02;
    head.add(hair);
  }

  if (look.glasses) {
    const frame = colorMat(0x111111, { roughness: 0.25, metalness: 0.35 });
    const glass = colorMat(0x88aacc, { roughness: 0.05, metalness: 0.1 });
    glass.transparent = true;
    glass.opacity = 0.22;
    for (const side of [-1, 1]) {
      const rim = mesh(new THREE.TorusGeometry(0.038, 0.006, 8, 16), frame);
      rim.position.set(side * 0.048, 0.02, eyeZ + 0.01);
      head.add(rim);
      const lens = mesh(new THREE.CircleGeometry(0.034, 16), glass);
      lens.position.set(side * 0.048, 0.02, eyeZ + 0.012);
      head.add(lens);
    }
    const bridge = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.03, 6), frame);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.02, eyeZ + 0.01);
    head.add(bridge);
  }

  if (look.beanie) {
    const knit = pbrMat(knitBeanieTexture(), { roughness: 1 });
    const hat = mesh(new THREE.SphereGeometry(headR * 1.12, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), knit);
    hat.position.y = 0.04;
    head.add(hat);
    const pom = sph(0.045, colorMat(0x1a1a1e, { roughness: 1 }), 10, 8);
    pom.position.y = headR + 0.08;
    head.add(pom);
    for (const side of [-1, 1]) {
      const flap = mesh(new THREE.SphereGeometry(0.055, 10, 8), knit);
      flap.scale.set(0.7, 1.2, 0.45);
      flap.position.set(side * (headR * 0.85), -0.04, 0);
      head.add(flap);
      const braid = cap(0.012, 0.22, knit, 6);
      braid.position.set(side * (headR * 0.9), -0.18, 0.02);
      head.add(braid);
    }
  }

  if (look.crown) {
    const gold = pbrMat(metalTexture(), { color: 0xffd24a, metalness: 0.85, roughness: 0.25, emissive: 0x553300, emissiveIntensity: 0.15 });
    const band = mesh(new THREE.CylinderGeometry(headR * 1.12, headR * 1.12, 0.06, 16, 1, true), gold);
    band.position.y = headR * 0.55;
    head.add(band);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.025, 0.1, 6), gold);
      spike.position.set(Math.sin(a) * headR * 1.05, headR * 0.7, Math.cos(a) * headR * 1.05);
      head.add(spike);
    }
    const gem = sph(0.028, colorMat(0xff2a4a, { roughness: 0.2, metalness: 0.3, emissive: 0xff1040, emissiveIntensity: 0.8 }), 10, 8);
    gem.position.set(0, headR * 0.55, headR * 1.12);
    head.add(gem);
  }

  group.add(head);

  const mkArm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * (torsoW + 0.08), 1.28, 0);
    const upper = cap(0.055 * musc, 0.26, shirt, 10);
    upper.position.y = -0.16;
    g.add(upper);
    const lower = cap(0.05 * musc, 0.24, sMat, 10);
    lower.position.y = -0.42;
    g.add(lower);
    const hand = sph(0.05 * musc, sMat, 10, 8);
    hand.position.y = -0.6;
    g.add(hand);
    return g;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  group.add(armL, armR);

  const mkLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.09 * musc, 0.72, 0);
    const thigh = cap(0.075 * musc, 0.3, pants, 10);
    thigh.position.y = -0.18;
    g.add(thigh);
    const calf = cap(0.058 * musc, 0.28, pants, 10);
    calf.position.y = -0.5;
    g.add(calf);
    const foot = mesh(new THREE.SphereGeometry(0.055, 10, 8), shoe);
    foot.scale.set(1, 0.55, 1.5);
    foot.position.set(0, -0.68, 0.03);
    g.add(foot);
    return g;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);
  group.add(legL, legR);

  if (look.cookie) armL.add(makeCookie());
  if (look.resume) {
    const paper = makeResume();
    paper.position.set(0, -0.6, 0.08);
    armR.add(paper);
  }
  if (look.laptop) {
    const lap = makeLaptop();
    lap.position.set(0, -0.55, 0.1);
    armL.add(lap);
  }
  if (look.popcorn) {
    const b = makePopcorn();
    b.position.set(0, -0.62, 0.05);
    armL.add(b);
  }

  const sc = look.scale ?? 1;
  group.scale.setScalar(sc);
  const height = 1.82 * sc;

  let attackT = -1;
  return {
    group,
    head,
    body,
    armL,
    armR,
    legL,
    legR,
    height,
    animate(t, speed) {
      const s = Math.sin(t * 9);
      const amp = 0.85 * speed;
      legL.rotation.x = s * amp;
      legR.rotation.x = -s * amp;
      armL.rotation.x = -s * amp * 0.85;
      if (attackT < 0) armR.rotation.x = s * amp * 0.85;
      const idle = Math.sin(t * 2.1) * 0.03;
      body.rotation.x = idle;
      head.rotation.y = Math.sin(t * 0.7) * 0.1 * (1 - speed);
      head.rotation.x = idle * 1.6;
    },
    setAttack(t01) {
      attackT = t01;
      if (t01 < 0) {
        armR.rotation.z = 0.08;
        return;
      }
      const swing = t01 < 0.32 ? -2.4 * (t01 / 0.32) : -2.4 + 2.7 * ((t01 - 0.32) / 0.68);
      armR.rotation.x = swing;
      armR.rotation.z = -0.25;
    },
  };
}

export function attachToHand(h: Humanoid, weapon: THREE.Object3D): void {
  weapon.position.set(0, -0.62, 0.04);
  weapon.rotation.x = Math.PI / 2;
  h.armR.add(weapon);
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
  g.position.set(0, -0.62, 0.06);
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
  const paper = mesh(new THREE.BoxGeometry(0.12, 0.16, 0.004), colorMat(0xf4f1e6, { roughness: 0.9 }));
  g.add(paper);
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
  const base = mesh(new THREE.BoxGeometry(0.18, 0.012, 0.12), colorMat(0x1c1c22, { roughness: 0.35, metalness: 0.4 }));
  g.add(base);
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
  const bucket = mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.12, 12), pbrMat(stripes, { roughness: 0.8 }));
  g.add(bucket);
  const top = mesh(new THREE.SphereGeometry(0.075, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), colorMat(0xf2dc9a, { roughness: 0.9 }));
  top.position.y = 0.06;
  g.add(top);
  return g;
}

export function makePhone(glow = 0x3cff7a): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.055, 0.11, 0.01), colorMat(0x1a1a1e, { roughness: 0.25, metalness: 0.5 }));
  g.add(body);
  const screen = mesh(new THREE.PlaneGeometry(0.046, 0.095), colorMat(glow, { emissive: glow, emissiveIntensity: 1.3, roughness: 0.2 }));
  screen.position.z = 0.006;
  g.add(screen);
  return g;
}

export const LOOKS = {
  nicolas: { skin: 0xd9a066, hair: 0x2a1d14, shirt: 0x1f3a6a, pants: 0x2b2b33, shoes: 0x1a1a22, cape: 0x142a52 } satisfies Look,
  matheus: { skin: 0xc98a5a, hair: 0x1e140c, shirt: 0x3a2a22, pants: 0x4a3226, shoes: 0xc62828, muscular: 1.22, cape: 0xb71c1c } satisfies Look,
  pedro: { skin: 0xd9a066, hair: 0x6b4423, shirt: 0xe8e8ee, pants: 0x2a2e36, shoes: 0x1a1a20, cape: 0xd4b24a } satisfies Look,
  elon: { skin: 0xe0b896, hair: 0x3a2a22, shirt: 0x111111, pants: 0x2a2a2a, shoes: 0x111111, elon: true } satisfies Look,
  deyvin: { skin: 0xc68642, hair: 0x1a1210, shirt: 0x1a1a22, pants: 0x2a2a30, shoes: 0x111111, beard: true, glasses: true, beanie: true, lanyard: true } satisfies Look,
  helio: { skin: 0x5a8a32, hair: 0x1a3010, shirt: 0x4a3020, pants: 0x3a2818, shoes: 0x2a1a10, goblin: true, muscular: 0.95 } satisfies Look,
  boss: { skin: 0xd9a066, hair: 0x2a1d14, shirt: 0xb3202a, pants: 0x3a1a1a, shoes: 0x1a1010, crown: true, cape: 0x7a0f18, popcorn: true, muscular: 1.25 } satisfies Look,
  banhos: { skin: 0xdeba8c, hair: 0x3a2818, shirt: 0x2a6a4a, pants: 0x3a3a44, shoes: 0x22222a, cookie: true, resume: true } satisfies Look,
  almeida: { skin: 0xc68642, hair: 0x1a1210, shirt: 0x2a4060, pants: 0x2b2b33, shoes: 0x22222a, muscular: 1.18, laptop: true } satisfies Look,
  anderson: { skin: 0xd9a066, hair: 0x2a1d14, shirt: 0x3a3a48, pants: 0x2b2b33, shoes: 0x22222a } satisfies Look,
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
    const n = 0.85 + ((Math.sin(x * 8 + seed) + Math.cos(z * 7)) * 0.08);
    pos.setXYZ(i, x * n, y * n * 0.7, z * n);
  }
  geo.computeVertexNormals();
  const m = mesh(geo, pbrMat(rockTexture(), { roughness: 0.95, bump: 1.4 }));
  return m;
}
