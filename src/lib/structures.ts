/**
 * LCE structure placement algorithms
 * Ported from the C++ source (Minecraft.World/VillageFeature.cpp, etc.)
 *
 * Computes where structures generate based on world seed,
 * using the same deterministic Java-compatible LCG random.
 */

import type { ParsedChunk } from './region';

// ── Java-compatible LCG Random ──────────────────────────────────────────────

const MULTIPLIER = 0x5DEECE66Dn;
const ADDEND = 0xBn;
const MASK = (1n << 48n) - 1n;

class LCGRandom {
  private seed = 0n;

  setSeed(s: bigint) {
    this.seed = (s ^ MULTIPLIER) & MASK;
  }

  private next(bits: number): number {
    this.seed = (this.seed * MULTIPLIER + ADDEND) & MASK;
    // Convert to signed 32-bit equivalent for the top `bits` bits
    return Number(this.seed >> BigInt(48 - bits));
  }

  nextInt(bound?: number): number {
    if (bound === undefined) return this.next(32);
    if (bound <= 0) return 0;
    if ((bound & (bound - 1)) === 0) {
      return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
    }
    let bits: number, val: number;
    do {
      bits = this.next(31);
      val = bits % bound;
    } while (bits - val + (bound - 1) < 0);
    return val;
  }

  nextDouble(): number {
    const hi = this.next(26);
    const lo = this.next(27);
    // (hi * 2^27 + lo) / 2^53
    return (hi * 134217728 + lo) / Number(1n << 53n);
  }
}

// ── Seed helpers ────────────────────────────────────────────────────────────

function getRandomFor(worldSeed: bigint, x: number, z: number, blend: number): LCGRandom {
  const rng = new LCGRandom();
  const seed = BigInt(x) * 341873128712n + BigInt(z) * 132897987541n + worldSeed + BigInt(blend);
  rng.setSeed(seed);
  return rng;
}

// ── Biome IDs (LCE / pre-1.13 numeric IDs) ─────────────────────────────────

const BIOME_PLAINS      = 1;
const BIOME_DESERT      = 2;
const BIOME_FOREST      = 4;
const BIOME_EXTREME_HILLS = 3;
const BIOME_SWAMPLAND   = 6;
const BIOME_TAIGA       = 5;
const BIOME_ICE_PLAINS  = 12;
const BIOME_ICE_MOUNTAINS = 13;
const BIOME_DESERT_HILLS = 17;
const BIOME_FOREST_HILLS = 18;
const BIOME_TAIGA_HILLS  = 19;
const BIOME_EXTREME_HILLS_EDGE = 20;
const BIOME_JUNGLE      = 21;
const BIOME_JUNGLE_HILLS = 22;

const VILLAGE_BIOMES = new Set([BIOME_PLAINS, BIOME_DESERT]);

const TEMPLE_BIOMES = new Set([
  BIOME_DESERT, BIOME_DESERT_HILLS,
  BIOME_JUNGLE, BIOME_JUNGLE_HILLS,
  BIOME_SWAMPLAND,
]);

const _STRONGHOLD_BIOMES = new Set([
  BIOME_DESERT, BIOME_FOREST, BIOME_EXTREME_HILLS, BIOME_SWAMPLAND,
  BIOME_TAIGA, BIOME_ICE_PLAINS, BIOME_ICE_MOUNTAINS, BIOME_DESERT_HILLS,
  BIOME_FOREST_HILLS, BIOME_EXTREME_HILLS_EDGE, BIOME_TAIGA_HILLS,
  BIOME_JUNGLE, BIOME_JUNGLE_HILLS,
]);
void _STRONGHOLD_BIOMES; // kept for reference; stronghold uses radial placement, not biome grid check

// ── Structure types ─────────────────────────────────────────────────────────

export type StructureType = 'village' | 'desert_temple' | 'jungle_temple' | 'witch_hut' | 'stronghold' | 'mineshaft' | 'dungeon';

export interface StructureLocation {
  type: StructureType;
  /** chunk X */
  chunkX: number;
  /** chunk Z */
  chunkZ: number;
  /** block X (center of chunk) */
  blockX: number;
  /** block Z (center of chunk) */
  blockZ: number;
  /** entity ID for dungeon spawners (e.g. "Zombie", "Skeleton", "Spider") */
  entityId?: string;
}

// ── Grid-based feature check (Villages & Temples) ───────────────────────────

function gridFeatureChunk(
  chunkX: number,
  chunkZ: number,
  worldSeed: bigint,
  spacing: number,
  minSep: number,
  blend: number,
): { isFeature: boolean; } {
  let x = chunkX;
  let z = chunkZ;

  if (x < 0) x -= spacing - 1;
  if (z < 0) z -= spacing - 1;

  let gridX = Math.floor(x / spacing);
  let gridZ = Math.floor(z / spacing);

  const rng = getRandomFor(worldSeed, gridX, gridZ, blend);

  const selectedX = gridX * spacing + rng.nextInt(spacing - minSep);
  const selectedZ = gridZ * spacing + rng.nextInt(spacing - minSep);

  return { isFeature: chunkX === selectedX && chunkZ === selectedZ };
}

// ── Biome lookup from chunks ────────────────────────────────────────────────

/** Build a map from "chunkX,chunkZ" → biome at center (8,8) of the chunk */
function buildBiomeMap(chunks: ParsedChunk[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of chunks) {
    // biome at center of chunk (x=8, z=8)
    const biome = c.biomes[8 * 16 + 8];
    map.set(`${c.chunkX},${c.chunkZ}`, biome);
  }
  return map;
}

// ── Find all structures ─────────────────────────────────────────────────────

