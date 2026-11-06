// AFTER HOURS entry point: wires the game, renderer, audio, input and the
// DOM menus (advisory, decisions, results) to the page, and runs the loop.
import { DT, W, H } from './config';
import { Game, ACHIEVEMENTS, fmtTime, type Mode } from './game';
import { Renderer } from './render';
import { Audio } from './audio';
import { Input } from './input';
import { landscapeTouchPlay, autoFullscreen } from '../../game/immersive';

const KEY = 'after-hours-v1';
interface Saved { best: { score: number; time: number } | null; achievements: string[]; settings: { music: boolean; sfx: boolean; volume: number; shake: boolean; timer: boolean } }

function load(reduced: boolean): Saved {
  const base: Saved = { best: null, achievements: [], settings: { music: true, sfx: true, volume: 0.8, shake: !reduced, timer: true } };
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!r || typeof r !== 'object') return base;
    const st = r.settings ?? {};
    return {
      best: r.best && Number.isFinite(r.best.score) ? { score: r.best.score, time: r.best.time } : null,
      achievements: Array.isArray(r.achievements) ? r.achievements.filter((a: unknown) => typeof a === 'string') : [],
      settings: {
        music: st.music !== false, sfx: st.sfx !== false, volume: Number.isFinite(st.volume) ? Math.min(1, Math.max(0, st.volume)) : 0.8,
        shake: typeof st.shake === 'boolean' ? st.shake : base.settings.shake, timer: st.timer !== false,
      },
    };
  } catch { return base; }
}
const save = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } };

