import { describe, expect, it } from 'vitest';
import { topicById, topics } from '../src/content';
import { buildWorksheet, seededRandom, wordSearch } from '../src/lib/worksheet';

const kinds = (id: string, day = '2026-11-26') => buildWorksheet(topicById(id)!, day).sections.map((s) => s.kind);

describe('printable worksheets', () => {
  it('builds a sheet with at least 3 exercises for every unit', () => {
    for (const t of topics) {
      const ws = buildWorksheet(t, '2026-11-26');
      expect(ws.sections.length, t.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('adapts the exercises to the level', () => {
    expect(kinds('l0-animals')).toEqual(['colour', 'same', 'circle']);
    expect(kinds('l2-zoo')).toEqual(['match', 'trace', 'write', 'search']);
    expect(kinds('l4-space')).toEqual(expect.arrayContaining(['write', 'gaps', 'define', 'text']));
    expect(kinds('l3-health')).toEqual(expect.arrayContaining(['write', 'text']));
  });

  it('gives the same sheet for the same unit and day, another one on another day', () => {
    const t = topicById('l2-zoo')!;
    const a = JSON.stringify(buildWorksheet(t, '2026-11-26').sections);
    expect(JSON.stringify(buildWorksheet(t, '2026-11-26').sections)).toBe(a);
    const days = ['2026-11-27', '2026-11-28', '2026-11-29'].map((d) => JSON.stringify(buildWorksheet(t, d).sections));
    expect(days.some((d) => d !== a)).toBe(true);
  });

  it('starters "look and write" gives the first letter, Movers/Flyers none', () => {
    const l2 = buildWorksheet(topicById('l2-zoo')!, '2026-11-26').sections.find((s) => s.kind === 'write');
    const l4 = buildWorksheet(topicById('l4-space')!, '2026-11-26').sections.find((s) => s.kind === 'write');
    expect(l2?.kind === 'write' && l2.items.every((i) => i.given === 1)).toBe(true);
    expect(l4?.kind === 'write' && l4.items.every((i) => i.given === 0)).toBe(true);
  });

  it('places word-search words where the key says, A–Z only', () => {
    const { grid, placed } = wordSearch(['elephant', 'giraffe', 'monkey', 'tiger', 'zebra'], seededRandom('x'));
    expect(grid).toHaveLength(8);
    expect(grid.flat().every((c) => /^[A-Z]$/.test(c))).toBe(true);
    expect(placed.length).toBeGreaterThanOrEqual(4);
    for (const p of placed) {
      const read = [...p.word].map((_, i) => (p.dir === 'across' ? grid[p.row][p.col + i] : grid[p.row + i][p.col])).join('');
      expect(read).toBe(p.word);
    }
  });

  it('gap fill answers are in the word bank', () => {
    for (const t of topics) {
      for (const s of buildWorksheet(t, '2026-11-26').sections) {
        if (s.kind === 'gaps' || s.kind === 'define') for (const r of s.rows) expect(s.bank, t.id).toContain(r.answer);
      }
    }
  });
});
