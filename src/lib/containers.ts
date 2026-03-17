/**
 * parser and rebuilder for the .ms console save container format
 *
 * how reading a .ms file works, step by step:
 *   1. check the first 8 bytes (outer header) — bytes 0–3 must equal 0 (the zlib flag),
 *      and bytes 4–7 give you the expected decompressed size as a sanity check
 *   2. everything from byte 8 onwards is a raw zlib stream — inflate it with pako
 *      to get the "inner buffer" which holds all the actual data
 *   3. read the 12-byte inner header at the start of that buffer:
 *        - headerOffset tells you where the file-entry table lives (near the end)
 *        - headerSize tells you how many files are embedded
 *        - two int16s give you the original and current save version numbers
 *   4. seek to headerOffset and walk headerSize × 144-byte FileEntrySaveDataV2 entries,
 *      each of which has the filename (utf-16le, null-padded to 128 bytes), the file's
 *      byte length, and its start offset within the inner buffer
 *   5. slice out each file's bytes using startOffset + length
 *   6. look for a player .dat file (path contains "players/" or starts with "p_"/"n_")
 *      and optionally level.dat — both are raw uncompressed nbt
 *
 * outer layout:
 *   [0..3]  uint32 LE  flag — must be 0 (indicates zlib-compressed save)
 *   [4..7]  uint32 LE  decompressed size of the inner buffer
 *   [8..]   zlib data — inflate this to get the inner buffer
 *
 * inner buffer layout (after inflate):
 *   [0..3]   uint32 LE  headerOffset  — byte offset to the FileEntrySaveDataV2 table
 *   [4..7]   uint32 LE  headerSize    — number of entries in the table
 *   [8..9]   int16  LE  originalSaveVersion
 *   [10..11] int16  LE  saveVersion
 *   [12..]   raw file data, each embedded file packed consecutively
 *   [headerOffset..]  FileEntrySaveDataV2 × headerSize
 *
 * FileEntrySaveDataV2 (144 bytes each):
 *   [0..127]   wchar_t[64]  filename — utf-16le, null-padded to 128 bytes
 *   [128..131] uint32 LE    byte length of this file's data
 *   [132..135] uint32 LE    start offset into the inner buffer
 *   [136..143] int64  LE    last modified timestamp (preserved on rebuild)
 */

import pako from 'pako';
import { parseNbt, NbtFile } from './nbt';

const FILE_ENTRY_SIZE = 144;
const INNER_HEADER_SIZE = 12;

// ── types ─────────────────────────────────────────────────────────────────────

export interface ContainerEntry {
  name: string;
  data: Uint8Array;
  origStartOffset: number;
  lastModLow: number;   // low 32 bits of lastModifiedTime (LE uint32)
  lastModHigh: number;  // high 32 bits of lastModifiedTime (LE uint32)
}

export interface ParsedContainer {
  origVersion: number;
  curVersion: number;
  entries: ContainerEntry[];
}

export interface LoadedSave {
  filename: string;
  format: 'console_save' | 'plain_nbt';
  originalBytes: Uint8Array;
  container: ParsedContainer | null;
  playerFilename: string | null;
  levelFilename: string | null;
  playerNbt: NbtFile;
  levelNbt: NbtFile | null;
}

// ── detection ─────────────────────────────────────────────────────────────────

export function isConsoleContainer(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  const dv = new DataView(bytes.buffer, bytes.byteOffset);
  const flag      = dv.getUint32(0, true);
  const decompSz  = dv.getUint32(4, true);
  return flag === 0 && decompSz > 0 && decompSz <= 256 * 1024 * 1024;
}

// ── parser ────────────────────────────────────────────────────────────────────

function decompressInner(bytes: Uint8Array): Uint8Array {
  // skip the 8-byte outer header and inflate the rest — this gives us the inner buffer
  const compressed = bytes.subarray(8);
  return pako.inflate(compressed);
}

