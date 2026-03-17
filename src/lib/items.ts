// item id → display name mapping for minecraft LCE (TU19 / 1.6 era)
export const ITEM_NAMES: Record<number, string> = {
  // Blocks
  1: 'Stone', 2: 'Grass', 3: 'Dirt', 4: 'Cobblestone', 5: 'Wood Planks',
  6: 'Sapling', 7: 'Bedrock', 12: 'Sand', 13: 'Gravel',
  14: 'Gold Ore', 15: 'Iron Ore', 16: 'Coal Ore', 17: 'Log', 18: 'Leaves',
  20: 'Glass', 21: 'Lapis Lazuli Ore', 22: 'Lapis Lazuli Block',
  23: 'Dispenser', 24: 'Sandstone', 25: 'Note Block',
  27: 'Powered Rail', 28: 'Detector Rail', 29: 'Sticky Piston',
  30: 'Cobweb', 33: 'Piston', 35: 'Wool',
  37: 'Dandelion', 38: 'Rose', 39: 'Brown Mushroom', 40: 'Red Mushroom',
  41: 'Gold Block', 42: 'Iron Block', 44: 'Stone Slab', 45: 'Brick Block',
  46: 'TNT', 47: 'Bookshelf', 48: 'Mossy Cobblestone', 49: 'Obsidian',
  50: 'Torch', 52: 'Mob Spawner', 53: 'Oak Wood Stairs', 54: 'Chest',
  56: 'Diamond Ore', 57: 'Diamond Block', 58: 'Crafting Table',
  61: 'Furnace', 65: 'Ladder', 66: 'Rail', 67: 'Cobblestone Stairs',
  69: 'Lever', 73: 'Redstone Ore', 76: 'Redstone Torch',
  78: 'Snow Layer', 79: 'Ice', 80: 'Snow Block', 81: 'Cactus',
  82: 'Clay Block', 83: 'Sugar Cane Block', 84: 'Jukebox', 85: 'Oak Fence',
  86: 'Pumpkin', 87: 'Netherrack', 88: 'Soul Sand', 89: 'Glowstone',
  91: 'Jack-o-Lantern', 92: 'Cake Block', 95: 'Stained Glass',
  96: 'Trapdoor', 98: 'Stone Brick', 101: 'Iron Bars', 102: 'Glass Pane',
  103: 'Melon Block', 106: 'Vines', 107: 'Oak Fence Gate',
  108: 'Brick Stairs', 109: 'Stone Brick Stairs', 110: 'Mycelium',
  111: 'Lily Pad', 112: 'Nether Brick', 113: 'Nether Brick Fence',
  114: 'Nether Brick Stairs', 116: 'Enchantment Table',
  121: 'End Stone', 122: 'Dragon Egg',
  125: 'Double Wooden Slab', 126: 'Wooden Slab', 128: 'Sandstone Stairs',
  129: 'Emerald Ore', 130: 'Ender Chest', 133: 'Emerald Block',
  134: 'Spruce Wood Stairs', 135: 'Birch Wood Stairs',
  136: 'Jungle Wood Stairs', 137: 'Command Block', 138: 'Beacon',
  139: 'Cobblestone Wall', 143: 'Wooden Button', 145: 'Anvil',
  146: 'Trapped Chest', 151: 'Daylight Sensor', 152: 'Redstone Block',
  153: 'Nether Quartz Ore', 154: 'Hopper Block', 155: 'Quartz Block',
  156: 'Quartz Stairs', 158: 'Dropper', 159: 'Stained Hardened Clay',
  160: 'Stained Glass Pane', 163: 'Acacia Wood Stairs',
  164: 'Dark Oak Wood Stairs', 170: 'Hay Bale', 171: 'Carpet',
  172: 'Hardened Clay', 173: 'Coal Block', 174: 'Packed Ice',
  175: 'Large Flowers',
  // Items
  256: 'Iron Shovel',       257: 'Iron Pickaxe',      258: 'Iron Axe',
  259: 'Flint and Steel',   260: 'Apple',              261: 'Bow',
  262: 'Arrow',             263: 'Coal',               264: 'Diamond',
  265: 'Iron Ingot',        266: 'Gold Ingot',         267: 'Iron Sword',
  268: 'Wooden Sword',      269: 'Wooden Shovel',      270: 'Wooden Pickaxe',
  271: 'Wooden Axe',        272: 'Stone Sword',        273: 'Stone Shovel',
  274: 'Stone Pickaxe',     275: 'Stone Axe',          276: 'Diamond Sword',
  277: 'Diamond Shovel',    278: 'Diamond Pickaxe',    279: 'Diamond Axe',
  280: 'Stick',             281: 'Bowl',               282: 'Mushroom Stew',
  283: 'Golden Sword',      284: 'Golden Shovel',      285: 'Golden Pickaxe',
  286: 'Golden Axe',        287: 'String',             288: 'Feather',
  289: 'Gunpowder',         290: 'Wooden Hoe',         291: 'Stone Hoe',
  292: 'Iron Hoe',          293: 'Diamond Hoe',        294: 'Golden Hoe',
  295: 'Seeds',             296: 'Wheat',              297: 'Bread',
  298: 'Leather Helmet',    299: 'Leather Chestplate', 300: 'Leather Leggings',
  301: 'Leather Boots',     302: 'Chain Helmet',       303: 'Chain Chestplate',
  304: 'Chain Leggings',    305: 'Chain Boots',        306: 'Iron Helmet',
  307: 'Iron Chestplate',   308: 'Iron Leggings',      309: 'Iron Boots',
  310: 'Diamond Helmet',    311: 'Diamond Chestplate', 312: 'Diamond Leggings',
  313: 'Diamond Boots',     314: 'Golden Helmet',      315: 'Golden Chestplate',
  316: 'Golden Leggings',   317: 'Golden Boots',       318: 'Flint',
  319: 'Raw Porkchop',      320: 'Cooked Porkchop',    321: 'Painting',
  322: 'Golden Apple',      323: 'Sign',               324: 'Wooden Door',
  325: 'Bucket',            326: 'Water Bucket',       327: 'Lava Bucket',
  328: 'Minecart',          329: 'Saddle',             330: 'Iron Door',
  331: 'Redstone',          332: 'Snowball',           333: 'Boat',
  334: 'Leather',           335: 'Milk Bucket',        336: 'Clay Brick',
  337: 'Clay',              338: 'Sugar Cane',         339: 'Paper',
  340: 'Book',              341: 'Slimeball',          344: 'Egg',
  345: 'Compass',           346: 'Fishing Rod',        347: 'Clock',
  348: 'Glowstone Dust',    349: 'Raw Fish',           350: 'Cooked Fish',
  351: 'Dye',               352: 'Bone',               353: 'Sugar',
  354: 'Cake',              355: 'Bed',                356: 'Redstone Repeater',
  357: 'Cookie',            358: 'Map',                359: 'Shears',
  360: 'Melon',             361: 'Pumpkin Seeds',      362: 'Melon Seeds',
  363: 'Raw Beef',          364: 'Steak',              365: 'Raw Chicken',
  366: 'Cooked Chicken',    367: 'Rotten Flesh',       368: 'Ender Pearl',
  369: 'Blaze Rod',         370: 'Ghast Tear',         371: 'Gold Nugget',
  372: 'Nether Wart',       373: 'Potion',             374: 'Glass Bottle',
  375: 'Spider Eye',        376: 'Fermented Spider Eye', 377: 'Blaze Powder',
  378: 'Magma Cream',       379: 'Brewing Stand',      380: 'Cauldron',
  381: 'Eye of Ender',      382: 'Glistering Melon',   383: 'Spawn Egg',
  384: "Bottle o' Enchanting", 385: 'Fire Charge',     386: 'Book and Quill',
  387: 'Written Book',      388: 'Emerald',            389: 'Item Frame',
  390: 'Flower Pot',        391: 'Carrot',             392: 'Potato',
  393: 'Baked Potato',      394: 'Poisonous Potato',   395: 'Empty Map',
  396: 'Golden Carrot',     397: 'Skull',              398: 'Carrot on a Stick',
  399: 'Nether Star',       400: 'Pumpkin Pie',        401: 'Fireworks',
  402: 'Firework Star',     403: 'Enchanted Book',     404: 'Redstone Comparator',
  405: 'Nether Brick',      406: 'Nether Quartz',      407: 'Minecart with TNT',
  408: 'Minecart with Hopper', 416: 'Horse Armor (Leather)',
  417: 'Horse Armor (Iron)', 418: 'Horse Armor (Gold)', 419: 'Horse Armor (Diamond)',
  420: 'Lead',              421: 'Name Tag',
};

