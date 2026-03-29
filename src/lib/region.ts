/**
 * LCE region file (.mcr) parser
 *
 * region file layout (from the C++ source: RegionFile.h/cpp):
 *   sector 0 (4096 bytes): chunk offset table — 1024 x uint32 LE
 *     each entry: (sectorNumber << 8) | numSectors
 *   sector 1 (4096 bytes): chunk timestamps — 1024 x uint32 LE
 *   sector 2+: chunk data
 *
 * chunk data header (8 bytes):
 *   uint32 LE  compressedLength — high bit (0x80000000) = RLE flag
 *   uint32 LE  decompressedLength
 *   then compressedLength bytes of zlib-compressed data
 *   if RLE flag: after zlib inflate, run RLE decompression
 *
 * chunk payload after decompression (DataInputStream = big-endian):
 *   short  version (2 bytes)
 *   int    chunkX  (4 bytes)
 *   int    chunkZ  (4 bytes)
 *   long   gameTime (8 bytes)
 *   long   inhabitedTime (8 bytes) — only if version >= 9
 *   CompressedTileStorage  lowerBlocks (Y 0-127)
 *   CompressedTileStorage  upperBlocks (Y 128-255)
 *   SparseDataStorage      lowerData
 *   SparseDataStorage      upperData
 *   SparseLightStorage     lowerSkyLight
 *   SparseLightStorage     upperSkyLight
 *   SparseLightStorage     lowerBlockLight
 *   SparseLightStorage     upperBlockLight
 *   byte[256]              heightMap (16x16)
 *   short                  terrainPopulatedFlags
 *   byte[256]              biomes (16x16)
 *   NBT CompoundTag        (Entities, TileEntities, TileTicks)
 */

import pako from 'pako';
import type { ContainerEntry } from './containers';
import { parseNbt } from './nbt';

// ── types ──────────────────────────────────────────────────────────────────────

export interface ChunkLocation {
  /** chunk x within region (0-31) */
  localX: number;
  /** chunk z within region (0-31) */
  localZ: number;
  /** byte offset in region file */
  byteOffset: number;
  /** number of 4096-byte sectors */
  sectorCount: number;
}

export interface SpawnerInfo {
  /** block position within chunk (0-15) */
  localX: number;
  localY: number;
  localZ: number;
  /** entity ID string from NBT (e.g. "Skeleton", "CaveSpider") */
  entityId: string;
}

export interface ParsedChunk {
  /** absolute chunk x coordinate */
  chunkX: number;
  /** absolute chunk z coordinate */
  chunkZ: number;
  /** block id array, 16x128x16, indexed as blocks[x << 11 | z << 7 | y] */
  blocks: Uint8Array;
  /** height map 16x16, indexed as heightMap[z * 16 + x] */
  heightMap: Uint8Array;
  /** biome array 16x16, indexed as biomes[z * 16 + x] */
  biomes: Uint8Array;
  /** mob spawners found in this chunk's tile entities */
  spawners: SpawnerInfo[];
}

export interface RegionInfo {
  /** region x coordinate (from filename r.X.Z.mcr) */
  regionX: number;
  /** region z coordinate */
  regionZ: number;
  /** list of chunk locations present in this region */
  chunkLocations: ChunkLocation[];
}

// ── RLE decompression (from compression.cpp) ────────────────────────────────

function decompressRLE(input: Uint8Array, expectedSize: number): Uint8Array {
  const out = new Uint8Array(expectedSize);
  let inPos = 0;
  let outPos = 0;

  while (inPos < input.length && outPos < expectedSize) {
    const b = input[inPos++];
    if (b === 255) {
      if (inPos >= input.length) break;
      const count = input[inPos++];
      if (count < 3) {
        // 1, 2, or 3 literal 255s
        for (let i = 0; i < count + 1 && outPos < expectedSize; i++) {
          out[outPos++] = 255;
        }
      } else {
        // run of (count + 1) copies of the next byte
        if (inPos >= input.length) break;
        const data = input[inPos++];
        for (let i = 0; i < count + 1 && outPos < expectedSize; i++) {
          out[outPos++] = data;
        }
      }
    } else {
      out[outPos++] = b;
    }
  }

  return out.subarray(0, outPos);
}

