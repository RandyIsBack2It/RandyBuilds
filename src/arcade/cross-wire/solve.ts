// CROSS//WIRE solving state: cursor, typing, navigation, hints and completion.
// DOM-free; the UI renders from it after every change.
import { type Dir, type Entry, type Puzzle } from './crossword';

export type Status = 'solving' | 'full-wrong' | 'solved';

/** What a saved solve looks like (strings keep localStorage small). */
export interface SolveSave {
  /** One character per square: a letter, or '.' for empty / block. */
  fill: string;
  /** '1' where the letter was revealed. */
  revealed: string;
  hints: number;
  ms: number;
  done: boolean;
}

export type Event =
  | { type: 'letter' } | { type: 'erase' } | { type: 'move' }
  | { type: 'word'; entry: number } | { type: 'solved' } | { type: 'full-wrong' }
  | { type: 'check'; entry: number; wrong: number; empty: number } | { type: 'reveal'; entry?: number };

export class Solve {
  fill: string[];
  revealed: boolean[];
  /** Squares a Check Word marked wrong; cleared when that square changes. */
  wrong = new Set<number>();
  cell: number;
  dir: Dir = 'across';
  hints = 0;
  status: Status = 'solving';
  /** Entries that are filled in correctly (they power their circuit). */
  powered = new Set<number>();
  private listeners: ((e: Event) => void)[] = [];

  constructor(public p: Puzzle, save?: SolveSave | null) {
    const n = p.cells.length;
    this.fill = Array(n).fill('');
    this.revealed = Array(n).fill(false);
    if (save && save.fill.length === n && save.revealed.length === n) {
      for (let i = 0; i < n; i++) {
        const ch = save.fill[i];
        if (!p.cells[i].block && /[A-Z]/.test(ch)) this.fill[i] = ch;
        this.revealed[i] = !p.cells[i].block && save.revealed[i] === '1';
      }
      this.hints = Math.max(0, save.hints | 0);
    }
    this.cell = this.firstEmpty(p.entries[0]) ?? p.white[0];
    if (p.cells[this.cell].across === undefined) this.dir = 'down';
    this.refresh(false);
  }

  on(fn: (e: Event) => void) { this.listeners.push(fn); }
  private emit(e: Event) { for (const fn of this.listeners) fn(e); }

  get entry(): Entry { return this.p.entries[this.entryAt(this.cell, this.dir)!]; }
  entryAt(cell: number, dir: Dir): number | undefined { return this.p.cells[cell][dir]; }
  get locked() { return this.status === 'solved'; }

  save(ms: number): SolveSave {
    return {
      fill: this.p.cells.map((c) => (c.block || !this.fill[c.i] ? '.' : this.fill[c.i])).join(''),
      revealed: this.revealed.map((x) => (x ? '1' : '0')).join(''),
      hints: this.hints, ms, done: this.status === 'solved',
    };
  }

  // ── Selection ──────────────────────────────────────────────────────
  /** Tap or click a square. Tapping the active square again switches direction where it can. */
  select(cell: number) {
    const c = this.p.cells[cell];
    if (!c || c.block) return;
    if (cell === this.cell) { this.toggleDir(); return; }
    this.cell = cell;
    if (c[this.dir] === undefined) this.dir = this.dir === 'across' ? 'down' : 'across';
    this.emit({ type: 'move' });
  }
  toggleDir() {
    const other: Dir = this.dir === 'across' ? 'down' : 'across';
    if (this.p.cells[this.cell][other] !== undefined) { this.dir = other; this.emit({ type: 'move' }); }
  }
  /** Choose a clue: its answer is selected, the cursor goes to its first empty square. */
  selectEntry(i: number) {
    const e = this.p.entries[i];
    if (!e) return;
    this.dir = e.dir;
    this.cell = this.firstEmpty(e) ?? e.cells[0];
    this.emit({ type: 'move' });
  }
  /** Tab / Shift+Tab: the next (or previous) answer in clue order, preferring unfinished ones. */
  nextEntry(step = 1) {
    const all = this.p.entries, n = all.length;
    const cur = this.entry.i;
    for (let k = 1; k <= n; k++) {
      const e = all[(cur + step * k + n * k) % n];
      if (this.firstEmpty(e) !== undefined) { this.selectEntry(e.i); return; }
    }
    this.selectEntry(all[(cur + step + n) % n].i);
  }
  /** Arrow keys: pressing across the current direction turns first, then moves. */
  arrow(dr: number, dc: number) {
    const want: Dir = dc !== 0 ? 'across' : 'down';
    if (want !== this.dir && this.p.cells[this.cell][want] !== undefined) { this.dir = want; this.emit({ type: 'move' }); return; }
    let { r, c } = this.p.cells[this.cell];
    for (;;) {
      r += dr; c += dc;
      if (r < 0 || c < 0 || r >= this.p.rows || c >= this.p.cols) return;
      const cell = this.p.cells[r * this.p.cols + c];
      if (!cell.block) { this.cell = cell.i; if (cell[this.dir] === undefined) this.dir = want; this.emit({ type: 'move' }); return; }
    }
  }

