import * as THREE from 'three';
import { Sfx } from '../audio/Sfx';
import type { Hud } from '../ui/Hud';
import { levelForXp, XP_TABLE, type HeroDef, type MobKind } from './Data';
import { FloatingText, Particles, Projectiles, type Projectile } from './Effects';
import { Mob } from './Mobs';
import { Player } from './Player';
import { World } from './World';

const SUN_DIR = new THREE.Vector3(0.55, 0.62, 0.4).normalize();
const SKY_ZENITH = new THREE.Color(0x3b6fb6);
const SKY_HORIZON = new THREE.Color(0xf0b070);
const FOG_COLOR = new THREE.Color(0xe2b58a);

type Phase = 'menu' | 'playing' | 'dead' | 'victory';

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly world = new World();

  private sun!: THREE.DirectionalLight;
  private sky!: THREE.Mesh;
  private clouds: THREE.Mesh[] = [];
  private beam!: THREE.Mesh;
  private beamLight!: THREE.PointLight;

  private particles = new Particles(this.world);
  private projectiles = new Projectiles(this.world);
  private texts = new FloatingText();

  player: Player | null = null;
  hero: HeroDef | null = null;
  private mobs: Mob[] = [];
  private elio: Mob | null = null;
  private boss: Mob | null = null;

  phase: Phase = 'menu';
  private locked = false;
  private timer = new THREE.Timer();
  private time = 0;
  private playTime = 0;

  // stats do jogador
  hp = 100;
  maxHp = 100;
  xp = 0;
  level = 1;
  kills = 0;
  private specialCd = 0;
  private healCd = 0;
  private attackCd = 0;
  private stepT = 0;
  private shake = 0;
  private objective = 0;
  private objectiveT = 0;
  private bossPhaseFlags = { loop: false, popcorn: false, elioRage: false };
  private spawnT = 0;
  private lastHp = -1;
  private lastXp = -1;
  private worldReady = false;

  constructor(
    private hud: Hud,
    container: HTMLElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 700);
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(FOG_COLOR, 70, 190);
    this.scene.background = FOG_COLOR;

    this.setupLights();
    this.setupSky();
    this.scene.add(this.world.group, this.particles.group, this.projectiles.group, this.texts.group);
    this.bindEvents();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------ setup

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0x9ec4f0, 0x7a5a3a, 1.25);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight(0xffd6a6, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = 48;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    // Feixe de luz do objetivo
    const beamGeo = new THREE.CylinderGeometry(0.22, 0.4, 90, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    this.beamLight = new THREE.PointLight(0xffd54f, 8, 14, 1.8);
    this.scene.add(this.beam, this.beamLight);
  }

  private setupSky(): void {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        zenith: { value: SKY_ZENITH },
        horizon: { value: SKY_HORIZON },
        ground: { value: FOG_COLOR.clone().multiplyScalar(0.8) },
        sunDir: { value: SUN_DIR },
        sunColor: { value: new THREE.Color(0xfff1c0) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 zenith; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = h >= 0.0 ? mix(horizon, zenith, pow(h, 0.55)) : mix(horizon, ground, clamp(-h * 6.0, 0.0, 1.0));
          float s = max(dot(d, sunDir), 0.0);
          col += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.08);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), mat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);

    // Nuvens em blocos
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 26; i++) {
      const w = 6 + Math.random() * 14;
      const d = 5 + Math.random() * 10;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), cloudMat);
      m.position.set(Math.random() * this.world.sizeX * 1.4 - this.world.sizeX * 0.2, 46 + Math.random() * 6, Math.random() * this.world.sizeZ * 1.4 - this.world.sizeZ * 0.2);
      m.castShadow = true;
      this.clouds.push(m);
      this.scene.add(m);
    }
  }

  async buildWorld(): Promise<void> {
    const tick = () => new Promise<void>((r) => setTimeout(r, 0));
    this.hud.setLoading(0);
    await tick();
    this.world.generate((p) => this.hud.setLoading(p));
    await tick();
    this.world.buildAll((p) => this.hud.setLoading(p));
    await tick();
    this.worldReady = true;
    this.hud.setLoading(null);
    // câmera de menu: vista do acampamento
    const s = this.world.spawn;
    this.camera.position.set(s.x - 14, s.y + 9, s.z + 16);
    this.camera.lookAt(s.x + 10, s.y, s.z - 4);
  }

  // ------------------------------------------------------------ eventos

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.phase === 'playing') {
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
      else if (e.button === 2) this.special();
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
      if (this.phase !== 'playing' || !this.player) return;
      if (e.code === 'F5') {
        e.preventDefault();
        this.player.thirdPerson = !this.player.thirdPerson;
        this.hud.toast(this.player.thirdPerson ? 'Câmera: 3ª pessoa' : 'Câmera: 1ª pessoa');
        return;
      }
      if (!this.locked) return;
      if (e.code === 'KeyQ') this.heal();
      if (e.code === 'KeyM') this.hud.toast(Sfx.toggleMute() ? 'Som desligado' : 'Som ligado');
      if (e.code === 'Space') e.preventDefault();
      this.player.keys.add(e.code);
    });
    document.addEventListener('keyup', (e) => this.player?.keys.delete(e.code));
    window.addEventListener('blur', () => this.player?.keys.clear());
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

  // ------------------------------------------------------------ fluxo

  start(hero: HeroDef): void {
    if (!this.worldReady) return;
    this.reset();
    this.hero = hero;
    this.player = new Player(this.camera, this.world, hero);
    this.scene.add(this.player.model.group);
    const s = this.world.spawn;
    this.player.teleport(s.x + 0.5, s.y, s.z + 0.5);
    this.player.yaw = Math.atan2(-(this.world.tower.x - s.x), -(this.world.tower.z - s.z));
    this.player.pitch = -0.05;

    this.level = 1;
    this.xp = 0;
    this.kills = 0;
    this.applyLevelStats();
    this.hp = this.maxHp;
    this.hud.setHero(hero);
    this.hud.setKills(0);
    this.hud.setHudVisible(true);
    this.hud.showScreen(null);

    this.spawnBosses();
    this.setObjective(0);
    this.phase = 'playing';
    this.playTime = 0;
    Sfx.playMusic('map');
    this.hud.toast(`Bem-vindo, ${hero.name}! Siga o feixe de luz.`, true);
    this.requestLock();
  }

  private reset(): void {
    for (const m of this.mobs) this.scene.remove(m.group);
    this.mobs = [];
    this.elio = null;
    this.boss = null;
    if (this.player) {
      this.scene.remove(this.player.model.group);
      this.camera.remove(this.player.viewModel);
      this.player = null;
    }
    for (const p of [...this.projectiles.list]) this.projectiles.remove(p);
    this.bossPhaseFlags = { loop: false, popcorn: false, elioRage: false };
    this.specialCd = 0;
    this.healCd = 0;
    this.lastHp = -1;
    this.lastXp = -1;
    this.hud.setBoss(null);
    // Reconstrói o portão, se já tiver sido aberto
    if (this.world.get(this.world.gateBlocks[0][0], this.world.gateBlocks[0][1], this.world.gateBlocks[0][2]) === 0) {
      for (const [x, y, z] of this.world.gateBlocks) this.world.set(x, y, z, 10, true);
      this.world.rebuildDirty();
    }
  }

  quitToTitle(): void {
    this.phase = 'menu';
    this.reset();
    this.hud.setHudVisible(false);
    this.hud.showScreen('title');
    Sfx.playMusic('title');
    if (document.pointerLockElement) document.exitPointerLock();
    const s = this.world.spawn;
    this.camera.position.set(s.x - 14, s.y + 9, s.z + 16);
    this.camera.lookAt(s.x + 10, s.y, s.z - 4);
  }

  respawn(): void {
    if (!this.player) return;
    const s = this.world.spawn;
    this.player.teleport(s.x + 0.5, s.y, s.z + 0.5);
    this.hp = this.maxHp;
    // remove mobs comuns próximos e recua bosses
    for (const m of [...this.mobs]) if (!m.isBoss) this.removeMob(m);
    for (const b of [this.elio, this.boss]) {
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

  private spawnBosses(): void {
    const t = this.world.tower;
    const ex = t.x - 8;
    const ez = t.z + 0.5;
    this.elio = new Mob('elio', ex, this.world.surfaceY(ex, ez), ez);
    this.elio.leash = 26;
    this.elio.yaw = Math.PI * -0.5;
    this.addMob(this.elio);

    const th = this.world.throne;
    const bx = th.x - 4;
    const bz = th.z + 0.5;
    this.boss = new Mob('boss', bx, this.world.surfaceY(bx, bz), bz);
    this.boss.leash = 0;
    this.boss.yaw = -Math.PI / 2;
    this.addMob(this.boss);
  }

  private addMob(m: Mob): void {
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
    if (stage === 0) {
      const t = this.world.tower;
      this.beam.position.set(t.x - 8, t.y + 45, t.z);
      this.beamLight.position.set(t.x - 8, t.y + 3, t.z);
      beamMat.color.setHex(0xffd54f);
      this.beamLight.color.setHex(0xffd54f);
      this.beam.visible = true;
      this.beamLight.visible = true;
    } else if (stage === 1) {
      const g = this.world.castleGate;
      this.beam.position.set(g.x - 2, g.y + 45, g.z);
      this.beamLight.position.set(g.x - 2, g.y + 3, g.z);
      beamMat.color.setHex(0xff3d5a);
      this.beamLight.color.setHex(0xff3d5a);
    } else {
      this.beam.visible = false;
      this.beamLight.visible = false;
    }
    this.updateObjectiveText();
  }

  private updateObjectiveText(): void {
    if (!this.player) return;
    const p = this.player.pos;
    if (this.objective === 0) {
      const t = this.world.tower;
      const d = Math.round(Math.hypot(t.x - 8 - p.x, t.z - p.z));
      this.hud.setObjective(`Derrote Élio, o Fiel Escudeiro, na Torre (feixe dourado) — ${d}m. Elimine mobs pelo caminho para subir de nível.`);
    } else if (this.objective === 1) {
      const g = this.world.castleGate;
      const d = Math.round(Math.hypot(g.x - p.x, g.z - p.z));
      this.hud.setObjective(`O portão do castelo se abriu! Entre (feixe vermelho) — ${d}m — e destrua o REAL OFICIAL.`);
    } else {
      this.hud.setObjective('O REAL OFICIAL foi destruído. A internet está salva!');
    }
  }

  // ------------------------------------------------------------ stats

  private applyLevelStats(): void {
    if (!this.hero) return;
    this.maxHp = Math.round(this.hero.hp * (1 + 0.1 * (this.level - 1)));
  }

  private get damage(): number {
    if (!this.hero) return 0;
    return this.hero.damage * (1 + 0.08 * (this.level - 1));
  }

  private gainXp(amount: number): void {
    this.xp += amount;
    const newLevel = levelForXp(this.xp);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.applyLevelStats();
      this.hp = this.maxHp;
      Sfx.levelUp();
      this.hud.toast(`NÍVEL ${this.level}!`, true);
      if (this.player) this.particles.ring(this.player.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 0x66bb6a, 2.5);
    }
  }

  // ------------------------------------------------------------ ações

  private attack(): void {
    if (!this.player || this.attackCd > 0 || !this.hero) return;
    if (!this.player.swing()) return;
    this.attackCd = this.hero.attackCooldown;
    const hit = this.meleeHit(3.2, 0.55, this.damage, 6, true);
    if (!hit) Sfx.miss();
  }

  /** Acerta o mob mais próximo no cone. Retorna true se acertou. */
  private meleeHit(range: number, minDot: number, dmg: number, knock: number, single: boolean, crit = false): boolean {
    if (!this.player) return false;
    const eye = this.player.eyePos;
    const fwd = this.player.forward;
    const candidates: { m: Mob; d: number }[] = [];
    for (const m of this.mobs) {
      if (m.dead) continue;
      const c = m.center;
      const to = c.clone().sub(eye);
      const d = to.length() - m.radius;
      if (d > range) continue;
      to.normalize();
      if (to.dot(fwd) < minDot && d > 0.8) continue;
      candidates.push({ m, d });
    }
    if (candidates.length === 0) return false;
    candidates.sort((a, b) => a.d - b.d);
    const targets = single ? [candidates[0]] : candidates;
    for (const { m } of targets) this.hurtMob(m, dmg, knock, crit);
    return true;
  }

  private hurtMob(m: Mob, dmg: number, knock: number, crit = false): void {
    if (!this.player || m.dead) return;
    const variance = 0.85 + Math.random() * 0.3;
    const amount = Math.round(dmg * variance);
    m.takeDamage(amount, this.player.pos, knock);
    this.texts.damage(m.center, amount, crit);
    this.particles.burst(m.center, crit ? 0xffd54f : 0xffffff, crit ? 14 : 6, 3, 0.1, 0.5);
    crit ? Sfx.crit() : Sfx.hit();
    if (m.state === 'idle' || m.state === 'wander') {
      m.state = 'chase';
      this.mobSay(m);
    }
    if (m.dead) this.killMob(m);
  }

  private special(): void {
    if (!this.player || !this.hero || this.specialCd > 0) return;
    const sp = this.hero.special;
    const origin = this.player.pos.clone().add(new THREE.Vector3(0, 0.3, 0));
    let did = false;
    if (sp.kind === 'burst') {
      did = true;
      this.particles.ring(origin, 0x4fc3f7, 5.5, 32);
      Sfx.magic();
      for (const m of [...this.mobs]) if (!m.dead && m.pos.distanceTo(this.player.pos) < 5.5 + m.radius) this.hurtMob(m, this.damage * 2, 9, true);
    } else if (sp.kind === 'heavy') {
      did = this.meleeHit(4.2, 0.4, this.damage * 3, 14, true, true);
      if (!did) {
        this.hud.toast('Nenhum alvo à frente!');
        return;
      }
      this.player.swing();
      this.shake = 0.25;
    } else if (sp.kind === 'slam') {
      did = true;
      this.particles.ring(origin, 0xef5350, 4.5, 32);
      this.particles.burst(origin, 0x8a5a33, 20, 5, 0.18, 0.7);
      this.shake = 0.4;
      Sfx.bossRoar();
      for (const m of [...this.mobs]) if (!m.dead && m.pos.distanceTo(this.player.pos) < 4.8 + m.radius) this.hurtMob(m, this.damage * 2, 16, true);
    }
    if (did) {
      this.specialCd = sp.cooldown;
      this.hud.toast(sp.name);
    }
  }

  private heal(): void {
    if (!this.player || !this.hero || this.healCd > 0) return;
    if (this.hp >= this.maxHp) {
      this.hud.toast('HP já está cheio.');
      return;
    }
    const amount = Math.round(this.maxHp * this.hero.heal.percent);
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.healCd = this.hero.heal.cooldown;
    Sfx.heal();
    this.texts.heal(this.player.eyePos.add(new THREE.Vector3(0, 0.3, 0)), amount);
    this.particles.burst(this.player.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x66bb6a, 16, 2.5, 0.12, 0.9, 2);
    this.hud.toast(`${this.hero.heal.name}: +${amount} HP`);
  }

  private damagePlayer(amount: number, from: THREE.Vector3 | null): void {
    if (!this.player || !this.hero || this.phase !== 'playing') return;
    const dmg = Math.max(1, Math.round(amount * (1 - this.hero.armor) * (0.9 + Math.random() * 0.2)));
    this.hp -= dmg;
    this.hud.hit();
    this.shake = Math.max(this.shake, 0.18);
    Sfx.hit();
    if (from) {
      const push = this.player.pos.clone().sub(from);
      push.y = 0;
      push.normalize().multiplyScalar(4);
      this.player.vel.add(push);
      this.player.vel.y = Math.max(this.player.vel.y, 2.5);
    }
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    this.phase = 'dead';
    this.hp = 0;
    Sfx.stopMusic();
    Sfx.defeat();
    const lines = [
      'Você acorda no acampamento. O REAL OFICIAL ri com a boca cheia de pipoca.',
      'Seu vídeo virou corte sem contexto. Mas heróis renascem.',
      'GAME OVER? Nunca. Só um respawn.',
    ];
    this.hud.setDeadText(lines[Math.floor(Math.random() * lines.length)]);
    setTimeout(() => {
      this.hud.showScreen('dead');
      if (document.pointerLockElement) document.exitPointerLock();
    }, 900);
  }

  private killMob(m: Mob): void {
    this.removeMob(m);
    this.kills++;
    this.hud.setKills(this.kills);
    const color = m.def.kind === 'bug' ? 0x5da832 : m.def.kind === 'reuniao' ? 0xb388ff : m.def.kind === 'boss' ? 0xff3d5a : 0xffd54f;
    this.particles.burst(m.center, color, m.isBoss ? 60 : 18, m.isBoss ? 7 : 4, m.isBoss ? 0.25 : 0.14, 1.2);
    this.gainXp(m.def.xp);
    Sfx.coin();
    if (m === this.elio) {
      this.hud.toast('ÉLIO DERROTADO! O portão de ouro do castelo se abriu.', true);
      this.world.openGate();
      this.setObjective(1);
      Sfx.victory();
    } else if (m === this.boss) {
      this.win();
    } else {
      this.texts.say(m.center, m.def.kind === 'bug' ? 'bug corrigido!' : 'eliminado!', '#ffd54f');
    }
  }

  private win(): void {
    this.phase = 'victory';
    this.setObjective(2);
    this.hud.setBoss(null);
    Sfx.stopMusic();
    Sfx.victory();
    this.hud.toast('REAL OFICIAL DESTRUÍDO!', true);
    const mins = Math.floor(this.playTime / 60);
    const secs = Math.floor(this.playTime % 60);
    this.hud.setVictoryText(
      `${this.hero?.name} destruiu o REAL OFICIAL em ${mins}m${String(secs).padStart(2, '0')}s, com ${this.kills} mobs eliminados e nível ${this.level}. A pipoca esfriou. Os cortes acabaram. A Bolha Dev está livre.`,
    );
    setTimeout(() => {
      Sfx.playMusic('victory');
      this.hud.showScreen('victory');
      if (document.pointerLockElement) document.exitPointerLock();
    }, 2800);
  }

  private mobSay(m: Mob): void {
    if (m.sayCd > 0) return;
    m.sayCd = 5 + Math.random() * 5;
    const line = m.def.lines[Math.floor(Math.random() * m.def.lines.length)];
    const color = m.def.kind === 'boss' ? '#ff5c6c' : m.def.kind === 'elio' ? '#ffd54f' : '#e8e8ff';
    this.texts.say(m.center.add(new THREE.Vector3(0, m.model.height * 0.6 + 0.3, 0)), line, color);
  }

  // ------------------------------------------------------------ loop

  private frame(): void {
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    this.time += dt;
    this.hud.update(dt);

    if (this.phase === 'menu') {
      // câmera orbitando o acampamento
      if (this.worldReady) {
        const s = this.world.spawn;
        const a = this.time * 0.08;
        this.camera.position.set(s.x + Math.cos(a) * 22, s.y + 8 + Math.sin(this.time * 0.3) * 1.5, s.z + Math.sin(a) * 22);
        this.camera.lookAt(s.x, s.y + 1, s.z);
      }
    } else if (this.player) {
      const simulate = this.locked || this.phase !== 'playing';
      if (simulate) this.update(dt);
      else this.player.update(0, 1); // mantém a câmera no lugar
    }

    this.updateEnvironment(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateEnvironment(dt: number): void {
    this.sky.position.copy(this.camera.position);
    for (const c of this.clouds) {
      c.position.x += dt * 0.6;
      if (c.position.x > this.world.sizeX * 1.2) c.position.x = -this.world.sizeX * 0.2;
    }
    const focus = this.player ? this.player.pos : this.camera.position;
    const tx = Math.round(focus.x);
    const tz = Math.round(focus.z);
    this.sun.target.position.set(tx, 12, tz);
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIR, 120);
    this.beam.rotation.y += dt * 0.5;
    // Esmaece o feixe quando o jogador se aproxima, para não ofuscar
    const dBeam = Math.hypot(this.beam.position.x - focus.x, this.beam.position.z - focus.z);
    const near = THREE.MathUtils.clamp((dBeam - 4) / 10, 0, 1);
    (this.beam.material as THREE.MeshBasicMaterial).opacity = (0.3 + Math.sin(this.time * 3) * 0.08) * near;
    this.beamLight.intensity = 8 * near;
    this.particles.update(dt);
    this.texts.update(dt);
  }

  private update(dt: number): void {
    const player = this.player!;
    if (this.phase === 'playing') this.playTime += dt;

    this.attackCd = Math.max(0, this.attackCd - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);
    this.healCd = Math.max(0, this.healCd - dt);

    const alive = this.phase === 'playing';
    if (!alive) player.keys.clear();
    player.update(dt, 1);

    // passos
    const speed = Math.hypot(player.vel.x, player.vel.z);
    if (player.onGround && speed > 1) {
      this.stepT += dt * speed;
      if (this.stepT > 2.6) {
        this.stepT = 0;
        Sfx.step();
      }
    }

    // tremor de câmera
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const k = this.shake * 0.25;
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k));
    }

    if (alive) {
      this.updateMobs(dt);
      this.updateSpawner(dt);
    }
    this.updateProjectiles(dt);

    // HUD
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
    if (this.hero) this.hud.setCooldowns(this.specialCd / this.hero.special.cooldown, this.healCd / this.hero.heal.cooldown);
    this.objectiveT += dt;
    if (this.objectiveT > 0.5) {
      this.objectiveT = 0;
      this.updateObjectiveText();
    }

    // barra do boss + música
    const activeBoss = [this.boss, this.elio].find((b) => b && !b.dead && b.state === 'chase');
    if (activeBoss) {
      this.hud.setBoss(activeBoss.def.name, activeBoss.hp / activeBoss.maxHp);
      if (alive) Sfx.playMusic('boss');
    } else {
      this.hud.setBoss(null);
      if (alive) Sfx.playMusic('map');
    }
  }

  private updateMobs(dt: number): void {
    const player = this.player!;
    const ppos = player.pos;
    for (const m of [...this.mobs]) {
      if (m.dead) continue;
      m.attackCd = Math.max(0, m.attackCd - dt);
      m.rangedCd = Math.max(0, m.rangedCd - dt);
      m.sayCd = Math.max(0, m.sayCd - dt);
      const dist = Math.hypot(ppos.x - m.pos.x, ppos.z - m.pos.z);
      const flying = !!m.def.hover;

      // Boss não sai do castelo; Élio não sai da torre
      let canChase = dist < m.def.aggroRange;
      if (m === this.boss && !this.world.insideCastle(ppos.x, ppos.z)) canChase = false;
      if (m.leash > 0 && m.home.distanceTo(ppos) > m.leash) canChase = false;

      if (canChase && m.state !== 'chase') {
        m.state = 'chase';
        this.mobSay(m);
        if (m.isBoss) {
          Sfx.bossRoar();
          this.hud.toast(m.def.name, true);
        }
      } else if (!canChase && m.state === 'chase') {
        m.state = m.isBoss ? 'return' : 'wander';
      }

      // knockback
      if (m.knock.lengthSq() > 0.01) {
        m.tryMove(this.world, m.knock.x * dt, m.knock.z * dt, flying);
        m.knock.multiplyScalar(Math.max(0, 1 - dt * 8));
      }

      m.moving = 0;
      if (m.state === 'chase') {
        m.faceTowards(ppos, dt);
        const inMelee = dist < m.def.meleeRange + 0.2;
        const ranged = m.def.ranged;
        const wantsRanged = ranged && dist > ranged.minRange && m.rangedCd <= 0;
        if (wantsRanged && ranged) {
          m.rangedCd = ranged.cooldown * (m === this.boss && this.bossPhaseFlags.loop ? 0.65 : 1);
          m.attackAnim = 0;
          this.fireAt(m, ranged.speed, ranged.damage, ranged.color, ranged.size, m === this.boss && this.bossPhaseFlags.loop ? 3 : m === this.elio && this.bossPhaseFlags.elioRage ? 3 : 1);
          if (Math.random() < 0.35) this.texts.say(m.center.add(new THREE.Vector3(0, 1.2, 0)), ranged.name, '#ffffff');
        } else if (inMelee) {
          if (m.attackCd <= 0) {
            m.attackCd = m.def.attackCooldown;
            m.attackAnim = 0;
            setTimeout(() => {
              if (m.dead || this.phase !== 'playing') return;
              const d = Math.hypot(this.player!.pos.x - m.pos.x, this.player!.pos.z - m.pos.z);
              if (d < m.def.meleeRange + 0.6) this.damagePlayer(m.def.damage, m.pos);
            }, 180);
          }
        } else {
          const spd = m.def.speed * (m === this.boss && this.bossPhaseFlags.loop ? 1.3 : 1);
          const dir = new THREE.Vector3(ppos.x - m.pos.x, 0, ppos.z - m.pos.z).normalize();
          // separação entre mobs
          for (const o of this.mobs) {
            if (o === m || o.dead) continue;
            const dx = m.pos.x - o.pos.x;
            const dz = m.pos.z - o.pos.z;
            const dd = Math.hypot(dx, dz);
            if (dd < 1.4 && dd > 0.001) dir.add(new THREE.Vector3(dx / dd, 0, dz / dd).multiplyScalar(0.6));
          }
          dir.normalize();
          if (!m.tryMove(this.world, dir.x * spd * dt, dir.z * spd * dt, flying)) {
            // tenta contornar
            const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.sin(m.animT * 2) > 0 ? 1 : -1);
            m.tryMove(this.world, side.x * spd * dt, side.z * spd * dt, flying);
          }
          m.moving = 1;
        }
        if (Math.random() < dt * 0.08) this.mobSay(m);
      } else if (m.state === 'return') {
        const toHome = m.home.clone().sub(m.pos);
        toHome.y = 0;
        if (toHome.length() > 0.8) {
          m.faceTowards(m.home, dt);
          toHome.normalize();
          m.tryMove(this.world, toHome.x * m.def.speed * dt, toHome.z * m.def.speed * dt, flying);
          m.moving = 1;
        } else {
          m.state = 'idle';
          m.hp = Math.min(m.maxHp, m.hp + m.maxHp * dt * 0.1);
        }
      } else {
        // idle / wander
        if (!m.isBoss) {
          m.wanderT -= dt;
          if (m.wanderT <= 0) {
            m.wanderT = 2 + Math.random() * 3;
            if (Math.random() < 0.6) {
              const a = Math.random() * Math.PI * 2;
              m.wanderDir.set(Math.cos(a), 0, Math.sin(a));
              m.state = 'wander';
            } else {
              m.state = 'idle';
            }
          }
          if (m.state === 'wander') {
            m.faceTowards(m.pos.clone().add(m.wanderDir), dt);
            if (!m.tryMove(this.world, m.wanderDir.x * m.def.speed * 0.4 * dt, m.wanderDir.z * m.def.speed * 0.4 * dt, flying)) m.wanderT = 0;
            m.moving = 0.4;
          }
        } else {
          // bosses respiram
          if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * dt * 0.05);
        }
      }

      m.updateVertical(this.world, dt);
      m.syncTransform();
      m.updateVisuals(dt);

      // fases dos bosses
      if (m === this.boss) this.updateBossPhases(m);
      if (m === this.elio && !this.bossPhaseFlags.elioRage && m.hp < m.maxHp * 0.5) {
        this.bossPhaseFlags.elioRage = true;
        this.hud.toast('Élio: "Cobrança em TRIPLO!"', true);
        this.texts.say(m.center.add(new THREE.Vector3(0, 1.5, 0)), 'COBRANÇA TRIPLA!', '#ffd54f');
      }

      // despawn de mobs muito longe
      if (!m.isBoss && dist > 75) this.removeMob(m);
    }
  }

  private updateBossPhases(b: Mob): void {
    if (!this.bossPhaseFlags.loop && b.hp < b.maxHp * 0.6) {
      this.bossPhaseFlags.loop = true;
      this.hud.toast('REAL OFICIAL: "LOOP INFINITO!"', true);
      Sfx.bossRoar();
      this.shake = 0.5;
      this.particles.ring(b.pos.clone(), 0xff3d5a, 6, 40);
      // invoca bugs dentro do castelo
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const x = b.pos.x + Math.cos(a) * 4;
        const z = b.pos.z + Math.sin(a) * 4;
        const bug = new Mob('bug', x, this.world.surfaceY(x, z), z, 1 + this.level * 0.15);
        bug.state = 'chase';
        this.addMob(bug);
        this.particles.burst(bug.center, 0x5da832, 12, 3);
      }
    }
    if (!this.bossPhaseFlags.popcorn && b.hp < b.maxHp * 0.3) {
      this.bossPhaseFlags.popcorn = true;
      const heal = Math.round(b.maxHp * 0.12);
      b.hp = Math.min(b.maxHp, b.hp + heal);
      this.hud.toast('REAL OFICIAL come pipoca e recupera fôlego!', true);
      this.texts.heal(b.center, heal);
      this.particles.burst(b.center.add(new THREE.Vector3(0, 1, 0)), 0xfff7dc, 24, 3, 0.16, 1);
    }
  }

  private fireAt(m: Mob, speed: number, damage: number, color: number, size: number, count: number): void {
    const player = this.player!;
    const origin = m.center.add(new THREE.Vector3(0, 0.3, 0));
    const target = player.pos.clone().add(new THREE.Vector3(0, 1.0, 0));
    // previsão simples
    const dist = origin.distanceTo(target);
    target.addScaledVector(player.vel, Math.min(0.6, dist / speed) * 0.7);
    const base = target.sub(origin).normalize();
    for (let i = 0; i < count; i++) {
      const dir = base.clone();
      if (count > 1) {
        const spread = (i - (count - 1) / 2) * 0.16;
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
      }
      this.projectiles.spawn(origin.clone().addScaledVector(dir, m.radius + 0.4), dir.multiplyScalar(speed), damage, color, size);
    }
    Sfx.magic();
  }

  private updateProjectiles(dt: number): void {
    const player = this.player!;
    const alive = this.phase === 'playing';
    this.projectiles.update(dt, (p: Projectile) => this.particles.burst(p.mesh.position, p.color, 6, 2, 0.08, 0.4));
    if (!alive) return;
    const center = player.pos.clone().add(new THREE.Vector3(0, 0.95, 0));
    for (const p of [...this.projectiles.list]) {
      if (p.fromPlayer) continue;
      const d = p.mesh.position.distanceTo(center);
      if (d < 0.95) {
        this.damagePlayer(p.damage, p.mesh.position);
        this.particles.burst(p.mesh.position, p.color, 10, 3, 0.1, 0.5);
        this.projectiles.remove(p);
      }
    }
  }

  private updateSpawner(dt: number): void {
    const player = this.player!;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 2.2;
    const common = this.mobs.filter((m) => !m.isBoss).length;
    const cap = 12 + Math.min(6, this.level);
    if (common >= cap) return;
    // não spawna dentro do castelo, nem colado ao jogador
    for (let attempt = 0; attempt < 12; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 20;
      const x = player.pos.x + Math.cos(a) * r;
      const z = player.pos.z + Math.sin(a) * r;
      if (x < 4 || z < 4 || x > this.world.sizeX - 4 || z > this.world.sizeZ - 4) continue;
      if (this.world.insideCastle(x, z)) continue;
      const g = this.world.groundBlock(x, z);
      if (g.block !== 1 && g.block !== 4 && g.block !== 18) continue; // grama, areia ou neve
      if (this.world.isWaterAt(x, g.y + 1, z)) continue;
      const roll = Math.random();
      const kind: MobKind = roll < 0.48 ? 'bug' : roll < 0.78 ? 'cliente' : 'reuniao';
      const mob = new Mob(kind, x + 0.5, g.y + 1, z + 0.5, 1 + (this.level - 1) * 0.12);
      mob.yaw = Math.random() * Math.PI * 2;
      this.addMob(mob);
      break;
    }
  }
}
