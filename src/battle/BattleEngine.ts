import type { EnemyDef, HeroDef, ItemDef, Skill, Stats } from '../data/types';

export type Side = 'hero' | 'enemy';

interface Modifier {
  stat: 'atk' | 'def';
  multiplier: number;
  turnsLeft: number;
}

export interface Combatant {
  side: Side;
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  base: Stats;
  mods: Modifier[];
  stunned: boolean;
  defending: boolean;
}

export type BattleEvent =
  | { type: 'log'; text: string }
  | { type: 'skill'; side: Side; name: string; color?: number }
  | { type: 'damage'; target: Side; amount: number; crit: boolean }
  | { type: 'miss'; target: Side }
  | { type: 'heal'; target: Side; amount: number }
  | { type: 'mp'; target: Side; amount: number }
  | { type: 'buff'; target: Side; stat: 'atk' | 'def'; up: boolean }
  | { type: 'stun'; target: Side }
  | { type: 'defend'; side: Side }
  | { type: 'phase2'; text: string }
  | { type: 'victory' }
  | { type: 'defeat' };

export type HeroAction =
  | { type: 'attack' }
  | { type: 'skill'; skill: Skill }
  | { type: 'item'; item: ItemDef }
  | { type: 'defend' };

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const chance = (p: number) => Math.random() < p;

export class BattleEngine {
  hero: Combatant;
  enemy: Combatant;
  private enemyDef: EnemyDef;
  private phase2Announced = false;
  private turn = 0;

  constructor(heroDef: HeroDef, heroStats: Stats, hp: number, mp: number, enemyDef: EnemyDef) {
    this.enemyDef = enemyDef;
    this.hero = {
      side: 'hero',
      name: heroDef.name,
      hp,
      maxHp: heroStats.hp,
      mp,
      maxMp: heroStats.mp,
      base: heroStats,
      mods: [],
      stunned: false,
      defending: false,
    };
    this.enemy = {
      side: 'enemy',
      name: enemyDef.name,
      hp: enemyDef.stats.hp,
      maxHp: enemyDef.stats.hp,
      mp: 0,
      maxMp: 0,
      base: enemyDef.stats,
      mods: [],
      stunned: false,
      defending: false,
    };
  }

  get isOver(): boolean {
    return this.hero.hp <= 0 || this.enemy.hp <= 0;
  }

  stat(c: Combatant, s: 'atk' | 'def'): number {
    let v = c.base[s];
    for (const m of c.mods) if (m.stat === s) v *= m.multiplier;
    return v;
  }

  /** Executa um turno completo: ação do herói e depois a resposta do inimigo. */
  playTurn(action: HeroAction): BattleEvent[] {
    const events: BattleEvent[] = [];
    this.turn++;
    this.hero.defending = false;

    this.heroAct(action, events);
    if (this.enemy.hp <= 0) {
      events.push({ type: 'log', text: this.enemyDef.defeatLine });
      events.push({ type: 'victory' });
      return events;
    }

    this.checkPhase2(events);

    if (this.enemy.stunned) {
      this.enemy.stunned = false;
      events.push({ type: 'log', text: `${this.enemy.name} está atordoado e perde o turno!` });
    } else {
      this.enemyAct(events);
    }

    if (this.hero.hp <= 0) {
      events.push({ type: 'log', text: `${this.hero.name} foi derrotado...` });
      events.push({ type: 'defeat' });
      return events;
    }

    this.tickMods(this.hero, events);
    this.tickMods(this.enemy, events);
    return events;
  }

  private heroAct(action: HeroAction, events: BattleEvent[]) {
    const h = this.hero;
    const e = this.enemy;
    switch (action.type) {
      case 'attack':
        events.push({ type: 'log', text: `${h.name} ataca!` });
        this.dealDamage(h, e, 1.0, false, 1, events);
        break;
      case 'defend':
        h.defending = true;
        h.mp = Math.min(h.maxMp, h.mp + 5);
        events.push({ type: 'defend', side: 'hero' });
        events.push({ type: 'mp', target: 'hero', amount: 5 });
        events.push({ type: 'log', text: `${h.name} se defende e respira fundo. (+5 MP)` });
        break;
      case 'skill':
        h.mp -= action.skill.mpCost;
        this.applySkill(h, e, action.skill, events);
        break;
      case 'item':
        this.useItem(action.item, events);
        break;
    }
  }

  private useItem(item: ItemDef, events: BattleEvent[]) {
    const h = this.hero;
    events.push({ type: 'log', text: `${h.name} usa ${item.name}!` });
    switch (item.effect.kind) {
      case 'heal': {
        const amt = Math.min(item.effect.amount, h.maxHp - h.hp);
        h.hp += amt;
        events.push({ type: 'heal', target: 'hero', amount: amt });
        break;
      }
      case 'mp': {
        const amt = Math.min(item.effect.amount, h.maxMp - h.mp);
        h.mp += amt;
        events.push({ type: 'mp', target: 'hero', amount: amt });
        break;
      }
      case 'fullHeal': {
        const hpAmt = h.maxHp - h.hp;
        const mpAmt = h.maxMp - h.mp;
        h.hp = h.maxHp;
        h.mp = h.maxMp;
        events.push({ type: 'heal', target: 'hero', amount: hpAmt });
        events.push({ type: 'mp', target: 'hero', amount: mpAmt });
        break;
      }
    }
  }

