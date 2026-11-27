import type { MapId } from './types';
import { soundSynth } from './audio';

export interface StageTrackMetadata {
  mapId: MapId;
  title: string;
  mood: string;
  bpm: number;
  keyLabel: string;
}

interface StageTrackConfig extends StageTrackMetadata {
  leadWave: OscillatorType;
  leadHarmonicRatio?: number;
  leadFilterHz: number;
  bassWave: OscillatorType;
  bassFilterHz: number;
  arpWave: OscillatorType;
  arpFilterHz: number;
  echoWet: number;
  swing?: number; // 0..0.15 subtle swing on even/odd 16ths
  kick: string; // 64 chars: 'K' = kick, 'T' = deep tom/taiko, '.' = rest
  snare: string; // 64 chars: 'S' = snare, 'C' = clap/rim, 'A' = anvil/metallic, '.' = rest
  hat: string; // 64 chars: 'h' = closed, 'o' = open, 'b' = bell/shaker, '.' = rest
  bass: (number | null)[]; // 64 MIDI notes
  arp: (number | null)[]; // 64 MIDI notes
  lead: (number | null)[]; // 64 MIDI notes
}

export interface AudioPreferences {
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
}

const AUDIO_STORAGE_KEY = 'token_wars_audio_prefs_v1';

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  musicVolume: 0.55,
  sfxVolume: 0.85,
  muted: false,
};

export function loadAudioPreferences(): AudioPreferences {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }
  try {
    const raw = window.localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<AudioPreferences>;
    const clamp = (val: unknown, fallback: number): number =>
      typeof val === 'number' && Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : fallback;
    return {
      musicVolume: clamp(parsed.musicVolume, DEFAULT_AUDIO_PREFERENCES.musicVolume),
      sfxVolume: clamp(parsed.sfxVolume, DEFAULT_AUDIO_PREFERENCES.sfxVolume),
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_AUDIO_PREFERENCES.muted,
    };
  } catch {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }
}

