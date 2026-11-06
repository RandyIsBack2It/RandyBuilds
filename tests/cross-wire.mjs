// CROSS//WIRE rules: puzzle validation, numbering, solving behaviour, hints,
// clock, scoring, daily rotation, saves and campaign unlocking.
// Run: node tests/cross-wire.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsTree } from './load-ts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => path.join(root, 'src/arcade/cross-wire', f);
const { parse, validate } = await loadTsTree(src('crossword.ts'));
const { Solve, Clock, fmtClock, score } = await loadTsTree(src('solve.ts'));
const { LIBRARY, SECTORS, ALL, byId, locate, sectorOpen, sectorDone, campaignDone } = await loadTsTree(src('puzzles.ts'));
const { daily, dailyNumber, DAILY_ORDER, DAILY_START, dailyIsValid, msToNextDaily } = await loadTsTree(src('daily.ts'));
const { Store, parseSave, KEY } = await loadTsTree(src('storage.ts'));

let failures = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.error(`✗ ${msg}`); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── Every shipped puzzle is valid ─────────────────────────────────────
ok(ALL.length >= 15, `at least 15 puzzles (have ${ALL.length})`);
eq(new Set(ALL.map((p) => p.id)).size, ALL.length, 'puzzle ids are unique');
for (const p of ALL) {
  const errs = validate(p);
  ok(errs.length === 0, `${p.id}: ${errs.join('; ')}`);
  const words = Object.keys(p.clues);
  for (const w of words) ok(!/\b(TODO|XXX|lorem)\b/i.test(p.clues[w]), `${p.id}: placeholder clue for ${w}`);
}
const sizes = ALL.map((p) => p.grid.length);
ok(sizes.includes(5) && sizes.includes(7), 'collection has 5×5 and 7×7 grids');

// ── The validator catches broken puzzles ──────────────────────────────
const base = byId['m-alarm'];
const bad = (change, why) => { const def = { ...base, ...change, clues: { ...base.clues, ...(change.clues ?? {}) } }; ok(validate(def).length > 0, `validator should reject: ${why}`); };
bad({ grid: ['#DATA', 'SEWER', 'ALARM', 'FARMS'] }, 'non-square grid');
bad({ grid: ['#DATA', 'SEWER', 'ALARM', 'FARMS', 'EYE#'] }, 'short row');
bad({ grid: ['#DATA', 'SEWER', 'ALARM', 'FARMS', 'EYE1#'] }, 'bad characters');
bad({ grid: ['#DATA', 'SEWXR', 'ALARM', 'FARMS', 'EYES#'] }, 'answers with no clue (inconsistent crossing)');
bad({ clues: { DATA: '' } }, 'empty clue');
bad({ clues: { EXTRA: 'Not in the grid' } }, 'clue for a missing answer');
bad({ clues: { DATA: 'Data, in short' } }, 'clue containing its answer');
bad({ grid: ['##DAT', 'S#WER', 'ALARM', 'FARMS', 'EYES#'] }, 'two-letter entries / unchecked squares');
ok(validate({ id: 'x', title: 'X', level: 1, grid: ['AB#', 'CD#', '###'], clues: {} }).some((e) => e.includes('outside 4–9')), 'tiny grid rejected');
const islands = { id: 'isl', title: 'Islands', level: 1, grid: ['CAT#', 'ARE#', 'TEN#', '####'], clues: { CAT: 'a', ARE: 'b', TEN: 'c' } };
ok(validate(islands).length > 0, 'unchecked / missing clue grid rejected');
const split = { id: 'split', title: 'Split', level: 1, grid: ['ABC#####', 'DEF#####', 'GHI#####', '########', '#####JKL', '#####MNO', '#####PQR', '########'],
  clues: Object.fromEntries(['ABC', 'DEF', 'GHI', 'ADG', 'BEH', 'CFI', 'JKL', 'MNO', 'PQR', 'JMP', 'KNQ', 'LOR'].map((w) => [w, 'x'])) };
ok(validate(split).some((e) => e.includes('cut off')), 'disconnected grid rejected');

