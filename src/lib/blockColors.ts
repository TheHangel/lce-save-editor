/**
 * block ID → top-down map color mapping
 * colors chosen to match the classic Minecraft map colors for TU19 (1.6 era) block IDs
 */

// [R, G, B] tuples
const BLOCK_COLORS: Record<number, [number, number, number]> = {
  // natural terrain
  1:   [128, 128, 128], // stone
  2:   [100, 160,  60], // grass block
  3:   [134,  96,  67], // dirt
  4:   [120, 120, 120], // cobblestone
  5:   [157, 128,  79], // oak planks
  6:   [ 48, 128,  48], // sapling
  7:   [ 84,  84,  84], // bedrock
  8:   [ 64,  64, 255], // flowing water
  9:   [ 64,  64, 255], // still water
  10:  [255, 100,   0], // flowing lava
  11:  [255, 100,   0], // still lava
  12:  [219, 211, 160], // sand
  13:  [136, 126, 126], // gravel
  14:  [143, 140, 125], // gold ore
  15:  [136, 130, 126], // iron ore
  16:  [115, 115, 115], // coal ore
  17:  [102,  81,  51], // oak log
  18:  [ 56, 118,  29], // oak leaves
  19:  [183, 183,  57], // sponge
  20:  [175, 210, 210], // glass

  // ores
  21:  [102, 118, 137], // lapis ore
  22:  [ 29,  71, 165], // lapis block
  23:  [110, 110, 110], // dispenser
  24:  [218, 210, 158], // sandstone
  25:  [100,  67,  50], // note block

  // wool (35 + damage, but we only have base ID)
  35:  [222, 222, 222], // white wool

  // plants & misc
  31:  [ 76, 128,  44], // tall grass
  32:  [123, 104,  57], // dead bush
  37:  [255, 255,   0], // dandelion
  38:  [255,   0,   0], // poppy
  39:  [145, 109,  85], // brown mushroom
  40:  [205,  47,  47], // red mushroom

  // metal blocks
  41:  [250, 238, 77 ], // gold block
  42:  [220, 220, 220], // iron block
  43:  [168, 168, 168], // double stone slab
  44:  [168, 168, 168], // stone slab
  45:  [150,  90,  75], // bricks
  46:  [187,  65,  55], // TNT
  47:  [157, 128,  79], // bookshelf
  48:  [104, 120, 104], // mossy cobblestone
  49:  [ 20,  18,  30], // obsidian

  // torch, fire, spawner
  50:  [255, 216,   0], // torch
  51:  [255, 170,   0], // fire
  52:  [ 25,  40,  52], // monster spawner

  // stairs & chests
  53:  [157, 128,  79], // oak stairs
  54:  [162, 130,  78], // chest
  56:  [129, 215, 225], // diamond ore
  57:  [100, 220, 220], // diamond block
  58:  [157, 128,  79], // crafting table
  59:  [ 50, 128,   0], // wheat crops

  60:  [134,  96,  67], // farmland
  61:  [110, 110, 110], // furnace
  62:  [110, 110, 110], // burning furnace

  // redstone
  73:  [132,  92,  92], // redstone ore
  74:  [142, 102, 102], // lit redstone ore
  75:  [130,  59,  41], // redstone torch off
  76:  [175,  70,  43], // redstone torch on

  78:  [240, 252, 252], // snow layer
  79:  [160, 190, 255], // ice
  80:  [240, 252, 252], // snow block
  81:  [ 13, 120,  13], // cactus
  82:  [158, 164, 176], // clay
  83:  [148, 192, 101], // sugar cane
  84:  [100,  67,  50], // jukebox
  85:  [157, 128,  79], // fence
  86:  [200, 120,  20], // pumpkin

  87:  [111,  54,  52], // netherrack
  88:  [ 85,  65,  51], // soul sand
  89:  [175, 140,  65], // glowstone

  // nether
  91:  [200, 120,  20], // jack o'lantern
  95:  [175, 210, 210], // stained glass (white)
  96:  [157, 128,  79], // trapdoor
  97:  [128, 128, 128], // silverfish stone
  98:  [122, 122, 122], // stone bricks
  99:  [200, 150, 100], // brown mushroom block
  100: [200,  50,  50], // red mushroom block

  // structures
  101: [ 90,  90,  90], // iron bars
  102: [175, 210, 210], // glass pane
  103: [110, 165,  50], // melon block
  106: [ 56, 118,  29], // vines
  108: [150,  90,  75], // brick stairs
  109: [122, 122, 122], // stone brick stairs
  110: [100, 100,  90], // mycelium

  111: [ 12,  80,  30], // lily pad
  112: [ 44,  22,  26], // nether brick
  113: [ 44,  22,  26], // nether brick fence
  114: [ 44,  22,  26], // nether brick stairs

  115: [200, 120,  20], // nether wart (block)
  120: [225, 225, 170], // end portal frame
  121: [225, 225, 170], // end stone
  122: [ 16,   8,  16], // dragon egg
  125: [157, 128,  79], // double wood slab
  126: [157, 128,  79], // wood slab

  // jungle wood & misc
  128: [218, 210, 158], // sandstone stairs
  129: [ 67, 110,  81], // emerald ore
  133: [ 80, 210, 120], // emerald block

  134: [100,  76,  50], // spruce stairs
  135: [157, 112,  79], // birch stairs
  136: [140, 100,  62], // jungle stairs

  139: [120, 120, 120], // cobblestone wall
  141: [ 50, 128,   0], // carrot
  142: [ 50, 128,   0], // potato

  155: [230, 223, 215], // quartz block
  156: [230, 223, 215], // quartz stairs

  159: [150, 100,  80], // stained clay (default terracotta)
  160: [175, 210, 210], // stained glass pane
  161: [ 56, 118,  29], // acacia leaves
  162: [150, 100,  60], // acacia/dark oak log
  170: [180, 160,  40], // hay bale
  171: [222, 222, 222], // carpet
  172: [150, 100,  80], // hardened clay
  173: [ 20,  20,  20], // coal block
  174: [160, 200, 255], // packed ice

  // double-tall plants
  175: [ 76, 128,  44], // sunflower / tall grass etc.

  // fallback for water transparency
  255: [  0,   0,   0], // unused / structure void
};

/** height-based shading factor: lower = darker, higher = lighter */
function heightShade(y: number): number {
  // normalize 0-127 to ~0.7-1.15
  return 0.7 + (y / 127) * 0.45;
}

const DEFAULT_COLOR: [number, number, number] = [200, 0, 200]; // magenta for unknown blocks

/**
 * Get the map color for a block ID at a given Y height.
 * Returns [R, G, B] with height-based shading applied.
 */
export function getBlockColor(blockId: number, y: number): [number, number, number] {
  const base = BLOCK_COLORS[blockId] ?? DEFAULT_COLOR;
  const shade = heightShade(y);
  return [
    Math.min(255, Math.round(base[0] * shade)),
    Math.min(255, Math.round(base[1] * shade)),
    Math.min(255, Math.round(base[2] * shade)),
  ];
}

/** check if a block is considered "water" for map rendering */
export function isWater(blockId: number): boolean {
  return blockId === 8 || blockId === 9;
}