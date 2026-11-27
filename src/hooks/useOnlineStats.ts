import { useCallback, useEffect, useRef, useState } from 'react';
import type { OnlineQueueType } from '../game/onlineTypes';
import { getTournamentScheduleStatus } from '../game/tournamentSchedule';
import {
  createEmptyOnlineStats,
  createEmptyTournamentStats,
  MAX_RANKED_POINTS,
  MAX_TOURNAMENT_POINTS,
  sanitizeOnlineStats,
  sanitizeTournamentStats,
  type OnlineStats,
  type TournamentStats,
} from '../types/account';

export const ONLINE_STATS_STORAGE_KEY = 'token_wars_online_stats_v1';
export const TOURNAMENT_STATS_STORAGE_KEY = 'token_wars_tournament_stats_v1';

function parseOnlineStats(raw: string | null): OnlineStats {
  if (!raw) return createEmptyOnlineStats();
  try {
    return sanitizeOnlineStats(JSON.parse(raw));
  } catch {
    return createEmptyOnlineStats();
  }
}

function parseTournamentStats(raw: string | null): TournamentStats {
  if (!raw) return createEmptyTournamentStats();
  try {
    return sanitizeTournamentStats(JSON.parse(raw));
  } catch {
    return createEmptyTournamentStats();
  }
}

function alignTournamentStatsToCycle(stats: TournamentStats, activeCycleId: string): TournamentStats {
  if (stats.cycleId === activeCycleId) return stats;
  return {
    ...stats,
    cycleId: activeCycleId,
    points: 0,
    wins: 0,
    losses: 0,
    streak: 0,
  };
}

function readOnlineStatsFromStorage(): OnlineStats {
  if (typeof window === 'undefined') return createEmptyOnlineStats();
  try {
    return parseOnlineStats(window.localStorage.getItem(ONLINE_STATS_STORAGE_KEY));
  } catch {
    return createEmptyOnlineStats();
  }
}

function readTournamentStatsFromStorage(): TournamentStats {
  if (typeof window === 'undefined') return createEmptyTournamentStats();
  try {
    const parsed = parseTournamentStats(window.localStorage.getItem(TOURNAMENT_STATS_STORAGE_KEY));
    const schedule = getTournamentScheduleStatus();
    return schedule.isActive ? alignTournamentStatsToCycle(parsed, schedule.cycleId) : parsed;
  } catch {
    return createEmptyTournamentStats();
  }
}

