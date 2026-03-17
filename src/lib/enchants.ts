// minecraft 1.6 enchantment definitions

export interface EnchantDef {
  id: number;
  name: string;
  maxLevel: number;
  applies: ('sword' | 'tool' | 'armor' | 'bow' | 'fishing' | 'all')[];
}

export const ENCHANTMENTS: EnchantDef[] = [
  // Armor
  { id: 0,  name: 'Protection',             maxLevel: 4, applies: ['armor'] },
  { id: 1,  name: 'Fire Protection',        maxLevel: 4, applies: ['armor'] },
  { id: 2,  name: 'Feather Falling',        maxLevel: 4, applies: ['armor'] },
  { id: 3,  name: 'Blast Protection',       maxLevel: 4, applies: ['armor'] },
  { id: 4,  name: 'Projectile Protection',  maxLevel: 4, applies: ['armor'] },
  { id: 5,  name: 'Respiration',            maxLevel: 3, applies: ['armor'] },
  { id: 6,  name: 'Aqua Affinity',          maxLevel: 1, applies: ['armor'] },
  { id: 7,  name: 'Thorns',                 maxLevel: 3, applies: ['armor'] },
  // Sword
  { id: 16, name: 'Sharpness',              maxLevel: 5, applies: ['sword'] },
  { id: 17, name: 'Smite',                  maxLevel: 5, applies: ['sword'] },
  { id: 18, name: 'Bane of Arthropods',     maxLevel: 5, applies: ['sword'] },
  { id: 19, name: 'Knockback',              maxLevel: 2, applies: ['sword'] },
  { id: 20, name: 'Fire Aspect',            maxLevel: 2, applies: ['sword'] },
  { id: 21, name: 'Looting',               maxLevel: 3, applies: ['sword'] },
  // Tools
  { id: 32, name: 'Efficiency',             maxLevel: 5, applies: ['tool'] },
  { id: 33, name: 'Silk Touch',             maxLevel: 1, applies: ['tool'] },
  { id: 34, name: 'Unbreaking',             maxLevel: 3, applies: ['all'] },
  { id: 35, name: 'Fortune',                maxLevel: 3, applies: ['tool'] },
  // Bow
  { id: 48, name: 'Power',                  maxLevel: 5, applies: ['bow'] },
  { id: 49, name: 'Punch',                  maxLevel: 2, applies: ['bow'] },
  { id: 50, name: 'Flame',                  maxLevel: 1, applies: ['bow'] },
  { id: 51, name: 'Infinity',               maxLevel: 1, applies: ['bow'] },
  // Fishing
  { id: 61, name: 'Luck of the Sea',        maxLevel: 3, applies: ['fishing'] },
  { id: 62, name: 'Lure',                   maxLevel: 3, applies: ['fishing'] },
];

export const ENCHANT_BY_ID = Object.fromEntries(ENCHANTMENTS.map(e => [e.id, e]));

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
export function toRoman(n: number): string {
  return ROMAN[n] ?? String(n);
}

export function enchantLabel(id: number, lvl: number): string {
  const def = ENCHANT_BY_ID[id];
  const name = def?.name ?? `Enchant #${id}`;
  const maxLvl = def?.maxLevel ?? 5;
  return maxLvl === 1 ? name : `${name} ${toRoman(lvl)}`;
}
