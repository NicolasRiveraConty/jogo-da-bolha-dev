import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { EndScene } from './scenes/EndScene';
import { MapScene } from './scenes/MapScene';
import { SelectScene } from './scenes/SelectScene';
import { ShopScene } from './scenes/ShopScene';
import { TitleScene } from './scenes/TitleScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0a14',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, SelectScene, MapScene, ShopScene, BattleScene, EndScene],
});