  private applySkill(user: Combatant, target: Combatant, skill: Skill, events: BattleEvent[]) {
    const flavor = skill.flavor.replace('{user}', user.name).replace('{target}', target.name);
    events.push({ type: 'skill', side: user.side, name: skill.name, color: skill.color });
    events.push({ type: 'log', text: flavor });
    const fx = skill.effect;
    switch (fx.kind) {
      case 'damage':
        this.dealDamage(user, target, fx.power, !!fx.ignoreDef, fx.hits ?? 1, events);
        break;
      case 'heal': {
        const amt = Math.min(Math.round(user.maxHp * fx.percent), user.maxHp - user.hp);
        user.hp += amt;
        events.push({ type: 'heal', target: user.side, amount: amt });
        break;
      }
      case 'buff':
        user.mods = user.mods.filter((m) => m.stat !== fx.stat);
        user.mods.push({ stat: fx.stat, multiplier: fx.multiplier, turnsLeft: fx.turns });
        events.push({ type: 'buff', target: user.side, stat: fx.stat, up: true });
        break;
      case 'debuff':
        target.mods = target.mods.filter((m) => m.stat !== fx.stat);
        target.mods.push({ stat: fx.stat, multiplier: fx.multiplier, turnsLeft: fx.turns });
        events.push({ type: 'buff', target: target.side, stat: fx.stat, up: false });
        break;
      case 'stun':
        if (chance(fx.chance)) {
          target.stunned = true;
          events.push({ type: 'stun', target: target.side });
        } else {
          events.push({ type: 'miss', target: target.side });
          events.push({ type: 'log', text: `${target.name} ignorou o convite da reunião!` });
        }
        break;
      case 'drainMp': {
        const amt = Math.min(fx.amount, target.mp);
        target.mp -= amt;
        events.push({ type: 'mp', target: target.side, amount: -amt });
        break;
      }
    }
  }

  private dealDamage(
    attacker: Combatant,
    target: Combatant,
    power: number,
    ignoreDef: boolean,
    hits: number,
    events: BattleEvent[],
  ) {
    for (let i = 0; i < hits; i++) {
      if (target.hp <= 0) break;
      // Esquiva baseada na diferença de velocidade (máx. 20%)
      const dodge = Math.max(0, Math.min(0.2, (target.base.spd - attacker.base.spd) * 0.02));
      if (chance(dodge)) {
        events.push({ type: 'miss', target: target.side });
        events.push({ type: 'log', text: `${target.name} esquivou!` });
        continue;
      }
      const atk = this.stat(attacker, 'atk');
      const def = ignoreDef ? 0 : this.stat(target, 'def');
      let dmg = atk * power - def * 0.5;
      dmg *= rand(0.88, 1.12);
      const crit = chance(0.1 + attacker.base.spd * 0.005);
      if (crit) dmg *= 1.6;
      if (target.defending) dmg *= 0.5;
      const final = Math.max(1, Math.round(dmg));
      target.hp = Math.max(0, target.hp - final);
      events.push({ type: 'damage', target: target.side, amount: final, crit });
    }
  }

  private checkPhase2(events: BattleEvent[]) {
    const e = this.enemy;
    if (
      !this.phase2Announced &&
      this.enemyDef.phase2Skills &&
      e.hp > 0 &&
      e.hp / e.maxHp <= 0.5
    ) {
      this.phase2Announced = true;
      e.base = { ...e.base, atk: Math.round(e.base.atk * 1.15) };
      events.push({ type: 'phase2', text: this.enemyDef.phase2Line ?? `${e.name} está furioso!` });
    }
  }

  private enemyAct(events: BattleEvent[]) {
    const e = this.enemy;
    const h = this.hero;
    const pool =
      this.phase2Announced && this.enemyDef.phase2Skills
        ? this.enemyDef.phase2Skills
        : this.enemyDef.skills;

    const usable = pool.filter((s) => {
      const fx = s.effect;
      if (fx.kind === 'heal') return e.hp / e.maxHp < 0.6;
      if (fx.kind === 'buff') return !e.mods.some((m) => m.stat === fx.stat);
      if (fx.kind === 'debuff') return !h.mods.some((m) => m.stat === fx.stat);
      if (fx.kind === 'drainMp') return h.mp > 0;
      return true;
    });

    // Turno 1 do boss: sempre um ataque para dar o tom da luta.
    let skill: Skill;
    if (this.turn === 1 && this.enemyDef.isBoss) {
      skill = pool.find((s) => s.effect.kind === 'damage') ?? pool[0];
    } else {
      skill = usable[Math.floor(Math.random() * usable.length)] ?? pool[0];
    }
    this.applySkill(e, h, skill, events);
  }

  private tickMods(c: Combatant, events: BattleEvent[]) {
    const remaining: Modifier[] = [];
    for (const m of c.mods) {
      m.turnsLeft--;
      if (m.turnsLeft > 0) remaining.push(m);
      else
        events.push({
          type: 'log',
          text: `O efeito em ${m.stat.toUpperCase()} de ${c.name} acabou.`,
        });
    }
    c.mods = remaining;
  }
}
