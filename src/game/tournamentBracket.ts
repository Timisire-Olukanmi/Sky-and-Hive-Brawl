import type { FighterId, MapId } from './types';
import type {
  OnlineRoundPhase,
  TournamentMatchRecord,
  TournamentStateSnapshot,
  WaitingAreaSnapshot,
} from './onlineTypes';

export type BracketMatchStatus = 'live' | 'completed' | 'upcoming' | 'awaiting';
export type BracketRoundIndex = 0 | 1 | 2;

export interface BracketEntrant {
  key: string;
  clientId?: string;
  displayName: string;
  fighterId: FighterId;
  points: number;
  wins: number;
  losses: number;
  streak: number;
  presenceStatus: 'in_match' | 'queued' | 'waiting' | 'standings';
  isSelf: boolean;
  seed: number;
}

export interface TournamentBracketNode {
  id: string;
  label: string;
  roundIndex: BracketRoundIndex;
  roundName: 'Quarterfinals' | 'Semifinals' | 'Grand Final';
  status: BracketMatchStatus;
  slots: [BracketEntrant | null, BracketEntrant | null];
  sourceLabels: [string, string];
  scores: [number, number] | null;
  winnerIndex: 0 | 1 | null;
  serverRound?: number;
  roundPhase?: OnlineRoundPhase | 'completed';
  targetWins: number;
  mapId?: MapId;
  matchId?: string;
  reason?: 'ko' | 'forfeit';
  containsLocalPlayer: boolean;
  feedsIntoId?: string;
}

export interface UpcomingOpponentInfo {
  entrant: BracketEntrant;
  matchNodeId: string;
  roundName: string;
  statusLabel: string;
  matchId?: string;
}

export interface TournamentBracketModel {
  cycleId: string;
  cycleNumber: number;
  cycleTitle: string;
  isActive: boolean;
  currentRoundLabel: string;
  playerMatchStatus: string;
  playerSeed: number | null;
  activeMatchNodeId: string | null;
  upcomingOpponent: UpcomingOpponentInfo | null;
  nodes: TournamentBracketNode[];
  entrantsCount: number;
  liveMatchesCount: number;
  completedMatchesCount: number;
  champion: BracketEntrant | null;
}