// maximum damage value (= total durability uses) for each damageable item — 0 means not damageable
export const MAX_DAMAGE: Record<number, number> = {
  267: 251,  268: 60,   272: 132,  276: 1562, 283: 33,   // swords
  256: 251,  269: 60,   273: 132,  277: 1562, 284: 33,   // shovels
  257: 251,  270: 60,   274: 132,  278: 1562, 285: 33,   // pickaxes
  258: 251,  271: 60,   275: 132,  279: 1562, 286: 33,   // axes
  292: 251,  290: 60,   291: 132,  293: 1562, 294: 33,   // hoes
  261: 385,  346: 65,   259: 65,   359: 239,  398: 26,   // bow/rod/shears
  298: 56,   299: 81,   300: 76,   301: 66,               // leather armor
  302: 166,  303: 241,  304: 226,  305: 196,              // chain armor
  306: 166,  307: 241,  308: 226,  309: 196,              // iron armor
  310: 364,  311: 529,  312: 496,  313: 430,              // diamond armor
  314: 78,   315: 113,  316: 106,  317: 92,               // golden armor
};

export function getItemName(id: number): string {
  return ITEM_NAMES[id] ?? `Unknown (id=${id})`;
}

export function getMaxDamage(id: number): number {
  return MAX_DAMAGE[id] ?? 0;
}

// returns a broad category used for colour-coding items in the ui
export function getItemCategory(id: number): 'tool' | 'armor' | 'weapon' | 'food' | 'block' | 'misc' {
  if (id >= 1 && id <= 255) return 'block';
  if ([267, 268, 272, 276, 283].includes(id)) return 'weapon';
  if ([256,257,258,269,270,271,273,274,275,277,278,279,284,285,286,290,291,292,293,294,259,346,359,398].includes(id)) return 'tool';
  if (id >= 298 && id <= 317) return 'armor';
  if ([260,282,297,319,320,349,350,354,357,360,363,364,365,366,367,391,392,393,394,396,400].includes(id)) return 'food';
  return 'misc';
}

export const CATEGORY_COLORS: Record<ReturnType<typeof getItemCategory>, string> = {
  weapon: '#ef4444',
  tool:   '#f59e0b',
  armor:  '#3b82f6',
  food:   '#22c55e',
  block:  '#8b5cf6',
  misc:   '#6b7280',
};
