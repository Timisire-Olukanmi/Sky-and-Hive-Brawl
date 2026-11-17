import { useCallback, useEffect, useState } from 'react';
import type { PlayMode } from '../game/types';

export const SCOREBOARD_STORAGE_KEY = 'sky_hive_brawl_scoreboard_v1';

export interface PlayerRecord {
  wins: number;
  losses: number;
}

export interface ScoreboardStats {
  p1: PlayerRecord;
  p2: PlayerRecord;
  cpu: PlayerRecord;
}

const createEmptyScoreboard = (): ScoreboardStats => ({
  p1: { wins: 0, losses: 0 },
  p2: { wins: 0, losses: 0 },
  cpu: { wins: 0, losses: 0 },
});

function sanitizeRecord(value: unknown): PlayerRecord {
  if (!value || typeof value !== 'object') {
    return { wins: 0, losses: 0 };
  }
  const rec = value as Record<string, unknown>;
  const wins =
    typeof rec.wins === 'number' && Number.isFinite(rec.wins)
      ? Math.max(0, Math.floor(rec.wins))
      : 0;
  const losses =
    typeof rec.losses === 'number' && Number.isFinite(rec.losses)
      ? Math.max(0, Math.floor(rec.losses))
      : 0;
  return { wins, losses };
}

function parseScoreboard(raw: string | null): ScoreboardStats {
  if (!raw) return createEmptyScoreboard();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return createEmptyScoreboard();
    }
    const obj = parsed as Record<string, unknown>;
    return {
      p1: sanitizeRecord(obj.p1),
      p2: sanitizeRecord(obj.p2),
      cpu: sanitizeRecord(obj.cpu),
    };
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

export function usePersistentScoreboard() {
  const [scoreboard, setScoreboard] = useState<ScoreboardStats>(() => readScoreboardFromStorage());

  useEffect(() => {
    writeScoreboardToStorage(scoreboard);
  }, [scoreboard]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SCOREBOARD_STORAGE_KEY) {
        setScoreboard(parseScoreboard(event.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const recordMatchResult = useCallback((winnerSlot: 0 | 1, mode: PlayMode) => {
    setScoreboard((prev) => {
      const opponentKey = mode === '1P_AI' ? 'cpu' : 'p2';
      if (winnerSlot === 0) {
        return {
          ...prev,
          p1: { wins: prev.p1.wins + 1, losses: prev.p1.losses },
          [opponentKey]: {
            wins: prev[opponentKey].wins,
            losses: prev[opponentKey].losses + 1,
          },
        };
      }
      return {
        ...prev,
        p1: { wins: prev.p1.wins, losses: prev.p1.losses + 1 },
        [opponentKey]: {
          wins: prev[opponentKey].wins + 1,
          losses: prev[opponentKey].losses,
        },
      };
    });
  }, []);

  const resetScoreboard = useCallback(() => {
    setScoreboard(createEmptyScoreboard());
  }, []);

  return {
    scoreboard,
    recordMatchResult,
    resetScoreboard,
  };
}
