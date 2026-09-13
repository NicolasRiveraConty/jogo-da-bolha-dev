import type { HeroDef } from './types';

export const HEROES: HeroDef[] = [
  {
    id: 'nicolas',
    name: 'Nicolas',
    title: 'O Estrategista',
    company: 'Conty',
    description:
      'Equilibrado e ágil. Transforma métricas em vitória e nunca perde um follow-up.',
    base: { hp: 100, mp: 40, atk: 14, def: 8, spd: 12 },
    growth: 0.15,
    accent: 0x4fc3f7,
    spriteKey: 'hero_nicolas',
    portraitKey: 'portrait_nicolas',
    skills: [
      {
        id: 'campanha_viral',
        name: 'Campanha Viral',
        description: 'Dano forte (1.6x).',
        mpCost: 8,
        effect: { kind: 'damage', power: 1.6 },
        flavor: '{user} lança uma Campanha Viral! O alcance explode!',
        color: 0x4fc3f7,
      },
      {
        id: 'networking',
        name: 'Networking',
        description: 'Recupera 35% do HP.',
        mpCost: 10,
        effect: { kind: 'heal', percent: 0.35 },
        flavor: '{user} faz Networking e recupera energia com bons contatos.',
        color: 0x81c784,
      },
      {
        id: 'relatorio',
        name: 'Relatório de Métricas',
        description: 'Reduz o ATK do inimigo por 3 turnos.',
        mpCost: 9,
        effect: { kind: 'debuff', stat: 'atk', multiplier: 0.7, turns: 3 },
        flavor: '{user} apresenta o Relatório de Métricas. {target} fica desmotivado!',
        color: 0xffb74d,
      },
    ],
  },
  {
    id: 'pedro',
    name: 'Pedro',
    title: 'O CEO',
    company: 'Conty',
    description:
      'Resistente e determinado. Aguenta qualquer pressão e decide com firmeza.',
    base: { hp: 130, mp: 35, atk: 12, def: 12, spd: 8 },
    growth: 0.15,
    accent: 0xffd54f,
    spriteKey: 'hero_pedro',
    portraitKey: 'portrait_pedro',
    skills: [
      {
        id: 'decisao',
        name: 'Decisão Executiva',
        description: 'Dano 1.5x que ignora a defesa.',
        mpCost: 10,
        effect: { kind: 'damage', power: 1.5, ignoreDef: true },
        flavor: '{user} toma uma Decisão Executiva! Sem espaço para contestação!',
        color: 0xffd54f,
      },
      {
        id: 'rodada',
        name: 'Rodada de Investimento',
        description: 'Recupera 40% do HP.',
        mpCost: 12,
        effect: { kind: 'heal', percent: 0.4 },
        flavor: '{user} fecha uma Rodada de Investimento! Caixa renovado!',
        color: 0x81c784,
      },
      {
        id: 'alinhamento',
        name: 'Reunião de Alinhamento',
        description: '70% de chance de atordoar o inimigo.',
        mpCost: 8,
        effect: { kind: 'stun', chance: 0.7 },
        flavor: '{user} convoca uma Reunião de Alinhamento. {target} perde o foco!',
        color: 0xce93d8,
      },
    ],
  },
  {
    id: 'mateus',
    name: 'Mateus',
    title: 'O Shape',
    company: 'Fitfolio',
    description:
      'Força bruta com disciplina. Nunca pula o dia de perna, nem em produção.',
    base: { hp: 115, mp: 30, atk: 18, def: 9, spd: 10 },
    growth: 0.15,
    accent: 0xef5350,
    spriteKey: 'hero_mateus',
    portraitKey: 'portrait_mateus',
    skills: [
      {
        id: 'dia_de_perna',
        name: 'Dia de Perna',
        description: 'Dano brutal (1.8x).',
        mpCost: 10,
        effect: { kind: 'damage', power: 1.8 },
        flavor: '{user} manda um Dia de Perna! Agachamento pesado em {target}!',
        color: 0xef5350,
      },
      {
        id: 'whey',
        name: 'Whey Protein',
        description: 'Recupera 30% do HP.',
        mpCost: 8,
        effect: { kind: 'heal', percent: 0.3 },
        flavor: '{user} toma um shake de Whey Protein. Músculos recuperados!',
        color: 0x81c784,
      },
      {
        id: 'pre_treino',
        name: 'Pré-Treino',
        description: 'ATK +50% por 3 turnos.',
        mpCost: 10,
        effect: { kind: 'buff', stat: 'atk', multiplier: 1.5, turns: 3 },
        flavor: '{user} toma o Pré-Treino! Está tremendo de energia!',
        color: 0xff7043,
      },
    ],
  },
];

export const heroById = (id: string): HeroDef => {
  const h = HEROES.find((x) => x.id === id);
  if (!h) throw new Error(`Herói não encontrado: ${id}`);
  return h;
};
