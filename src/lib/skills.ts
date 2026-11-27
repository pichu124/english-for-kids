/**
 * The four skills for parents (listening, speaking, reading, writing), worked out from what the
 * app already keeps: words picked right, said, spelled; reading parts, stories and phonics;
 * letters traced and worksheets. Nothing new is recorded for this.
 */
import phonicsData from '../../content/phonics.json';
import { topicsOfLevel, type Level } from '../content';
import { testResults, TEST_PARTS } from './mocktest';
import { getState, wordKey } from './storage';

export type SkillId = 'listen' | 'speak' | 'read' | 'write';
export type Skill = {
  id: SkillId;
  icon: string;
  name: string;
  /** 0–1: how much of this level's work for the skill is done. */
  share: number;
  /** One or two short Vietnamese facts. */
  facts: string[];
  /** What to do next for this skill (Vietnamese, for the parent). */
  tip: string;
};

const pct = (a: number, b: number) => (b ? Math.min(1, a / b) : 0);

export function skillSummary(level: Level): Skill[] {
  const s = getState();
  const units = topicsOfLevel(level.id);
  const keys = units.flatMap((t) => t.words.map((w) => wordKey(t.id, w.id)));
  const ws = keys.map((k) => s.words[k]);
  const known = ws.filter((w) => w?.known).length;
  const said = ws.filter((w) => w?.said).length;
  const spelled = ws.filter((w) => w?.spelled).length;
  const total = keys.length;
  const tests = testResults(level.id);
  const last = tests[tests.length - 1];
  const score = (p: 'listening' | 'reading' | 'writing' | 'spelling') => {
    const r = last?.score[p];
    return r ? ` · Thi thử gần nhất: ${r[0]}/${r[1]}` : '';
  };
  const days = Object.values(s.days);
  const played = (g: string) => s.gamesPlayed?.[g] ?? 0;
  const sum = (k: 'talk' | 'read' | 'sheets') => days.reduce((n, d) => n + (d[k] ?? 0), 0);

  // reading: the Read & Write parts of this level (Starters on), stories, phonics sets
  const withReading = level.reading?.length ? units : [];
  const readParts = withReading.filter((t) => (s.topics[t.id]?.readDone ?? 0) > 0).length;
  const phonicsDone = phonicsData.sets.filter((x) => s.phonics?.[x.id]).length;
  const stories = Object.keys(s.storiesRead ?? {}).length;
  const readShare = withReading.length ? (pct(readParts, withReading.length) * 2 + pct(phonicsDone, phonicsData.sets.length)) / 3 : pct(phonicsDone, phonicsData.sets.length);

  // writing: words spelled (Starters on), letters traced
  const traced = Object.keys(s.traced ?? {}).filter((k) => k.length === 1 && /[a-zA-Z]/.test(k)).length;
  const writes = TEST_PARTS[level.id]?.includes('writing') ? 'writing' : 'spelling';
  const writeShare = level.reading?.length ? (pct(spelled, total) * 2 + pct(traced, 52)) / 3 : pct(traced, 52);

  return [
    {
      id: 'listen',
      icon: '👂',
      name: 'Nghe',
      share: pct(known, total),
      facts: [
        `Chọn đúng hình ngay lần đầu: ${known}/${total} từ của bậc${score('listening')}`,
        ...(played('pairs') + played('clock') ? [`Trò nghe: Which one? ${played('pairs')} lượt, What time? ${played('clock')} lượt`] : []),
        ...(played('maths') + played('sort') ? [`Maths: ${played('maths')} lượt · Sort it!: ${played('sort')} lượt`] : []),
      ],
      tip: 'Cho bé chơi Games (👂 Which one?, 🕐 What time?, bóng bay, Listen and Colour) và nghe truyện ở 📚 Stories.',
    },
    {
      id: 'speak',
      icon: '🗣️',
      name: 'Nói',
      share: pct(said, total),
      facts: [`Đã nói được: ${said}/${total} từ của bậc`, `Trò chuyện / luyện nói với Bix: ${sum('talk')} lần, tự đọc to: ${sum('read')} trang`],
      tip: 'Cho bé vào 💬 Talk, hoặc bấm 🎤 My turn trong truyện. Bố mẹ nói cùng bé thì bé mạnh dạn hơn.',
    },
    {
      id: 'read',
      icon: '📖',
      name: 'Đọc',
      share: readShare,
      facts: [
        withReading.length ? `Phần "Đọc & Viết" xong: ${readParts}/${withReading.length} bài${score('reading')}` : 'Bậc này chưa có phần đọc chữ: bé làm quen âm trước.',
        `Âm (phonics): ${phonicsDone}/${phonicsData.sets.length} nhóm · truyện đã đọc: ${stories}`,
        ...(played('grammar') ? [`Grammar (điền từ vào câu): ${played('grammar')} lượt`] : []),
      ],
      tip: 'Học tiếp nhóm âm ở ABC → 🔊 Sounds, cho bé tự đọc truyện phonics, và chơi 🧩 Grammar (từ Starters) ở Games.',
    },
    {
      id: 'write',
      icon: '✏️',
      name: 'Viết',
      share: writeShare,
      facts: [
        level.reading?.length ? `Đánh vần / viết đúng: ${spelled}/${total} từ${score(writes)}` : 'Bậc này chưa viết từ: bé tập tô chữ trước.',
        `Tô chữ: ${traced}/52 chữ cái · phiếu đã in: ${sum('sheets')}${played('tower') ? ` · Bix's Tower: ${played('tower')} lượt` : ''}`,
      ],
      tip: "Cho bé tập tô ở ABC → ✏️ Write, chơi 🧱 Bix's Tower, và in một phiếu bài tập để viết bằng bút chì.",
    },
  ];
}

/** The skill to work on next: the one furthest behind (ties: speaking first, the app's focus). */
export function weakest(skills: Skill[]): Skill {
  const order: SkillId[] = ['speak', 'listen', 'read', 'write'];
  return [...skills].sort((a, b) => a.share - b.share || order.indexOf(a.id) - order.indexOf(b.id))[0];
}
