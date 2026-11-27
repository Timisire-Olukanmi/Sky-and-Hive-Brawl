import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Coffee,
  Crown,
  Flame,
  Home,
  Loader2,
  Shield,
  Swords,
  Trophy,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { FIGHTER_SPECS } from '../game/constants';
import {
  ONLINE_ROUND_STOCKS,
  TARGET_SERIES_WINS,
  type OnlineQueueType,
  type WaitingAreaSnapshot,
} from '../game/onlineTypes';
import type { FighterId } from '../game/types';
import {
  ALL_FIGHTER_IDS,
  getRankTier,
  type OnlineStats,
} from '../types/account';
import { PixelFighterPortrait } from './PixelFighterPortrait';

interface OnlineRankedScreenProps {
  connected: boolean;
  clientId: string | null;
  playerName: string;
  selectedFighter: FighterId;
  onlineStats: OnlineStats;
  waitingSnapshot: WaitingAreaSnapshot;
  inQueue: OnlineQueueType | null;
  queuePosition: number;
  queueEnteredAt: number | null;
  errorMessage: string | null;
  onSelectFighter: (id: FighterId) => void;
  onJoinRankedQueue: () => void;
  onLeaveQueue: () => void;
  onSwitchToCasual: () => void;
  onBackHome: () => void;
  onUiClick?: () => void;
}

