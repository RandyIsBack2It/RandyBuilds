// Original chiptune loops for PATCH QUEST. One token per 16th note:
// a note (C5, F#4), '-' to hold, '.' for silence; drums use k (kick),
// s (snare), h (hat).
export interface Channel { wave: OscillatorType | 'noise'; vol: number; notes: string[] }
export interface Track { name: keyof typeof TRACKS; bpm: number; length: number; channels: Channel[]; once?: boolean }

const seq = (...bars: string[]) => bars.join(' ').trim().split(/\s+/);
const bass = (pattern: string, ...roots: string[]) => roots.flatMap((r) => pattern.trim().split(/\s+/).map((t) => (t === 'R' ? `${r}3` : t === 'O' ? `${r}4` : t)));

const track = (name: Track['name'], bpm: number, channels: Channel[], once = false): Track =>
  ({ name, bpm, channels, once, length: Math.max(...channels.map((c) => c.notes.length)) });

export const TRACKS = {
  title: undefined as unknown as Track,
  boot: undefined as unknown as Track,
  city: undefined as unknown as Track,
  core: undefined as unknown as Track,
  boss: undefined as unknown as Track,
  victory: undefined as unknown as Track,
};

TRACKS.title = track('title', 100, [
  { wave: 'square', vol: 0.09, notes: seq(
    'A4 - - - C5 - E5 - D5 - - - C5 - B4 -',
    'A4 - - - E5 - - - D5 - C5 - B4 - G4 -',
    'F4 - - - A4 - C5 - B4 - - - A4 - G4 -',
    'E4 - - - G#4 - B4 - E5 - - - - - - -') },
  { wave: 'triangle', vol: 0.24, notes: bass('R . . . O . . . R . . . O . . .', 'A', 'A', 'F', 'E') },
  { wave: 'noise', vol: 0.09, notes: seq('k . h . h . h . k . h . h . h .') },
]);

TRACKS.boot = track('boot', 132, [
  { wave: 'square', vol: 0.09, notes: seq(
    'C5 . E5 . G5 . E5 . C6 - - - G5 . E5 .',
    'A4 . C5 . E5 . C5 . A5 - - - E5 . C5 .',
    'F4 . A4 . C5 . F5 . A5 - G5 - F5 . E5 .',
    'G4 . B4 . D5 . G5 . B5 - A5 - G5 . D5 .') },
  { wave: 'triangle', vol: 0.24, notes: bass('R . R . O . R . R . R . O . R .', 'C', 'A', 'F', 'G') },
  { wave: 'noise', vol: 0.09, notes: seq('k . h . s . h . k . k . s . h .') },
]);

TRACKS.city = track('city', 140, [
  { wave: 'square', vol: 0.085, notes: seq(
    'E5 . . E5 G5 . B5 . A5 . G5 . F#5 . G5 .',
    'E5 . . E5 G5 . C6 . B5 . A5 . G5 . E5 .',
    'D5 . . D5 G5 . B5 . D6 . B5 . A5 . G5 .',
    'F#5 - - - A5 - - - D6 - C6 - B5 - A5 -') },
  { wave: 'triangle', vol: 0.24, notes: bass('R O R O R O R O R O R O R O R O', 'E', 'C', 'G', 'D') },
  { wave: 'noise', vol: 0.09, notes: seq('k . h h s . h . k k h . s . h h') },
]);

TRACKS.core = track('core', 120, [
  { wave: 'square', vol: 0.09, notes: seq(
    'D5 - . D5 F5 - . E5 D5 - C5 - A4 - - -',
    'D5 - . D5 F5 - . A5 G5 - F5 - E5 - - -',
    'A#4 - . A#4 D5 - . F5 E5 - D5 - C#5 - - -',
    'A4 - - - C#5 - E5 - A5 - - - - - - -') },
  { wave: 'triangle', vol: 0.24, notes: bass('R . R . O . R . R . R . O . R .', 'D', 'D', 'A#', 'A') },
  { wave: 'noise', vol: 0.09, notes: seq('k . . h s . . h k . k h s . h h') },
]);

TRACKS.boss = track('boss', 156, [
  { wave: 'square', vol: 0.09, notes: seq(
    'E5 F5 E5 D#5 E5 . B4 . C5 . D5 . E5 . G5 .',
    'F5 G5 F5 E5 F5 . C5 . D5 . E5 . F5 . A5 .',
    'E5 F5 E5 D#5 E5 . B4 . C5 . B4 . A4 . G#4 .',
    'A4 - - - C5 - - - E5 - - - A5 - - -') },
  { wave: 'triangle', vol: 0.24, notes: bass('R O R O R O R O R O R O R O R O', 'A', 'F', 'A', 'E') },
  { wave: 'noise', vol: 0.09, notes: seq('k h s h k k s h k h s h k k s s') },
]);

TRACKS.victory = track('victory', 132, [
  { wave: 'square', vol: 0.1, notes: seq('C5 . E5 . G5 . C6 . - . G5 . C6 - - -', 'A5 . B5 . C6 - - - - - - - - - - -') },
  { wave: 'triangle', vol: 0.24, notes: seq('C4 . . . G3 . . . C4 . . . G3 . . .', 'F3 . . . G3 . . . C4 - - - - - - -') },
  { wave: 'noise', vol: 0.09, notes: seq('k . h . s . h . k . h . s . h .', 'k . . . s . . . k . . . . . . .') },
], true);
