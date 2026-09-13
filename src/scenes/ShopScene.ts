import Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { ITEMS } from '../data/items';
import { GameState } from '../state/GameState';
import { fadeIn, fadeToScene, makePanel, makeText, PixelButton, typewrite } from '../ui/ui';
import { addMuteButton } from '../ui/mute';

const HOTFIX_PRICE = 20;

const WILLIAM_LINES = [
  'Fala, campeão! Tenho oferta especial pra você hoje. Só hoje. Sempre é só hoje.',
  'Esse café aqui? Fechou 3 contratos essa semana. Leva dois.',
  'Se levar a pizza eu jogo um desconto... brincadeira, preço é preço.',
  'Volta sempre! Indica pros amigos! Tem programa de indicação!',
];

const ANDERSON_LINES = [
  'Deixa eu ver seu HP... hmm, isso é um bug conhecido. Vou fazer um hotfix.',
  'Funciona na minha máquina. Mas vou dar uma olhada em você.',
  'Não testei em produção, mas confia.',
  'Pronto. Fiz o deploy direto na main. Sexta-feira ainda por cima.',
];

export class ShopScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private dialogText!: Phaser.GameObjects.Text;
  private itemButtons: PixelButton[] = [];
  private qtyTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Shop');
  }

  create() {
    this.itemButtons = [];
    this.qtyTexts = [];

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_map').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.5);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b0a14, 0.5);

    makeText(this, GAME_WIDTH / 2, 28, 'BARRACA DA CONTY', 20, '#ffd54f').setOrigin(0.5);

    // Personagens
    this.drawNpc(150, 190, 'portrait_william', 'WILLIAM', 'Vendedor', 0x81c784);
    this.drawNpc(GAME_WIDTH - 150, 190, 'portrait_anderson', 'ANDERSON', 'Desenvolvedor', 0xba68c8);

    // Diálogo
    const dx = 250;
    const dw = GAME_WIDTH - 500;
    makePanel(this, dx, 70, dw, 70, 0.95);
    this.dialogText = makeText(this, dx + 16, 84, '', 8, COLORS.text, { wordWrap: { width: dw - 32 } });
    void typewrite(this, this.dialogText, WILLIAM_LINES[0], 16);

    // Loja
    const px = 250;
    const py = 155;
    const pw = GAME_WIDTH - 500;
    makePanel(this, px, py, pw, 250, 0.95);
    makeText(this, px + 16, py + 12, 'ITENS À VENDA', 10, '#ffd54f');
    this.goldText = makeText(this, px + pw - 16, py + 12, '', 10, COLORS.gold).setOrigin(1, 0);

    ITEMS.forEach((item, i) => {
      const y = py + 48 + i * 52;
      makeText(this, px + 16, y, item.name, 10, COLORS.text);
      makeText(this, px + 16, y + 16, item.description, 8, COLORS.textDim, { wordWrap: { width: 270 } });
      const qty = makeText(this, px + pw - 130, y + 6, '', 8, COLORS.highlight).setOrigin(1, 0);
      this.qtyTexts.push(qty);
      const btn = new PixelButton(this, px + pw - 70, y + 12, `$${item.price}`, { width: 100, height: 34, size: 10 });
      btn.onClick = () => this.buy(i);
      this.itemButtons.push(btn);
    });

    // Anderson hotfix
    const hy = py + 205;
    makeText(this, px + 16, hy, 'Hotfix do Anderson', 10, COLORS.text);
    makeText(this, px + 16, hy + 16, 'Restaura HP e MP completamente.', 8, COLORS.textDim, { wordWrap: { width: 270 } });
    const hotfix = new PixelButton(this, px + pw - 70, hy + 12, `$${HOTFIX_PRICE}`, { width: 100, height: 34, size: 10 });
    hotfix.onClick = () => this.hotfix();

    this.statusText = makeText(this, GAME_WIDTH / 2, py + 262, '', 8, COLORS.textDim).setOrigin(0.5);

    const back = new PixelButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, 'VOLTAR AO MAPA', { width: 260, height: 40 });
    back.onClick = () => this.leave();
    this.input.keyboard?.on('keydown-ESC', () => this.leave());

    addMuteButton(this);
    this.refresh();
    fadeIn(this);
  }

  private drawNpc(x: number, y: number, key: string, name: string, role: string, accent: number) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(x, y + 92, 120, 22);
    g.fillStyle(accent, 1);
    g.fillRoundedRect(x - 78, y - 78, 156, 156, 8);
    g.lineStyle(3, 0xf5e6c8, 1);
    g.strokeRoundedRect(x - 78, y - 78, 156, 156, 8);
    const img = this.add.image(x, y, key);
    const s = 148 / Math.max(img.width, img.height);
    img.setScale(s);
    makeText(this, x, y + 100, name, 12, '#ffd54f').setOrigin(0.5);
    makeText(this, x, y + 120, role, 8, COLORS.textDim).setOrigin(0.5);
    this.tweens.add({ targets: img, y: y - 3, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private refresh() {
    const save = GameState.get();
    const max = GameState.maxStats();
    this.goldText.setText(`$${save.gold}`);
    ITEMS.forEach((item, i) => {
      this.qtyTexts[i].setText(`x${save.items[item.id] ?? 0}`);
      this.itemButtons[i].setDisabled(save.gold < item.price);
    });
    this.statusText.setText(`HP ${save.hp}/${max.hp}   MP ${save.mp}/${max.mp}`);
  }

  private buy(i: number) {
    const item = ITEMS[i];
    const save = GameState.get();
    if (save.gold < item.price) {
      Sfx.miss();
      void typewrite(this, this.dialogText, 'William: "Sem grana? Tenho um parcelamento em 12x... brincadeira."', 12);
      return;
    }
    save.gold -= item.price;
    GameState.addItem(item.id);
    Sfx.coin();
    this.refresh();
    const line = WILLIAM_LINES[1 + Math.floor(Math.random() * (WILLIAM_LINES.length - 1))];
    void typewrite(this, this.dialogText, `William: "${line}"`, 12);
  }

  private hotfix() {
    const save = GameState.get();
    const max = GameState.maxStats();
    if (save.hp >= max.hp && save.mp >= max.mp) {
      void typewrite(this, this.dialogText, 'Anderson: "Não tem bug nenhum aqui. Você tá 100%. Vai lá."', 12);
      return;
    }
    if (save.gold < HOTFIX_PRICE) {
      Sfx.miss();
      void typewrite(this, this.dialogText, 'Anderson: "Hotfix de graça só na próxima sprint. Sem grana, sem deploy."', 12);
      return;
    }
    save.gold -= HOTFIX_PRICE;
    GameState.fullHeal();
    Sfx.heal();
    this.cameras.main.flash(300, 120, 255, 160);
    this.refresh();
    const line = ANDERSON_LINES[Math.floor(Math.random() * ANDERSON_LINES.length)];
    void typewrite(this, this.dialogText, `Anderson: "${line}"`, 12);
  }

  private leave() {
    Sfx.back();
    fadeToScene(this, 'Map');
  }
}
