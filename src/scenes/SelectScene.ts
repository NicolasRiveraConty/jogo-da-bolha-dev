import Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { HEROES } from '../data/heroes';
import type { HeroDef } from '../data/types';
import { GameState } from '../state/GameState';
import { fadeIn, fadeToScene, makePanel, makeText, PixelButton, upper } from '../ui/ui';
import { addMuteButton } from '../ui/mute';

export class SelectScene extends Phaser.Scene {
  private selected = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private frames: Phaser.GameObjects.Graphics[] = [];
  private detailTexts: Phaser.GameObjects.Text[] = [];
  private confirmBtn!: PixelButton;

  constructor() {
    super('Select');
  }

  create() {
    this.cards = [];
    this.frames = [];
    this.detailTexts = [];
    this.selected = 0;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_title').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.35);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b0a14, 0.55);

    makeText(this, GAME_WIDTH / 2, 30, upper('Escolha seu herói'), 20, '#ffd54f').setOrigin(0.5);
    makeText(this, GAME_WIDTH / 2, 60, 'Setas ou A/D para navegar, ENTER para confirmar', 8, COLORS.textDim).setOrigin(0.5);

    const cardW = 200;
    const cardH = 250;
    const gap = 30;
    const totalW = HEROES.length * cardW + (HEROES.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;
    const cardY = 215;

    HEROES.forEach((hero, i) => {
      const x = startX + i * (cardW + gap);
      const c = this.add.container(x, cardY);
      const frame = this.add.graphics();
      c.add(frame);
      this.frames.push(frame);

      const portrait = this.add.image(0, -50, hero.portraitKey);
      const s = Math.min(140 / portrait.width, 140 / portrait.height);
      portrait.setScale(s);
      c.add(portrait);

      c.add(makeText(this, 0, 40, upper(hero.name), 14, '#ffd54f').setOrigin(0.5));
      c.add(makeText(this, 0, 62, hero.title, 8, COLORS.text).setOrigin(0.5));
      c.add(makeText(this, 0, 80, hero.company, 8, COLORS.textDim).setOrigin(0.5));

      const hit = this.add.rectangle(0, 0, cardW, cardH, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        if (this.selected !== i) {
          Sfx.hover();
          this.select(i);
        }
      });
      hit.on('pointerdown', () => {
        if (this.selected === i) this.confirm();
        else {
          Sfx.select();
          this.select(i);
        }
      });
      c.add(hit);
      this.cards.push(c);
    });

    // Painel de detalhes
    const panelY = 355;
    makePanel(this, 80, panelY, GAME_WIDTH - 160, 120);
    for (let i = 0; i < 5; i++) {
      this.detailTexts.push(makeText(this, 100, panelY + 14 + i * 20, '', 8));
    }

    this.confirmBtn = new PixelButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 38, 'CONFIRMAR', {
      width: 240,
      height: 40,
    });
    this.confirmBtn.onClick = () => this.confirm();

    const back = makeText(this, 16, GAME_HEIGHT - 20, '< VOLTAR', 8, COLORS.textDim)
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      Sfx.back();
      fadeToScene(this, 'Title');
    });

    this.input.keyboard?.on('keydown-LEFT', () => {
      Sfx.hover();
      this.select((this.selected + HEROES.length - 1) % HEROES.length);
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      Sfx.hover();
      this.select((this.selected + 1) % HEROES.length);
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard?.on('keydown-ESC', () => fadeToScene(this, 'Title'));

    addMuteButton(this);
    this.select(0);
    fadeIn(this);
  }

  private select(i: number) {
    this.selected = i;
    const cardW = 200;
    const cardH = 250;
    this.frames.forEach((f, idx) => {
      f.clear();
      const active = idx === i;
      f.fillStyle(active ? 0x1c2c55 : COLORS.panelBg, active ? 0.95 : 0.8);
      f.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
      f.lineStyle(3, active ? 0xffd54f : COLORS.panelBorder, active ? 1 : 0.6);
      f.strokeRoundedRect(-cardW / 2 + 1.5, -cardH / 2 + 1.5, cardW - 3, cardH - 3, 6);
      this.tweens.add({
        targets: this.cards[idx],
        scale: active ? 1.06 : 1,
        duration: 150,
        ease: 'Quad.easeOut',
      });
    });
    this.showDetails(HEROES[i]);
  }

  private showDetails(h: HeroDef) {
    const b = h.base;
    const lines = [
      h.description,
      `HP ${b.hp}   MP ${b.mp}   ATK ${b.atk}   DEF ${b.def}   SPD ${b.spd}`,
      ...h.skills.map((s) => `• ${s.name} (${s.mpCost} MP): ${s.description}`),
    ];
    this.detailTexts.forEach((t, i) => {
      t.setText(lines[i] ?? '');
      t.setColor(i === 0 ? COLORS.text : i === 1 ? COLORS.highlight : '#cfe8ff');
    });
  }

  private confirm() {
    const hero = HEROES[this.selected];
    Sfx.select();
    GameState.newGame(hero.id);
    fadeToScene(this, 'Map', { intro: true });
  }
}
