// CROSS//WIRE crossword model: parses a puzzle definition into numbered cells
// and entries, and validates it. DOM-free (tested by tests/cross-wire.mjs).

export type Dir = 'across' | 'down';

/** A puzzle as authored: solution rows ('#' = block) and a clue for every answer. */
export interface PuzzleDef {
  id: string;
  title: string;
  /** 1 = gentle, 2 = medium, 3 = tricky. */
  level: 1 | 2 | 3;
  grid: string[];
  /** Clues keyed by their answer (every answer in a puzzle is different). */
  clues: Record<string, string>;
}

export interface Cell {
  i: number; r: number; c: number;
  block: boolean;
  /** Solution letter ('' for blocks). */
  sol: string;
  num?: number;
  across?: number;
  down?: number;
}

export interface Entry {
  i: number;
  dir: Dir;
  num: number;
  cells: number[];
  answer: string;
  clue: string;
}

export interface Puzzle {
  def: PuzzleDef;
  rows: number;
  cols: number;
  cells: Cell[];
  entries: Entry[];
  /** White cells, in reading order. */
  white: number[];
}

/** Standard numbering: a white cell gets a number when it starts an across or a down run of two or more. */
export function parse(def: PuzzleDef): Puzzle {
  const rows = def.grid.length, cols = def.grid[0]?.length ?? 0;
  const at = (r: number, c: number) => (r >= 0 && c >= 0 && r < rows && c < cols ? def.grid[r][c] : '#');
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = at(r, c);
    cells.push({ i: r * cols + c, r, c, block: ch === '#', sol: ch === '#' ? '' : ch });
  }
  const entries: Entry[] = [];
  let num = 0;
  const runs: { dir: Dir; num: number; cells: number[] }[] = [];
  for (const cell of cells) {
    if (cell.block) continue;
    const { r, c } = cell;
    const startA = at(r, c - 1) === '#' && at(r, c + 1) !== '#';
    const startD = at(r - 1, c) === '#' && at(r + 1, c) !== '#';
    if (!startA && !startD) continue;
    cell.num = ++num;
    if (startA) { const run = []; for (let x = c; at(r, x) !== '#'; x++) run.push(r * cols + x); runs.push({ dir: 'across', num, cells: run }); }
    if (startD) { const run = []; for (let y = r; at(y, c) !== '#'; y++) run.push(y * cols + c); runs.push({ dir: 'down', num, cells: run }); }
  }
  // Across first, then down, each by number (the order clue lists use).
  for (const dir of ['across', 'down'] as const) {
    for (const run of runs.filter((x) => x.dir === dir)) {
      const answer = run.cells.map((i) => cells[i].sol).join('');
      const e: Entry = { i: entries.length, dir, num: run.num, cells: run.cells, answer, clue: def.clues[answer] ?? '' };
      entries.push(e);
      for (const i of run.cells) cells[i][dir] = e.i;
    }
  }
  return { def, rows, cols, cells, entries, white: cells.filter((x) => !x.block).map((x) => x.i) };
}

/** Everything that makes a puzzle unfit to ship. Empty means valid. */
export function validate(def: PuzzleDef): string[] {
  const errs: string[] = [];
  const rows = def.grid.length, cols = def.grid[0]?.length ?? 0;
  if (!/^[a-z0-9-]+$/.test(def.id)) errs.push(`bad id "${def.id}"`);
  if (!def.title.trim()) errs.push('missing title');
  if (rows < 4 || rows > 9 || cols < 4 || cols > 9) errs.push(`grid ${cols}×${rows} is outside 4–9`);
  if (rows !== cols) errs.push(`grid is ${cols}×${rows}, not square`);
  def.grid.forEach((row, r) => {
    if (row.length !== cols) errs.push(`row ${r + 1} has ${row.length} squares, expected ${cols}`);
    if (!/^[A-Z#]+$/.test(row)) errs.push(`row ${r + 1} has characters other than A–Z and #`);
  });
  if (errs.length) return errs;
  const p = parse(def);
  // Every white square must be in an across and a down answer of 3+ letters (no unchecked or two-letter entries).
  for (const i of p.white) {
    const cell = p.cells[i];
    const where = `square r${cell.r + 1}c${cell.c + 1}`;
    if (cell.across === undefined) errs.push(`${where} is not in an across answer`);
    if (cell.down === undefined) errs.push(`${where} is not in a down answer`);
  }
  for (const e of p.entries) {
    const name = `${e.num}-${e.dir}`;
    if (e.answer.length < 3) errs.push(`${name} "${e.answer}" is shorter than three letters`);
    if (!e.clue.trim()) errs.push(`${name} "${e.answer}" has no clue`);
    if (e.clue.toUpperCase().split(/[^A-Z]+/).includes(e.answer)) errs.push(`${name} clue contains its own answer`);
  }
  const answers = p.entries.map((e) => e.answer);
  for (const a of new Set(answers)) if (answers.filter((x) => x === a).length > 1) errs.push(`answer "${a}" appears twice`);
  for (const k of Object.keys(def.clues)) if (!answers.includes(k)) errs.push(`clue for "${k}" matches no answer`);
  // Numbers: consecutive from 1, each entry starts on its numbered square, clue lists in order.
  const nums = p.cells.filter((c) => c.num !== undefined).map((c) => c.num!);
  nums.forEach((n, k) => { if (n !== k + 1) errs.push(`numbering skips at ${n}`); });
  for (const e of p.entries) if (p.cells[e.cells[0]].num !== e.num) errs.push(`${e.num}-${e.dir} does not start on square ${e.num}`);
  // One connected area of white squares.
  if (p.white.length) {
    const seen = new Set([p.white[0]]), todo = [p.white[0]];
    while (todo.length) {
      const i = todo.pop()!, { r, c } = p.cells[i];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const y = r + dr, x = c + dc;
        if (y < 0 || x < 0 || y >= rows || x >= cols) continue;
        const j = y * cols + x;
        if (!p.cells[j].block && !seen.has(j)) { seen.add(j); todo.push(j); }
      }
    }
    if (seen.size !== p.white.length) errs.push(`${p.white.length - seen.size} white squares are cut off from the rest`);
  } else errs.push('no white squares');
  return errs;
}

export const entryName = (e: Entry) => `${e.num} ${e.dir === 'across' ? 'Across' : 'Down'}`;
