import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { FIGHTER_SPECS } from './src/game/constants';
import {
  computeRankedRpDelta,
  computeTournamentPointsAward,
  ONLINE_ROUND_STOCKS,
  TARGET_SERIES_WINS,
  type ClientWsMessage,
  type OnlineInputActions,
  type OnlinePlayerMeta,
  type OnlineQueueType,
  type OnlineRoundPhase,
  type SerializedEngineSnapshot,
  type ServerWsMessage,
  type SoundEvent,
  type TournamentBracketPlayer,
  type TournamentMatchRecord,
  type TournamentStandingEntry,
  type TournamentStateSnapshot,
  type WaitingAreaKind,
  type WaitingAreaSnapshot,
  type WaitingLobbyEntry,
} from './src/game/onlineTypes';
import { getTournamentScheduleStatus } from './src/game/tournamentSchedule';
import {
  buildHudSnapshot,
  createInitialEngineState,
  EMPTY_CONTROL_INPUT,
  stepCombatFrame,
  stepPlatforms,
  stepVictoryPhase,
  stepVisualEffects,
  type FighterControlInput,
} from './src/game/simulation';
import type {
  FighterId,
  GameEngineState,
  HudFighterSnapshot,
  MapId,
  MoveKey,
  PlayMode,
} from './src/game/types';
import {
  ALL_MAP_IDS,
  DEFAULT_RANKED_POINTS,
  MAX_RANKED_POINTS,
  MAX_TOURNAMENT_POINTS,
  sanitizeDisplayName,
  sanitizeFighterId,
  sanitizeMapSelection,
  type MapSelection,
} from './src/types/account';

const PORT = Number(process.env.PORT) || 3000;
const TICK_HZ = 60;
const TICK_DT = 1 / TICK_HZ;
const BROADCAST_EVERY_TICKS = 2; // 30Hz authoritative snapshots

interface PlayerInputState {
  moveDir: number;
  jumpHeld: boolean;
  downHeld: boolean;
  queued: OnlineInputActions;
}

interface ConnectedClient {
  clientId: string;
  accountUid?: string;
  ws: WebSocket;
  isAlive: boolean;
  area: WaitingAreaKind;
  queue: OnlineQueueType | null;
  queueEnteredAt: number | null;
  matchId: string | null;
  displayName: string;
  fighterId: FighterId;
  preferredMap: MapSelection;
  rankedPoints: number;
  tournamentPoints: number;
  tournamentWins: number;
  tournamentLosses: number;
  tournamentStreak: number;
  tournamentCycleId: string;
  joinedAt: number;
}

interface CumulativeRoundStats {
  damageDealt: number;
  koCount: number;
  hitsLanded: number;
  longestCombo: number;
  peakSingleHit: number;
  heavyHitsLanded: number;
}

interface ActiveMatchRoom {
  matchId: string;
  queueType: OnlineQueueType;
  tournamentCycleId?: string;
  tournamentTitle?: string;
  mapId: MapId;
  clients: [ConnectedClient, ConnectedClient];
  metas: [OnlinePlayerMeta, OnlinePlayerMeta];
  inputs: [PlayerInputState, PlayerInputState];
  state: GameEngineState;
  round: number;
  scores: [number, number];
  roundPhase: OnlineRoundPhase;
  roundTimer: number;
  lastRoundWinnerSlot: 0 | 1 | null;
  tickCount: number;
  startedAtMs: number;
  pendingSounds: SoundEvent[];
  completedRoundStats: [CumulativeRoundStats, CumulativeRoundStats];
  interval: ReturnType<typeof setInterval> | null;
  finished: boolean;
}

const clients = new Map<string, ConnectedClient>();
const casualQueue: string[] = [];
const rankedQueue: string[] = [];
const tournamentQueue: string[] = [];
const activeMatches = new Map<string, ActiveMatchRoom>();
const tournamentCycleLedgers = new Map<string, Map<string, TournamentStandingEntry>>();
const tournamentCycleRecentMatches = new Map<string, TournamentMatchRecord[]>();
let lastObservedTournamentActive = getTournamentScheduleStatus().isActive;
let lastObservedTournamentCycleId = getTournamentScheduleStatus().cycleId;

function createEmptyCumulativeStats(): CumulativeRoundStats {
  return {
    damageDealt: 0,
    koCount: 0,
    hitsLanded: 0,
    longestCombo: 0,
    peakSingleHit: 0,
    heavyHitsLanded: 0,
  };
}

function createEmptyInputState(): PlayerInputState {
  return {
    moveDir: 0,
    jumpHeld: false,
    downHeld: false,
    queued: {},
  };
}

function clampRankedPoints(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_RANKED_POINTS;
  }
  return Math.max(0, Math.min(MAX_RANKED_POINTS, Math.floor(raw)));
}

function clampNonNegInt(raw: unknown, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.min(max, Math.floor(raw)));
}

function resolvePlayerKey(client: ConnectedClient): string {
  if (client.accountUid && /^[a-zA-Z0-9_\-]{1,128}$/.test(client.accountUid)) {
    return `uid:${client.accountUid}`;
  }
  return `ws:${client.clientId}`;
}