// ── Numbering ─────────────────────────────────────────────────────────
{
  const p = parse(byId['m-pet']); // ##PRY / #BLUE / LOANS / INNS# / PET##
  const nums = p.cells.filter((c) => c.num).map((c) => [c.r, c.c, c.num]);
  eq(nums, [[0, 2, 1], [0, 3, 2], [0, 4, 3], [1, 1, 4], [2, 0, 5], [3, 0, 6], [4, 0, 7]], 'standard numbering for a corner-block grid');
  eq(p.entries.filter((e) => e.dir === 'across').map((e) => `${e.num}${e.answer}`), ['1PRY', '4BLUE', '5LOANS', '6INNS', '7PET'], 'across entries in order');
  eq(p.entries.filter((e) => e.dir === 'down').map((e) => `${e.num}${e.answer}`), ['1PLANT', '2RUNS', '3YES', '4BONE', '5LIP'], 'down entries in order');
  const q = parse(byId['s2-power']);
  eq(q.entries.length, 22, '7×7 power grid has 22 answers');
  for (const e of q.entries) ok(q.cells[e.cells[0]].num === e.num, `${e.num}-${e.dir} starts on its number`);
}

// ── Selecting and moving ──────────────────────────────────────────────
const P = parse(byId['m-alarm']); // #DATA / SEWER / ALARM / FARMS / EYES#
const at = (r, c) => r * 5 + c;
{
  const s = new Solve(P);
  eq([s.cell, s.dir], [at(0, 1), 'across'], 'starts on 1-Across');
  s.select(at(2, 2));
  eq([s.cell, s.dir, s.entry.answer], [at(2, 2), 'across', 'ALARM'], 'clicking a square keeps the direction');
  s.select(at(2, 2));
  eq([s.dir, s.entry.answer], ['down', 'AWARE'], 'clicking it again switches to Down');
  s.select(at(2, 2));
  eq(s.dir, 'across', 'and back to Across');
  s.select(at(0, 0));
  eq(s.cell, at(2, 2), 'black squares cannot be selected');
  s.selectEntry(P.entries.find((e) => e.answer === 'TERMS').i);
  eq([s.cell, s.dir], [at(0, 3), 'down'], 'choosing a clue selects its first empty square');
  s.arrow(0, 1);
  eq([s.cell, s.dir], [at(0, 3), 'across'], 'an arrow across the current direction turns first');
  s.arrow(0, 1);
  eq(s.cell, at(0, 4), 'then moves');
  s.arrow(0, 1);
  eq(s.cell, at(0, 4), 'and stops at the edge');
  s.select(at(1, 0)); s.dir = 'across';
  s.arrow(-1, 0); // turns to down first
  s.arrow(-1, 0);
  eq(s.cell, at(1, 0), 'moving up into a black square edge stays put');
  s.select(at(4, 3)); s.arrow(0, 1); s.arrow(0, 1);
  eq(s.cell, at(4, 3), 'skipping over black squares only lands on white ones');
}

// ── Typing, backspace, delete ─────────────────────────────────────────
{
  const s = new Solve(P);
  s.selectEntry(P.entries.find((e) => e.answer === 'SEWER').i);
  for (const ch of 'sewe') s.type(ch);
  eq(s.cell, at(1, 4), 'typing advances along the answer');
  s.type('R'); s.type('X');
  eq([s.fill[at(1, 4)], s.cell], ['X', at(1, 4)], 'at the end of an answer typing stays in it (never jumps to another answer)');
  s.type('R');
  s.backspace();
  eq([s.fill[at(1, 4)], s.cell], ['', at(1, 4)], 'backspace clears a filled square and stays');
  s.backspace();
  eq([s.fill[at(1, 3)], s.cell], ['', at(1, 3)], 'backspace on an empty square steps back and clears');
  s.select(at(1, 1)); s.del();
  eq([s.fill[at(1, 1)], s.cell], ['', at(1, 1)], 'delete clears without moving');
  s.type('1'); s.type('é');
  eq(s.fill[at(1, 1)], '', 'non-letters are ignored');
  s.toggleDir();
  eq(s.dir, 'down', 'switched to Down');
  s.type('e');
  eq(s.cell, at(2, 1), 'in Down, typing moves down');
}