// ── CompressedTileStorage decoder (from CompressedTileStorage.h/cpp) ────────

// constants from the C++ header
const INDEX_TYPE_MASK          = 0x0003;
const INDEX_TYPE_1_BIT         = 0x0000;
const INDEX_TYPE_2_BIT         = 0x0001;
const INDEX_TYPE_4_BIT         = 0x0002;
const INDEX_TYPE_0_OR_8_BIT    = 0x0003;
const INDEX_TYPE_0_BIT_FLAG    = 0x0004;
const INDEX_OFFSET_SHIFT       = 1;
const INDEX_OFFSET_MASK        = 0x7ffe;
const INDEX_TILE_SHIFT         = 8;
const INDEX_TILE_MASK          = 0x00ff;

/**
 * Mapping from (block, tile) to the flat index into the 32768-byte block array.
 * The layout is: xxxxzzzzyyyyyyy where those bits come from block & tile indices.
 * (from CompressedTileStorage::getIndex)
 */
function getDataIndex(block: number, tile: number): number {
  const idx = ((block & 0x180) << 6) | ((block & 0x060) << 4) | ((block & 0x01f) << 2);
  const tidx = ((tile & 0x30) << 7) | ((tile & 0x0c) << 5) | (tile & 0x03);
  return idx | tidx;
}

/**
 * Decode a CompressedTileStorage from the chunk data stream.
 * Returns a flat array of 32768 bytes (16x128x16 block IDs).
 */
function decodeCompressedTileStorage(
  data: Uint8Array,
  dv: DataView,
  pos: number,
): { blocks: Uint8Array; newPos: number } {
  const allocatedSize = dv.getInt32(pos, false); // big-endian (DataOutputStream)
  pos += 4;

  const blocks = new Uint8Array(32768); // 16x128x16

  if (allocatedSize <= 0) {
    return { blocks, newPos: pos };
  }

  const indicesStart = pos;
  const dataStart = pos + 1024; // indices are 512 x uint16 = 1024 bytes

  for (let bi = 0; bi < 512; bi++) {
    // indices are stored in native endianness (LE for Win64)
    const indexVal = dv.getUint16(indicesStart + bi * 2, true);
    const indexType = indexVal & INDEX_TYPE_MASK;

    if (indexType === INDEX_TYPE_0_OR_8_BIT) {
      if (indexVal & INDEX_TYPE_0_BIT_FLAG) {
        // 0-bit: all 64 tiles in this 4x4x4 block have the same value
        const tileVal = (indexVal >> INDEX_TILE_SHIFT) & INDEX_TILE_MASK;
        for (let j = 0; j < 64; j++) {
          blocks[getDataIndex(bi, j)] = tileVal;
        }
      } else {
        // 8-bit: raw 64 bytes
        const offset = (indexVal >> INDEX_OFFSET_SHIFT) & INDEX_OFFSET_MASK;
        for (let j = 0; j < 64; j++) {
          blocks[getDataIndex(bi, j)] = data[dataStart + offset + j];
        }
      }
    } else {
      // 1, 2, or 4 bits per tile (palette-based)
      const bitsPerTile = 1 << indexType;       // 1, 2, or 4
      const tileTypeCount = 1 << bitsPerTile;   // 2, 4, or 16
      const tileTypeMask = tileTypeCount - 1;
      const indexShift = 3 - indexType;          // 3, 2, or 1
      const indexMaskBits = 7 >> indexType;      // 7, 3, or 1

      const offset = (indexVal >> INDEX_OFFSET_SHIFT) & INDEX_OFFSET_MASK;
      const paletteStart = dataStart + offset;
      const packedStart = paletteStart + tileTypeCount;

      for (let j = 0; j < 64; j++) {
        const byteIdx = (j >> indexShift) & (62 >> indexShift);
        const bit = (j & indexMaskBits) * bitsPerTile;
        const paletteIdx = (data[packedStart + byteIdx] >> bit) & tileTypeMask;
        blocks[getDataIndex(bi, j)] = data[paletteStart + paletteIdx];
      }
    }
  }

  return { blocks, newPos: pos + allocatedSize };
}