function formatWaitSeconds(enteredAt: number | null, nowMs: number): string {
  if (!enteredAt) return '00:00';
  const elapsed = Math.max(0, Math.floor((nowMs - enteredAt) / 1000));
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function OnlineRankedScreen({
  connected,
  clientId,
  playerName,
  selectedFighter,
  onlineStats,
  waitingSnapshot,
  inQueue,
  queuePosition,
  queueEnteredAt,
  errorMessage,
  onSelectFighter,
  onJoinRankedQueue,
  onLeaveQueue,
  onSwitchToCasual,
  onBackHome,
  onUiClick,
}: OnlineRankedScreenProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isQueuedRanked = inQueue === 'ranked';

  useEffect(() => {
    if (!isQueuedRanked) return;
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, [isQueuedRanked]);

  const fighterSpec = FIGHTER_SPECS[selectedFighter];
  const tier = getRankTier(onlineStats.rankedPoints);
  const rankedPlayers = waitingSnapshot.rankedWaiting;
  const queuedCount = rankedPlayers.filter((p) => p.status === 'queued').length;
  const totalRanked = onlineStats.rankedWins + onlineStats.rankedLosses;
  const winRatePct =
    totalRanked > 0 ? Math.round((onlineStats.rankedWins / totalRanked) * 100) : 0;

  const tierProgressPct =
    tier.nextRp === null
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((onlineStats.rankedPoints - tier.minRp) / Math.max(1, tier.nextRp - tier.minRp)) *
                100
            )
          )
        );

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between gap-3 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-b from-slate-950/94 via-stone-950/88 to-rose-950/82 backdrop-blur-[2px]">
      {/* Ranked Arena Top Header */}
      <header className="w-full max-w-6xl flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              onUiClick?.();
              onBackHome();
            }}
            className="h-10 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/15 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Home</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <h1 className="font-display text-base sm:text-xl font-extrabold text-white truncate">
                Ranked Waiting Arena
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-200/80 truncate">
              Global Cloud Server · First to {TARGET_SERIES_WINS} Round Wins · {ONLINE_ROUND_STOCKS} Hearts/Round · RP Stakes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-mono-num text-slate-300 px-2.5 py-2 rounded-lg bg-slate-900/90 border border-white/10">
            {connected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>Cloud Server Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>Connecting...</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onUiClick?.();
              onSwitchToCasual();
            }}
            className="h-10 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 border border-sky-400/30 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Coffee className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Switch to Casual Lounge</span>
            <span className="sm:hidden">Casual</span>
          </button>
        </div>
      </header>

      {/* Main Two-Column Ranked Arena Workspace */}
      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1 min-h-0">
        {/* Left: Rank Standing + Competitive Fighter Lock-In */}
        <section
          aria-label="Ranked Standing and Fighter Lock-In"
          className="lg:col-span-7 bg-slate-900/92 border border-amber-400/30 rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between gap-4"
        >
          <div>
            {/* Rank Tier Crest & RP Bar */}
            <div className="pb-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-14 h-14 rounded-xl bg-slate-950 border-2 flex flex-col items-center justify-center shrink-0"
                  style={{ borderColor: tier.color }}
                >
                  <Trophy className="w-5 h-5" style={{ color: tier.color }} aria-hidden="true" />
                  <span
                    className="font-mono-num text-[10px] font-extrabold mt-0.5"
                    style={{ color: tier.color }}
                  >
                    {tier.name.toUpperCase()}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-400 truncate">
                    {playerName} · Competitive Rating
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-mono-num text-2xl font-extrabold text-white">
                      {onlineStats.rankedPoints} RP
                    </span>
                    <span
                      className="text-xs font-bold"
                      style={{ color: tier.color }}
                    >
                      {tier.name} Tier
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full max-w-xs bg-slate-950 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full transition-[width] duration-150"
                      style={{
                        width: `${tierProgressPct}%`,
                        backgroundColor: tier.color,
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] font-mono-num text-slate-400">
                    {tier.nextRp !== null
                      ? `${tier.nextRp - onlineStats.rankedPoints} RP to next tier`
                      : 'Top Apex Division'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-left sm:text-right font-mono-num shrink-0">
                <div>
                  <div className="text-[11px] text-slate-400">Ranked W/L</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    <span className="text-emerald-400">{onlineStats.rankedWins}</span>
                    <span className="text-slate-500 mx-1">/</span>
                    <span className="text-rose-400">{onlineStats.rankedLosses}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Win Rate</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">{winRatePct}%</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Streak</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5 flex items-center sm:justify-end gap-1">
                    {onlineStats.rankedStreak > 0 && (
                      <Flame className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                    )}
                    <span>{onlineStats.rankedStreak}W</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fighter Lock-In */}
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <PixelFighterPortrait id={selectedFighter} size={28} />
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    Locked Fighter: <strong className="text-white">{fighterSpec.name}</strong>
                  </span>
                </div>
                <span className="text-[11px] text-amber-300/90 font-medium">
                  {isQueuedRanked ? 'Locked in Queue' : 'Select Challenger'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {ALL_FIGHTER_IDS.map((id) => {
                  const spec = FIGHTER_SPECS[id];
                  const active = selectedFighter === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={isQueuedRanked}
                      onClick={() => {
                        onUiClick?.();
                        onSelectFighter(id);
                      }}
                      className={`text-left px-2 py-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        active
                          ? 'bg-amber-500/20 border-amber-400 text-white'
                          : 'bg-slate-950/75 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <PixelFighterPortrait id={id} size={22} />
                        <span className="font-display font-bold text-[11px] truncate">
                          {spec.name}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[9px] font-mono-num text-slate-400">
                        <span>HP {spec.cardStats.heart}</span>
                        <span>ATK {spec.cardStats.attack}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>Stages rotate randomly from all 10 official arenas for Ranked fairness</span>
            </span>
            <span className="text-amber-300 font-semibold">FT3 Series · RP Adjusted</span>
          </div>
        </section>

        {/* Right: Dedicated Ranked Waiting Arena + Queue Controls */}
        <section
          aria-label="Ranked Waiting Arena Challengers"
          className="lg:col-span-5 bg-slate-900/92 border border-amber-400/30 rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between gap-4"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <Swords className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                <h2 className="font-display text-sm font-bold text-white truncate">
                  Ranked Waiting Arena
                </h2>
              </div>
              <div className="font-mono-num text-[11px] text-slate-300 whitespace-nowrap">
                {rankedPlayers.length} in arena · {queuedCount} queued ·{' '}
                {waitingSnapshot.rankedInMatchCount} fighting
              </div>
            </div>

            <div className="mt-3 flex-1 min-h-[180px] max-h-[300px] overflow-y-auto divide-y divide-white/10">
              {rankedPlayers.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Entering Ranked Waiting Arena...
                </div>
              ) : (
                rankedPlayers.map((entry) => {
                  const isSelf = entry.clientId === clientId;
                  const entryTier = getRankTier(entry.rankedPoints);
                  const statusText =
                    entry.status === 'queued'
                      ? 'Searching Ranked FT3'
                      : entry.status === 'in_match'
                      ? 'In Ranked Match'
                      : 'Standing By';
                  return (
                    <div
                      key={entry.clientId}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-slate-950 border border-white/10 flex items-center justify-center shrink-0">
                          <PixelFighterPortrait id={entry.fighterId} size={28} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {entry.displayName}
                            {isSelf && (
                              <span className="text-amber-400 font-semibold ml-1.5">(You)</span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono-num text-slate-400 truncate">
                            <span style={{ color: entryTier.color }}>{entryTier.name}</span>
                            <span className="mx-1 text-slate-600">·</span>
                            <span>{entry.rankedPoints} RP</span>
                            <span className="mx-1 text-slate-600">·</span>
                            <span>{FIGHTER_SPECS[entry.fighterId].name}</span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                          entry.status === 'queued'
                            ? 'text-amber-300'
                            : entry.status === 'in_match'
                            ? 'text-rose-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {statusText}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
            {errorMessage && (
              <div
                role="alert"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-950/70 border border-rose-500/40 text-xs text-rose-100"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            {isQueuedRanked ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs px-1">
                  <div className="flex items-center gap-2 text-amber-300 font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Matching closest Ranked RP (FT3)...</span>
                  </div>
                  <div className="font-mono-num text-slate-200 font-bold">
                    #{Math.max(1, queuePosition)} · {formatWaitSeconds(queueEnteredAt, nowMs)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUiClick?.();
                    onLeaveQueue();
                  }}
                  className="w-full h-11 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-white/15 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cancel Ranked Search
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!connected}
                onClick={() => {
                  onUiClick?.();
                  onJoinRankedQueue();
                }}
                className="w-full h-11 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Crown className="w-4 h-4" aria-hidden="true" />
                <span>Enter Ranked Queue (First to 3)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onUiClick?.();
                onBackHome();
              }}
              className="w-full h-9 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Return to Token Wars Home</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
