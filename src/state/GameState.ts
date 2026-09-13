import { heroById } from '../data/heroes';
import type { Stats } from '../data/types';

const SAVE_KEY = 'jogo-da-bolha-dev:save:v1';

export interface SaveData {
  heroId: string;
  level: number;
  xp: number;
  hp: number;
  mp: number;
  gold: number;
  items: Record<string, number>;
  cleared: string[];
  currentNode: string;
  bossDefeated: boolean;
}

export const XP_TABLE = [0, 60, 150, 280, 450, 680, 980, 1400];

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) level = i + 1;
  }
  return level;
}

export function statsForLevel(heroId: string, level: number): Stats {
  const hero = heroById(heroId);
  const mult = 1 + hero.growth * (level - 1);
  return {
    hp: Math.round(hero.base.hp * mult),
    mp: Math.round(hero.base.mp * mult),
    atk: Math.round(hero.base.atk * mult),
    def: Math.round(hero.base.def * mult),
    spd: Math.round(hero.base.spd * mult),
  };
}

class GameStateStore {
  data: SaveData | null = null;

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      this.data = JSON.parse(raw) as SaveData;
      return this.data;
    } catch {
      return null;
    }
  }

  save(): void {
    if (!this.data) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
  }

  clear(): void {
    localStorage.removeItem(SAVE_KEY);
    this.data = null;
  }

  newGame(heroId: string): SaveData {
    const stats = statsForLevel(heroId, 1);
    this.data = {
      heroId,
      level: 1,
      xp: 0,
      hp: stats.hp,
      mp: stats.mp,
      gold: 40,
      items: { cafe: 2, energetico: 1 },
      cleared: [],
      currentNode: 'start',
      bossDefeated: false,
    };
    this.save();
    return this.data;
  }

  get(): SaveData {
    if (!this.data) {
      const loaded = this.load();
      if (!loaded) throw new Error('Nenhum jogo em andamento.');
    }
    return this.data!;
  }

  maxStats(): Stats {
    const d = this.get();
    return statsForLevel(d.heroId, d.level);
  }

  /** Aplica XP e retorna quantos níveis subiu. */
  addXp(amount: number): number {
    const d = this.get();
    const before = d.level;
    d.xp += amount;
    d.level = levelForXp(d.xp);
    const gained = d.level - before;
    if (gained > 0) {
      const max = this.maxStats();
      d.hp = max.hp;
      d.mp = max.mp;
    }
    this.save();
    return gained;
  }

  addItem(id: string, qty = 1): void {
    const d = this.get();
    d.items[id] = (d.items[id] ?? 0) + qty;
    this.save();
  }

  removeItem(id: string): boolean {
    const d = this.get();
    if ((d.items[id] ?? 0) <= 0) return false;
    d.items[id] -= 1;
    if (d.items[id] === 0) delete d.items[id];
    this.save();
    return true;
  }

  fullHeal(): void {
    const d = this.get();
    const max = this.maxStats();
    d.hp = max.hp;
    d.mp = max.mp;
    this.save();
  }
}

export const GameState = new GameStateStore();
