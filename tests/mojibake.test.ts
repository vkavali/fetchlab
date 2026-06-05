import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['src', 'server', 'tests'];
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.jsx', '.json', '.ts', '.tsx']);
const BAD_CODEPOINTS = new Set([0x00c2, 0x00c3, 0x00e2, 0xfffd]);

function collectTextFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) return collectTextFiles(path);
    return TEXT_EXTENSIONS.has(extname(path)) ? [path] : [];
  });
}

describe('source text hygiene', () => {
  it('does not contain common mojibake marker characters', () => {
    const offenders: string[] = [];

    for (const file of ROOTS.flatMap(collectTextFiles)) {
      const text = readFileSync(file, 'utf8');
      text.split(/\r?\n/).forEach((line, index) => {
        const hasBadCodepoint = Array.from(line).some((char) => {
          const code = char.codePointAt(0) ?? 0;
          return BAD_CODEPOINTS.has(code) || (code >= 0x80 && code <= 0x9f);
        });

        if (hasBadCodepoint) {
          offenders.push(`${relative(process.cwd(), file)}:${index + 1}:${line}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