// ── Intersections, powered words, completion ──────────────────────────
const fillAll = (s, except = []) => { for (const i of s.p.white) if (!except.includes(i)) s.fill[i] = s.p.cells[i].sol; };
{
  const s = new Solve(P);
  const events = [];
  s.on((e) => events.push(e.type));
  s.selectEntry(P.entries.find((e) => e.answer === 'ALARM').i);
  for (const ch of 'ALARM') s.type(ch);
  ok(s.powered.has(P.entries.find((e) => e.answer === 'ALARM').i), 'a correct answer powers its circuit');
  ok(events.includes('word'), 'and fires a word event');
  ok(!s.powered.has(P.entries.find((e) => e.answer === 'AWARE').i), 'the crossing answer is not powered by one letter');
  s.selectEntry(P.entries.find((e) => e.answer === 'AWARE').i);
  for (const ch of 'AWAXE') s.type(ch);
  ok(!s.powered.has(P.entries.find((e) => e.answer === 'AWARE').i), 'a wrong letter keeps the answer dark');
  eq(s.fill[at(2, 2)], 'A', 'the shared square kept its letter when typed over with the same letter');
  ok(s.status === 'solving', 'not solved yet');
  fillAll(s, [at(1, 2)]);
  s.select(at(1, 2)); s.dir = 'down'; s.type('X');
  eq(s.status, 'full-wrong', 'a full but wrong grid is reported without saying where');
  ok(events.includes('full-wrong'), 'full-wrong event fires');
  s.select(at(1, 2)); s.type('W');
  eq(s.status, 'solved', 'fixing the last letter solves it');
  ok(events.includes('solved'), 'solved event fires');
  eq(s.powered.size, P.entries.length, 'everything is powered when solved');
  s.select(at(1, 2)); s.type('Q');
  eq(s.fill[at(1, 2)], 'W', 'a solved grid is locked');
  ok(!s.assisted, 'no hints → unassisted');
}

// ── Hints ─────────────────────────────────────────────────────────────
{
  const s = new Solve(P);
  s.selectEntry(P.entries.find((e) => e.answer === 'FARMS').i);
  for (const ch of 'FORMX') s.type(ch);
  const r = s.checkWord();
  eq(r, { wrong: 2, empty: 0 }, 'check word counts wrong letters');
  ok(s.wrong.has(at(3, 1)) && s.wrong.has(at(3, 4)) && !s.wrong.has(at(3, 0)), 'and marks only those squares');
  eq(s.fill[at(3, 1)], 'O', 'check word does not reveal the answer');
  s.select(at(3, 1)); s.type('A');
  ok(!s.wrong.has(at(3, 1)), 'retyping clears the mark');
  eq(s.hints, 1, 'a check counts as a hint');
  s.select(at(3, 4)); s.revealLetter();
  eq([s.fill[at(3, 4)], s.revealed[at(3, 4)], s.hints], ['S', true, 2], 'reveal letter fills the right letter and counts');
  s.revealLetter();
  eq(s.hints, 2, 'revealing an already revealed square is free');
  s.type('Z');
  eq(s.fill[at(3, 4)], 'S', 'revealed letters cannot be overwritten');
  s.backspace();
  eq(s.fill[at(3, 4)], 'S', 'or erased');
  s.dir = 'across'; s.select(at(3, 2));
  s.clearWord();
  eq([at(3, 0), at(3, 1), at(3, 2), at(3, 3), at(3, 4)].map((i) => s.fill[i]), ['', '', '', '', 'S'], 'clear word keeps revealed letters');
  eq(s.hints, 2, 'clear word is not a hint');
  s.selectEntry(P.entries.find((e) => e.answer === 'DATA').i);
  s.revealWord();
  eq([at(0, 1), at(0, 2), at(0, 3), at(0, 4)].map((i) => s.fill[i]).join(''), 'DATA', 'reveal word fills the answer');
  eq(s.hints, 3, 'and counts');
  fillAll(s);
  s.select(at(1, 0)); s.type('S');
  eq(s.status, 'solved', 'assisted solve completes');
  ok(s.assisted, 'and is marked assisted');
}

