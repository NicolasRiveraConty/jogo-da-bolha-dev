import Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { heroById } from '../data/heroes';
import { GameState } from '../state/GameState';
import { fadeIn, fadeToScene, makePanel, makeText, PixelButton, typewrite } from '../ui/ui';
import { addMuteButton } from '../ui/mute';

interface EndData {
  won: boolean;
  enemyName?: string;
}

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create(data: EndData) {
    const save = GameState.get();
    const hero = heroById(save.heroId);
    const cx = GAME_WIDTH / 2;

    this.add.image(cx, GAME_HEIGHT / 2, data.won ? 'bg_title' : 'bg_throne').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(data.won ? 1 : 0.4);
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, data.won ? 0x000000 : 0x2a0a0a, data.won ? 0.35 : 0.6);

    if (data.won) {
      Sfx.playMusic('victory');
      makeText(this, cx, 70, 'VENCEU!', 32, '#ffd54f', {
        shadow: { offsetX: 4, offsetY: 4, color: '#000', fill: true, blur: 0 },
      }).setOrigin(0.5);
      makeText(this, cx, 112, 'REAL OFICIAL foi derrotado', 12).setOrigin(0.5);

      const w = 640;
      const x = (GAME_WIDTH - w) / 2;
      const y = 150;
      makePanel(this, x, y, w, 185, 0.92);
      const txt = makeText(this, x + 20, y + 20, '', 10, COLORS.text, { wordWrap: { width: w - 40 }, lineSpacing: 8 });
      const story = [
        `${hero.name} encerrou o reinado dos cortes.`,
        'O escudeiro Elio finalmente cancelou a cobrança recorrente.',
        'A bolha dev voltou a assistir vídeos até o fim.',
        `Conty e Fitfolio celebraram com café e whey.`,
        '',
        `Nível final: ${save.level}   Ouro: $${save.gold}`,
      ].join('\n');
      void typewrite(this, txt, story, 14);

      const portrait = this.add.image(cx, 393, hero.portraitKey);
      const s = 90 / Math.max(portrait.width, portrait.height);
      portrait.setScale(s);
      const ring = this.add.graphics();
      ring.lineStyle(4, 0xffd54f, 1);
      ring.strokeRect(cx - 47, 346, 94, 94);
      this.tweens.add({ targets: ring, alpha: 0.6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      // Confetes
      for (let i = 0; i < 60; i++) {
        const c = this.add.rectangle(
          Phaser.Math.Between(0, GAME_WIDTH),
          Phaser.Math.Between(-400, -10),
          6,
          6,
          Phaser.Utils.Array.GetRandom([0xffd54f, 0xef5350, 0x4fc3f7, 0x81c784, 0xffffff]),
        );
        this.tweens.add({
          targets: c,
          y: GAME_HEIGHT + 20,
          angle: Phaser.Math.Between(180, 720),
          duration: Phaser.Math.Between(3000, 6000),
          delay: Phaser.Math.Between(0, 2500),
          repeat: -1,
        });
      }
    } else {
      makeText(this, cx, 90, 'GAME OVER', 32, '#ef5350', {
        shadow: { offsetX: 4, offsetY: 4, color: '#000', fill: true, blur: 0 },
      }).setOrigin(0.5);
      makeText(this, cx, 135, `${data.enemyName ?? 'O inimigo'} virou você em corte.`, 10).setOrigin(0.5);

      const w = 600;
      const x = (GAME_WIDTH - w) / 2;
      const y = 180;
      makePanel(this, x, y, w, 150, 0.92);
      const txt = makeText(this, x + 20, y + 20, '', 10, COLORS.text, { wordWrap: { width: w - 40 }, lineSpacing: 8 });
      void typewrite(
        this,
        txt,
        [
          'Você acorda no acampamento com o HP restaurado.',
          'Perdeu 25% do ouro no caminho (taxa do escudeiro).',
          '',
          'Dica: use DEFENDER para recuperar MP, compre Café na barraca e suba de nível antes do boss.',
        ].join('\n'),
        12,
      );
    }

    const btnY = GAME_HEIGHT - 60;
    if (data.won) {
      const again = new PixelButton(this, cx - 140, btnY, 'JOGAR DE NOVO', { width: 260, height: 44 });
      again.onClick = () => {
        GameState.clear();
        fadeToScene(this, 'Select');
      };
      const title = new PixelButton(this, cx + 140, btnY, 'TELA INICIAL', { width: 260, height: 44 });
      title.onClick = () => fadeToScene(this, 'Title');
    } else {
      const retry = new PixelButton(this, cx - 140, btnY, 'TENTAR DE NOVO', { width: 260, height: 44 });
      retry.onClick = () => fadeToScene(this, 'Map');
      const title = new PixelButton(this, cx + 140, btnY, 'TELA INICIAL', { width: 260, height: 44 });
      title.onClick = () => fadeToScene(this, 'Title');
      this.input.keyboard?.once('keydown-ENTER', () => fadeToScene(this, 'Map'));
    }

    addMuteButton(this);
    fadeIn(this, 800);
  }
}
