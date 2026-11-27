import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Crown,
  GitBranch,
  Loader2,
  Swords,
  Trophy,
  UserCheck,
} from 'lucide-react';
import { FIGHTER_SPECS, MAP_SPECS } from '../game/constants';
import {
  TARGET_SERIES_WINS,
  type OnlineQueueType,
  type TournamentStateSnapshot,
  type WaitingAreaSnapshot,
} from '../game/onlineTypes';
import {
  buildTournamentBracket,
  type BracketEntrant,
  type BracketRoundIndex,
  type TournamentBracketNode,
} from '../game/tournamentBracket';
import type { FighterId } from '../game/types';
import { PixelFighterPortrait } from './PixelFighterPortrait';

type BracketFilterMode = 'all' | 'my_path' | 'live_upcoming';

interface TournamentBracketProps {
  connected: boolean;
  clientId: string | null;
  playerName: string;
  selectedFighter: FighterId;
  currentPoints: number;
  currentWins: number;
  currentLosses: number;
  currentStreak: number;
  waitingSnapshot: WaitingAreaSnapshot;
  tournamentSnapshot: TournamentStateSnapshot;
  inQueue: OnlineQueueType | null;
  onJoinTournamentQueue: () => void;
  onLeaveQueue: () => void;
  onUiClick?: () => void;
}

function getStatusText(node: TournamentBracketNode): string {
  switch (node.status) {
    case 'live':
      return `Live · R${node.serverRound ?? 1}`;
    case 'completed':
      return node.reason === 'forfeit' ? 'Final · Forfeit' : 'Final';
    case 'upcoming':
      return 'Upcoming · FT3';
    default:
      return 'Awaiting';
  }
}

function MatchCardSlot({
  entrant,
  fallbackLabel,
  score,
  isWinner,
  isLoser,
}: {
  entrant: BracketEntrant | null;
  fallbackLabel: string;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
}) {
  if (!entrant) {
    return (
      <div className="px-2.5 py-2 flex items-center justify-between gap-2 text-slate-500">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-slate-900 border border-white/10 flex items-center justify-center text-[10px] font-mono-num text-slate-500 shrink-0">
            —
          </div>
          <span className="text-[11px] font-medium truncate">{fallbackLabel}</span>
        </div>
        <span className="font-mono-num text-xs text-slate-600 shrink-0">-</span>
      </div>
    );
  }

  return (
    <div
      className={`px-2.5 py-2 flex items-center justify-between gap-2 transition-opacity ${
        isLoser ? 'opacity-55' : ''
      } ${entrant.isSelf ? 'bg-amber-500/10' : ''}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded bg-slate-950 border border-white/15 flex items-center justify-center shrink-0">
          <PixelFighterPortrait id={entrant.fighterId} size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[11px] font-bold text-white truncate">
            <span className="font-mono-num text-[10px] text-slate-400 shrink-0">
              #{entrant.seed}
            </span>
            <span className="truncate">{entrant.displayName}</span>
            {entrant.isSelf && (
              <span className="text-[10px] font-semibold text-amber-300 shrink-0">(You)</span>
            )}
          </div>
          <div className="text-[10px] font-mono-num text-slate-400 truncate">
            {entrant.points} TP · {FIGHTER_SPECS[entrant.fighterId].name}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isWinner && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
        )}
        <span
          className={`font-mono-num text-xs font-extrabold min-w-[16px] text-right ${
            isWinner
              ? 'text-emerald-300'
              : score !== null
              ? 'text-white'
              : 'text-slate-500'
          }`}
        >
          {score !== null ? score : '-'}
        </span>
      </div>
    </div>
  );
}

function BracketMatchCard({
  node,
  selected,
  dimmed,
  onSelect,
}: {
  node: TournamentBracketNode;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}) {
  const isLive = node.status === 'live';
  const isCompleted = node.status === 'completed';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-lg border text-left transition-[transform,opacity,border-color,background-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        dimmed ? 'opacity-40 hover:opacity-80' : 'opacity-100'
      } ${
        selected
          ? 'bg-slate-900 border-amber-400 shadow-lg ring-1 ring-amber-400/40'
          : isLive
          ? 'bg-slate-950/90 border-amber-400/50 hover:border-amber-300'
          : node.containsLocalPlayer
          ? 'bg-slate-950/85 border-amber-500/35 hover:border-amber-400/60'
          : 'bg-slate-950/80 border-white/10 hover:border-white/25'
      }`}
    >
      <div className="px-2.5 py-1.5 border-b border-white/10 flex items-center justify-between gap-2 text-[10px]">
        <span className="font-mono-num font-bold text-slate-300 whitespace-nowrap">
          {node.label}
        </span>
        <span
          className={`font-semibold whitespace-nowrap ${
            isLive
              ? 'text-amber-300'
              : isCompleted
              ? 'text-emerald-400'
              : node.status === 'upcoming'
              ? 'text-sky-300'
              : 'text-slate-500'
          }`}
        >
          {getStatusText(node)}
        </span>
      </div>

      <div className="divide-y divide-white/10">
        <MatchCardSlot
          entrant={node.slots[0]}
          fallbackLabel={node.sourceLabels[0]}
          score={node.scores ? node.scores[0] : null}
          isWinner={node.winnerIndex === 0}
          isLoser={node.winnerIndex === 1}
        />
        <MatchCardSlot
          entrant={node.slots[1]}
          fallbackLabel={node.sourceLabels[1]}
          score={node.scores ? node.scores[1] : null}
          isWinner={node.winnerIndex === 1}
          isLoser={node.winnerIndex === 0}
        />
      </div>
    </button>
  );
}

