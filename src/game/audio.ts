// Chiptune audio, synthesised with WebAudio: no sound files. Nothing plays
// until the player presses a button (the AudioContext is created then), and
// music and effects each have their own switch, saved between visits.
import { TRACKS, type Track } from './music';

export type Sfx =
  | 'jump' | 'land' | 'step' | 'cell' | 'kit' | 'repair' | 'repairDone' | 'pulse' | 'hurt' | 'stomp' | 'defeat'
  | 'checkpoint' | 'open' | 'clear' | 'shoot' | 'bossShoot' | 'bossRoar' | 'bossWarn' | 'bossHit' | 'explode'
  | 'shield' | 'slam' | 'select' | 'back' | 'die' | 'fixTurret';

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export const freq = (n: string) => {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) return 0;
  return 440 * 2 ** ((NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
};

export class Audio {
  ctx?: AudioContext;
  private master?: GainNode;
  private sfxBus?: GainNode;
  private musicBus?: GainNode;
  private noise?: AudioBuffer;
  sfxOn = true;
  musicOn = true;
  private track?: Track;
  private step = 0;
  private nextTime = 0;
  private timer?: number;

  /** Call from a user gesture (click, tap or key). */
  unlock() {
    // iPhone: without this, the ring/silent switch mutes Web Audio (iOS 17+).
    try { const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession; if (s) s.type = 'playback'; } catch { /* not supported */ }
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // A compressor keeps the louder mix from clipping.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(comp);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 1.8; this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 1.5; this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    // Some mobile browsers only fully unlock once a sound starts inside the gesture.
    const blip = this.ctx.createBufferSource();
    blip.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    blip.connect(this.ctx.destination);
    blip.start(0);
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  suspend() { if (this.ctx?.state === 'running') void this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') void this.ctx.resume(); }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!on) this.stopLoop(); else if (this.track) this.music(this.track.name, true);
  }
  setSfx(on: boolean) { this.sfxOn = on; }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0, bus = this.sfxBus) {
    if (!this.ctx || !bus) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    // Hold the note, then release: a pure fade from the start sounds thin and quiet.
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  private hiss(dur: number, vol: number, cutoff = 4000, when = 0, bus = this.sfxBus, f1 = cutoff) {
    if (!this.ctx || !bus || !this.noise) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    if (f1 !== cutoff) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  private arp(notes: string[], gap: number, type: OscillatorType = 'square', vol = 0.12, len = 0.1) {
    notes.forEach((n, i) => this.tone(type, freq(n), freq(n), len, vol, i * gap));
  }

  play(name: Sfx) {
    if (!this.sfxOn || !this.ctx || this.ctx.state === 'closed') return;
    switch (name) {
      case 'jump': this.tone('square', 260, 620, 0.13, 0.09); break;
      case 'land': this.hiss(0.07, 0.12, 900); break;
      case 'step': this.hiss(0.025, 0.035, 2200); break;
      case 'cell': this.arp(['E6', 'B6'], 0.055, 'square', 0.08, 0.08); break;
      case 'kit': this.arp(['C5', 'E5', 'G5', 'C6'], 0.06, 'triangle', 0.18); break;
      case 'repair': this.tone('sawtooth', 180, 520, 0.75, 0.05); this.hiss(0.75, 0.03, 6000, 0, this.sfxBus, 1500); break;
      case 'repairDone': this.arp(['C5', 'G5', 'C6', 'E6', 'G6'], 0.06, 'square', 0.1, 0.12); break;
      case 'pulse': this.tone('sawtooth', 900, 140, 0.22, 0.08); this.tone('sine', 120, 60, 0.2, 0.2); break;
      case 'hurt': this.tone('square', 240, 70, 0.28, 0.12); this.hiss(0.2, 0.1, 3000); break;
      case 'stomp': this.tone('square', 520, 160, 0.12, 0.1); break;
      case 'defeat': this.hiss(0.25, 0.12, 5000, 0, this.sfxBus, 400); this.tone('square', 700, 90, 0.25, 0.06); break;
      case 'fixTurret': this.arp(['A4', 'E5', 'A5'], 0.05, 'square', 0.08); break;
      case 'checkpoint': this.arp(['G5', 'D6', 'G6'], 0.07, 'triangle', 0.18, 0.14); break;
      case 'open': this.arp(['C5', 'E5', 'G5', 'B5', 'D6'], 0.07, 'square', 0.08, 0.14); break;
      case 'clear': this.arp(['G4', 'C5', 'E5', 'G5', 'E5', 'G5', 'C6'], 0.11, 'square', 0.1, 0.16); this.arp(['C3', 'G3', 'C4'], 0.25, 'triangle', 0.2, 0.3); break;
      case 'shoot': this.tone('square', 900, 400, 0.08, 0.05); break;
      case 'bossShoot': this.tone('sawtooth', 500, 200, 0.18, 0.06); break;
      case 'bossRoar': this.tone('sawtooth', 90, 45, 1.1, 0.14); this.hiss(1.1, 0.08, 800, 0, this.sfxBus, 200); break;
      case 'bossWarn': this.arp(['A5', 'A4', 'A5', 'A4'], 0.12, 'square', 0.07); break;
      case 'bossHit': this.tone('square', 300, 60, 0.35, 0.12); this.hiss(0.3, 0.12, 6000, 0, this.sfxBus, 500); break;
      case 'shield': this.tone('triangle', 1200, 200, 0.6, 0.14); break;
      case 'slam': this.tone('sine', 110, 35, 0.45, 0.35); this.hiss(0.4, 0.18, 1200, 0, this.sfxBus, 150); break;
      case 'explode': for (let i = 0; i < 6; i++) this.hiss(0.5, 0.16, 3000, i * 0.35, this.sfxBus, 120); this.tone('sine', 90, 30, 2.4, 0.3); break;
      case 'die': this.arp(['E5', 'C5', 'A4', 'E4'], 0.1, 'square', 0.1, 0.14); break;
      case 'select': this.tone('square', 660, 990, 0.06, 0.06); break;
      case 'back': this.tone('square', 660, 440, 0.06, 0.06); break;
    }
  }

  // ── Music: a step sequencer with lookahead scheduling ─────────────────
  music(name: keyof typeof TRACKS | null, force = false) {
    const next = name ? TRACKS[name] : undefined;
    if (!force && next === this.track && this.timer) return;
    this.stopLoop();
    this.track = next;
    if (!next || !this.musicOn || !this.ctx) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }
  private stopLoop() { if (this.timer) { clearInterval(this.timer); this.timer = undefined; } }

  private schedule() {
    const tr = this.track, c = this.ctx;
    if (!tr || !c || c.state !== 'running') return;
    const stepLen = 60 / tr.bpm / 4;
    while (this.nextTime < c.currentTime + 0.15) {
      const i = this.step % tr.length;
      for (const ch of tr.channels) {
        const n = ch.notes[i % ch.notes.length];
        if (!n || n === '.' || n === '-') continue;
        let len = 1;
        while (ch.notes[(i + len) % ch.notes.length] === '-' && len < 16) len++;
        const when = this.nextTime - c.currentTime;
        if (ch.wave === 'noise') {
          if (n === 'k') { this.tone('sine', 150, 40, 0.14, ch.vol * 2.2, when, this.musicBus); }
          else if (n === 's') this.hiss(0.12, ch.vol, 3500, when, this.musicBus);
          else this.hiss(0.03, ch.vol * 0.5, 9000, when, this.musicBus);
        } else {
          const f = freq(n);
          this.tone(ch.wave, f, f, Math.max(0.06, stepLen * len * 0.92), ch.vol, when, this.musicBus);
        }
      }
      this.nextTime += stepLen;
      this.step++;
      if (tr.once && this.step >= tr.length) { this.stopLoop(); return; }
    }
  }

  close() { this.stopLoop(); void this.ctx?.close(); this.ctx = undefined; }
}
