// AFTER HOURS audio: synthwave loops and cartoon effects, synthesised with
// WebAudio (no files). Silent until the player presses something; music and
// effects have separate switches and a volume, saved between visits.
import type { Sfx, Track } from './game';

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const freq = (n: string) => { const m = /^([A-G]#?)(\d)$/.exec(n); return m ? 440 * 2 ** ((NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12) : 0; };

interface Ch { wave: OscillatorType | 'noise'; vol: number; notes: string[]; cutoff?: number }
interface Song { bpm: number; ch: Ch[]; once?: boolean }

const seq = (...bars: string[]) => bars.join(' ').trim().split(/\s+/);
/** Synthwave bass: root eighths, octave bounce. */
const pump = (...roots: string[]) => roots.flatMap((r) => `${r}2 . ${r}2 . ${r}3 . ${r}2 . ${r}2 . ${r}2 . ${r}3 . ${r}2 .`.split(' '));
const chords = (...cs: string[]) => cs.flatMap((c) => [c, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
const FOUR = 'k . h . s . h . k . h . s . h h';

const SONGS: Record<Track, Song> = {
  title: { bpm: 92, ch: [
    { wave: 'sawtooth', vol: 0.05, cutoff: 1800, notes: seq('A4 - - - C5 - B4 - A4 - - - E4 - - -', 'F4 - - - A4 - G4 - F4 - E4 - D4 - - -', 'C4 - E4 - G4 - C5 - B4 - - - G4 - - -', 'G4 - B4 - D5 - - - E5 - - - - - - -') },
    { wave: 'triangle', vol: 0.2, notes: pump('A', 'F', 'C', 'G') },
    { wave: 'triangle', vol: 0.06, notes: chords('E4', 'C4', 'G4', 'D4') },
    { wave: 'noise', vol: 0.08, notes: seq('k . . . s . . h k . k . s . . h') },
  ] },
  street: { bpm: 104, ch: [
    { wave: 'sawtooth', vol: 0.045, cutoff: 2000, notes: seq('E4 . G4 . A4 - - . G4 . E4 . D4 - - .', 'E4 . G4 . B4 - A4 . G4 . E4 . G4 - - .', 'C5 . B4 . A4 - - . G4 . A4 . E4 - - .', 'D4 . E4 . G4 - - . A4 - - - - - - .') },
    { wave: 'triangle', vol: 0.2, notes: pump('E', 'E', 'C', 'D') },
    { wave: 'noise', vol: 0.08, notes: seq('k . h . s . h . k . h k s . h .') },
  ] },
  club: { bpm: 124, ch: [
    { wave: 'square', vol: 0.05, notes: seq('A5 . E5 . A5 . E5 . G5 . E5 . G5 . E5 .', 'F5 . C5 . F5 . C5 . G5 . D5 . G5 . D5 .') },
    { wave: 'sawtooth', vol: 0.18, cutoff: 900, notes: pump('A', 'A', 'F', 'G') },
    { wave: 'noise', vol: 0.1, notes: seq('k . h . k . h . k . h . k . h h') },
  ] },
  diner: { bpm: 96, ch: [
    { wave: 'triangle', vol: 0.12, notes: seq('C5 - E5 . G5 - A5 . G5 - E5 . C5 - - .', 'D5 - F5 . A5 - G5 . F5 - D5 . B4 - - .', 'E5 - G5 . C6 - B5 . A5 - G5 . E5 - - .', 'D5 - C5 . B4 - D5 . C5 - - - - - - .') },
    { wave: 'triangle', vol: 0.18, notes: seq('C3 . G3 . E3 . G3 . D3 . A3 . F3 . A3 .', 'G2 . D3 . B2 . D3 . C3 . G3 . E3 . G3 .') },
    { wave: 'noise', vol: 0.05, notes: seq('k . h h s . h h k . h h s . h h') },
  ] },
  alley: { bpm: 112, ch: [
    { wave: 'sawtooth', vol: 0.04, cutoff: 1400, notes: seq('D4 - - . F4 - - . G#4 - - . A4 - - .', 'D4 - - . F4 - - . C5 - A#4 . A4 - - .') },
    { wave: 'triangle', vol: 0.22, notes: pump('D', 'D', 'A#', 'A') },
    { wave: 'noise', vol: 0.08, notes: seq('k . . h s . k h . . k h s . h .') },
  ] },
  boss: { bpm: 140, ch: [
    { wave: 'sawtooth', vol: 0.05, cutoff: 2400, notes: seq('E5 . E5 . G5 . E5 . D5 . C5 . D5 . B4 .', 'C5 . C5 . E5 . C5 . B4 . A4 . B4 . G#4 .', 'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .', 'F5 - - - E5 - - - D#5 - - - E5 - - -') },
    { wave: 'triangle', vol: 0.22, notes: pump('E', 'A', 'F', 'E') },
    { wave: 'noise', vol: 0.1, notes: seq(FOUR) },
  ] },
  victory: { bpm: 120, once: true, ch: [
    { wave: 'square', vol: 0.07, notes: seq('C5 . E5 . G5 . C6 - - - B5 . C6 . D6 .', 'E6 - - - - - - - - - - - - - - -') },
    { wave: 'triangle', vol: 0.2, notes: seq('C3 . C3 . G3 . C4 . G3 . E3 . G3 . B3 .', 'C4 - - - - - - - - - - - - - - -') },
    { wave: 'noise', vol: 0.08, notes: seq('k . h . s . h . k . h . s . s s', 'k . . . . . . . . . . . . . . .') },
  ] },
};

export class Audio {
  ctx?: AudioContext;
  private master?: GainNode; private sfxBus?: GainNode; private musicBus?: GainNode; private noise?: AudioBuffer;
  sfxOn = true; musicOn = true; volume = 0.8;
  private song?: Song; private songName: Track | null = null; private step = 0; private next = 0; private timer?: number;

  unlock() {
    try { const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession; if (s) s.type = 'playback'; } catch { /* unsupported */ }
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(comp);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 1.6; this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 1.4; this.musicBus.connect(this.master);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const blip = this.ctx.createBufferSource(); blip.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate); blip.connect(this.ctx.destination); blip.start(0);
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }
  suspend() { if (this.ctx?.state === 'running') void this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') void this.ctx.resume(); }
  setVolume(v: number) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMusic(on: boolean) { this.musicOn = on; if (!on) this.stop(); else if (this.songName) this.music(this.songName, true); }
  setSfx(on: boolean) { this.sfxOn = on; }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0, bus = this.sfxBus, cutoff?: number) {
    if (!this.ctx || !bus) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    let node: AudioNode = o;
    if (cutoff) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); node = f; }
    node.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  private hiss(dur: number, vol: number, cut = 4000, when = 0, bus = this.sfxBus, cut2 = cut) {
    if (!this.ctx || !bus || !this.noise) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); if (cut2 !== cut) f.frequency.exponentialRampToValueAtTime(cut2, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  private arp(ns: string[], gap: number, type: OscillatorType = 'square', vol = 0.1, len = 0.1) { ns.forEach((n, i) => this.tone(type, freq(n), freq(n), len, vol, i * gap)); }

  play(name: Sfx) {
    if (!this.sfxOn || !this.ctx || this.ctx.state === 'closed') return;
    switch (name) {
      case 'jump': this.tone('square', 240, 560, 0.12, 0.07); break;
      case 'land': this.hiss(0.06, 0.1, 900); break;
      case 'step': this.hiss(0.02, 0.03, 3000); break;
      case 'swing': this.hiss(0.12, 0.08, 6000, 0, this.sfxBus, 800); break;
      case 'hit': this.tone('square', 180, 70, 0.12, 0.14); this.hiss(0.08, 0.12, 2500); break;
      case 'bigHit': this.tone('sine', 120, 40, 0.3, 0.3); this.hiss(0.15, 0.15, 1800); break;
      case 'throw': this.tone('triangle', 500, 900, 0.1, 0.07); break;
      case 'shatter': for (let i = 0; i < 4; i++) this.tone('triangle', 2400 + i * 400, 1800, 0.08, 0.04, i * 0.02); this.hiss(0.15, 0.08, 9000); break;
      case 'roll': this.hiss(0.2, 0.06, 1500, 0, this.sfxBus, 400); break;
      case 'cash': this.arp(['E6', 'G#6'], 0.05, 'square', 0.06, 0.08); break;
      case 'heal': this.arp(['C5', 'E5', 'G5'], 0.06, 'triangle', 0.16); break;
      case 'chaos': this.tone('sawtooth', 300, 900, 0.18, 0.05); this.tone('square', 450, 1350, 0.18, 0.03); break;
      case 'secret': this.arp(['C6', 'E6', 'G6', 'C7'], 0.07, 'square', 0.07, 0.15); break;
      case 'item': this.arp(['G5', 'D6'], 0.07, 'square', 0.08); break;
      case 'hurt': this.tone('sawtooth', 300, 90, 0.25, 0.1); break;
      case 'ko': this.arp(['A4', 'F4', 'D4', 'A3'], 0.13, 'square', 0.1, 0.2); break;
      case 'choice': this.arp(['E5', 'B5'], 0.08, 'triangle', 0.14); break;
      case 'decide': this.tone('square', 660, 990, 0.07, 0.07); break;
      case 'door': this.arp(['C5', 'G5', 'C6'], 0.08, 'triangle', 0.14, 0.14); break;
      case 'alert': this.arp(['A5', 'A5'], 0.09, 'square', 0.07, 0.06); break;
      case 'shove': this.tone('sawtooth', 90, 60, 0.3, 0.08); break;
      case 'buzz': for (let i = 0; i < 2; i++) this.tone('square', 180, 180, 0.12, 0.05, i * 0.18); break;
      case 'steam': this.hiss(0.6, 0.08, 7000, 0, this.sfxBus, 2000); break;
      case 'plate': this.tone('triangle', 1400, 1200, 0.1, 0.05); break;
      case 'courage': this.arp(['C5', 'G5', 'C6', 'G6'], 0.05, 'sawtooth', 0.06); break;
      case 'down': this.tone('square', 500, 120, 0.3, 0.08); this.hiss(0.25, 0.06, 3000); break;
      case 'bottle': this.tone('sine', 900, 300, 0.4, 0.05); break;
      case 'bossPop': this.tone('sine', 900, 200, 0.12, 0.2); this.hiss(0.1, 0.15, 6000); break;
      case 'bossLunge': this.tone('sawtooth', 200, 700, 0.3, 0.07); break;
      case 'bossLaugh': for (let i = 0; i < 4; i++) this.tone('square', 220 - i * 15, 180 - i * 15, 0.09, 0.07, i * 0.12); break;
      case 'disco': this.arp(['C6', 'G5'], 0.1, 'triangle', 0.08); break;
      case 'splash': this.hiss(0.4, 0.14, 3000, 0, this.sfxBus, 600); break;
      case 'bossHit': this.tone('square', 260, 80, 0.2, 0.12); break;
      case 'bossDown': for (let i = 0; i < 5; i++) this.hiss(0.4, 0.12, 3000, i * 0.25, this.sfxBus, 200); this.tone('sine', 300, 60, 2, 0.2); break;
      case 'sunrise': this.arp(['C5', 'E5', 'G5', 'C6', 'E6'], 0.12, 'triangle', 0.16, 0.4); break;
      case 'gameover': this.arp(['E4', 'D#4', 'D4', 'C#4'], 0.28, 'sawtooth', 0.07, 0.3); break;
    }
  }

  music(name: Track | null, force = false) {
    if (!force && name === this.songName && this.timer) return;
    this.stop();
    this.songName = name;
    this.song = name ? SONGS[name] : undefined;
    if (!this.song || !this.musicOn || !this.ctx) return;
    this.step = 0; this.next = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }
  private stop() { if (this.timer) { clearInterval(this.timer); this.timer = undefined; } }
  private schedule() {
    const s = this.song, c = this.ctx;
    if (!s || !c || c.state !== 'running') return;
    const stepLen = 60 / s.bpm / 4;
    const len = Math.max(...s.ch.map((x) => x.notes.length));
    while (this.next < c.currentTime + 0.15) {
      const i = this.step;
      for (const ch of s.ch) {
        const n = ch.notes[i % ch.notes.length];
        if (!n || n === '.' || n === '-') continue;
        let hold = 1; while (ch.notes[(i + hold) % ch.notes.length] === '-' && hold < 16) hold++;
        const when = this.next - c.currentTime;
        if (ch.wave === 'noise') {
          if (n === 'k') this.tone('sine', 140, 45, 0.16, ch.vol * 2.6, when, this.musicBus);
          else if (n === 's') this.hiss(0.14, ch.vol * 1.2, 4000, when, this.musicBus);
          else this.hiss(0.03, ch.vol * 0.6, 9000, when, this.musicBus);
        } else this.tone(ch.wave, freq(n), freq(n), Math.max(0.07, stepLen * hold * 0.92), ch.vol, when, this.musicBus, ch.cutoff);
      }
      this.next += stepLen; this.step++;
      if (s.once && this.step >= len) { this.stop(); return; }
    }
  }
  close() { this.stop(); void this.ctx?.close(); this.ctx = undefined; }
}
