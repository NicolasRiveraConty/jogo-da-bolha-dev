import type { ItemDef } from './types';

export const ITEMS: ItemDef[] = [
  {
    id: 'cafe',
    name: 'Café Coado',
    description: 'Recupera 45 HP. O combustível oficial da bolha.',
    price: 30,
    effect: { kind: 'heal', amount: 45 },
  },
  {
    id: 'energetico',
    name: 'Energético',
    description: 'Recupera 20 MP. Gosto de bala de morango.',
    price: 35,
    effect: { kind: 'mp', amount: 20 },
  },
  {
    id: 'pizza',
    name: 'Pizza da Madrugada',
    description: 'Recupera HP e MP totalmente. Deploy garantido.',
    price: 90,
    effect: { kind: 'fullHeal' },
  },
];

export const itemById = (id: string): ItemDef => {
  const i = ITEMS.find((x) => x.id === id);
  if (!i) throw new Error(`Item não encontrado: ${id}`);
  return i;
};
