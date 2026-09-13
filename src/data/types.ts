export interface Stats {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
}

export type SkillEffect =
  | { kind: 'damage'; power: number; ignoreDef?: boolean; hits?: number }
  | { kind: 'heal'; percent: number }
  | { kind: 'buff'; stat: 'atk' | 'def'; multiplier: number; turns: number }
  | { kind: 'debuff'; stat: 'atk' | 'def'; multiplier: number; turns: number }
  | { kind: 'stun'; chance: number }
  | { kind: 'drainMp'; amount: number };

export interface Skill {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  effect: SkillEffect;
  /** Frase exibida no log ao usar. {user} e {target} são substituídos. */
  flavor: string;
  color?: number;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  company: string;
  description: string;
  base: Stats;
  /** Crescimento por nível (multiplicador sobre os stats base) */
  growth: number;
  skills: Skill[];
  spriteKey: string;
  portraitKey: string;
  accent: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  title?: string;
  description: string;
  stats: Stats;
  skills: Skill[];
  /** Habilidades usadas apenas quando HP < 50% (fase 2) */
  phase2Skills?: Skill[];
  phase2Line?: string;
  introLine: string;
  defeatLine: string;
  xp: number;
  gold: number;
  spriteKey: string;
  scale?: number;
  isBoss?: boolean;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  price: number;
  effect: { kind: 'heal'; amount: number } | { kind: 'mp'; amount: number } | { kind: 'fullHeal' };
}

export type NodeKind = 'start' | 'battle' | 'shop' | 'boss';

export interface MapNode {
  id: string;
  name: string;
  kind: NodeKind;
  x: number;
  y: number;
  enemyId?: string;
  battleBg?: string;
  description: string;
}
