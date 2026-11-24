import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayMode } from '../game/types';
import {
  createEmptyScoreboard,
  sanitizeScoreboard,
  type PlayerRecord,
  type ScoreboardStats,
} from '../types/account';

export const SCOREBOARD_STORAGE_KEY = 'sky_hive_brawl_scoreboard_v1';

export type { PlayerRecord, ScoreboardStats };

function parseScoreboard(raw: string | null): ScoreboardStats {
  if (!raw) return createEmptyScoreboard();
  try {
    return sanitizeScoreboard(JSON.parse(raw));
  } catch {
    return createEmptyScoreboard();
  }
}

function readScoreboardFromStorage(): ScoreboardStats {
  if (typeof window === 'undefined') return createEmptyScoreboard();
  try {
    return parseScoreboard(window.localStorage.getItem(SCOREBOARD_STORAGE_KEY));
  } catch {
    return createEmptyScoreboard();
  }
}

function writeScoreboardToStorage(stats: ScoreboardStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SCOREBOARD_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

interface UsePersistentScoreboardOptions {
  cloudScoreboard?: ScoreboardStats | null;
  isCloudAuthenticated?: boolean;
  onSaveCloudScoreboard?: (next: ScoreboardStats) => Promise<void>;
}

export function usePersistentScoreboard(options: UsePersistentScoreboardOptions = {}) {
  const { cloudScoreboard = null, isCloudAuthenticated = false, onSaveCloudScoreboard } =
    options;

  const [scoreboard, setScoreboard] = useState<ScoreboardStats>(() => readScoreboardFromStorage());
  const scoreboardRef = useRef<ScoreboardStats>(scoreboard);
  scoreboardRef.current = scoreboard;

  const isCloudAuthRef = useRef(isCloudAuthenticated);
  isCloudAuthRef.current = isCloudAuthenticated;

  const saveCloudRef = useRef(onSaveCloudScoreboard);
  saveCloudRef.current = onSaveCloudScoreboard;

  useEffect(() => {
    if (isCloudAuthenticated && cloudScoreboard) {
      const clean = sanitizeScoreboard(cloudScoreboard);
      scoreboardRef.current = clean;
      setScoreboard(clean);
      writeScoreboardToStorage(clean);
    }
  }, [cloudScoreboard, isCloudAuthenticated]);

  useEffect(() => {
    writeScoreboardToStorage(scoreboard);
  }, [scoreboard]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SCOREBOARD_STORAGE_KEY && !isCloudAuthRef.current) {
        const next = parseScoreboard(event.newValue);
        scoreboardRef.current = next;
        setScoreboard(next);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const recordMatchResult = useCallback((winnerSlot: 0 | 1, mode: PlayMode) => {
    if (mode === 'TRAINING') return;
    const prev = scoreboardRef.current;
    const opponentKey = mode === '1P_AI' ? 'cpu' : 'p2';
    const next: ScoreboardStats =
      winnerSlot === 0
        ? {
            ...prev,
            p1: {
              wins: prev.p1.wins + 1,
              losses: prev.p1.losses,
              currentStreak: prev.p1.currentStreak + 1,
            },
            [opponentKey]: {
              wins: prev[opponentKey].wins,
              losses: prev[opponentKey].losses + 1,
              currentStreak: 0,
            },
          }
        : {
            ...prev,
            p1: {
              wins: prev.p1.wins,
              losses: prev.p1.losses + 1,
              currentStreak: 0,
            },
            [opponentKey]: {
              wins: prev[opponentKey].wins + 1,
              losses: prev[opponentKey].losses,
              currentStreak: prev[opponentKey].currentStreak + 1,
            },
          };

    scoreboardRef.current = next;
    setScoreboard(next);
    writeScoreboardToStorage(next);

    if (isCloudAuthRef.current && saveCloudRef.current) {
      void saveCloudRef.current(next);
    }
  }, []);

  const resetScoreboard = useCallback(() => {
    const empty = createEmptyScoreboard();
    scoreboardRef.current = empty;
    setScoreboard(empty);
    writeScoreboardToStorage(empty);

    if (isCloudAuthRef.current && saveCloudRef.current) {
      void saveCloudRef.current(empty);
    }
  }, []);

  return {
    scoreboard,
    recordMatchResult,
    resetScoreboard,
  };
}
