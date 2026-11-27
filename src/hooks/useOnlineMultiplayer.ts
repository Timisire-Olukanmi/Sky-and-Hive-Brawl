import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TARGET_SERIES_WINS,
  type ClientWsMessage,
  type OnlineInputActions,
  type OnlinePlayerMeta,
  type OnlineQueueType,
  type OnlineRoundPhase,
  type SerializedEngineSnapshot,
  type ServerWsMessage,
  type SoundEvent,
  type TournamentStateSnapshot,
  type WaitingAreaKind,
  type WaitingAreaSnapshot,
} from '../game/onlineTypes';
import { getTournamentScheduleStatus } from '../game/tournamentSchedule';
import type { FighterId, HudFighterSnapshot, MapId } from '../game/types';
import type { MapSelection } from '../types/account';

export interface PresenceMeta {
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

export interface ActiveOnlineMatchInfo {
  matchId: string;
  queueType: OnlineQueueType;
  yourSlot: 0 | 1;
  mapId: MapId;
  targetWins: number;
  round: number;
  scores: [number, number];
  roundPhase: OnlineRoundPhase;
  roundTimer: number;
  lastRoundWinnerSlot: 0 | 1 | null;
  players: [OnlinePlayerMeta, OnlinePlayerMeta];
  tournamentCycleId?: string;
  tournamentTitle?: string;
}

export interface OnlineSeriesResult {
  matchId: string;
  queueType: OnlineQueueType;
  yourSlot: 0 | 1;
  winnerSlot: 0 | 1;
  reason: 'ko' | 'forfeit';
  scores: [number, number];
  finalPlayers: [HudFighterSnapshot, HudFighterSnapshot];
  playerNames: [string, string];
  playerRanks: [number, number];
  mapId: MapId;
  matchDurationSec: number;
  rpDelta: [number, number];
  newRp: [number, number];
  tpDelta: [number, number];
  newTp: [number, number];
  tournamentCycleId?: string;
}

interface UseOnlineMultiplayerCallbacks {
  onMatchStarted?: (info: ActiveOnlineMatchInfo) => void;
  onMatchState?: (
    snapshot: SerializedEngineSnapshot,
    sounds: SoundEvent[],
    meta: {
      round: number;
      scores: [number, number];
      roundPhase: OnlineRoundPhase;
      roundTimer: number;
      lastRoundWinnerSlot: 0 | 1 | null;
    }
  ) => void;
  onSeriesOver?: (result: OnlineSeriesResult) => void;
}

const EMPTY_WAITING_SNAPSHOT: WaitingAreaSnapshot = {
  casualWaiting: [],
  rankedWaiting: [],
  tournamentWaiting: [],
  casualInMatchCount: 0,
  rankedInMatchCount: 0,
  tournamentInMatchCount: 0,
};

function createInitialTournamentSnapshot(): TournamentStateSnapshot {
  const s = getTournamentScheduleStatus();
  return {
    serverNowMs: s.nowMs,
    cycleNumber: s.cycleNumber,
    cycleId: s.cycleId,
    title: s.title,
    isActive: s.isActive,
    activeWindowStartMs: s.activeWindowStartMs,
    activeWindowEndMs: s.activeWindowEndMs,
    nextTournamentStartMs: s.nextTournamentStartMs,
    nextTournamentEndMs: s.nextTournamentEndMs,
    msUntilTransition: s.msUntilTransition,
    progressPct: s.progressPct,
    upcomingWindows: s.upcomingWindows,
    standings: [],
    lastCycleId: s.previousCycleId,
    lastCycleTitle: s.previousCycleTitle,
    lastStandings: [],
    activeMatches: [],
    recentMatches: [],
  };
}

export function useOnlineMultiplayer(callbacks: UseOnlineMultiplayerCallbacks = {}) {
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [waitingSnapshot, setWaitingSnapshot] =
    useState<WaitingAreaSnapshot>(EMPTY_WAITING_SNAPSHOT);
  const [tournamentSnapshot, setTournamentSnapshot] = useState<TournamentStateSnapshot>(() =>
    createInitialTournamentSnapshot()
  );
  const [inQueue, setInQueue] = useState<OnlineQueueType | null>(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueEnteredAt, setQueueEnteredAt] = useState<number | null>(null);
  const [activeMatch, setActiveMatch] = useState<ActiveOnlineMatchInfo | null>(null);
  const [seriesResult, setSeriesResult] = useState<OnlineSeriesResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputSeqRef = useRef(0);
  const activeMatchRef = useRef<ActiveOnlineMatchInfo | null>(null);
  activeMatchRef.current = activeMatch;

  const desiredPresenceRef = useRef<{ area: WaitingAreaKind; meta: PresenceMeta } | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const sendRaw = useCallback((msg: ClientWsMessage): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 800;

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        backoffMs = 800;
        setConnected(true);
        setErrorMessage(null);
        if (desiredPresenceRef.current) {
          sendRaw({
            type: 'presence:enter',
            area: desiredPresenceRef.current.area,
            ...desiredPresenceRef.current.meta,
          });
        }
      };

      ws.onmessage = (event) => {
        let msg: ServerWsMessage;
        try {
          msg = JSON.parse(String(event.data)) as ServerWsMessage;
        } catch {
          return;
        }

        switch (msg.type) {
          case 'connected':
            setClientId(msg.clientId);
            setWaitingSnapshot(msg.snapshot);
            if (msg.tournament) setTournamentSnapshot(msg.tournament);
            break;

          case 'presence:update':
            setWaitingSnapshot(msg.snapshot);
            break;

          case 'tournament:update':
            setTournamentSnapshot(msg.tournament);
            break;

          case 'queue:status':
            setInQueue(msg.inQueue);
            setQueuePosition(msg.position);
            setQueueEnteredAt(msg.enteredAt);
            break;

          case 'match:started': {
            const info: ActiveOnlineMatchInfo = {
              matchId: msg.matchId,
              queueType: msg.queueType,
              yourSlot: msg.yourSlot,
              mapId: msg.mapId,
              targetWins: msg.targetWins || TARGET_SERIES_WINS,
              round: msg.round,
              scores: msg.scores,
              roundPhase: 'intro',
              roundTimer: 1.5,
              lastRoundWinnerSlot: null,
              players: msg.players,
              tournamentCycleId: msg.tournamentCycleId,
              tournamentTitle: msg.tournamentTitle,
            };
            activeMatchRef.current = info;
            setActiveMatch(info);
            setSeriesResult(null);
            setInQueue(null);
            setQueuePosition(0);
            setQueueEnteredAt(null);
            callbacksRef.current.onMatchStarted?.(info);
            break;
          }

          case 'match:state': {
            const prev = activeMatchRef.current;
            if (prev && prev.matchId === msg.matchId) {
              const shouldUpdateInfo =
                prev.round !== msg.round ||
                prev.scores[0] !== msg.scores[0] ||
                prev.scores[1] !== msg.scores[1] ||
                prev.roundPhase !== msg.roundPhase ||
                prev.lastRoundWinnerSlot !== msg.lastRoundWinnerSlot;
              if (shouldUpdateInfo) {
                const updated: ActiveOnlineMatchInfo = {
                  ...prev,
                  round: msg.round,
                  scores: msg.scores,
                  roundPhase: msg.roundPhase,
                  roundTimer: msg.roundTimer,
                  lastRoundWinnerSlot: msg.lastRoundWinnerSlot,
                };
                activeMatchRef.current = updated;
                setActiveMatch(updated);
              }
            }
            callbacksRef.current.onMatchState?.(msg.state, msg.sounds, {
              round: msg.round,
              scores: msg.scores,
              roundPhase: msg.roundPhase,
              roundTimer: msg.roundTimer,
              lastRoundWinnerSlot: msg.lastRoundWinnerSlot,
            });
            break;
          }

          case 'match:series_over': {
            const currentMatch = activeMatchRef.current;
            const yourSlot: 0 | 1 = currentMatch?.yourSlot ?? 0;
            const mapId: MapId = currentMatch?.mapId ?? 'hive_canopy';
            const playerNames: [string, string] = currentMatch
              ? [currentMatch.players[0].displayName, currentMatch.players[1].displayName]
              : [msg.finalPlayers[0].name, msg.finalPlayers[1].name];
            const playerRanks: [number, number] = currentMatch
              ? [currentMatch.players[0].rankedPoints, currentMatch.players[1].rankedPoints]
              : msg.newRp;

            const result: OnlineSeriesResult = {
              matchId: msg.matchId,
              queueType: msg.queueType,
              yourSlot,
              winnerSlot: msg.winnerSlot,
              reason: msg.reason,
              scores: msg.scores,
              finalPlayers: msg.finalPlayers,
              playerNames,
              playerRanks,
              mapId,
              matchDurationSec: msg.matchDurationSec,
              rpDelta: msg.rpDelta,
              newRp: msg.newRp,
              tpDelta: msg.tpDelta ?? [0, 0],
              newTp: msg.newTp ?? [0, 0],
              tournamentCycleId: msg.tournamentCycleId ?? currentMatch?.tournamentCycleId,
            };
            activeMatchRef.current = null;
            setActiveMatch(null);
            setSeriesResult(result);
            callbacksRef.current.onSeriesOver?.(result);
            break;
          }

          case 'error':
            setErrorMessage(msg.message);
            break;
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        setConnected(false);
        setInQueue(null);
        setQueuePosition(0);
        setQueueEnteredAt(null);
        if (!disposed) {
          reconnectTimer = setTimeout(() => {
            backoffMs = Math.min(5000, backoffMs * 1.5);
            connect();
          }, backoffMs);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sendRaw]);

  const enterWaitingArea = useCallback(
    (area: WaitingAreaKind, meta: PresenceMeta) => {
      desiredPresenceRef.current = { area, meta };
      sendRaw({
        type: 'presence:enter',
        area,
        ...meta,
      });
    },
    [sendRaw]
  );

  const joinQueue = useCallback(
    (queue: OnlineQueueType, meta: PresenceMeta) => {
      desiredPresenceRef.current = { area: queue, meta };
      setErrorMessage(null);
      const sent = sendRaw({
        type: 'queue:join',
        queue,
        ...meta,
      });
      if (!sent) {
        setErrorMessage('Connecting to multiplayer server — try again in a moment.');
      }
    },
    [sendRaw]
  );

  const leaveQueue = useCallback(() => {
    setInQueue(null);
    setQueuePosition(0);
    setQueueEnteredAt(null);
    sendRaw({ type: 'queue:leave' });
  }, [sendRaw]);

  const sendMatchInput = useCallback(
    (
      matchId: string,
      moveDir: number,
      jumpHeld: boolean,
      downHeld: boolean,
      actions: OnlineInputActions
    ) => {
      inputSeqRef.current += 1;
      sendRaw({
        type: 'match:input',
        matchId,
        seq: inputSeqRef.current,
        moveDir,
        jumpHeld,
        downHeld,
        actions,
      });
    },
    [sendRaw]
  );

  const leaveMatch = useCallback(
    (matchId?: string) => {
      const targetId = matchId ?? activeMatchRef.current?.matchId;
      if (!targetId) return;
      sendRaw({ type: 'match:leave', matchId: targetId });
      activeMatchRef.current = null;
      setActiveMatch(null);
    },
    [sendRaw]
  );

  const clearSeriesResult = useCallback(() => {
    setSeriesResult(null);
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return {
    connected,
    clientId,
    waitingSnapshot,
    tournamentSnapshot,
    inQueue,
    queuePosition,
    queueEnteredAt,
    activeMatch,
    seriesResult,
    errorMessage,
    enterWaitingArea,
    joinQueue,
    leaveQueue,
    sendMatchInput,
    leaveMatch,
    clearSeriesResult,
    clearError,
  };
}