function getCycleLedger(cycleId: string): Map<string, TournamentStandingEntry> {
  let ledger = tournamentCycleLedgers.get(cycleId);
  if (!ledger) {
    ledger = new Map<string, TournamentStandingEntry>();
    tournamentCycleLedgers.set(cycleId, ledger);
  }
  return ledger;
}

function sortStandings(ledger: Map<string, TournamentStandingEntry> | undefined): TournamentStandingEntry[] {
  if (!ledger) return [];
  return Array.from(ledger.values())
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    })
    .slice(0, 25);
}

function syncClientToTournamentLedger(client: ConnectedClient, cycleId: string): void {
  const playerKey = resolvePlayerKey(client);
  const ledger = getCycleLedger(cycleId);
  const existing = ledger.get(playerKey);
  if (existing) {
    existing.displayName = client.displayName;
    existing.fighterId = client.fighterId;
    if (client.tournamentCycleId === cycleId) {
      existing.points = Math.max(existing.points, client.tournamentPoints);
      existing.wins = Math.max(existing.wins, client.tournamentWins);
      existing.losses = Math.max(existing.losses, client.tournamentLosses);
    }
    client.tournamentCycleId = cycleId;
    client.tournamentPoints = existing.points;
    client.tournamentWins = existing.wins;
    client.tournamentLosses = existing.losses;
    client.tournamentStreak = existing.streak;
    existing.updatedAt = Date.now();
    return;
  }

  if (client.tournamentCycleId === cycleId && (client.tournamentPoints > 0 || client.tournamentWins > 0 || client.tournamentLosses > 0)) {
    ledger.set(playerKey, {
      playerKey,
      displayName: client.displayName,
      fighterId: client.fighterId,
      points: client.tournamentPoints,
      wins: client.tournamentWins,
      losses: client.tournamentLosses,
      streak: client.tournamentStreak,
      updatedAt: Date.now(),
    });
  } else {
    client.tournamentCycleId = cycleId;
    client.tournamentPoints = 0;
    client.tournamentWins = 0;
    client.tournamentLosses = 0;
    client.tournamentStreak = 0;
  }
}

function toBracketPlayer(
  client: ConnectedClient,
  meta: OnlinePlayerMeta
): TournamentBracketPlayer {
  return {
    clientId: client.clientId,
    playerKey: resolvePlayerKey(client),
    displayName: meta.displayName,
    fighterId: meta.fighterId,
    tournamentPoints: meta.tournamentPoints,
  };
}

function buildTournamentMatchRecord(
  room: ActiveMatchRoom,
  status: 'live' | 'completed',
  winnerSlot: 0 | 1 | null = null,
  reason?: 'ko' | 'forfeit'
): TournamentMatchRecord {
  return {
    matchId: room.matchId,
    cycleId: room.tournamentCycleId || getTournamentScheduleStatus().cycleId,
    status,
    round: room.round,
    roundPhase: status === 'completed' ? 'completed' : room.roundPhase,
    targetWins: TARGET_SERIES_WINS,
    scores: [room.scores[0], room.scores[1]],
    mapId: room.mapId,
    players: [
      toBracketPlayer(room.clients[0], room.metas[0]),
      toBracketPlayer(room.clients[1], room.metas[1]),
    ],
    winnerSlot,
    reason,
    startedAtMs: room.startedAtMs,
    finishedAtMs: status === 'completed' ? Date.now() : undefined,
  };
}

function buildTournamentStateSnapshot(nowMs = Date.now()): TournamentStateSnapshot {
  const s = getTournamentScheduleStatus(nowMs);
  const currentLedger = tournamentCycleLedgers.get(s.cycleId);
  const lastLedger = s.previousCycleId ? tournamentCycleLedgers.get(s.previousCycleId) : undefined;
  const liveTournamentMatches: TournamentMatchRecord[] = [];
  for (const room of activeMatches.values()) {
    if (room.queueType === 'tournament' && !room.finished) {
      liveTournamentMatches.push(buildTournamentMatchRecord(room, 'live'));
    }
  }
  const recentSourceCycle = s.isActive ? s.cycleId : s.previousCycleId;
  const recentMatches = recentSourceCycle
    ? (tournamentCycleRecentMatches.get(recentSourceCycle) ?? []).slice(0, 12)
    : [];

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
    standings: sortStandings(currentLedger),
    lastCycleId: s.previousCycleId,
    lastCycleTitle: s.previousCycleTitle,
    lastStandings: sortStandings(lastLedger),
    activeMatches: liveTournamentMatches,
    recentMatches,
  };
}

function sendToClient(client: ConnectedClient, msg: ServerWsMessage): void {
  if (client.ws.readyState !== WebSocket.OPEN) return;
  try {
    client.ws.send(JSON.stringify(msg));
  } catch {
    // Ignore transient closed-socket send errors
  }
}

function removeFromQueueList(list: string[], clientId: string): void {
  const idx = list.indexOf(clientId);
  if (idx !== -1) list.splice(idx, 1);
}

