import type { MapSelection } from '../types/account';
import type { TournamentWindowSummary } from './tournamentSchedule';
import type {
  DestructiblePropRuntime,
  FighterEntity,
  FighterId,
  FloatingNumberEntity,
  GamePhase,
  HudFighterSnapshot,
  MapId,
  ObstacleRuntime,
  ParticleEntity,
  Platform,
  PlayMode,
  ProjectileEntity,
  SlashEffect,
  ZoneEntity,
} from './types';

export type OnlineQueueType = 'casual' | 'ranked' | 'tournament';
export type WaitingAreaKind = 'none' | 'casual' | 'ranked' | 'tournament';
export type OnlineRoundPhase = 'intro' | 'fighting' | 'round_over' | 'series_over';

export const TARGET_SERIES_WINS = 3;
export const ONLINE_ROUND_STOCKS = 3;

export type SoundEvent =
  | { type: 'uiClick' }
  | { type: 'attack'; heavy: boolean }
  | { type: 'hit'; heavy: boolean }
  | { type: 'ko' }
  | { type: 'jump'; double: boolean }
  | { type: 'special'; isProj: boolean }
  | { type: 'ultimate' }
  | { type: 'recovery' }
  | { type: 'stun' }
  | { type: 'cloudWall' }
  | { type: 'chargeTelegraph' }
  | { type: 'tvBlare' }
  | { type: 'laserShot' }
  | { type: 'taunt'; fighterId: FighterId }
  | { type: 'tauntBoost' }
  | { type: 'poisonTick' }
  | { type: 'bouncePad' }
  | { type: 'hazardHit' }
  | { type: 'crackHit' }
  | { type: 'structureBreak' }
  | { type: 'hoverCarPass' };

export interface WaitingLobbyEntry {
  clientId: string;
  displayName: string;
  fighterId: FighterId;
  preferredMap: MapSelection;
  rankedPoints: number;
  tournamentPoints: number;
  status: 'waiting' | 'queued' | 'in_match';
  joinedAt: number;
  roomCode?: string;
}

export interface WaitingAreaSnapshot {
  casualWaiting: WaitingLobbyEntry[];
  rankedWaiting: WaitingLobbyEntry[];
  tournamentWaiting: WaitingLobbyEntry[];
  casualInMatchCount: number;
  rankedInMatchCount: number;
  tournamentInMatchCount: number;
}

export interface TournamentStandingEntry {
  playerKey: string;
  displayName: string;
  fighterId: FighterId;
  points: number;
  wins: number;
  losses: number;
  streak: number;
  updatedAt: number;
}

export interface TournamentBracketPlayer {
  clientId?: string;
  playerKey: string;
  displayName: string;
  fighterId: FighterId;
  tournamentPoints: number;
}

export interface TournamentMatchRecord {
  matchId: string;
  cycleId: string;
  status: 'live' | 'completed';
  round: number;
  roundPhase: OnlineRoundPhase | 'completed';
  targetWins: number;
  scores: [number, number];
  mapId: MapId;
  players: [TournamentBracketPlayer, TournamentBracketPlayer];
  winnerSlot: 0 | 1 | null;
  reason?: 'ko' | 'forfeit';
  startedAtMs: number;
  finishedAtMs?: number;
}

export interface TournamentStateSnapshot {
  serverNowMs: number;
  cycleNumber: number;
  cycleId: string;
  title: string;
  isActive: boolean;
  activeWindowStartMs: number;
  activeWindowEndMs: number;
  nextTournamentStartMs: number;
  nextTournamentEndMs: number;
  msUntilTransition: number;
  progressPct: number;
  upcomingWindows: TournamentWindowSummary[];
  standings: TournamentStandingEntry[];
  lastCycleId: string | null;
  lastCycleTitle: string | null;
  lastStandings: TournamentStandingEntry[];
  activeMatches: TournamentMatchRecord[];
  recentMatches: TournamentMatchRecord[];
}

export interface OnlinePlayerMeta {
  clientId: string;
  accountUid?: string;
  displayName: string;
  fighterId: FighterId;
  rankedPoints: number;
  tournamentPoints: number;
}

export interface OnlineInputActions {
  jump?: boolean;
  attackCombo?: boolean;
  attack1?: boolean;
  attack2?: boolean;
  attack3?: boolean;
  special?: boolean;
  ultimate?: boolean;
  recovery?: boolean;
  taunt?: boolean;
}