function readEntries(buf: Uint8Array): { entries: ContainerEntry[]; origVersion: number; curVersion: number } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // first 12 bytes are the inner header — tells us where the file-entry table is
  const headerOffset = dv.getUint32(0, true);
  const headerSize   = dv.getUint32(4, true);
  const origVersion  = dv.getInt16(8,  true);
  const curVersion   = dv.getInt16(10, true);

  const entries: ContainerEntry[] = [];

  // walk the file-entry table — each entry is 144 bytes
  for (let i = 0; i < headerSize; i++) {
    const base = headerOffset + i * FILE_ENTRY_SIZE;
    if (base + FILE_ENTRY_SIZE > buf.length) break;

    // first 128 bytes of each entry are the filename encoded as utf-16le
    const nameBytes = buf.subarray(base, base + 128);
    let name: string;
    try {
      name = new TextDecoder('utf-16le').decode(nameBytes).replace(/\0+$/, '');
    } catch {
      continue;
    }
    if (!name) continue;

    // the next fields tell us where to find this file's data in the inner buffer
    const length      = dv.getUint32(base + 128, true);
    const startOffset = dv.getUint32(base + 132, true);
    const lastModLow  = dv.getUint32(base + 136, true);
    const lastModHigh = dv.getUint32(base + 140, true);

    if (startOffset === 0 || length === 0 || startOffset + length > buf.length) continue;

    entries.push({
      name,
      data: buf.slice(startOffset, startOffset + length),
      origStartOffset: startOffset,
      lastModLow,
      lastModHigh,
    });
  }

  return { entries, origVersion, curVersion };
}

export function parseConsoleContainer(bytes: Uint8Array): ParsedContainer {
  const buf = decompressInner(bytes);
  const { entries, origVersion, curVersion } = readEntries(buf);
  return { entries, origVersion, curVersion };
}

// ── rebuilder ─────────────────────────────────────────────────────────────────

// rebuild the .ms container, swapping in any replacement files, and return the new bytes
// replacements maps internal filenames → new raw bytes
export function rebuildConsoleContainer(
  originalBytes: Uint8Array,
  container: ParsedContainer,
  replacements: Record<string, Uint8Array>,
): Uint8Array {
  const buf = decompressInner(originalBytes);
  const dv0 = new DataView(buf.buffer, buf.byteOffset);
  const origVersion = dv0.getInt16(8,  true);
  const curVersion  = dv0.getInt16(10, true);

  // sort entries by original start offset so we pack them in the same order they came in
  const sorted = [...container.entries].sort((a, b) => a.origStartOffset - b.origStartOffset);

  // build new buffer: header placeholder first, then all file data, then the entry table
  const headerBuf = new Uint8Array(INNER_HEADER_SIZE);
  const chunks: Uint8Array[] = [headerBuf];
  let offset = INNER_HEADER_SIZE;

  const newEntries: Array<ContainerEntry & { newStart: number; newLength: number }> = [];
  for (const entry of sorted) {
    const newStart = offset;
    const data = replacements[entry.name] ?? entry.data;
    chunks.push(data);
    offset += data.length;
    newEntries.push({ ...entry, newStart, newLength: data.length });
  }

  // write the file-entry table — one 144-byte entry per file
  const newHeaderOffset = offset;
  for (const entry of newEntries) {
    const entryBuf = new Uint8Array(FILE_ENTRY_SIZE);
    const edv = new DataView(entryBuf.buffer);

    const nameEnc = new TextEncoder().encode(entry.name);
    const nameUtf16 = encodeUtf16Le(entry.name);
    const namePad = new Uint8Array(128);
    namePad.set(nameUtf16.subarray(0, 128));
    entryBuf.set(namePad, 0);

    edv.setUint32(128, entry.newLength, true);
    edv.setUint32(132, entry.newStart,  true);
    edv.setUint32(136, entry.lastModLow,  true);
    edv.setUint32(140, entry.lastModHigh, true);

    chunks.push(entryBuf);
    void nameEnc; // only namePad (utf-16le) is used — nameEnc is just for the type reference
  }

  // now we know newHeaderOffset so we can fill in the 12-byte inner header we reserved earlier
  const hdv = new DataView(headerBuf.buffer);
  hdv.setUint32(0, newHeaderOffset,   true);
  hdv.setUint32(4, newEntries.length, true);
  hdv.setInt16(8,  origVersion, true);
  hdv.setInt16(10, curVersion,  true);

  // concatenate all chunks into a single buffer ready for compression
  const totalSize = chunks.reduce((s, c) => s + c.length, 0);
  const newBuf = new Uint8Array(totalSize);
  let pos = 0;
  for (const c of chunks) { newBuf.set(c, pos); pos += c.length; }

  // deflate the inner buffer and prepend the 8-byte outer header
  const compressed = pako.deflate(newBuf);
  const result = new Uint8Array(8 + compressed.length);
  const rdv = new DataView(result.buffer);
  rdv.setUint32(0, 0,             true); // flag = 0 means zlib-compressed
  rdv.setUint32(4, newBuf.length, true); // decompressed size so the game can pre-allocate
  result.set(compressed, 8);

  return result;
}