// ── Saving and restoring a solve ──────────────────────────────────────
{
  const s = new Solve(P);
  s.selectEntry(0); s.type('D'); s.type('A');
  s.select(at(4, 0)); s.revealLetter();
  const save = s.save(12345);
  eq(save.fill.length, 25, 'save has one character per square');
  const t = new Solve(P, save);
  eq([t.fill[at(0, 1)], t.fill[at(0, 2)], t.revealed[at(4, 0)], t.hints], ['D', 'A', true, 1], 'restored letters, reveals and hints');
  eq(t.cell, at(0, 3), 'restored solve resumes at the first empty square');
  const u = new Solve(P, { fill: 'garbage', revealed: '0', hints: 2, ms: 5, done: false });
  eq(u.filled, 0, 'a mismatched save is ignored');
}

// ── Clock and score ───────────────────────────────────────────────────
{
  let now = 1000;
  const c = new Clock(500, () => now);
  eq(c.ms, 500, 'clock starts from a saved time');
  c.start(); now += 2000;
  eq(c.ms, 2500, 'counts while running');
  c.stop(); now += 60_000;
  eq(c.ms, 2500, 'does not count while stopped (hidden tab)');
  c.start(); c.start(); now += 1000;
  eq(c.ms, 3500, 'double start is harmless');
  eq([fmtClock(0), fmtClock(61_999), fmtClock(3_723_000)], ['00:00', '01:01', '1:02:03'], 'clock format');
  const s1 = score(P, 60_000, 0), s2 = score(P, 60_000, 2), s3 = score(P, 999_000, 9);
  eq(s1.words, P.entries.length * 100, '100 per answer');
  eq(s1.speed, Math.round((P.white.length * 8 - 60) * 2), 'speed bonus: 2 per second under par');
  ok(s2.total < s1.total && s2.total === Math.round(s1.total * 0.6), 'hints cost 20% each');
  eq([s3.speed, s3.mult], [0, 0.2], 'no negative bonus, multiplier floor 20%');
}

// ── Daily rotation ────────────────────────────────────────────────────
{
  ok(dailyIsValid(), 'daily list names real puzzles once each');
  eq(DAILY_ORDER.length, ALL.length, 'every puzzle is in the daily rotation');
  const day = 86_400_000;
  eq(dailyNumber(DAILY_START), 1, 'day 1 at the start date');
  eq(dailyNumber(DAILY_START + day - 1), 1, 'still day 1 a millisecond before UTC midnight');
  eq(dailyNumber(DAILY_START + day), 2, 'day 2 at UTC midnight');
  eq(dailyNumber(DAILY_START - 5 * day), 1, 'never below 1');
  eq(daily(1), { n: 1, date: '2026-10-19', id: DAILY_ORDER[0] }, 'daily 1');
  eq(daily(DAILY_ORDER.length + 1).id, DAILY_ORDER[0], 'cycles through the collection');
  eq(daily(42).date, '2026-11-29', 'date for day 42');
  // Same answer in every time zone: the number depends only on the UTC instant.
  const t = Date.UTC(2026, 10, 3, 23, 30);
  eq(dailyNumber(t), dailyNumber(t + 40 * 60_000) - 1, 'changes at UTC midnight');
  eq(dailyNumber(t), dailyNumber(t + 20 * 60_000), 'not before');
  eq(msToNextDaily(DAILY_START + day - 1000), 1000, 'countdown to the next daily');
}