export function saveAudioPreferences(prefs: AudioPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Helper to repeat a 16-step pattern across 4 bars with optional bar transpositions
function bars(
  b1: (number | null)[],
  b2: (number | null)[],
  b3: (number | null)[],
  b4: (number | null)[]
): (number | null)[] {
  return [...b1, ...b2, ...b3, ...b4];
}

// Helper for repeating a 16-char drum bar 4 times cleanly
function d4(b1: string, b2 = b1, b3 = b1, b4 = b1): string {
  return `${b1}${b2}${b3}${b4}`;
}

const _ = null;

// 10 Unique, Loopable 64-step (4-bar) Stage Soundtracks
const STAGE_TRACK_CONFIGS: Record<MapId, StageTrackConfig> = {
  // 1. HIVE CANOPY — Sunny Marimba & Amber Swarm Groove (124 BPM · D Mixolydian)
  hive_canopy: {
    mapId: 'hive_canopy',
    title: 'Amber Canopy Groove',
    mood: 'Sunlit Marimba & Swarm Groove',
    bpm: 124,
    keyLabel: 'D Mixolydian',
    leadWave: 'triangle',
    leadHarmonicRatio: 2,
    leadFilterHz: 3200,
    bassWave: 'sawtooth',
    bassFilterHz: 480,
    arpWave: 'sine',
    arpFilterHz: 2600,
    echoWet: 0.24,
    swing: 0.04,
    kick: d4('K..K..K...K..K..', 'K..K..K...K.KK..', 'K..K..K...K..K..', 'K..K..K..KK.K...'),
    snare: d4('....C.......C...', '....C.......C..C', '....C.......C...', '....C....C..C.C.'),
    hat: d4('h.b.h.b.h.b.h.bo'),
    bass: bars(
      [38, _, _, 38, _, 45, 38, _, 38, _, 45, _, 43, _, 45, _],
      [36, _, _, 36, _, 43, 36, _, 36, _, 43, _, 40, _, 43, _],
      [43, _, _, 43, _, 50, 43, _, 43, _, 50, _, 47, _, 50, _],
      [45, _, _, 45, _, 52, 45, _, 48, _, 45, _, 43, _, 45, _]
    ),
    arp: bars(
      [62, 66, 69, 66, 62, 66, 69, 74, 62, 66, 69, 66, 72, 69, 66, 62],
      [60, 64, 67, 64, 60, 64, 67, 72, 60, 64, 67, 64, 71, 67, 64, 60],
      [55, 59, 62, 59, 55, 59, 62, 67, 55, 59, 62, 59, 67, 62, 59, 55],
      [57, 61, 64, 61, 57, 64, 67, 64, 60, 64, 67, 64, 69, 67, 64, 61]
    ),
    lead: bars(
      [74, _, 76, _, 78, _, 74, _, 81, _, _, 79, 78, _, 74, _],
      [72, _, 74, _, 76, _, 72, _, 79, _, _, 76, 74, _, 72, _],
      [79, _, 81, _, 83, _, 79, _, 74, _, 76, _, 78, _, 79, _],
      [81, _, _, 79, 78, _, 76, _, 74, _, 76, 74, 72, _, 69, _]
    ),
  },

  // 2. STORM CITADEL — High-Voltage Thunder Anthem (138 BPM · E Minor)
  storm_citadel: {
    mapId: 'storm_citadel',
    title: 'Thunder Peak Surge',
    mood: 'Storm Synth & Lightning Arps',
    bpm: 138,
    keyLabel: 'E Minor',
    leadWave: 'sawtooth',
    leadHarmonicRatio: 1.5,
    leadFilterHz: 3600,
    bassWave: 'sawtooth',
    bassFilterHz: 620,
    arpWave: 'square',
    arpFilterHz: 2200,
    echoWet: 0.28,
    kick: d4('K..KK...K..KK...', 'K..KK...K..KK.K.', 'K..KK...K..KK...', 'K.KKK..KK.KKK...'),
    snare: d4('....S.......S...', '....S.......S..S', '....S.......S...', '....S...S..SS.S.'),
    hat: d4('hhhhhhhhhhhhhhoh'),
    bass: bars(
      [40, 40, _, 40, 40, _, 40, 40, 40, 40, _, 40, 47, _, 43, _],
      [36, 36, _, 36, 36, _, 36, 36, 36, 36, _, 36, 43, _, 40, _],
      [38, 38, _, 38, 38, _, 38, 38, 38, 38, _, 38, 45, _, 42, _],
      [35, 35, _, 35, 35, _, 38, _, 40, _, 42, _, 43, _, 47, _]
    ),
    arp: bars(
      [64, 67, 71, 76, 71, 67, 64, 71, 64, 67, 71, 76, 79, 76, 71, 67],
      [60, 64, 67, 72, 67, 64, 60, 67, 60, 64, 67, 72, 76, 72, 67, 64],
      [62, 66, 69, 74, 69, 66, 62, 69, 62, 66, 69, 74, 78, 74, 69, 66],
      [59, 62, 66, 71, 66, 62, 59, 66, 62, 66, 69, 74, 71, 69, 66, 62]
    ),
    lead: bars(
      [76, _, _, 79, 78, _, 76, _, 71, _, _, 74, 76, _, _, _],
      [72, _, _, 76, 74, _, 72, _, 67, _, _, 71, 72, _, _, _],
      [74, _, _, 78, 76, _, 74, _, 69, _, _, 74, 78, _, 81, _],
      [79, _, 78, _, 76, _, 74, _, 71, _, 74, _, 78, _, 76, _]
    ),
  },

  // 3. MAGMA FOUNDRY — Heavy Industrial Anvil Stomp (116 BPM · C Phrygian Dominant)
  magma_foundry: {
    mapId: 'magma_foundry',
    title: 'Molten Anvil Forge',
    mood: 'Industrial Forge & Heavy Sub',
    bpm: 116,
    keyLabel: 'C Phrygian',
    leadWave: 'sawtooth',
    leadHarmonicRatio: 0.5,
    leadFilterHz: 2400,
    bassWave: 'square',
    bassFilterHz: 420,
    arpWave: 'sawtooth',
    arpFilterHz: 1400,
    echoWet: 0.2,
    kick: d4('K..K..K.K...K...', 'K..K..K.K..KK...', 'K..K..K.K...K...', 'K.KK..K.K.KK....'),
    snare: d4('....S..A....S..A', '....S..A....S.AA', '....S..A....S..A', '....S..A..S.S.AA'),
    hat: d4('h.h.h.o.h.h.h.b.'),
    bass: bars(
      [36, 36, _, 36, _, 36, 37, _, 36, 36, _, 36, 40, _, 37, _],
      [36, 36, _, 36, _, 36, 43, _, 37, 37, _, 37, 40, _, 36, _],
      [34, 34, _, 34, _, 34, 36, _, 37, 37, _, 37, 41, _, 37, _],
      [36, 36, _, 36, 43, _, 40, _, 37, _, 36, _, 34, _, 31, _]
    ),
    arp: bars(
      [48, _, 55, _, 52, _, 55, _, 49, _, 55, _, 52, _, 49, _],
      [48, _, 55, _, 53, _, 55, _, 49, _, 56, _, 52, _, 48, _],
      [46, _, 53, _, 52, _, 53, _, 49, _, 56, _, 55, _, 52, _],
      [48, _, 52, _, 55, _, 60, _, 56, _, 55, _, 52, _, 49, _]
    ),
    lead: bars(
      [60, _, _, 64, 61, _, 60, _, _, 58, 60, _, 64, _, 67, _],
      [65, _, _, 64, 61, _, 60, _, _, 58, 56, _, 55, _, _, _],
      [58, _, _, 61, 60, _, 58, _, 61, _, _, 64, 67, _, 68, _],
      [67, _, 64, _, 61, _, 60, _, 64, _, 61, _, 60, _, _, _]
    ),
  },

  // 4. WIND MILL SPIRE — Breezy Sky-Turbine March (132 BPM · G Major)
  wind_mill_spire: {
    mapId: 'wind_mill_spire',
    title: 'Zephyr Blade Waltz',
    mood: 'Airy Arcade Flute & Harp',
    bpm: 132,
    keyLabel: 'G Major',
    leadWave: 'triangle',
    leadHarmonicRatio: 2,
    leadFilterHz: 3800,
    bassWave: 'triangle',
    bassFilterHz: 700,
    arpWave: 'triangle',
    arpFilterHz: 3000,
    echoWet: 0.26,
    kick: d4('K...K...K...K...', 'K...K...K..KK...', 'K...K...K...K...', 'K..KK...K.K.K...'),
    snare: d4('....S..C....S.C.', '....S..C....S.SS', '....S..C....S.C.', '....S...S.S.S.CC'),
    hat: d4('hhohhohhhhohhoho'),
    bass: bars(
      [43, _, 50, _, 43, _, 50, _, 42, _, 50, _, 42, _, 50, _],
      [40, _, 47, _, 40, _, 47, _, 36, _, 43, _, 38, _, 45, _],
      [43, _, 50, _, 47, _, 50, _, 36, _, 43, _, 40, _, 43, _],
      [38, _, 45, _, 42, _, 45, _, 38, _, 45, _, 50, _, 45, _]
    ),
    arp: bars(
      [67, 71, 74, 79, 74, 71, 67, 74, 66, 69, 74, 78, 74, 69, 66, 74],
      [64, 67, 71, 76, 71, 67, 64, 71, 60, 64, 67, 72, 62, 66, 69, 74],
      [67, 71, 74, 79, 74, 71, 67, 74, 60, 64, 67, 72, 67, 64, 60, 67],
      [62, 66, 69, 74, 69, 66, 62, 69, 62, 67, 69, 74, 78, 74, 69, 66]
    ),
    lead: bars(
      [79, _, 81, 83, 86, _, 83, _, 81, _, 78, _, 74, _, _, _],
      [76, _, 79, 81, 83, _, 79, _, 76, _, 72, _, 74, _, _, _],
      [79, _, 83, 86, 88, _, 86, _, 84, _, 83, 81, 79, _, 76, _],
      [78, _, 81, _, 86, _, 83, _, 81, _, 78, _, 79, _, _, _]
    ),
  },

  // 5. ECLIPSE TEMPLE — Monochrome Shrine Taiko & Chimes (112 BPM · A Hirajoshi)
  eclipse_temple: {
    mapId: 'eclipse_temple',
    title: 'Shadow Shrine Bells',
    mood: 'Taiko Pulse & Pentatonic Bells',
    bpm: 112,
    keyLabel: 'A Hirajoshi',
    leadWave: 'sine',
    leadHarmonicRatio: 3,
    leadFilterHz: 2900,
    bassWave: 'triangle',
    bassFilterHz: 450,
    arpWave: 'sine',
    arpFilterHz: 3400,
    echoWet: 0.36,
    kick: d4('T..T..K.T...K...', 'T..T..K.T..TT...', 'T..T..K.T...K...', 'T.TT..K.T..KK.T.'),
    snare: d4('....C.......C..C', '....C...C...C...', '....C.......C..C', '....C..CC.C.C...'),
    hat: d4('b...h...b...h.o.', 'b...h...b..bh.o.', 'b...h...b...h.o.', 'b.h.b.h.b.h.b.o.'),
    bass: bars(
      [45, _, _, 45, _, _, 52, _, 45, _, _, 45, 48, _, 47, _],
      [41, _, _, 41, _, _, 48, _, 41, _, _, 41, 45, _, 41, _],
      [40, _, _, 40, _, _, 47, _, 40, _, _, 40, 41, _, 40, _],
      [45, _, _, 45, 52, _, 48, _, 47, _, 45, _, 40, _, 45, _]
    ),
    arp: bars(
      [69, _, 76, _, 77, _, 72, _, 71, _, 76, _, 69, _, _, _],
      [65, _, 72, _, 76, _, 71, _, 69, _, 72, _, 65, _, _, _],
      [64, _, 71, _, 72, _, 69, _, 64, _, 76, _, 72, _, _, _],
      [69, _, 71, _, 72, _, 76, _, 77, _, 76, _, 71, _, 69, _]
    ),
    lead: bars(
      [81, _, _, 83, 84, _, _, _, 88, _, 89, _, 88, _, 84, _],
      [81, _, 83, _, 84, _, 81, _, 77, _, _, 76, 77, _, _, _],
      [76, _, _, 77, 81, _, 83, _, 84, _, _, 88, 83, _, _, _],
      [89, _, 88, _, 84, _, 83, _, 81, _, 76, _, 81, _, _, _]
    ),
  },

  // 6. NEON SKYLINE — Outrun Synthwave Highway (128 BPM · F# Minor)
  neon_skyline: {
    mapId: 'neon_skyline',
    title: 'Neon Overdrive',
    mood: 'Cyber Synthwave & Outrun Bass',
    bpm: 128,
    keyLabel: 'F# Minor',
    leadWave: 'sawtooth',
    leadHarmonicRatio: 2,
    leadFilterHz: 3800,
    bassWave: 'sawtooth',
    bassFilterHz: 680,
    arpWave: 'triangle',
    arpFilterHz: 2800,
    echoWet: 0.3,
    kick: d4('K...K...K...K...', 'K...K...K...K.K.', 'K...K...K...K...', 'K...K...K..KK.K.'),
    snare: d4('....S.......S...', '....S.......S..S', '....S.......S...', '....S...S...S.SS'),
    hat: d4('..h...h...h...o.'),
    bass: bars(
      [42, 42, 54, 42, 42, 42, 54, 42, 42, 42, 54, 42, 42, 54, 42, 49],
      [38, 38, 50, 38, 38, 38, 50, 38, 38, 38, 50, 38, 38, 50, 38, 45],
      [40, 40, 52, 40, 40, 40, 52, 40, 40, 40, 52, 40, 40, 52, 40, 47],
      [37, 37, 49, 37, 37, 37, 49, 37, 40, 40, 52, 40, 42, 49, 44, 40]
    ),
    arp: bars(
      [66, 69, 73, 78, 73, 69, 66, 73, 66, 69, 73, 78, 81, 78, 73, 69],
      [62, 66, 69, 74, 69, 66, 62, 69, 62, 66, 69, 74, 78, 74, 69, 66],
      [64, 68, 71, 76, 71, 68, 64, 71, 64, 68, 71, 76, 80, 76, 71, 68],
      [61, 64, 68, 73, 68, 64, 61, 68, 64, 68, 71, 76, 73, 71, 68, 64]
    ),
    lead: bars(
      [78, _, _, _, 81, _, 80, _, 78, _, _, 73, 76, _, 73, _],
      [74, _, _, _, 78, _, 76, _, 74, _, _, 69, 73, _, 74, _],
      [76, _, _, _, 80, _, 78, _, 76, _, _, 71, 74, _, 76, _],
      [73, _, 76, _, 80, _, 83, _, 81, _, 80, _, 78, _, _, _]
    ),
  },

  // 7. FROST GLACIER — Aurora Ice Celesta & Shimmer (120 BPM · C Minor)
  frost_glacier: {
    mapId: 'frost_glacier',
    title: 'Aurora Crystal Spire',
    mood: 'Glacial Celesta & Frost Pulse',
    bpm: 120,
    keyLabel: 'C Minor',
    leadWave: 'sine',
    leadHarmonicRatio: 2,
    leadFilterHz: 4600,
    bassWave: 'triangle',
    bassFilterHz: 520,
    arpWave: 'triangle',
    arpFilterHz: 3900,
    echoWet: 0.34,
    kick: d4('K.....K.K.......', 'K.....K.K...K...', 'K.....K.K.......', 'K...K...K..KK...'),
    snare: d4('....C.......C...', '....C.......C.C.', '....C.......C...', '....C...C...C.CC'),
    hat: d4('b.h.h.h.b.h.h.o.'),
    bass: bars(
      [36, _, _, 43, _, _, 36, _, 36, _, _, 43, 48, _, 43, _],
      [44, _, _, 51, _, _, 44, _, 44, _, _, 48, 51, _, 48, _],
      [39, _, _, 46, _, _, 39, _, 39, _, _, 46, 51, _, 46, _],
      [43, _, _, 50, _, _, 43, _, 43, _, 47, _, 50, _, 43, _]
    ),
    arp: bars(
      [72, 75, 79, 84, 79, 75, 72, 79, 72, 75, 79, 84, 86, 84, 79, 75],
      [68, 72, 75, 80, 75, 72, 68, 75, 68, 72, 75, 80, 84, 80, 75, 72],
      [70, 75, 79, 82, 79, 75, 70, 79, 70, 75, 79, 82, 87, 82, 79, 75],
      [67, 71, 74, 79, 74, 71, 67, 74, 71, 74, 79, 83, 79, 74, 71, 67]
    ),
    lead: bars(
      [84, _, 86, _, 87, _, 84, _, 79, _, _, 82, 84, _, _, _],
      [80, _, 82, _, 84, _, 80, _, 75, _, _, 79, 80, _, _, _],
      [79, _, 82, _, 87, _, 86, _, 84, _, 82, _, 79, _, _, _],
      [83, _, 86, _, 91, _, 89, _, 86, _, 83, _, 84, _, _, _]
    ),
  },

  // 8. CYBER FACTORY — Clockwork Piston Electro (134 BPM · G Minor)
  cyber_factory: {
    mapId: 'cyber_factory',
    title: 'Clockwork Gearworks',
    mood: 'Mechanical Chiptune & Piston Groove',
    bpm: 134,
    keyLabel: 'G Minor',
    leadWave: 'square',
    leadHarmonicRatio: 1,
    leadFilterHz: 2900,
    bassWave: 'sawtooth',
    bassFilterHz: 750,
    arpWave: 'square',
    arpFilterHz: 2100,
    echoWet: 0.18,
    kick: d4('K..K..K...K..K..', 'K..K..K...K.KK..', 'K..K..K...K..K..', 'K.KK..K.K.KK....'),
    snare: d4('....S..A....S...', '....S..A....S.SS', '....S..A....S...', '....S.AA..S.S.AA'),
    hat: d4('hhhhhhhhhhhhhhoh'),
    bass: bars(
      [43, _, 55, 43, _, 43, 53, _, 43, _, 55, 43, 46, _, 50, _],
      [39, _, 51, 39, _, 39, 50, _, 39, _, 51, 39, 43, _, 46, _],
      [36, _, 48, 36, _, 36, 46, _, 36, _, 48, 36, 39, _, 43, _],
      [38, _, 50, 38, 42, _, 45, _, 50, _, 45, _, 42, _, 38, _]
    ),
    arp: bars(
      [67, 70, 74, 70, 67, 70, 74, 79, 67, 70, 74, 70, 77, 74, 70, 67],
      [63, 67, 70, 67, 63, 67, 70, 75, 63, 67, 70, 67, 74, 70, 67, 63],
      [60, 63, 67, 63, 60, 63, 67, 72, 60, 63, 67, 63, 70, 67, 63, 60],
      [62, 66, 69, 66, 62, 66, 69, 74, 66, 69, 74, 78, 74, 69, 66, 62]
    ),
    lead: bars(
      [79, 79, _, 77, 74, _, 70, _, 74, _, 77, _, 79, _, 82, _],
      [75, 75, _, 74, 70, _, 67, _, 70, _, 74, _, 75, _, 79, _],
      [72, 72, _, 70, 67, _, 63, _, 67, _, 70, _, 72, _, 75, _],
      [74, _, 78, _, 81, _, 78, _, 74, _, 72, _, 70, _, 69, _]
    ),
  },

  // 9. CORAL ABYSS — Submerged Liquid Rhodes & Sonar (108 BPM · D Dorian)
  coral_abyss: {
    mapId: 'coral_abyss',
    title: 'Abyssal Trench Drift',
    mood: 'Liquid Rhodes & Deep Sub Pulse',
    bpm: 108,
    keyLabel: 'D Dorian',
    leadWave: 'sine',
    leadHarmonicRatio: 2,
    leadFilterHz: 2500,
    bassWave: 'sine',
    bassFilterHz: 360,
    arpWave: 'triangle',
    arpFilterHz: 2000,
    echoWet: 0.38,
    swing: 0.05,
    kick: d4('K....K....K.....', 'K....K....K..K..', 'K....K....K.....', 'K..K.K....K..K..'),
    snare: d4('....C.......C...', '....C.......C..C', '....C.......C...', '....C....C..C...'),
    hat: d4('b.h.o.h.b.h.o.h.'),
    bass: bars(
      [38, _, _, _, 45, _, 38, _, 38, _, 45, _, 43, _, 45, _],
      [43, _, _, _, 50, _, 43, _, 43, _, 47, _, 43, _, 41, _],
      [36, _, _, _, 43, _, 36, _, 36, _, 43, _, 40, _, 43, _],
      [45, _, _, _, 52, _, 45, _, 43, _, 41, _, 40, _, 38, _]
    ),
    arp: bars(
      [62, 65, 69, 72, 69, 65, 62, 69, 62, 65, 69, 74, 72, 69, 65, 62],
      [59, 62, 65, 69, 65, 62, 59, 65, 59, 62, 65, 71, 69, 65, 62, 59],
      [60, 64, 67, 71, 67, 64, 60, 67, 60, 64, 67, 72, 71, 67, 64, 60],
      [57, 60, 64, 67, 64, 60, 57, 64, 60, 64, 67, 72, 69, 67, 64, 60]
    ),
    lead: bars(
      [74, _, _, 76, 77, _, 74, _, 69, _, _, 72, 74, _, _, _],
      [79, _, _, 77, 76, _, 74, _, 71, _, _, 74, 72, _, _, _],
      [72, _, _, 74, 76, _, 72, _, 67, _, _, 71, 72, _, _, _],
      [76, _, 74, _, 72, _, 69, _, 72, _, 71, _, 69, _, _, _]
    ),
  },

  // 10. COSMIC STATION — Low-G Orbital Laser Battle (142 BPM · C# Minor)
  cosmic_station: {
    mapId: 'cosmic_station',
    title: 'Orbital Starlight Blitz',
    mood: 'Cosmic FM Arps & Laser Anthem',
    bpm: 142,
    keyLabel: 'C# Minor',
    leadWave: 'square',
    leadHarmonicRatio: 2,
    leadFilterHz: 4200,
    bassWave: 'sawtooth',
    bassFilterHz: 720,
    arpWave: 'triangle',
    arpFilterHz: 3600,
    echoWet: 0.28,
    kick: d4('K...K...K...K...', 'K...K...K..KK...', 'K...K...K...K...', 'K.KKK...K.KKK.K.'),
    snare: d4('....S.......S...', '....S.......S.SS', '....S.......S...', '....S..SS...S.SS'),
    hat: d4('hhhhhhhhhhhhhhoh'),
    bass: bars(
      [37, 37, 49, 37, 37, 49, 37, 44, 37, 37, 49, 37, 44, 49, 37, 44],
      [45, 45, 57, 45, 45, 57, 45, 52, 45, 45, 57, 45, 52, 57, 45, 52],
      [47, 47, 59, 47, 47, 59, 47, 54, 47, 47, 59, 47, 54, 59, 47, 54],
      [44, 44, 56, 44, 44, 56, 44, 51, 44, 44, 56, 44, 49, 47, 44, 40]
    ),
    arp: bars(
      [61, 64, 68, 73, 68, 64, 61, 68, 61, 64, 68, 73, 76, 73, 68, 64],
      [69, 73, 76, 81, 76, 73, 69, 76, 69, 73, 76, 81, 85, 81, 76, 73],
      [71, 75, 78, 83, 78, 75, 71, 78, 71, 75, 78, 83, 87, 83, 78, 75],
      [68, 72, 75, 80, 75, 72, 68, 75, 68, 73, 76, 80, 76, 75, 72, 68]
    ),
    lead: bars(
      [73, _, 76, _, 80, _, 85, _, 83, _, 80, _, 76, _, 73, _],
      [81, _, 83, _, 85, _, 88, _, 85, _, 83, _, 81, _, 76, _],
      [83, _, 85, _, 87, _, 90, _, 87, _, 85, _, 83, _, 78, _],
      [80, _, 83, _, 87, _, 83, _, 80, _, 76, _, 75, _, 73, _]
    ),
  },
};

export const STAGE_MUSIC_METADATA: Record<MapId, StageTrackMetadata> = Object.fromEntries(
  (Object.keys(STAGE_TRACK_CONFIGS) as MapId[]).map((id) => {
    const { mapId, title, mood, bpm, keyLabel } = STAGE_TRACK_CONFIGS[id];
    return [id, { mapId, title, mood, bpm, keyLabel }];
  })
) as Record<MapId, StageTrackMetadata>;

class StageMusicEngine {
  private musicGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private delayNode: DelayNode | null = null;
  private delaySend: GainNode | null = null;
  private graphContext: AudioContext | null = null;

  private activeMapId: MapId | null = null;
  private running = false;
  private muted = false;
  private volume = DEFAULT_AUDIO_PREFERENCES.musicVolume;

  private schedulerTimer: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;

  private ensureGraph(): AudioContext | null {
    const ctx = soundSynth.getOrCreateContext();
    if (!ctx) return null;

    if (this.graphContext !== ctx || !this.musicGain || !this.compressor) {
      this.graphContext = ctx;
      this.musicGain = ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.muted ? 0 : this.volume, ctx.currentTime);

      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.006, ctx.currentTime);
      this.compressor.release.setValueAtTime(0.18, ctx.currentTime);

      // Subtle warm echo return for leads and plucks
      this.delayNode = ctx.createDelay(1.0);
      this.delayNode.delayTime.setValueAtTime(0.24, ctx.currentTime);
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.setValueAtTime(2200, ctx.currentTime);
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.setValueAtTime(0.26, ctx.currentTime);

      this.delaySend = ctx.createGain();
      this.delaySend.gain.setValueAtTime(0.24, ctx.currentTime);

      this.delaySend.connect(this.delayNode);
      this.delayNode.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(this.delayNode);
      delayFilter.connect(this.compressor);

      this.compressor.connect(this.musicGain);
      this.musicGain.connect(ctx.destination);
    }

    return ctx;
  }

  private syncGain(): void {
    if (!this.graphContext || !this.musicGain) return;
    const target = this.muted || !this.running ? 0 : this.volume;
    this.musicGain.gain.setTargetAtTime(target, this.graphContext.currentTime, 0.025);
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.55));
    this.syncGain();
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.syncGain();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isPlaying(): boolean {
    return this.running && this.activeMapId !== null;
  }

  public getActiveMapId(): MapId | null {
    return this.activeMapId;
  }

  public getActiveTrack(): StageTrackMetadata | null {
    return this.activeMapId ? STAGE_MUSIC_METADATA[this.activeMapId] : null;
  }

  public unlock(): void {
    if (!this.running) return;
    const ctx = this.ensureGraph();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (this.nextStepTime < ctx.currentTime) {
      this.nextStepTime = ctx.currentTime + 0.03;
    }
  }

  public playStage(mapId: MapId): void {
    if (typeof window === 'undefined') return;
    const ctx = this.ensureGraph();
    if (!ctx) return;

    if (this.running && this.activeMapId === mapId) {
      this.syncGain();
      return;
    }

    this.activeMapId = mapId;
    this.running = true;
    this.currentStep = 0;
    this.nextStepTime = ctx.currentTime + 0.04;

    if (this.delaySend) {
      const cfg = STAGE_TRACK_CONFIGS[mapId];
      this.delaySend.gain.setTargetAtTime(cfg.echoWet, ctx.currentTime, 0.03);
    }

    this.syncGain();

    if (this.schedulerTimer === null) {
      this.schedulerTimer = window.setInterval(() => {
        this.scheduleAhead();
      }, 25);
    }
    this.scheduleAhead();
  }

  public stop(): void {
    this.running = false;
    this.activeMapId = null;
    if (this.schedulerTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.syncGain();
  }

  private scheduleAhead(): void {
    if (!this.running || !this.activeMapId) return;
    const ctx = this.ensureGraph();
    if (!ctx || !this.compressor) return;

    // Avoid piling up notes while browser context is still suspended prior to user gesture
    if (ctx.state !== 'running') {
      this.nextStepTime = ctx.currentTime + 0.04;
      return;
    }

    // If silenced completely, keep clock advancing lightly without spawning oscillators
    const effectivelySilent = this.muted || this.volume <= 0.001;
    const cfg = STAGE_TRACK_CONFIGS[this.activeMapId];
    const stepDuration = 60 / cfg.bpm / 4; // 16th-note duration
    const lookaheadSec = 0.12;

    if (this.nextStepTime < ctx.currentTime - 0.25) {
      this.nextStepTime = ctx.currentTime + 0.03;
    }

    while (this.nextStepTime < ctx.currentTime + lookaheadSec) {
      const stepIdx = this.currentStep % 64;
      const swingOffset =
        cfg.swing && stepIdx % 2 === 1 ? stepDuration * cfg.swing : 0;
      const playAt = this.nextStepTime + swingOffset;

      if (!effectivelySilent) {
        this.triggerStep(ctx, cfg, stepIdx, playAt, stepDuration);
      }

      this.nextStepTime += stepDuration;
      this.currentStep = (this.currentStep + 1) % 64;
    }
  }

  private triggerStep(
    ctx: AudioContext,
    cfg: StageTrackConfig,
    step: number,
    time: number,
    stepDur: number
  ): void {
    const dest = this.compressor;
    if (!dest) return;

    // 1. Drums
    const kickChar = cfg.kick[step];
    if (kickChar === 'K') {
      this.scheduleKick(ctx, dest, time, false);
    } else if (kickChar === 'T') {
      this.scheduleKick(ctx, dest, time, true);
    }

    const snareChar = cfg.snare[step];
    if (snareChar === 'S') {
      this.scheduleSnare(ctx, dest, time, 'snare');
    } else if (snareChar === 'C') {
      this.scheduleSnare(ctx, dest, time, 'clap');
    } else if (snareChar === 'A') {
      this.scheduleMetallic(ctx, dest, time, 540, 0.14);
    }

    const hatChar = cfg.hat[step];
    if (hatChar === 'h') {
      this.scheduleHat(ctx, dest, time, false);
    } else if (hatChar === 'o') {
      this.scheduleHat(ctx, dest, time, true);
    } else if (hatChar === 'b') {
      this.scheduleMetallic(ctx, dest, time, 1180, 0.08);
    }

    // 2. Bass
    const bassMidi = cfg.bass[step];
    if (bassMidi !== null && bassMidi !== undefined) {
      this.scheduleBass(ctx, dest, cfg, midiToFreq(bassMidi), time, stepDur * 1.35);
    }

    // 3. Arp / Harmony
    const arpMidi = cfg.arp[step];
    if (arpMidi !== null && arpMidi !== undefined) {
      this.scheduleArp(ctx, dest, cfg, midiToFreq(arpMidi), time, stepDur * 1.15);
    }

    // 4. Lead Melody (hold slightly longer if next steps are rests)
    const leadMidi = cfg.lead[step];
    if (leadMidi !== null && leadMidi !== undefined) {
      let holdSteps = 1;
      for (let look = 1; look <= 3; look++) {
        const nextIdx = (step + look) % 64;
        if (cfg.lead[nextIdx] === null) {
          holdSteps += 0.65;
        } else {
          break;
        }
      }
      this.scheduleLead(ctx, dest, cfg, midiToFreq(leadMidi), time, stepDur * holdSteps * 0.92);
    }
  }

  private scheduleKick(ctx: AudioContext, dest: AudioNode, time: number, taiko: boolean): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = taiko ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(taiko ? 132 : 148, time);
    osc.frequency.exponentialRampToValueAtTime(taiko ? 48 : 42, time + (taiko ? 0.14 : 0.11));

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(taiko ? 0.32 : 0.34, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (taiko ? 0.18 : 0.15));

    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private scheduleSnare(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    kind: 'snare' | 'clap'
  ): void {
    const noiseBuf = soundSynth.getNoiseBuffer();
    if (noiseBuf) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(kind === 'clap' ? 1850 : 2200, time);
      filter.Q.setValueAtTime(kind === 'clap' ? 1.4 : 0.9, time);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(kind === 'clap' ? 0.14 : 0.18, time + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (kind === 'clap' ? 0.11 : 0.14));

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(time);
      noise.stop(time + 0.16);
    }

    if (kind === 'snare') {
      const body = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(195, time);
      body.frequency.exponentialRampToValueAtTime(105, time + 0.08);
      bodyGain.gain.setValueAtTime(0.001, time);
      bodyGain.gain.linearRampToValueAtTime(0.14, time + 0.004);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
      body.connect(bodyGain);
      bodyGain.connect(dest);
      body.start(time);
      body.stop(time + 0.1);
    }
  }

  private scheduleHat(ctx: AudioContext, dest: AudioNode, time: number, open: boolean): void {
    const noiseBuf = soundSynth.getNoiseBuffer();
    if (!noiseBuf) return;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7200, time);

    const gain = ctx.createGain();
    const dur = open ? 0.14 : 0.045;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(open ? 0.08 : 0.055, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
    noise.stop(time + dur + 0.02);
  }

  private scheduleMetallic(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    baseFreq: number,
    dur: number
  ): void {
    const ratios = [1, 1.48];
    ratios.forEach((ratio, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(baseFreq * ratio, time);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.085 : 0.045, time + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });
  }

  private scheduleBass(
    ctx: AudioContext,
    dest: AudioNode,
    cfg: StageTrackConfig,
    freq: number,
    time: number,
    dur: number
  ): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = cfg.bassWave;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cfg.bassFilterHz * 1.45, time);
    filter.frequency.exponentialRampToValueAtTime(cfg.bassFilterHz * 0.72, time + dur);
    filter.Q.setValueAtTime(2.2, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.22, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private scheduleArp(
    ctx: AudioContext,
    dest: AudioNode,
    cfg: StageTrackConfig,
    freq: number,
    time: number,
    dur: number
  ): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = cfg.arpWave;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cfg.arpFilterHz, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.075, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    if (this.delaySend) {
      gain.connect(this.delaySend);
    }
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private scheduleLead(
    ctx: AudioContext,
    dest: AudioNode,
    cfg: StageTrackConfig,
    freq: number,
    time: number,
    dur: number
  ): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = cfg.leadWave;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cfg.leadFilterHz, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.11, time + 0.012);
    gain.gain.setValueAtTime(0.095, time + Math.max(0.02, dur * 0.45));
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    if (this.delaySend) {
      gain.connect(this.delaySend);
    }
    osc.start(time);
    osc.stop(time + dur + 0.03);

    if (cfg.leadHarmonicRatio && cfg.leadHarmonicRatio > 0) {
      const overtone = ctx.createOscillator();
      const overGain = ctx.createGain();
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * cfg.leadHarmonicRatio, time);
      overGain.gain.setValueAtTime(0.001, time);
      overGain.gain.linearRampToValueAtTime(0.04, time + 0.01);
      overGain.gain.exponentialRampToValueAtTime(0.001, time + Math.min(dur, 0.24));
      overtone.connect(overGain);
      overGain.connect(filter);
      overtone.start(time);
      overtone.stop(time + Math.min(dur, 0.25) + 0.02);
    }
  }
}

export const stageMusic = new StageMusicEngine();
