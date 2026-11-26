import { describe, expect, it } from 'vitest';
import { checkBackup, defaultState, sanitizeState } from '../src/lib/storage';

describe('saved progress is cleaned before use', () => {
  it('damaged data never breaks the app (wrong types are dropped, good parts kept)', () => {
    const s = sanitizeState({
      childName: 5,
      days: null,
      topics: { animals: null, colors: { completed: 2 }, food: { completed: 'x' } },
      words: { 'animals/dog': null, 'colors/red': { said: true, tries: 1 } },
      blocks: { placed: [{ type: 'grass', x: 1, y: 2 }, null], inventory: { animals: 'lots' } },
      review: { 'colors/red': { box: 2, due: '2026-11-20' }, bad: 3 },
      today: 'tomorrow',
      tests: [null],
      settings: { rate: 'fast', level: 'L3' },
    });
    expect(s.childName).toBe('');
    expect(s.days).toEqual({});
    expect(s.topics).toEqual({ colors: { completed: 2 } });
    expect(Object.keys(s.words)).toEqual(['colors/red']);
    expect(s.blocks.placed).toHaveLength(1);
    expect(s.blocks.inventory).toEqual({});
    expect(Object.keys(s.review)).toEqual(['colors/red']);
    expect(s.today).toBeUndefined();
    expect(s.tests).toBeUndefined();
    expect(s.settings.rate).toBe(defaultState().settings.rate);
    expect(s.settings.level).toBe('L3');
  });
  it('anything that is not an object gives a fresh start', () => {
    expect(sanitizeState(null)).toEqual(defaultState());
    expect(sanitizeState('hello')).toEqual(defaultState());
    expect(sanitizeState([1, 2])).toEqual(defaultState());
  });
  it('a backup with a null or wrongly typed part is refused before restoring', () => {
    const good = { app: 'bix-english', version: 1, exportedAt: '2026-11-20T00:00:00Z', index: { active: 'p1', ids: ['p1'] }, profiles: { p1: { ...defaultState(), childName: 'Shin' } } };
    expect(checkBackup(good)).toBeNull();
    for (const bad of [{ topics: null }, { words: [] }, { settings: 'x' }, { childName: 5 }]) {
      expect(checkBackup({ ...good, profiles: { p1: { ...good.profiles.p1, ...bad } } })).not.toBeNull();
    }
  });
});
