import Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { heroById } from '../data/heroes';
import { MAP_NODES } from '../data/map';
import type { MapNode } from '../data/types';
import { GameState } from '../state/GameState';
import { fadeIn, fadeToScene, makePanel, makeText, PixelButton, StatBar, typewrite, upper } from '../ui/ui';
import { addMuteButton } from '../ui/mute';

export class MapScene extends Phaser.Scene {
  private heroToken!: Phaser.GameObjects.Container;
  private markers = new Map<string, Phaser.GameObjects.Container>();
  private infoTitle!: Phaser.GameObjects.Text;
  private infoDesc!: Phaser.GameObjects.Text;
  private actionBtn!: PixelButton;
  private hpBar!: StatBar;
  private mpBar!: StatBar;
  private hudText!: Phaser.GameObjects.Text;
  private moving = false;
  private introMode = false;

  constructor() {
    super('Map');
  }

  create(data: { intro?: boolean; message?: string } = {}) {
    this.markers.clear();
    this.moving = false;
    const save = GameState.get();
    const hero = heroById(save.heroId);

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_map').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    this.drawPath();
    MAP_NODES.forEach((n) => this.markers.set(n.id, this.makeMarker(n)));

    // Token do herói
    const cur = this.nodeById(save.currentNode);
    this.heroToken = this.add.container(cur.x, cur.y - 34).setDepth(20);
    const ring = this.add.graphics();
    ring.fillStyle(0x000000, 0.5);
    ring.fillCircle(0, 30, 10);
    ring.fillStyle(hero.accent, 1);
    ring.fillCircle(0, 0, 24);
    ring.lineStyle(3, 0xf5e6c8, 1);
    ring.strokeCircle(0, 0, 24);
    const face = this.add.image(0, 0, hero.portraitKey);
    const s = 42 / Math.max(face.width, face.height);
    face.setScale(s);
    const mask = this.make.graphics({ x: 0, y: 0 }, false);
    mask.fillStyle(0xffffff);
    mask.fillCircle(cur.x, cur.y - 34, 21);
    face.setMask(mask.createGeometryMask());
    (this.heroToken as unknown as { maskGfx: Phaser.GameObjects.Graphics }).maskGfx = mask;
    this.heroToken.add([ring, face]);
    this.tweens.add({
      targets: this.heroToken,
      y: cur.y - 40,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.buildHud(hero.name);
    this.buildInfoPanel();
    this.refreshHud();
    this.showNodeInfo(cur);

    this.input.keyboard?.on('keydown-LEFT', () => this.step(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.step(1));
    this.input.keyboard?.on('keydown-A', () => this.step(-1));
    this.input.keyboard?.on('keydown-D', () => this.step(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.doAction());
    this.input.keyboard?.on('keydown-SPACE', () => this.doAction());

    const menu = makeText(this, 16, 10, '[MENU]', 8, COLORS.textDim).setInteractive({ useHandCursor: true }).setDepth(1000);
    menu.on('pointerover', () => menu.setColor('#ffd54f'));
    menu.on('pointerout', () => menu.setColor(COLORS.textDim));
    menu.on('pointerdown', () => {
      Sfx.back();
      fadeToScene(this, 'Title');
    });
    addMuteButton(this);

    Sfx.playMusic('map');
    fadeIn(this);

    if (data.intro) void this.playIntro(hero.name);
    else if (data.message) void this.flashMessage(data.message);
  }

  // ---------- Layout ----------

  private nodeById(id: string): MapNode {
    return MAP_NODES.find((n) => n.id === id) ?? MAP_NODES[0];
  }

  private nodeIndex(id: string): number {
    return MAP_NODES.findIndex((n) => n.id === id);
  }

  /** Índice do primeiro nó ainda não liberado. */
  private frontier(): number {
    const save = GameState.get();
    for (let i = 0; i < MAP_NODES.length; i++) {
      const n = MAP_NODES[i];
      if ((n.kind === 'battle' || n.kind === 'boss') && !save.cleared.includes(n.id)) return i;
    }
    return MAP_NODES.length - 1;
  }

  private isUnlocked(idx: number): boolean {
    return idx <= this.frontier();
  }

  private drawPath() {
    const g = this.add.graphics().setDepth(5);
    for (let i = 0; i < MAP_NODES.length - 1; i++) {
      const a = MAP_NODES[i];
      const b = MAP_NODES[i + 1];
      const unlocked = this.isUnlocked(i + 1);
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = Phaser.Math.Linear(a.x, b.x, t);
        const y = Phaser.Math.Linear(a.y, b.y, t) - Math.sin(t * Math.PI) * 10;
        g.fillStyle(0x000000, 0.45);
        g.fillCircle(x + 1, y + 2, 3.5);
        g.fillStyle(unlocked ? 0xf5e6c8 : 0x6b6b6b, unlocked ? 0.95 : 0.5);
        g.fillCircle(x, y, 3);
      }
    }
  }

  private makeMarker(n: MapNode): Phaser.GameObjects.Container {
    const idx = this.nodeIndex(n.id);
    const save = GameState.get();
    const cleared = save.cleared.includes(n.id);
    const unlocked = this.isUnlocked(idx);
    const c = this.add.container(n.x, n.y).setDepth(10);
    const g = this.add.graphics();

    const color =
      n.kind === 'boss' ? 0xd32f2f : n.kind === 'shop' ? 0x81c784 : n.kind === 'start' ? 0x4fc3f7 : 0xffb74d;
    g.fillStyle(0x000000, 0.5);
    g.fillEllipse(0, 6, 40, 14);
    g.fillStyle(unlocked ? color : 0x555555, 1);
    g.fillCircle(0, 0, n.kind === 'boss' ? 16 : 12);
    g.lineStyle(3, 0xf5e6c8, unlocked ? 1 : 0.4);
    g.strokeCircle(0, 0, n.kind === 'boss' ? 16 : 12);
    c.add(g);

    if (cleared) {
      // Check mark desenhado (a fonte pixel não tem o glifo ✓)
      const chk = this.add.graphics();
      chk.lineStyle(3, 0x1b5e20, 1);
      chk.beginPath();
      chk.moveTo(-6, 0);
      chk.lineTo(-2, 5);
      chk.lineTo(7, -5);
      chk.strokePath();
      c.add(chk);
    } else {
      const icon = n.kind === 'boss' ? '!!' : n.kind === 'shop' ? '$' : n.kind === 'start' ? 'o' : '!';
      c.add(makeText(this, 0, 0, icon, n.kind === 'boss' ? 12 : 10, '#111111', { strokeThickness: 0 }).setOrigin(0.5));
    }

    const label = makeText(this, 0, n.kind === 'boss' ? 24 : 20, n.name, 8, unlocked ? COLORS.text : COLORS.textDim).setOrigin(0.5, 0);
    c.add(label);

    if (n.kind === 'boss' && unlocked && !cleared) {
      this.tweens.add({ targets: g, scale: 1.15, duration: 500, yoyo: true, repeat: -1 });
    }

    const hit = this.add.circle(0, 0, 22, 0x000000, 0).setInteractive({ useHandCursor: unlocked });
    hit.on('pointerover', () => label.setColor('#ffd54f'));
    hit.on('pointerout', () => label.setColor(unlocked ? COLORS.text : COLORS.textDim));
    hit.on('pointerdown', () => this.travelTo(idx));
    c.add(hit);
    return c;
  }

  private buildHud(heroName: string) {
    makePanel(this, 12, 30, 250, 84, 0.85).setDepth(30);
    this.hudText = makeText(this, 24, 42, '', 8).setDepth(31);
    this.hpBar = new StatBar(this, 24, 72, 226, 10, 'HP', COLORS.hp, COLORS.hpLow).setDepth(31);
    this.mpBar = new StatBar(this, 24, 96, 226, 8, 'MP', COLORS.mp).setDepth(31);
    void heroName;
  }

  refreshHud() {
    const save = GameState.get();
    const hero = heroById(save.heroId);
    const max = GameState.maxStats();
    this.hudText.setText(`${upper(hero.name)}  Nv.${save.level}   $${save.gold}`);
    this.hpBar.set(save.hp, max.hp, false);
    this.mpBar.set(save.mp, max.mp, false);
  }

  private buildInfoPanel() {
    const w = 560;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT - 106;
    makePanel(this, x, y, w, 84, 0.9).setDepth(30);
    this.infoTitle = makeText(this, x + 16, y + 12, '', 12, '#ffd54f').setDepth(31);
    this.infoDesc = makeText(this, x + 16, y + 34, '', 8, COLORS.text, { wordWrap: { width: 340 } }).setDepth(31);
    this.actionBtn = new PixelButton(this, x + w - 100, y + 42, 'ENTRAR', { width: 170, height: 40, size: 10 });
    this.actionBtn.setDepth(31);
    this.actionBtn.onClick = () => this.doAction();
    makeText(this, GAME_WIDTH / 2, GAME_HEIGHT - 6, 'Setas / A D: mover     ENTER: agir     Clique nos pontos do mapa', 8, COLORS.textDim)
      .setOrigin(0.5, 1)
      .setDepth(31);
  }

  private showNodeInfo(n: MapNode) {
    const save = GameState.get();
    const cleared = save.cleared.includes(n.id);
    this.infoTitle.setText(upper(n.name));
    this.infoDesc.setText(n.description);
    let label = 'ENTRAR';
    let disabled = false;
    switch (n.kind) {
      case 'start':
        label = 'DESCANSAR';
        break;
      case 'shop':
        label = 'ABRIR LOJA';
        break;
      case 'battle':
        label = cleared ? 'VENCIDO' : 'LUTAR!';
        disabled = cleared;
        break;
      case 'boss':
        label = cleared ? 'DERROTADO' : 'DESAFIAR!';
        disabled = cleared;
        break;
    }
    this.actionBtn.setLabel(label).setDisabled(disabled);
  }

  // ---------- Movimento ----------

  private step(dir: number) {
    const save = GameState.get();
    const idx = this.nodeIndex(save.currentNode);
    this.travelTo(idx + dir);
  }

  private travelTo(targetIdx: number) {
    if (this.moving || this.introMode) return;
    if (targetIdx < 0 || targetIdx >= MAP_NODES.length) return;
    if (!this.isUnlocked(targetIdx)) {
      Sfx.miss();
      void this.flashMessage('Derrote o inimigo anterior para seguir!');
      return;
    }
    const save = GameState.get();
    const fromIdx = this.nodeIndex(save.currentNode);
    if (targetIdx === fromIdx) return;
    const dir = targetIdx > fromIdx ? 1 : -1;
    this.moving = true;
    const path: MapNode[] = [];
    for (let i = fromIdx + dir; i !== targetIdx + dir; i += dir) path.push(MAP_NODES[i]);
    this.walkPath(path, 0);
  }

  private walkPath(path: MapNode[], i: number) {
    if (i >= path.length) {
      this.moving = false;
      return;
    }
    const n = path[i];
    Sfx.step();
    this.tweens.killTweensOf(this.heroToken);
    const maskGfx = (this.heroToken as unknown as { maskGfx: Phaser.GameObjects.Graphics }).maskGfx;
    this.tweens.add({
      targets: this.heroToken,
      x: n.x,
      y: n.y - 34,
      duration: 420,
      ease: 'Quad.easeInOut',
      onUpdate: () => {
        maskGfx.clear();
        maskGfx.fillStyle(0xffffff);
        maskGfx.fillCircle(this.heroToken.x, this.heroToken.y, 21);
      },
      onComplete: () => {
        GameState.get().currentNode = n.id;
        GameState.save();
        this.showNodeInfo(n);
        this.tweens.add({
          targets: this.heroToken,
          y: n.y - 40,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            maskGfx.clear();
            maskGfx.fillStyle(0xffffff);
            maskGfx.fillCircle(this.heroToken.x, this.heroToken.y, 21);
          },
        });
        this.walkPath(path, i + 1);
      },
    });
  }

  // ---------- Ações ----------

  private doAction() {
    if (this.moving || this.introMode) return;
    const save = GameState.get();
    const n = this.nodeById(save.currentNode);
    switch (n.kind) {
      case 'start': {
        const max = GameState.maxStats();
        const before = save.hp;
        save.hp = Math.min(max.hp, save.hp + Math.round(max.hp * 0.3));
        save.mp = Math.min(max.mp, save.mp + Math.round(max.mp * 0.3));
        GameState.save();
        this.refreshHud();
        Sfx.heal();
        void this.flashMessage(
          before === max.hp ? 'Você já está descansado.' : 'Você descansa no acampamento. +30% HP/MP.',
        );
        break;
      }
      case 'shop':
        Sfx.select();
        fadeToScene(this, 'Shop');
        break;
      case 'battle':
      case 'boss':
        if (save.cleared.includes(n.id)) return;
        Sfx.select();
        this.startBattle(n);
        break;
    }
  }

  private startBattle(n: MapNode) {
    this.moving = true;
    Sfx.stopMusic();
    // Flash de encontro
    this.cameras.main.flash(250, 255, 255, 255);
    this.cameras.main.shake(300, 0.008);
    this.time.delayedCall(350, () => {
      fadeToScene(this, 'Battle', { enemyId: n.enemyId, nodeId: n.id, bg: n.battleBg }, 300);
    });
  }

  // ---------- Mensagens ----------

  private async flashMessage(text: string) {
    const w = 560;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT - 158;
    const panel = makePanel(this, x, y, w, 40, 0.95).setDepth(40);
    const t = makeText(this, GAME_WIDTH / 2, y + 20, text, 8, '#ffd54f').setOrigin(0.5).setDepth(41);
    await new Promise((r) => this.time.delayedCall(1800, r));
    this.tweens.add({
      targets: [panel, t],
      alpha: 0,
      duration: 300,
      onComplete: () => {
        panel.destroy();
        t.destroy();
      },
    });
  }

  private async playIntro(heroName: string) {
    this.introMode = true;
    const lines = [
      `${heroName}, a bolha dev está em perigo.`,
      'REAL OFICIAL transformou tudo em cortes de 15 segundos.',
      'Ninguém mais lê documentação. Ninguém mais termina um vídeo.',
      'Atravesse o mapa, derrote o Élio e acabe com o reinado dos cortes!',
    ];
    const w = 640;
    const x = (GAME_WIDTH - w) / 2;
    const y = 130;
    const panel = makePanel(this, x, y, w, 110, 0.96).setDepth(60);
    const txt = makeText(this, x + 20, y + 20, '', 10, COLORS.text, { wordWrap: { width: w - 40 } }).setDepth(61);
    const hint = makeText(this, x + w - 20, y + 92, 'clique ou tecle para continuar...', 8, COLORS.textDim)
      .setOrigin(1, 1)
      .setDepth(61);
    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.01)
      .setInteractive()
      .setDepth(59);

    for (const line of lines) {
      hint.setVisible(false);
      await typewrite(this, txt, line, 22);
      hint.setVisible(true);
      await new Promise<void>((resolve) => {
        const done = () => {
          this.input.keyboard?.off('keydown', done);
          overlay.off('pointerdown', done);
          resolve();
        };
        overlay.once('pointerdown', done);
        this.input.keyboard?.once('keydown', done);
      });
    }
    panel.destroy();
    txt.destroy();
    hint.destroy();
    overlay.destroy();
    this.introMode = false;
  }
}
