/**
 * minimal java nbt (named binary tag) reader/writer
 * all multi-byte integers are big-endian, as per the java nbt spec
 */

// ── tag type enum ──────────────────────────────────────────────────────────────

export enum TagType {
  End       = 0,
  Byte      = 1,
  Short     = 2,
  Int       = 3,
  Long      = 4,
  Float     = 5,
  Double    = 6,
  ByteArray = 7,
  String    = 8,
  List      = 9,
  Compound  = 10,
  IntArray  = 11,
  LongArray = 12,
}

// ── tag value types ────────────────────────────────────────────────────────────

export interface NbtByte      { type: TagType.Byte;      value: number    }
export interface NbtShort     { type: TagType.Short;     value: number    }
export interface NbtInt       { type: TagType.Int;       value: number    }
export interface NbtLong      { type: TagType.Long;      value: bigint    }
export interface NbtFloat     { type: TagType.Float;     value: number    }
export interface NbtDouble    { type: TagType.Double;    value: number    }
export interface NbtString    { type: TagType.String;    value: string    }
export interface NbtByteArray { type: TagType.ByteArray; value: Uint8Array   }
export interface NbtIntArray  { type: TagType.IntArray;  value: Int32Array   }
export interface NbtLongArray { type: TagType.LongArray; value: BigInt64Array }
export interface NbtList      { type: TagType.List;      elementType: TagType; items: NbtValue[] }
export interface NbtCompound  { type: TagType.Compound;  tags: Record<string, NbtValue> }

export type NbtValue =
  | NbtByte | NbtShort | NbtInt | NbtLong | NbtFloat | NbtDouble
  | NbtString | NbtByteArray | NbtIntArray | NbtLongArray
  | NbtList | NbtCompound;

export interface NbtFile {
  rootName: string;
  root: NbtCompound;
}

// ── convenience constructors ───────────────────────────────────────────────────

export const nbt = {
  byte:  (v: number):  NbtByte   => ({ type: TagType.Byte,  value: v }),
  short: (v: number):  NbtShort  => ({ type: TagType.Short, value: v }),
  int:   (v: number):  NbtInt    => ({ type: TagType.Int,   value: v }),
  long:  (v: bigint):  NbtLong   => ({ type: TagType.Long,  value: v }),
  float: (v: number):  NbtFloat  => ({ type: TagType.Float, value: v }),
  str:   (v: string):  NbtString => ({ type: TagType.String, value: v }),
  compound: (tags: Record<string, NbtValue>): NbtCompound => ({ type: TagType.Compound, tags }),
  list: (elementType: TagType, items: NbtValue[]): NbtList => ({ type: TagType.List, elementType, items }),
};

// ── reader ─────────────────────────────────────────────────────────────────────

class NbtReader {
  private view: DataView;
  private pos = 0;
  private raw: Uint8Array;

  constructor(data: Uint8Array) {
    this.raw  = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  private u8()  { return this.view.getUint8(this.pos++); }
  private i8()  { return this.view.getInt8(this.pos++); }
  private i16() { const v = this.view.getInt16(this.pos, false); this.pos += 2; return v; }
  private u16() { const v = this.view.getUint16(this.pos, false); this.pos += 2; return v; }
  private i32() { const v = this.view.getInt32(this.pos, false); this.pos += 4; return v; }
  private f32() { const v = this.view.getFloat32(this.pos, false); this.pos += 4; return v; }
  private f64() { const v = this.view.getFloat64(this.pos, false); this.pos += 8; return v; }

  private i64(): bigint {
    const hi = this.view.getUint32(this.pos,     false);
    const lo = this.view.getUint32(this.pos + 4, false);
    this.pos += 8;
    const u = (BigInt(hi) << 32n) | BigInt(lo);
    return u >= (1n << 63n) ? u - (1n << 64n) : u;
  }

  private readString(): string {
    const len = this.u16();
    const bytes = this.raw.subarray(this.pos, this.pos + len);
    this.pos += len;
    return new TextDecoder().decode(bytes);
  }

  private readPayload(type: TagType): NbtValue {
    switch (type) {
      case TagType.Byte:      return { type: TagType.Byte,      value: this.i8()  };
      case TagType.Short:     return { type: TagType.Short,     value: this.i16() };
      case TagType.Int:       return { type: TagType.Int,       value: this.i32() };
      case TagType.Long:      return { type: TagType.Long,      value: this.i64() };
      case TagType.Float:     return { type: TagType.Float,     value: this.f32() };
      case TagType.Double:    return { type: TagType.Double,    value: this.f64() };
      case TagType.String:    return { type: TagType.String,    value: this.readString() };
      case TagType.ByteArray: {
        const n = this.i32();
        const v = this.raw.slice(this.pos, this.pos + n);
        this.pos += n;
        return { type: TagType.ByteArray, value: v };
      }
      case TagType.IntArray: {
        const n = this.i32();
        const v = new Int32Array(n);
        for (let i = 0; i < n; i++) v[i] = this.i32();
        return { type: TagType.IntArray, value: v };
      }
      case TagType.LongArray: {
        const n = this.i32();
        const v = new BigInt64Array(n);
        for (let i = 0; i < n; i++) v[i] = this.i64();
        return { type: TagType.LongArray, value: v };
      }
      case TagType.List: {
        const elemType = this.u8() as TagType;
        const n = this.i32();
        const items: NbtValue[] = [];
        for (let i = 0; i < n; i++) items.push(this.readPayload(elemType));
        return { type: TagType.List, elementType: elemType, items };
      }
      case TagType.Compound: {
        const tags: Record<string, NbtValue> = {};
        for (;;) {
          const tagType = this.u8() as TagType;
          if (tagType === TagType.End) break;
          const name = this.readString();
          tags[name] = this.readPayload(tagType);
        }
        return { type: TagType.Compound, tags };
      }
      default:
        throw new Error(`Unknown NBT tag type: ${type}`);
    }
  }

  readFile(): NbtFile {
    const type = this.u8() as TagType;
    if (type !== TagType.Compound)
      throw new Error(`Root tag must be Compound, got type ${type}`);
    const rootName = this.readString();
    const root = this.readPayload(TagType.Compound) as NbtCompound;
    return { rootName, root };
  }
}

export function parseNbt(data: Uint8Array): NbtFile {
  return new NbtReader(data).readFile();
}

// ── writer ─────────────────────────────────────────────────────────────────────

class NbtWriter {
  private chunks: Uint8Array[] = [];

