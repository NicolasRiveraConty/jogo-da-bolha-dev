import Phaser from 'phaser';
import { COLORS, FONT } from '../config';
import { Sfx } from '../audio/Sfx';

export type TextSize = 8 | 10 | 12 | 14 | 16 | 20 | 24 | 32;

/**
 * Caixa alta sem acentos. A fonte "Press Start 2P" não tem maiúsculas acentuadas,
 * então removemos os diacríticos para evitar fallback de fonte.
 */
export function upper(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function textStyle(
  size: TextSize = 12,
  color: string = COLORS.text,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    stroke: '#000000',
    strokeThickness: size >= 20 ? 6 : 3,
    ...extra,
  };
}

export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: TextSize = 12,
  color: string = COLORS.text,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, textStyle(size, color, extra));
  t.setResolution(2);
  return t;
}

/** Painel estilo JRPG: fundo azul-escuro com borda dupla clara. */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 0.92,
): void {
  g.fillStyle(COLORS.panelBg, alpha);
  g.fillRoundedRect(x, y, w, h, 4);
  g.lineStyle(3, COLORS.panelBorder, 1);
  g.strokeRoundedRect(x + 1.5, y + 1.5, w - 3, h - 3, 4);
  g.lineStyle(1, COLORS.panelBorderDark, 1);
  g.strokeRoundedRect(x + 5.5, y + 5.5, w - 11, h - 11, 2);
}

export function makePanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 0.92,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawPanel(g, x, y, w, h, alpha);
  return g;
}

export interface ButtonOpts {
  width?: number;
  height?: number;
  size?: TextSize;
  color?: string;
  disabled?: boolean;
}

export class PixelButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private bw: number;
  private bh: number;
  private hovered = false;
  private disabled: boolean;
  onClick?: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, opts: ButtonOpts = {}) {
    super(scene, x, y);
    this.bw = opts.width ?? 200;
    this.bh = opts.height ?? 40;
    this.disabled = opts.disabled ?? false;
    this.bg = scene.add.graphics();
    this.label = makeText(scene, 0, 0, text, opts.size ?? 12, opts.color ?? COLORS.text).setOrigin(
      0.5,
    );
    this.add([this.bg, this.label]);
    this.setSize(this.bw, this.bh);
    this.setInteractive({ useHandCursor: !this.disabled });
    this.on('pointerover', () => {
      if (this.disabled) return;
      this.hovered = true;
      Sfx.hover();
      this.redraw();
    });
    this.on('pointerout', () => {
      this.hovered = false;
      this.redraw();
    });
    this.on('pointerdown', () => {
      if (this.disabled) return;
      Sfx.select();
      this.onClick?.();
    });
    this.redraw();
    scene.add.existing(this);
  }

  setDisabled(v: boolean): this {
    this.disabled = v;
    this.redraw();
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  setHighlighted(v: boolean): this {
    this.hovered = v;
    this.redraw();
    return this;
  }

  private redraw() {
    const g = this.bg;
    g.clear();
    const x = -this.bw / 2;
    const y = -this.bh / 2;
    g.fillStyle(this.hovered ? 0x2a3d6e : COLORS.panelBg, this.disabled ? 0.5 : 0.95);
    g.fillRoundedRect(x, y, this.bw, this.bh, 3);
    g.lineStyle(2, this.hovered ? 0xffd54f : COLORS.panelBorder, this.disabled ? 0.4 : 1);
    g.strokeRoundedRect(x + 1, y + 1, this.bw - 2, this.bh - 2, 3);
    this.label.setAlpha(this.disabled ? 0.45 : 1);
    if (this.hovered && !this.disabled) {
      g.fillStyle(0xffd54f, 1);
      g.fillTriangle(x + 10, y + this.bh / 2 - 5, x + 10, y + this.bh / 2 + 5, x + 18, y + this.bh / 2);
    }
  }
}

export class StatBar extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private bw: number;
  private bh: number;
  private color: number;
  private lowColor?: number;
  private value = 1;
  private display = 1;
  private cur = 0;
  private max = 0;
  private barName: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    name: string,
    color: number,
    lowColor?: number,
  ) {
    super(scene, x, y);
    this.bw = w;
    this.bh = h;
    this.color = color;
    this.lowColor = lowColor;
    this.barName = name;
    this.g = scene.add.graphics();
    this.label = makeText(scene, w, -2, '', 8).setOrigin(1, 1);
    this.add([this.g, this.label]);
    scene.add.existing(this);
    this.redraw();
  }

  set(cur: number, max: number, animate = true) {
    this.cur = Math.max(0, cur);
    this.max = max;
    this.value = max > 0 ? Phaser.Math.Clamp(cur / max, 0, 1) : 0;
    this.label.setText(`${this.barName} ${Math.round(this.cur)}/${this.max}`);
    if (!animate) {
      this.display = this.value;
      this.redraw();
      return;
    }
    const proxy = { v: this.display };
    this.scene.tweens.add({
      targets: proxy,
      v: this.value,
      duration: 400,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.display = proxy.v;
        this.redraw();
      },
    });
  }

  private redraw() {
    const g = this.g;
    g.clear();
    g.fillStyle(0x000000, 0.8);
    g.fillRect(-2, -2, this.bw + 4, this.bh + 4);
    g.fillStyle(COLORS.barBg, 1);
    g.fillRect(0, 0, this.bw, this.bh);
    const useLow = this.lowColor !== undefined && this.display < 0.3;
    g.fillStyle(useLow ? this.lowColor! : this.color, 1);
    g.fillRect(0, 0, Math.round(this.bw * this.display), this.bh);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(0, 0, Math.round(this.bw * this.display), Math.max(1, Math.floor(this.bh / 3)));
  }
}

/** Efeito de "máquina de escrever" para diálogos. Retorna uma Promise que resolve ao terminar. */
export function typewrite(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Text,
  text: string,
  msPerChar = 18,
): Promise<void> {
  return new Promise((resolve) => {
    target.setText('');
    let i = 0;
    const timer = scene.time.addEvent({
      delay: msPerChar,
      repeat: text.length - 1,
      callback: () => {
        i++;
        target.setText(text.slice(0, i));
        if (i % 3 === 0) Sfx.tick();
        if (i >= text.length) {
          timer.remove();
          resolve();
        }
      },
    });
  });
}

export function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
}

/** Texto flutuante (dano/cura) que sobe e desaparece. */
export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string,
  size: TextSize = 16,
): void {
  const t = makeText(scene, x, y, text, size, color).setOrigin(0.5).setDepth(50);
  scene.tweens.add({
    targets: t,
    y: y - 50,
    alpha: { from: 1, to: 0 },
    scale: { from: 1.3, to: 1 },
    duration: 900,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
}

export function fadeIn(scene: Phaser.Scene, ms = 400): void {
  scene.cameras.main.fadeIn(ms, 0, 0, 0);
}

export function fadeToScene(scene: Phaser.Scene, key: string, data?: object, ms = 400): void {
  scene.cameras.main.fadeOut(ms, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}
