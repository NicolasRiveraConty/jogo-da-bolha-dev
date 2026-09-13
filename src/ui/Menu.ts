import Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { PixelButton } from './ui';

export interface MenuItem {
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}

/** Menu vertical com navegação por teclado (↑ ↓ ENTER ESC) e mouse. */
export class Menu extends Phaser.GameObjects.Container {
  private buttons: PixelButton[] = [];
  private index = 0;
  private enabled = true;
  private keyHandlers: Array<[string, (e: KeyboardEvent) => void]> = [];
  onBack?: () => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    items: MenuItem[],
    private opts: { width?: number; height?: number; gap?: number; size?: 8 | 10 | 12 } = {},
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setItems(items);
    this.bindKeys();
  }

  setItems(items: MenuItem[]) {
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [];
    const h = this.opts.height ?? 36;
    const gap = this.opts.gap ?? 6;
    items.forEach((it, i) => {
      const btn = new PixelButton(this.scene, 0, i * (h + gap), it.label, {
        width: this.opts.width ?? 220,
        height: h,
        size: this.opts.size ?? 10,
        disabled: it.disabled,
      });
      btn.onClick = () => {
        if (!this.enabled) return;
        it.onSelect();
      };
      btn.on('pointerover', () => {
        if (!this.enabled) return;
        this.index = i;
        this.highlight();
      });
      this.add(btn);
      this.buttons.push(btn);
    });
    this.index = Math.max(0, items.findIndex((it) => !it.disabled));
    this.highlight();
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    this.setAlpha(v ? 1 : 0.6);
    if (v) this.highlight();
    else this.buttons.forEach((b) => b.setHighlighted(false));
  }

  private highlight() {
    this.buttons.forEach((b, i) => b.setHighlighted(i === this.index && this.enabled));
  }

  private move(dir: number) {
    if (!this.enabled || this.buttons.length === 0) return;
    Sfx.hover();
    this.index = (this.index + dir + this.buttons.length) % this.buttons.length;
    this.highlight();
  }

  private bindKeys() {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    const on = (key: string, fn: (e: KeyboardEvent) => void) => {
      kb.on(key, fn);
      this.keyHandlers.push([key, fn]);
    };
    on('keydown-UP', () => this.move(-1));
    on('keydown-DOWN', () => this.move(1));
    on('keydown-W', () => this.move(-1));
    on('keydown-S', () => this.move(1));
    on('keydown-ENTER', () => this.activate());
    on('keydown-SPACE', () => this.activate());
    on('keydown-ESC', () => {
      if (this.enabled && this.onBack) {
        Sfx.back();
        this.onBack();
      }
    });
    on('keydown-BACKSPACE', () => {
      if (this.enabled && this.onBack) {
        Sfx.back();
        this.onBack();
      }
    });
  }

  private activate() {
    if (!this.enabled) return;
    const btn = this.buttons[this.index];
    if (!btn) return;
    btn.emit('pointerdown');
  }

  destroy(fromScene?: boolean) {
    const kb = this.scene?.input?.keyboard;
    if (kb) this.keyHandlers.forEach(([k, fn]) => kb.off(k, fn));
    this.keyHandlers = [];
    super.destroy(fromScene);
  }
}
