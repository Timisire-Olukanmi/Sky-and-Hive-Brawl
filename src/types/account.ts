import type { FighterId, MapId, PlayMode } from '../game/types';

export type MapSelection = MapId | 'random';

export const ALL_MAP_IDS: MapId[] = [
  'hive_canopy',
  'storm_citadel',
  'magma_foundry',
  'wind_mill_spire',
  'eclipse_temple',
  'neon_skyline',
  'frost_glacier',
  'cyber_factory',
  'coral_abyss',
  'cosmic_station',
];

export const ALL_FIGHTER_IDS: FighterId[] = [
  'honey_shell',
  'cloudier',
  'eve',
  'spidra',
  'marshal_bolt',
  'pyro_jack',
  'aqua_nyx',
  'blade_zero',
  'moss_golem',
  'astro_pip',
];

export type AuthProviderKind = 'google' | 'password' | 'github' | 'anonymous';

export interface PlayerRecord {
  wins: number;
  losses: number;
  currentStreak: number;
}

export interface ScoreboardStats {
  p1: PlayerRecord;
  p2: PlayerRecord;
  cpu: PlayerRecord;
}

export interface UserProfileDoc {
  uid: string;
  displayName: string;
  favoriteFighter: FighterId;
  defaultMap: MapSelection;
  preferredMode: PlayMode;
  scoreboard: ScoreboardStats;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivateAccountDoc {
  uid: string;
  email: string;
  authProvider: AuthProviderKind;
  isGuest: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const DISPLAY_NAME_MIN_LENGTH = 1;
export const DISPLAY_NAME_MAX_LENGTH = 32;
export const EMAIL_MAX_LENGTH = 254;
export const MAX_SCORE_VALUE = 1_000_000;
export const UID_PATTERN = /^[a-zA-Z0-9_\-]+$/;

export const createEmptyScoreboard = (): ScoreboardStats => ({
  p1: { wins: 0, losses: 0, currentStreak: 0 },
  p2: { wins: 0, losses: 0, currentStreak: 0 },
  cpu: { wins: 0, losses: 0, currentStreak: 0 },
});

export function sanitizeDisplayName(name: string | null | undefined, fallback = 'Brawler'): string {
  const trimmed = (name ?? '').trim();
  const base = trimmed.length >= DISPLAY_NAME_MIN_LENGTH ? trimmed : fallback;
  return base.slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export function sanitizeFighterId(value: unknown): FighterId {
  if (typeof value === 'string' && (ALL_FIGHTER_IDS as string[]).includes(value)) {
    return value as FighterId;
  }
  return 'honey_shell';
}

export function sanitizeMapSelection(value: unknown): MapSelection {
  if (value === 'random') return 'random';
  if (typeof value === 'string' && (ALL_MAP_IDS as string[]).includes(value)) {
    return value as MapId;
  }
  return 'hive_canopy';
}

export function sanitizePlayMode(value: unknown): PlayMode {
  if (value === '2P_LOCAL') return '2P_LOCAL';
  return '1P_AI';
}

export function sanitizePlayerRecord(value: unknown): PlayerRecord {
  if (!value || typeof value !== 'object') {
    return { wins: 0, losses: 0, currentStreak: 0 };
  }
  const rec = value as Record<string, unknown>;
  const clampInt = (raw: unknown): number =>
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.min(MAX_SCORE_VALUE, Math.max(0, Math.floor(raw)))
      : 0;

  const wins = clampInt(rec.wins);
  const losses = clampInt(rec.losses);
  const currentStreak =
    typeof rec.currentStreak === 'number' && Number.isFinite(rec.currentStreak)
      ? clampInt(rec.currentStreak)
      : losses === 0 && wins > 0
      ? wins
      : 0;
  return { wins, losses, currentStreak };
}

export function sanitizeScoreboard(value: unknown): ScoreboardStats {
  if (!value || typeof value !== 'object') {
    return createEmptyScoreboard();
  }
  const obj = value as Record<string, unknown>;
  return {
    p1: sanitizePlayerRecord(obj.p1),
    p2: sanitizePlayerRecord(obj.p2),
    cpu: sanitizePlayerRecord(obj.cpu),
  };
}
