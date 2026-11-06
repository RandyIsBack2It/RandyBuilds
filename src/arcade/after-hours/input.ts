// Keyboard, touch and gamepad for AFTER HOURS, merged per frame. Each finger
// is tracked on its own (move + jump + hit at once); quick taps are latched
// until the next game step so none are lost.
import type { Frame } from './game';

type Key = 'left' | 'right' | 'down' | 'jump' | 'attack' | 'dodge' | 'interact';
const KEYS: Record<string, Key> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  KeyJ: 'attack', KeyZ: 'attack', KeyF: 'attack',
  KeyK: 'dodge', KeyX: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge',
  KeyE: 'interact', KeyQ: 'interact',
};
const PRESS: Key[] = ['jump', 'attack', 'dodge', 'interact'];
const empty = (): Record<Key, boolean> => ({ left: false, right: false, down: false, jump: false, attack: false, dodge: false, interact: false });

export class Input {
  private keys = empty(); private touch = empty(); private pad = empty();
  private prev = empty();
  private latch: Partial<Record<Key, boolean>> = {};
  private pauseQueued = false; private choice = 0; private padPause = false;
  capture = () => true;
  usedTouch = false;
  private off: (() => void)[] = [];
  releaseTouch = () => {};

  attach() {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat) this.pauseQueued = true; return; }
      if (/^Digit[1-3]$|^Numpad[1-3]$/.test(e.code) && !e.repeat) { this.choice = Number(e.code.slice(-1)); }
      const k = KEYS[e.code];
      if (!k || !this.capture()) return;
      e.preventDefault();
      if (!e.repeat && PRESS.includes(k)) this.latch[k] = true;
      this.keys[k] = true;
    };
    const up = (e: KeyboardEvent) => { const k = KEYS[e.code]; if (k) this.keys[k] = false; };
    const blur = () => { this.keys = empty(); };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    this.off.push(() => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); });
  }

  /** Touch controls: [data-touch="pad|jump|attack|dodge|interact|pause"]. */
  bindTouch(root: HTMLElement) {
    const fingers = new Map<number, { el: HTMLElement; kind: string }>();
    const refresh = () => {
      const t = empty();
      for (const [, f] of fingers) if (f.kind in t) t[f.kind as Key] = true;
      this.touch = t;
      root.querySelectorAll<HTMLElement>('[data-touch]').forEach((el) => el.classList.remove('is-down'));
      for (const [, f] of fingers) f.el.classList.add('is-down');
      root.querySelectorAll<HTMLElement>('[data-touch="pad"]').forEach((p) => { p.classList.toggle('is-left', t.left); p.classList.toggle('is-right', t.right); });
    };
    const dir = (el: HTMLElement, x: number) => { const r = el.getBoundingClientRect(); return x - r.left < r.width / 2 ? 'left' : 'right'; };
    const start = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-touch]');
      if (!el) return;
      e.preventDefault();
      this.usedTouch = true;
      const kind = el.dataset.touch!;
      if (kind === 'pause') { this.pauseQueued = true; return; }
      try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
      const k = kind === 'pad' ? dir(el, e.clientX) : kind;
      fingers.set(e.pointerId, { el, kind: k });
      if (PRESS.includes(k as Key)) this.latch[k as Key] = true;
      refresh();
    };
    const move = (e: PointerEvent) => { const f = fingers.get(e.pointerId); if (f && f.el.dataset.touch === 'pad') { const k = dir(f.el, e.clientX); if (k !== f.kind) { f.kind = k; refresh(); } } };
    const end = (e: PointerEvent) => { if (fingers.delete(e.pointerId)) refresh(); };
    const noMenu = (e: Event) => e.preventDefault();
    root.addEventListener('pointerdown', start); root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end); root.addEventListener('lostpointercapture', end);
    root.addEventListener('contextmenu', noMenu);
    this.releaseTouch = () => { fingers.clear(); refresh(); };
    this.off.push(() => {
      root.removeEventListener('pointerdown', start); root.removeEventListener('pointermove', move); root.removeEventListener('pointerup', end);
      root.removeEventListener('pointercancel', end); root.removeEventListener('lostpointercapture', end); root.removeEventListener('contextmenu', noMenu);
    });
  }

  /** A decision button on screen (1–3). */
  pick(n: number) { this.choice = n; }

  private pollPad() {
    const p = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    if (!p) { this.pad = empty(); this.padPause = false; return; }
    const b = (i: number) => !!p.buttons[i]?.pressed;
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
    this.pad = { left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), down: ay > 0.6 || b(13), jump: b(0), attack: b(2), dodge: b(1) || b(5), interact: b(3) };
    if (b(9) && !this.padPause) this.pauseQueued = true;
    this.padPause = b(9);
  }

  read(): Frame {
    this.pollPad();
    const any = (k: Key) => this.keys[k] || this.touch[k] || this.pad[k];
    const pressed = (k: Key) => (any(k) && !this.prev[k]) || !!this.latch[k];
    const f: Frame = {
      left: any('left'), right: any('right'), down: any('down'), jump: any('jump'),
      jumpPressed: pressed('jump'), attackPressed: pressed('attack'), dodgePressed: pressed('dodge'), interactPressed: pressed('interact'),
      pausePressed: this.pauseQueued, choice: this.choice,
    };
    for (const k of PRESS) this.prev[k] = any(k);
    this.latch = {}; this.pauseQueued = false; this.choice = 0;
    return f;
  }

  reset() { this.keys = empty(); this.releaseTouch(); for (const k of PRESS) this.prev[k] = true; this.latch = {}; this.pauseQueued = false; this.choice = 0; }
  detach() { for (const o of this.off) o(); this.off = []; }
}