/**
 * Skip a SparseDataStorage or SparseLightStorage section.
 * Format: int32 BE count, then (count * 128 + 128) raw bytes.
 */
function skipSparseStorage(dv: DataView, pos: number): number {
  const count = dv.getInt32(pos, false);
  return pos + 4 + count * 128 + 128;
}

// ── chunk parsing ────────────────────────────────────────────────────────────

function parseChunkData(regionData: Uint8Array, loc: ChunkLocation, regionX: number, regionZ: number): ParsedChunk | null {
  const rdv = new DataView(regionData.buffer, regionData.byteOffset, regionData.byteLength);

  // read 8-byte chunk header
  const rawLen = rdv.getUint32(loc.byteOffset, true); // LE
  const useRLE = !!(rawLen & 0x80000000);
  const compLen = rawLen & 0x7FFFFFFF;
  const decompLen = rdv.getUint32(loc.byteOffset + 4, true);

  if (compLen === 0 || compLen > loc.sectorCount * 4096) return null;

  // step 1: zlib inflate
  const compData = regionData.subarray(loc.byteOffset + 8, loc.byteOffset + 8 + compLen);
  let chunkRaw: Uint8Array;
  try {
    chunkRaw = pako.inflate(compData);
  } catch {
    return null;
  }

  // step 2: RLE decompress if flagged
  const chunkData = useRLE ? decompressRLE(chunkRaw, decompLen) : chunkRaw;

  if (chunkData.length < 26) return null; // too short for header

  const dv = new DataView(chunkData.buffer, chunkData.byteOffset, chunkData.byteLength);
  let pos = 0;

  // chunk header (big-endian, DataInputStream)
  const version = dv.getInt16(pos, false); pos += 2;
  const chunkX = dv.getInt32(pos, false); pos += 4;
  const chunkZ = dv.getInt32(pos, false); pos += 4;
  pos += 8; // skip gameTime (long)
  if (version >= 9) pos += 8; // skip inhabitedTime

  // lower blocks (Y 0-127)
  const lower = decodeCompressedTileStorage(chunkData, dv, pos);
  pos = lower.newPos;

  // upper blocks (Y 128-255) — skip for map purposes
  const upperAllocSize = dv.getInt32(pos, false);
  pos += 4 + Math.max(0, upperAllocSize);

  // skip SparseDataStorage x2 (lower data, upper data)
  pos = skipSparseStorage(dv, pos);
  pos = skipSparseStorage(dv, pos);

  // skip SparseLightStorage x4
  for (let i = 0; i < 4; i++) {
    pos = skipSparseStorage(dv, pos);
  }

  // heightmap (256 bytes)
  const heightMap = chunkData.slice(pos, pos + 256);
  pos += 256;

  // skip terrainPopulated (2 bytes)
  pos += 2;

  // biomes (256 bytes)
  const biomes = chunkData.slice(pos, pos + 256);
  pos += 256;

  // parse chunk NBT to extract tile entities (spawners)
  const spawners: SpawnerInfo[] = [];
  try {
    const nbtData = chunkData.slice(pos);
    if (nbtData.length > 0 && nbtData[0] === 0x0A) { // compound tag
      const nbt = parseNbt(nbtData);
      const tileEntities = nbt.root.tags['TileEntities'];
      if (tileEntities?.type === 9) { // List
        for (const item of tileEntities.items) {
          if (item.type !== 10) continue; // must be Compound
          const id = item.tags['id'];
          if (id?.type === 8 && id.value === 'MobSpawner') {
            const sx = item.tags['x'];
            const sy = item.tags['y'];
            const sz = item.tags['z'];
            const entityIdTag = item.tags['EntityId'];
            if (sx?.type === 3 && sy?.type === 3 && sz?.type === 3 && entityIdTag?.type === 8) {
              spawners.push({
                localX: ((sx.value % 16) + 16) % 16,
                localY: sy.value,
                localZ: ((sz.value % 16) + 16) % 16,
                entityId: entityIdTag.value,
              });
            }
          }
        }
      }
    }
  } catch {
    // NBT parsing failed — skip spawner extraction
  }

  return {
    chunkX,
    chunkZ,
    blocks: lower.blocks,
    heightMap,
    biomes,
    spawners,
  };
}

