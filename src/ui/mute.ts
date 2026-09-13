import Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { GAME_WIDTH } from '../config';
import { makeText } from './ui';

export function addMuteButton(scene: Phaser.Scene): Phaser.GameObjects.Text {
  const label = () => (Sfx.muted ? '[SOM: OFF]' : '[SOM: ON]');
  const t = makeText(scene, GAME_WIDTH - 12, 10, label(), 8, '#a89f8c')
    .setOrigin(1, 0)
    .setDepth(1000)
    .setInteractive({ useHandCursor: true });
  t.on('pointerdown', () => {
    Sfx.unlock();
    Sfx.toggleMute();
    t.setText(label());
  });
  t.on('pointerover', () => t.setColor('#ffd54f'));
  t.on('pointerout', () => t.setColor('#a89f8c'));
  return t;
}
