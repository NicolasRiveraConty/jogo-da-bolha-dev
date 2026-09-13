import Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { GameState } from '../state/GameState';
import { fadeIn, fadeToScene, makeText, PixelButton } from '../ui/ui';
import { addMuteButton } from '../ui/mute';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const bg = this.add.image(cx, GAME_HEIGHT / 2, 'bg_title').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    // Leve "respiração" no fundo
    this.tweens.add({
      targets: bg,
      scaleX: bg.scaleX * 1.03,
      scaleY: bg.scaleY * 1.03,
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Vinheta para destacar o título
    const vignette = this.add.graphics();
    vignette.fillStyle(0x000000, 0.35);
    vignette.fillRect(0, 0, GAME_WIDTH, 170);
    vignette.fillStyle(0x000000, 0.45);
    vignette.fillRect(0, GAME_HEIGHT - 190, GAME_WIDTH, 190);

    const subtitle = makeText(this, cx, 52, 'UM RPG DA', 10, COLORS.textDim).setOrigin(0.5);
    const title = makeText(this, cx, 100, 'JOGO DA BOLHA DEV', 32, '#ffd54f', {
      shadow: { offsetX: 4, offsetY: 4, color: '#000', fill: true, blur: 0 },
    }).setOrigin(0.5);
    this.tweens.add({
      targets: [title],
      y: 104,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    makeText(this, cx, 140, 'Derrote o REAL OFICIAL', 10, '#f5e6c8').setOrigin(0.5);
    subtitle.setAlpha(0.9);

    const hasSave = GameState.hasSave();
    let y = GAME_HEIGHT - 140;

    if (hasSave) {
      const cont = new PixelButton(this, cx, y, 'CONTINUAR', { width: 260, height: 44 });
      cont.onClick = () => {
        Sfx.unlock();
        GameState.load();
        fadeToScene(this, 'Map');
      };
      y += 54;
    }

    const novo = new PixelButton(this, cx, y, hasSave ? 'NOVO JOGO' : 'INICIAR', {
      width: 260,
      height: 44,
    });
    novo.onClick = () => {
      Sfx.unlock();
      if (hasSave) GameState.clear();
      fadeToScene(this, 'Select');
    };

    makeText(
      this,
      cx,
      GAME_HEIGHT - 24,
      'Conty x Fitfolio  -  Pixel RPG  -  Sem login, so coragem',
      8,
      COLORS.textDim,
    ).setOrigin(0.5);

    addMuteButton(this);

    this.input.once('pointerdown', () => {
      Sfx.unlock();
      Sfx.playMusic('title');
    });
    this.input.keyboard?.once('keydown', () => {
      Sfx.unlock();
      Sfx.playMusic('title');
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      Sfx.unlock();
      if (hasSave) {
        GameState.load();
        fadeToScene(this, 'Map');
      } else {
        fadeToScene(this, 'Select');
      }
    });

    fadeIn(this);
  }
}
