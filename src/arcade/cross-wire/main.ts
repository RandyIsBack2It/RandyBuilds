// CROSS//WIRE page controller: views (hash routes), the grid, clues, hints,
// keyboard / touch input, saving, sound and the circuit visuals.
import { parse, entryName, type Puzzle, type PuzzleDef } from './crossword';
import { Solve, Clock, fmtClock, score, type SolveSave } from './solve';
import { LIBRARY, SECTORS, ALL, byId, locate, sectorDone, sectorOpen, campaignDone } from './puzzles';
import { daily, dailyNumber, msToNextDaily } from './daily';
import { Store } from './storage';
import { Audio, type Sfx } from './audio';
import { landscapeTouchPlay, autoFullscreen } from '../../game/immersive';

type View = 'home' | 'minis' | 'campaign' | 'play' | 'settings' | 'help';
type Kind = 'library' | 'campaign' | 'daily';
interface Session { kind: Kind; def: PuzzleDef; p: Puzzle; s: Solve; clock: Clock; dailyN?: number; finished: boolean }

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function boot() {
  const found = document.querySelector<HTMLElement>('[data-cw]');
  if (!found) return;
  const root: HTMLElement = found;
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const out = (name: string) => $(`[data-out="${name}"]`);
  const setText = (name: string, v: string) => { out(name).textContent = v; };
  const coarse = matchMedia('(pointer: coarse)');
  const store = new Store();
  const audio = new Audio();
  const settings = store.data.settings;
  audio.sfxOn = settings.sound; audio.musicOn = settings.music;
  const sfx = (n: Sfx) => audio.play(n);

  const gridEl = $('[data-grid]'), boardEl = $('[data-board]'), boxEl = $('[data-boardbox]'), tracesEl = $<HTMLElement & SVGSVGElement>('[data-traces]');
  const doneEl = $('[data-done]'), cluesEl = $('[data-clues]');
  let view: View = 'home';
  let session: Session | null = null;
  let cellEls: HTMLElement[] = [];
  let clueEls: HTMLElement[] = [];
  let traceEls: SVGElement[] = [];
  let firstRoute = true;

  // ── Saves ───────────────────────────────────────────────────────────
  const saveOf = (kind: Kind, id: string, n?: number): SolveSave | undefined =>
    kind === 'daily' ? (store.data.daily[String(n)]?.id === id ? store.data.daily[String(n)] : undefined) : store.data.solves[id];
  const solvedIds = () => new Set(Object.entries(store.data.solves).filter(([, v]) => v.done).map(([k]) => k));
  let saveTimer = 0;
  const persist = () => {
    clearTimeout(saveTimer); saveTimer = 0;
    if (!session) return;
    const data = session.s.save(Math.round(session.clock.ms));
    if (session.kind === 'daily') store.data.daily[String(session.dailyN)] = { ...data, id: session.def.id };
    else store.data.solves[session.def.id] = data;
    store.write();
  };
  const persistSoon = () => { if (!saveTimer) saveTimer = window.setTimeout(persist, 400); };

  // ── Views ───────────────────────────────────────────────────────────
  const show = (v: View) => {
    view = v;
    root.dataset.view = v;
    root.querySelectorAll<HTMLElement>('[data-view-el]').forEach((el) => { el.hidden = el.dataset.viewEl !== v; });
    if (v !== 'play') { closeClues(); closeHints(); doneEl.hidden = true; }
    fit();
    if (!firstRoute) {
      root.scrollIntoView({ block: 'start' });
      const h = root.querySelector<HTMLElement>(`[data-view-el="${v}"] [tabindex="-1"]`);
      if (v === 'play') gridEl.focus({ preventScroll: true }); else h?.focus({ preventScroll: true });
    }
  };

  const leavePlay = () => {
    if (!session) return;
    session.clock.stop();
    persist();
    session = null;
  };

  const route = () => {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const [v, id] = parts;
    if (v !== 'play' && v !== 'daily') leavePlay();
    if (v === 'minis') { renderMinis(); show('minis'); }
    else if (v === 'campaign') { renderCampaign(); show('campaign'); }
    else if (v === 'settings') { renderSettings(); show('settings'); }
    else if (v === 'help') show('help');
    else if (v === 'daily') { const d = daily(); start('daily', byId[d.id], d.n); }
    else if (v === 'play' && id && byId[id]) {
      const where = locate(id);
      if (where.kind === 'campaign' && !sectorOpen(where.sector, solvedIds())) { location.replace('#/campaign'); return; }
      start(where.kind, byId[id]);
    } else { renderHome(); show('home'); }
    firstRoute = false;
  };
  addEventListener('hashchange', route);

  // ── Home, lists, campaign ───────────────────────────────────────────
  const statusOf = (save?: SolveSave) => (!save ? 'new' : save.done ? 'solved' : /[A-Z]/.test(save.fill) ? 'started' : 'new');
  function renderHome() {
    const d = daily();
    const ds = saveOf('daily', d.id, d.n);
    setText('daily-num', `#${d.n}`);
    const left = msToNextDaily();
    const next = `Next in ${Math.floor(left / 3_600_000)}h ${Math.floor((left % 3_600_000) / 60_000)}m`;
    setText('daily-meta', ds?.done ? `${d.date} · Solved in ${fmtClock(ds.ms)} · Hints ${ds.hints} · ${next}` : ds && statusOf(ds) === 'started' ? `${d.date} · In progress (${fmtClock(ds.ms)})` : `${d.date} · The same puzzle for everyone today`);
    setText('daily-go', ds?.done ? 'View result' : ds && statusOf(ds) === 'started' ? 'Continue' : 'Play');
    const solved = solvedIds();
    setText('minis-meta', `${LIBRARY.filter((p) => solved.has(p.id)).length} of ${LIBRARY.length} solved`);
    const restored = SECTORS.filter((s) => sectorDone(s, solved)).length;
    setText('campaign-meta', campaignDone(solved) ? 'Mainframe online. Campaign complete.' : `${restored} of ${SECTORS.length} sectors restored`);
  }

  const levelDots = (n: number) => `<span class="cw-level" aria-label="Difficulty ${n} of 3">${'<i></i>'.repeat(n)}${'<i class="off"></i>'.repeat(3 - n)}</span>`;
  const tile = (def: PuzzleDef, extra = '') => {
    const save = saveOf('library', def.id);
    const st = statusOf(save);
    const rec = store.data.records[def.id];
    const li = document.createElement('li');
    li.className = `cw-tile is-${st}${extra}`;
    const label = st === 'solved' ? `Solved${rec?.best !== undefined ? ` · best ${fmtClock(rec.best)}` : ''}` : st === 'started' ? `In progress · ${fmtClock(save!.ms)}` : 'Not started';
    const size = `${def.grid[0].length}×${def.grid.length}`;
    li.innerHTML = `<a href="#/play/${def.id}"><span class="cw-tile__size">${size}</span><span class="cw-tile__name"></span><span class="cw-tile__meta">${levelDots(def.level)}<span>${label}</span></span></a>`;
    li.querySelector('.cw-tile__name')!.textContent = def.title;
    return li;
  };
  function renderMinis() {
    out('minis').replaceChildren(...LIBRARY.map((d) => tile(d)));
  }
  function renderCampaign() {
    const solved = solvedIds();
    const wrap = out('campaign');
    const els = SECTORS.map((sec, k) => {
      const open = sectorOpen(sec, solved), done = sectorDone(sec, solved);
      const fresh = done && !store.data.seen.includes(sec.id);
      const el = document.createElement('section');
      el.className = `cw-sector${open ? '' : ' is-locked'}${done ? ' is-done' : ''}${fresh && !reduced() ? ' is-restoring' : ''}`;
      el.setAttribute('aria-labelledby', `cw-sec-${sec.id}`);
      const count = sec.puzzles.filter((p) => solved.has(p.id)).length;
      el.innerHTML = `<header class="cw-sector__head"><span class="cw-sector__num">SECTOR ${k + 1}</span><h3 id="cw-sec-${sec.id}"></h3><span class="cw-sector__state">${done ? 'ONLINE' : open ? `${count} / ${sec.puzzles.length} restored` : 'LOCKED'}</span></header><p class="cw-sector__blurb"></p>`;
      el.querySelector('h3')!.textContent = sec.name;
      el.querySelector('.cw-sector__blurb')!.textContent = open ? sec.blurb : `Locked. Restore all of sector ${k} to open it.`;
      const ul = document.createElement('ul');
      ul.className = 'cw-tiles cw-tiles--sector';
      for (const def of sec.puzzles) {
        if (open) ul.append(tile(def));
        else { const li = document.createElement('li'); li.className = 'cw-tile is-locked'; li.innerHTML = `<span class="cw-tile__locked"><span class="cw-tile__size">${def.grid[0].length}×${def.grid.length}</span><span class="cw-tile__name">Encrypted</span></span>`; ul.append(li); }
      }
      el.append(ul);
      if (fresh) store.data.seen.push(sec.id);
      return el;
    });
    const end = document.createElement('p');
    end.className = `cw-final${campaignDone(solved) ? ' is-on' : ''}`;
    end.textContent = campaignDone(solved) ? 'MAINFRAME ONLINE. Every sector restored. Nice work, operator.' : 'The mainframe comes back online when all three sectors are restored.';
    wrap.replaceChildren(...els, end);
    store.write();
  }

  // ── Starting a puzzle ───────────────────────────────────────────────
  function start(kind: Kind, def: PuzzleDef, dailyN?: number, fresh = false) {
    leavePlay();
    const p = parse(def);
    const save = fresh ? null : saveOf(kind, def.id, dailyN);
    const s = new Solve(p, save);
    const clock = new Clock(save?.ms ?? 0);
    session = { kind, def, p, s, clock, dailyN, finished: !!save?.done && s.status === 'solved' };
    setText('title', kind === 'daily' ? `Daily Circuit #${dailyN}` : def.title);
    out('back').setAttribute('href', kind === 'campaign' ? '#/campaign' : kind === 'library' ? '#/minis' : '#/');
    out('back').textContent = kind === 'campaign' ? '< Map' : kind === 'library' ? '< Puzzles' : '< Menu';
    // Clues first: buildGrid() fits the board, which can render() before returning.
    buildClues(p);
    buildGrid(p);
    termReset(kind === 'daily' ? `daily circuit #${dailyN} loaded (${p.cols}×${p.rows})` : `${def.title.toLowerCase()} loaded (${p.cols}×${p.rows})`);
    s.on((e) => onSolveEvent(e));
    show('play');
    render();
    if (session.finished) { showDone(false); }
    else if (document.visibilityState === 'visible') clock.start();
  }

  function onSolveEvent(e: Parameters<Parameters<Solve['on']>[0]>[0]) {
    if (!session) return;
    const s = session.s;
    switch (e.type) {
      case 'letter': sfx('key'); break;
      case 'erase': sfx('erase'); break;
      case 'move': sfx('select'); break;
      case 'word':
        if (settings.feedback && s.status !== 'solved') { sfx('word'); term(`${entryName(s.p.entries[e.entry]).toLowerCase()}: link restored`, 'ok'); pulse(e.entry); }
        break;
      case 'check':
        sfx(e.wrong ? 'check-bad' : 'check-ok');
        term(e.wrong ? `check ${entryName(s.p.entries[e.entry]).toLowerCase()}: ${e.wrong} wrong letter${e.wrong > 1 ? 's' : ''} marked` : e.empty ? `check ${entryName(s.p.entries[e.entry]).toLowerCase()}: no errors so far, ${e.empty} empty` : `check ${entryName(s.p.entries[e.entry]).toLowerCase()}: all correct`, e.wrong ? 'bad' : 'ok');
        say(e.wrong ? `${e.wrong} wrong letter${e.wrong > 1 ? 's' : ''} marked.` : e.empty ? `No wrong letters so far. ${e.empty} empty.` : 'All letters correct.');
        break;
      case 'reveal': sfx('hint'); term(e.entry !== undefined ? `reveal ${entryName(s.p.entries[e.entry]).toLowerCase()}` : 'reveal letter', 'hint'); break;
      case 'full-wrong': sfx('wrong-full'); term('grid full. integrity check failed: something is off', 'bad'); say('The grid is full, but something is not right yet.'); break;
      case 'solved': finish(); break;
    }
    render();
    persistSoon();
  }

  // ── Grid ────────────────────────────────────────────────────────────
  function buildGrid(p: Puzzle) {
    boardEl.style.setProperty('--cols', String(p.cols));
    cellEls = p.cells.map((c) => {
      const el = document.createElement('div');
      el.className = c.block ? 'cw-cell is-block' : 'cw-cell';
      el.dataset.i = String(c.i);
      if (!c.block) el.innerHTML = `${c.num ? `<span class="cw-cell__n">${c.num}</span>` : ''}<span class="cw-cell__l"></span>`;
      return el;
    });
    gridEl.replaceChildren(...cellEls);
    gridEl.setAttribute('aria-label', `Crossword grid, ${p.cols} by ${p.rows}`);
    fit();
  }
  function buildClues(p: Puzzle) {
    clueEls = [];
    for (const dir of ['across', 'down'] as const) {
      const ol = out(dir);
      ol.replaceChildren(...p.entries.filter((e) => e.dir === dir).map((e) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cw-clue'; b.dataset.entry = String(e.i);
        b.innerHTML = `<b>${e.num}</b><span></span>`;
        b.querySelector('span')!.textContent = `${e.clue} (${e.answer.length})`;
        b.setAttribute('aria-label', `${entryName(e)}: ${e.clue}, ${e.answer.length} letters`);
        clueEls[e.i] = b;
        li.append(b);
        return li;
      }));
    }
  }

  function render() {
    if (!session) return;
    const { s, p } = session;
    const solved = s.status === 'solved';
    const live = settings.feedback || solved;
    const word = new Set(s.entry.cells);
    for (const c of p.cells) {
      if (c.block) continue;
      const el = cellEls[c.i];
      el.classList.toggle('is-cur', c.i === s.cell && !solved);
      el.classList.toggle('is-word', word.has(c.i) && !solved);
      el.classList.toggle('is-live', live && ((c.across !== undefined && s.powered.has(c.across)) || (c.down !== undefined && s.powered.has(c.down))));
      el.classList.toggle('is-wrong', s.wrong.has(c.i));
      el.classList.toggle('is-rev', s.revealed[c.i]);
      el.querySelector('.cw-cell__l')!.textContent = s.fill[c.i];
    }
    const cross = new Set(p.cells[s.cell].across === s.entry.i ? [p.cells[s.cell].down] : [p.cells[s.cell].across]);
    for (const e of p.entries) {
      const b = clueEls[e.i];
      b.classList.toggle('is-cur', e.i === s.entry.i);
      b.classList.toggle('is-cross', cross.has(e.i));
      b.classList.toggle('is-filled', e.cells.every((i) => s.fill[i]));
      b.classList.toggle('is-live', live && s.powered.has(e.i));
    }
    setText('active-num', `${s.entry.num}${s.entry.dir === 'across' ? 'A' : 'D'}`);
    setText('active-clue', s.entry.clue);
    const powered = live ? s.powered.size / p.entries.length : 0;
    const pct = Math.round((settings.feedback || solved ? powered : s.filled / p.white.length) * 100);
    setText('power', `${pct}%`);
    out('power-bar').style.transform = `scaleX(${pct / 100})`;
    root.classList.toggle('is-solved', solved);
    traceEls.forEach((t, i) => t.classList.toggle('is-live', live && s.powered.has(i)));
    root.querySelectorAll<HTMLButtonElement>('.cw-hint:not(.cw-hint--clues)').forEach((b) => { b.disabled = solved; });
  }

  let lastSay = '';
  const say = (t: string) => { const el = out('say'); el.textContent = t === lastSay ? `${t} ` : t; lastSay = el.textContent; };
  const announceCell = () => {
    if (!session) return;
    const { s } = session;
    const k = s.entry.cells.indexOf(s.cell) + 1;
    say(`${entryName(s.entry)}, ${s.entry.answer.length} letters: ${s.entry.clue}. Square ${k}${s.fill[s.cell] ? `, ${s.fill[s.cell]}` : ', empty'}.`);
  };

  // Circuit traces leave the board from each answer: across answers from the left
  // (or right, for a second answer in the row), down answers from the top (or bottom).
  function buildTraces() {
    if (!session) return;
    const { p } = session;
    const cell = Number(boardEl.style.getPropertyValue('--cell').replace('px', '')) || 40;
    const m = Number(boardEl.style.getPropertyValue('--m').replace('px', '')) || 20;
    const W = p.cols * cell + 2 * m, H = p.rows * cell + 2 * m;
    tracesEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const ns = 'http://www.w3.org/2000/svg';
    const used = new Map<string, number>();
    traceEls = p.entries.map((e) => {
      const first = p.cells[e.cells[0]], last = p.cells[e.cells[e.cells.length - 1]];
      const lineKey = e.dir === 'across' ? `r${first.r}` : `c${first.c}`;
      const nth = used.get(lineKey) ?? 0; used.set(lineKey, nth + 1);
      const jog = Math.min(m * 0.45, cell * 0.3) * (e.num % 2 ? 1 : -1);
      let d: string, end: [number, number];
      if (e.dir === 'across') {
        const y = m + first.r * cell + cell / 2;
        if (nth === 0) { const x0 = m + first.c * cell; d = `M${x0} ${y}H${m * 0.55}L${m * 0.3} ${y + jog}H2`; end = [m * 0.3, y + jog]; }
        else { const x0 = m + (last.c + 1) * cell; d = `M${x0} ${y}H${W - m * 0.55}L${W - m * 0.3} ${y + jog}H${W - 2}`; end = [W - m * 0.3, y + jog]; }
      } else {
        const x = m + first.c * cell + cell / 2;
        if (nth === 0) { const y0 = m + first.r * cell; d = `M${x} ${y0}V${m * 0.55}L${x + jog} ${m * 0.3}V2`; end = [x + jog, m * 0.3]; }
        else { const y0 = m + (last.r + 1) * cell; d = `M${x} ${y0}V${H - m * 0.55}L${x + jog} ${H - m * 0.3}V${H - 2}`; end = [x + jog, H - m * 0.3]; }
      }
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'cw-trace');
      const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d);
      const pulse = document.createElementNS(ns, 'path'); pulse.setAttribute('d', d); pulse.setAttribute('class', 'cw-trace__pulse');
      const dot = document.createElementNS(ns, 'circle'); dot.setAttribute('cx', String(end[0])); dot.setAttribute('cy', String(end[1])); dot.setAttribute('r', String(Math.max(2, m * 0.1)));
      g.append(path, pulse, dot);
      return g;
    });
    const frame = document.createElementNS(ns, 'rect');
    frame.setAttribute('class', 'cw-frame');
    frame.setAttribute('x', String(m - 3)); frame.setAttribute('y', String(m - 3));
    frame.setAttribute('width', String(p.cols * cell + 6)); frame.setAttribute('height', String(p.rows * cell + 6)); frame.setAttribute('rx', '4');
    tracesEl.replaceChildren(frame, ...traceEls);
    render();
  }
  const pulse = (entry: number) => {
    if (!session || reduced()) return;
    session.p.entries[entry].cells.forEach((i, k) => {
      const el = cellEls[i];
      el.style.setProperty('--d', `${k * 45}ms`);
      el.classList.remove('is-pulse'); void el.offsetWidth; el.classList.add('is-pulse');
    });
  };

  // ── Terminal log (no answers ever appear here) ──────────────────────
  const termEl = out('term');
  const term = (msg: string, kind = '') => {
    const li = document.createElement('li');
    li.textContent = `> ${msg}`;
    if (kind) li.className = `is-${kind}`;
    termEl.append(li);
    while (termEl.children.length > 5) termEl.firstElementChild!.remove();
  };
  const termReset = (msg: string) => { termEl.replaceChildren(); term(msg); term('awaiting input'); };

  // ── Completion ──────────────────────────────────────────────────────
  function finish() {
    if (!session) return;
    const ses = session;
    ses.clock.stop();
    ses.finished = true;
    persist();
    const ms = Math.round(ses.clock.ms);
    const pts = score(ses.p, ms, ses.s.hints).total;
    const key = ses.kind === 'daily' ? `daily-${ses.dailyN}` : ses.def.id;
    const beat = store.finish(key, ms, ses.s.hints, pts);
    term('all links up. SYSTEM RESTORED', 'ok');
    let tag = ses.kind === 'daily' ? `Daily Circuit #${ses.dailyN} restored` : 'Circuit restored';
    if (ses.kind === 'campaign') {
      const where = locate(ses.def.id);
      const solved = solvedIds();
      if (where.kind === 'campaign' && sectorDone(where.sector, solved)) {
        tag = campaignDone(solved) ? 'Mainframe online. Campaign complete' : `${where.sector.name}: sector online`;
        sfx('sector');
      } else sfx('solved');
    } else sfx('solved');
    setText('done-tag', tag);
    const news: string[] = [];
    const rec = store.data.records[key];
    if (rec.solves > 1 && beat.best) news.push('New best time');
    if (rec.solves > 1 && beat.clean && ses.s.hints === 0) news.push('New best without hints');
    if (rec.solves > 1 && beat.score) news.push('New high score');
    setText('d-new', news.join(' · '));
    if (!reduced()) { root.classList.remove('is-restoring'); void root.offsetWidth; root.classList.add('is-restoring'); }
    window.setTimeout(() => showDone(true), reduced() ? 0 : 900);
  }

  function showDone(fresh: boolean) {
    if (!session) return;
    const ses = session;
    const ms = Math.round(ses.clock.ms);
    const sc = score(ses.p, ms, ses.s.hints);
    if (!fresh) { setText('done-tag', ses.kind === 'daily' ? `Daily Circuit #${ses.dailyN}: solved` : 'Already solved'); setText('d-new', ''); }
    setText('d-time', fmtClock(ms));
    setText('d-hints', ses.s.hints ? `${ses.s.hints} (assisted)` : '0 (unassisted)');
    setText('d-words', `${ses.p.entries.length} of ${ses.p.entries.length}`);
    setText('d-score', sc.total.toLocaleString('en-US'));
    setText('d-working', `${ses.p.entries.length} answers × 100 = ${sc.words}, + ${sc.speed} speed bonus (par ${fmtClock(sc.par * 1000)})${ses.s.hints ? `, × ${Math.round(sc.mult * 100)}% for ${ses.s.hints} hint${ses.s.hints > 1 ? 's' : ''}` : ''}.`);
    const nx = nextPuzzle();
    setText('d-next', nx ? 'Next puzzle' : ses.kind === 'campaign' ? 'Network map' : 'Menu');
    setText('share-status', '');
    doneEl.hidden = false;
    requestAnimationFrame(() => $('#cw-h-done').focus({ preventScroll: true }));
  }

  function nextPuzzle(): string | null {
    if (!session) return null;
    const solved = solvedIds();
    if (session.kind === 'library') {
      const k = LIBRARY.findIndex((d) => d.id === session!.def.id);
      const order = [...LIBRARY.slice(k + 1), ...LIBRARY.slice(0, k)];
      return order.find((d) => !solved.has(d.id))?.id ?? null;
    }
    if (session.kind === 'campaign') {
      for (const sec of SECTORS) if (sectorOpen(sec, solved)) { const d = sec.puzzles.find((x) => !solved.has(x.id)); if (d) return d.id; }
    }
    return null;
  }

  const shareText = () => {
    if (!session) return '';
    const ses = session;
    const name = ses.kind === 'daily' ? `Daily Circuit #${ses.dailyN}` : ses.def.title;
    return `CROSS//WIRE\n${name}\nCompleted in ${fmtClock(Math.round(ses.clock.ms))}\nHints: ${ses.s.hints}\nSystem Restored\n\n${new URL('/arcade/cross-wire/', location.origin).href}`;
  };

  // ── Hint menu and clue drawer (small screens) ───────────────────────
  const hintsEl = $('[data-hints]'), hintBtn = $('[data-do="hints"]');
  function closeHints() { hintsEl.classList.remove('is-open'); hintBtn.setAttribute('aria-expanded', 'false'); }

  const clueBtn = $('[data-do="clues"]');
  function openClues() { cluesEl.classList.add('is-open'); clueBtn.setAttribute('aria-expanded', 'true'); requestAnimationFrame(() => cluesEl.querySelector<HTMLElement>('.cw-clue.is-cur')?.focus()); }
  function closeClues() { if (!cluesEl.classList.contains('is-open')) return; cluesEl.classList.remove('is-open'); clueBtn.setAttribute('aria-expanded', 'false'); }

  // ── Actions ─────────────────────────────────────────────────────────
  const act = async (name: string) => {
    const ses = session;
    switch (name) {
      case 'prev': ses?.s.nextEntry(-1); announceCell(); break;
      case 'next': ses?.s.nextEntry(1); announceCell(); break;
      case 'dir': ses?.s.toggleDir(); announceCell(); break;
      case 'check': closeHints(); ses?.s.checkWord(); break;
      case 'reveal-letter': closeHints(); ses?.s.revealLetter(); break;
      case 'reveal-word': closeHints(); ses?.s.revealWord(); break;
      case 'clear': closeHints(); ses?.s.clearWord(); break;
      case 'clues': closeHints(); if (cluesEl.classList.contains('is-open')) closeClues(); else openClues(); return;
      case 'hints': if (hintsEl.classList.contains('is-open')) closeHints(); else { hintsEl.classList.add('is-open'); hintBtn.setAttribute('aria-expanded', 'true'); } return;
      case 'clues-close': closeClues(); clueBtn.focus(); return;
      case 'leave': location.hash = out('back').getAttribute('href')!.slice(1); return;
      case 'done-close': doneEl.hidden = true; gridEl.focus({ preventScroll: true }); return;
      case 'replay': if (ses) { delete store.data[ses.kind === 'daily' ? 'daily' : 'solves'][ses.kind === 'daily' ? String(ses.dailyN) : ses.def.id]; store.write(); doneEl.hidden = true; start(ses.kind, ses.def, ses.dailyN, true); } return;
      case 'next-puzzle': { const nx = nextPuzzle(); location.hash = nx ? `#/play/${nx}` : ses?.kind === 'campaign' ? '#/campaign' : '#/'; return; }
      case 'share': {
        const text = shareText();
        try {
          if (navigator.share && coarse.matches) { await navigator.share({ title: 'CROSS//WIRE', text }); return; }
          await navigator.clipboard.writeText(text);
          setText('share-status', 'Result copied. No answers included.');
        } catch (e) { if ((e as DOMException)?.name !== 'AbortError') setText('share-status', text); }
        return;
      }
      case 'reset': out('reset-confirm').hidden = false; $('[data-do="reset-no"]').focus(); return;
      case 'reset-no': out('reset-confirm').hidden = true; $('[data-do="reset"]').focus(); return;
      case 'reset-yes': store.reset(); out('reset-confirm').hidden = true; renderSettings(); setText('share-status', ''); $('[data-do="reset"]').focus(); return;
    }
  };
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const b = t.closest<HTMLElement>('[data-do]');
    if (b) { void act(b.dataset.do!); return; }
    const clue = t.closest<HTMLElement>('[data-entry]');
    if (clue && session) { session.s.selectEntry(Number(clue.dataset.entry)); if (cluesEl.classList.contains('is-open')) closeClues(); gridEl.focus({ preventScroll: true }); announceCell(); return; }
    const key = t.closest<HTMLElement>('[data-key]');
    if (key && session) {
      const k = key.dataset.key!;
      if (k === 'back') session.s.backspace(); else if (k === 'dir') session.s.toggleDir(); else session.s.type(k);
    }
  });
  // Keep focus on the grid while the on-screen keyboard and clue bar are used.
  root.querySelectorAll<HTMLElement>('[data-kbd], .cw-active').forEach((el) => el.addEventListener('pointerdown', (e) => { if ((e as PointerEvent).pointerType !== 'mouse' || el.matches('[data-kbd]')) e.preventDefault(); }));

  gridEl.addEventListener('pointerdown', (e) => {
    closeHints();
    const c = (e.target as HTMLElement).closest<HTMLElement>('.cw-cell');
    if (!c || !session) return;
    e.preventDefault();
    gridEl.focus({ preventScroll: true });
    session.s.select(Number(c.dataset.i));
    announceCell();
  });

  // Keys: only while the puzzle view has focus, so the rest of the page behaves normally.
  $('[data-view-el="play"]').addEventListener('keydown', (e) => {
    if (!session || e.ctrlKey || e.metaKey || e.altKey) return;
    const s = session.s;
    const inGrid = e.target === gridEl;
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); if (hintsEl.classList.contains('is-open')) { closeHints(); hintBtn.focus(); } else if (cluesEl.classList.contains('is-open')) { closeClues(); clueBtn.focus(); } else if (!doneEl.hidden) void act('done-close'); else void act('leave'); return; }
    if (!doneEl.hidden) return;
    if (/^[a-zA-Z]$/.test(k)) { e.preventDefault(); if (!inGrid) gridEl.focus({ preventScroll: true }); s.type(k); return; }
    if (!inGrid) return;
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[k]) { e.preventDefault(); s.arrow(...moves[k]); announceCell(); }
    else if (k === 'Backspace') { e.preventDefault(); s.backspace(); }
    else if (k === 'Delete') { e.preventDefault(); s.del(); }
    else if (k === ' ') { e.preventDefault(); s.toggleDir(); announceCell(); }
    else if (k === 'Enter') { e.preventDefault(); s.nextEntry(e.shiftKey ? -1 : 1); announceCell(); }
  });
  gridEl.addEventListener('focus', () => { if (session && view === 'play') announceCell(); });

  // ── Settings and records ────────────────────────────────────────────
  const syncToggles = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) => {
      const on = settings[b.dataset.toggle as 'sound' | 'music'];
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('[data-state]')!.textContent = on ? 'on' : 'off';
    });
    root.querySelectorAll<HTMLInputElement>('[data-setting]').forEach((i) => { i.checked = settings[i.dataset.setting as keyof typeof settings]; });
    root.classList.toggle('no-clock', !settings.timer);
  };
  const applySetting = (k: keyof typeof settings, v: boolean) => {
    settings[k] = v;
    if (k === 'sound') audio.sfxOn = v;
    if (k === 'music') { audio.unlock(); audio.setMusic(v); }
    store.write(); syncToggles(); render();
  };
  root.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.toggle as 'sound' | 'music'; applySetting(k, !settings[k]); if (k === 'sound' && settings.sound) { audio.unlock(); sfx('select'); } }));
  root.querySelectorAll<HTMLInputElement>('[data-setting]').forEach((i) => i.addEventListener('change', () => applySetting(i.dataset.setting as keyof typeof settings, i.checked)));
  syncToggles();

  function renderSettings() {
    syncToggles();
    out('storage-warn').hidden = store.ok;
    const solved = solvedIds();
    const recs = store.data.records;
    const total = ALL.length;
    const clean = Object.entries(recs).filter(([k, r]) => !k.startsWith('daily-') && r.bestClean !== undefined).length;
    const dailies = Object.keys(recs).filter((k) => k.startsWith('daily-')).length;
    const best = Math.max(0, ...Object.values(recs).map((r) => r.bestScore ?? 0));
    const rows: [string, string][] = [
      ['Puzzles solved', `${[...solved].filter((id) => byId[id]).length} of ${total}`],
      ['Solved without hints', String(clean)],
      ['Daily Circuits solved', String(dailies)],
      ['Campaign sectors online', `${SECTORS.filter((s) => sectorDone(s, solved)).length} of ${SECTORS.length}`],
      ['Best score', best ? best.toLocaleString('en-US') : '–'],
    ];
    const fastest = ALL.filter((d) => recs[d.id]?.best !== undefined).sort((a, b) => recs[a.id].best! - recs[b.id].best!).slice(0, 3);
    for (const d of fastest) rows.push([`Fastest: ${d.title}`, `${fmtClock(recs[d.id].best!)}${recs[d.id].bestClean !== undefined ? '' : ' (with hints)'}`]);
    out('stats').replaceChildren(...rows.map(([a, b]) => { const div = document.createElement('div'); const dt = document.createElement('dt'); dt.textContent = a; const dd = document.createElement('dd'); dd.textContent = b; div.append(dt, dd); return div; }));
  }

  // ── Fullscreen, sizing, clock ───────────────────────────────────────
  const fs = $<HTMLButtonElement>('[data-fullscreen]');
  if (document.fullscreenEnabled) {
    fs.hidden = false;
    fs.addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.requestFullscreen(); } catch { /* not allowed */ } });
    document.addEventListener('fullscreenchange', () => { fs.setAttribute('aria-pressed', String(!!document.fullscreenElement)); fit(); });
  }

  let lastFit = '';
  function fit() {
    root.classList.toggle('is-portrait', innerHeight > innerWidth);
    root.classList.toggle('is-touch', coarse.matches);
    landscapeTouchPlay(root, () => view === 'play');
    if (view !== 'play' || !session) return;
    const { p } = session;
    const box = boxEl.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const cell = Math.max(22, Math.min(88, Math.floor(Math.min(box.width / (p.cols + 1.1), box.height / (p.rows + 1.1)))));
    const m = Math.max(8, Math.round(cell * 0.55));
    const key = `${p.def.id}:${cell}:${m}`;
    boardEl.style.setProperty('--cell', `${cell}px`);
    boardEl.style.setProperty('--m', `${m}px`);
    root.classList.add('is-fitted');
    if (key !== lastFit) { lastFit = key; buildTraces(); }
  }
  new ResizeObserver(() => fit()).observe(boxEl);
  addEventListener('resize', fit);
  coarse.addEventListener('change', fit);
  autoFullscreen(root);

  const clockEl = out('clock');
  setInterval(() => {
    if (session && view === 'play') clockEl.textContent = fmtClock(session.clock.ms);
    if (view === 'home') renderHome();
  }, 500);
  document.addEventListener('visibilitychange', () => {
    if (!session) return;
    if (document.visibilityState === 'hidden') { session.clock.stop(); persist(); }
    else if (view === 'play' && !session.finished) session.clock.start();
  });
  addEventListener('pagehide', () => { session?.clock.stop(); persist(); });

  // Audio unlocks on the first real interaction.
  for (const ev of ['pointerdown', 'keydown'] as const) root.addEventListener(ev, () => { audio.unlock(); }, { once: true });
  for (const ev of ['pointerdown', 'keydown'] as const) root.addEventListener(ev, () => audio.resume(), { passive: true });

  if (new URLSearchParams(location.search).has('debug')) {
    (window as unknown as { __cw: unknown }).__cw = { store, audio, get session() { return session; }, daily, dailyNumber, act, play: (def: PuzzleDef) => start('library', def, undefined, true) };
  }
  route();
}
