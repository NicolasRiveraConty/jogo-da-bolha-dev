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
  deyvin: {
    kind: 'deyvin',
    name: 'ManoDeyvin',
    hp: 250,
    damage: 12,
    speed: 3.2,
    xp: 130,
    coins: 28,
    meleeRange: 2.4,
    attackCooldown: 1.2,
    aggroRange: 16,
    scale: 1.42,
    lines: ['Fala, dev!', 'Isso é bug ou feature?', 'Mano...', 'Cafézin primeiro.'],
  },
  elon: {
    kind: 'elon',
    name: 'Elon Musk',
    hp: 280,
    damage: 13,
    speed: 3.15,
    xp: 150,
    coins: 32,
    meleeRange: 2.3,
    attackCooldown: 1.18,
    aggroRange: 17,
    ranged: { cooldown: 2.2, speed: 14, damage: 11, color: 0xffffff, size: 0.4, minRange: 3.8, name: 'Tweet' },
    scale: 1.48,
    lines: ['To the moon!', 'We will tweet about this.', '42.0', 'Let that sink in.'],
  },
  pedro: {
    kind: 'pedro',
    name: 'Pedro — Conty',
    hp: 310,
    damage: 13,
    speed: 3.05,
    xp: 165,
    coins: 36,
    meleeRange: 2.45,
    attackCooldown: 1.22,
    aggroRange: 16,
    scale: 1.52,
    lines: ['Isso não escala!', 'Cadê o ROI?', 'Decisão executiva!', 'Vamos pivotar... em você.'],
  },
  helio: {
    kind: 'helio',
    name: 'HELIO, capanga do REAL OFICIAL',
    hp: 340,
    damage: 14,
    speed: 3.35,
    xp: 190,
    coins: 42,
    meleeRange: 2.55,
    attackCooldown: 1.3,
    aggroRange: 17,
    ranged: { cooldown: 2.6, speed: 12, damage: 9, color: 0x7cff4a, size: 0.38, minRange: 3.5, name: 'Gosma de taxa' },
    scale: 1.58,
    lines: [
      'App de finanças não perdoa.',
      'Taxa, juros e spread!',
      'Saldo no vermelho, igual você.',
      'Boleto venceu. Você também.',
      'Você vai ser quebrado pelo REAL OFICIAL, assim como ele quebra tudo.',
      'O ROI dele é negativo. O seu também vai ser.',
    ],
  },
  boss: {
    kind: 'boss',
    name: 'REAL OFICIAL',
    hp: 1280,
    damage: 19,
    speed: 3.05,
    xp: 900,
    coins: 110,
    meleeRange: 3.2,
    attackCooldown: 1.2,
    aggroRange: 30,
    ranged: { cooldown: 2.05, speed: 13, damage: 14, color: 0xff3d5a, size: 0.52, minRange: 3.8, name: 'Corte de Reels' },
    scale: 1.7,
    lines: [
      'Eu AMO pipoca.',
      'Gosto de pipoca.',
      'Como pipoca o dia todo.',
      'Toma pipoca!',
      'Toma corte!',
      'Pipoca e corte, o combo perfeito.',
      'Croc croc... pipoca!',
      'Você vai virar CORTE!',
    ],
  },
};

export const BIG_ENEMIES: MobKind[] = ['deyvin', 'elon', 'pedro', 'helio', 'boss'];

export interface NpcDef {
  id: 'banhos' | 'almeida' | 'anderson';
  name: string;
  title: string;
  greet: string;
}

export interface TalkOption {
  label: string;
  reply: string;
  ask?: string;
  followUp?: TalkOption[];
  effect?: 'cookie' | 'resume' | 'hotfix';
}