function writeOnlineStatsToStorage(stats: OnlineStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONLINE_STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

function writeTournamentStatsToStorage(stats: TournamentStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOURNAMENT_STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

interface UseOnlineStatsOptions {
  cloudOnlineStats?: OnlineStats | null;
  cloudTournamentStats?: TournamentStats | null;
  isCloudAuthenticated?: boolean;
  onSaveCloudOnlineStats?: (next: OnlineStats) => Promise<void>;
  onSaveCloudTournamentStats?: (next: TournamentStats) => Promise<void>;
}

export function useOnlineStats(options: UseOnlineStatsOptions = {}) {
  const {
    cloudOnlineStats = null,
    cloudTournamentStats = null,
    isCloudAuthenticated = false,
    onSaveCloudOnlineStats,
    onSaveCloudTournamentStats,
  } = options;

  const [onlineStats, setOnlineStats] = useState<OnlineStats>(() => readOnlineStatsFromStorage());
  const [tournamentStats, setTournamentStats] = useState<TournamentStats>(() =>
    readTournamentStatsFromStorage()
  );

  const statsRef = useRef<OnlineStats>(onlineStats);
  statsRef.current = onlineStats;

  const tournamentRef = useRef<TournamentStats>(tournamentStats);
  tournamentRef.current = tournamentStats;

  const isCloudAuthRef = useRef(isCloudAuthenticated);
  isCloudAuthRef.current = isCloudAuthenticated;

  const saveCloudRef = useRef(onSaveCloudOnlineStats);
  saveCloudRef.current = onSaveCloudOnlineStats;

  const saveCloudTournamentRef = useRef(onSaveCloudTournamentStats);
  saveCloudTournamentRef.current = onSaveCloudTournamentStats;

  useEffect(() => {
    if (isCloudAuthenticated && cloudOnlineStats) {
      const clean = sanitizeOnlineStats(cloudOnlineStats);
      statsRef.current = clean;
      setOnlineStats(clean);
      writeOnlineStatsToStorage(clean);
    }
  }, [cloudOnlineStats, isCloudAuthenticated]);

  useEffect(() => {
    if (isCloudAuthenticated && cloudTournamentStats) {
      const clean = sanitizeTournamentStats(cloudTournamentStats);
      const schedule = getTournamentScheduleStatus();
      const aligned = schedule.isActive
        ? alignTournamentStatsToCycle(clean, schedule.cycleId)
        : clean;
      tournamentRef.current = aligned;
      setTournamentStats(aligned);
      writeTournamentStatsToStorage(aligned);
    }
  }, [cloudTournamentStats, isCloudAuthenticated]);

  useEffect(() => {
    writeOnlineStatsToStorage(onlineStats);
  }, [onlineStats]);

  useEffect(() => {
    writeTournamentStatsToStorage(tournamentStats);
  }, [tournamentStats]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ONLINE_STATS_STORAGE_KEY && !isCloudAuthRef.current) {
        const next = parseOnlineStats(event.newValue);
        statsRef.current = next;
        setOnlineStats(next);
      } else if (event.key === TOURNAMENT_STATS_STORAGE_KEY && !isCloudAuthRef.current) {
        const next = parseTournamentStats(event.newValue);
        tournamentRef.current = next;
        setTournamentStats(next);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const recordOnlineSeriesResult = useCallback(
    (
      queueType: OnlineQueueType,
      won: boolean,
      serverNewValue?: number,
      tournamentCycleId?: string
    ) => {
      if (queueType === 'tournament') {
        const cycleId = tournamentCycleId || getTournamentScheduleStatus().cycleId;
        const base = alignTournamentStatsToCycle(tournamentRef.current, cycleId);
        const nextPoints =
          typeof serverNewValue === 'number' && Number.isFinite(serverNewValue)
            ? Math.max(0, Math.min(MAX_TOURNAMENT_POINTS, Math.floor(serverNewValue)))
            : base.points;

        const nextTournament: TournamentStats = {
          cycleId,
          points: nextPoints,
          wins: base.wins + (won ? 1 : 0),
          losses: base.losses + (won ? 0 : 1),
          streak: won ? base.streak + 1 : 0,
          bestPoints: Math.max(base.bestPoints, nextPoints),
          careerWins: base.careerWins + (won ? 1 : 0),
          careerLosses: base.careerLosses + (won ? 0 : 1),
          trophies: base.trophies + (won && base.wins === 0 ? 1 : 0),
        };

        tournamentRef.current = nextTournament;
        setTournamentStats(nextTournament);
        writeTournamentStatsToStorage(nextTournament);

        if (isCloudAuthRef.current && saveCloudTournamentRef.current) {
          void saveCloudTournamentRef.current(nextTournament);
        }
        return;
      }

      const prev = statsRef.current;
      let next: OnlineStats;

      if (queueType === 'casual') {
        next = {
          ...prev,
          casualWins: prev.casualWins + (won ? 1 : 0),
          casualLosses: prev.casualLosses + (won ? 0 : 1),
        };
      } else {
        const clampedRp =
          typeof serverNewValue === 'number' && Number.isFinite(serverNewValue)
            ? Math.max(0, Math.min(MAX_RANKED_POINTS, Math.floor(serverNewValue)))
            : prev.rankedPoints;
        next = {
          ...prev,
          rankedWins: prev.rankedWins + (won ? 1 : 0),
          rankedLosses: prev.rankedLosses + (won ? 0 : 1),
          rankedPoints: clampedRp,
          rankedStreak: won ? prev.rankedStreak + 1 : 0,
        };
      }

      statsRef.current = next;
      setOnlineStats(next);
      writeOnlineStatsToStorage(next);

      if (isCloudAuthRef.current && saveCloudRef.current) {
        void saveCloudRef.current(next);
      }
    },
    []
  );

  return {
    onlineStats,
    tournamentStats,
    recordOnlineSeriesResult,
  };
}
