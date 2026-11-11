import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NOVEDADES } from './novedades';

describe('versión y novedades', () => {
  it('la primera novedad es la versión de package.json y no hay versiones repetidas', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(NOVEDADES[0].version).toBe(pkg.version);
    expect(new Set(NOVEDADES.map((n) => n.version)).size).toBe(NOVEDADES.length);
    for (const n of NOVEDADES) expect(n.cambios.length).toBeGreaterThan(0);
  });
});
