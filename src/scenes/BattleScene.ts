import Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { BattleEngine, type BattleEvent, type HeroAction } from '../battle/BattleEngine';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { enemyById } from '../data/enemies';
import { heroById } from '../data/heroes';
import { ITEMS } from '../data/items';
import type { EnemyDef, HeroDef } from '../data/types';
import { GameState } from '../state/GameState';
import { Menu } from '../ui/Menu';
import { fadeIn, fadeToScene, floatText, makePanel, makeText, StatBar, typewrite, upper, wait } from '../ui/ui';
import { addMuteButton } from '../ui/mute';

interface BattleData {
  enemyId: string;
  nodeId: string;
  bg: string;
}

export class BattleScene extends Phaser.Scene {
  private engine!: BattleEngine;
  private heroDef!: HeroDef;
  private enemyDef!: EnemyDef;
  private battleData!: BattleData;

  private heroSprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;
  private enemyBaseX = 0;
  private enemyBaseY = 0;
  private heroBaseX = 0;
  private heroBaseY = 0;

  private heroHp!: StatBar;
  private heroMp!: StatBar;
  private enemyHp!: StatBar;
  private logText!: Phaser.GameObjects.Text;
  private menu!: Menu;
  private menuTitle!: Phaser.GameObjects.Text;
  private busy = true;
  private turnCount = 0;

  constructor() {
    super('Battle');
  }

  init(data: BattleData) {
    this.battleData = data;
  }

  create() {
    const save = GameState.get();
    this.heroDef = heroById(save.heroId);
    this.enemyDef = enemyById(this.battleData.enemyId);
    const stats = GameState.maxStats();
    this.engine = new BattleEngine(this.heroDef, stats, save.hp, save.mp, this.enemyDef);
    this.busy = true;
    this.turnCount = 0;

    // Fundo
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.battleData.bg).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    // Sombra suave na parte de baixo para os painéis
    const grad = this.add.graphics();
    grad.fillStyle(0x000000, 0.35);
    grad.fillRect(0, GAME_HEIGHT - 170, GAME_WIDTH, 170);

