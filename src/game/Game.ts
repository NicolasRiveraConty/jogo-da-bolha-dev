import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Sfx } from '../audio/Sfx';
import type { Hud } from '../ui/Hud';
import { LOOKS, makePerson } from './Characters';
import { enemyDamageMul, levelForXp, meleeDamageMul, NPCS, TALKS, XP_TABLE, type HeroDef, type MobKind, type TalkOption } from './Data';
import { FloatingText, Particles, Projectiles, type Projectile } from './Effects';
import { Mob } from './Mobs';
import { Player } from './Player';
import { World } from './World';

const SUN_DIR = new THREE.Vector3(0.48, 0.72, 0.38).normalize();
const SKY_ZENITH = new THREE.Color(0x4a86c8);
const SKY_HORIZON = new THREE.Color(0xf3c38a);
const FOG_COLOR = new THREE.Color(0xd9b48a);

type Phase = 'menu' | 'playing' | 'dead' | 'victory';

interface NpcActor {
  id: 'banhos' | 'almeida' | 'anderson';
  used: number;
  model: ReturnType<typeof makePerson>;
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly world = new World();
  quality: 'high' | 'medium' = 'high';

  private sun!: THREE.DirectionalLight;
  private sky!: THREE.Mesh;
  private clouds: THREE.Group[] = [];
  private beam!: THREE.Mesh;
  private beamLight!: THREE.PointLight;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private ssao: SSAOPass | null = null;

  private particles = new Particles(this.world);
  private projectiles = new Projectiles(this.world);
  private texts = new FloatingText();

  player: Player | null = null;
  hero: HeroDef | null = null;
  mobs: Mob[] = [];
  helio: Mob | null = null;
  elio: Mob | null = null;
  boss: Mob | null = null;
  deyvin: Mob | null = null;
  elon: Mob | null = null;
  pedro: Mob | null = null;
  private npcs: NpcActor[] = [];

  phase: Phase = 'menu';
  locked = false;
  talking = false;
  private talkStep: 'choose' | 'reply' = 'choose';
  private talkOptions: TalkOption[] | null = null;
  private talkNpc: NpcActor | null = null;
  private timer = new THREE.Timer();
  private time = 0;
  private playTime = 0;

  hp = 100;
  maxHp = 100;
  xp = 0;
  level = 1;
  kills = 0;
  coins = 0;
  cookies = 0;
  xpGain = 1;
  upgrades = 0;
  private cds = [0, 0, 0];
  private attackCd = 0;
  private buffT = 0;
  private regenT = 0;
  private stepT = 0;
  private shake = 0;
  objective = 0;
  private objectiveT = 0;
  private bossPhaseFlags = { helioRage: false };
  private bossFight = { round: 1, shift: 0, ringT: 0, popcornT: 0 };
  private lastHp = -1;
  private lastXp = -1;
  private worldReady = false;
  curriculum = false;

  constructor(
    private hud: Hud,
    container: HTMLElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 420);
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(FOG_COLOR, 48, 160);
    this.scene.background = FOG_COLOR;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

    this.setupLights();
    this.setupSky();
    this.setupComposer();
    this.scene.add(this.world.group, this.particles.group, this.projectiles.group, this.texts.group);
    this.bindEvents();

    window.addEventListener('resize', () => this.onResize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.bloom.setSize(window.innerWidth, window.innerHeight);
  }