function toLobbyEntry(client: ConnectedClient): WaitingLobbyEntry {
  return {
    clientId: client.clientId,
    displayName: client.displayName,
    fighterId: client.fighterId,
    preferredMap: client.preferredMap,
    rankedPoints: client.rankedPoints,
    tournamentPoints: client.tournamentPoints,
    status: client.matchId ? 'in_match' : client.queue ? 'queued' : 'waiting',
    joinedAt: client.queueEnteredAt ?? client.joinedAt,
  };
}

function buildWaitingAreaSnapshot(): WaitingAreaSnapshot {
  const casualWaiting: WaitingLobbyEntry[] = [];
  const rankedWaiting: WaitingLobbyEntry[] = [];
  const tournamentWaiting: WaitingLobbyEntry[] = [];
  let casualInMatchCount = 0;
  let rankedInMatchCount = 0;
  let tournamentInMatchCount = 0;

  for (const room of activeMatches.values()) {
    if (room.finished) continue;
    if (room.queueType === 'casual') casualInMatchCount += 2;
    else if (room.queueType === 'ranked') rankedInMatchCount += 2;
    else tournamentInMatchCount += 2;
  }

  for (const client of clients.values()) {
    if (client.area === 'casual') {
      casualWaiting.push(toLobbyEntry(client));
    } else if (client.area === 'ranked') {
      rankedWaiting.push(toLobbyEntry(client));
    } else if (client.area === 'tournament') {
      tournamentWaiting.push(toLobbyEntry(client));
    }
  }

  const sortEntries = (a: WaitingLobbyEntry, b: WaitingLobbyEntry) => {
    const order = { queued: 0, waiting: 1, in_match: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.joinedAt - b.joinedAt;
  };

  casualWaiting.sort(sortEntries);
  rankedWaiting.sort(sortEntries);
  tournamentWaiting.sort(sortEntries);

  return {
    casualWaiting,
    rankedWaiting,
    tournamentWaiting,
    casualInMatchCount,
    rankedInMatchCount,
    tournamentInMatchCount,
  };
}

function broadcastPresence(): void {
  const snapshot = buildWaitingAreaSnapshot();
  const msg: ServerWsMessage = { type: 'presence:update', snapshot };
  const payload = JSON.stringify(msg);
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch {
        // Ignore transient write errors
      }
    }
  }
}

function broadcastTournamentUpdate(): void {
  const tournament = buildTournamentStateSnapshot();
  const msg: ServerWsMessage = { type: 'tournament:update', tournament };
  const payload = JSON.stringify(msg);
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch {
        // Ignore transient write errors
      }
    }
  }
}

function sendQueueStatuses(queueType: OnlineQueueType): void {
  const list =
    queueType === 'casual'
      ? casualQueue
      : queueType === 'ranked'
      ? rankedQueue
      : tournamentQueue;
  list.forEach((cid, idx) => {
    const client = clients.get(cid);
    if (!client) return;
    sendToClient(client, {
      type: 'queue:status',
      inQueue: queueType,
      position: idx + 1,
      enteredAt: client.queueEnteredAt,
    });
  });
}

function serializeEngineSnapshot(state: GameEngineState): SerializedEngineSnapshot {
  return {
    phase: state.phase,
    mode: state.mode,
    mapId: state.mapId,
    matchTime: state.matchTime,
    ambientTime: state.ambientTime,
    hitstopTimer: state.hitstopTimer,
    shakeIntensity: state.shakeIntensity,
    lightningFlash: state.lightningFlash,
    windForceX: state.windForceX,
    winnerSlot: state.winnerSlot,
    players: state.players,
    platforms: state.platforms,
    obstacles: state.obstacles,
    destructibles: state.destructibles,
    projectiles: state.projectiles,
    zones: state.zones,
    slashes: state.slashes,
    activeParticles: state.particles.filter((p) => p.active),
    floatingNumbers: state.floatingNumbers,
  };
}

function pickMatchMap(c0: ConnectedClient, c1: ConnectedClient): MapId {
  const candidates: MapId[] = [];
  if (c0.preferredMap !== 'random') candidates.push(c0.preferredMap);
  if (c1.preferredMap !== 'random') candidates.push(c1.preferredMap);
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return ALL_MAP_IDS[Math.floor(Math.random() * ALL_MAP_IDS.length)];
}