export function findStructures(
  chunks: ParsedChunk[],
  worldSeed: bigint,
): StructureLocation[] {
  const results: StructureLocation[] = [];
  const biomeMap = buildBiomeMap(chunks);

  // Determine the chunk range
  let minCX = Infinity, maxCX = -Infinity;
  let minCZ = Infinity, maxCZ = -Infinity;
  for (const c of chunks) {
    if (c.chunkX < minCX) minCX = c.chunkX;
    if (c.chunkX > maxCX) maxCX = c.chunkX;
    if (c.chunkZ < minCZ) minCZ = c.chunkZ;
    if (c.chunkZ > maxCZ) maxCZ = c.chunkZ;
  }

  // Determine spacing — console small worlds use 16 for villages
  const xzSize = maxCX - minCX + 1;
  const villageSpacing = xzSize < 128 ? 16 : 32;

  // --- Villages ---
  for (const c of chunks) {
    const { isFeature } = gridFeatureChunk(c.chunkX, c.chunkZ, worldSeed, villageSpacing, 8, 10387312);
    if (isFeature) {
      const biome = biomeMap.get(`${c.chunkX},${c.chunkZ}`);
      if (biome !== undefined && VILLAGE_BIOMES.has(biome)) {
        results.push({
          type: 'village',
          chunkX: c.chunkX,
          chunkZ: c.chunkZ,
          blockX: c.chunkX * 16 + 8,
          blockZ: c.chunkZ * 16 + 8,
        });
      }
    }
  }

  // --- Temples / Witch Huts ---
  for (const c of chunks) {
    const { isFeature } = gridFeatureChunk(c.chunkX, c.chunkZ, worldSeed, 32, 8, 14357617);
    if (isFeature) {
      const biome = biomeMap.get(`${c.chunkX},${c.chunkZ}`);
      if (biome !== undefined && TEMPLE_BIOMES.has(biome)) {
        let type: StructureType;
        if (biome === BIOME_DESERT || biome === BIOME_DESERT_HILLS) {
          type = 'desert_temple';
        } else if (biome === BIOME_JUNGLE || biome === BIOME_JUNGLE_HILLS) {
          type = 'jungle_temple';
        } else {
          type = 'witch_hut';
        }
        results.push({
          type,
          chunkX: c.chunkX,
          chunkZ: c.chunkZ,
          blockX: c.chunkX * 16 + 8,
          blockZ: c.chunkZ * 16 + 8,
        });
      }
    }
  }

  // --- Stronghold (1 per console world) ---
  {
    const rng = new LCGRandom();
    rng.setSeed(worldSeed);

    const angle = rng.nextDouble() * Math.PI * 2.0;

    let dist: number;
    if (xzSize < 72) {
      // Small world formula
      dist = (1.25 + rng.nextDouble()) * (3 + rng.nextInt(4));
    } else {
      // Large world formula
      dist = (1.25 + rng.nextDouble()) * 32;
    }

    const selectedX = Math.round(Math.cos(angle) * dist);
    const selectedZ = Math.round(Math.sin(angle) * dist);

    // Check if the stronghold chunk is in our loaded chunks
    // The game would search for a valid biome nearby, but we'll place it at the computed position
    // and mark it if it's within our chunk range
    if (selectedX >= minCX && selectedX <= maxCX && selectedZ >= minCZ && selectedZ <= maxCZ) {
      results.push({
        type: 'stronghold',
        chunkX: selectedX,
        chunkZ: selectedZ,
        blockX: selectedX * 16 + 8,
        blockZ: selectedZ * 16 + 8,
      });
    }
  }

  // --- Dungeons (from parsed spawner tile entities, excluding cave spiders) ---
  for (const c of chunks) {
    for (const spawner of c.spawners) {
      if (spawner.entityId === 'CaveSpider') continue; // mineshaft spawners
      results.push({
        type: 'dungeon',
        chunkX: c.chunkX,
        chunkZ: c.chunkZ,
        blockX: c.chunkX * 16 + spawner.localX,
        blockZ: c.chunkZ * 16 + spawner.localZ,
        entityId: spawner.entityId,
      });
    }
  }

  // --- Mineshafts ---
  // Mineshafts use a seeded random per chunk: seed = chunkX * big + chunkZ * big2 + worldSeed
  // The algorithm: nextDouble() < 0.01 && nextInt(80) < max(abs(x), abs(z))
  for (const c of chunks) {
    const rng = new LCGRandom();
    const seed = BigInt(c.chunkX) * 341873128712n + BigInt(c.chunkZ) * 132897987541n + worldSeed;
    rng.setSeed(seed);

    if (rng.nextDouble() < 0.01 && rng.nextInt(80) < Math.max(Math.abs(c.chunkX), Math.abs(c.chunkZ))) {
      results.push({
        type: 'mineshaft',
        chunkX: c.chunkX,
        chunkZ: c.chunkZ,
        blockX: c.chunkX * 16 + 8,
        blockZ: c.chunkZ * 16 + 8,
      });
    }
  }

  return results;
}

// ── Structure display info ──────────────────────────────────────────────────

export const STRUCTURE_INFO: Record<StructureType, { label: string; color: string; emoji: string }> = {
  village:        { label: 'Village',        color: '#d4a373', emoji: '🏘️' },
  desert_temple:  { label: 'Desert Temple',  color: '#e9c46a', emoji: '🏛️' },
  jungle_temple:  { label: 'Jungle Temple',  color: '#2a9d8f', emoji: '🏯' },
  witch_hut:      { label: 'Witch Hut',      color: '#7b2d8e', emoji: '🧙' },
  stronghold:     { label: 'Stronghold',     color: '#264653', emoji: '🏰' },
  mineshaft:      { label: 'Mineshaft',      color: '#6c584c', emoji: '⛏️' },
  dungeon:        { label: 'Dungeon',        color: '#555b63', emoji: '💀' },
};