  // ── Typing ─────────────────────────────────────────────────────────
  /** Enter a letter and move to the next square of the same answer (never into another answer). */
  type(ch: string) {
    if (this.locked) return;
    const L = ch.toUpperCase();
    if (!/^[A-Z]$/.test(L)) return;
    if (!this.revealed[this.cell]) { this.fill[this.cell] = L; this.wrong.delete(this.cell); }
    const e = this.entry, k = e.cells.indexOf(this.cell);
    if (k < e.cells.length - 1) this.cell = e.cells[k + 1];
    this.emit({ type: 'letter' });
    this.refresh(true);
  }
  /** Backspace: clear this square, or if it is empty, step back and clear that one. */
  backspace() {
    if (this.locked) return;
    if (this.fill[this.cell] && !this.revealed[this.cell]) { this.clear(this.cell); }
    else {
      const e = this.entry, k = e.cells.indexOf(this.cell);
      if (k > 0) { this.cell = e.cells[k - 1]; if (!this.revealed[this.cell]) this.clear(this.cell); }
    }
    this.emit({ type: 'erase' });
    this.refresh(true);
  }
  /** Delete: clear this square and stay. */
  del() {
    if (this.locked || this.revealed[this.cell]) return;
    this.clear(this.cell);
    this.emit({ type: 'erase' });
    this.refresh(true);
  }
  private clear(i: number) { this.fill[i] = ''; this.wrong.delete(i); }

  // ── Hints ──────────────────────────────────────────────────────────
  revealLetter() {
    if (this.locked) return;
    const i = this.cell;
    if (this.revealed[i]) return;
    this.fill[i] = this.p.cells[i].sol; this.revealed[i] = true; this.wrong.delete(i);
    this.hints++;
    this.emit({ type: 'reveal' });
    this.refresh(true);
  }
  revealWord() {
    if (this.locked) return;
    const e = this.entry;
    for (const i of e.cells) { this.fill[i] = this.p.cells[i].sol; this.revealed[i] = true; this.wrong.delete(i); }
    this.hints++;
    this.emit({ type: 'reveal', entry: e.i });
    this.refresh(true);
  }
  /** Marks wrong letters in the selected answer without showing the right ones. */
  checkWord() {
    if (this.locked) return { wrong: 0, empty: 0 };
    const e = this.entry;
    let wrong = 0, empty = 0;
    for (const i of e.cells) {
      if (!this.fill[i]) empty++;
      else if (this.fill[i] !== this.p.cells[i].sol) { wrong++; this.wrong.add(i); }
    }
    this.hints++;
    this.emit({ type: 'check', entry: e.i, wrong, empty });
    return { wrong, empty };
  }
  /** Clears what the player typed in the selected answer; revealed letters stay. Not a hint. */
  clearWord() {
    if (this.locked) return;
    for (const i of this.entry.cells) if (!this.revealed[i]) this.clear(i);
    this.cell = this.entry.cells.find((i) => !this.revealed[i]) ?? this.entry.cells[0];
    this.emit({ type: 'erase' });
    this.refresh(true);
  }

  // ── State ──────────────────────────────────────────────────────────
  firstEmpty(e: Entry): number | undefined { return e.cells.find((i) => !this.fill[i]); }
  isCorrect(e: Entry) { return e.cells.every((i) => this.fill[i] === this.p.cells[i].sol); }
  get filled() { return this.p.white.filter((i) => this.fill[i]).length; }
  get assisted() { return this.hints > 0 || this.revealed.some(Boolean); }

  private refresh(notify: boolean) {
    for (const e of this.p.entries) {
      const ok = this.isCorrect(e);
      if (ok && !this.powered.has(e.i)) { this.powered.add(e.i); if (notify) this.emit({ type: 'word', entry: e.i }); }
      else if (!ok) this.powered.delete(e.i);
    }
    const full = this.p.white.every((i) => this.fill[i]);
    const prev = this.status;
    this.status = full ? (this.p.white.every((i) => this.fill[i] === this.p.cells[i].sol) ? 'solved' : 'full-wrong') : 'solving';
    if (notify && this.status !== prev) {
      if (this.status === 'solved') this.emit({ type: 'solved' });
      if (this.status === 'full-wrong') this.emit({ type: 'full-wrong' });
    }
  }
}

/** Elapsed solving time that only runs while the puzzle is on screen. */
export class Clock {
  private base: number;
  private since: number | null = null;
  constructor(ms = 0, private now: () => number = () => performance.now()) { this.base = ms; }
  start() { if (this.since === null) this.since = this.now(); }
  stop() { if (this.since !== null) { this.base += this.now() - this.since; this.since = null; } }
  get running() { return this.since !== null; }
  get ms() { return this.base + (this.since === null ? 0 : this.now() - this.since); }
}

export const fmtClock = (ms: number) => {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
};

/**
 * Arcade score (shown with its working on the results screen):
 * 100 per answer, plus 2 per second under par (par = 8 s per square),
 * then −20% for each hint (never below 20% of the total).
 */
export function score(p: Puzzle, ms: number, hints: number) {
  const words = p.entries.length * 100;
  const par = p.white.length * 8;
  const speed = Math.max(0, Math.round((par - ms / 1000) * 2));
  const mult = Math.max(0.2, 1 - 0.2 * hints);
  return { words, speed, par, mult, total: Math.round((words + speed) * mult) };
}