function buildFinalSeriesPlayers(room: ActiveMatchRoom): [HudFighterSnapshot, HudFighterSnapshot] {
  const hud = buildHudSnapshot(room.state);
  const combine = (slot: 0 | 1): HudFighterSnapshot => {
    const cur = hud.players[slot];
    const prev = room.completedRoundStats[slot];
    return {
      ...cur,
      name: room.metas[slot].displayName,
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

function accumulateCurrentRoundStats(room: ActiveMatchRoom): void {
  for (const slot of [0, 1] as const) {
    const fighter = room.state.players[slot];
    const acc = room.completedRoundStats[slot];
    acc.damageDealt += fighter.damageDealt;
    acc.koCount += fighter.koCount;
    acc.hitsLanded += fighter.hitsLanded;
    acc.longestCombo = Math.max(acc.longestCombo, fighter.longestCombo);
    acc.peakSingleHit = Math.max(acc.peakSingleHit, fighter.peakSingleHit);
    acc.heavyHitsLanded += fighter.heavyHitsLanded;
  }
}

function broadcastMatchState(room: ActiveMatchRoom, forceClearSounds = true): void {
  const sounds = room.pendingSounds;
  if (forceClearSounds) {
    room.pendingSounds = [];
  }
  const msg: ServerWsMessage = {
    type: 'match:state',
    matchId: room.matchId,
    tick: room.tickCount,
    round: room.round,
    scores: [room.scores[0], room.scores[1]],
    roundPhase: room.roundPhase,
    roundTimer: Number(room.roundTimer.toFixed(2)),
    lastRoundWinnerSlot: room.lastRoundWinnerSlot,
    state: serializeEngineSnapshot(room.state),
    sounds,
  };
  const payload = JSON.stringify(msg);
  for (const client of room.clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch {
        // Ignore closed socket
      }
    }
  }
}

function finishMatchSeries(
  room: ActiveMatchRoom,
  winnerSlot: 0 | 1,
  reason: 'ko' | 'forfeit'
): void {
  if (room.finished) return;
  room.finished = true;
  room.roundPhase = 'series_over';
  if (room.interval) {
    clearInterval(room.interval);
    room.interval = null;
  }

  const finalPlayers = buildFinalSeriesPlayers(room);
  const matchDurationSec = Math.max(1, Math.round((Date.now() - room.startedAtMs) / 1000));

  const loserSlot: 0 | 1 = winnerSlot === 0 ? 1 : 0;
  const rpDelta: [number, number] = [0, 0];
  const newRp: [number, number] = [room.metas[0].rankedPoints, room.metas[1].rankedPoints];
  const tpDelta: [number, number] = [0, 0];
  const newTp: [number, number] = [room.metas[0].tournamentPoints, room.metas[1].tournamentPoints];

  if (room.queueType === 'ranked') {
    const { winnerGain, loserLoss } = computeRankedRpDelta(
      room.metas[winnerSlot].rankedPoints,
      room.metas[loserSlot].rankedPoints
    );
    rpDelta[winnerSlot] = winnerGain;
    rpDelta[loserSlot] = -loserLoss;
    newRp[winnerSlot] = Math.min(MAX_RANKED_POINTS, room.metas[winnerSlot].rankedPoints + winnerGain);
    newRp[loserSlot] = Math.max(0, room.metas[loserSlot].rankedPoints - loserLoss);

    room.clients[winnerSlot].rankedPoints = newRp[winnerSlot];
    room.clients[loserSlot].rankedPoints = newRp[loserSlot];
  } else if (room.queueType === 'tournament') {
    const cycleId = room.tournamentCycleId || getTournamentScheduleStatus().cycleId;
    const { winnerTpGain, loserTpGain } = computeTournamentPointsAward(
      room.scores[winnerSlot],
      room.scores[loserSlot],
      reason
    );
    tpDelta[winnerSlot] = winnerTpGain;
    tpDelta[loserSlot] = loserTpGain;

    const ledger = getCycleLedger(cycleId);
    for (const slot of [winnerSlot, loserSlot] as const) {
      const client = room.clients[slot];
      const meta = room.metas[slot];
      const won = slot === winnerSlot;
      const gain = tpDelta[slot];
      const nextPoints = Math.min(MAX_TOURNAMENT_POINTS, meta.tournamentPoints + gain);
      newTp[slot] = nextPoints;

      client.tournamentCycleId = cycleId;
      client.tournamentPoints = nextPoints;
      client.tournamentWins = (client.tournamentWins || 0) + (won ? 1 : 0);
      client.tournamentLosses = (client.tournamentLosses || 0) + (won ? 0 : 1);
      client.tournamentStreak = won ? (client.tournamentStreak || 0) + 1 : 0;

      const playerKey = resolvePlayerKey(client);
      const prevEntry = ledger.get(playerKey);
      ledger.set(playerKey, {
        playerKey,
        displayName: meta.displayName,
        fighterId: meta.fighterId,
        points: Math.max(prevEntry?.points ?? 0, nextPoints),
        wins: (prevEntry?.wins ?? 0) + (won ? 1 : 0),
        losses: (prevEntry?.losses ?? 0) + (won ? 0 : 1),
        streak: won ? (prevEntry?.streak ?? 0) + 1 : 0,
        updatedAt: Date.now(),
      });
    }
  }

  const msg: ServerWsMessage = {
    type: 'match:series_over',
    matchId: room.matchId,
    queueType: room.queueType,
    winnerSlot,
    reason,
    scores: [room.scores[0], room.scores[1]],
    finalPlayers,
    matchDurationSec,
    rpDelta,
    newRp,
    tpDelta,
    newTp,
    tournamentCycleId: room.tournamentCycleId,
  };

  for (const client of room.clients) {
    sendToClient(client, msg);
    if (client.matchId === room.matchId) {
      client.matchId = null;
      client.queue = null;
      client.queueEnteredAt = null;
    }
  }

  if (room.queueType === 'tournament') {
    const cycleId = room.tournamentCycleId || getTournamentScheduleStatus().cycleId;
    const history = tournamentCycleRecentMatches.get(cycleId) ?? [];
    history.unshift(buildTournamentMatchRecord(room, 'completed', winnerSlot, reason));
    if (history.length > 16) history.length = 16;
    tournamentCycleRecentMatches.set(cycleId, history);
  }

  activeMatches.delete(room.matchId);
  broadcastPresence();
  if (room.queueType === 'tournament') {
    broadcastTournamentUpdate();
  }
}

function consumeFighterControls(
  inputState: PlayerInputState,
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

function stepMatchRoom(room: ActiveMatchRoom): void {
  if (room.finished) return;
  room.tickCount += 1;

  if (room.roundPhase === 'intro') {
    room.roundTimer = Math.max(0, room.roundTimer - TICK_DT);
    room.state.ambientTime += TICK_DT;
    stepPlatforms(room.state, TICK_DT);
    stepVisualEffects(room.state, TICK_DT);
    // Clear queued actions during intro countdown so buffered clicks don't fire stale
    room.inputs[0].queued = {};
    room.inputs[1].queued = {};

    if (room.roundTimer <= 0) {
      room.roundPhase = 'fighting';
      room.roundTimer = 0;
      broadcastMatchState(room);
      if (room.queueType === 'tournament') {
        broadcastTournamentUpdate();
      }
      return;
    }
  } else if (room.roundPhase === 'fighting') {
    const c0 = consumeFighterControls(room.inputs[0], room.state.players[0].confuseTimer > 0);
    const c1 = consumeFighterControls(room.inputs[1], room.state.players[1].confuseTimer > 0);

    let roundEndedWinner: 0 | 1 | null = null;
    const { sounds } = stepCombatFrame(room.state, [c0, c1], TICK_DT, {
      startingStocks: ONLINE_ROUND_STOCKS,
      onMatchEnd: (winnerSlot) => {
        roundEndedWinner = winnerSlot;
      },
    });
    if (sounds.length > 0) {
      room.pendingSounds.push(...sounds);
    }

    if (roundEndedWinner !== null) {
      room.scores[roundEndedWinner] += 1;
      room.lastRoundWinnerSlot = roundEndedWinner;

      if (room.scores[roundEndedWinner] >= TARGET_SERIES_WINS) {
        broadcastMatchState(room);
        finishMatchSeries(room, roundEndedWinner, 'ko');
        return;
      }

      room.roundPhase = 'round_over';
      room.roundTimer = 2.6;
      broadcastMatchState(room);
      if (room.queueType === 'tournament') {
        broadcastTournamentUpdate();
      }
      return;
    }
  } else if (room.roundPhase === 'round_over') {
    room.roundTimer = Math.max(0, room.roundTimer - TICK_DT);
    stepVictoryPhase(room.state, TICK_DT);
    stepVisualEffects(room.state, TICK_DT);
    room.inputs[0].queued = {};
    room.inputs[1].queued = {};

    if (room.roundTimer <= 0) {
      accumulateCurrentRoundStats(room);
      room.round += 1;
      const playMode: PlayMode =
        room.queueType === 'ranked'
          ? 'ONLINE_RANKED'
          : room.queueType === 'tournament'
          ? 'ONLINE_TOURNAMENT'
          : 'ONLINE_CASUAL';
      room.state = createInitialEngineState(
        'PLAYING',
        playMode,
        room.mapId,
        room.metas[0].fighterId,
        room.metas[1].fighterId,
        ONLINE_ROUND_STOCKS
      );
      room.roundPhase = 'intro';
      room.roundTimer = 1.4;
      broadcastMatchState(room);
      if (room.queueType === 'tournament') {
        broadcastTournamentUpdate();
      }
      return;
    }
  }

  if (room.tickCount % BROADCAST_EVERY_TICKS === 0) {
    broadcastMatchState(room);
  }
}

function startOnlineMatch(
  queueType: OnlineQueueType,
  c0: ConnectedClient,
  c1: ConnectedClient
): void {
  const matchId = `m_${crypto.randomUUID()}`;
  const mapId = pickMatchMap(c0, c1);
  const playMode: PlayMode =
    queueType === 'ranked'
      ? 'ONLINE_RANKED'
      : queueType === 'tournament'
      ? 'ONLINE_TOURNAMENT'
      : 'ONLINE_CASUAL';
  const schedule = queueType === 'tournament' ? getTournamentScheduleStatus() : null;

  c0.queue = null;
  c0.queueEnteredAt = null;
  c0.matchId = matchId;
  c0.area = queueType;

  c1.queue = null;
  c1.queueEnteredAt = null;
  c1.matchId = matchId;
  c1.area = queueType;

  const metas: [OnlinePlayerMeta, OnlinePlayerMeta] = [
    {
      clientId: c0.clientId,
      accountUid: c0.accountUid,
      displayName: c0.displayName,
      fighterId: c0.fighterId,
      rankedPoints: c0.rankedPoints,
      tournamentPoints: c0.tournamentPoints,
    },
    {
      clientId: c1.clientId,
      accountUid: c1.accountUid,
      displayName: c1.displayName,
      fighterId: c1.fighterId,
      rankedPoints: c1.rankedPoints,
      tournamentPoints: c1.tournamentPoints,
    },
  ];

  const room: ActiveMatchRoom = {
    matchId,
    queueType,
    tournamentCycleId: schedule?.cycleId,
    tournamentTitle: schedule?.title,
    mapId,
    clients: [c0, c1],
    metas,
    inputs: [createEmptyInputState(), createEmptyInputState()],
    state: createInitialEngineState(
      'PLAYING',
      playMode,
      mapId,
      metas[0].fighterId,
      metas[1].fighterId,
      ONLINE_ROUND_STOCKS
    ),
    round: 1,
    scores: [0, 0],
    roundPhase: 'intro',
    roundTimer: 1.5,
    lastRoundWinnerSlot: null,
    tickCount: 0,
    startedAtMs: Date.now(),
    pendingSounds: [],
    completedRoundStats: [createEmptyCumulativeStats(), createEmptyCumulativeStats()],
    interval: null,
    finished: false,
  };

  activeMatches.set(matchId, room);

  sendToClient(c0, {
    type: 'queue:status',
    inQueue: null,
    position: 0,
    enteredAt: null,
  });
  sendToClient(c1, {
    type: 'queue:status',
    inQueue: null,
    position: 0,
    enteredAt: null,
  });

  sendToClient(c0, {
    type: 'match:started',
    matchId,
    queueType,
    yourSlot: 0,
    mapId,
    targetWins: TARGET_SERIES_WINS,
    round: 1,
    scores: [0, 0],
    players: metas,
    tournamentCycleId: schedule?.cycleId,
    tournamentTitle: schedule?.title,
  });
  sendToClient(c1, {
    type: 'match:started',
    matchId,
    queueType,
    yourSlot: 1,
    mapId,
    targetWins: TARGET_SERIES_WINS,
    round: 1,
    scores: [0, 0],
    players: metas,
    tournamentCycleId: schedule?.cycleId,
    tournamentTitle: schedule?.title,
  });

  broadcastMatchState(room);
  broadcastPresence();
  if (queueType === 'tournament') {
    broadcastTournamentUpdate();
  }

  room.interval = setInterval(() => {
    stepMatchRoom(room);
  }, Math.round(1000 / TICK_HZ));
}

function pruneQueue(list: string[], queueType: OnlineQueueType): ConnectedClient[] {
  const valid: ConnectedClient[] = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const c = clients.get(list[i]);
    if (!c || c.ws.readyState !== WebSocket.OPEN || c.queue !== queueType || c.matchId) {
      list.splice(i, 1);
    }
  }
  for (const cid of list) {
    const c = clients.get(cid);
    if (c) valid.push(c);
  }
  return valid;
}

function tryMatchmake(queueType: OnlineQueueType): void {
  if (queueType === 'casual') {
    const queued = pruneQueue(casualQueue, 'casual');
    while (queued.length >= 2) {
      const p0 = queued.shift()!;
      const p1 = queued.shift()!;
      removeFromQueueList(casualQueue, p0.clientId);
      removeFromQueueList(casualQueue, p1.clientId);
      startOnlineMatch('casual', p0, p1);
    }
    sendQueueStatuses('casual');
    return;
  }

  if (queueType === 'tournament') {
    const schedule = getTournamentScheduleStatus();
    if (!schedule.isActive) {
      return;
    }
    const queued = pruneQueue(tournamentQueue, 'tournament');
    while (queued.length >= 2) {
      let bestI = 0;
      let bestJ = 1;
      let bestDiff = Math.abs(queued[0].tournamentPoints - queued[1].tournamentPoints);
      for (let i = 0; i < queued.length; i++) {
        for (let j = i + 1; j < queued.length; j++) {
          const diff = Math.abs(queued[i].tournamentPoints - queued[j].tournamentPoints);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestI = i;
            bestJ = j;
          }
        }
      }
      const p0 = queued[bestI];
      const p1 = queued[bestJ];
      queued.splice(bestJ, 1);
      queued.splice(bestI, 1);
      removeFromQueueList(tournamentQueue, p0.clientId);
      removeFromQueueList(tournamentQueue, p1.clientId);
      startOnlineMatch('tournament', p0, p1);
    }
    sendQueueStatuses('tournament');
    return;
  }

  // Strictly isolated Ranked matchmaking: pair closest RP among waiting Ranked players
  const queued = pruneQueue(rankedQueue, 'ranked');
  while (queued.length >= 2) {
    let bestI = 0;
    let bestJ = 1;
    let bestDiff = Math.abs(queued[0].rankedPoints - queued[1].rankedPoints);
    for (let i = 0; i < queued.length; i++) {
      for (let j = i + 1; j < queued.length; j++) {
        const diff = Math.abs(queued[i].rankedPoints - queued[j].rankedPoints);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const p0 = queued[bestI];
    const p1 = queued[bestJ];
    queued.splice(bestJ, 1);
    queued.splice(bestI, 1);
    removeFromQueueList(rankedQueue, p0.clientId);
    removeFromQueueList(rankedQueue, p1.clientId);
    startOnlineMatch('ranked', p0, p1);
  }
  sendQueueStatuses('ranked');
}

function handleClientLeaveMatch(client: ConnectedClient, matchId?: string): void {
  const targetMatchId = matchId || client.matchId;
  if (!targetMatchId) return;
  const room = activeMatches.get(targetMatchId);
  if (!room || room.finished) {
    if (client.matchId === targetMatchId) client.matchId = null;
    return;
  }
  const slot = room.clients[0].clientId === client.clientId ? 0 : room.clients[1].clientId === client.clientId ? 1 : null;
  if (slot === null) return;
  const winnerSlot: 0 | 1 = slot === 0 ? 1 : 0;
  finishMatchSeries(room, winnerSlot, 'forfeit');
}

function leaveAllQueues(client: ConnectedClient): void {
  const prevQueue = client.queue;
  removeFromQueueList(casualQueue, client.clientId);
  removeFromQueueList(rankedQueue, client.clientId);
  removeFromQueueList(tournamentQueue, client.clientId);
  client.queue = null;
  client.queueEnteredAt = null;
  sendToClient(client, {
    type: 'queue:status',
    inQueue: null,
    position: 0,
    enteredAt: null,
  });
  if (prevQueue) {
    sendQueueStatuses(prevQueue);
  }
}

function applyClientMetadata(
  client: ConnectedClient,
  parsed: {
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
): void {
  if (typeof parsed.accountUid === 'string' && /^[a-zA-Z0-9_\-]{1,128}$/.test(parsed.accountUid)) {
    client.accountUid = parsed.accountUid;
  }
  client.displayName = sanitizeDisplayName(parsed.displayName, `Fighter-${client.clientId.slice(0, 4)}`);
  client.fighterId = sanitizeFighterId(parsed.fighterId);
  client.preferredMap = sanitizeMapSelection(parsed.preferredMap);
  client.rankedPoints = clampRankedPoints(parsed.rankedPoints);

  const schedule = getTournamentScheduleStatus();
  const incomingCycleId =
    typeof parsed.tournamentCycleId === 'string' && /^(cycle_[0-9]+|none)$/.test(parsed.tournamentCycleId)
      ? parsed.tournamentCycleId
      : schedule.cycleId;

  if (incomingCycleId === schedule.cycleId) {
    client.tournamentCycleId = incomingCycleId;
    client.tournamentPoints = Math.max(
      client.tournamentPoints,
      clampNonNegInt(parsed.tournamentPoints, MAX_TOURNAMENT_POINTS)
    );
    client.tournamentWins = Math.max(
      client.tournamentWins,
      clampNonNegInt(parsed.tournamentWins, 1_000_000)
    );
    client.tournamentLosses = Math.max(
      client.tournamentLosses,
      clampNonNegInt(parsed.tournamentLosses, 1_000_000)
    );
    client.tournamentStreak = clampNonNegInt(parsed.tournamentStreak, 1_000_000);
  }
  if (schedule.isActive) {
    syncClientToTournamentLedger(client, schedule.cycleId);
  }
}

function handleClientMessage(client: ConnectedClient, raw: string): void {
  let parsed: ClientWsMessage;
  try {
    parsed = JSON.parse(raw) as ClientWsMessage;
  } catch {
    sendToClient(client, { type: 'error', message: 'Malformed JSON payload.' });
    return;
  }

  if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
    return;
  }

  switch (parsed.type) {
    case 'presence:enter': {
      const area: WaitingAreaKind =
        parsed.area === 'casual' || parsed.area === 'ranked' || parsed.area === 'tournament'
          ? parsed.area
          : 'none';
      applyClientMetadata(client, parsed);

      // Switching away from the current queue cancels that queue cleanly
      if (client.queue && client.queue !== area) {
        leaveAllQueues(client);
      }
      client.area = area;
      broadcastPresence();
      if (area === 'tournament') {
        broadcastTournamentUpdate();
      }
      break;
    }

    case 'queue:join': {
      if (client.matchId) {
        sendToClient(client, { type: 'error', message: 'Already in an active match.' });
        return;
      }
      const queueType: OnlineQueueType =
        parsed.queue === 'ranked'
          ? 'ranked'
          : parsed.queue === 'tournament'
          ? 'tournament'
          : 'casual';

      applyClientMetadata(client, parsed);

      if (queueType === 'tournament') {
        const schedule = getTournamentScheduleStatus();
        if (!schedule.isActive) {
          sendToClient(client, {
            type: 'error',
            message:
              'Bi-weekly Tournament is currently closed. Tournaments run for 1 week every 2 weeks.',
          });
          sendToClient(client, {
            type: 'tournament:update',
            tournament: buildTournamentStateSnapshot(),
          });
          return;
        }
      }

      // Enforce strict queue isolation across Casual, Ranked, and Tournament
      removeFromQueueList(casualQueue, client.clientId);
      removeFromQueueList(rankedQueue, client.clientId);
      removeFromQueueList(tournamentQueue, client.clientId);

      client.area = queueType;
      client.queue = queueType;
      client.queueEnteredAt = Date.now();

      if (queueType === 'casual') {
        casualQueue.push(client.clientId);
      } else if (queueType === 'ranked') {
        rankedQueue.push(client.clientId);
      } else {
        tournamentQueue.push(client.clientId);
      }

      tryMatchmake(queueType);
      broadcastPresence();
      break;
    }

    case 'queue:leave': {
      leaveAllQueues(client);
      broadcastPresence();
      break;
    }

    case 'match:input': {
      if (!client.matchId || parsed.matchId !== client.matchId) return;
      const room = activeMatches.get(client.matchId);
      if (!room || room.finished) return;
      const slot =
        room.clients[0].clientId === client.clientId
          ? 0
          : room.clients[1].clientId === client.clientId
          ? 1
          : null;
      if (slot === null) return;

      const target = room.inputs[slot];
      const rawDir = Number(parsed.moveDir);
      target.moveDir = Number.isFinite(rawDir) ? Math.max(-1, Math.min(1, Math.round(rawDir))) : 0;
      target.jumpHeld = Boolean(parsed.jumpHeld);
      target.downHeld = Boolean(parsed.downHeld);

      const act = parsed.actions;
      if (act && typeof act === 'object') {
        if (act.jump) target.queued.jump = true;
        if (act.attackCombo) target.queued.attackCombo = true;
        if (act.attack1) target.queued.attack1 = true;
        if (act.attack2) target.queued.attack2 = true;
        if (act.attack3) target.queued.attack3 = true;
        if (act.special) target.queued.special = true;
        if (act.ultimate) target.queued.ultimate = true;
        if (act.recovery) target.queued.recovery = true;
        if (act.taunt) target.queued.taunt = true;
      }
      break;
    }

    case 'match:leave': {
      handleClientLeaveMatch(client, parsed.matchId);
      break;
    }
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const snap = buildWaitingAreaSnapshot();
    const tournament = buildTournamentStateSnapshot();
    res.json({
      ok: true,
      connectedClients: clients.size,
      casualWaiting: snap.casualWaiting.length,
      rankedWaiting: snap.rankedWaiting.length,
      tournamentWaiting: snap.tournamentWaiting.length,
      casualInMatch: snap.casualInMatchCount,
      rankedInMatch: snap.rankedInMatchCount,
      tournamentInMatch: snap.tournamentInMatchCount,
      tournamentActive: tournament.isActive,
      tournamentCycleId: tournament.cycleId,
    });
  });

  app.get('/api/online/status', (_req, res) => {
    res.json(buildWaitingAreaSnapshot());
  });

  app.get('/api/tournament/schedule', (_req, res) => {
    res.json(buildTournamentStateSnapshot());
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 32768,
  });

  wss.on('connection', (ws) => {
    const clientId = crypto.randomUUID();
    const fallbackFighter: FighterId = 'honey_shell';
    const schedule = getTournamentScheduleStatus();
    const client: ConnectedClient = {
      clientId,
      ws,
      isAlive: true,
      area: 'none',
      queue: null,
      queueEnteredAt: null,
      matchId: null,
      displayName: `Fighter-${clientId.slice(0, 4)}`,
      fighterId: fallbackFighter in FIGHTER_SPECS ? fallbackFighter : 'honey_shell',
      preferredMap: 'random',
      rankedPoints: DEFAULT_RANKED_POINTS,
      tournamentPoints: 0,
      tournamentWins: 0,
      tournamentLosses: 0,
      tournamentStreak: 0,
      tournamentCycleId: schedule.cycleId,
      joinedAt: Date.now(),
    };

    clients.set(clientId, client);

    sendToClient(client, {
      type: 'connected',
      clientId,
      snapshot: buildWaitingAreaSnapshot(),
      tournament: buildTournamentStateSnapshot(),
    });

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (data) => {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      handleClientMessage(client, text);
    });

    ws.on('close', () => {
      if (client.matchId) {
        handleClientLeaveMatch(client, client.matchId);
      }
      leaveAllQueues(client);
      clients.delete(clientId);
      broadcastPresence();
    });

    ws.on('error', () => {
      if (client.matchId) {
        handleClientLeaveMatch(client, client.matchId);
      }
      leaveAllQueues(client);
      clients.delete(clientId);
      broadcastPresence();
    });
  });

  const heartbeatInterval = setInterval(() => {
    for (const client of clients.values()) {
      if (!client.isAlive) {
        client.ws.terminate();
        continue;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch {
        // Ignore ping errors
      }
    }

    const sched = getTournamentScheduleStatus();
    if (
      sched.isActive !== lastObservedTournamentActive ||
      sched.cycleId !== lastObservedTournamentCycleId
    ) {
      lastObservedTournamentActive = sched.isActive;
      lastObservedTournamentCycleId = sched.cycleId;
      if (!sched.isActive) {
        for (const cid of [...tournamentQueue]) {
          const queuedClient = clients.get(cid);
          if (queuedClient) {
            leaveAllQueues(queuedClient);
          }
        }
        tournamentQueue.length = 0;
        broadcastPresence();
      }
      broadcastTournamentUpdate();
    }
  }, 15000);

  server.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Token Wars server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Token Wars server:', err);
  process.exit(1);
});