  setQuality(q: 'high' | 'medium'): void {
    this.quality = q;
    const high = q === 'high';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.5 : 1));
    this.sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    this.bloom.strength = high ? 0.2 : 0.12;
    if (this.ssao) this.ssao.enabled = high;
    this.hud.toast(high ? 'Qualidade: Alta' : 'Qualidade: Média');
  }

  private setupComposer(): void {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    try {
      this.ssao = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
      this.ssao.kernelRadius = 8;
      this.ssao.minDistance = 0.001;
      this.ssao.maxDistance = 0.08;
      this.composer.addPass(this.ssao);
    } catch {
      this.ssao = null;
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.4, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  private setupLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xb7d4f5, 0x6b4a2b, 0.9));
    this.sun = new THREE.DirectionalLight(0xffe1b0, 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = 42;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);

    const beamGeo = new THREE.CylinderGeometry(0.18, 0.55, 70, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffe082,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    this.beamLight = new THREE.PointLight(0xffd54f, 10, 16, 1.7);
    this.scene.add(this.beam, this.beamLight);
  }

  private setupSky(): void {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        zenith: { value: SKY_ZENITH },
        horizon: { value: SKY_HORIZON },
        ground: { value: FOG_COLOR.clone().multiplyScalar(0.75) },
        sunDir: { value: SUN_DIR },
        sunColor: { value: new THREE.Color(0xfff3c4) },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 zenith,horizon,ground,sunDir,sunColor; varying vec3 vDir;
        void main(){ vec3 d=normalize(vDir); float h=d.y;
          vec3 col=h>=0.0?mix(horizon,zenith,pow(h,0.5)):mix(horizon,ground,clamp(-h*5.0,0.0,1.0));
          float s=max(dot(d,sunDir),0.0);
          col+=sunColor*(pow(s,700.0)*4.0+pow(s,10.0)*0.45+pow(s,2.0)*0.12);
          gl_FragColor=vec4(col,1.0); }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), mat);
    this.scene.add(this.sky);

    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xfff7ee, roughness: 1, transparent: true, opacity: 0.88 });
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(2.2 + Math.random() * 2.4, 10, 8), cloudMat);
        s.position.set((Math.random() - 0.5) * 8, Math.random() * 1.2, (Math.random() - 0.5) * 5);
        s.scale.y = 0.45;
        s.castShadow = true;
        g.add(s);
      }
      g.position.set(Math.random() * 200 - 20, 38 + Math.random() * 8, Math.random() * 200 - 20);
      this.clouds.push(g);
      this.scene.add(g);
    }
  }

  async buildWorld(): Promise<void> {
    const tick = () => new Promise<void>((r) => setTimeout(r, 0));
    this.hud.setLoading(0);
    await tick();
    this.world.generate((p) => this.hud.setLoading(p));
    await tick();
    this.worldReady = true;
    this.hud.setLoading(null);
    const s = this.world.spawn;
    this.camera.position.set(s.x - 10, s.y + 6, s.z + 12);
    this.camera.lookAt(s.x, s.y + 1, s.z);
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.phase === 'playing') {
        if (this.talking) {
          this.hud.showScreen(null);
          return;
        }
        this.hud.showScreen(this.locked ? null : 'pause');
        if (this.locked) this.player?.keys.clear();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked && this.player) this.player.look(e.movementX, e.movementY);
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.locked || this.phase !== 'playing') return;
      if (e.button === 0) this.attack();
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
      if (this.phase !== 'playing' || !this.player) return;
      if (e.code === 'KeyM') {
        this.hud.toast(Sfx.toggleMute() ? 'Som desligado' : 'Som ligado');
        return;
      }
      if (this.talking) {
        if (this.talkStep === 'choose') {
          if (e.code === 'Digit1' || e.code === 'Numpad1') this.pickTalk(0);
          if (e.code === 'Digit2' || e.code === 'Numpad2') this.pickTalk(1);
          if (e.code === 'Digit3' || e.code === 'Numpad3') this.pickTalk(2);
        }
        if (e.code === 'Escape' || (e.code === 'KeyE' && this.talkStep === 'reply')) this.closeTalk();
        e.preventDefault();
        return;
      }
      if (!this.locked) return;
      if (e.code === 'Digit1' || e.code === 'Numpad1') this.cast(0);
      if (e.code === 'Digit2' || e.code === 'Numpad2') this.cast(1);
      if (e.code === 'Digit3' || e.code === 'Numpad3') this.cast(2);
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyC') this.eatCookie();
      if (e.code === 'Space') e.preventDefault();
      this.player.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.player?.keys.delete(e.code));
    window.addEventListener('blur', () => this.player?.keys.clear());
    document.getElementById('dialogue-close')?.addEventListener('click', () => this.closeTalk());
  }

  requestLock(): void {
    const canvas = this.renderer.domElement;
    try {
      const p = canvas.requestPointerLock({ unadjustedMovement: true } as PointerLockOptions) as unknown;
      if (p instanceof Promise) p.catch(() => canvas.requestPointerLock());
    } catch {
      canvas.requestPointerLock();
    }
  }

  start(hero: HeroDef): void {
    if (!this.worldReady) return;
    this.reset();
    this.hero = hero;
    this.player = new Player(this.camera, this.world, hero);
    this.scene.add(this.player.model.group);
    const s = this.world.spawn;
    this.player.teleport(s.x + 0.5, s.y, s.z + 0.5);
    this.player.yaw = Math.atan2(-(this.world.tower.x - s.x), -(this.world.tower.z - s.z));
    this.level = 1;
    this.xp = 0;
    this.kills = 0;
    this.coins = 0;
    this.cookies = 0;
    this.xpGain = 1;
    this.upgrades = 0;
    this.curriculum = false;
    this.applyLevelStats();
    this.hp = this.maxHp;
    this.hud.setHero(hero);
    this.hud.setKills(0);
    this.hud.setCoins(0);
    this.hud.setCookies(0);
    this.hud.setHudVisible(true);
    this.hud.showScreen(null);
    this.spawnBosses();
    this.spawnNpcs();
    this.setObjective(0);
    this.phase = 'playing';
    this.playTime = 0;
    Sfx.playMusic('map');
    this.hud.toast(`Bem-vindo, ${hero.name}! Dificuldade 8. Siga a luz até o Café do ManoDeyvin.`, true);
    this.requestLock();
  }

  private reset(): void {
    for (const m of this.mobs) this.scene.remove(m.group);
    this.mobs = [];
    this.helio = this.elio = this.boss = this.deyvin = this.elon = this.pedro = null;
    for (const n of this.npcs) this.scene.remove(n.model.group);
    this.npcs = [];
    if (this.player) {
      this.scene.remove(this.player.model.group);
      this.player = null;
    }
    for (const p of [...this.projectiles.list]) this.projectiles.remove(p);
    this.bossPhaseFlags = { helioRage: false };
    this.bossFight = { round: 1, shift: 0, ringT: 0, popcornT: 0 };
    this.cds = [0, 0, 0];
    this.lastHp = this.lastXp = -1;
    this.hud.setBoss(null);
    this.hud.hideTalk();
    this.talking = false;
    this.talkOptions = null;
    this.talkNpc = null;
    this.world.resetGate();
  }

  quitToTitle(): void {
    this.phase = 'menu';
    this.reset();
    this.hud.setHudVisible(false);
    this.hud.showScreen('title');
    Sfx.playMusic('title');
    if (document.pointerLockElement) document.exitPointerLock();
    const s = this.world.spawn;
    this.camera.position.set(s.x - 10, s.y + 6, s.z + 12);
    this.camera.lookAt(s.x, s.y + 1, s.z);
  }

  respawn(): void {
    if (!this.player) return;
    const s = this.world.spawn;
    this.player.teleport(s.x + 0.5, s.y, s.z + 0.5);
    this.hp = this.maxHp;
    for (const m of [...this.mobs]) if (!m.isBoss) this.removeMob(m);
    for (const b of this.bigEnemies()) {
      if (b && !b.dead) {
        b.pos.copy(b.home);
        b.state = 'idle';
        b.hp = Math.max(b.hp, Math.round(b.maxHp * 0.6));
      }
    }
    this.phase = 'playing';
    this.hud.showScreen(null);
    Sfx.playMusic('map');
    this.requestLock();
  }

  private spawnNpcs(): void {
    const map = { banhos: LOOKS.banhos, almeida: LOOKS.almeida, anderson: LOOKS.anderson } as const;
    for (const def of NPCS) {
      const spot = this.world.npcSpots[def.id];
      const model = makePerson(map[def.id]);
      model.group.position.set(spot.x, this.world.heightAt(spot.x, spot.z), spot.z);
      const fire = this.world.npcSpots.banhos.clone().add(this.world.npcSpots.almeida).add(this.world.npcSpots.anderson).multiplyScalar(1 / 3);
      model.group.rotation.y = Math.atan2(fire.x - spot.x, fire.z - spot.z);
      this.scene.add(model.group);
      this.npcs.push({ id: def.id, used: 0, model });
    }
  }

  private spawnBosses(): void {
    const place = (kind: MobKind, x: number, z: number, yaw: number, leash: number) => {
      const m = new Mob(kind, x, this.world.surfaceY(x, z), z);
      m.leash = leash;
      m.yaw = yaw;
      this.addMob(m);
      return m;
    };
    const d = this.world.bossSpots.deyvin;
    const e = this.world.bossSpots.elon;
    const p = this.world.bossSpots.pedro;
    this.deyvin = place('deyvin', d.x, d.z, Math.PI, 18);
    this.elon = place('elon', e.x, e.z, Math.PI, 18);
    this.pedro = place('pedro', p.x, p.z, Math.PI, 18);
    const t = this.world.tower;
    this.helio = place('helio', t.x - 7, t.z + 0.5, -Math.PI / 2, 22);
    this.elio = this.helio;
    const th = this.world.throne;
    this.boss = place('boss', th.x - 3, th.z, -Math.PI / 2, 22);
  }

  private bigEnemies(): (Mob | null)[] {
    return [this.deyvin, this.elon, this.pedro, this.helio, this.boss];
  }

  addMob(m: Mob): void {
    this.mobs.push(m);
    this.scene.add(m.group);
  }

  private removeMob(m: Mob): void {
    const i = this.mobs.indexOf(m);
    if (i >= 0) this.mobs.splice(i, 1);
    this.scene.remove(m.group);
  }

  private setObjective(stage: number): void {
    this.objective = stage;
    const beamMat = this.beam.material as THREE.MeshBasicMaterial;
    const aim = (x: number, y: number, z: number, color: number, light: number) => {
      this.beam.position.set(x, y + 36, z);
      this.beamLight.position.set(x, y + 3, z);
      beamMat.color.setHex(color);
      this.beamLight.color.setHex(light);
      this.beam.visible = this.beamLight.visible = true;
    };
    if (stage === 0) {
      const s = this.world.bossSpots.deyvin;
      aim(s.x, s.y, s.z, 0xffcc80, 0xffa726);
    } else if (stage === 1) {
      const s = this.world.bossSpots.elon;
      aim(s.x, s.y, s.z, 0xe8eaf0, 0xffffff);
    } else if (stage === 2) {
      const s = this.world.bossSpots.pedro;
      aim(s.x, s.y, s.z, 0xffe082, 0xffd54f);
    } else if (stage === 3) {
      const t = this.world.tower;
      aim(t.x - 7, t.y, t.z, 0xb9f6ca, 0x69f0ae);
    } else if (stage === 4) {
      const g = this.world.castleGate;
      aim(g.x - 2, g.y, g.z, 0xff5c6c, 0xff3d5a);
    } else {
      this.beam.visible = this.beamLight.visible = false;
    }
    this.updateObjectiveText();
  }

  private updateObjectiveText(): void {
    if (!this.player) return;
    const p = this.player.pos;
    const distTo = (x: number, z: number) => Math.round(Math.hypot(x - p.x, z - p.z));
    if (this.objective === 0) {
      const s = this.world.bossSpots.deyvin;
      this.hud.setObjective(`Vá ao Café do ManoDeyvin (luz laranja) — ${distTo(s.x, s.z)}m. Fale com o acampamento no caminho.`);
    } else if (this.objective === 1) {
      const s = this.world.bossSpots.elon;
      this.hud.setObjective(`Vá à plataforma do Elon Musk (luz branca) — ${distTo(s.x, s.z)}m.`);
    } else if (this.objective === 2) {
      const s = this.world.bossSpots.pedro;
      this.hud.setObjective(`Vá à sede da Conty e derrote Pedro (luz dourada) — ${distTo(s.x, s.z)}m.`);
    } else if (this.objective === 3) {
      const t = this.world.tower;
      this.hud.setObjective(`Vá à torre do HELIO (luz verde) — ${distTo(t.x - 7, t.z)}m.`);
    } else if (this.objective === 4) {
      const g = this.world.castleGate;
      this.hud.setObjective(`O portão se abriu. Entre no castelo (luz vermelha) — ${distTo(g.x, g.z)}m. REAL OFICIAL: 3 rounds.`);
    } else this.hud.setObjective('O REAL OFICIAL caiu. A internet está salva.');
  }

  private syncObjectiveFromKills(): void {
    const order = this.bigEnemies();
    const next = order.findIndex((b) => b && !b.dead);
    const stage = next < 0 ? 5 : next;
    if (stage !== this.objective) this.setObjective(stage);
  }

  private applyLevelStats(): void {
    if (!this.hero) return;
    this.maxHp = Math.round(this.hero.hp * (1 + 0.1 * (this.level - 1)));
  }

  private get damage(): number {
    if (!this.hero || !this.player) return 0;
    return this.hero.damage * (1 + 0.08 * (this.level - 1)) * (1 + this.upgrades * 0.08) * this.player.dmgMul;
  }

  private gainXp(amount: number): void {
    this.xp += Math.round(amount * this.xpGain);
    const newLevel = levelForXp(this.xp);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.applyLevelStats();
      this.hp = this.maxHp;
      Sfx.levelUp();
      this.hud.toast(`NÍVEL ${this.level}!`, true);
      if (this.player) this.particles.ring(this.player.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 0x66bb6a, 2.4);
    }
  }

  private attack(): void {
    if (!this.player || this.attackCd > 0 || !this.hero) return;
    if (!this.player.swing()) return;
    this.attackCd = this.hero.attackCooldown;
    if (!this.meleeHit(3.4, 0.42, this.damage * meleeDamageMul(), 7, true)) Sfx.miss();
  }

  special(): void {
    this.cast(0);
  }

  cast(i: number): void {
    if (!this.player || !this.hero || this.cds[i] > 0) return;
    const sk = this.hero.skills[i];
    const origin = this.player.pos.clone().add(new THREE.Vector3(0, 0.4, 0));
    let ok = true;
    if (sk.kind === 'tweet') {
      this.particles.ring(origin, 0x4fc3f7, 5.2, 28);
      Sfx.magic();
      for (const m of [...this.mobs]) if (!m.dead && m.pos.distanceTo(this.player.pos) < 6) this.hurtMob(m, this.damage * 1.7, 8, true);
      this.texts.say(this.player.eyePos, 'isso vai viralizar', '#4fc3f7');
    } else if (sk.kind === 'heal') {
      if (this.hp >= this.maxHp) {
        this.hud.toast('HP já está cheio.');
        return;
      }
      const amount = Math.round(this.maxHp * 0.38);
      this.hp = Math.min(this.maxHp, this.hp + amount);
      Sfx.heal();
      this.texts.heal(this.player.eyePos, amount);
      this.particles.burst(origin.clone().add(new THREE.Vector3(0, 1, 0)), 0x66bb6a, 18, 2.4, 0.1, 0.9, 2);
    } else if (sk.kind === 'taunt') {
      const t = this.nearestEnemy(8);
      if (!t) {
        this.hud.toast('Ninguém perto pra lembrar do começo.');
        return;
      }
      t.stunned = 2.4;
      t.weak = 6;
      t.takeDamage(Math.round(this.damage * 0.6), this.player.pos, 2);
      this.texts.say(t.center.add(new THREE.Vector3(0, 1.1, 0)), 'isso lembra o meu começo', '#ffd54f');
      this.hud.toast('Lembrar do começo: o alvo ficou ofendido e fraco.', true);
      Sfx.stun();
    } else if (sk.kind === 'buff') {
      this.player.dmgMul = 1.45;
      this.player.speedMul = 1.28;
      this.buffT = 8;
      this.particles.ring(origin, 0xef5350, 2.2, 18);
      Sfx.buff();
      this.hud.toast('Treino: pump ativado!');
    } else if (sk.kind === 'diet') {
      const amount = Math.round(this.maxHp * 0.32);
      this.hp = Math.min(this.maxHp, this.hp + amount);
      this.regenT = 6;
      Sfx.heal();
      this.texts.heal(this.player.eyePos, amount);
      this.hud.toast('Dieta: recuperação + regeneração');
    } else if (sk.kind === 'reel') {
      this.particles.ring(origin, 0xff3d7a, 5, 36);
      this.particles.burst(origin, 0xff8a80, 22, 5, 0.16, 0.7);
      this.shake = 0.38;
      Sfx.bossRoar();
      for (const m of [...this.mobs]) if (!m.dead && m.pos.distanceTo(this.player.pos) < 5.4) this.hurtMob(m, this.damage * 2.1, 14, true);
    }
    if (ok) {
      this.cds[i] = sk.cooldown;
      if (this.hero.id === 'matheus') {
        const lines = ['Faça sua dieta.', 'Eu sou o Matheus do Fitfólio.', 'Baixa o EP agora.'];
        this.texts.say(this.player.eyePos, lines[i % lines.length], '#ef5350');
        this.hud.toast('Faça sua dieta. Eu sou o Matheus do Fitfólio. Baixa o EP agora.');
      } else if (sk.kind !== 'heal' && sk.kind !== 'diet' && sk.kind !== 'buff' && sk.kind !== 'taunt') this.hud.toast(sk.name);
    }
  }

  private nearestEnemy(range: number): Mob | null {
    if (!this.player) return null;
    let best: Mob | null = null;
    let bd = range;
    const fwd = this.player.forwardFlat;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const to = m.pos.clone().sub(this.player.pos);
      to.y = 0;
      const d = to.length();
      if (d > range) continue;
      if (d > 1.2 && to.normalize().dot(fwd) < 0.15) continue;
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  private meleeHit(range: number, minDot: number, dmg: number, knock: number, single: boolean, crit = false): boolean {
    if (!this.player) return false;
    const eye = this.player.eyePos;
    const fwd = this.player.forward;
    const candidates: { m: Mob; d: number }[] = [];
    for (const m of this.mobs) {
      if (m.dead) continue;
      const to = m.center.clone().sub(eye);
      const d = to.length() - m.radius;
      if (d > range) continue;
      to.normalize();
      if (to.dot(fwd) < minDot && d > 0.9) continue;
      candidates.push({ m, d });
    }
    if (!candidates.length) return false;
    candidates.sort((a, b) => a.d - b.d);
    for (const { m } of single ? [candidates[0]] : candidates) this.hurtMob(m, dmg, knock, crit);
    return true;
  }

  hurtMob(m: Mob, dmg: number, knock: number, crit = false): void {
    if (!this.player || m.dead) return;
    const amount = Math.round(dmg * (0.85 + Math.random() * 0.3));
    m.takeDamage(amount, this.player.pos, knock);
    this.texts.damage(m.center, amount, crit);
    this.particles.burst(m.center, crit ? 0xffd54f : 0xffffff, crit ? 14 : 7, 3, 0.08, 0.5);
    crit ? Sfx.crit() : Sfx.hit();
    if (m.state === 'idle' || m.state === 'wander') {
      m.state = 'chase';
      this.mobSay(m);
    }
    if (m.dead) this.killMob(m);
  }

  private eatCookie(): void {
    if (this.cookies <= 0) {
      this.hud.toast('Sem cookies. Fale com o Banhos.');
      return;
    }
    if (this.hp >= this.maxHp) {
      this.hud.toast('HP cheio.');
      return;
    }
    this.cookies--;
    const amount = Math.round(this.maxHp * 0.22);
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.hud.setCookies(this.cookies);
    Sfx.heal();
    this.texts.heal(this.player!.eyePos, amount);
    this.hud.toast('Cookie do Banhos: +HP');
  }

  interact(): void {
    if (!this.player || this.talking) return;
    let best: NpcActor | null = null;
    let bd = 2.6;
    for (const n of this.npcs) {
      const d = n.model.group.position.distanceTo(this.player.pos);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    if (!best) return;
    const def = NPCS.find((n) => n.id === best!.id)!;
    if (best.id === 'almeida') {
      const cost = 30 + this.upgrades * 15;
      if (this.upgrades >= 4) this.hud.toast('Arma no talo. Tá lindo.');
      else if (this.coins < cost) this.hud.toast(`Almeida: preciso de ${cost} moedas. Você tem ${this.coins}.`);
      else {
        this.coins -= cost;
        this.upgrades++;
        this.hud.setCoins(this.coins);
        Sfx.buff();
        this.hud.toast(`Upgrade ${this.upgrades}/4: arma mais forte.`, true);
      }
      this.texts.say(best.model.group.position.clone().add(new THREE.Vector3(0, 2.1, 0)), def.greet.split('!')[0] + '!', '#cfe8ff');
      return;
    }
    this.openTalk(best);
  }

  private openTalk(npc: NpcActor): void {
    const def = NPCS.find((n) => n.id === npc.id)!;
    const options = TALKS[npc.id as 'anderson' | 'banhos'];
    if (!options) return;
    this.talking = true;
    this.talkStep = 'choose';
    this.talkOptions = options;
    this.talkNpc = npc;
    this.player?.keys.clear();
    this.hud.setPrompt('');
    this.hud.showScreen(null);
    if (document.pointerLockElement) document.exitPointerLock();
    if (npc.id === 'anderson') {
      this.hp = this.maxHp;
      this.cds = [0, 0, 0];
      Sfx.heal();
    } else Sfx.select();
    this.texts.say(npc.model.group.position.clone().add(new THREE.Vector3(0, 2.1, 0)), def.greet.split('!')[0] + '!', '#cfe8ff');
    this.hud.showTalk(
      def.name,
      def.title,
      def.greet,
      options.map((o) => o.label),
      (i) => this.pickTalk(i),
    );
  }

  private pickTalk(i: number): void {
    if (!this.talking || this.talkStep !== 'choose' || !this.talkOptions || !this.talkNpc) return;
    const option = this.talkOptions[i];
    if (!option) return;
    this.applyTalkEffect(option.effect);
    const short = option.reply.split(/[.!?]/)[0] + '.';
    this.texts.say(this.talkNpc.model.group.position.clone().add(new THREE.Vector3(0, 2.2, 0)), option.ask ?? short, '#cfe8ff');
    Sfx.select();
    if (option.followUp?.length) {
      this.talkOptions = option.followUp;
      this.talkStep = 'choose';
      this.hud.showTalkReply(option.reply, {
        ask: option.ask,
        options: option.followUp.map((o) => o.label),
        onPick: (j) => this.pickTalk(j),
      });
      return;
    }
    this.talkStep = 'reply';
    this.hud.showTalkReply(option.reply);
  }

  private applyTalkEffect(effect: TalkOption['effect']): void {
    if (effect === 'cookie') {
      this.cookies += 3;
      this.hud.setCookies(this.cookies);
      Sfx.coin();
      this.hud.toast('Cookie do Banhos na mochila. Aperte C para comer.');
    } else if (effect === 'resume') {
      if (!this.curriculum) {
        this.curriculum = true;
        this.xpGain = 1.25;
        this.gainXp(40);
        this.hud.toast('Currículo turbo: +25% XP.', true);
      } else this.hud.toast('Esse currículo já está na mão.');
      Sfx.coin();
    } else if (effect === 'hotfix') {
      this.hp = this.maxHp;
      this.cds = [0, 0, 0];
      Sfx.heal();
    }
  }

  closeTalk(): void {
    if (!this.talking) {
      this.hud.hideTalk();
      return;
    }
    this.talking = false;
    this.talkOptions = null;
    this.talkNpc = null;
    this.hud.hideTalk();
    this.player?.keys.clear();
    if (this.phase === 'playing') this.requestLock();
  }

  damagePlayer(amount: number, from: THREE.Vector3 | null): void {
    if (!this.player || !this.hero || this.phase !== 'playing') return;
    const dmg = Math.max(1, Math.round(amount * (1 - this.hero.armor) * enemyDamageMul() * (0.9 + Math.random() * 0.2)));
    this.hp -= dmg;
    this.hud.hit();
    this.shake = Math.max(this.shake, 0.16);
    Sfx.hit();
    if (from) {
      const push = this.player.pos.clone().sub(from);
      push.y = 0;
      push.normalize().multiplyScalar(3.6);
      this.player.vel.add(push);
      this.player.vel.y = Math.max(this.player.vel.y, 2.2);
    }
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    this.talking = false;
    this.hud.hideTalk();
    this.phase = 'dead';
    this.hp = 0;
    Sfx.stopMusic();
    Sfx.defeat();
    this.hud.setDeadText('Você virou corte. Acorda no acampamento — Banhos ainda tem cookie.');
    setTimeout(() => {
      this.hud.showScreen('dead');
      if (document.pointerLockElement) document.exitPointerLock();
    }, 800);
  }

  private killMob(m: Mob): void {
    this.removeMob(m);
    this.kills++;
    this.coins += m.def.coins;
    this.hud.setKills(this.kills);
    this.hud.setCoins(this.coins);
    const color = m.def.kind === 'helio' ? 0x7cff4a : m.def.kind === 'boss' ? 0xff3d5a : m.def.kind === 'elon' ? 0xffffff : m.def.kind === 'pedro' ? 0xffd54f : 0xffa726;
    this.particles.burst(m.center, color, m.isBoss ? 55 : 16, m.isBoss ? 7 : 4, m.isBoss ? 0.2 : 0.1, 1.1);
    this.gainXp(m.def.xp);
    Sfx.coin();
    if (m === this.helio) {
      this.hud.toast('HELIO DERROTADO! O portão dourado se abre.', true);
      this.world.openGate();
      Sfx.victory();
    }
    if (m === this.boss) this.win();
    else this.syncObjectiveFromKills();
  }

  private win(): void {
    this.phase = 'victory';
    this.setObjective(5);
    this.hud.setBoss(null);
    Sfx.stopMusic();
    Sfx.victory();
    this.hud.toast('REAL OFICIAL DESTRUÍDO!', true);
    const mins = Math.floor(this.playTime / 60);
    const secs = Math.floor(this.playTime % 60);
    this.hud.setVictoryText(
      `${this.hero?.name} derrubou o REAL OFICIAL em ${mins}m${String(secs).padStart(2, '0')}s · ${this.kills} inimigos · nível ${this.level}. A pipoca esfriou.`,
    );
    setTimeout(() => {
      Sfx.playMusic('victory');
      this.hud.showScreen('victory');
      if (document.pointerLockElement) document.exitPointerLock();
    }, 2600);
  }

  private mobSay(m: Mob): void {
    if (m.sayCd > 0) return;
    m.sayCd = m.isBoss ? 1.35 + Math.random() * 1.1 : 5 + Math.random() * 5;
    const line = m.def.lines[Math.floor(Math.random() * m.def.lines.length)];
    const color = m.def.kind === 'boss' ? '#ff5c6c' : m.def.kind === 'helio' ? '#9cff57' : m.def.kind === 'elon' ? '#f5f5f5' : m.def.kind === 'pedro' ? '#ffd54f' : '#ffcc80';
    this.texts.say(m.center.add(new THREE.Vector3(0, m.model.height * 0.55, 0)), line, color);
  }

  private frame(): void {
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    this.time += dt;
    this.hud.update(dt);
    if (this.phase === 'menu') {
      if (this.worldReady) {
        const s = this.world.spawn;
        const a = this.time * 0.07;
        this.camera.position.set(s.x + Math.cos(a) * 16, s.y + 5.5, s.z + Math.sin(a) * 16);
        this.camera.lookAt(s.x, s.y + 1.2, s.z);
      }
    } else if (this.player) {
      if (this.talking) {
        this.player.keys.clear();
        this.update(dt);
      } else if (this.locked || this.phase !== 'playing') this.update(dt);
      else this.player.update(0);
    }
    this.updateEnvironment(dt);
    this.composer.render();
  }

  private updateEnvironment(dt: number): void {
    this.sky.position.copy(this.camera.position);
    for (const c of this.clouds) {
      c.position.x += dt * 0.7;
      if (c.position.x > this.world.sizeX + 20) c.position.x = -20;
    }
    const focus = this.player ? this.player.pos : this.camera.position;
    this.sun.target.position.set(Math.round(focus.x), 10, Math.round(focus.z));
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIR, 90);
    const dBeam = Math.hypot(this.beam.position.x - focus.x, this.beam.position.z - focus.z);
    const near = THREE.MathUtils.clamp((dBeam - 5) / 12, 0, 1);
    (this.beam.material as THREE.MeshBasicMaterial).opacity = (0.22 + Math.sin(this.time * 2.5) * 0.06) * near;
    this.beamLight.intensity = 8 * near;
    this.world.update(dt, this.time);
    this.particles.update(dt);
    this.texts.update(dt);
    for (const n of this.npcs) {
      n.model.animate(this.time, 0);
      if (this.player && n.model.group.position.distanceTo(this.player.pos) < 5) {
        const dx = this.player.pos.x - n.model.group.position.x;
        const dz = this.player.pos.z - n.model.group.position.z;
        n.model.group.rotation.y = Math.atan2(dx, dz);
      }
    }
  }

  private update(dt: number): void {
    const player = this.player!;
    if (this.phase === 'playing') this.playTime += dt;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.cds = this.cds.map((c) => Math.max(0, c - dt));
    this.buffT = Math.max(0, this.buffT - dt);
    this.regenT = Math.max(0, this.regenT - dt);
    if (this.buffT <= 0) {
      player.dmgMul = 1;
      player.speedMul = 1;
    }
    if (this.regenT > 0) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.04 * dt);

    const alive = this.phase === 'playing';
    if (!alive) player.keys.clear();
    player.update(dt);

    const speed = Math.hypot(player.vel.x, player.vel.z);
    if (player.onGround && speed > 1) {
      this.stepT += dt * speed;
      if (this.stepT > 2.8) {
        this.stepT = 0;
        Sfx.step();
      }
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const k = this.shake * 0.22;
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, 0));
    }

    if (alive) {
      this.updateMobs(dt);
      this.updatePrompt();
    }
    this.updateProjectiles(dt);

    if (this.hp !== this.lastHp) {
      this.hud.setHealth(this.hp, this.maxHp);
      this.lastHp = this.hp;
    }
    if (this.xp !== this.lastXp) {
      const prev = XP_TABLE[this.level - 1] ?? 0;
      const next = XP_TABLE[this.level] ?? prev;
      this.hud.setXp(this.xp, next, prev, this.level);
      this.lastXp = this.xp;
    }
    if (this.hero) this.hud.setCooldowns(this.cds.map((c, i) => c / this.hero!.skills[i].cooldown) as [number, number, number]);
    this.objectiveT += dt;
    if (this.objectiveT > 0.45) {
      this.objectiveT = 0;
      this.updateObjectiveText();
    }
    const activeBoss = this.bigEnemies().find((b) => b && !b.dead && b.state === 'chase');
    if (activeBoss) {
      const round = activeBoss === this.boss ? ` — ROUND ${this.bossFight.round}/3` : '';
      this.hud.setBoss(activeBoss.def.name + round, activeBoss.hp / activeBoss.maxHp);
      if (alive) Sfx.playMusic('boss');
    } else {
      this.hud.setBoss(null);
      if (alive) Sfx.playMusic('map');
    }
  }

  private updatePrompt(): void {
    if (!this.player) return;
    if (this.talking) {
      this.hud.setPrompt('');
      return;
    }
    let label = '';
    for (const n of this.npcs) {
      if (n.model.group.position.distanceTo(this.player.pos) < 2.6) {
        const def = NPCS.find((d) => d.id === n.id)!;
        label = `E — Falar com ${def.name}`;
        break;
      }
    }
    this.hud.setPrompt(label);
  }

  private updateMobs(dt: number): void {
    const player = this.player!;
    const ppos = player.pos;
    for (const m of [...this.mobs]) {
      if (m.dead) continue;
      m.attackCd = Math.max(0, m.attackCd - dt);
      m.rangedCd = Math.max(0, m.rangedCd - dt);
      m.sayCd = Math.max(0, m.sayCd - dt);
      m.stunned = Math.max(0, m.stunned - dt);
      m.weak = Math.max(0, m.weak - dt);
      const dist = Math.hypot(ppos.x - m.pos.x, ppos.z - m.pos.z);
      let canChase = dist < m.def.aggroRange;
      if (m === this.boss && !this.world.insideCastle(ppos.x, ppos.z)) canChase = false;
      if (m.leash > 0 && m.home.distanceTo(ppos) > m.leash) canChase = false;
      if (canChase && m.state !== 'chase') {
        m.state = 'chase';
        this.mobSay(m);
        if (m.isBoss) {
          Sfx.bossRoar();
          this.hud.toast(m.def.name, true);
          if (m === this.boss && this.bossFight.round === 1) m.roundFloor = Math.round(m.maxHp * (2 / 3));
        }
      } else if (!canChase && m.state === 'chase') m.state = m.isBoss ? 'return' : 'wander';

      if (m.knock.lengthSq() > 0.01) {
        m.tryMove(this.world, m.knock.x * dt, m.knock.z * dt);
        m.knock.multiplyScalar(Math.max(0, 1 - dt * 8));
      }

      m.moving = 0;
      if (m.stunned > 0) {
        m.updateVertical(this.world, dt);
        m.syncTransform();
        m.updateVisuals(dt);
        continue;
      }
      if (m.state === 'chase') {
        m.faceTowards(ppos, dt);
        if (m.invuln > 0) {
          m.updateVertical(this.world, dt);
          m.syncTransform();
          m.updateVisuals(dt);
          continue;
        }
        const inMelee = dist < m.def.meleeRange + 0.2;
        const ranged = m.def.ranged;
        const round = m === this.boss ? this.bossFight.round : 1;
        const volley = m === this.boss ? (round === 1 ? 1 : round === 2 ? 3 : 5) : m === this.helio && this.bossPhaseFlags.helioRage ? 3 : 1;
        const cdMul = m === this.boss ? (round === 1 ? 1 : round === 2 ? 0.72 : 0.5) : 1;
        const wantsRanged = ranged && dist > ranged.minRange && m.rangedCd <= 0;
        if (wantsRanged && ranged) {
          m.rangedCd = ranged.cooldown * cdMul;
          m.attackAnim = 0;
          this.fireAt(m, ranged.speed * (round > 1 ? 1.12 : 1), ranged.damage * (0.85 + round * 0.15), ranged.color, ranged.size, volley);
        } else if (inMelee) {
          if (m.attackCd <= 0) {
            m.attackCd = m.def.attackCooldown * cdMul;
            m.attackAnim = 0;
            const target = m;
            const meleeDmg = m.def.damage * (m === this.boss ? 0.85 + round * 0.22 : 1);
            setTimeout(() => {
              if (target.dead || this.phase !== 'playing') return;
              const d = Math.hypot(this.player!.pos.x - target.pos.x, this.player!.pos.z - target.pos.z);
              if (d < target.def.meleeRange + 0.7) this.damagePlayer(meleeDmg, target.pos);
            }, 180);
          }
        } else {
          const spd = m.def.speed * (m === this.boss ? 0.92 + round * 0.18 : 1);
          const dir = new THREE.Vector3(ppos.x - m.pos.x, 0, ppos.z - m.pos.z).normalize();
          for (const o of this.mobs) {
            if (o === m || o.dead) continue;
            const dx = m.pos.x - o.pos.x;
            const dz = m.pos.z - o.pos.z;
            const dd = Math.hypot(dx, dz);
            if (dd < 1.3 && dd > 0.001) dir.add(new THREE.Vector3(dx / dd, 0, dz / dd).multiplyScalar(0.55));
          }
          dir.normalize();
          if (!m.tryMove(this.world, dir.x * spd * dt, dir.z * spd * dt)) {
            const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.sin(m.animT * 2) > 0 ? 1 : -1);
            m.tryMove(this.world, side.x * spd * dt, side.z * spd * dt);
          }
          m.moving = 1;
        }
        if (m.isBoss ? Math.random() < dt * 0.55 : Math.random() < dt * 0.07) this.mobSay(m);
      } else if (m.state === 'return') {
        const toHome = m.home.clone().sub(m.pos);
        toHome.y = 0;
        if (toHome.length() > 0.8) {
          m.faceTowards(m.home, dt);
          toHome.normalize();
          m.tryMove(this.world, toHome.x * m.def.speed * dt, toHome.z * m.def.speed * dt);
          m.moving = 1;
        } else {
          m.state = 'idle';
          m.hp = Math.min(m.maxHp, m.hp + m.maxHp * dt * 0.1);
        }
      } else if (!m.isBoss) {
        m.wanderT -= dt;
        if (m.wanderT <= 0) {
          m.wanderT = 2 + Math.random() * 3;
          if (Math.random() < 0.6) {
            const a = Math.random() * Math.PI * 2;
            m.wanderDir.set(Math.cos(a), 0, Math.sin(a));
            m.state = 'wander';
          } else m.state = 'idle';
        }
        if (m.state === 'wander') {
          m.faceTowards(m.pos.clone().add(m.wanderDir), dt);
          if (!m.tryMove(this.world, m.wanderDir.x * m.def.speed * 0.4 * dt, m.wanderDir.z * m.def.speed * 0.4 * dt)) m.wanderT = 0;
          m.moving = 0.4;
        }
      } else if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * dt * 0.04);

      m.updateVertical(this.world, dt);
      m.syncTransform();
      m.updateVisuals(dt);
      if (m.isBoss && m.state !== 'chase' && Math.random() < dt * 0.28) this.mobSay(m);
      if (m === this.boss) this.updateBossPhases(m, dt);
      if (m === this.helio && !this.bossPhaseFlags.helioRage && m.hp < m.maxHp * 0.5) {
        this.bossPhaseFlags.helioRage = true;
        this.hud.toast('HELIO: "O chefe vai saber disso!"', true);
      }
      if (!m.isBoss && dist > 78) this.removeMob(m);
    }
  }

  private updateBossPhases(b: Mob, dt: number): void {
    this.bossFight.shift = Math.max(0, this.bossFight.shift - dt);
    if (this.bossFight.round === 1 && b.hp <= b.maxHp * (2 / 3) + 0.5) this.startBossRound(2, b);
    else if (this.bossFight.round === 2 && b.hp <= b.maxHp * (1 / 3) + 0.5) this.startBossRound(3, b);

    if (b.state === 'chase' && b.invuln <= 0) {
      this.bossFight.popcornT -= dt;
      if (this.bossFight.popcornT <= 0) {
        this.bossFight.popcornT = this.bossFight.round === 1 ? 4.2 : this.bossFight.round === 2 ? 3.05 : 2.05;
        const n = this.bossFight.round === 1 ? 10 : this.bossFight.round === 2 ? 14 : 18;
        this.throwPopcorn(b, n, 10 + this.bossFight.round, 8 + this.bossFight.round * 2);
      }
    }

    if (b.state === 'chase' && this.bossFight.round >= 2 && b.invuln <= 0) {
      this.bossFight.ringT -= dt;
      if (this.bossFight.ringT <= 0) {
        this.bossFight.ringT = this.bossFight.round === 2 ? 4.2 : 2.7;
        this.ringFire(b, this.bossFight.round === 2 ? 8 : 12, 9 + this.bossFight.round, 10 + this.bossFight.round * 2, 0xff3d5a, 0.28);
      }
    }
  }

  private startBossRound(round: number, b: Mob): void {
    if (this.bossFight.round >= round) return;
    this.bossFight.round = round;
    this.bossFight.shift = 2.5;
    this.bossFight.ringT = 1.2;
    this.bossFight.popcornT = 0.55;
    b.invuln = 2.5;
    b.roundFloor = round === 2 ? Math.round(b.maxHp / 3) : 0;
    b.hp = Math.max(b.hp, b.roundFloor);
    b.pos.copy(b.home);
    b.state = 'chase';
    Sfx.bossRoar();
    this.shake = 0.55;
    this.particles.ring(b.pos.clone(), 0xff3d5a, 7, 48);
    if (round === 2) this.hud.toast('ROUND 2 — LOOP INFINITO', true);
    else {
      const heal = Math.round(b.maxHp * 0.08);
      b.hp = Math.min(b.maxHp, b.hp + heal);
      this.texts.heal(b.center, heal);
      this.hud.toast('ROUND 3 — CORTE FINAL', true);
    }
  }

  private throwPopcorn(m: Mob, count: number, speed: number, damage: number): void {
    const player = this.player!;
    const origin = m.center.add(new THREE.Vector3(0, 0.55, 0));
    const target = player.pos.clone().add(new THREE.Vector3(0, 1.05, 0));
    const dist = origin.distanceTo(target);
    const gravity = 22;
    const flight = Math.min(1.2, Math.max(0.45, dist / Math.max(8, speed)));
    for (let i = 0; i < count; i++) {
      const aim = target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 0.7, (Math.random() - 0.5) * 2.4));
      const vel = aim.sub(origin).multiplyScalar(1 / flight);
      vel.y += gravity * flight * 0.5;
      vel.x += (Math.random() - 0.5) * 2.2;
      vel.z += (Math.random() - 0.5) * 2.2;
      this.projectiles.spawnPopcorn(origin.clone(), vel, damage, gravity);
    }
    this.particles.burst(origin, 0xf0c14a, 10, 3, 0.08, 0.45);
    Sfx.magic();
    this.texts.say(m.center.add(new THREE.Vector3(0, m.model.height * 0.55, 0)), 'Toma pipoca!', '#ffd54f');
  }

  private ringFire(m: Mob, count: number, speed: number, damage: number, color: number, size: number): void {
    const origin = m.center.add(new THREE.Vector3(0, 0.2, 0));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.sin(a), 0.04, Math.cos(a)).normalize();
      this.projectiles.spawn(origin.clone().addScaledVector(dir, m.radius + 0.35), dir.multiplyScalar(speed), damage, color, size);
    }
    Sfx.magic();
  }

  private fireAt(m: Mob, speed: number, damage: number, color: number, size: number, count: number): void {
    const player = this.player!;
    const origin = m.center.add(new THREE.Vector3(0, 0.25, 0));
    const target = player.pos.clone().add(new THREE.Vector3(0, 1, 0));
    const dist = origin.distanceTo(target);
    target.addScaledVector(player.vel, Math.min(0.55, dist / speed) * 0.65);
    const base = target.sub(origin).normalize();
    for (let i = 0; i < count; i++) {
      const dir = base.clone();
      if (count > 1) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (count - 1) / 2) * 0.16);
      this.projectiles.spawn(origin.clone().addScaledVector(dir, m.radius + 0.4), dir.multiplyScalar(speed), damage, color, size);
    }
    Sfx.magic();
  }

  private updateProjectiles(dt: number): void {
    const player = this.player!;
    const alive = this.phase === 'playing';
    this.projectiles.update(dt, (p: Projectile) => this.particles.burst(p.mesh.position, p.color, p.kind === 'popcorn' ? 10 : 6, p.kind === 'popcorn' ? 2.6 : 2, 0.07, 0.4));
    if (!alive) return;
    const center = player.pos.clone().add(new THREE.Vector3(0, 0.95, 0));
    for (const p of [...this.projectiles.list]) {
      if (p.fromPlayer) continue;
      const hitR = p.kind === 'popcorn' ? 1.05 : 0.9;
      if (p.mesh.position.distanceTo(center) < hitR) {
        this.damagePlayer(p.damage, p.mesh.position);
        this.particles.burst(p.mesh.position, p.color, 10, 3, 0.09, 0.45);
        this.projectiles.remove(p);
      }
    }
  }
}