// ── Saves: parsing, corruption, records, reset ────────────────────────
{
  const mem = new Map();
  const ls = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const st = new Store(ls);
  eq(st.data.settings, { sound: true, music: false, feedback: true, timer: true }, 'default settings');
  st.data.solves['m-alarm'] = new Solve(P).save(10);
  st.data.settings.music = true;
  const b1 = st.finish('m-alarm', 90_000, 0, 1500);
  eq(b1, { best: true, clean: true, score: true }, 'first finish sets every record');
  const b2 = st.finish('m-alarm', 80_000, 2, 900);
  eq(b2, { best: true, clean: false, score: false }, 'an assisted solve never sets the unassisted record');
  eq(st.data.records['m-alarm'], { solves: 2, best: 80_000, bestClean: 90_000, bestScore: 1500 }, 'records');
  const again = new Store(ls);
  eq([again.data.settings.music, again.data.records['m-alarm'].solves, !!again.data.solves['m-alarm']], [true, 2, true], 'saves survive a reload');
  eq(parseSave('{not json').solves, {}, 'corrupt JSON starts fresh');
  eq(parseSave(JSON.stringify({ v: 9, solves: { a: 1 } })).solves, {}, 'unknown version starts fresh');
  const mixed = parseSave(JSON.stringify({ v: 1, settings: { sound: 'yes', music: true }, solves: { good: { fill: '.', revealed: '0', hints: 0, ms: 1, done: false }, bad: { fill: 3 } }, records: { r: { solves: 1, best: 'x' } }, seen: ['s1', 4] }));
  eq([mixed.settings.sound, mixed.settings.music, Object.keys(mixed.solves), mixed.records.r, mixed.seen], [true, true, ['good'], { solves: 1 }, ['s1']], 'bad parts dropped, good parts kept');
  const broken = new Store({ getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => {} });
  ok(!broken.ok, 'unavailable storage is detected');
  broken.write();
  ok(true, 'writing to unavailable storage does not throw');
  st.reset();
  eq([Object.keys(st.data.solves).length, Object.keys(st.data.records).length, st.data.settings.music], [0, 0, true], 'reset clears progress but keeps settings');
  ok(mem.has(KEY), 'reset writes a fresh save');
}

// ── Campaign unlocking ────────────────────────────────────────────────
{
  eq(SECTORS.length, 3, 'three sectors');
  eq(SECTORS.map((s) => s.name), ['Boot Sequence', 'Signal Recovery', 'The Mainframe'], 'sector names');
  const solved = new Set();
  ok(sectorOpen(SECTORS[0], solved) && !sectorOpen(SECTORS[1], solved) && !sectorOpen(SECTORS[2], solved), 'only sector 1 is open at first');
  SECTORS[0].puzzles.slice(0, 3).forEach((p) => solved.add(p.id));
  ok(!sectorOpen(SECTORS[1], solved), 'sector 2 stays locked until all of sector 1 is done');
  solved.add(SECTORS[0].puzzles[3].id);
  ok(sectorDone(SECTORS[0], solved) && sectorOpen(SECTORS[1], solved) && !sectorOpen(SECTORS[2], solved), 'finishing sector 1 opens sector 2');
  SECTORS[1].puzzles.forEach((p) => solved.add(p.id));
  ok(sectorOpen(SECTORS[2], solved) && !campaignDone(solved), 'sector 3 opens; campaign not done');
  SECTORS[2].puzzles.forEach((p) => solved.add(p.id));
  ok(campaignDone(solved), 'all sectors → campaign complete');
  eq(locate('s2-power').kind, 'campaign', 'locate campaign puzzle');
  eq(locate('m-alarm').kind, 'library', 'locate library puzzle');
  ok(LIBRARY.every((p) => p.grid.length <= 6), 'minis are small grids');
  const lv = SECTORS.map((s) => Math.max(...s.puzzles.map((p) => p.level)));
  ok(lv[0] <= lv[1] && lv[1] <= lv[2], 'difficulty rises through the sectors');
}

// ── A whole puzzle solved through the keyboard path, every puzzle ─────
for (const def of ALL) {
  const p = parse(def);
  const s = new Solve(p);
  for (const e of p.entries) { s.selectEntry(e.i); for (const i of e.cells) { s.select(i); if (s.entry.i !== e.i) s.toggleDir(); s.type(p.cells[i].sol); } }
  ok(s.status === 'solved' && !s.assisted, `${def.id}: solvable by typing every answer`);
}

console.log(`${checks - failures}/${checks} checks passed · ${ALL.length} puzzles validated (${LIBRARY.length} minis, ${SECTORS.map((s) => s.puzzles.length).join('+')} campaign)`);
if (failures) process.exit(1);
