import Phaser from 'phaser';
import { IMAGES, PLACEHOLDER_COLORS, PLACEHOLDER_SIZES } from '../assets';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { makeText } from '../ui/ui';

export class BootScene extends Phaser.Scene {
  private failed = new Set<string>();

  constructor() {
    super('Boot');
  }

  preload() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.cameras.main.setBackgroundColor('#0b0a14');
    makeText(this, cx, cy - 50, 'JOGO DA BOLHA DEV', 20, '#ffd54f').setOrigin(0.5);
    const label = makeText(this, cx, cy + 40, 'Carregando... 0%', 10).setOrigin(0.5);

    const barW = 400;
    const g = this.add.graphics();
    this.load.on('progress', (p: number) => {
      g.clear();
      g.fillStyle(0x1b1b2b, 1);
      g.fillRect(cx - barW / 2, cy - 8, barW, 16);
      g.fillStyle(0xffd54f, 1);
      g.fillRect(cx - barW / 2 + 2, cy - 6, (barW - 4) * p, 12);
      label.setText(`Carregando... ${Math.round(p * 100)}%`);
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.failed.add(file.key);
    });

    for (const [key, path] of Object.entries(IMAGES)) {
      this.load.image(key, path);
    }
  }

  create() {
    // Gera placeholders para qualquer arte que não tenha carregado.
    for (const key of Object.keys(IMAGES)) {
      if (this.failed.has(key) || !this.textures.exists(key)) {
        this.makePlaceholder(key);
      }
    }

    const start = () => this.scene.start('Title');
    // Garante a fonte pixel carregada antes de desenhar as telas.
    if (document.fonts?.load) {
      Promise.race([
        document.fonts.load('12px "Press Start 2P"'),
        new Promise((r) => setTimeout(r, 1500)),
      ]).then(start, start);
    } else {
      start();
    }
  }

  private makePlaceholder(key: string) {
    const [w, h] = PLACEHOLDER_SIZES[key] ?? [128, 128];
    const color = PLACEHOLDER_COLORS[key] ?? 0x888888;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 1);
    if (key.startsWith('bg_')) {
      g.fillRect(0, 0, w, h);
      g.fillStyle(0x000000, 0.15);
      for (let y = 0; y < h; y += 24) g.fillRect(0, y, w, 12);
    } else {
      g.fillRoundedRect(0, 0, w, h, 12);
      g.lineStyle(4, 0xffffff, 0.6);
      g.strokeRoundedRect(2, 2, w - 4, h - 4, 12);
    }
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
