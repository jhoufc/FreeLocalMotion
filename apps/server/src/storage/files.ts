import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** Atomic JSON write: temp file + rename, so a crash never leaves a half-written project. */
export const writeJsonAtomic = async (file: string, data: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, file);
};

export const readJson = async (file: string): Promise<unknown> => JSON.parse(await fs.readFile(file, 'utf8'));

export const exists = async (p: string): Promise<boolean> => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

/** Ensures `child` resolves inside `parent` (defends against path traversal). */
export const safeJoin = (parent: string, ...parts: string[]): string => {
  const resolved = path.resolve(parent, ...parts);
  const rel = path.relative(parent, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Path escapes storage root');
  return resolved;
};

export type SniffedType = { kind: 'image' | 'audio'; ext: string; mime: string };

/** Identifies supported media by magic bytes instead of trusting file names. */
export const sniffMedia = (buf: Buffer): SniffedType | null => {
  const b = (i: number) => buf[i] ?? -1;
  const ascii = (start: number, len: number) => buf.subarray(start, start + len).toString('latin1');
  if (b(0) === 0x89 && ascii(1, 3) === 'PNG') return { kind: 'image', ext: 'png', mime: 'image/png' };
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { kind: 'image', ext: 'jpg', mime: 'image/jpeg' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { kind: 'image', ext: 'webp', mime: 'image/webp' };
  if (ascii(0, 4) === 'GIF8') return { kind: 'image', ext: 'gif', mime: 'image/gif' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return { kind: 'audio', ext: 'wav', mime: 'audio/wav' };
  if (ascii(0, 3) === 'ID3' || (b(0) === 0xff && (b(1) & 0xe0) === 0xe0 && (b(1) & 0x06) !== 0)) {
    // MP3 (ID3 tag or MPEG frame sync). AAC ADTS shares the sync word but has layer bits 00.
    if (ascii(0, 3) === 'ID3' || (b(1) & 0x06) !== 0) return { kind: 'audio', ext: 'mp3', mime: 'audio/mpeg' };
  }
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (brand.startsWith('M4A') || brand === 'M4B ') return { kind: 'audio', ext: 'm4a', mime: 'audio/mp4' };
  }
  if (ascii(0, 4) === 'OggS') return { kind: 'audio', ext: 'ogg', mime: 'audio/ogg' };
  return null;
};
