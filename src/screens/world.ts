import { Bix } from '../art/bix';
import { blockSVG } from '../art/blocks';
import { blockDefs, topicById } from '../content';
import { fromHTML, h } from '../lib/dom';
import { sfx } from '../lib/sfx';
import { getState, update, type PlacedBlock } from '../lib/storage';
import { say } from '../lib/tts';
import type { Ctx } from '../router';
import { homeButton } from './widgets';
import { currentLevel } from '../lib/level';

export const COLS = 12;
export const ROWS = 7;

type Drag = {
  type: string;
  /** Set when moving an already placed block. */
  placed?: PlacedBlock;
  ghost: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  source: HTMLElement;
};

/** "My World": a simple sandbox where earned blocks are dragged onto a grid. */
export function worldScreen(ctx: Ctx): HTMLElement {
  const defs = blockDefs();
  const defOf = (type: string) => defs.find((d) => d.type === type) ?? { type, name: type, style: 'plain' as const, color: '#9aa3b5' };
  const fresh = ctx.params.fresh;

  const bix = new Bix({ size: 'sm' }).setMood('hello');
  const grid = h('div', { class: 'world-grid', style: `--cols:${COLS};--rows:${ROWS}` });
  const marker = h('div', { class: 'world-marker', hidden: true });
  grid.appendChild(marker);
  const area = h('div', { class: 'world-area' }, h('div', { class: 'world-frame' }, grid, h('div', { class: 'world-ground', 'aria-hidden': 'true' })));
  const tray = h('div', { class: 'world-tray', 'aria-label': 'Blocks' });

  const el = h(
    'main',
    { class: 'world' },
    h('header', { class: 'world-top' }, homeButton(ctx), h('h1', { class: 'world-title' }, 'My World'), h('div', { class: 'world-bix' }, bix.el)),
    area,
    tray,
  );

  // ----- layout: largest square cells that fit -----
  const fit = () => {
    const r = area.getBoundingClientRect();
    const cell = Math.max(24, Math.floor(Math.min((r.width - 16) / COLS, (r.height - 30) / ROWS)));
    grid.style.width = `${cell * COLS}px`;
    grid.style.height = `${cell * ROWS}px`;
    grid.style.setProperty('--cell', `${cell}px`);
  };
  const ro = new ResizeObserver(fit);
  ro.observe(area);
  ctx.onCleanup(() => ro.disconnect());

  // ----- rendering -----
  const blockEl = (type: string) => {
    const d = defOf(type);
    return fromHTML<SVGElement>(blockSVG(d.style, d.color));
  };

  function renderGrid() {
    grid.querySelectorAll('.world-block').forEach((n) => n.remove());
    for (const p of getState().blocks.placed) {
      const b = h('div', { class: 'world-block', style: `--x:${p.x};--y:${p.y}`, 'data-id': p.id }, blockEl(p.type));
      b.addEventListener('pointerdown', (e) => startDrag(e, p.type, b, p));
      grid.appendChild(b);
    }
  }

  function renderTray() {
    const inv = getState().blocks.inventory;
    const lvl = currentLevel().id;
    tray.replaceChildren(
      // blocks the child owns, plus the ones that can be earned at this level
      ...defs.filter((d) => (inv[d.type] ?? 0) > 0 || d.level === lvl).map((d) => {
        const n = inv[d.type] ?? 0;
        const item = h(
          'button',
          { class: `tray-item ${n ? '' : 'is-empty'} ${d.type === fresh && n ? 'is-fresh' : ''}`, 'aria-label': `${d.name}: ${n}` },
          blockEl(d.type),
          h('span', { class: 'tray-count' }, String(n)),
        );
        if (n) item.addEventListener('pointerdown', (e) => startDrag(e, d.type, item));
        else
          item.addEventListener('click', () => {
            const t = topicById(d.type);
            sfx.soft();
            void bix.talk(t ? `Finish ${t.title} to get this block!` : 'Learn more to get this block!', 'encourage', t ? `${t.icon} → ${d.name}` : d.name);
          });
        return item;
      }),
    );
  }

  // ----- drag & drop -----
  let drag: Drag | null = null;

  function cellAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const r = grid.getBoundingClientRect();
    if (clientX < r.left || clientX >= r.right || clientY < r.top || clientY >= r.bottom) return null;
    return { x: Math.floor(((clientX - r.left) / r.width) * COLS), y: Math.floor(((clientY - r.top) / r.height) * ROWS) };
  }
  const occupied = (x: number, y: number, except?: PlacedBlock) =>
    getState().blocks.placed.some((p) => p !== except && p.x === x && p.y === y);

  function startDrag(e: PointerEvent, type: string, source: HTMLElement, placed?: PlacedBlock) {
    if (drag) return;
    e.preventDefault();
    const size = parseFloat(grid.style.getPropertyValue('--cell')) || 60;
    const ghost = h('div', { class: 'world-ghost', style: `width:${size}px;height:${size}px` }, blockEl(type));
    document.body.appendChild(ghost);
    drag = { type, placed, ghost, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, source };
    source.setPointerCapture?.(e.pointerId);
    source.classList.add('is-lifted');
    moveGhost(e.clientX, e.clientY);
    source.addEventListener('pointermove', onMove);
    source.addEventListener('pointerup', onUp);
    source.addEventListener('pointercancel', onCancel);
    sfx.tap();
  }

  function moveGhost(x: number, y: number) {
    if (!drag) return;
    drag.ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -60%)`;
    const c = cellAt(x, y);
    if (c && !occupied(c.x, c.y, drag.placed)) {
      marker.hidden = false;
      marker.style.setProperty('--x', String(c.x));
      marker.style.setProperty('--y', String(c.y));
    } else marker.hidden = true;
  }

  function onMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 8) drag.moved = true;
    moveGhost(e.clientX, e.clientY);
  }

  function endDrag() {
    if (!drag) return;
    const d = drag;
    drag = null;
    d.ghost.remove();
    d.source.classList.remove('is-lifted');
    d.source.removeEventListener('pointermove', onMove);
    d.source.removeEventListener('pointerup', onUp);
    d.source.removeEventListener('pointercancel', onCancel);
    marker.hidden = true;
  }

  function onCancel() {
    endDrag();
  }

  function onUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    endDrag();
    const c = cellAt(e.clientX, e.clientY);

    if (d.placed) {
      const p = d.placed;
      if (!d.moved) {
        // a tap on a placed block: little hop
        const node = grid.querySelector(`[data-id="${p.id}"]`);
        node?.classList.remove('hop');
        void (node as HTMLElement | null)?.offsetWidth;
        node?.classList.add('hop');
        sfx.pop();
        return;
      }
      if (c && !occupied(c.x, c.y, p)) {
        update(() => {
          p.x = c.x;
          p.y = c.y;
        });
        sfx.place();
      } else if (!c) {
        // dragged off the world → back to the tray
        update((s) => {
          s.blocks.placed = s.blocks.placed.filter((q) => q !== p);
          s.blocks.inventory[p.type] = (s.blocks.inventory[p.type] ?? 0) + 1;
        });
        sfx.soft();
      }
    } else if (c && !occupied(c.x, c.y)) {
      update((s) => {
        if ((s.blocks.inventory[d.type] ?? 0) <= 0) return;
        s.blocks.inventory[d.type]--;
        s.blocks.placed.push({ id: Math.random().toString(36).slice(2, 9), type: d.type, x: c.x, y: c.y });
      });
      sfx.place();
      const count = getState().blocks.placed.length;
      if (count === 1 || count % 5 === 0) void bix.talk(count === 1 ? 'Wow! Keep building!' : 'So cool!', 'happy');
    }
    renderGrid();
    renderTray();
  }
  ctx.onCleanup(endDrag);

  renderGrid();
  renderTray();
  requestAnimationFrame(fit);

  setTimeout(() => {
    if (!ctx.alive()) return;
    const st = getState();
    const unplaced = Object.values(st.blocks.inventory).reduce((a, b) => a + b, 0);
    if (fresh && unplaced) void bix.talk('Drag your new block into your world!', 'encourage', 'Drag it here!');
    else if (!st.blocks.totalEarned) void bix.talk('Finish a lesson to get blocks!', 'encourage', 'Learn to get blocks!');
    else void say('Let’s build!');
  }, 400);

  return el;
}
