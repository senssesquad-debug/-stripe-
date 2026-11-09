import { inflateSync } from 'node:zlib';

/**
 * Minimal reader for OpenStreetMap PBF files (https://wiki.openstreetmap.org/wiki/PBF_Format):
 * enough to walk every node, way and relation with tags, node coordinates, way node refs and relation members.
 * Only zlib-compressed and raw blobs are supported (that is what Geofabrik and osmium produce).
 */

export interface PbfNode { type: 'node'; id: number; lat: number; lon: number; tags: Record<string, string> | null }
export interface PbfWay { type: 'way'; id: number; refs: number[]; tags: Record<string, string> | null }
export interface PbfRelation { type: 'relation'; id: number; members: Array<{ type: 'node' | 'way' | 'relation'; ref: number; role: string }>; tags: Record<string, string> | null }
export type PbfElement = PbfNode | PbfWay | PbfRelation;

/** Which element kinds the caller wants decoded; others are skipped without building objects. */
export interface PbfVisit {
  node?: (n: PbfNode) => void;
  way?: (w: PbfWay) => void;
  relation?: (r: PbfRelation) => void;
  /** Call node() only for nodes that have tags (most nodes are bare geometry points). */
  taggedNodesOnly?: boolean;
}

class Reader {
  pos: number;
  constructor(public buf: Uint8Array, start = 0, public end = buf.length) { this.pos = start; }
  get done() { return this.pos >= this.end; }
  varint(): number {
    // Values up to 2^53 are exact with float arithmetic (OSM ids and coordinates fit).
    let result = 0;
    let mul = 1;
    for (;;) {
      const b = this.buf[this.pos++]!;
      result += (b & 0x7f) * mul;
      if (b < 0x80) return result;
      mul *= 128;
    }
  }
  svarint(): number {
    const n = this.varint();
    return n % 2 === 0 ? n / 2 : -(n + 1) / 2;
  }
  /** Returns [fieldNumber, wireType]. */
  key(): [number, number] {
    const k = this.varint();
    return [Math.floor(k / 8), k % 8];
  }
  bytes(): Uint8Array {
    const len = this.varint();
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }
  sub(): Reader {
    const len = this.varint();
    const r = new Reader(this.buf, this.pos, this.pos + len);
    this.pos += len;
    return r;
  }
  skip(wire: number): void {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) { const len = this.varint(); this.pos += len; }
    else if (wire === 5) this.pos += 4;
    else throw new Error(`Unsupported protobuf wire type ${wire}`);
  }
  packed(fn: (r: Reader) => number): number[] {
    const r = this.sub();
    const out: number[] = [];
    while (!r.done) out.push(fn(r));
    return out;
  }
}

const utf8 = new TextDecoder();
const uvar = (r: Reader) => r.varint();
const svar = (r: Reader) => r.svarint();

function tagsFrom(keys: number[], vals: number[], strings: string[]): Record<string, string> | null {
  if (!keys.length) return null;
  const t: Record<string, string> = {};
  for (let i = 0; i < keys.length; i++) t[strings[keys[i]!]!] = strings[vals[i]!] ?? '';
  return t;
}

