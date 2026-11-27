import { signInAnonymously } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { ALL_MAP_IDS, type MapSelection } from '../types/account';
import { FIGHTER_SPECS, STARTING_STOCKS } from './constants';
import {
  computeRankedRpDelta,
  computeTournamentPointsAward,
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
  type WaitingLobbyEntry,
} from './onlineTypes';
import {
  buildHudSnapshot,
  createInitialEngineState,
  serializeEngineSnapshot,
  stepCombatFrame,
  stepPlatforms,
  stepVictoryPhase,
  stepVisualEffects,
  type FighterControlInput,
} from './simulation';
import { getTournamentScheduleStatus } from './tournamentSchedule';
import type {
  FighterId,
  GameEngineState,
  HudFighterSnapshot,
  MapId,
  MoveKey,
  PlayMode,
} from './types';

export interface CloudPresenceDoc {
  uid: string;
  displayName: string;
  area: WaitingAreaKind;
  queue: WaitingAreaKind;
  status: 'waiting' | 'queued' | 'in_match';
  fighterId: FighterId;
  preferredMap: MapSelection;
  rankedPoints: number;
  tournamentPoints: number;
  tournamentWins: number;
  tournamentLosses: number;
  tournamentStreak: number;
  tournamentCycleId: string;
  matchId: string;
  roomCode: string;
  queueEnteredAt: number;
  heartbeatAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CloudMatchDoc {
  matchId: string;
  queueType: OnlineQueueType;
  hostUid: string;
  guestUid: string;
  mapId: MapId;
  status: 'signaling' | 'active' | 'finished';
  p0Name: string;
  p0Fighter: FighterId;
  p0Rp: number;
  p0Tp: number;
  p1Name: string;
  p1Fighter: FighterId;
  p1Rp: number;
  p1Tp: number;
  tournamentCycleId: string;
  tournamentTitle: string;
  offerSdp: string;
  answerSdp: string;
  hostRelayJson: string;
  guestRelayJson: string;
  score0: number;
  score1: number;
  winnerSlot: -1 | 0 | 1;
  finishReason: 'none' | 'ko' | 'forfeit' | 'cancelled';
  matchDurationSec: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CloudTournamentStandingDoc {
  playerKey: string;
  displayName: string;
  fighterId: FighterId;
  points: number;
  wins: number;
  losses: number;
  streak: number;
  updatedAt?: Timestamp | null;
}

export interface CloudTournamentMatchDoc {
  matchId: string;
  cycleId: string;
  hostUid: string;
  guestUid: string;
  status: 'live' | 'completed';
  round: number;
  roundPhase: OnlineRoundPhase | 'completed';
  score0: number;
  score1: number;
  mapId: MapId;
  p0Name: string;
  p0Fighter: FighterId;
  p0Tp: number;
  p1Name: string;
  p1Fighter: FighterId;
  p1Tp: number;
  winnerSlot: -1 | 0 | 1;
  reason: 'none' | 'ko' | 'forfeit';
  startedAtMs: number;
  finishedAtMs: number;
  updatedAt?: Timestamp | null;
}

export interface PlayerInputBuffer {
  moveDir: number;
  jumpHeld: boolean;
  downHeld: boolean;
  queued: OnlineInputActions;
}

export interface CumulativePlayerStats {
  damageDealt: number;
  koCount: number;
  hitsLanded: number;
  longestCombo: number;
  peakSingleHit: number;
  heavyHitsLanded: number;
}

export interface RelayStateEnvelope {
  kind: 'state';
  seq: number;
  tick: number;
  round: number;
  scores: [number, number];
  roundPhase: OnlineRoundPhase;
  roundTimer: number;
  lastRoundWinnerSlot: 0 | 1 | null;
  state: SerializedEngineSnapshot;
  sounds: SoundEvent[];
}

export interface RelaySeriesOverEnvelope {
  kind: 'series_over';
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

export interface RelayGuestInputEnvelope {
  seq: number;
  moveDir: number;
  jumpHeld: boolean;
  downHeld: boolean;
  actions: OnlineInputActions;
}

export const PRESENCE_STALE_MS = 45_000;
export const HEARTBEAT_INTERVAL_MS = 12_000;
export const MATCH_TICK_HZ = 60;
export const MATCH_TICK_DT = 1 / MATCH_TICK_HZ;
export const RTC_BROADCAST_EVERY_TICKS = 2; // 30Hz P2P updates
export const RELAY_BROADCAST_MS = 85; // ~12Hz Firestore fallback when WebRTC is blocked
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_STORAGE_KEY = 'sky_hive_brawl_room_code_v1';

export function getOrCreateSessionRoomCode(): string {
  if (typeof window !== 'undefined') {
    try {
      const existing = window.sessionStorage.getItem(ROOM_CODE_STORAGE_KEY);
      if (existing && /^[A-Z0-9]{4,8}$/.test(existing)) {
        return existing;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(ROOM_CODE_STORAGE_KEY, code);
    } catch {
      // Ignore storage access errors
    }
  }
  return code;
}

export function sanitizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

export function sanitizeName(raw: string, fallback = 'Fighter'): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ').slice(0, 32);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function createEmptyInputBuffer(): PlayerInputBuffer {
  return {
    moveDir: 0,
    jumpHeld: false,
    downHeld: false,
    queued: {},
  };
}

export function createEmptyCumulativeStats(): CumulativePlayerStats {
  return {
    damageDealt: 0,
    koCount: 0,
    hitsLanded: 0,
    longestCombo: 0,
    peakSingleHit: 0,
    heavyHitsLanded: 0,
  };
}

export function consumeBufferControls(
  inputState: PlayerInputBuffer,
  isConfused: boolean
): FighterControlInput {
  const q = inputState.queued;
  let directMove: MoveKey | null = null;
  if (q.ultimate) directMove = 'ultimate';
  else if (q.recovery) directMove = 'recovery';
  else if (q.special) directMove = 'special';
  else if (q.attack3) directMove = 'attack3';
  else if (q.attack2) directMove = 'attack2';
  else if (q.attack1) directMove = 'attack1';

  const rawMoveDir = inputState.moveDir;
  const rawJump = Boolean(q.jump);
  const rawDown = inputState.downHeld;

  const ctrl: FighterControlInput = {
    moveDir: isConfused ? -rawMoveDir : rawMoveDir,
    jumpPressed: isConfused ? rawDown && !rawJump : rawJump,
    downHeld: isConfused ? inputState.jumpHeld : rawDown,
    attackComboPressed: Boolean(q.attackCombo),
    tauntPressed: Boolean(q.taunt),
    directMove,
  };

  inputState.queued = {};
  return ctrl;
}

export function applyInputPacket(
  target: PlayerInputBuffer,
  moveDir: number,
  jumpHeld: boolean,
  downHeld: boolean,
  actions?: OnlineInputActions
): void {
  const rawDir = Number(moveDir);
  target.moveDir = Number.isFinite(rawDir) ? Math.max(-1, Math.min(1, Math.round(rawDir))) : 0;
  target.jumpHeld = Boolean(jumpHeld);
  target.downHeld = Boolean(downHeld);

  if (actions && typeof actions === 'object') {
    if (actions.jump) target.queued.jump = true;
    if (actions.attackCombo) target.queued.attackCombo = true;
    if (actions.attack1) target.queued.attack1 = true;
    if (actions.attack2) target.queued.attack2 = true;
    if (actions.attack3) target.queued.attack3 = true;
    if (actions.special) target.queued.special = true;
    if (actions.ultimate) target.queued.ultimate = true;
    if (actions.recovery) target.queued.recovery = true;
    if (actions.taunt) target.queued.taunt = true;
  }
}

export function accumulateRoundStats(
  engine: GameEngineState,
  totals: [CumulativePlayerStats, CumulativePlayerStats]
): void {
  for (const slot of [0, 1] as const) {
    const fighter = engine.players[slot];
    const acc = totals[slot];
    acc.damageDealt += fighter.damageDealt;
    acc.koCount += fighter.koCount;
    acc.hitsLanded += fighter.hitsLanded;
    acc.longestCombo = Math.max(acc.longestCombo, fighter.longestCombo);
    acc.peakSingleHit = Math.max(acc.peakSingleHit, fighter.peakSingleHit);
    acc.heavyHitsLanded += fighter.heavyHitsLanded;
  }
}

export function buildFinalSeriesPlayers(
  engine: GameEngineState,
  totals: [CumulativePlayerStats, CumulativePlayerStats],
  metas: [OnlinePlayerMeta, OnlinePlayerMeta]
): [HudFighterSnapshot, HudFighterSnapshot] {
  const hud = buildHudSnapshot(engine);
  const combine = (slot: 0 | 1): HudFighterSnapshot => {
    const cur = hud.players[slot];
    const prev = totals[slot];
    return {
      ...cur,
      name: metas[slot].displayName,
      damageDealt: Math.round(prev.damageDealt + cur.damageDealt),
      koCount: prev.koCount + cur.koCount,
      hitsLanded: prev.hitsLanded + cur.hitsLanded,
      longestCombo: Math.max(prev.longestCombo, cur.longestCombo),
      peakSingleHit: Math.max(prev.peakSingleHit, cur.peakSingleHit),
      heavyHitsLanded: prev.heavyHitsLanded + cur.heavyHitsLanded,
    };
  };
  return [combine(0), combine(1)];
}

export function pickCloudMatchMap(
  p0Pref: MapSelection,
  p1Pref: MapSelection,
  queueType: OnlineQueueType
): MapId {
  if (queueType === 'ranked' || queueType === 'tournament') {
    return ALL_MAP_IDS[Math.floor(Math.random() * ALL_MAP_IDS.length)];
  }
  const picks: MapId[] = [];
  if (p0Pref !== 'random') picks.push(p0Pref);
  if (p1Pref !== 'random') picks.push(p1Pref);
  if (picks.length === 0) {
    return ALL_MAP_IDS[Math.floor(Math.random() * ALL_MAP_IDS.length)];
  }
  return picks[Math.floor(Math.random() * picks.length)];
}

export function timestampToMs(ts: Timestamp | null | undefined, fallbackMs: number): number {
  if (!ts) return fallbackMs;
  try {
    return ts.toMillis();
  } catch {
    return fallbackMs;
  }
}

export function isPresenceAlive(docData: CloudPresenceDoc, nowMs: number): boolean {
  if (!docData.heartbeatAt) return true;
  const hbMs = timestampToMs(docData.heartbeatAt, nowMs);
  return nowMs - hbMs <= PRESENCE_STALE_MS;
}

export function buildWaitingSnapshotFromPresence(
  docs: CloudPresenceDoc[],
  nowMs: number
): WaitingAreaSnapshot {
  const casualWaiting: WaitingLobbyEntry[] = [];
  const rankedWaiting: WaitingLobbyEntry[] = [];
  const tournamentWaiting: WaitingLobbyEntry[] = [];
  const casualMatchIds = new Set<string>();
  const rankedMatchIds = new Set<string>();
  const tournamentMatchIds = new Set<string>();

  for (const p of docs) {
    if (!isPresenceAlive(p, nowMs)) continue;
    if (p.area === 'none') continue;

    const entry: WaitingLobbyEntry = {
      clientId: p.uid,
      displayName: sanitizeName(p.displayName, `Fighter-${p.uid.slice(0, 4)}`),
      fighterId: p.fighterId in FIGHTER_SPECS ? p.fighterId : 'honey_shell',
      preferredMap: p.preferredMap,
      rankedPoints: Math.max(0, Math.min(10_000, Math.round(p.rankedPoints || 1000))),
      tournamentPoints: Math.max(0, Math.min(100_000, Math.round(p.tournamentPoints || 0))),
      status: p.status,
      joinedAt: p.queueEnteredAt || timestampToMs(p.updatedAt, nowMs),
      roomCode: p.roomCode || undefined,
    };

    if (p.area === 'casual') {
      casualWaiting.push(entry);
      if (p.status === 'in_match' && p.matchId) casualMatchIds.add(p.matchId);
    } else if (p.area === 'ranked') {
      rankedWaiting.push(entry);
      if (p.status === 'in_match' && p.matchId) rankedMatchIds.add(p.matchId);
    } else if (p.area === 'tournament') {
      tournamentWaiting.push(entry);
      if (p.status === 'in_match' && p.matchId) tournamentMatchIds.add(p.matchId);
    }
  }

  casualWaiting.sort((a, b) => a.joinedAt - b.joinedAt);
  rankedWaiting.sort((a, b) => b.rankedPoints - a.rankedPoints || a.joinedAt - b.joinedAt);
  tournamentWaiting.sort(
    (a, b) => b.tournamentPoints - a.tournamentPoints || a.joinedAt - b.joinedAt
  );

  return {
    casualWaiting,
    rankedWaiting,
    tournamentWaiting,
    casualInMatchCount: casualMatchIds.size,
    rankedInMatchCount: rankedMatchIds.size,
    tournamentInMatchCount: tournamentMatchIds.size,
  };
}

let pendingAuthPromise: Promise<string | null> | null = null;

export async function ensureCloudAuthUid(): Promise<string | null> {
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  if (pendingAuthPromise) {
    return pendingAuthPromise;
  }
  pendingAuthPromise = (async () => {
    try {
      const cred = await signInAnonymously(auth);
      return cred.user.uid;
    } catch {
      return null;
    } finally {
      pendingAuthPromise = null;
    }
  })();
  return pendingAuthPromise;
}

export async function writeCloudPresence(
  uid: string,
  payload: Omit<CloudPresenceDoc, 'uid' | 'heartbeatAt' | 'updatedAt'>
): Promise<void> {
  const path = `online_presence/${uid}`;
  try {
    await setDoc(doc(db, 'online_presence', uid), {
      uid,
      ...payload,
      heartbeatAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function clearCloudPresenceOnExit(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'online_presence', uid));
  } catch {
    // Ignore best-effort cleanup failure on unload
  }
}

export async function createCloudMatchRoom(params: {
  matchId: string;
  queueType: OnlineQueueType;
  host: CloudPresenceDoc;
  guest: CloudPresenceDoc;
}): Promise<CloudMatchDoc> {
  const { matchId, queueType, host, guest } = params;
  const mapId = pickCloudMatchMap(host.preferredMap, guest.preferredMap, queueType);
  const schedule = queueType === 'tournament' ? getTournamentScheduleStatus() : null;
  const cycleId = schedule ? schedule.cycleId : 'none';
  const tournamentTitle = schedule ? schedule.title.slice(0, 64) : '';

  const matchDoc: Omit<CloudMatchDoc, 'createdAt' | 'updatedAt'> = {
    matchId,
    queueType,
    hostUid: host.uid,
    guestUid: guest.uid,
    mapId,
    status: 'signaling',
    p0Name: sanitizeName(host.displayName, `Fighter-${host.uid.slice(0, 4)}`),
    p0Fighter: host.fighterId in FIGHTER_SPECS ? host.fighterId : 'honey_shell',
    p0Rp: Math.max(0, Math.min(10_000, Math.round(host.rankedPoints || 1000))),
    p0Tp: Math.max(0, Math.min(100_000, Math.round(host.tournamentPoints || 0))),
    p1Name: sanitizeName(guest.displayName, `Fighter-${guest.uid.slice(0, 4)}`),
    p1Fighter: guest.fighterId in FIGHTER_SPECS ? guest.fighterId : 'honey_shell',
    p1Rp: Math.max(0, Math.min(10_000, Math.round(guest.rankedPoints || 1000))),
    p1Tp: Math.max(0, Math.min(100_000, Math.round(guest.tournamentPoints || 0))),
    tournamentCycleId: cycleId,
    tournamentTitle,
    offerSdp: '',
    answerSdp: '',
    hostRelayJson: '',
    guestRelayJson: '',
    score0: 0,
    score1: 0,
    winnerSlot: -1,
    finishReason: 'none',
    matchDurationSec: 0,
  };

  const path = `online_matches/${matchId}`;
  try {
    await setDoc(doc(db, 'online_matches', matchId), {
      ...matchDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (queueType === 'tournament' && cycleId !== 'none') {
      await upsertTournamentCycleMatch({
        matchId,
        cycleId,
        hostUid: host.uid,
        guestUid: guest.uid,
        status: 'live',
        round: 1,
        roundPhase: 'intro',
        score0: 0,
        score1: 0,
        mapId,
        p0Name: matchDoc.p0Name,
        p0Fighter: matchDoc.p0Fighter,
        p0Tp: matchDoc.p0Tp,
        p1Name: matchDoc.p1Name,
        p1Fighter: matchDoc.p1Fighter,
        p1Tp: matchDoc.p1Tp,
        winnerSlot: -1,
        reason: 'none',
        startedAtMs: Date.now(),
        finishedAtMs: 0,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  return matchDoc;
}

export async function updateCloudMatchFields(
  matchId: string,
  fields: Partial<
    Pick<
      CloudMatchDoc,
      | 'status'
      | 'offerSdp'
      | 'answerSdp'
      | 'hostRelayJson'
      | 'guestRelayJson'
      | 'score0'
      | 'score1'
      | 'winnerSlot'
      | 'finishReason'
      | 'matchDurationSec'
    >
  >
): Promise<void> {
  const path = `online_matches/${matchId}`;
  try {
    await updateDoc(doc(db, 'online_matches', matchId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function pushMatchIceCandidate(
  matchId: string,
  senderUid: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  const iceId = `ice_${senderUid.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `online_matches/${matchId}/ice/${iceId}`;
  try {
    await setDoc(doc(db, 'online_matches', matchId, 'ice', iceId), {
      senderUid,
      candidateJson: JSON.stringify(candidate).slice(0, 2000),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal ICE trickle write error (relay fallback handles connectivity)
  }
}

export async function upsertTournamentStanding(
  cycleId: string,
  entry: Omit<CloudTournamentStandingDoc, 'updatedAt'>
): Promise<void> {
  if (!cycleId || cycleId === 'none') return;
  const path = `tournament_cycles/${cycleId}/standings/${entry.playerKey}`;
  try {
    await setDoc(doc(db, 'tournament_cycles', cycleId, 'standings', entry.playerKey), {
      ...entry,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function upsertTournamentCycleMatch(
  record: Omit<CloudTournamentMatchDoc, 'updatedAt'>
): Promise<void> {
  if (!record.cycleId || record.cycleId === 'none') return;
  const path = `tournament_cycles/${record.cycleId}/matches/${record.matchId}`;
  try {
    await setDoc(doc(db, 'tournament_cycles', record.cycleId, 'matches', record.matchId), {
      ...record,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Keep gameplay uninterrupted on telemetry sync failure
  }
}

export function subscribeTournamentCycleData(
  cycleId: string,
  onStandings: (standings: TournamentStandingEntry[]) => void,
  onMatches: (activeMatches: TournamentMatchRecord[], recentMatches: TournamentMatchRecord[]) => void
): () => void {
  if (!cycleId || cycleId === 'none') {
    onStandings([]);
    onMatches([], []);
    return () => {};
  }

  const unsubStandings = onSnapshot(
    query(collection(db, 'tournament_cycles', cycleId, 'standings')),
    (snap) => {
      const list: TournamentStandingEntry[] = [];
      snap.forEach((d) => {
        const raw = d.data() as CloudTournamentStandingDoc;
        list.push({
          playerKey: raw.playerKey,
          displayName: raw.displayName,
          fighterId: raw.fighterId,
          points: raw.points,
          wins: raw.wins,
          losses: raw.losses,
          streak: raw.streak,
          updatedAt: timestampToMs(raw.updatedAt, Date.now()),
        });
      });
      list.sort((a, b) => b.points - a.points || b.wins - a.wins || a.updatedAt - b.updatedAt);
      onStandings(list);
    },
    () => {
      // Non-fatal if user signed out temporarily
    }
  );

  const unsubMatches = onSnapshot(
    query(collection(db, 'tournament_cycles', cycleId, 'matches')),
    (snap) => {
      const active: TournamentMatchRecord[] = [];
      const recent: TournamentMatchRecord[] = [];
      snap.forEach((d) => {
        const m = d.data() as CloudTournamentMatchDoc;
        const converted: TournamentMatchRecord = {
          matchId: m.matchId,
          cycleId: m.cycleId,
          status: m.status,
          round: m.round,
          roundPhase: m.roundPhase,
          targetWins: TARGET_SERIES_WINS,
          scores: [m.score0, m.score1],
          mapId: m.mapId,
          players: [
            {
              clientId: m.hostUid,
              playerKey: m.hostUid,
              displayName: m.p0Name,
              fighterId: m.p0Fighter,
              tournamentPoints: m.p0Tp,
            },
            {
              clientId: m.guestUid,
              playerKey: m.guestUid,
              displayName: m.p1Name,
              fighterId: m.p1Fighter,
              tournamentPoints: m.p1Tp,
            },
          ],
          winnerSlot: m.winnerSlot === 0 || m.winnerSlot === 1 ? m.winnerSlot : null,
          reason: m.reason === 'ko' || m.reason === 'forfeit' ? m.reason : undefined,
          startedAtMs: m.startedAtMs,
          finishedAtMs: m.finishedAtMs > 0 ? m.finishedAtMs : undefined,
        };
        if (m.status === 'live') {
          active.push(converted);
        } else {
          recent.push(converted);
        }
      });
      active.sort((a, b) => b.startedAtMs - a.startedAtMs);
      recent.sort((a, b) => (b.finishedAtMs ?? b.startedAtMs) - (a.finishedAtMs ?? a.startedAtMs));
      onMatches(active.slice(0, 12), recent.slice(0, 16));
    },
    () => {
      // Non-fatal
    }
  );

  return () => {
    unsubStandings();
    unsubMatches();
  };
}

export function subscribeLastTournamentStandings(
  cycleId: string | null,
  onStandings: (standings: TournamentStandingEntry[]) => void
): () => void {
  if (!cycleId || cycleId === 'none') {
    onStandings([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'tournament_cycles', cycleId, 'standings')),
    (snap) => {
      const list: TournamentStandingEntry[] = [];
      snap.forEach((d) => {
        const raw = d.data() as CloudTournamentStandingDoc;
        list.push({
          playerKey: raw.playerKey,
          displayName: raw.displayName,
          fighterId: raw.fighterId,
          points: raw.points,
          wins: raw.wins,
          losses: raw.losses,
          streak: raw.streak,
          updatedAt: timestampToMs(raw.updatedAt, Date.now()),
        });
      });
      list.sort((a, b) => b.points - a.points || b.wins - a.wins);
      onStandings(list.slice(0, 20));
    },
    () => {}
  );
}

export function computeSeriesRewards(params: {
  queueType: OnlineQueueType;
  scores: [number, number];
  winnerSlot: 0 | 1;
  reason: 'ko' | 'forfeit';
  metas: [OnlinePlayerMeta, OnlinePlayerMeta];
}): {
  rpDelta: [number, number];
  newRp: [number, number];
  tpDelta: [number, number];
  newTp: [number, number];
} {
  const { queueType, scores, winnerSlot, reason, metas } = params;
  const loserSlot: 0 | 1 = winnerSlot === 0 ? 1 : 0;
  const rpDelta: [number, number] = [0, 0];
  const newRp: [number, number] = [metas[0].rankedPoints, metas[1].rankedPoints];
  const tpDelta: [number, number] = [0, 0];
  const newTp: [number, number] = [metas[0].tournamentPoints, metas[1].tournamentPoints];

  if (queueType === 'ranked') {
    const { winnerGain, loserLoss } = computeRankedRpDelta(
      metas[winnerSlot].rankedPoints,
      metas[loserSlot].rankedPoints
    );
    rpDelta[winnerSlot] = winnerGain;
    rpDelta[loserSlot] = -loserLoss;
    newRp[winnerSlot] = Math.min(10_000, metas[winnerSlot].rankedPoints + winnerGain);
    newRp[loserSlot] = Math.max(0, metas[loserSlot].rankedPoints - loserLoss);
  } else if (queueType === 'tournament') {
    const { winnerTpGain, loserTpGain } = computeTournamentPointsAward(
      scores[winnerSlot],
      scores[loserSlot],
      reason
    );
    tpDelta[winnerSlot] = winnerTpGain;
    tpDelta[loserSlot] = loserTpGain;
    newTp[winnerSlot] = Math.min(100_000, metas[winnerSlot].tournamentPoints + winnerTpGain);
    newTp[loserSlot] = Math.min(100_000, metas[loserSlot].tournamentPoints + loserTpGain);
  }

  return { rpDelta, newRp, tpDelta, newTp };
}

export interface HostSimulationController {
  pushHostInput: (moveDir: number, jumpHeld: boolean, downHeld: boolean, actions: OnlineInputActions) => void;
  pushGuestInput: (moveDir: number, jumpHeld: boolean, downHeld: boolean, actions: OnlineInputActions) => void;
  forceFinish: (winnerSlot: 0 | 1, reason: 'ko' | 'forfeit') => void;
  dispose: () => void;
}

export function createHostSimulationController(params: {
  matchDoc: CloudMatchDoc;
  metas: [OnlinePlayerMeta, OnlinePlayerMeta];
  sendRtcMessage: (msg: RelayStateEnvelope | RelaySeriesOverEnvelope) => boolean;
  onEmitLocalState: (env: RelayStateEnvelope) => void;
  onEmitSeriesOver: (env: RelaySeriesOverEnvelope) => void;
}): HostSimulationController {
  const { matchDoc, metas, sendRtcMessage, onEmitLocalState, onEmitSeriesOver } = params;
  const playMode: PlayMode =
    matchDoc.queueType === 'ranked'
      ? 'ONLINE_RANKED'
      : matchDoc.queueType === 'tournament'
      ? 'ONLINE_TOURNAMENT'
      : 'ONLINE_CASUAL';

  let engine = createInitialEngineState(
    'PLAYING',
    playMode,
    matchDoc.mapId,
    metas[0].fighterId,
    metas[1].fighterId,
    ONLINE_ROUND_STOCKS
  );
  const inputs: [PlayerInputBuffer, PlayerInputBuffer] = [
    createEmptyInputBuffer(),
    createEmptyInputBuffer(),
  ];
  const totals: [CumulativePlayerStats, CumulativePlayerStats] = [
    createEmptyCumulativeStats(),
    createEmptyCumulativeStats(),
  ];

  let round = 1;
  const scores: [number, number] = [0, 0];
  let roundPhase: OnlineRoundPhase = 'intro';
  let roundTimer = 1.5;
  let lastRoundWinnerSlot: 0 | 1 | null = null;
  let tickCount = 0;
  let seqCount = 0;
  let pendingSounds: SoundEvent[] = [];
  const startedAtMs = Date.now();
  let lastRelayWriteMs = 0;
  let finished = false;
  let disposed = false;

  const emitSnapshot = (forceRelay: boolean) => {
    if (disposed) return;
    seqCount += 1;
    const sounds = pendingSounds;
    pendingSounds = [];

    const env: RelayStateEnvelope = {
      kind: 'state',
      seq: seqCount,
      tick: tickCount,
      round,
      scores: [scores[0], scores[1]],
      roundPhase,
      roundTimer: Number(roundTimer.toFixed(2)),
      lastRoundWinnerSlot,
      state: serializeEngineSnapshot(engine),
      sounds,
    };

    onEmitLocalState(env);
    const sentViaRtc = sendRtcMessage(env);

    const nowMs = Date.now();
    if (!sentViaRtc && (forceRelay || nowMs - lastRelayWriteMs >= RELAY_BROADCAST_MS)) {
      lastRelayWriteMs = nowMs;
      void updateCloudMatchFields(matchDoc.matchId, {
        status: 'active',
        score0: scores[0],
        score1: scores[1],
        hostRelayJson: JSON.stringify(env),
      }).catch(() => {});
    }
  };

  const finalizeSeries = (winnerSlot: 0 | 1, reason: 'ko' | 'forfeit') => {
    if (finished || disposed) return;
    finished = true;
    roundPhase = 'series_over';
    clearInterval(tickTimer);

    const finalPlayers = buildFinalSeriesPlayers(engine, totals, metas);
    const matchDurationSec = Math.max(1, Math.round((Date.now() - startedAtMs) / 1000));
    const rewards = computeSeriesRewards({
      queueType: matchDoc.queueType,
      scores,
      winnerSlot,
      reason,
      metas,
    });

    const overEnv: RelaySeriesOverEnvelope = {
      kind: 'series_over',
      matchId: matchDoc.matchId,
      queueType: matchDoc.queueType,
      winnerSlot,
      reason,
      scores: [scores[0], scores[1]],
      finalPlayers,
      matchDurationSec,
      rpDelta: rewards.rpDelta,
      newRp: rewards.newRp,
      tpDelta: rewards.tpDelta,
      newTp: rewards.newTp,
      tournamentCycleId:
        matchDoc.tournamentCycleId !== 'none' ? matchDoc.tournamentCycleId : undefined,
    };

    sendRtcMessage(overEnv);
    onEmitSeriesOver(overEnv);

    void updateCloudMatchFields(matchDoc.matchId, {
      status: 'finished',
      score0: scores[0],
      score1: scores[1],
      winnerSlot,
      finishReason: reason,
      matchDurationSec,
      hostRelayJson: JSON.stringify(overEnv),
    }).catch(() => {});

    if (matchDoc.queueType === 'tournament' && matchDoc.tournamentCycleId !== 'none') {
      void upsertTournamentCycleMatch({
        matchId: matchDoc.matchId,
        cycleId: matchDoc.tournamentCycleId,
        hostUid: matchDoc.hostUid,
        guestUid: matchDoc.guestUid,
        status: 'completed',
        round,
        roundPhase: 'completed',
        score0: scores[0],
        score1: scores[1],
        mapId: matchDoc.mapId,
        p0Name: matchDoc.p0Name,
        p0Fighter: matchDoc.p0Fighter,
        p0Tp: rewards.newTp[0],
        p1Name: matchDoc.p1Name,
        p1Fighter: matchDoc.p1Fighter,
        p1Tp: rewards.newTp[1],
        winnerSlot,
        reason,
        startedAtMs,
        finishedAtMs: Date.now(),
      });
    }
  };

  const stepTick = () => {
    if (finished || disposed) return;
    tickCount += 1;

    if (roundPhase === 'intro') {
      roundTimer = Math.max(0, roundTimer - MATCH_TICK_DT);
      engine.ambientTime += MATCH_TICK_DT;
      stepPlatforms(engine, MATCH_TICK_DT);
      stepVisualEffects(engine, MATCH_TICK_DT);
      inputs[0].queued = {};
      inputs[1].queued = {};

      if (roundTimer <= 0) {
        roundPhase = 'fighting';
        roundTimer = 0;
        emitSnapshot(true);
        return;
      }
    } else if (roundPhase === 'fighting') {
      const c0 = consumeBufferControls(inputs[0], engine.players[0].confuseTimer > 0);
      const c1 = consumeBufferControls(inputs[1], engine.players[1].confuseTimer > 0);

      let roundEndedWinner: 0 | 1 | null = null;
      const { sounds } = stepCombatFrame(engine, [c0, c1], MATCH_TICK_DT, {
        startingStocks: ONLINE_ROUND_STOCKS,
        onMatchEnd: (wSlot) => {
          roundEndedWinner = wSlot;
        },
      });
      if (sounds.length > 0) {
        pendingSounds.push(...sounds);
      }

      if (roundEndedWinner !== null) {
        scores[roundEndedWinner] += 1;
        lastRoundWinnerSlot = roundEndedWinner;

        if (scores[roundEndedWinner] >= TARGET_SERIES_WINS) {
          emitSnapshot(true);
          finalizeSeries(roundEndedWinner, 'ko');
          return;
        }

        roundPhase = 'round_over';
        roundTimer = 2.6;
        emitSnapshot(true);
        if (matchDoc.queueType === 'tournament' && matchDoc.tournamentCycleId !== 'none') {
          void upsertTournamentCycleMatch({
            matchId: matchDoc.matchId,
            cycleId: matchDoc.tournamentCycleId,
            hostUid: matchDoc.hostUid,
            guestUid: matchDoc.guestUid,
            status: 'live',
            round,
            roundPhase,
            score0: scores[0],
            score1: scores[1],
            mapId: matchDoc.mapId,
            p0Name: matchDoc.p0Name,
            p0Fighter: matchDoc.p0Fighter,
            p0Tp: matchDoc.p0Tp,
            p1Name: matchDoc.p1Name,
            p1Fighter: matchDoc.p1Fighter,
            p1Tp: matchDoc.p1Tp,
            winnerSlot: -1,
            reason: 'none',
            startedAtMs,
            finishedAtMs: 0,
          });
        }
        return;
      }
    } else if (roundPhase === 'round_over') {
      roundTimer = Math.max(0, roundTimer - MATCH_TICK_DT);
      stepVictoryPhase(engine, MATCH_TICK_DT);
      stepVisualEffects(engine, MATCH_TICK_DT);
      inputs[0].queued = {};
      inputs[1].queued = {};

      if (roundTimer <= 0) {
        accumulateRoundStats(engine, totals);
        round += 1;
        engine = createInitialEngineState(
          'PLAYING',
          playMode,
          matchDoc.mapId,
          metas[0].fighterId,
          metas[1].fighterId,
          ONLINE_ROUND_STOCKS
        );
        roundPhase = 'intro';
        roundTimer = 1.4;
        emitSnapshot(true);
        return;
      }
    }

    if (tickCount % RTC_BROADCAST_EVERY_TICKS === 0) {
      emitSnapshot(false);
    }
  };

  // Emit opening state immediately
  emitSnapshot(true);
  const tickTimer = setInterval(stepTick, Math.round(1000 / MATCH_TICK_HZ));

  return {
    pushHostInput: (moveDir, jumpHeld, downHeld, actions) => {
      applyInputPacket(inputs[0], moveDir, jumpHeld, downHeld, actions);
    },
    pushGuestInput: (moveDir, jumpHeld, downHeld, actions) => {
      applyInputPacket(inputs[1], moveDir, jumpHeld, downHeld, actions);
    },
    forceFinish: (winnerSlot, reason) => {
      finalizeSeries(winnerSlot, reason);
    },
    dispose: () => {
      disposed = true;
      clearInterval(tickTimer);
    },
  };
}

export function getUnusedStocksBaseline(): number {
  return STARTING_STOCKS;
}