interface BuildBracketParams {
  tournamentSnapshot: TournamentStateSnapshot;
  waitingSnapshot: WaitingAreaSnapshot;
  clientId: string | null;
  playerName: string;
  selectedFighter: FighterId;
  currentPoints: number;
  currentWins: number;
  currentLosses: number;
  currentStreak: number;
  inQueue: boolean;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function matchPlayerKey(
  p: { clientId?: string; playerKey?: string; displayName: string },
  entrant: BracketEntrant
): boolean {
  if (p.clientId && entrant.clientId && p.clientId === entrant.clientId) return true;
  if (p.playerKey && entrant.key === p.playerKey) return true;
  return normalizeName(p.displayName) === normalizeName(entrant.displayName);
}

function buildSeededEntrants(params: BuildBracketParams): BracketEntrant[] {
  const {
    tournamentSnapshot,
    waitingSnapshot,
    clientId,
    playerName,
    selectedFighter,
    currentPoints,
    currentWins,
    currentLosses,
    currentStreak,
  } = params;

  const byKey = new Map<string, BracketEntrant>();
  const nameToKey = new Map<string, string>();

  const upsert = (partial: Omit<BracketEntrant, 'seed'>) => {
    const existingById = byKey.get(partial.key);
    const existingKeyByName = nameToKey.get(normalizeName(partial.displayName));
    const existing = existingById ?? (existingKeyByName ? byKey.get(existingKeyByName) : undefined);

    if (existing) {
      existing.clientId = partial.clientId ?? existing.clientId;
      existing.fighterId = partial.fighterId;
      existing.points = Math.max(existing.points, partial.points);
      existing.wins = Math.max(existing.wins, partial.wins);
      existing.losses = Math.max(existing.losses, partial.losses);
      existing.streak = Math.max(existing.streak, partial.streak);
      existing.isSelf = existing.isSelf || partial.isSelf;
      if (
        partial.presenceStatus === 'in_match' ||
        (partial.presenceStatus === 'queued' && existing.presenceStatus !== 'in_match') ||
        (partial.presenceStatus === 'waiting' && existing.presenceStatus === 'standings')
      ) {
        existing.presenceStatus = partial.presenceStatus;
      }
      return;
    }

    const created: BracketEntrant = { ...partial, seed: 0 };
    byKey.set(partial.key, created);
    nameToKey.set(normalizeName(partial.displayName), partial.key);
  };

  const standingsSource = tournamentSnapshot.isActive
    ? tournamentSnapshot.standings
    : tournamentSnapshot.standings.length > 0
    ? tournamentSnapshot.standings
    : tournamentSnapshot.lastStandings;

  for (const row of standingsSource) {
    const isSelf = normalizeName(row.displayName) === normalizeName(playerName);
    upsert({
      key: row.playerKey,
      displayName: row.displayName,
      fighterId: row.fighterId,
      points: row.points,
      wins: row.wins,
      losses: row.losses,
      streak: row.streak,
      presenceStatus: 'standings',
      isSelf,
    });
  }

  for (const lobby of waitingSnapshot.tournamentWaiting) {
    const isSelf = Boolean(clientId && lobby.clientId === clientId);
    upsert({
      key: `ws:${lobby.clientId}`,
      clientId: lobby.clientId,
      displayName: lobby.displayName,
      fighterId: lobby.fighterId,
      points: lobby.tournamentPoints,
      wins: isSelf ? currentWins : 0,
      losses: isSelf ? currentLosses : 0,
      streak: isSelf ? currentStreak : 0,
      presenceStatus: lobby.status,
      isSelf,
    });
  }

  for (const match of [...tournamentSnapshot.activeMatches, ...tournamentSnapshot.recentMatches]) {
    for (const mp of match.players) {
      const isSelf = Boolean(clientId && mp.clientId === clientId);
      upsert({
        key: mp.playerKey,
        clientId: mp.clientId,
        displayName: mp.displayName,
        fighterId: mp.fighterId,
        points: mp.tournamentPoints,
        wins: isSelf ? currentWins : 0,
        losses: isSelf ? currentLosses : 0,
        streak: isSelf ? currentStreak : 0,
        presenceStatus: match.status === 'live' ? 'in_match' : 'standings',
        isSelf,
      });
    }
  }

  // Ensure local player is always represented on their tournament screen
  const hasSelf = Array.from(byKey.values()).some((e) => e.isSelf);
  if (!hasSelf) {
    upsert({
      key: clientId ? `ws:${clientId}` : `local:${normalizeName(playerName) || 'fighter'}`,
      clientId: clientId ?? undefined,
      displayName: playerName,
      fighterId: selectedFighter,
      points: currentPoints,
      wins: currentWins,
      losses: currentLosses,
      streak: currentStreak,
      presenceStatus: 'waiting',
      isSelf: true,
    });
  }

  const presencePriority: Record<BracketEntrant['presenceStatus'], number> = {
    in_match: 3,
    queued: 2,
    waiting: 1,
    standings: 0,
  };

  const sorted = Array.from(byKey.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (presencePriority[b.presenceStatus] !== presencePriority[a.presenceStatus]) {
      return presencePriority[b.presenceStatus] - presencePriority[a.presenceStatus];
    }
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return sorted.slice(0, 8).map((entrant, idx) => ({
    ...entrant,
    seed: idx + 1,
  }));
}

function findMatchForPair(
  a: BracketEntrant | null,
  b: BracketEntrant | null,
  matches: TournamentMatchRecord[],
  usedMatchIds: Set<string>
): { match: TournamentMatchRecord; flipped: boolean } | null {
  if (!a || !b) return null;
  for (const m of matches) {
    if (usedMatchIds.has(m.matchId)) continue;
    const m0 = m.players[0];
    const m1 = m.players[1];
    if (matchPlayerKey(m0, a) && matchPlayerKey(m1, b)) {
      return { match: m, flipped: false };
    }
    if (matchPlayerKey(m0, b) && matchPlayerKey(m1, a)) {
      return { match: m, flipped: true };
    }
  }
  return null;
}

export function buildTournamentBracket(params: BuildBracketParams): TournamentBracketModel {
  const { tournamentSnapshot, inQueue } = params;
  const entrants = buildSeededEntrants(params);
  const selfEntrant = entrants.find((e) => e.isSelf) ?? null;

  const allMatches: TournamentMatchRecord[] = [
    ...tournamentSnapshot.activeMatches,
    ...tournamentSnapshot.recentMatches,
  ];
  const usedMatchIds = new Set<string>();

  // Standard 8-seed bracket pairs: (1v8), (4v5), (3v6), (2v7)
  // If an active/recent match exists between two seeded entrants who aren't adjacent,
  // place live/recent combatants across from each other in QF slots so real pairings always show cleanly.
  const seededSlots: (BracketEntrant | null)[] = Array.from({ length: 8 }, (_, idx) => entrants[idx] ?? null);
  const qfPairs: [number, number][] = [
    [0, 7],
    [3, 4],
    [2, 5],
    [1, 6],
  ];

  // Reorder secondary seed placements for any live active match whose participants both appear in seededSlots
  // so that live first-round matches appear head-to-head when fewer than 8 entrants exist,
  // WITHOUT pulling players back if they already advanced via a completed match.
  for (const liveMatch of tournamentSnapshot.activeMatches) {
    const idxA = seededSlots.findIndex((s) => s && matchPlayerKey(liveMatch.players[0], s));
    const idxB = seededSlots.findIndex((s) => s && matchPlayerKey(liveMatch.players[1], s));
    if (idxA !== -1 && idxB !== -1 && idxA !== idxB) {
      const entrantA = seededSlots[idxA]!;
      const entrantB = seededSlots[idxB]!;
      const alreadyAdvanced = tournamentSnapshot.recentMatches.some(
        (rm) =>
          rm.winnerSlot !== null &&
          (matchPlayerKey(rm.players[rm.winnerSlot], entrantA) ||
            matchPlayerKey(rm.players[rm.winnerSlot], entrantB))
      );
      if (alreadyAdvanced) continue;

      const alreadyPaired = qfPairs.some(
        ([x, y]) => (x === idxA && y === idxB) || (x === idxB && y === idxA)
      );
      if (!alreadyPaired) {
        const hostPair = qfPairs.find(([x, y]) => x === idxA || y === idxA);
        if (hostPair) {
          const targetSlotIdx = hostPair[0] === idxA ? hostPair[1] : hostPair[0];
          const displaced = seededSlots[targetSlotIdx];
          seededSlots[targetSlotIdx] = seededSlots[idxB];
          seededSlots[idxB] = displaced;
        }
      }
    }
  }

  // If there are exactly 2-4 entrants and no active match yet, pair top active seeds cleanly in QF1 (#1 vs #2)
  // if QF1's opposite slot (#8) is empty so players immediately see their real opponent across from them.
  if (entrants.length >= 2 && entrants.length <= 4 && tournamentSnapshot.activeMatches.length === 0) {
    if (!seededSlots[7] && seededSlots[1]) {
      const p2 = seededSlots[1];
      seededSlots[1] = null;
      seededSlots[7] = p2;
    }
    if (entrants.length >= 4 && !seededSlots[4] && seededSlots[2] && !seededSlots[5]) {
      // Keep 3v4 paired cleanly in QF2 when 4 players are present
      const p3 = seededSlots[2];
      seededSlots[2] = null;
      seededSlots[4] = p3;
    }
  }

  const qfLabels = ['QF #1', 'QF #2', 'QF #3', 'QF #4'];
  const qfFeeds = ['sf1', 'sf1', 'sf2', 'sf2'];

  const qfNodes: TournamentBracketNode[] = qfPairs.map(([idxA, idxB], i) => {
    const slotA = seededSlots[idxA];
    const slotB = seededSlots[idxB];
    const matched = findMatchForPair(slotA, slotB, allMatches, usedMatchIds);

    let status: BracketMatchStatus = 'awaiting';
    let scores: [number, number] | null = null;
    let winnerIndex: 0 | 1 | null = null;
    let serverRound: number | undefined;
    let roundPhase: OnlineRoundPhase | 'completed' | undefined;
    let matchId: string | undefined;
    let reason: 'ko' | 'forfeit' | undefined;

    if (matched) {
      usedMatchIds.add(matched.match.matchId);
      const { match, flipped } = matched;
      matchId = match.matchId;
      serverRound = match.round;
      roundPhase = match.roundPhase;
      reason = match.reason;
      scores = flipped ? [match.scores[1], match.scores[0]] : [match.scores[0], match.scores[1]];
      if (match.status === 'live') {
        status = 'live';
      } else {
        status = 'completed';
        if (match.winnerSlot !== null) {
          winnerIndex = flipped ? (match.winnerSlot === 0 ? 1 : 0) : match.winnerSlot;
        }
      }
    } else if (slotA && slotB) {
      status = 'upcoming';
    }

    return {
      id: `qf${i + 1}`,
      label: qfLabels[i],
      roundIndex: 0,
      roundName: 'Quarterfinals',
      status,
      slots: [slotA, slotB],
      sourceLabels: [
        slotA ? `Seed #${slotA.seed}` : 'Open Slot',
        slotB ? `Seed #${slotB.seed}` : 'Open Slot',
      ],
      scores,
      winnerIndex,
      serverRound,
      roundPhase,
      targetWins: 3,
      mapId: matched?.match.mapId,
      matchId,
      reason,
      containsLocalPlayer: Boolean(slotA?.isSelf || slotB?.isSelf),
      feedsIntoId: qfFeeds[i],
    };
  });

  const advanceSlot = (node: TournamentBracketNode): BracketEntrant | null => {
    if (node.status === 'completed' && node.winnerIndex !== null) {
      return node.slots[node.winnerIndex];
    }
    // Single-entrant open bye only if tournament is closed/finalized with < 5 entrants and no opponent filled
    if (!tournamentSnapshot.isActive && node.slots[0] && !node.slots[1]) {
      return node.slots[0];
    }
    return null;
  };

  const sfSpecs: Array<{
    id: string;
    label: string;
    left: TournamentBracketNode;
    right: TournamentBracketNode;
  }> = [
    { id: 'sf1', label: 'SF #1', left: qfNodes[0], right: qfNodes[1] },
    { id: 'sf2', label: 'SF #2', left: qfNodes[2], right: qfNodes[3] },
  ];

  const sfNodes: TournamentBracketNode[] = sfSpecs.map((spec) => {
    const slotA = advanceSlot(spec.left);
    const slotB = advanceSlot(spec.right);
    const matched = findMatchForPair(slotA, slotB, allMatches, usedMatchIds);

    let status: BracketMatchStatus = 'awaiting';
    let scores: [number, number] | null = null;
    let winnerIndex: 0 | 1 | null = null;
    let serverRound: number | undefined;
    let roundPhase: OnlineRoundPhase | 'completed' | undefined;
    let matchId: string | undefined;
    let reason: 'ko' | 'forfeit' | undefined;

    if (matched) {
      usedMatchIds.add(matched.match.matchId);
      const { match, flipped } = matched;
      matchId = match.matchId;
      serverRound = match.round;
      roundPhase = match.roundPhase;
      reason = match.reason;
      scores = flipped ? [match.scores[1], match.scores[0]] : [match.scores[0], match.scores[1]];
      if (match.status === 'live') {
        status = 'live';
      } else {
        status = 'completed';
        if (match.winnerSlot !== null) {
          winnerIndex = flipped ? (match.winnerSlot === 0 ? 1 : 0) : match.winnerSlot;
        }
      }
    } else if (slotA && slotB) {
      status = 'upcoming';
    }

    return {
      id: spec.id,
      label: spec.label,
      roundIndex: 1,
      roundName: 'Semifinals',
      status,
      slots: [slotA, slotB],
      sourceLabels: [`Winner ${spec.left.label}`, `Winner ${spec.right.label}`],
      scores,
      winnerIndex,
      serverRound,
      roundPhase,
      targetWins: 3,
      mapId: matched?.match.mapId,
      matchId,
      reason,
      containsLocalPlayer: Boolean(slotA?.isSelf || slotB?.isSelf),
      feedsIntoId: 'gf',
    };
  });

  const gfSlotA = advanceSlot(sfNodes[0]);
  const gfSlotB = advanceSlot(sfNodes[1]);
  const gfMatched = findMatchForPair(gfSlotA, gfSlotB, allMatches, usedMatchIds);

  let gfStatus: BracketMatchStatus = 'awaiting';
  let gfScores: [number, number] | null = null;
  let gfWinnerIndex: 0 | 1 | null = null;
  let gfServerRound: number | undefined;
  let gfRoundPhase: OnlineRoundPhase | 'completed' | undefined;
  let gfMatchId: string | undefined;
  let gfReason: 'ko' | 'forfeit' | undefined;

  if (gfMatched) {
    usedMatchIds.add(gfMatched.match.matchId);
    const { match, flipped } = gfMatched;
    gfMatchId = match.matchId;
    gfServerRound = match.round;
    gfRoundPhase = match.roundPhase;
    gfReason = match.reason;
    gfScores = flipped ? [match.scores[1], match.scores[0]] : [match.scores[0], match.scores[1]];
    if (match.status === 'live') {
      gfStatus = 'live';
    } else {
      gfStatus = 'completed';
      if (match.winnerSlot !== null) {
        gfWinnerIndex = flipped ? (match.winnerSlot === 0 ? 1 : 0) : match.winnerSlot;
      }
    }
  } else if (gfSlotA && gfSlotB) {
    gfStatus = 'upcoming';
  }

  const gfNode: TournamentBracketNode = {
    id: 'gf',
    label: 'Grand Final',
    roundIndex: 2,
    roundName: 'Grand Final',
    status: gfStatus,
    slots: [gfSlotA, gfSlotB],
    sourceLabels: ['Winner SF #1', 'Winner SF #2'],
    scores: gfScores,
    winnerIndex: gfWinnerIndex,
    serverRound: gfServerRound,
    roundPhase: gfRoundPhase,
    targetWins: 3,
    mapId: gfMatched?.match.mapId,
    matchId: gfMatchId,
    reason: gfReason,
    containsLocalPlayer: Boolean(gfSlotA?.isSelf || gfSlotB?.isSelf),
  };

  const nodes = [...qfNodes, ...sfNodes, gfNode];

  const champion: BracketEntrant | null =
    gfNode.status === 'completed' && gfNode.winnerIndex !== null
      ? gfNode.slots[gfNode.winnerIndex]
      : !tournamentSnapshot.isActive && entrants.length > 0 && entrants[0].points > 0
      ? entrants[0]
      : null;

  // Determine local player's active/upcoming node and opponent
  const playerNodes = nodes.filter((n) => n.containsLocalPlayer);
  const prioritizedPlayerNode =
    playerNodes.find((n) => n.status === 'live') ??
    playerNodes.find((n) => n.status === 'upcoming') ??
    playerNodes.find((n) => n.status === 'awaiting') ??
    playerNodes[playerNodes.length - 1] ??
    null;

  let upcomingOpponent: UpcomingOpponentInfo | null = null;
  if (prioritizedPlayerNode && selfEntrant) {
    const opp =
      prioritizedPlayerNode.slots[0]?.isSelf
        ? prioritizedPlayerNode.slots[1]
        : prioritizedPlayerNode.slots[0];
    if (opp) {
      upcomingOpponent = {
        entrant: opp,
        matchNodeId: prioritizedPlayerNode.id,
        roundName: prioritizedPlayerNode.roundName,
        statusLabel:
          prioritizedPlayerNode.status === 'live'
            ? `Live Match · Round ${prioritizedPlayerNode.serverRound ?? 1}`
            : prioritizedPlayerNode.status === 'completed'
            ? 'Previous Match Opponent'
            : opp.presenceStatus === 'queued'
            ? 'Queued for FT3'
            : 'Bracket Pairing',
        matchId: prioritizedPlayerNode.matchId,
      };
    }
  }

  let currentRoundLabel = tournamentSnapshot.isActive ? 'Quarterfinals' : 'Intermission';
  if (gfNode.status === 'live' || gfNode.status === 'completed') {
    currentRoundLabel = 'Grand Final';
  } else if (sfNodes.some((n) => n.status === 'live' || n.status === 'upcoming')) {
    currentRoundLabel = 'Semifinals';
  } else if (prioritizedPlayerNode) {
    currentRoundLabel = prioritizedPlayerNode.roundName;
  }

  let playerMatchStatus = 'Ready in Waiting Room';
  if (!tournamentSnapshot.isActive) {
    playerMatchStatus = 'Tournament Closed · Next Cycle Upcoming';
  } else if (prioritizedPlayerNode?.status === 'live') {
    const [s0, s1] = prioritizedPlayerNode.scores ?? [0, 0];
    playerMatchStatus = `In Match · Round ${prioritizedPlayerNode.serverRound ?? 1} (${s0}–${s1})`;
  } else if (inQueue) {
    playerMatchStatus = 'Searching FT3 Opponent';
  } else if (upcomingOpponent) {
    playerMatchStatus = 'Matchup Ready · Enter FT3 Queue';
  } else {
    playerMatchStatus = 'Awaiting Bracket Challenger';
  }

  return {
    cycleId: tournamentSnapshot.cycleId,
    cycleNumber: tournamentSnapshot.cycleNumber,
    cycleTitle: tournamentSnapshot.title,
    isActive: tournamentSnapshot.isActive,
    currentRoundLabel,
    playerMatchStatus,
    playerSeed: selfEntrant?.seed ?? null,
    activeMatchNodeId: prioritizedPlayerNode?.id ?? null,
    upcomingOpponent,
    nodes,
    entrantsCount: entrants.length,
    liveMatchesCount: nodes.filter((n) => n.status === 'live').length,
    completedMatchesCount: nodes.filter((n) => n.status === 'completed').length,
    champion,
  };
}