function decodeBlock(data: Uint8Array, visit: PbfVisit): void {
  const r = new Reader(data);
  let strings: string[] = [];
  const groups: Reader[] = [];
  let granularity = 100;
  let latOffset = 0;
  let lonOffset = 0;
  while (!r.done) {
    const [f, w] = r.key();
    if (f === 1) {
      const st = r.sub();
      strings = [];
      while (!st.done) { const [sf, sw] = st.key(); if (sf === 1) strings.push(utf8.decode(st.bytes())); else st.skip(sw); }
    } else if (f === 2) groups.push(r.sub());
    else if (f === 17) granularity = r.varint();
    else if (f === 19) latOffset = r.varint();
    else if (f === 20) lonOffset = r.varint();
    else r.skip(w);
  }
  const lat = (v: number) => (latOffset + granularity * v) / 1e9;
  const lon = (v: number) => (lonOffset + granularity * v) / 1e9;

  for (const g of groups) {
    while (!g.done) {
      const [f, w] = g.key();
      if (f === 1 && visit.node) {
        const m = g.sub();
        let id = 0, la = 0, lo = 0, keys: number[] = [], vals: number[] = [];
        while (!m.done) {
          const [mf, mw] = m.key();
          if (mf === 1) id = m.svarint();
          else if (mf === 2) keys = m.packed(uvar);
          else if (mf === 3) vals = m.packed(uvar);
          else if (mf === 8) la = m.svarint();
          else if (mf === 9) lo = m.svarint();
          else m.skip(mw);
        }
        const tags = tagsFrom(keys, vals, strings);
        if (tags || !visit.taggedNodesOnly) visit.node({ type: 'node', id, lat: lat(la), lon: lon(lo), tags });
      } else if (f === 2 && visit.node) {
        const d = g.sub();
        let ids: number[] = [], lats: number[] = [], lons: number[] = [], kv: number[] = [];
        while (!d.done) {
          const [df, dw] = d.key();
          if (df === 1) ids = d.packed(svar);
          else if (df === 8) lats = d.packed(svar);
          else if (df === 9) lons = d.packed(svar);
          else if (df === 10) kv = d.packed(uvar);
          else d.skip(dw);
        }
        let id = 0, la = 0, lo = 0, k = 0;
        for (let i = 0; i < ids.length; i++) {
          id += ids[i]!; la += lats[i]!; lo += lons[i]!;
          let tags: Record<string, string> | null = null;
          if (kv.length) {
            while (k < kv.length && kv[k] !== 0) { (tags ??= {})[strings[kv[k]!]!] = strings[kv[k + 1]!] ?? ''; k += 2; }
            k++; // the 0 that ends this node's tags
          }
          if (tags || !visit.taggedNodesOnly) visit.node({ type: 'node', id, lat: lat(la), lon: lon(lo), tags });
        }
      } else if (f === 3 && visit.way) {
        const m = g.sub();
        let id = 0, keys: number[] = [], vals: number[] = [], refs: number[] = [];
        while (!m.done) {
          const [mf, mw] = m.key();
          if (mf === 1) id = m.varint();
          else if (mf === 2) keys = m.packed(uvar);
          else if (mf === 3) vals = m.packed(uvar);
          else if (mf === 8) refs = m.packed(svar);
          else m.skip(mw);
        }
        for (let i = 1; i < refs.length; i++) refs[i]! += refs[i - 1]!;
        visit.way({ type: 'way', id, refs, tags: tagsFrom(keys, vals, strings) });
      } else if (f === 4 && visit.relation) {
        const m = g.sub();
        let id = 0, keys: number[] = [], vals: number[] = [], roles: number[] = [], memids: number[] = [], types: number[] = [];
        while (!m.done) {
          const [mf, mw] = m.key();
          if (mf === 1) id = m.varint();
          else if (mf === 2) keys = m.packed(uvar);
          else if (mf === 3) vals = m.packed(uvar);
          else if (mf === 8) roles = m.packed(uvar);
          else if (mf === 9) memids = m.packed(svar);
          else if (mf === 10) types = m.packed(uvar);
          else m.skip(mw);
        }
        let ref = 0;
        const members = memids.map((d, i) => {
          ref += d;
          return { type: (['node', 'way', 'relation'] as const)[types[i] ?? 0]!, ref, role: strings[roles[i] ?? 0] ?? '' };
        });
        visit.relation({ type: 'relation', id, members, tags: tagsFrom(keys, vals, strings) });
      } else g.skip(w);
    }
  }
}

/**
 * Walk every OSMData block of a PBF file held in memory. Yields to the event loop between blocks, so a web
 * server keeps answering (and passing health checks) while a whole country is read on a small instance.
 */
export async function readPbf(file: Uint8Array, visit: PbfVisit): Promise<void> {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let pos = 0;
  while (pos + 4 <= file.length) {
    const headerLen = view.getUint32(pos);
    pos += 4;
    const h = new Reader(file, pos, pos + headerLen);
    let type = '';
    let size = 0;
    while (!h.done) {
      const [f, w] = h.key();
      if (f === 1) type = utf8.decode(h.bytes());
      else if (f === 3) size = h.varint();
      else h.skip(w);
    }
    pos += headerLen;
    const blob = new Reader(file, pos, pos + size);
    pos += size;
    if (type !== 'OSMData') continue;
    let data: Uint8Array | null = null;
    while (!blob.done) {
      const [f, w] = blob.key();
      if (f === 1) data = blob.bytes();
      else if (f === 3) data = inflateSync(blob.bytes());
      else if (f === 4 || f === 6 || f === 7) throw new Error('Unsupported PBF compression (only zlib or raw)');
      else blob.skip(w);
    }
    if (data) decodeBlock(data, visit);
    await new Promise<void>((r) => setImmediate(r));
  }
}
