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

export type LocalPlayMode = '1P_AI' | '2P_LOCAL';

export interface OnlineStats {
  casualWins: number;
  casualLosses: number;
  rankedWins: number;
  rankedLosses: number;
  rankedPoints: number;
  rankedStreak: number;
}

export interface RankTierInfo {
  name: string;
  color: string;
  minRp: number;
  nextRp: number | null;
}

export interface TournamentStats {
  cycleId: string;
  points: number;
  wins: number;
  losses: number;
  streak: number;
  bestPoints: number;
  careerWins: number;
  careerLosses: number;
  trophies: number;
}

export const DEFAULT_RANKED_POINTS = 1000;
export const MAX_RANKED_POINTS = 10_000;
export const MAX_TOURNAMENT_POINTS = 100_000;
export const TOURNAMENT_CYCLE_ID_PATTERN = /^(cycle_[0-9]+|none)$/;

export function getRankTier(points: number): RankTierInfo {
  if (points >= 1900) {
    return { name: 'Apex', color: '#F43F5E', minRp: 1900, nextRp: null };
  }
  if (points >= 1650) {
    return { name: 'Diamond', color: '#38BDF8', minRp: 1650, nextRp: 1900 };
  }
  if (points >= 1400) {
    return { name: 'Platinum', color: '#2DD4BF', minRp: 1400, nextRp: 1650 };
  }
  if (points >= 1200) {
    return { name: 'Gold', color: '#FBBF24', minRp: 1200, nextRp: 1400 };
  }
  if (points >= 1050) {
    return { name: 'Silver', color: '#CBD5E1', minRp: 1050, nextRp: 1200 };
  }
  return { name: 'Bronze', color: '#FB923C', minRp: 0, nextRp: 1050 };
}

export interface UserProfileDoc {
  uid: string;
  displayName: string;
  favoriteFighter: FighterId;
  defaultMap: MapSelection;
  preferredMode: LocalPlayMode;
  scoreboard: ScoreboardStats;
  onlineStats?: OnlineStats;
  tournamentStats?: TournamentStats;
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

export const createEmptyOnlineStats = (): OnlineStats => ({
  casualWins: 0,
  casualLosses: 0,
  rankedWins: 0,
  rankedLosses: 0,
  rankedPoints: DEFAULT_RANKED_POINTS,
  rankedStreak: 0,
});

export const createEmptyTournamentStats = (): TournamentStats => ({
  cycleId: 'none',
  points: 0,
  wins: 0,
  losses: 0,
  streak: 0,
  bestPoints: 0,
  careerWins: 0,
  careerLosses: 0,
  trophies: 0,
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

export function sanitizePlayMode(value: unknown): LocalPlayMode {
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

export function sanitizeOnlineStats(value: unknown): OnlineStats {
  if (!value || typeof value !== 'object') {
    return createEmptyOnlineStats();
  }
  const obj = value as Record<string, unknown>;
  const clamp = (raw: unknown, max: number, fallback = 0): number =>
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.min(max, Math.max(0, Math.floor(raw)))
      : fallback;

  return {
    casualWins: clamp(obj.casualWins, MAX_SCORE_VALUE, 0),
    casualLosses: clamp(obj.casualLosses, MAX_SCORE_VALUE, 0),
    rankedWins: clamp(obj.rankedWins, MAX_SCORE_VALUE, 0),
    rankedLosses: clamp(obj.rankedLosses, MAX_SCORE_VALUE, 0),
    rankedPoints: clamp(obj.rankedPoints, MAX_RANKED_POINTS, DEFAULT_RANKED_POINTS),
    rankedStreak: clamp(obj.rankedStreak, MAX_SCORE_VALUE, 0),
  };
}

export function sanitizeTournamentStats(value: unknown): TournamentStats {
  if (!value || typeof value !== 'object') {
    return createEmptyTournamentStats();
  }
  const obj = value as Record<string, unknown>;
  const clamp = (raw: unknown, max: number, fallback = 0): number =>
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.min(max, Math.max(0, Math.floor(raw)))
      : fallback;

  const rawCycleId = typeof obj.cycleId === 'string' ? obj.cycleId.trim().slice(0, 32) : 'none';
  const cycleId = TOURNAMENT_CYCLE_ID_PATTERN.test(rawCycleId) ? rawCycleId : 'none';
  const points = clamp(obj.points, MAX_TOURNAMENT_POINTS, 0);
  const wins = clamp(obj.wins, MAX_SCORE_VALUE, 0);
  const losses = clamp(obj.losses, MAX_SCORE_VALUE, 0);
  const bestPoints = Math.max(points, clamp(obj.bestPoints, MAX_TOURNAMENT_POINTS, 0));
  const careerWins = Math.max(wins, clamp(obj.careerWins, MAX_SCORE_VALUE, 0));
  const careerLosses = Math.max(losses, clamp(obj.careerLosses, MAX_SCORE_VALUE, 0));

  return {
    cycleId,
    points,
    wins,
    losses,
    streak: clamp(obj.streak, MAX_SCORE_VALUE, 0),
    bestPoints,
    careerWins,
    careerLosses,
    trophies: clamp(obj.trophies, MAX_SCORE_VALUE, 0),
  };
}