    // Inimigo
    this.enemyBaseX = 640;
    this.enemyBaseY = 235;
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.35);
    shadow.fillEllipse(this.enemyBaseX, this.enemyBaseY + 110, 200 * (this.enemyDef.scale ?? 1), 36);
    this.enemySprite = this.add.image(this.enemyBaseX + 200, this.enemyBaseY, this.enemyDef.spriteKey);
    const targetH = 230 * (this.enemyDef.scale ?? 1);
    this.enemySprite.setScale(targetH / this.enemySprite.height);
    this.enemySprite.setAlpha(0);

    // Herói (visto de costas)
    this.heroBaseX = 210;
    this.heroBaseY = 330;
    this.heroSprite = this.add.image(this.heroBaseX, this.heroBaseY, this.heroDef.spriteKey);
    const heroH = 250;
    this.heroSprite.setScale(heroH / this.heroSprite.height);
    this.heroSprite.setDepth(5);
    this.tweens.add({
      targets: this.heroSprite,
      y: this.heroBaseY - 3,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.buildUi();
    addMuteButton(this);

    Sfx.playMusic(this.enemyDef.isBoss ? 'boss' : 'battle');
    fadeIn(this, 300);
    void this.intro();
  }

  // ---------- UI ----------

  private buildUi() {
    // Painel do inimigo (topo direito)
    makePanel(this, GAME_WIDTH - 372, 30, 358, 62, 0.85).setDepth(20);
    const eName = this.enemyDef.title ? `${this.enemyDef.name} - ${this.enemyDef.title}` : this.enemyDef.name;
    makeText(this, GAME_WIDTH - 356, 42, eName, 8, this.enemyDef.isBoss ? '#ef5350' : '#ffd54f').setDepth(21);
    this.enemyHp = new StatBar(this, GAME_WIDTH - 356, 68, 326, 10, 'HP', COLORS.hp, COLORS.hpLow).setDepth(21);
    this.enemyHp.set(this.engine.enemy.hp, this.engine.enemy.maxHp, false);

    // Painel do herói (topo esquerdo)
    makePanel(this, 14, 30, 270, 84, 0.85).setDepth(20);
    const save = GameState.get();
    makeText(this, 28, 42, `${upper(this.heroDef.name)}  Nv.${save.level}`, 8, '#ffd54f').setDepth(21);
    this.heroHp = new StatBar(this, 28, 72, 242, 10, 'HP', COLORS.hp, COLORS.hpLow).setDepth(21);
    this.heroMp = new StatBar(this, 28, 96, 242, 8, 'MP', COLORS.mp).setDepth(21);
    this.heroHp.set(this.engine.hero.hp, this.engine.hero.maxHp, false);
    this.heroMp.set(this.engine.hero.mp, this.engine.hero.maxMp, false);

    // Log (embaixo, esquerda)
    const logX = 14;
    const logY = GAME_HEIGHT - 132;
    const logW = GAME_WIDTH - 14 - 270;
    makePanel(this, logX, logY, logW, 118, 0.92).setDepth(20);
    this.logText = makeText(this, logX + 18, logY + 18, '', 10, COLORS.text, {
      wordWrap: { width: logW - 36 },
      lineSpacing: 6,
    }).setDepth(21);

    // Menu (embaixo, direita)
    const menuX = GAME_WIDTH - 246;
    const menuY = GAME_HEIGHT - 132;
    makePanel(this, menuX - 10, menuY, 242, 118, 0.92).setDepth(20);
    this.menuTitle = makeText(this, menuX + 111, menuY - 10, '', 8, '#ffd54f').setOrigin(0.5).setDepth(22);
    this.menu = new Menu(this, menuX + 111, menuY + 20, [], { width: 214, height: 22, gap: 3, size: 8 });
    this.menu.setDepth(21);
    this.showMainMenu();
    this.menu.setEnabled(false);
  }

  private showMainMenu() {
    this.menuTitle.setText('');
    this.menu.onBack = undefined;
    this.menu.setItems([
      { label: 'ATACAR', onSelect: () => this.act({ type: 'attack' }) },
      { label: 'HABILIDADES', onSelect: () => this.showSkills() },
      { label: 'ITENS', onSelect: () => this.showItems() },
      { label: 'DEFENDER', onSelect: () => this.act({ type: 'defend' }) },
    ]);
  }

  private showSkills() {
    if (this.busy) return;
    const mp = this.engine.hero.mp;
    this.menuTitle.setText('HABILIDADES');
    this.menu.onBack = () => this.showMainMenu();
    this.menu.setItems([
      ...this.heroDef.skills.map((s) => ({
        label: `${s.name.length > 17 ? s.name.slice(0, 16) + '…' : s.name} ${s.mpCost}MP`,
        disabled: mp < s.mpCost,
        onSelect: () => this.act({ type: 'skill', skill: s }),
      })),
      { label: '< VOLTAR', onSelect: () => this.showMainMenu() },
    ]);
    this.setLog(this.heroDef.skills.map((s) => `${s.name}: ${s.description}`).join('\n'));
  }

  private showItems() {
    if (this.busy) return;
    const save = GameState.get();
    const owned = ITEMS.filter((i) => (save.items[i.id] ?? 0) > 0);
    this.menuTitle.setText('ITENS');
    this.menu.onBack = () => this.showMainMenu();
    if (owned.length === 0) {
      this.setLog('Você não tem itens. William tem uma barraca no mapa...');
    } else {
      this.setLog(owned.map((i) => `${i.name}: ${i.description}`).join('\n'));
    }
    this.menu.setItems([
      ...owned.map((i) => ({
        label: `${i.name.length > 15 ? i.name.slice(0, 14) + '…' : i.name} x${save.items[i.id]}`,
        onSelect: () => {
          GameState.removeItem(i.id);
          this.act({ type: 'item', item: i });
        },
      })),
      { label: '< VOLTAR', onSelect: () => this.showMainMenu() },
    ]);
  }

  private setLog(text: string) {
    this.logText.setText(text);
  }

  private refreshBars() {
    this.heroHp.set(this.engine.hero.hp, this.engine.hero.maxHp);
    this.heroMp.set(this.engine.hero.mp, this.engine.hero.maxMp);
    this.enemyHp.set(this.engine.enemy.hp, this.engine.enemy.maxHp);
  }

  // ---------- Fluxo ----------

  private async intro() {
    this.busy = true;
    await wait(this, 200);
    this.tweens.add({
      targets: this.enemySprite,
      x: this.enemyBaseX,
      alpha: 1,
      duration: 500,
      ease: 'Back.easeOut',
    });
    if (this.enemyDef.isBoss) {
      await wait(this, 300);
      Sfx.bossRoar();
      this.cameras.main.shake(500, 0.012);
    }
    await wait(this, 500);
    this.idleEnemy();
    await typewrite(this, this.logText, this.enemyDef.introLine, 16);
    await wait(this, 400);
    this.setLog(`O que ${this.heroDef.name} vai fazer?`);
    this.busy = false;
    this.menu.setEnabled(true);
  }

  private idleEnemy() {
    this.tweens.add({
      targets: this.enemySprite,
      y: this.enemyBaseY - 6,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private act(action: HeroAction) {
    if (this.busy) return;
    this.busy = true;
    this.menu.setEnabled(false);
    this.turnCount++;
    const events = this.engine.playTurn(action);
    void this.playEvents(events);
  }

  private async playEvents(events: BattleEvent[]) {
    for (const ev of events) {
      await this.playEvent(ev);
      this.refreshBars();
    }
    if (!this.engine.isOver) {
      await wait(this, 250);
      this.showMainMenu();
      this.setLog(`O que ${this.heroDef.name} vai fazer?`);
      this.busy = false;
      this.menu.setEnabled(true);
    }
  }

  private async playEvent(ev: BattleEvent) {
    switch (ev.type) {
      case 'log':
        await typewrite(this, this.logText, ev.text, 14);
        await wait(this, 350);
        break;
      case 'skill':
        Sfx.magic();
        this.showSkillBanner(ev.name, ev.color ?? (ev.side === 'hero' ? 0x4fc3f7 : 0xef5350));
        if (ev.side === 'hero') this.heroLunge();
        else this.enemyLunge();
        await wait(this, 500);
        break;
      case 'damage': {
        if (ev.target === 'enemy') {
          if (ev.crit) Sfx.crit();
          else Sfx.hit();
          this.hitEnemy(ev.crit);
          floatText(this, this.enemyBaseX, this.enemyBaseY - 60, `${ev.amount}${ev.crit ? '!' : ''}`, ev.crit ? '#ffd54f' : '#ffffff', ev.crit ? 24 : 20);
        } else {
          if (ev.crit) Sfx.crit();
          else Sfx.hit();
          this.hitHero(ev.crit);
          floatText(this, this.heroBaseX, this.heroBaseY - 140, `-${ev.amount}${ev.crit ? '!' : ''}`, ev.crit ? '#ff7043' : '#ef5350', ev.crit ? 24 : 20);
        }
        await wait(this, 550);
        break;
      }
      case 'miss':
        Sfx.miss();
        floatText(this, ev.target === 'enemy' ? this.enemyBaseX : this.heroBaseX, ev.target === 'enemy' ? this.enemyBaseY - 60 : this.heroBaseY - 140, 'ERROU', '#cfd8dc', 12);
        await wait(this, 400);
        break;
      case 'heal':
        Sfx.heal();
        this.flashSprite(ev.target === 'enemy' ? this.enemySprite : this.heroSprite, 0x81c784);
        floatText(this, ev.target === 'enemy' ? this.enemyBaseX : this.heroBaseX, ev.target === 'enemy' ? this.enemyBaseY - 60 : this.heroBaseY - 140, `+${ev.amount}`, '#81c784', 20);
        await wait(this, 500);
        break;
      case 'mp':
        if (ev.amount !== 0) {
          floatText(this, ev.target === 'enemy' ? this.enemyBaseX : this.heroBaseX, ev.target === 'enemy' ? this.enemyBaseY - 30 : this.heroBaseY - 110, `${ev.amount > 0 ? '+' : ''}${ev.amount} MP`, '#42a5f5', 12);
          await wait(this, 350);
        }
        break;
      case 'buff':
        if (ev.up) Sfx.buff();
        else Sfx.debuff();
        this.flashSprite(ev.target === 'enemy' ? this.enemySprite : this.heroSprite, ev.up ? 0xffd54f : 0xba68c8);
        floatText(this, ev.target === 'enemy' ? this.enemyBaseX : this.heroBaseX, ev.target === 'enemy' ? this.enemyBaseY - 60 : this.heroBaseY - 140, `${ev.stat.toUpperCase()} ${ev.up ? '+' : '-'}`, ev.up ? '#ffd54f' : '#ba68c8', 14);
        await wait(this, 500);
        break;
      case 'stun':
        Sfx.stun();
        this.flashSprite(this.enemySprite, 0xce93d8);
        floatText(this, this.enemyBaseX, this.enemyBaseY - 60, 'ATORDOADO', '#ce93d8', 14);
        await wait(this, 500);
        break;
      case 'defend':
        Sfx.buff();
        this.flashSprite(this.heroSprite, 0x90caf9);
        floatText(this, this.heroBaseX, this.heroBaseY - 140, 'DEFESA', '#90caf9', 14);
        await wait(this, 400);
        break;
      case 'phase2':
        Sfx.bossRoar();
        this.cameras.main.flash(400, 200, 30, 30);
        this.cameras.main.shake(600, 0.015);
        this.enemySprite.setTint(0xffb0b0);
        this.tweens.add({ targets: this.enemySprite, scale: this.enemySprite.scale * 1.08, duration: 400, ease: 'Back.easeOut' });
        await typewrite(this, this.logText, ev.text, 14);
        await wait(this, 700);
        break;
      case 'victory':
        await this.victory();
        break;
      case 'defeat':
        await this.defeat();
        break;
    }
  }

  // ---------- Animações ----------

  private showSkillBanner(name: string, color: number) {
    const y = 120;
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(0x000000, 0.7);
    g.fillRect(0, y - 22, GAME_WIDTH, 44);
    g.fillStyle(color, 1);
    g.fillRect(0, y - 24, GAME_WIDTH, 3);
    g.fillRect(0, y + 21, GAME_WIDTH, 3);
    const t = makeText(this, GAME_WIDTH / 2, y, upper(name), 16, '#ffffff').setOrigin(0.5).setDepth(41);
    t.setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: [g, t],
      alpha: 0,
      delay: 600,
      duration: 250,
      onComplete: () => {
        g.destroy();
        t.destroy();
      },
    });
  }

  private heroLunge() {
    this.tweens.add({
      targets: this.heroSprite,
      x: this.heroBaseX + 40,
      duration: 120,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private enemyLunge() {
    this.tweens.add({
      targets: this.enemySprite,
      x: this.enemyBaseX - 40,
      duration: 140,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private hitEnemy(crit: boolean) {
    this.enemySprite.setTintFill(0xffffff);
    this.time.delayedCall(90, () => this.enemySprite.clearTint());
    this.tweens.add({
      targets: this.enemySprite,
      x: { from: this.enemyBaseX - 12, to: this.enemyBaseX },
      duration: 60,
      repeat: 3,
      yoyo: true,
    });
    if (crit) this.cameras.main.shake(200, 0.006);
    this.spawnSlash(this.enemyBaseX, this.enemyBaseY);
  }

  private hitHero(crit: boolean) {
    this.heroSprite.setTintFill(0xff5252);
    this.time.delayedCall(110, () => this.heroSprite.clearTint());
    this.cameras.main.shake(crit ? 300 : 180, crit ? 0.012 : 0.006);
    this.tweens.add({
      targets: this.heroSprite,
      x: { from: this.heroBaseX + 10, to: this.heroBaseX },
      duration: 60,
      repeat: 3,
      yoyo: true,
    });
  }

  private flashSprite(sprite: Phaser.GameObjects.Image, color: number) {
    sprite.setTint(color);
    this.time.delayedCall(220, () => sprite.clearTint());
  }

  private spawnSlash(x: number, y: number) {
    const g = this.add.graphics().setDepth(30);
    g.lineStyle(6, 0xffffff, 1);
    g.beginPath();
    g.moveTo(x - 60, y - 60);
    g.lineTo(x + 60, y + 60);
    g.strokePath();
    g.lineStyle(3, 0xffd54f, 1);
    g.beginPath();
    g.moveTo(x - 50, y - 70);
    g.lineTo(x + 70, y + 50);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
  }

  // ---------- Fim da batalha ----------

  private async victory() {
    Sfx.stopMusic();
    Sfx.victory();
    this.tweens.killTweensOf(this.enemySprite);
    this.tweens.add({
      targets: this.enemySprite,
      alpha: 0,
      y: this.enemyBaseY + 40,
      duration: 700,
      ease: 'Quad.easeIn',
    });
    this.enemySprite.setTint(0x888888);

    const save = GameState.get();
    save.hp = this.engine.hero.hp;
    save.mp = this.engine.hero.mp;
    if (!save.cleared.includes(this.battleData.nodeId)) save.cleared.push(this.battleData.nodeId);
    save.gold += this.enemyDef.gold;
    if (this.enemyDef.isBoss) save.bossDefeated = true;
    GameState.save();
    const levelsGained = GameState.addXp(this.enemyDef.xp);

    await wait(this, 800);
    await typewrite(this, this.logText, `VENCEU! +${this.enemyDef.xp} XP   +$${this.enemyDef.gold}`, 14);
    Sfx.coin();
    await wait(this, 800);

    if (levelsGained > 0) {
      Sfx.levelUp();
      const s = GameState.maxStats();
      this.cameras.main.flash(400, 255, 230, 120);
      await typewrite(
        this,
        this.logText,
        `LEVEL UP! ${this.heroDef.name} subiu para o nível ${GameState.get().level}!\nHP ${s.hp}  MP ${s.mp}  ATK ${s.atk}  DEF ${s.def}  SPD ${s.spd}`,
        10,
      );
      await wait(this, 1200);
    }

    if (this.enemyDef.isBoss) {
      await wait(this, 400);
      fadeToScene(this, 'End', { won: true }, 800);
    } else {
      await wait(this, 500);
      fadeToScene(this, 'Map', { message: `${this.enemyDef.name} derrotado!` });
    }
  }

  private async defeat() {
    Sfx.stopMusic();
    Sfx.defeat();
    this.tweens.killTweensOf(this.heroSprite);
    this.tweens.add({ targets: this.heroSprite, alpha: 0.2, angle: 8, y: this.heroBaseY + 30, duration: 800 });
    const save = GameState.get();
    save.gold = Math.floor(save.gold * 0.75);
    const max = GameState.maxStats();
    save.hp = max.hp;
    save.mp = max.mp;
    GameState.save();
    await wait(this, 1200);
    fadeToScene(this, 'End', { won: false, enemyName: this.enemyDef.name }, 800);
  }
}