export function TournamentBracket({
  connected,
  clientId,
  playerName,
  selectedFighter,
  currentPoints,
  currentWins,
  currentLosses,
  currentStreak,
  waitingSnapshot,
  tournamentSnapshot,
  inQueue,
  onJoinTournamentQueue,
  onLeaveQueue,
  onUiClick,
}: TournamentBracketProps) {
  const isQueuedTournament = inQueue === 'tournament';
  const [filterMode, setFilterMode] = useState<BracketFilterMode>('all');
  const [mobileRound, setMobileRound] = useState<BracketRoundIndex>(0);

  const bracket = useMemo(
    () =>
      buildTournamentBracket({
        tournamentSnapshot,
        waitingSnapshot,
        clientId,
        playerName,
        selectedFighter,
        currentPoints,
        currentWins,
        currentLosses,
        currentStreak,
        inQueue: isQueuedTournament,
      }),
    [
      tournamentSnapshot,
      waitingSnapshot,
      clientId,
      playerName,
      selectedFighter,
      currentPoints,
      currentWins,
      currentLosses,
      currentStreak,
      isQueuedTournament,
    ]
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    () => bracket.activeMatchNodeId ?? 'qf1'
  );

  useEffect(() => {
    const exists = bracket.nodes.some((n) => n.id === selectedNodeId);
    if (!exists) {
      setSelectedNodeId(bracket.activeMatchNodeId ?? 'qf1');
    }
  }, [bracket.activeMatchNodeId, bracket.nodes, selectedNodeId]);

  const selectedNode =
    bracket.nodes.find((n) => n.id === selectedNodeId) ?? bracket.nodes[0];

  const qfNodes = bracket.nodes.filter((n) => n.roundIndex === 0);
  const sfNodes = bracket.nodes.filter((n) => n.roundIndex === 1);
  const gfNode = bracket.nodes.find((n) => n.roundIndex === 2) ?? bracket.nodes[6];

  const isNodeDimmed = (node: TournamentBracketNode): boolean => {
    if (filterMode === 'all') return false;
    if (filterMode === 'my_path') {
      if (node.containsLocalPlayer) return false;
      if (node.id === 'gf' || (node.id === 'sf1' && (qfNodes[0].containsLocalPlayer || qfNodes[1].containsLocalPlayer))) {
        return false;
      }
      if (node.id === 'sf2' && (qfNodes[2].containsLocalPlayer || qfNodes[3].containsLocalPlayer)) {
        return false;
      }
      return true;
    }
    return node.status !== 'live' && node.status !== 'upcoming';
  };

  const sf1Highlight =
    qfNodes[0]?.containsLocalPlayer ||
    qfNodes[1]?.containsLocalPlayer ||
    qfNodes[0]?.status === 'completed' ||
    qfNodes[1]?.status === 'completed';
  const sf2Highlight =
    qfNodes[2]?.containsLocalPlayer ||
    qfNodes[3]?.containsLocalPlayer ||
    qfNodes[2]?.status === 'completed' ||
    qfNodes[3]?.status === 'completed';
  const gfHighlight =
    sfNodes[0]?.containsLocalPlayer ||
    sfNodes[1]?.containsLocalPlayer ||
    sfNodes[0]?.status === 'completed' ||
    sfNodes[1]?.status === 'completed';

  const mobileRoundNodes = bracket.nodes.filter((n) => n.roundIndex === mobileRound);

  return (
    <section
      aria-label="Interactive Tournament Bracket"
      className="w-full max-w-6xl bg-slate-900/92 border border-amber-400/30 rounded-xl p-4 sm:p-5 shadow-2xl shrink-0"
    >
      {/* Header & Interactive Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/10">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <GitBranch className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="font-semibold text-amber-300">Single-Elimination Cup Bracket</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">
              {bracket.entrantsCount}/8 Seeded Entrants
            </span>
          </div>
          <h2 className="font-display text-base sm:text-lg font-extrabold text-white mt-0.5 truncate">
            {bracket.cycleTitle} · Bracket &amp; Matchups
          </h2>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-white/10 self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'All Rounds' },
              { id: 'my_path', label: 'My Path' },
              { id: 'live_upcoming', label: 'Live & Upcoming' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                onUiClick?.();
                setFilterMode(tab.id);
              }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Round, Match Status & Upcoming Opponent Strip */}
      <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 pb-4 border-b border-white/10">
        <div className="px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-white/10">
          <div className="text-[11px] font-medium text-slate-400">Current Round &amp; Seed</div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-sm font-extrabold text-white truncate">
              {bracket.currentRoundLabel}
            </span>
            <span className="font-mono-num text-xs font-bold text-amber-300 whitespace-nowrap shrink-0">
              {bracket.playerSeed ? `Seed #${bracket.playerSeed}` : 'Unseeded'}
            </span>
          </div>
          <div className="text-[11px] font-mono-num text-slate-400 mt-0.5">
            {bracket.liveMatchesCount} live · {bracket.completedMatchesCount} finished FT3
          </div>
        </div>

        <div className="px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-white/10">
          <div className="text-[11px] font-medium text-slate-400">Your Match Status</div>
          <div className="mt-0.5 flex items-center gap-2 text-sm font-bold text-white">
            {isQueuedTournament ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" aria-hidden="true" />
            ) : bracket.isActive ? (
              <Swords className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            ) : (
              <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{bracket.playerMatchStatus}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
            {bracket.isActive
              ? 'First to 3 Round Wins · 3 Hearts per Round'
              : 'Next bi-weekly tournament window upcoming'}
          </div>
        </div>

        <div className="px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-white/10 flex items-center justify-between gap-3">
          {bracket.upcomingOpponent ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-slate-900 border border-amber-400/35 flex items-center justify-center shrink-0">
                  <PixelFighterPortrait id={bracket.upcomingOpponent.entrant.fighterId} size={28} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-400 truncate">
                    Upcoming Opponent · {bracket.upcomingOpponent.roundName}
                  </div>
                  <div className="text-xs font-extrabold text-white truncate">
                    #{bracket.upcomingOpponent.entrant.seed} {bracket.upcomingOpponent.entrant.displayName}
                  </div>
                  <div className="text-[11px] font-mono-num text-amber-300 truncate">
                    {bracket.upcomingOpponent.entrant.points} TP · {bracket.upcomingOpponent.statusLabel}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onUiClick?.();
                  if (bracket.upcomingOpponent) {
                    setSelectedNodeId(bracket.upcomingOpponent.matchNodeId);
                  }
                }}
                className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-white/10 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Inspect
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-400">Upcoming Opponent</div>
                <div className="text-xs font-bold text-slate-200 mt-0.5 truncate">
                  {bracket.isActive ? 'Waiting for Challenger' : 'Bracket Locked'}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {bracket.isActive
                    ? 'Join FT3 queue to pair immediately'
                    : 'Reopens next bi-weekly tournament'}
                </div>
              </div>
              <UserCheck className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Round Switcher */}
      <div className="mt-3.5 flex md:hidden items-center gap-1 p-1 bg-slate-950 rounded-lg border border-white/10">
        {(
          [
            { idx: 0 as const, label: 'Quarterfinals (4)' },
            { idx: 1 as const, label: 'Semifinals (2)' },
            { idx: 2 as const, label: 'Grand Final' },
          ]
        ).map((r) => (
          <button
            key={r.idx}
            type="button"
            onClick={() => {
              onUiClick?.();
              setMobileRound(r.idx);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              mobileRound === r.idx
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Mobile Single-Round Card Stack */}
      <div className="mt-3 flex md:hidden flex-col gap-2.5">
        {mobileRoundNodes.map((node) => (
          <BracketMatchCard
            key={node.id}
            node={node}
            selected={selectedNode?.id === node.id}
            dimmed={isNodeDimmed(node)}
            onSelect={() => {
              onUiClick?.();
              setSelectedNodeId(node.id);
            }}
          />
        ))}
      </div>

      {/* Desktop Connected 3-Round Single-Elimination Visual Bracket */}
      <div className="mt-4 hidden md:block overflow-x-auto">
        <div className="min-w-[780px]">
          <div className="grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)_32px_minmax(0,1fr)] gap-0 text-[11px] font-semibold text-slate-400 mb-2">
            <div className="px-1 flex items-center justify-between">
              <span>Quarterfinals</span>
              <span className="font-mono-num text-slate-500">Round 1</span>
            </div>
            <div aria-hidden="true" />
            <div className="px-1 flex items-center justify-between">
              <span>Semifinals</span>
              <span className="font-mono-num text-slate-500">Round 2</span>
            </div>
            <div aria-hidden="true" />
            <div className="px-1 flex items-center justify-between">
              <span>Championship</span>
              <span className="font-mono-num text-amber-300">Grand Final</span>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)_32px_minmax(0,1fr)] items-stretch">
            {/* Column 1: 4 Quarterfinal Matches */}
            <div className="grid grid-rows-4 gap-3">
              {qfNodes.map((node) => (
                <BracketMatchCard
                  key={node.id}
                  node={node}
                  selected={selectedNode?.id === node.id}
                  dimmed={isNodeDimmed(node)}
                  onSelect={() => {
                    onUiClick?.();
                    setSelectedNodeId(node.id);
                  }}
                />
              ))}
            </div>

            {/* Connector 1: QF (4) -> SF (2) */}
            <svg
              viewBox="0 0 32 400"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="w-full h-full"
            >
              <path
                d="M 0 50 H 16 V 100 H 32 M 0 150 H 16 V 100"
                fill="none"
                stroke={sf1Highlight ? '#F59E0B' : 'rgba(255,255,255,0.16)'}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M 0 250 H 16 V 300 H 32 M 0 350 H 16 V 300"
                fill="none"
                stroke={sf2Highlight ? '#F59E0B' : 'rgba(255,255,255,0.16)'}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Column 2: 2 Semifinal Matches */}
            <div className="grid grid-rows-2 gap-3 items-center">
              {sfNodes.map((node) => (
                <BracketMatchCard
                  key={node.id}
                  node={node}
                  selected={selectedNode?.id === node.id}
                  dimmed={isNodeDimmed(node)}
                  onSelect={() => {
                    onUiClick?.();
                    setSelectedNodeId(node.id);
                  }}
                />
              ))}
            </div>

            {/* Connector 2: SF (2) -> Grand Final (1) */}
            <svg
              viewBox="0 0 32 400"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="w-full h-full"
            >
              <path
                d="M 0 100 H 16 V 200 H 32 M 0 300 H 16 V 200"
                fill="none"
                stroke={gfHighlight ? '#F59E0B' : 'rgba(255,255,255,0.16)'}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Column 3: Grand Final & Cup Champion */}
            <div className="flex flex-col justify-center gap-3">
              <BracketMatchCard
                node={gfNode}
                selected={selectedNode?.id === gfNode.id}
                dimmed={isNodeDimmed(gfNode)}
                onSelect={() => {
                  onUiClick?.();
                  setSelectedNodeId(gfNode.id);
                }}
              />

              <div className="rounded-lg bg-slate-950/85 border border-amber-400/25 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                  <Crown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{bracket.isActive ? 'Cup Champion Target' : 'Cycle Champion'}</span>
                </div>
                {bracket.champion ? (
                  <div className="mt-2 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-amber-400/40 flex items-center justify-center shrink-0">
                      <PixelFighterPortrait id={bracket.champion.fighterId} size={24} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-white truncate">
                        {bracket.champion.displayName}
                      </div>
                      <div className="text-[11px] font-mono-num text-amber-300">
                        {bracket.champion.points} TP · {bracket.champion.wins}W-{bracket.champion.losses}L
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                    <Trophy className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                    <span>TBD · Win Grand Final FT3</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Match Inspector */}
      {selectedNode && (
        <div
          aria-label="Selected bracket match details"
          className="mt-4 pt-3.5 border-t border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <div className="shrink-0">
              <div className="text-[11px] font-semibold text-amber-300">
                {selectedNode.roundName} · {selectedNode.label} · {getStatusText(selectedNode)}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 font-mono-num">
                {selectedNode.mapId
                  ? `Stage: ${MAP_SPECS[selectedNode.mapId].name}`
                  : `Format: First to ${TARGET_SERIES_WINS} Round Wins`}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:pl-3 sm:border-l sm:border-white/10">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-white/10">
                {selectedNode.slots[0] ? (
                  <>
                    <PixelFighterPortrait id={selectedNode.slots[0].fighterId} size={22} />
                    <span className="text-xs font-bold text-white whitespace-nowrap">
                      #{selectedNode.slots[0].seed} {selectedNode.slots[0].displayName}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500">{selectedNode.sourceLabels[0]}</span>
                )}
              </div>

              <span className="font-mono-num text-xs font-extrabold text-amber-300 px-1">
                {selectedNode.scores
                  ? `${selectedNode.scores[0]} – ${selectedNode.scores[1]}`
                  : 'vs'}
              </span>

              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-white/10">
                {selectedNode.slots[1] ? (
                  <>
                    <PixelFighterPortrait id={selectedNode.slots[1].fighterId} size={22} />
                    <span className="text-xs font-bold text-white whitespace-nowrap">
                      #{selectedNode.slots[1].seed} {selectedNode.slots[1].displayName}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500">{selectedNode.sourceLabels[1]}</span>
                )}
              </div>
            </div>
          </div>

          {bracket.isActive && (
            <div className="flex items-center gap-2 shrink-0">
              {isQueuedTournament ? (
                <button
                  type="button"
                  onClick={() => {
                    onUiClick?.();
                    onLeaveQueue();
                  }}
                  className="h-9 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-white/15 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Leave FT3 Queue
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!connected}
                  onClick={() => {
                    onUiClick?.();
                    onJoinTournamentQueue();
                  }}
                  className="h-9 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Swords className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Play Bracket Match (FT3)</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