  private push(b: Uint8Array) { this.chunks.push(b); }

  private u8(v: number)  { const b = new Uint8Array(1); b[0] = v & 0xff; this.push(b); }
  private i16(v: number) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v, false); this.push(b); }
  private u16(v: number) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, false); this.push(b); }
  private i32(v: number) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v, false); this.push(b); }
  private f32(v: number) { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v, false); this.push(b); }
  private f64(v: number) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, false); this.push(b); }

  private i64(v: bigint) {
    const b = new Uint8Array(8);
    const dv = new DataView(b.buffer);
    const u = v < 0n ? v + (1n << 64n) : v;
    dv.setUint32(0, Number(u >> 32n),        false);
    dv.setUint32(4, Number(u & 0xFFFFFFFFn), false);
    this.push(b);
  }

  private writeString(v: string) {
    const enc = new TextEncoder().encode(v);
    this.u16(enc.length);
    this.push(enc);
  }

  private writePayload(value: NbtValue) {
    switch (value.type) {
      case TagType.Byte:      this.u8(value.value & 0xff); break;
      case TagType.Short:     this.i16(value.value); break;
      case TagType.Int:       this.i32(value.value); break;
      case TagType.Long:      this.i64(value.value); break;
      case TagType.Float:     this.f32(value.value); break;
      case TagType.Double:    this.f64(value.value); break;
      case TagType.String:    this.writeString(value.value); break;
      case TagType.ByteArray: {
        this.i32(value.value.length);
        this.push(value.value);
        break;
      }
      case TagType.IntArray: {
        this.i32(value.value.length);
        const b = new Uint8Array(value.value.length * 4);
        const dv = new DataView(b.buffer);
        for (let i = 0; i < value.value.length; i++) dv.setInt32(i * 4, value.value[i], false);
        this.push(b);
        break;
      }
      case TagType.LongArray: {
        this.i32(value.value.length);
        for (let i = 0; i < value.value.length; i++) this.i64(value.value[i]);
        break;
      }
      case TagType.List: {
        this.u8(value.elementType);
        this.i32(value.items.length);
        for (const item of value.items) this.writePayload(item);
        break;
      }
      case TagType.Compound: {
        for (const [name, child] of Object.entries(value.tags)) {
          this.u8(child.type);
          this.writeString(name);
          this.writePayload(child);
        }
        this.u8(TagType.End);
        break;
      }
    }
  }

  writeFile(file: NbtFile): Uint8Array {
    this.u8(TagType.Compound);
    this.writeString(file.rootName);
    this.writePayload(file.root);
    const total = this.chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of this.chunks) { out.set(c, pos); pos += c.length; }
    return out;
  }
}

export function serializeNbt(file: NbtFile): Uint8Array {
  return new NbtWriter().writeFile(file);
}

// ── tag accessor helpers ───────────────────────────────────────────────────────

export function getTag<T extends NbtValue>(tags: Record<string, NbtValue>, key: string, type: T['type']): T | undefined {
  const v = tags[key];
  return v?.type === type ? (v as T) : undefined;
}

export const get = {
  byte:     (t: Record<string, NbtValue>, k: string) => getTag<NbtByte>(t, k, TagType.Byte)?.value,
  short:    (t: Record<string, NbtValue>, k: string) => getTag<NbtShort>(t, k, TagType.Short)?.value,
  int:      (t: Record<string, NbtValue>, k: string) => getTag<NbtInt>(t, k, TagType.Int)?.value,
  long:     (t: Record<string, NbtValue>, k: string) => getTag<NbtLong>(t, k, TagType.Long)?.value,
  float:    (t: Record<string, NbtValue>, k: string) => getTag<NbtFloat>(t, k, TagType.Float)?.value,
  double:   (t: Record<string, NbtValue>, k: string) => getTag<NbtDouble>(t, k, TagType.Double)?.value,
  str:      (t: Record<string, NbtValue>, k: string) => getTag<NbtString>(t, k, TagType.String)?.value,
  list:     (t: Record<string, NbtValue>, k: string) => getTag<NbtList>(t, k, TagType.List),
  compound: (t: Record<string, NbtValue>, k: string) => getTag<NbtCompound>(t, k, TagType.Compound),
};

// deep-clone so mutations on the returned file don't bleed into the original
// bigint values aren't JSON-serialisable by default so we round-trip them as strings
export function cloneNbt(file: NbtFile): NbtFile {
  return JSON.parse(JSON.stringify(file, (_k, v) =>
    typeof v === 'bigint' ? { __bigint__: v.toString() } : v
  ), (_k, v) =>
    v && typeof v === 'object' && '__bigint__' in v ? BigInt(v.__bigint__) : v
  ) as NbtFile;
}