// ── region file parsing ──────────────────────────────────────────────────────

function getChunkLocations(regionData: Uint8Array): ChunkLocation[] {
  const dv = new DataView(regionData.buffer, regionData.byteOffset, regionData.byteLength);
  const locs: ChunkLocation[] = [];

  for (let z = 0; z < 32; z++) {
    for (let x = 0; x < 32; x++) {
      const idx = x + z * 32;
      const val = dv.getUint32(idx * 4, true); // LE for Win64
      const sectorOffset = val >> 8;
      const sectorCount = val & 0xFF;
      if (sectorOffset > 0 && sectorCount > 0) {
        locs.push({
          localX: x,
          localZ: z,
          byteOffset: sectorOffset * 4096,
          sectorCount,
        });
      }
    }
  }

  return locs;
}

// ── public API ───────────────────────────────────────────────────────────────

/** extract region X,Z from a filename like "r.-1.0.mcr" or "DIM-1r.0.0.mcr" */
export function parseRegionFilename(name: string): { regionX: number; regionZ: number; dimension: string } | null {
  // match patterns like "r.X.Z.mcr" with optional DIM prefix
  const m = name.match(/^(DIM-?\d+\/?)?r\.(-?\d+)\.(-?\d+)\.mcr$/);
  if (!m) return null;
  return {
    dimension: m[1]?.replace(/\/$/, '') ?? 'overworld',
    regionX: parseInt(m[2]),
    regionZ: parseInt(m[3]),
  };
}

/** find all overworld region entries from the container */
export function getOverworldRegions(entries: ContainerEntry[]): ContainerEntry[] {
  return entries.filter(e => {
    const info = parseRegionFilename(e.name);
    return info && info.dimension === 'overworld';
  });
}

/**
 * Parse all chunks from a region file and return a flat map of block data.
 * For top-down rendering, we only care about the top visible block at each (x,z).
 */
export function parseRegionChunks(
  regionData: Uint8Array,
  regionX: number,
  regionZ: number,
): ParsedChunk[] {
  const locations = getChunkLocations(regionData);
  const chunks: ParsedChunk[] = [];

  for (const loc of locations) {
    try {
      const chunk = parseChunkData(regionData, loc, regionX, regionZ);
      if (chunk) chunks.push(chunk);
    } catch {
      // skip corrupted chunks
    }
  }

  return chunks;
}

/**
 * For a parsed chunk, compute the top-down color map.
 * Returns a 16x16 array of block IDs (the topmost non-air block at each column).
 */
export function getTopBlocks(chunk: ParsedChunk): { blockId: number; y: number }[] {
  const result: { blockId: number; y: number }[] = new Array(256);

  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      const hmIdx = z * 16 + x;
      let y = Math.min(chunk.heightMap[hmIdx], 127);

      // scan downward from heightmap to find topmost non-air block
      let blockId = 0;
      while (y >= 0) {
        const idx = (x << 11) | (z << 7) | y;
        blockId = chunk.blocks[idx];
        if (blockId !== 0) break;
        y--;
      }

      result[hmIdx] = { blockId, y: Math.max(y, 0) };
    }
  }

  return result;
}