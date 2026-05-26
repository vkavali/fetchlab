#!/usr/bin/env node
/* Fix double-encoded UTF-8 (mojibake) in a file.
 *
 * At some point a file with proper UTF-8 (e.g. "“" = bytes E2 80 9C) was
 * read as Windows-1252 and re-saved as UTF-8. Each byte ≥ 0x80 expanded
 * to 2–3 bytes, producing the classic "â€œ … â€\x9d" around quotes and
 * "Â·" instead of "·".
 *
 * We replace at the byte level so the operation is robust to whatever
 * encoding tooling pipes this script through.
 *
 * Usage: node scripts/fix-mojibake.mjs <file> [<file>...]
 */

import fs from 'node:fs';
import path from 'node:path';

// [mojibake-bytes, correct-bytes]. Longer patterns first so we don't
// half-match the prefix of a longer sequence.
const PAIRS = [
  // â€œ (3-char mojibake of U+201C “) -> “
  [Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xc5, 0x93]), Buffer.from([0xe2, 0x80, 0x9c])],
  // â€<C1 OSC> (mojibake of U+201D ”, with the 0x9D byte raw) -> ”
  [Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xc2, 0x9d]), Buffer.from([0xe2, 0x80, 0x9d])],
  // â€™ (mojibake of U+2019 ’) -> ’
  [Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xe2, 0x84, 0xa2]), Buffer.from([0xe2, 0x80, 0x99])],
  // â€˜ (mojibake of U+2018 ‘) -> ‘
  [Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xcb, 0x9c]), Buffer.from([0xe2, 0x80, 0x98])],
  // â€¦ (mojibake of U+2026 …) -> …
  [Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xc2, 0xa6]), Buffer.from([0xe2, 0x80, 0xa6])],
  // â€“ (mojibake of U+2013 – en dash) -> –
  [Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xe2, 0x80, 0x9c]), Buffer.from([0xe2, 0x80, 0x93])],
  // â€” (mojibake of U+2014 — em dash) -> —
  [Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xe2, 0x80, 0x9d]), Buffer.from([0xe2, 0x80, 0x94])],
  // â€¢ (mojibake of U+2022 • bullet) -> •
  [Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xc2, 0xa2]), Buffer.from([0xe2, 0x80, 0xa2])],
  // Â· (mojibake of U+00B7 · middle dot) -> ·
  [Buffer.from([0xc3, 0x82, 0xc2, 0xb7]), Buffer.from([0xc2, 0xb7])],
  // Â¶ -> ¶
  [Buffer.from([0xc3, 0x82, 0xc2, 0xb6]), Buffer.from([0xc2, 0xb6])],
  // Â® -> ®
  [Buffer.from([0xc3, 0x82, 0xc2, 0xae]), Buffer.from([0xc2, 0xae])],
  // Â© -> ©
  [Buffer.from([0xc3, 0x82, 0xc2, 0xa9]), Buffer.from([0xc2, 0xa9])],
  // Â  (mojibake NBSP) -> NBSP
  [Buffer.from([0xc3, 0x82, 0xc2, 0xa0]), Buffer.from([0xc2, 0xa0])],
];

function replaceAll(buf, from, to) {
  const out = [];
  let i = 0;
  let count = 0;
  while (i < buf.length) {
    if (i + from.length <= buf.length && buf.compare(from, 0, from.length, i, i + from.length) === 0) {
      out.push(to);
      i += from.length;
      count += 1;
    } else {
      out.push(Buffer.from([buf[i]]));
      i += 1;
    }
  }
  return { buf: Buffer.concat(out), count };
}

function fix(file) {
  let buf = fs.readFileSync(file);
  const counts = {};
  for (const [from, to] of PAIRS) {
    const { buf: next, count } = replaceAll(buf, from, to);
    if (count) {
      const fromHex = Array.from(from).map(b => b.toString(16).padStart(2, '0')).join(' ');
      counts[fromHex] = count;
      buf = next;
    }
  }
  fs.writeFileSync(file, buf);
  console.log(path.relative(process.cwd(), file));
  Object.entries(counts).forEach(([hex, n]) => console.log(`  ${hex}  ->  fixed ${n}`));
  if (!Object.keys(counts).length) console.log('  (no mojibake found)');
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/fix-mojibake.mjs <file> [<file>...]');
  process.exit(1);
}
for (const a of args) fix(a);