export function startAfterHours(root: HTMLElement) {
  const canvasEl = root.querySelector<HTMLCanvasElement>('canvas')!;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const screenEl = root.querySelector<HTMLElement>('.ah-screen')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)');
  const saved = load(reduced);
  const audio = new Audio();
  audio.sfxOn = saved.settings.sfx; audio.musicOn = saved.settings.music; audio.volume = saved.settings.volume;
  const input = new Input();
  const game = new Game({ sfx: (s) => audio.play(s), music: (m) => audio.music(m), mode: (m, p) => onMode(m, p) });
  game.shakeOn = saved.settings.shake;
  game.decisionTime = saved.settings.timer ? 9 : 0;
  game.unlocked = new Set(saved.achievements);
  const renderer = new Renderer(canvasEl);
  renderer.reduced = reduced;
  game.particles.density = reduced ? 0.4 : 1;

  input.capture = () => game.mode === 'play' || game.mode === 'intro' || game.mode === 'dying';
  input.attach();
  input.bindTouch(root.querySelector<HTMLElement>('[data-touch-root]')!);

  // ── Menus ──────────────────────────────────────────────────────────
  const screens = [...root.querySelectorAll<HTMLElement>('[data-screen]')];
  let returnTo = 'title';
  const show = (name: string | null) => {
    for (const s of screens) s.hidden = s.dataset.screen !== name;
    root.dataset.menu = name ?? '';
    const el = screens.find((s) => s.dataset.screen === name);
    if (el) requestAnimationFrame(() => el.querySelector<HTMLElement>('[data-focus], button')?.focus({ preventScroll: true }));
    else if (root.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur?.();
  };
  const out = (name: string, value: string) => root.querySelectorAll<HTMLElement>(`[data-out="${name}"]`).forEach((e) => { e.textContent = value; });
  const list = (name: string, items: string[]) => {
    const ul = root.querySelector<HTMLElement>(`[data-out="${name}"]`)!;
    ul.replaceChildren(...items.map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
  };
  const showBest = () => out('best', saved.best ? `Best: ${saved.best.score.toLocaleString('en-US')} · ${fmtTime(saved.best.time)}` : 'No best score yet. Tonight could be the night.');
  const renderAchievements = () => {
    const ul = root.querySelector<HTMLElement>('[data-out="achievements"]')!;
    ul.replaceChildren(...ACHIEVEMENTS.map((a) => {
      const li = document.createElement('li');
      const got = saved.achievements.includes(a.id);
      li.className = got ? 'is-got' : '';
      const t = document.createElement('b'); t.textContent = got ? a.title : `${a.title} (locked)`;
      const d = document.createElement('span'); d.textContent = a.how;
      li.append(t, d);
      return li;
    }));
    out('ach-count', `${saved.achievements.length} of ${ACHIEVEMENTS.length} unlocked`);
  };
  showBest(); renderAchievements();

  // The decision dialog
  const choiceEl = root.querySelector<HTMLElement>('[data-screen="choice"]')!;
  const timerBar = root.querySelector<HTMLElement>('[data-out="timer"]')!;
  const openChoice = () => {
    const c = game.choice!;
    out('speaker', c.enc.speaker);
    out('prompt', game.prompt());
    choiceEl.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b, i) => { b.querySelector('span')!.textContent = c.enc.options[i].label; });
    timerBar.parentElement!.hidden = game.decisionTime <= 0;
    show('choice');
  };

  function onMode(m: Mode, prev: Mode) {
    root.dataset.mode = m;
    fit();
    if (m === 'play' || m === 'intro' || m === 'dying') { show(null); input.reset(); }
    if (m === 'choice') openChoice();
    if (m === 'paused') show('paused');
    if (m === 'zoneclear') { out('clear-title', `${game.zone.name}: survived`); out('clear-score', game.score.toLocaleString('en-US')); out('clear-chaos', String(game.chaos)); out('clear-cash', `$${game.cash}`); show('zoneclear'); }
    if (m === 'gameover' || m === 'victory') {
      const r = game.results!;
      const fresh = r.earned.filter((id) => !saved.achievements.includes(id));
      saved.achievements.push(...fresh);
      if (m === 'victory' && (!saved.best || r.score > saved.best.score)) saved.best = { score: r.score, time: r.time };
      save(saved); showBest(); renderAchievements();
      const names = (ids: string[]) => ids.map((id) => ACHIEVEMENTS.find((a) => a.id === id)!.title);
      if (m === 'gameover') {
        out('go-line', r.gameOver ?? ''); out('go-score', r.score.toLocaleString('en-US')); out('go-area', game.zone.name);
        list('go-new', names(fresh).map((n) => `Unlocked: ${n}`));
        show('gameover');
      } else {
        out('v-title', r.ending.title); out('v-text', r.ending.text);
        out('v-score', r.score.toLocaleString('en-US')); out('v-time', fmtTime(r.time)); out('v-chaos', String(r.chaos));
        out('v-best', saved.best ? saved.best.score.toLocaleString('en-US') : '–');
        list('v-new', names(fresh).map((n) => `Unlocked: ${n}`));
        list('v-choices', r.choices.map((c) => `${c.speaker}: ${c.label}`));
        out('share-status', '');
        setTimeout(() => { if (game.mode === 'victory') show('victory'); }, 600);
      }
    }
    if (m === 'title') { show('title'); audio.music(audio.ctx ? 'title' : null); }
    void prev;
  }

  const actions: Record<string, () => void> = {
    advisory: () => { try { sessionStorage.setItem('ah-ok', '1'); } catch { /* fine */ } game.setMode('title'); },
    play: () => game.newRun(),
    howto: () => { returnTo = root.dataset.menu || 'title'; show('howto'); },
    settings: () => { returnTo = root.dataset.menu || 'title'; show('settings'); },
    achievements: () => { returnTo = root.dataset.menu || 'title'; show('achievements'); },
    back: () => show(returnTo),
    resume: () => game.resume(),
    restart: () => game.retryZone(),
    retry: () => game.retryZone(),
    title: () => { audio.music(null); game.setMode('title'); },
    next: () => game.nextZone(),
    again: () => game.newRun(),
    share: () => void share(),
    pause: () => { if (['play', 'intro', 'choice'].includes(game.mode)) game.pause(); else if (game.mode === 'paused') game.resume(); },
  };
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const pick = t.closest<HTMLButtonElement>('[data-pick]');
    if (pick) { audio.unlock(); input.pick(Number(pick.dataset.pick)); return; }
    const b = t.closest<HTMLButtonElement>('[data-do]');
    if (!b) return;
    audio.unlock();
    const a = b.dataset.do!;
    audio.play('decide');
    if (game.mode === 'title' && a !== 'play') audio.music('title');
    actions[a]?.();
  });

  // Settings
  const toggles = [...root.querySelectorAll<HTMLButtonElement>('[data-toggle]')];
  const volume = root.querySelector<HTMLInputElement>('[data-volume]')!;
  const sync = () => {
    for (const t of toggles) {
      const k = t.dataset.toggle!;
      const on = k === 'music' ? audio.musicOn : k === 'sfx' ? audio.sfxOn : k === 'shake' ? game.shakeOn : game.decisionTime > 0;
      t.setAttribute('aria-pressed', String(on));
      const st = t.querySelector('[data-state]'); if (st) st.textContent = on ? 'on' : 'off';
    }
    volume.value = String(Math.round(audio.volume * 100));
  };
  const persist = () => { saved.settings = { music: audio.musicOn, sfx: audio.sfxOn, volume: audio.volume, shake: game.shakeOn, timer: game.decisionTime > 0 }; save(saved); sync(); };
  sync();
  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-toggle]');
    if (!t) return;
    audio.unlock();
    const k = t.dataset.toggle!;
    if (k === 'music') { audio.setMusic(!audio.musicOn); if (audio.musicOn && game.mode === 'title') audio.music('title'); }
    if (k === 'sfx') audio.setSfx(!audio.sfxOn);
    if (k === 'shake') game.shakeOn = !game.shakeOn;
    if (k === 'timer') game.decisionTime = game.decisionTime > 0 ? 0 : 9;
    persist();
    audio.play('decide');
  });
  volume.addEventListener('input', () => { audio.unlock(); audio.setVolume(Number(volume.value) / 100); persist(); });

  const share = async () => {
    const url = new URL('/arcade/after-hours/', location.origin).href;
    const r = game.results!;
    const msg = `I survived AFTER HOURS: Bad Decisions. Ending: ${r.ending.title}. ${r.score.toLocaleString('en-US')} points (recorded on my device).`;
    try {
      if (navigator.share && coarse.matches) { await navigator.share({ title: 'AFTER HOURS: Bad Decisions', text: msg, url }); return; }
      await navigator.clipboard.writeText(`${msg} ${url}`);
      out('share-status', 'Copied. Spread the bad influence.');
    } catch (e) { if ((e as DOMException)?.name !== 'AbortError') out('share-status', `${msg} ${url}`); }
  };

  // Full screen where allowed
  const fs = root.querySelector<HTMLButtonElement>('[data-fullscreen]');
  if (fs && document.fullscreenEnabled) {
    fs.hidden = false;
    fs.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else { await root.requestFullscreen(); await (window.screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => {}); }
      } catch { /* not allowed */ }
    });
    document.addEventListener('fullscreenchange', () => { fs.setAttribute('aria-pressed', String(!!document.fullscreenElement)); fit(); });
  }

  // Scaling. Landscape play on a touch screen fills the screen (no whole-pixel snapping).
  const PLAYING = new Set(['play', 'intro', 'dying', 'choice']);
  const fit = () => {
    const portrait = innerHeight > innerWidth;
    root.classList.toggle('is-portrait', portrait);
    root.classList.toggle('is-touch', coarse.matches || input.usedTouch);
    const full = landscapeTouchPlay(root, () => PLAYING.has(root.dataset.mode ?? ''));
    const box = stage.getBoundingClientRect();
    const below = portrait && root.classList.contains('is-touch');
    const availH = below ? Math.min(box.height * 0.6, box.width * (H / W)) : box.height;
    let s = Math.min(box.width / W, availH / H);
    if (!full && s >= 2 && Math.floor(s) / s > 0.86) s = Math.floor(s);
    s = Math.max(1, s);
    const w = Math.floor(W * s), h = Math.floor(H * s);
    root.classList.add('is-fitted');
    canvasEl.style.width = `${w}px`; canvasEl.style.height = `${h}px`;
    screenEl.style.width = `${w}px`; screenEl.style.height = `${h}px`;
    root.style.setProperty('--ah-scale', String(s));
  };
  const ro = new ResizeObserver(fit); ro.observe(stage);
  addEventListener('orientationchange', fit);
  coarse.addEventListener('change', fit);
  root.querySelector('[data-touch-root]')!.addEventListener('pointerdown', () => { if (!root.classList.contains('is-touch')) fit(); }, { once: true });
  fit();
  autoFullscreen(root);
  stage.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  for (const ev of ['pointerdown', 'keydown'] as const) addEventListener(ev, () => audio.resume(), { passive: true });

  // ── Loop ────────────────────────────────────────────────────────────
  const talkBtn = root.querySelector<HTMLElement>('[data-touch="interact"]')!;
  let last = performance.now(), acc = 0, raf = 0;
  const t0 = performance.now();
  const frame = (now: number) => {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    let n = 0;
    while (acc >= DT && n < 5) { game.update(DT, input.read()); acc -= DT; n++; }
    if (n === 5) acc = 0;
    if (game.choice && game.decisionTime > 0) timerBar.style.transform = `scaleX(${Math.max(0, game.choice.left / game.choice.total)})`;
    talkBtn.classList.toggle('is-shown', game.mode === 'play' && !!game.talkable());
    renderer.draw(game, Math.max(0, (now - t0) / 1000));
    raf = requestAnimationFrame(frame);
  };
  const startLoop = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { game.pause(); audio.suspend(); stopLoop(); } else { audio.resume(); startLoop(); } });
  addEventListener('blur', () => { if (game.mode === 'play') game.pause(); });
  addEventListener('pagehide', () => { stopLoop(); input.detach(); ro.disconnect(); audio.close(); });

  // Mature-humor advisory first (once per browser session).
  let ok = false;
  try { ok = sessionStorage.getItem('ah-ok') === '1'; } catch { /* fine */ }
  if (ok) game.setMode('title'); else { root.dataset.mode = 'title'; show('advisory'); }
  startLoop();

  if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __ah: unknown }).__ah = { game, input, audio, renderer, saved };
}