function encodeUtf16Le(str: string): Uint8Array {
  const buf = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    buf[i * 2]     = code & 0xff;
    buf[i * 2 + 1] = (code >> 8) & 0xff;
  }
  return buf;
}

// ── high-level load ───────────────────────────────────────────────────────────

function hasInventory(nbt: NbtFile): boolean {
  const inv = nbt.root.tags['Inventory'];
  return inv?.type === 9; // list type — presence means this is a player dat
}

function isPlayerFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('players/') || lower.startsWith('p_') || lower.startsWith('n_');
}

export async function loadSaveFile(file: File): Promise<LoadedSave> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (isConsoleContainer(bytes)) {
    const container = parseConsoleContainer(bytes);

    // sort so player dat files come first — makes it less likely we parse level.dat as a player
    const sorted = [...container.entries].sort((a, b) =>
      (isPlayerFilename(a.name) ? 0 : 1) - (isPlayerFilename(b.name) ? 0 : 1)
    );

    let playerFilename: string | null = null;
    let playerNbt: NbtFile | null = null;

    for (const entry of sorted) {
      try {
        const parsed = parseNbt(entry.data);
        if (hasInventory(parsed)) {
          playerFilename = entry.name;
          playerNbt = parsed;
          break;
        }
      } catch {
        // not parseable as nbt — skip it
      }
    }

    if (!playerNbt || !playerFilename) {
      throw new Error(
        `Save container has ${container.entries.length} embedded files but none contain a player Inventory.\n` +
        'Load the world in-game at least once to generate player data, then try again.'
      );
    }

    // try to find level.dat — it's optional, only present if the save was loaded in-game
    let levelFilename: string | null = null;
    let levelNbt: NbtFile | null = null;
    const levelEntry = container.entries.find(e => e.name.toLowerCase() === 'level.dat');
    if (levelEntry) {
      try {
        levelNbt = parseNbt(levelEntry.data);
        levelFilename = levelEntry.name;
      } catch {
        // level.dat exists but isn't valid nbt — skip it rather than crashing
      }
    }

    return {
      filename: file.name,
      format: 'console_save',
      originalBytes: bytes,
      container,
      playerFilename,
      levelFilename,
      playerNbt,
      levelNbt,
    };
  }

  // not a .ms container — try parsing as a plain nbt file (e.g. a loose player.dat)
  const playerNbt = parseNbt(bytes);
  if (!hasInventory(playerNbt)) {
    throw new Error('File does not appear to be a player .dat file (no Inventory list found).');
  }
  return {
    filename: file.name,
    format: 'plain_nbt',
    originalBytes: bytes,
    container: null,
    playerFilename: null,
    levelFilename: null,
    playerNbt,
    levelNbt: null,
  };
}

// ── high-level save ───────────────────────────────────────────────────────────

import { serializeNbt } from './nbt';

export function buildSaveBytes(loaded: LoadedSave): Uint8Array {
  if (loaded.format === 'plain_nbt') {
    return serializeNbt(loaded.playerNbt);
  }

  const replacements: Record<string, Uint8Array> = {};
  replacements[loaded.playerFilename!] = serializeNbt(loaded.playerNbt);
  if (loaded.levelNbt && loaded.levelFilename) {
    replacements[loaded.levelFilename] = serializeNbt(loaded.levelNbt);
  }
  return rebuildConsoleContainer(loaded.originalBytes, loaded.container!, replacements);
}
