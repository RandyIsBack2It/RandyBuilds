// Keyboard, touch and gamepad, merged into one set of controls per frame.
// Touch buttons track each finger separately, so moving and jumping work at
// the same time; the move pad follows a finger sliding between left and right.

export interface Frame { left: boolean; right: boolean; down: boolean; jump: boolean; jumpPressed: boolean; action: boolean; actionPressed: boolean; pausePressed: boolean }

const KEYS: Record<string, keyof Held> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyK: 'jump',
  KeyE: 'action', KeyX: 'action', KeyJ: 'action', ShiftLeft: 'action', Enter: 'action',
};
interface Held { left: boolean; right: boolean; down: boolean; jump: boolean; action: boolean }

export class Input {
  private keys: Held = { left: false, right: false, down: false, jump: false, action: false };
  private touch: Held = { left: false, right: false, down: false, jump: false, action: false };
  private pad: Held = { left: false, right: false, down: false, jump: false, action: false };
  private prev = { jump: false, action: false, pause: false };
  /** Presses latch until the next read, so a tap shorter than a frame still counts. */
  private latch = { jump: false, action: false };
  private pauseQueued = false;
  private padPause = false;
  /** Game keys are swallowed (no page scrolling) only while this returns true. */
  capture = () => true;
  usedTouch = false;
  private cleanup: (() => void)[] = [];

  attach() {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat) this.pauseQueued = true; return; }
      const k = KEYS[e.code];
      if (!k || !this.capture()) return;
      // Enter on a focused button should still press it.
      if (e.code === 'Enter' && (e.target as HTMLElement)?.closest?.('button, a')) return;
      e.preventDefault();
      if (!e.repeat && (k === 'jump' || k === 'action')) this.latch[k] = true;
      this.keys[k] = true;
    };
    const up = (e: KeyboardEvent) => { const k = KEYS[e.code]; if (k) this.keys[k] = false; };
    const blur = () => { this.keys = { left: false, right: false, down: false, jump: false, action: false }; };
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', blur);
    this.cleanup.push(() => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); });
  }

  /** Touch buttons: [data-touch="pad|jump|action|pause"]. */
  bindTouch(root: HTMLElement) {
    const fingers = new Map<number, { el: HTMLElement; kind: string }>();
    const refresh = () => {
      const t: Held = { left: false, right: false, down: false, jump: false, action: false };
      for (const [, f] of fingers) {
        if (f.kind === 'jump') t.jump = true;
        if (f.kind === 'action') t.action = true;
        if (f.kind === 'left') t.left = true;
        if (f.kind === 'right') t.right = true;
        if (f.kind === 'down') t.down = true;
      }
      this.touch = t;
      for (const el of root.querySelectorAll<HTMLElement>('[data-touch]')) el.classList.remove('is-down');
      for (const [, f] of fingers) f.el.closest<HTMLElement>('[data-touch]')?.classList.add('is-down');
      root.querySelectorAll<HTMLElement>('[data-touch="pad"]').forEach((p) => {
        p.classList.toggle('is-left', t.left); p.classList.toggle('is-right', t.right);
      });
    };
    const padDir = (el: HTMLElement, x: number, y: number) => {
      const r = el.getBoundingClientRect();
      const rx = (x - r.left) / r.width, ry = (y - r.top) / r.height;
      if (ry > 0.72 && rx > 0.3 && rx < 0.7) return 'down';
      return rx < 0.5 ? 'left' : 'right';
    };
    const start = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-touch]');
      if (!el) return;
      e.preventDefault();
      this.usedTouch = true;
      const kind = el.dataset.touch!;
      if (kind === 'pause') { this.pauseQueued = true; return; }
      try { el.setPointerCapture(e.pointerId); } catch { /* not all browsers */ }
      fingers.set(e.pointerId, { el, kind: kind === 'pad' ? padDir(el, e.clientX, e.clientY) : kind });
      if (kind === 'jump' || kind === 'action') this.latch[kind] = true;
      refresh();
      if (kind === 'jump') navigator.vibrate?.(8);
    };
    const moveP = (e: PointerEvent) => {
      const f = fingers.get(e.pointerId);
      if (!f || f.el.dataset.touch !== 'pad') return;
      const k = padDir(f.el, e.clientX, e.clientY);
      if (k !== f.kind) { f.kind = k; refresh(); }
    };
    const end = (e: PointerEvent) => { if (fingers.delete(e.pointerId)) refresh(); };
    const noMenu = (e: Event) => e.preventDefault();
    root.addEventListener('pointerdown', start);
    root.addEventListener('pointermove', moveP);
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    root.addEventListener('lostpointercapture', end);
    root.addEventListener('contextmenu', noMenu);
    this.cleanup.push(() => {
      root.removeEventListener('pointerdown', start); root.removeEventListener('pointermove', moveP);
      root.removeEventListener('pointerup', end); root.removeEventListener('pointercancel', end);
      root.removeEventListener('lostpointercapture', end); root.removeEventListener('contextmenu', noMenu);
    });
    this.releaseTouch = () => { fingers.clear(); refresh(); };
  }
  releaseTouch = () => {};

  private pollPad() {
    const pads = navigator.getGamepads?.() ?? [];
    const p = [...pads].find(Boolean);
    if (!p) { this.pad = { left: false, right: false, down: false, jump: false, action: false }; this.padPause = false; return; }
    const b = (i: number) => !!p.buttons[i]?.pressed;
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
    this.pad = { left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), down: ay > 0.6 || b(13), jump: b(0) || b(1), action: b(2) || b(3) || b(5) };
    const pause = b(9);
    if (pause && !this.padPause) this.pauseQueued = true;
    this.padPause = pause;
  }

  read(): Frame {
    this.pollPad();
    const any = (k: keyof Held) => this.keys[k] || this.touch[k] || this.pad[k];
    const jump = any('jump'), action = any('action');
    const f: Frame = {
      left: any('left'), right: any('right'), down: any('down'), jump, action,
      jumpPressed: (jump && !this.prev.jump) || this.latch.jump, actionPressed: (action && !this.prev.action) || this.latch.action, pausePressed: this.pauseQueued,
    };
    this.latch.jump = false; this.latch.action = false;
    this.prev.jump = jump; this.prev.action = action;
    this.pauseQueued = false;
    return f;
  }

  /** Forget held buttons (after a pause or menu). Keeps "pressed" edges from firing. */
  reset() {
    this.keys = { left: false, right: false, down: false, jump: false, action: false };
    this.releaseTouch();
    this.prev.jump = true; this.prev.action = true;
    this.latch.jump = false; this.latch.action = false;
    this.pauseQueued = false;
  }

  detach() { for (const c of this.cleanup) c(); this.cleanup = []; }
}
