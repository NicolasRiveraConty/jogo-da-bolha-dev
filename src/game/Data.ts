import type { HumanoidPalette } from './Models';

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  company: string;
  description: string;
  hp: number;
  damage: number;
  speed: number;
  /** Redução de dano recebido (0-1). */
  armor: number;
  attackCooldown: number;
  special: { name: string; description: string; cooldown: number; kind: 'burst' | 'heavy' | 'slam' };
  heal: { name: string; percent: number; cooldown: number };
  weapon: 'sword' | 'bigsword' | 'dumbbell';
  palette: HumanoidPalette;
  portrait: string;
  accent: string;
}

export const HEROES: HeroDef[] = [
  {
    id: 'nicolas',
    name: 'Nicolas',
    title: 'O Estrategista',
    company: 'Conty',
    description: 'Ágil e equilibrado. Ataques rápidos e uma explosão viral que atinge todos ao redor.',
    hp: 100,
    damage: 12,
    speed: 1.12,
    armor: 0,
    attackCooldown: 0.38,
    special: { name: 'Campanha Viral', description: 'Explosão que atinge todos os mobs próximos.', cooldown: 8, kind: 'burst' },
    heal: { name: 'Networking', percent: 0.35, cooldown: 14 },
    weapon: 'sword',
    palette: { skin: 0xd9a066, hair: 0x2a1d14, shirt: 0x1f2a44, pants: 0x2b2b33, shoes: 0x3a3a44, sleeves: 0x1f2a44, cape: 0x2f7fe0, armor: true },
    portrait: 'assets/portraits/nicolas.png',
    accent: '#4fc3f7',
  },
  {
    id: 'pedro',
    name: 'Pedro',
    title: 'O CEO',
    company: 'Conty',
    description: 'Resistente e firme. Recebe menos dano e desfere Decisões Executivas devastadoras.',
    hp: 140,
    damage: 11,
    speed: 0.95,
    armor: 0.22,
    attackCooldown: 0.5,
    special: { name: 'Decisão Executiva', description: 'Golpe pesado com 3x de dano no alvo à frente.', cooldown: 7, kind: 'heavy' },
    heal: { name: 'Rodada de Investimento', percent: 0.4, cooldown: 15 },
    weapon: 'bigsword',
    palette: { skin: 0xd9a066, hair: 0x6b4423, shirt: 0xb9c2cc, pants: 0x4a5058, shoes: 0x2a2a30, sleeves: 0xb9c2cc, cape: 0xe0b030, armor: true, belt: 0x8a5a2b },
    portrait: 'assets/portraits/pedro.png',
    accent: '#ffd54f',
  },
  {
    id: 'mateus',
    name: 'Mateus',
    title: 'O Shape',
    company: 'Fitfolio',
    description: 'Força bruta. O maior dano por golpe e um Dia de Perna que sacode o chão.',
    hp: 115,
    damage: 16,
    speed: 1.0,
    armor: 0.08,
    attackCooldown: 0.55,
    special: { name: 'Dia de Perna', description: 'Pisão que causa dano em área e empurra os mobs.', cooldown: 8, kind: 'slam' },
    heal: { name: 'Whey Protein', percent: 0.3, cooldown: 12 },
    weapon: 'dumbbell',
    palette: { skin: 0xc98a5a, hair: 0x1e140c, shirt: 0x3a2a22, pants: 0x4a3226, shoes: 0xc62828, headband: 0xd32f2f, big: true, cape: 0xb71c1c },
    portrait: 'assets/portraits/mateus.png',
    accent: '#ef5350',
  },
];

export const heroById = (id: string): HeroDef => HEROES.find((h) => h.id === id) ?? HEROES[0];

export type MobKind = 'bug' | 'cliente' | 'reuniao' | 'elio' | 'boss';

export interface MobDef {
  kind: MobKind;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  xp: number;
  meleeRange: number;
  attackCooldown: number;
  aggroRange: number;
  hover?: number;
  ranged?: { cooldown: number; speed: number; damage: number; color: number; size: number; minRange: number; name: string };
  scale: number;
  lines: string[];
}

export const MOBS: Record<MobKind, MobDef> = {
  bug: {
    kind: 'bug',
    name: 'Bug em Produção',
    hp: 30,
    damage: 8,
    speed: 3.6,
    xp: 22,
    meleeRange: 1.9,
    attackCooldown: 1.1,
    aggroRange: 16,
    scale: 1,
    lines: ['undefined is not a function!', 'Erro 500!', 'Funciona na minha máquina...'],
  },
  cliente: {
    kind: 'cliente',
    name: 'Cliente do Desconto',
    hp: 48,
    damage: 10,
    speed: 3.0,
    xp: 32,
    meleeRange: 2.0,
    attackCooldown: 1.3,
    aggroRange: 15,
    scale: 1,
    lines: ['TÁ CARO!', 'Faz um precinho...', 'Meu sobrinho faz por menos.'],
  },
  reuniao: {
    kind: 'reuniao',
    name: 'Reunião Que Podia Ser Email',
    hp: 42,
    damage: 7,
    speed: 2.2,
    xp: 34,
    meleeRange: 2.4,
    attackCooldown: 1.6,
    aggroRange: 20,
    hover: 0.9,
    ranged: { cooldown: 2.8, speed: 9, damage: 8, color: 0xb388ff, size: 0.35, minRange: 4, name: 'Slide 47' },
    scale: 1,
    lines: ['Rapidinho, 5 minutos...', 'Consegue me ouvir?', 'Vamos alinhar!'],
  },
  elio: {
    kind: 'elio',
    name: 'Élio, o Fiel Escudeiro',
    hp: 240,
    damage: 10,
    speed: 3.3,
    xp: 160,
    meleeRange: 2.2,
    attackCooldown: 1.5,
    aggroRange: 14,
    ranged: { cooldown: 2.8, speed: 12, damage: 7, color: 0xffd740, size: 0.3, minRange: 4, name: 'Taxa de Serviço' },
    scale: 1,
    lines: ['Antes de passar, quita a taxa!', 'Cobrança recorrente ativada!', 'Juros compostos, meu amigo.'],
  },
  boss: {
    kind: 'boss',
    name: 'REAL OFICIAL',
    hp: 650,
    damage: 15,
    speed: 2.7,
    xp: 600,
    meleeRange: 3.2,
    attackCooldown: 1.7,
    aggroRange: 26,
    ranged: { cooldown: 2.4, speed: 11, damage: 11, color: 0xff3d5a, size: 0.5, minRange: 5, name: 'Corte de Reels' },
    scale: 1.9,
    lines: ['Você vai virar CORTE!', 'Isso vai dar 10 milhões de views!', 'Croc croc... pipoca!', 'Sem contexto fica melhor!'],
  },
};

export const XP_TABLE = [0, 60, 150, 280, 450, 680, 980, 1400, 1900];

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < XP_TABLE.length; i++) if (xp >= XP_TABLE[i]) level = i + 1;
  return level;
}
