// PATCH QUEST entry point: wires the game, renderer, audio, input and menus
// to the page, runs the fixed-step loop, and pauses when the tab is hidden.
import { DT, W, H } from './config';
import { Game, fmtTime, type Mode } from './game';
import { Renderer } from './render';
import { Audio } from './audio';
import { Input } from './input';
import { landscapeTouchPlay, autoFullscreen } from './immersive';
import { load, save, record } from './storage';

export function startPatchQuest(root: HTMLElement) {
  const canvasEl = root.querySelector<HTMLCanvasElement>('canvas')!;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const screenEl = root.querySelector<HTMLElement>('.pq-screen')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saved = load(reduced);
  const audio = new Audio();
  audio.sfxOn = saved.settings.sfx;
  audio.musicOn = saved.settings.music;
  const input = new Input();
  const coarse = matchMedia('(pointer: coarse)');

  const game = new Game({
    sfx: (s) => audio.play(s),
    music: (m) => audio.music(m),
    mode: (m, prev) => onMode(m, prev),
  });
  game.shakeOn = saved.settings.shake;
  const renderer = new Renderer(canvasEl);
  renderer.reduced = reduced;
  game.particles.density = reduced ? 0.4 : 1;
  const setLabels = () => { game.actLabel = coarse.matches || input.usedTouch ? 'ACT' : 'E'; };
  setLabels();

  input.capture = () => game.mode === 'play' || game.mode === 'intro' || game.mode === 'dying';
  input.attach();
  input.bindTouch(root.querySelector<HTMLElement>('[data-touch-root]')!);

  // ── Menus ─────────────────────────────────────────────────────────────
  const screens = [...root.querySelectorAll<HTMLElement>('[data-screen]')];
  let returnTo: string | null = null;
  const show = (name: string | null) => {
    for (const s of screens) s.hidden = s.dataset.screen !== name;
    root.dataset.menu = name ?? '';
    const el = screens.find((s) => s.dataset.screen === name);
    if (el) requestAnimationFrame(() => el.querySelector<HTMLElement>('[data-focus], button')?.focus({ preventScroll: true }));
    else if (root.contains(document.activeElement) && document.activeElement !== document.body) (document.activeElement as HTMLElement).blur?.();
  };
  const text = (sel: string, value: string) => { root.querySelectorAll<HTMLElement>(sel).forEach((e) => { e.textContent = value; }); };

  function onMode(m: Mode, prev: Mode) {
    root.dataset.mode = m;
    fit();
    if (m === 'play' || m === 'intro' || m === 'dying') { show(null); input.reset(); }
    if (m === 'paused') show('paused');
    if (m === 'gameover') { text('[data-out="go-score"]', game.score.toLocaleString('en-US')); text('[data-out="go-level"]', game.level.name); show('gameover'); }
    if (m === 'clear') {
      const list = root.querySelector<HTMLElement>('[data-out="tally"]')!;
      list.replaceChildren(...game.tally.map((t) => {
        const li = document.createElement('li');
        const a = document.createElement('span'); a.textContent = t.label;
        const b = document.createElement('span'); b.textContent = t.points ? `+${t.points.toLocaleString('en-US')}` : '';
        li.append(a, b);
        return li;
      }));
      text('[data-out="clear-title"]', `${game.level.name} repaired`);
      text('[data-out="clear-score"]', game.score.toLocaleString('en-US'));
      show('clear');
    }
    if (m === 'victory') {
      const r = record(saved, game.score, game.runTime);
      text('[data-out="v-score"]', game.score.toLocaleString('en-US'));
      text('[data-out="v-time"]', fmtTime(game.runTime));
      text('[data-out="v-best"]', `${saved.best!.score.toLocaleString('en-US')} · ${fmtTime(saved.best!.time)}`);
      text('[data-out="v-new"]', r.newScore ? 'New personal best' : r.newTime ? 'New fastest time' : '');
      text('[data-out="share-status"]', '');
      showBest();
      // Let the explosion settle before the panel.
      setTimeout(() => { if (game.mode === 'victory') show('victory'); }, 900);
    }
    if (m === 'title') { show('title'); audio.music(audio.ctx ? 'title' : null); }
    void prev;
  }

  const showBest = () => {
    text('[data-out="best"]', saved.best ? `Personal best: ${saved.best.score.toLocaleString('en-US')} points · ${fmtTime(saved.best.time)}` : 'No personal best yet');
  };
  showBest();

  const actions: Record<string, () => void> = {
    play: () => { game.newRun(); },
    howto: () => { returnTo = root.dataset.menu || 'title'; show('howto'); },
    settings: () => { returnTo = root.dataset.menu || 'title'; show('settings'); },
    back: () => { show(returnTo ?? 'title'); audio.play('back'); },
    resume: () => game.resume(),
    restart: () => game.restartLevel(),
    title: () => { audio.music(null); game.setMode('title'); },
    retry: () => game.retryLevel(),
    next: () => game.nextLevel(),
    again: () => game.newRun(),
    share: () => void share(),
    pause: () => { if (game.mode === 'play' || game.mode === 'intro') game.pause(); else if (game.mode === 'paused') game.resume(); },
  };
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-do]');
    if (!b) return;
    audio.unlock();
    const a = b.dataset.do!;
    if (a !== 'back') audio.play('select');
    // The title theme starts with the first click on a menu (never on its own).
    if (game.mode === 'title' && a !== 'play') audio.music('title');
    actions[a]?.();
  });

  // Sound switches (top bar and settings stay in step).
  const toggles = [...root.querySelectorAll<HTMLButtonElement>('[data-toggle]')];
  const syncToggles = () => {
    for (const t of toggles) {
      const on = t.dataset.toggle === 'music' ? audio.musicOn : t.dataset.toggle === 'sfx' ? audio.sfxOn : game.shakeOn;
      t.setAttribute('aria-pressed', String(on));
      const state = t.querySelector('[data-state]');
      if (state) state.textContent = on ? 'on' : 'off';
    }
  };
  syncToggles();
  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-toggle]');
    if (!t) return;
    audio.unlock();
    const k = t.dataset.toggle as 'music' | 'sfx' | 'shake';
    if (k === 'music') { audio.setMusic(!audio.musicOn); if (audio.musicOn && game.mode === 'title') audio.music('title'); }
    if (k === 'sfx') audio.setSfx(!audio.sfxOn);
    if (k === 'shake') game.shakeOn = !game.shakeOn;
    saved.settings = { music: audio.musicOn, sfx: audio.sfxOn, shake: game.shakeOn };
    save(saved);
    syncToggles();
    audio.play('select');
  });

  // Share: the game's address and a plain, unverified score line.
  const share = async () => {
    const url = new URL('/arcade/patch-quest/', location.origin).href;
    const msg = `I repaired the Core in PATCH QUEST: ${game.score.toLocaleString('en-US')} points in ${fmtTime(game.runTime)} (recorded on my device).`;
    const status = (s: string) => text('[data-out="share-status"]', s);
    try {
      if (navigator.share && coarse.matches) { await navigator.share({ title: 'PATCH QUEST', text: msg, url }); return; }
      await navigator.clipboard.writeText(`${msg} ${url}`);
      status('Copied. Paste it anywhere.');
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') status(`${msg} ${url}`);
    }
  };

  // Full screen, where the browser allows it.
  const fs = root.querySelector<HTMLButtonElement>('[data-fullscreen]');
  if (fs && document.fullscreenEnabled) {
    fs.hidden = false;
    fs.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else {
          await root.requestFullscreen();
          await (window.screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => {});
        }
      } catch { /* not allowed here */ }
    });
    document.addEventListener('fullscreenchange', () => { fs.setAttribute('aria-pressed', String(!!document.fullscreenElement)); fit(); });
  }

  // ── Scaling: whole-pixel steps when they fill the space well ─────────
  // (except landscape play on a touch screen, which fills the screen)
  const PLAYING = new Set(['play', 'intro', 'dying']);
  const fit = () => {
    const portrait = innerHeight > innerWidth;
    root.classList.toggle('is-portrait', portrait);
    root.classList.toggle('is-touch', coarse.matches || input.usedTouch);
    const full = landscapeTouchPlay(root, () => PLAYING.has(root.dataset.mode ?? ''));
    const box = stage.getBoundingClientRect();
    const touchBelow = portrait && root.classList.contains('is-touch');
    const availW = box.width, availH = touchBelow ? Math.min(box.height * 0.62, availW * (H / W)) : box.height;
    let s = Math.min(availW / W, availH / H);
    if (!full && s >= 2 && Math.floor(s) / s > 0.86) s = Math.floor(s);
    s = Math.max(1, s);
    const w = Math.floor(W * s), h = Math.floor(H * s);
    root.classList.add('is-fitted');
    canvasEl.style.width = `${w}px`;
    canvasEl.style.height = `${h}px`;
    screenEl.style.width = `${w}px`;
    screenEl.style.height = `${h}px`;
    root.style.setProperty('--pq-scale', String(s));
  };
  const ro = new ResizeObserver(fit);
  ro.observe(stage);
  addEventListener('orientationchange', fit);
  coarse.addEventListener('change', () => { setLabels(); fit(); });
  root.querySelector('[data-touch-root]')!.addEventListener('pointerdown', () => { if (!root.classList.contains('is-touch')) { setLabels(); fit(); } }, { once: true });
  fit();
  autoFullscreen(root);

  // Unlock audio on the first real interaction, and wake it on any later one
  // (mobile browsers suspend audio after calls, app switches and screen locks).
  stage.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  for (const ev of ['pointerdown', 'keydown'] as const) addEventListener(ev, () => audio.resume(), { passive: true });

  // ── Loop ─────────────────────────────────────────────────────────────
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  const t0 = performance.now();
  const frame = (now: number) => {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    let steps = 0;
    while (acc >= DT && steps < 5) { game.update(DT, input.read()); acc -= DT; steps++; }
    if (steps === 5) acc = 0;
    renderer.draw(game, Math.max(0, (now - t0) / 1000));
    raf = requestAnimationFrame(frame);
  };
  const startLoop = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { game.pause(); audio.suspend(); stopLoop(); }
    else { audio.resume(); startLoop(); }
  });
  addEventListener('blur', () => { if (game.mode === 'play') game.pause(); });
  addEventListener('pagehide', () => { stopLoop(); input.detach(); ro.disconnect(); audio.close(); });

  game.setMode('title');
  startLoop();

  if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __pq: unknown }).__pq = { game, input, audio, renderer, saved };
}