export interface SerializedEngineSnapshot {
  phase: GamePhase;
  mode: PlayMode;
  mapId: MapId;
  matchTime: number;
  ambientTime: number;
  hitstopTimer: number;
  shakeIntensity: number;
  lightningFlash: number;
  windForceX: number;
  winnerSlot: 0 | 1 | null;
  players: [FighterEntity, FighterEntity];
  platforms: Platform[];
  obstacles: ObstacleRuntime[];
  destructibles: DestructiblePropRuntime[];
  projectiles: ProjectileEntity[];
  zones: ZoneEntity[];
  slashes: SlashEffect[];
  activeParticles: ParticleEntity[];
  floatingNumbers: FloatingNumberEntity[];
}

export type ClientWsMessage =
  | {
      type: 'presence:enter';
      area: WaitingAreaKind;
      accountUid?: string;
      displayName: string;
      fighterId: FighterId;
      preferredMap: MapSelection;
      rankedPoints: number;
      tournamentPoints?: number;
      tournamentWins?: number;
      tournamentLosses?: number;
      tournamentStreak?: number;
      tournamentCycleId?: string;
    }
  | {
      type: 'queue:join';
      queue: OnlineQueueType;
      accountUid?: string;
      displayName: string;
      fighterId: FighterId;
      preferredMap: MapSelection;
      rankedPoints: number;
      tournamentPoints?: number;
      tournamentWins?: number;
      tournamentLosses?: number;
      tournamentStreak?: number;
      tournamentCycleId?: string;
    }
  | {
      type: 'queue:leave';
    }
  | {
      type: 'match:input';
      matchId: string;
      seq: number;
      moveDir: number;
      jumpHeld: boolean;
      downHeld: boolean;
      actions: OnlineInputActions;
    }
  | {
      type: 'match:leave';
      matchId: string;
    };

export type ServerWsMessage =
  | {
      type: 'connected';
      clientId: string;
      snapshot: WaitingAreaSnapshot;
      tournament: TournamentStateSnapshot;
    }
  | {
      type: 'presence:update';
      snapshot: WaitingAreaSnapshot;
    }
  | {
      type: 'tournament:update';
      tournament: TournamentStateSnapshot;
    }
  | {
      type: 'queue:status';
      inQueue: OnlineQueueType | null;
      position: number;
      enteredAt: number | null;
    }
  | {
      type: 'match:started';
      matchId: string;
      queueType: OnlineQueueType;
      yourSlot: 0 | 1;
      mapId: MapId;
      targetWins: number;
      round: number;
      scores: [number, number];
      players: [OnlinePlayerMeta, OnlinePlayerMeta];
      tournamentCycleId?: string;
      tournamentTitle?: string;
    }
  | {
      type: 'match:state';
      matchId: string;
      tick: number;
      round: number;
      scores: [number, number];
      roundPhase: OnlineRoundPhase;
      roundTimer: number;
      lastRoundWinnerSlot: 0 | 1 | null;
      state: SerializedEngineSnapshot;
      sounds: SoundEvent[];
    }
  | {
      type: 'match:series_over';
      matchId: string;
      queueType: OnlineQueueType;
      winnerSlot: 0 | 1;
      reason: 'ko' | 'forfeit';
      scores: [number, number];
      finalPlayers: [HudFighterSnapshot, HudFighterSnapshot];
      matchDurationSec: number;
      rpDelta: [number, number];
      newRp: [number, number];
      tpDelta: [number, number];
      newTp: [number, number];
      tournamentCycleId?: string;
    }
  | {
      type: 'error';
      message: string;
    };

export function computeRankedRpDelta(
  winnerRp: number,
  loserRp: number
): { winnerGain: number; loserLoss: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRp - winnerRp) / 400));
  const rawGain = Math.round(24 + (1 - expectedWinner) * 18);
  const winnerGain = Math.max(16, Math.min(40, rawGain));
  const loserLoss = Math.max(12, Math.min(30, Math.round(winnerGain * 0.78)));
  return { winnerGain, loserLoss };
}

export function computeTournamentPointsAward(
  winnerRounds: number,
  loserRounds: number,
  reason: 'ko' | 'forfeit'
): { winnerTpGain: number; loserTpGain: number } {
  const margin = Math.max(1, winnerRounds - loserRounds);
  const dominanceBonus = reason === 'forfeit' ? 0 : margin >= 3 ? 20 : margin >= 2 ? 10 : 0;
  const winnerTpGain = 100 + dominanceBonus;
  const loserTpGain = reason === 'forfeit' ? 0 : 25;
  return { winnerTpGain, loserTpGain };
}
