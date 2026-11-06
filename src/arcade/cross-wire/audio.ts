// CROSS//WIRE audio: short synthesised effects and an optional ambient loop
// (WebAudio, no files). Silent until the player presses something.

export type Sfx = 'key' | 'erase' | 'select' | 'word' | 'check-ok' | 'check-bad' | 'hint' | 'solved' | 'sector' | 'wrong-full' | 'boot';

type Tone = [freq: number, at: number, len: number, wave?: OscillatorType, vol?: number, slideTo?: number];
const SFX: Record<Sfx, Tone[]> = {
  key: [[1320, 0, 0.035, 'square', 0.05]],
  erase: [[520, 0, 0.05, 'triangle', 0.12, 380]],
  select: [[880, 0, 0.03, 'sine', 0.1]],
  word: [[660, 0, 0.07, 'square', 0.06], [990, 0.06, 0.07, 'square', 0.06], [1320, 0.12, 0.14, 'square', 0.06], [2640, 0.12, 0.2, 'sine', 0.05, 3200]],
  'check-ok': [[880, 0, 0.08, 'triangle', 0.16], [1175, 0.08, 0.14, 'triangle', 0.16]],
  'check-bad': [[300, 0, 0.12, 'sawtooth', 0.07, 220], [240, 0.12, 0.18, 'sawtooth', 0.07, 180]],
  hint: [[1500, 0, 0.06, 'sine', 0.12, 900], [700, 0.06, 0.1, 'sine', 0.1]],
  solved: [[523, 0, 0.12, 'square', 0.06], [659, 0.1, 0.12, 'square', 0.06], [784, 0.2, 0.12, 'square', 0.06], [1047, 0.3, 0.4, 'square', 0.06],
    [262, 0, 0.6, 'triangle', 0.2], [1568, 0.42, 0.5, 'sine', 0.06, 2093]],
  sector: [[392, 0, 0.14, 'square', 0.06], [523, 0.12, 0.14, 'square', 0.06], [659, 0.24, 0.14, 'square', 0.06], [784, 0.36, 0.14, 'square', 0.06],
    [1047, 0.48, 0.7, 'square', 0.06], [196, 0, 1.1, 'triangle', 0.22]],
  'wrong-full': [[440, 0, 0.1, 'triangle', 0.14], [415, 0.1, 0.1, 'triangle', 0.14], [392, 0.2, 0.22, 'triangle', 0.14]],
  boot: [[220, 0, 0.08, 'square', 0.04, 880], [880, 0.1, 0.05, 'square', 0.04]],
};

// Ambient loop: slow minor arpeggio over a soft drone (16 steps per bar).
const ARP = ['A3', 'C4', 'E4', 'A4', 'E4', 'C4', 'F3', 'A3', 'C4', 'F4', 'C4', 'A3', 'G3', 'B3', 'D4', 'G4', 'D4', 'B3', 'E3', 'G#3', 'B3', 'E4', 'B3', 'G#3'];
const DRONE = ['A2', 'F2', 'G2', 'E2'];
const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const freq = (n: string) => { const m = /^([A-G]#?)(\d)$/.exec(n)!; return 440 * 2 ** ((NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12); };

export class Audio {
  ctx?: AudioContext;
  sfxOn = true; musicOn = false;
  master?: GainNode; private musicBus?: GainNode; private timer?: number; private step = 0; private next = 0;

  unlock() {
    try { const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession; if (s) s.type = 'playback'; } catch { /* unsupported */ }
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain(); this.master.gain.value = 1.6; this.master.connect(comp);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 1; this.musicBus.connect(this.master);
    }
    // A silent sound started inside the gesture fully unlocks audio on iOS.
    const blip = this.ctx.createBufferSource(); blip.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate); blip.connect(this.ctx.destination); blip.start(0);
    if (this.ctx.state !== 'running') void this.ctx.resume();
    if (this.musicOn) this.startMusic();
  }
  resume() { if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') void this.ctx.resume(); }

  play(name: Sfx) {
    if (!this.sfxOn || !this.ctx || !this.master) return;
    this.resume();
    const t0 = this.ctx.currentTime + 0.005;
    for (const [f, at, len, wave = 'square', vol = 0.1, slide] of SFX[name]) this.tone(f, t0 + at, len, wave, vol, this.master, slide);
  }

  private tone(f: number, t: number, len: number, wave: OscillatorType, vol: number, bus: AudioNode, slide?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol, t + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + len + 0.02);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (on && this.ctx) this.startMusic(); else this.stopMusic();
  }
  private startMusic() {
    if (this.timer !== undefined || !this.ctx) return;
    this.next = this.ctx.currentTime + 0.1;
    const spb = 60 / 84 / 2;
    const tick = () => {
      const ctx = this.ctx!;
      while (this.next < ctx.currentTime + 0.25) {
        const s = this.step++;
        this.tone(freq(ARP[s % ARP.length]), this.next, spb * 1.8, 'triangle', 0.045, this.musicBus!);
        if (s % 6 === 0) this.tone(freq(DRONE[(s / 6) % 4]), this.next, spb * 6.5, 'sine', 0.07, this.musicBus!);
        this.next += spb;
      }
    };
    tick();
    this.timer = window.setInterval(tick, 90);
  }
  private stopMusic() { if (this.timer !== undefined) { clearInterval(this.timer); this.timer = undefined; } }
}
