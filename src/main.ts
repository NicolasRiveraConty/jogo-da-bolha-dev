import { Sfx } from './audio/Sfx';
import { Game } from './game/Game';
import { Hud } from './ui/Hud';

const hud = new Hud();
const game = new Game(hud, document.getElementById('app')!);

hud.showScreen(null);
hud.setHudVisible(false);

const $ = (id: string) => document.getElementById(id)!;

hud.buildHeroCards(
  (hero) => {
    Sfx.unlock();
    Sfx.select();
    game.start(hero);
  },
  () => Sfx.hover(),
);

$('btn-play').addEventListener('click', () => {
  Sfx.unlock();
  Sfx.select();
  Sfx.playMusic('title');
  hud.showScreen('select');
});
$('btn-back').addEventListener('click', () => {
  Sfx.back();
  hud.showScreen('title');
});
$('btn-resume').addEventListener('click', () => {
  Sfx.select();
  game.requestLock();
});
$('btn-quit').addEventListener('click', () => {
  Sfx.back();
  game.quitToTitle();
});
$('btn-respawn').addEventListener('click', () => {
  Sfx.select();
  game.respawn();
});
$('btn-again').addEventListener('click', () => {
  Sfx.select();
  game.quitToTitle();
  hud.showScreen('select');
});

// Clique no canvas durante o jogo (ex.: após ESC) volta a travar o cursor
game.renderer.domElement.addEventListener('click', () => {
  if (game.phase === 'playing') game.requestLock();
});

game.buildWorld().then(() => {
  hud.showScreen('title');
  window.dispatchEvent(new Event('game-ready'));
});

// Acesso para depuração/testes automatizados
(window as unknown as { __jogo: Game }).__jogo = game;
