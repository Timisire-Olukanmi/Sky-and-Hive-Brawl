import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { auth, db } from '../firebase';
import {
  applyInputPacket,
  buildWaitingSnapshotFromPresence,
  clearCloudPresenceOnExit,
  computeSeriesRewards,
  createCloudMatchRoom,
  createHostSimulationController,
  ensureCloudAuthUid,
  getOrCreateSessionRoomCode,
  HEARTBEAT_INTERVAL_MS,
  ICE_SERVERS,
  isPresenceAlive,
  pushMatchIceCandidate,
  sanitizeName,
  sanitizeRoomCode,
  subscribeLastTournamentStandings,
  subscribeTournamentCycleData,
  timestampToMs,
  updateCloudMatchFields,
  upsertTournamentStanding,
  writeCloudPresence,
  type CloudMatchDoc,
  type CloudPresenceDoc,
  type HostSimulationController,
  type RelayGuestInputEnvelope,
  type RelaySeriesOverEnvelope,
  type RelayStateEnvelope,
} from '../game/cloudMultiplayer';
import {
  ONLINE_ROUND_STOCKS,
  TARGET_SERIES_WINS,
  type OnlineInputActions,
  type OnlinePlayerMeta,
  type OnlineQueueType,
  type OnlineRoundPhase,
  type SerializedEngineSnapshot,
  type SoundEvent,
  type TournamentMatchRecord,
  type TournamentStandingEntry,
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

function buildPresencePayload(
  area: WaitingAreaKind,
  queue: WaitingAreaKind,
  status: 'waiting' | 'queued' | 'in_match',
  meta: PresenceMeta,
  matchId: string,
  roomCode: string,
  queueEnteredAt: number
): Omit<CloudPresenceDoc, 'uid' | 'heartbeatAt' | 'updatedAt'> {
  const schedule = getTournamentScheduleStatus();
  const cycleId =
    meta.tournamentCycleId && /^(cycle_[0-9]+|none)$/.test(meta.tournamentCycleId)
      ? meta.tournamentCycleId
      : schedule.cycleId;
  return {
    displayName: sanitizeName(meta.displayName, 'Fighter'),
    area,
    queue,
    status,
    fighterId: meta.fighterId,
    preferredMap: meta.preferredMap,
    rankedPoints: Math.max(0, Math.min(10_000, Math.round(meta.rankedPoints || 1000))),
    tournamentPoints: Math.max(0, Math.min(100_000, Math.round(meta.tournamentPoints || 0))),
    tournamentWins: Math.max(0, Math.min(1_000_000, Math.round(meta.tournamentWins || 0))),
    tournamentLosses: Math.max(0, Math.min(1_000_000, Math.round(meta.tournamentLosses || 0))),
    tournamentStreak: Math.max(0, Math.min(1_000_000, Math.round(meta.tournamentStreak || 0))),
    tournamentCycleId: cycleId,
    matchId,
    roomCode: area === 'casual' ? roomCode : '',
    queueEnteredAt,
  };
}

export function useOnlineMultiplayer(callbacks: UseOnlineMultiplayerCallbacks = {}) {
  const [authUid, setAuthUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  const [cloudReady, setCloudReady] = useState(false);
  const [roomCode] = useState<string>(() => getOrCreateSessionRoomCode());
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

  const authUidRef = useRef<string | null>(authUid);
  authUidRef.current = authUid;
  const inQueueRef = useRef<OnlineQueueType | null>(inQueue);
  inQueueRef.current = inQueue;
  const queueEnteredAtRef = useRef<number | null>(queueEnteredAt);
  queueEnteredAtRef.current = queueEnteredAt;
  const activeMatchRef = useRef<ActiveOnlineMatchInfo | null>(null);
  activeMatchRef.current = activeMatch;

  const desiredPresenceRef = useRef<{ area: WaitingAreaKind; meta: PresenceMeta } | null>(null);
  const presenceDocsRef = useRef<CloudPresenceDoc[]>([]);
  const ignoredMatchIdsRef = useRef<Set<string>>(new Set());
  const matchStartingRef = useRef(false);
  const inputSeqRef = useRef(0);
  const lastGuestRelayWriteMsRef = useRef(0);
  const guestInputFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingGuestInputRef = useRef<RelayGuestInputEnvelope | null>(null);

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const sessionCleanupRef = useRef<(() => void) | null>(null);
  const hostControllerRef = useRef<HostSimulationController | null>(null);
  const rtcDataChannelRef = useRef<RTCDataChannel | null>(null);

  const tournamentDataRef = useRef<{
    standings: TournamentStandingEntry[];
    lastStandings: TournamentStandingEntry[];
    activeMatches: TournamentMatchRecord[];
    recentMatches: TournamentMatchRecord[];
  }>({
    standings: [],
    lastStandings: [],
    activeMatches: [],
    recentMatches: [],
  });

  const refreshTournamentState = useCallback(() => {
    const s = getTournamentScheduleStatus();
    setTournamentSnapshot({
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
      standings: tournamentDataRef.current.standings,
      lastCycleId: s.previousCycleId,
      lastCycleTitle: s.previousCycleTitle,
      lastStandings: tournamentDataRef.current.lastStandings,
      activeMatches: tournamentDataRef.current.activeMatches,
      recentMatches: tournamentDataRef.current.recentMatches,
    });
  }, []);

  const syncMyPresence = useCallback(
    async (
      uidOverride?: string | null,
      override?: {
        area?: WaitingAreaKind;
        queue?: WaitingAreaKind;
        status?: 'waiting' | 'queued' | 'in_match';
        matchId?: string;
        queueEnteredAt?: number;
      }
    ) => {
      const uid = uidOverride ?? authUidRef.current;
      const desired = desiredPresenceRef.current;
      if (!uid || !desired) return;
      const area = override?.area ?? desired.area;
      const queue = override?.queue ?? (inQueueRef.current ?? 'none');
      const matchId = override?.matchId ?? (activeMatchRef.current?.matchId ?? '');
      const status =
        override?.status ?? (matchId ? 'in_match' : queue !== 'none' ? 'queued' : 'waiting');
      const qTime = override?.queueEnteredAt ?? (queueEnteredAtRef.current ?? 0);

      const payload = buildPresencePayload(
        area,
        queue,
        status,
        desired.meta,
        matchId,
        roomCode,
        qTime
      );
      try {
        await writeCloudPresence(uid, payload);
      } catch {
        // Presence write error surfaced gently only when trying to matchmake
      }
    },
    [roomCode]
  );

  // Track Firebase Auth UID
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const nextUid = user?.uid ?? null;
      setAuthUid(nextUid);
      if (nextUid) {
        setCloudReady(true);
        void syncMyPresence(nextUid);
      } else {
        setCloudReady(false);
      }
    });
    return () => unsub();
  }, [syncMyPresence]);

  // Keep tournament schedule ticks fresh and subscribe to cloud tournament cycle
  useEffect(() => {
    refreshTournamentState();
    const timer = setInterval(refreshTournamentState, 10_000);
    return () => clearInterval(timer);
  }, [refreshTournamentState]);

  useEffect(() => {
    if (!authUid) return;
    const schedule = getTournamentScheduleStatus();
    const unsubCurrent = subscribeTournamentCycleData(
      schedule.cycleId,
      (standings) => {
        tournamentDataRef.current.standings = standings;
        refreshTournamentState();
      },
      (activeMatches, recentMatches) => {
        tournamentDataRef.current.activeMatches = activeMatches;
        tournamentDataRef.current.recentMatches = recentMatches;
        refreshTournamentState();
      }
    );
    const unsubLast = subscribeLastTournamentStandings(schedule.previousCycleId, (last) => {
      tournamentDataRef.current.lastStandings = last;
      refreshTournamentState();
    });
    return () => {
      unsubCurrent();
      unsubLast();
    };
  }, [authUid, refreshTournamentState]);

  const cleanupCurrentSession = useCallback(() => {
    if (guestInputFlushTimerRef.current) {
      clearTimeout(guestInputFlushTimerRef.current);
      guestInputFlushTimerRef.current = null;
    }
    pendingGuestInputRef.current = null;
    if (hostControllerRef.current) {
      hostControllerRef.current.dispose();
      hostControllerRef.current = null;
    }
    if (rtcDataChannelRef.current) {
      try {
        rtcDataChannelRef.current.close();
      } catch {
        // Ignore close error
      }
      rtcDataChannelRef.current = null;
    }
    if (sessionCleanupRef.current) {
      sessionCleanupRef.current();
      sessionCleanupRef.current = null;
    }
  }, []);

  const handleCompleteSeries = useCallback(
    (overEnv: RelaySeriesOverEnvelope, matchInfoSnapshot: ActiveOnlineMatchInfo | null) => {
      const targetId = overEnv.matchId;
      ignoredMatchIdsRef.current.add(targetId);
      cleanupCurrentSession();

      const currentMatch = activeMatchRef.current ?? matchInfoSnapshot;
      const yourSlot: 0 | 1 = currentMatch?.yourSlot ?? 0;
      const mapId: MapId = currentMatch?.mapId ?? 'hive_canopy';
      const playerNames: [string, string] = currentMatch
        ? [currentMatch.players[0].displayName, currentMatch.players[1].displayName]
        : [overEnv.finalPlayers[0].name, overEnv.finalPlayers[1].name];
      const playerRanks: [number, number] = currentMatch
        ? [currentMatch.players[0].rankedPoints, currentMatch.players[1].rankedPoints]
        : overEnv.newRp;

      const result: OnlineSeriesResult = {
        matchId: overEnv.matchId,
        queueType: overEnv.queueType,
        yourSlot,
        winnerSlot: overEnv.winnerSlot,
        reason: overEnv.reason,
        scores: overEnv.scores,
        finalPlayers: overEnv.finalPlayers,
        playerNames,
        playerRanks,
        mapId,
        matchDurationSec: overEnv.matchDurationSec,
        rpDelta: overEnv.rpDelta,
        newRp: overEnv.newRp,
        tpDelta: overEnv.tpDelta,
        newTp: overEnv.newTp,
        tournamentCycleId: overEnv.tournamentCycleId ?? currentMatch?.tournamentCycleId,
      };

      activeMatchRef.current = null;
      setActiveMatch(null);
      setInQueue(null);
      setQueuePosition(0);
      setQueueEnteredAt(null);
      setSeriesResult(result);

      if (
        result.queueType === 'tournament' &&
        result.tournamentCycleId &&
        authUidRef.current
      ) {
        const myUid = authUidRef.current;
        const won = result.winnerSlot === yourSlot;
        const desiredMeta = desiredPresenceRef.current?.meta;
        const prevWins = desiredMeta?.tournamentWins ?? 0;
        const prevLosses = desiredMeta?.tournamentLosses ?? 0;
        const prevStreak = desiredMeta?.tournamentStreak ?? 0;
        void upsertTournamentStanding(result.tournamentCycleId, {
          playerKey: myUid,
          displayName: playerNames[yourSlot],
          fighterId: currentMatch?.players[yourSlot].fighterId ?? desiredMeta?.fighterId ?? 'honey_shell',
          points: result.newTp[yourSlot],
          wins: prevWins + (won ? 1 : 0),
          losses: prevLosses + (won ? 0 : 1),
          streak: won ? prevStreak + 1 : 0,
        }).catch(() => {});
      }

      void syncMyPresence(authUidRef.current, {
        status: 'waiting',
        queue: 'none',
        matchId: '',
        queueEnteredAt: 0,
      });

      callbacksRef.current.onSeriesOver?.(result);
    },
    [cleanupCurrentSession, syncMyPresence]
  );

  const startMatchSession = useCallback(
    (matchDoc: CloudMatchDoc, myUid: string) => {
      if (ignoredMatchIdsRef.current.has(matchDoc.matchId)) return;
      if (activeMatchRef.current?.matchId === matchDoc.matchId) return;

      cleanupCurrentSession();

      const yourSlot: 0 | 1 = matchDoc.hostUid === myUid ? 0 : 1;
      const role: 'host' | 'guest' = yourSlot === 0 ? 'host' : 'guest';
      const metas: [OnlinePlayerMeta, OnlinePlayerMeta] = [
        {
          clientId: matchDoc.hostUid,
          accountUid: matchDoc.hostUid,
          displayName: matchDoc.p0Name,
          fighterId: matchDoc.p0Fighter,
          rankedPoints: matchDoc.p0Rp,
          tournamentPoints: matchDoc.p0Tp,
        },
        {
          clientId: matchDoc.guestUid,
          accountUid: matchDoc.guestUid,
          displayName: matchDoc.p1Name,
          fighterId: matchDoc.p1Fighter,
          rankedPoints: matchDoc.p1Rp,
          tournamentPoints: matchDoc.p1Tp,
        },
      ];

      const info: ActiveOnlineMatchInfo = {
        matchId: matchDoc.matchId,
        queueType: matchDoc.queueType,
        yourSlot,
        mapId: matchDoc.mapId,
        targetWins: TARGET_SERIES_WINS,
        round: 1,
        scores: [0, 0],
        roundPhase: 'intro',
        roundTimer: 1.5,
        lastRoundWinnerSlot: null,
        players: metas,
        tournamentCycleId:
          matchDoc.tournamentCycleId !== 'none' ? matchDoc.tournamentCycleId : undefined,
        tournamentTitle: matchDoc.tournamentTitle || undefined,
      };

      activeMatchRef.current = info;
      setActiveMatch(info);
      setSeriesResult(null);
      setInQueue(null);
      setQueuePosition(0);
      setQueueEnteredAt(null);
      setErrorMessage(null);
      callbacksRef.current.onMatchStarted?.(info);

      void syncMyPresence(myUid, {
        area: matchDoc.queueType,
        queue: 'none',
        status: 'in_match',
        matchId: matchDoc.matchId,
        queueEnteredAt: 0,
      });

      let disposed = false;
      let seriesEnded = false;
      let remoteDescSet = false;
      let appliedOfferOrAnswer = false;
      let lastAppliedStateSeq = 0;
      let lastAppliedGuestInputSeq = 0;
      const pendingRemoteIce: RTCIceCandidateInit[] = [];
      const seenIceIds = new Set<string>();

      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (ev) => {
        if (disposed || !ev.candidate) return;
        void pushMatchIceCandidate(matchDoc.matchId, myUid, ev.candidate.toJSON());
      };

      const flushPendingIce = async () => {
        if (!remoteDescSet || disposed) return;
        while (pendingRemoteIce.length > 0) {
          const c = pendingRemoteIce.shift();
          if (!c) continue;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {
            // Ignore duplicate or invalid ICE
          }
        }
      };

      const handleIncomingStateEnvelope = (env: RelayStateEnvelope) => {
        if (disposed || seriesEnded) return;
        if (env.seq <= lastAppliedStateSeq) return;
        lastAppliedStateSeq = env.seq;

        const prev = activeMatchRef.current;
        if (prev && prev.matchId === matchDoc.matchId) {
          if (
            prev.round !== env.round ||
            prev.scores[0] !== env.scores[0] ||
            prev.scores[1] !== env.scores[1] ||
            prev.roundPhase !== env.roundPhase ||
            prev.lastRoundWinnerSlot !== env.lastRoundWinnerSlot
          ) {
            const updated: ActiveOnlineMatchInfo = {
              ...prev,
              round: env.round,
              scores: env.scores,
              roundPhase: env.roundPhase,
              roundTimer: env.roundTimer,
              lastRoundWinnerSlot: env.lastRoundWinnerSlot,
            };
            activeMatchRef.current = updated;
            setActiveMatch(updated);
          }
        }

        callbacksRef.current.onMatchState?.(env.state, env.sounds, {
          round: env.round,
          scores: env.scores,
          roundPhase: env.roundPhase,
          roundTimer: env.roundTimer,
          lastRoundWinnerSlot: env.lastRoundWinnerSlot,
        });
      };

      const handleIncomingSeriesOver = (env: RelaySeriesOverEnvelope) => {
        if (disposed || seriesEnded) return;
        seriesEnded = true;
        handleCompleteSeries(env, info);
      };

      if (role === 'host') {
        const dc = pc.createDataChannel('skyhive-sync', { ordered: true });
        rtcDataChannelRef.current = dc;

        dc.onmessage = (ev) => {
          if (disposed || seriesEnded) return;
          try {
            const pkt = JSON.parse(String(ev.data)) as RelayGuestInputEnvelope;
            if (pkt.seq > lastAppliedGuestInputSeq) {
              lastAppliedGuestInputSeq = pkt.seq;
              hostControllerRef.current?.pushGuestInput(
                pkt.moveDir,
                pkt.jumpHeld,
                pkt.downHeld,
                pkt.actions
              );
            }
          } catch {
            // Ignore malformed DC message
          }
        };

        const sendRtc = (msg: RelayStateEnvelope | RelaySeriesOverEnvelope): boolean => {
          if (dc.readyState !== 'open') return false;
          try {
            dc.send(JSON.stringify(msg));
            return true;
          } catch {
            return false;
          }
        };

        hostControllerRef.current = createHostSimulationController({
          matchDoc,
          metas,
          sendRtcMessage: sendRtc,
          onEmitLocalState: handleIncomingStateEnvelope,
          onEmitSeriesOver: handleIncomingSeriesOver,
        });

        void (async () => {
          try {
            const offer = await pc.createOffer();
            if (disposed) return;
            await pc.setLocalDescription(offer);
            await updateCloudMatchFields(matchDoc.matchId, {
              status: 'active',
              offerSdp: JSON.stringify(offer),
            });
          } catch {
            // Fallback relay handles match state cleanly even if WebRTC offer fails
          }
        })();
      } else {
        pc.ondatachannel = (ev) => {
          const dc = ev.channel;
          rtcDataChannelRef.current = dc;
          dc.onmessage = (msgEv) => {
            if (disposed || seriesEnded) return;
            try {
              const pkt = JSON.parse(String(msgEv.data)) as
                | RelayStateEnvelope
                | RelaySeriesOverEnvelope;
              if (pkt.kind === 'state') {
                handleIncomingStateEnvelope(pkt);
              } else if (pkt.kind === 'series_over') {
                handleIncomingSeriesOver(pkt);
              }
            } catch {
              // Ignore malformed DC packet
            }
          };
        };
      }

      const unsubMatchDoc = onSnapshot(doc(db, 'online_matches', matchDoc.matchId), (snap) => {
        if (disposed || seriesEnded || !snap.exists()) return;
        const data = snap.data() as CloudMatchDoc;

        if (role === 'host') {
          if (!appliedOfferOrAnswer && data.answerSdp) {
            appliedOfferOrAnswer = true;
            void (async () => {
              try {
                const ans = JSON.parse(data.answerSdp) as RTCSessionDescriptionInit;
                await pc.setRemoteDescription(new RTCSessionDescription(ans));
                remoteDescSet = true;
                await flushPendingIce();
              } catch {
                // Relay fallback still active
              }
            })();
          }

          if (data.guestRelayJson) {
            try {
              const pkt = JSON.parse(data.guestRelayJson) as RelayGuestInputEnvelope;
              if (pkt.seq > lastAppliedGuestInputSeq) {
                lastAppliedGuestInputSeq = pkt.seq;
                hostControllerRef.current?.pushGuestInput(
                  pkt.moveDir,
                  pkt.jumpHeld,
                  pkt.downHeld,
                  pkt.actions
                );
              }
            } catch {
              // Ignore
            }
          }

          if (data.status === 'finished' && data.finishReason === 'forfeit' && data.winnerSlot === 0) {
            hostControllerRef.current?.forceFinish(0, 'forfeit');
          } else if (data.status === 'finished' && data.finishReason === 'cancelled') {
            hostControllerRef.current?.forceFinish(0, 'forfeit');
          }
        } else {
          if (!appliedOfferOrAnswer && data.offerSdp) {
            appliedOfferOrAnswer = true;
            void (async () => {
              try {
                const offer = JSON.parse(data.offerSdp) as RTCSessionDescriptionInit;
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                remoteDescSet = true;
                await flushPendingIce();
                const ans = await pc.createAnswer();
                if (disposed) return;
                await pc.setLocalDescription(ans);
                await updateCloudMatchFields(matchDoc.matchId, {
                  status: 'active',
                  answerSdp: JSON.stringify(ans),
                });
              } catch {
                // Relay fallback still active
              }
            })();
          }

          if (data.hostRelayJson) {
            try {
              const pkt = JSON.parse(data.hostRelayJson) as
                | RelayStateEnvelope
                | RelaySeriesOverEnvelope;
              if (pkt.kind === 'state') {
                handleIncomingStateEnvelope(pkt);
              } else if (pkt.kind === 'series_over') {
                handleIncomingSeriesOver(pkt);
              }
            } catch {
              // Ignore
            }
          }

          if (data.status === 'finished' && !seriesEnded && (data.winnerSlot === 0 || data.winnerSlot === 1)) {
            const rewards = computeSeriesRewards({
              queueType: data.queueType,
              scores: [data.score0, data.score1],
              winnerSlot: data.winnerSlot,
              reason: data.finishReason === 'forfeit' ? 'forfeit' : 'ko',
              metas,
            });
            const fallbackFinalPlayer = (slot: 0 | 1): HudFighterSnapshot => ({
              slot,
              id: metas[slot].fighterId,
              name: metas[slot].displayName,
              isAi: false,
              isDummy: false,
              hp: 100,
              maxHp: 100,
              stocks: slot === data.winnerSlot ? ONLINE_ROUND_STOCKS : 0,
              ultCharge: 0,
              animState: 'idle',
              poisoned: false,
              stunned: false,
              slowed: false,
              confused: false,
              x: slot === 0 ? 320 : 960,
              y: 500,
              damageDealt: 0,
              koCount: slot === data.winnerSlot ? data.score0 + data.score1 : 0,
              hitsLanded: 0,
              longestCombo: 0,
              currentComboCount: 0,
              currentComboDamage: 0,
              lastComboCount: 0,
              lastComboDamage: 0,
              peakSingleHit: 0,
              heavyHitsLanded: 0,
            });
            handleIncomingSeriesOver({
              kind: 'series_over',
              matchId: data.matchId,
              queueType: data.queueType,
              winnerSlot: data.winnerSlot,
              reason: data.finishReason === 'forfeit' ? 'forfeit' : 'ko',
              scores: [data.score0, data.score1],
              finalPlayers: [fallbackFinalPlayer(0), fallbackFinalPlayer(1)],
              matchDurationSec: data.matchDurationSec || 1,
              rpDelta: rewards.rpDelta,
              newRp: rewards.newRp,
              tpDelta: rewards.tpDelta,
              newTp: rewards.newTp,
              tournamentCycleId:
                data.tournamentCycleId !== 'none' ? data.tournamentCycleId : undefined,
            });
          }
        }
      });

      const unsubIce = onSnapshot(
        collection(db, 'online_matches', matchDoc.matchId, 'ice'),
        (snap) => {
          if (disposed) return;
          snap.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            if (seenIceIds.has(change.doc.id)) return;
            seenIceIds.add(change.doc.id);
            const raw = change.doc.data() as { senderUid?: string; candidateJson?: string };
            if (!raw.senderUid || raw.senderUid === myUid || !raw.candidateJson) return;
            try {
              const cand = JSON.parse(raw.candidateJson) as RTCIceCandidateInit;
              if (remoteDescSet) {
                void pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
              } else {
                pendingRemoteIce.push(cand);
              }
            } catch {
              // Ignore
            }
          });
        }
      );

      sessionCleanupRef.current = () => {
        disposed = true;
        unsubMatchDoc();
        unsubIce();
        try {
          pc.close();
        } catch {
          // Ignore
        }
      };
    },
    [cleanupCurrentSession, handleCompleteSeries, syncMyPresence]
  );

  // Global Cloud Presence & Matchmaking Evaluator
  const runMatchmakingPass = useCallback(
    async (docs: CloudPresenceDoc[]) => {
      const myUid = authUidRef.current;
      const myQueue = inQueueRef.current;
      if (!myUid || !myQueue || activeMatchRef.current || matchStartingRef.current) return;

      if (myQueue === 'tournament' && !getTournamentScheduleStatus().isActive) {
        return;
      }

      const nowMs = Date.now();
      const myDoc = docs.find((d) => d.uid === myUid);
      const effectiveMyDoc: CloudPresenceDoc | undefined =
        myDoc ??
        (desiredPresenceRef.current
          ? {
              uid: myUid,
              ...buildPresencePayload(
                myQueue,
                myQueue,
                'queued',
                desiredPresenceRef.current.meta,
                '',
                roomCode,
                queueEnteredAtRef.current ?? nowMs
              ),
            }
          : undefined);

      if (!effectiveMyDoc) return;

      const eligible = docs.filter(
        (d) =>
          d.uid !== myUid &&
          isPresenceAlive(d, nowMs) &&
          d.queue === myQueue &&
          d.status === 'queued' &&
          !d.matchId
      );

      // Update queue position estimate
      const allQueued = [...eligible, effectiveMyDoc].sort(
        (a, b) => a.queueEnteredAt - b.queueEnteredAt || a.uid.localeCompare(b.uid)
      );
      const myIdx = allQueued.findIndex((d) => d.uid === myUid);
      setQueuePosition(myIdx >= 0 ? myIdx + 1 : 1);

      if (eligible.length === 0) return;

      if (myQueue === 'ranked') {
        eligible.sort(
          (a, b) =>
            Math.abs(a.rankedPoints - effectiveMyDoc.rankedPoints) -
              Math.abs(b.rankedPoints - effectiveMyDoc.rankedPoints) ||
            a.queueEnteredAt - b.queueEnteredAt
        );
      } else if (myQueue === 'tournament') {
        eligible.sort(
          (a, b) =>
            Math.abs(a.tournamentPoints - effectiveMyDoc.tournamentPoints) -
              Math.abs(b.tournamentPoints - effectiveMyDoc.tournamentPoints) ||
            a.queueEnteredAt - b.queueEnteredAt
        );
      } else {
        eligible.sort((a, b) => a.queueEnteredAt - b.queueEnteredAt || a.uid.localeCompare(b.uid));
      }

      const opponent = eligible[0];
      if (!opponent) return;

      // Deterministic host election prevents both players creating duplicate match docs
      if (myUid.localeCompare(opponent.uid) >= 0) {
        return;
      }

      matchStartingRef.current = true;
      try {
        const matchId = `m_${Date.now()}_${myUid.slice(0, 6)}_${opponent.uid.slice(0, 6)}`;
        const created = await createCloudMatchRoom({
          matchId,
          queueType: myQueue,
          host: effectiveMyDoc,
          guest: opponent,
        });
        startMatchSession(created, myUid);
      } catch {
        setErrorMessage('Could not start cloud match — retrying queue...');
      } finally {
        matchStartingRef.current = false;
      }
    },
    [roomCode, startMatchSession]
  );

  // Subscribe to Global Cloud Presence Roster
  useEffect(() => {
    if (!authUid) {
      setWaitingSnapshot(EMPTY_WAITING_SNAPSHOT);
      return;
    }

    const unsubPresence = onSnapshot(
      collection(db, 'online_presence'),
      (snap) => {
        const nowMs = Date.now();
        const docs: CloudPresenceDoc[] = [];
        snap.forEach((d) => {
          docs.push(d.data() as CloudPresenceDoc);
        });
        presenceDocsRef.current = docs;
        setWaitingSnapshot(buildWaitingSnapshotFromPresence(docs, nowMs));
        void runMatchmakingPass(docs);
      },
      () => {
        // Presence read error
      }
    );

    const refreshAliveTimer = setInterval(() => {
      if (presenceDocsRef.current.length > 0) {
        setWaitingSnapshot(buildWaitingSnapshotFromPresence(presenceDocsRef.current, Date.now()));
        void runMatchmakingPass(presenceDocsRef.current);
      }
    }, 3_500);

    return () => {
      unsubPresence();
      clearInterval(refreshAliveTimer);
    };
  }, [authUid, runMatchmakingPass]);

  // Listen for incoming matches where this user is guest or host
  useEffect(() => {
    if (!authUid) return;

    const handleMatchQuerySnap = (docs: CloudMatchDoc[]) => {
      const nowMs = Date.now();
      for (const m of docs) {
        if (ignoredMatchIdsRef.current.has(m.matchId)) continue;
        if (m.status === 'finished') {
          ignoredMatchIdsRef.current.add(m.matchId);
          continue;
        }
        const createdMs = timestampToMs(m.createdAt, nowMs);
        if (nowMs - createdMs > 45_000 && activeMatchRef.current?.matchId !== m.matchId) {
          continue;
        }
        if (!activeMatchRef.current) {
          startMatchSession(m, authUid);
          break;
        }
      }
    };

    const unsubGuest = onSnapshot(
      query(collection(db, 'online_matches'), where('guestUid', '==', authUid)),
      (snap) => {
        const list: CloudMatchDoc[] = [];
        snap.forEach((d) => list.push(d.data() as CloudMatchDoc));
        list.sort((a, b) => timestampToMs(b.createdAt, 0) - timestampToMs(a.createdAt, 0));
        handleMatchQuerySnap(list);
      },
      () => {}
    );

    const unsubHost = onSnapshot(
      query(collection(db, 'online_matches'), where('hostUid', '==', authUid)),
      (snap) => {
        const list: CloudMatchDoc[] = [];
        snap.forEach((d) => list.push(d.data() as CloudMatchDoc));
        list.sort((a, b) => timestampToMs(b.createdAt, 0) - timestampToMs(a.createdAt, 0));
        handleMatchQuerySnap(list);
      },
      () => {}
    );

    return () => {
      unsubGuest();
      unsubHost();
    };
  }, [authUid, startMatchSession]);

  // Periodic Heartbeat while in an online area or match
  useEffect(() => {
    if (!authUid) return;
    const id = setInterval(() => {
      const area = desiredPresenceRef.current?.area ?? 'none';
      if (area !== 'none' || activeMatchRef.current || inQueueRef.current) {
        void syncMyPresence(authUid);
      }
    }, HEARTBEAT_INTERVAL_MS);

    const handleUnload = () => {
      if (authUidRef.current) {
        void clearCloudPresenceOnExit(authUidRef.current);
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [authUid, syncMyPresence]);

  const enterWaitingArea = useCallback(
    (area: WaitingAreaKind, meta: PresenceMeta) => {
      desiredPresenceRef.current = { area, meta };
      if (inQueueRef.current && inQueueRef.current !== area) {
        setInQueue(null);
        setQueuePosition(0);
        setQueueEnteredAt(null);
      }

      if (area === 'none') {
        if (authUidRef.current && !activeMatchRef.current) {
          void writeCloudPresence(
            authUidRef.current,
            buildPresencePayload('none', 'none', 'waiting', meta, '', '', 0)
          ).catch(() => {});
        }
        return;
      }

      void (async () => {
        const uid = authUidRef.current ?? (await ensureCloudAuthUid());
        if (!uid) {
          setErrorMessage('Sign in or enable Guest mode to join the global cloud server.');
          return;
        }
        setAuthUid(uid);
        setCloudReady(true);
        await syncMyPresence(uid, { area });

        if (area === 'tournament') {
          const schedule = getTournamentScheduleStatus();
          if (schedule.isActive && meta.tournamentCycleId === schedule.cycleId) {
            void upsertTournamentStanding(schedule.cycleId, {
              playerKey: uid,
              displayName: sanitizeName(meta.displayName, 'Fighter'),
              fighterId: meta.fighterId,
              points: meta.tournamentPoints ?? 0,
              wins: meta.tournamentWins ?? 0,
              losses: meta.tournamentLosses ?? 0,
              streak: meta.tournamentStreak ?? 0,
            }).catch(() => {});
          }
        }
      })();
    },
    [syncMyPresence]
  );

  const joinQueue = useCallback(
    (queue: OnlineQueueType, meta: PresenceMeta) => {
      desiredPresenceRef.current = { area: queue, meta };
      setErrorMessage(null);

      if (activeMatchRef.current) {
        setErrorMessage('Finish your current online match first.');
        return;
      }

      if (queue === 'tournament') {
        const schedule = getTournamentScheduleStatus();
        if (!schedule.isActive) {
          setErrorMessage(
            'Bi-weekly Tournament is currently closed. Tournaments run for 1 week every 2 weeks.'
          );
          return;
        }
      }

      const enteredAt = Date.now();
      setInQueue(queue);
      setQueueEnteredAt(enteredAt);
      setQueuePosition(1);

      void (async () => {
        const uid = authUidRef.current ?? (await ensureCloudAuthUid());
        if (!uid) {
          setInQueue(null);
          setQueueEnteredAt(null);
          setErrorMessage('Could not connect to cloud multiplayer server.');
          return;
        }
        setAuthUid(uid);
        setCloudReady(true);
        await syncMyPresence(uid, {
          area: queue,
          queue,
          status: 'queued',
          matchId: '',
          queueEnteredAt: enteredAt,
        });
        void runMatchmakingPass(presenceDocsRef.current);
      })();
    },
    [runMatchmakingPass, syncMyPresence]
  );

  const leaveQueue = useCallback(() => {
    setInQueue(null);
    setQueuePosition(0);
    setQueueEnteredAt(null);
    void syncMyPresence(authUidRef.current, {
      queue: 'none',
      status: 'waiting',
      queueEnteredAt: 0,
    });
  }, [syncMyPresence]);

  const challengePlayer = useCallback(
    async (targetUid: string, queueType: OnlineQueueType, meta: PresenceMeta): Promise<boolean> => {
      setErrorMessage(null);
      if (activeMatchRef.current || matchStartingRef.current) {
        setErrorMessage('Already entering a match.');
        return false;
      }
      if (queueType === 'tournament' && !getTournamentScheduleStatus().isActive) {
        setErrorMessage('Tournament window is closed.');
        return false;
      }

      const uid = authUidRef.current ?? (await ensureCloudAuthUid());
      if (!uid) {
        setErrorMessage('Unable to authenticate with the cloud server.');
        return false;
      }
      if (targetUid === uid) {
        setErrorMessage('You cannot challenge yourself.');
        return false;
      }

      const nowMs = Date.now();
      const targetDoc = presenceDocsRef.current.find(
        (d) => d.uid === targetUid && isPresenceAlive(d, nowMs)
      );
      if (!targetDoc || targetDoc.status === 'in_match') {
        setErrorMessage('That player is no longer available in the waiting area.');
        return false;
      }

      desiredPresenceRef.current = { area: queueType, meta };
      const myPresence: CloudPresenceDoc = {
        uid,
        ...buildPresencePayload(queueType, 'none', 'waiting', meta, '', roomCode, 0),
      };

      matchStartingRef.current = true;
      try {
        const matchId = `m_${Date.now()}_${uid.slice(0, 6)}_${targetDoc.uid.slice(0, 6)}`;
        const created = await createCloudMatchRoom({
          matchId,
          queueType,
          host: myPresence,
          guest: targetDoc,
        });
        startMatchSession(created, uid);
        return true;
      } catch {
        setErrorMessage('Could not start direct match with that player.');
        return false;
      } finally {
        matchStartingRef.current = false;
      }
    },
    [roomCode, startMatchSession]
  );

  const joinRoomByCode = useCallback(
    async (rawCode: string, meta: PresenceMeta): Promise<boolean> => {
      const code = sanitizeRoomCode(rawCode);
      setErrorMessage(null);
      if (code.length < 4) {
        setErrorMessage('Enter a valid 6-character cloud room code.');
        return false;
      }

      const uid = authUidRef.current ?? (await ensureCloudAuthUid());
      if (!uid) {
        setErrorMessage('Unable to authenticate with the cloud server.');
        return false;
      }

      const nowMs = Date.now();
      const target = presenceDocsRef.current.find(
        (d) => d.roomCode === code && isPresenceAlive(d, nowMs) && d.uid !== uid
      );
      if (!target) {
        setErrorMessage(`No active friend found with room code "${code}". Make sure they have Casual Lounge open.`);
        return false;
      }
      if (target.status === 'in_match') {
        setErrorMessage('That player is currently in another match.');
        return false;
      }

      return challengePlayer(target.uid, 'casual', meta);
    },
    [challengePlayer]
  );

  const sendMatchInput = useCallback(
    (
      matchId: string,
      moveDir: number,
      jumpHeld: boolean,
      downHeld: boolean,
      actions: OnlineInputActions
    ) => {
      const match = activeMatchRef.current;
      if (!match || match.matchId !== matchId) return;

      if (match.yourSlot === 0) {
        hostControllerRef.current?.pushHostInput(moveDir, jumpHeld, downHeld, actions);
        return;
      }

      inputSeqRef.current += 1;
      const packet: RelayGuestInputEnvelope = {
        seq: inputSeqRef.current,
        moveDir,
        jumpHeld,
        downHeld,
        actions,
      };

      const dc = rtcDataChannelRef.current;
      if (dc && dc.readyState === 'open') {
        try {
          dc.send(JSON.stringify(packet));
          return;
        } catch {
          // Fall through to relay
        }
      }

      // Accumulate queued actions until Firestore relay flush
      const prevPending = pendingGuestInputRef.current;
      const mergedActions: OnlineInputActions = {
        ...(prevPending?.actions ?? {}),
        ...actions,
      };
      pendingGuestInputRef.current = {
        seq: packet.seq,
        moveDir,
        jumpHeld,
        downHeld,
        actions: mergedActions,
      };

      const nowMs = Date.now();
      const elapsed = nowMs - lastGuestRelayWriteMsRef.current;
      const flushRelay = () => {
        guestInputFlushTimerRef.current = null;
        const toSend = pendingGuestInputRef.current;
        if (!toSend || activeMatchRef.current?.matchId !== matchId) return;
        pendingGuestInputRef.current = null;
        lastGuestRelayWriteMsRef.current = Date.now();
        void updateCloudMatchFields(matchId, {
          guestRelayJson: JSON.stringify(toSend),
        }).catch(() => {});
      };

      if (elapsed >= 55) {
        if (guestInputFlushTimerRef.current) {
          clearTimeout(guestInputFlushTimerRef.current);
        }
        flushRelay();
      } else if (!guestInputFlushTimerRef.current) {
        guestInputFlushTimerRef.current = setTimeout(flushRelay, 55 - elapsed);
      }
    },
    []
  );

  const leaveMatch = useCallback(
    (matchId?: string) => {
      const current = activeMatchRef.current;
      const targetId = matchId ?? current?.matchId;
      if (!targetId) return;
      ignoredMatchIdsRef.current.add(targetId);

      if (current && current.matchId === targetId) {
        if (current.yourSlot === 0 && hostControllerRef.current) {
          hostControllerRef.current.forceFinish(1, 'forfeit');
          return;
        }
        if (current.yourSlot === 1) {
          void updateCloudMatchFields(targetId, {
            status: 'finished',
            finishReason: 'forfeit',
            winnerSlot: 0,
          }).catch(() => {});
        }
      }

      cleanupCurrentSession();
      activeMatchRef.current = null;
      setActiveMatch(null);
      setInQueue(null);
      void syncMyPresence(authUidRef.current, {
        status: 'waiting',
        queue: 'none',
        matchId: '',
        queueEnteredAt: 0,
      });
    },
    [cleanupCurrentSession, syncMyPresence]
  );

  const clearSeriesResult = useCallback(() => {
    setSeriesResult(null);
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  // Keep local helper export referenced cleanly
  void applyInputPacket;

  return {
    connected: Boolean(authUid) && cloudReady,
    clientId: authUid,
    roomCode,
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
    challengePlayer,
    joinRoomByCode,
    sendMatchInput,
    leaveMatch,
    clearSeriesResult,
    clearError,
  };
}