export const TALKS: Record<'anderson' | 'banhos', TalkOption[]> = {
  anderson: [
    {
      label: 'Perguntar ao Anderson sobre a Conty.',
      reply:
        'A Conty conecta marcas a criadores de conteúdo. É o sistema operacional de campanhas com creators: achar o perfil certo, briefing, entrega, pagamento e performance num lugar só. Sem planilha e sem perseguir UGC no WhatsApp. Olha lá: appconty.com',
      ask: 'Você precisa de vídeos do UGC para sua empresa?',
      followUp: [
        {
          label: 'Sim',
          reply:
            'Então a Conty é pra você. Marca de um lado, creator do outro, campanha no ar e UGC saindo. Entra em appconty.com e monta a operação.',
        },
        {
          label: 'Não',
          reply:
            'Beleza. Quando a empresa precisar de UGC, a Conty tá lá: conecta a marca ao creator e tira a campanha da planilha. appconty.com',
        },
      ],
    },
    {
      label: 'Sugerir uma alteração no app da Conty',
      reply:
        'Alteração no app da Conty? Manda o PR. Se for match de creator mais rápido, briefing menos burocrático ou pagamento que não trava a campanha, eu topo. Se for reescrever tudo em outra stack, não. Já quebrou uma vez. Não vai ser duas.',
    },
    {
      label: 'Reclamar sobre o Claude',
      reply:
        'Reclamar do Claude? Junta a fila. Ele inventa código, esquece o contexto e ainda fala com confiança de staff. Pior que estagiário com ChatGPT. Aí eu que abro o hotfix às 23h.',
    },
  ],
  banhos: [
    {
      label: 'Pedir para ele fazer um currículo',
      reply:
        'Currículo turbo saindo. Vinte anos de SaaS, sem enrolação, sem "apaixonado por desafios". Tá na mão — XP extra enquanto você caça o REAL OFICIAL.',
      effect: 'resume',
    },
    {
      label: 'Pedir um cookie.',
      reply: 'Cookie? Sempre. Chocolate, crocante, receita de guerra. Come com C. Não paga imposto de cookie.',
      effect: 'cookie',
    },
    {
      label: 'Dizer para ele vir morar para São Paulo',
      reply:
        'Morar em São Paulo? Meu chapa, eu já sobrevivi a vinte anos de SaaS. Trânsito, aluguel e pão de queijo caro? Só se o cookie vier junto. Me convence com um contrato e um forno.',
    },
  ],
};

export const NPCS: NpcDef[] = [
  { id: 'banhos', name: 'Sergio Banhos', title: 'SaaS de currículos · 20 anos', greet: 'Opa! O que você precisa?' },
  { id: 'almeida', name: 'Almeida', title: 'Dev forte', greet: 'Bora melhorar essa arma. Traz umas moedas que eu faço o upgrade.' },
  { id: 'anderson', name: 'Anderson Dev', title: 'Hotfix humano · Conty', greet: 'Fala. O que você quer saber?' },
];

/** Dificuldade de 1 (fácil) a 10 (difícil). 8 é o equilíbrio atual. */
export const DIFFICULTY = 8;

function clampDifficulty(d: number): number {
  return Math.max(1, Math.min(10, Math.round(d)));
}

/** Golpe da espada/halter. Dificuldade 8 = dano base. */
export function meleeDamageMul(d = DIFFICULTY): number {
  return 1 - 0.05 * (clampDifficulty(d) - 8);
}

/** Vida dos inimigos. Dificuldade 8 = +5% sobre o valor de dados. */
export function enemyHpMul(d = DIFFICULTY): number {
  return 1.05 + 0.08 * (clampDifficulty(d) - 8);
}

/** Dano que os inimigos causam. Dificuldade 8 = +15%. */
export function enemyDamageMul(d = DIFFICULTY): number {
  return 1.15 + 0.08 * (clampDifficulty(d) - 8);
}

export const XP_TABLE = [0, 60, 150, 280, 450, 680, 980, 1400, 1900];

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < XP_TABLE.length; i++) if (xp >= XP_TABLE[i]) level = i + 1;
  return level;
}
