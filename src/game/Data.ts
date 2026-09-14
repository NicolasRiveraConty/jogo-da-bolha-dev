export interface SkillDef {
  name: string;
  description: string;
  cooldown: number;
  kind: 'tweet' | 'heal' | 'taunt' | 'buff' | 'diet' | 'reel';
}

export interface HeroDef {
  id: 'nicolas' | 'matheus';
  name: string;
  title: string;
  company: string;
  description: string;
  hp: number;
  damage: number;
  speed: number;
  armor: number;
  attackCooldown: number;
  skills: [SkillDef, SkillDef, SkillDef];
  weapon: 'sword' | 'dumbbell';
  portrait: string;
  accent: string;
}

export const HEROES: HeroDef[] = [
  {
    id: 'nicolas',
    name: 'Nicolas',
    title: 'O Estrategista',
    company: 'Conty',
    description: 'Ágil, provocador e sempre conectado. Domina o X, o networking e a desumildade estratégica.',
    hp: 108,
    damage: 14,
    speed: 1.14,
    armor: 0.04,
    attackCooldown: 0.36,
    skills: [
      { name: 'Post viral no X', description: 'Dispara um post que explode em área e atinge vários inimigos.', cooldown: 7, kind: 'tweet' },
      { name: 'Networking', description: 'Recupera vida conversando com as pessoas certas.', cooldown: 13, kind: 'heal' },
      { name: 'Lembrar do começo', description: 'Provoca o alvo: o que ele fez lembra o seu começo. Atordoa e enfraquece.', cooldown: 10, kind: 'taunt' },
    ],
    weapon: 'sword',
    portrait: 'assets/portraits/nicolas.png',
    accent: '#4fc3f7',
  },
  {
    id: 'matheus',
    name: 'Matheus',
    title: 'O Shape',
    company: 'FitFolio',
    description: 'App de fitness na veia. Treino, dieta e um reel que explode o algoritmo — e os inimigos.',
    hp: 128,
    damage: 17,
    speed: 1.02,
    armor: 0.1,
    attackCooldown: 0.46,
    skills: [
      { name: 'Treino', description: 'Pump de força e velocidade por alguns segundos.', cooldown: 11, kind: 'buff' },
      { name: 'Dieta', description: 'Refeição perfeita: cura e regenera.', cooldown: 12, kind: 'diet' },
      { name: 'Reel que viraliza', description: 'Um reel explode em área e empurra todo mundo.', cooldown: 8, kind: 'reel' },
    ],
    weapon: 'dumbbell',
    portrait: 'assets/portraits/mateus.png',
    accent: '#ef5350',
  },
];

export const heroById = (id: string): HeroDef => HEROES.find((h) => h.id === id) ?? HEROES[0];

export type MobKind = 'pedro' | 'elon' | 'deyvin' | 'helio' | 'boss';

export interface MobDef {
  kind: MobKind;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  xp: number;
  coins: number;
  meleeRange: number;
  attackCooldown: number;
  aggroRange: number;
  ranged?: { cooldown: number; speed: number; damage: number; color: number; size: number; minRange: number; name: string };
  scale: number;
  lines: string[];
}

export const MOBS: Record<MobKind, MobDef> = {
  pedro: {
    kind: 'pedro',
    name: 'Pedro, o CEO',
    hp: 58,
    damage: 11,
    speed: 3.1,
    xp: 36,
    coins: 8,
    meleeRange: 2.1,
    attackCooldown: 1.25,
    aggroRange: 15,
    scale: 1.05,
    lines: ['Isso não escala!', 'Cadê o ROI?', 'Decisão executiva!', 'Vamos pivotar... em você.'],
  },
  elon: {
    kind: 'elon',
    name: 'Elon Musk',
    hp: 62,
    damage: 10,
    speed: 3.3,
    xp: 40,
    coins: 10,
    meleeRange: 2.0,
    attackCooldown: 1.15,
    aggroRange: 16,
    ranged: { cooldown: 2.6, speed: 13, damage: 8, color: 0xffffff, size: 0.28, minRange: 4, name: 'Tweet' },
    scale: 1.08,
    lines: ['To the moon!', 'We will tweet about this.', '42.0', 'Let that sink in.'],
  },
  deyvin: {
    kind: 'deyvin',
    name: 'ManoDeyvin',
    hp: 54,
    damage: 10,
    speed: 3.4,
    xp: 34,
    coins: 7,
    meleeRange: 2.0,
    attackCooldown: 1.1,
    aggroRange: 15,
    scale: 1,
    lines: ['Fala, dev!', 'Isso é bug ou feature?', 'Mano...', 'Cafézin primeiro.'],
  },
  helio: {
    kind: 'helio',
    name: 'HELIO, capanga do REAL OFICIAL',
    hp: 280,
    damage: 13,
    speed: 3.5,
    xp: 180,
    coins: 40,
    meleeRange: 2.3,
    attackCooldown: 1.35,
    aggroRange: 16,
    ranged: { cooldown: 2.6, speed: 12, damage: 8, color: 0x7cff4a, size: 0.32, minRange: 3.5, name: 'Gosma de taxa' },
    scale: 1.15,
    lines: ['O chefe vai te CORTAR!', 'Taxa do capanga!', 'Goblins também cobram juros!', 'Sai da frente do castelo!'],
  },
  boss: {
    kind: 'boss',
    name: 'REAL OFICIAL',
    hp: 720,
    damage: 16,
    speed: 2.8,
    xp: 700,
    coins: 80,
    meleeRange: 3.1,
    attackCooldown: 1.55,
    aggroRange: 28,
    ranged: { cooldown: 2.3, speed: 12, damage: 12, color: 0xff3d5a, size: 0.48, minRange: 4.5, name: 'Corte de Reels' },
    scale: 1.7,
    lines: ['Você vai virar CORTE!', '10 milhões de views!', 'Croc croc... pipoca!', 'Sem contexto fica melhor!'],
  },
};

export interface NpcDef {
  id: 'banhos' | 'almeida' | 'anderson';
  name: string;
  title: string;
  greet: string;
}

export const NPCS: NpcDef[] = [
  { id: 'banhos', name: 'Sergio Banhos', title: 'SaaS de currículos · 20 anos', greet: 'Opa! Peguei uns cookies e um currículo turbo pra você.' },
  { id: 'almeida', name: 'Almeida', title: 'Dev forte', greet: 'Bora melhorar essa arma. Traz umas moedas que eu faço o upgrade.' },
  { id: 'anderson', name: 'Anderson', title: 'Hotfix humano', greet: 'Relaxa. Hotfix: HP cheio e habilidades no ponto.' },
];

export const XP_TABLE = [0, 60, 150, 280, 450, 680, 980, 1400, 1900];

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < XP_TABLE.length; i++) if (xp >= XP_TABLE[i]) level = i + 1;
  return level;
}
