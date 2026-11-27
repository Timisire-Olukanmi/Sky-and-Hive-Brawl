import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Coffee,
  Home,
  Loader2,
  Shuffle,
  Swords,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { FIGHTER_SPECS, MAP_SPECS } from '../game/constants';
import {
  ONLINE_ROUND_STOCKS,
  TARGET_SERIES_WINS,
  type OnlineQueueType,
  type WaitingAreaSnapshot,
} from '../game/onlineTypes';
import type { FighterId } from '../game/types';
import {
  ALL_FIGHTER_IDS,
  ALL_MAP_IDS,
  type MapSelection,
  type OnlineStats,
} from '../types/account';
import { PixelFighterPortrait } from './PixelFighterPortrait';

interface OnlineCasualScreenProps {
  connected: boolean;
  clientId: string | null;
  playerName: string;
  selectedFighter: FighterId;
  selectedMap: MapSelection;
  onlineStats: OnlineStats;
  waitingSnapshot: WaitingAreaSnapshot;
  inQueue: OnlineQueueType | null;
  queuePosition: number;
  queueEnteredAt: number | null;
  errorMessage: string | null;
  onSelectFighter: (id: FighterId) => void;
  onSelectMap: (map: MapSelection) => void;
  onJoinCasualQueue: () => void;
  onLeaveQueue: () => void;
  onSwitchToRanked: () => void;
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

export function OnlineCasualScreen({
  connected,
  clientId,
  playerName,
  selectedFighter,
  selectedMap,
  onlineStats,
  waitingSnapshot,
  inQueue,
  queuePosition,
  queueEnteredAt,
  errorMessage,
  onSelectFighter,
  onSelectMap,
  onJoinCasualQueue,
  onLeaveQueue,
  onSwitchToRanked,
  onBackHome,
  onUiClick,
}: OnlineCasualScreenProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isQueuedCasual = inQueue === 'casual';

  useEffect(() => {
    if (!isQueuedCasual) return;
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, [isQueuedCasual]);

  const fighterSpec = FIGHTER_SPECS[selectedFighter];
  const casualPlayers = waitingSnapshot.casualWaiting;
  const queuedCount = casualPlayers.filter((p) => p.status === 'queued').length;
  const mapLabel = selectedMap === 'random' ? 'Random Stage' : MAP_SPECS[selectedMap].name;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between gap-3 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-b from-slate-950/92 via-sky-950/82 to-slate-950/95 backdrop-blur-[2px]">
      {/* Casual Lounge Top Header */}
      <header className="w-full max-w-6xl flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              onUiClick?.();
              onBackHome();
            }}
            className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/15 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Home</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
              <h1 className="font-display text-lg sm:text-xl font-extrabold text-white truncate">
                Casual Waiting Lounge
              </h1>
            </div>
            <p className="text-xs text-sky-200/80 truncate">
              Online Casuals Only · First to {TARGET_SERIES_WINS} Round Wins · {ONLINE_ROUND_STOCKS} Hearts/Round · Unranked
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-mono-num text-slate-300 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/10">
            {connected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>Server Online</span>
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
              onSwitchToRanked();
            }}
            className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/30 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Switch to Ranked Arena</span>
          </button>
        </div>
      </header>

      {/* Main Two-Column Casual Lounge Workspace */}
      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1 min-h-0">
        {/* Left: Casual Loadout (Fighter + Stage Preference) */}
        <section
          aria-label="Casual Fighter and Stage Selection"
          className="lg:col-span-7 bg-slate-900/92 border border-sky-400/25 rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between gap-4"
        >
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-11 h-11 rounded-lg bg-slate-950 border flex items-center justify-center shrink-0"
                  style={{ borderColor: fighterSpec.accentColor }}
                >
                  <PixelFighterPortrait id={selectedFighter} size={34} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-sky-300">
                    {playerName} · Casual Fighter
                  </div>
                  <div className="font-display text-base font-extrabold text-white truncate">
                    {fighterSpec.name} — {fighterSpec.title}
                  </div>
                </div>
              </div>
              <div className="text-right font-mono-num text-xs text-slate-300 shrink-0">
                <div className="text-slate-400 text-[11px]">Casual Record</div>
                <div>
                  <span className="text-emerald-400 font-bold">{onlineStats.casualWins}W</span>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-rose-400 font-bold">{onlineStats.casualLosses}L</span>
                </div>
              </div>
            </div>

            {/* Fighter Grid */}
            <div className="mt-3">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Choose Fighter {isQueuedCasual ? '(Leave queue to swap)' : ''}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {ALL_FIGHTER_IDS.map((id) => {
                  const spec = FIGHTER_SPECS[id];
                  const active = selectedFighter === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={isQueuedCasual}
                      onClick={() => {
                        onUiClick?.();
                        onSelectFighter(id);
                      }}
                      className={`text-left px-2 py-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        active
                          ? 'bg-sky-500/20 border-sky-400 text-white'
                          : 'bg-slate-950/75 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <PixelFighterPortrait id={id} size={22} />
                        <span className="font-display font-bold text-[11px] truncate">
                          {spec.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage Preference */}
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-300">
                  Preferred Casual Stage
                </span>
                <span className="text-[11px] text-sky-300 font-medium">{mapLabel}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <button
                  type="button"
                  disabled={isQueuedCasual}
                  onClick={() => {
                    onUiClick?.();
                    onSelectMap('random');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-left transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                    selectedMap === 'random'
                      ? 'bg-sky-400 text-slate-950 border-sky-300 font-bold'
                      : 'bg-slate-950/75 text-slate-300 border-white/10 hover:border-white/25'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="text-[11px] truncate">Random (All 10)</span>
                </button>
                {ALL_MAP_IDS.map((mId) => {
                  const m = MAP_SPECS[mId];
                  const active = selectedMap === mId;
                  return (
                    <button
                      key={mId}
                      type="button"
                      disabled={isQueuedCasual}
                      onClick={() => {
                        onUiClick?.();
                        onSelectMap(mId);
                      }}
                      className={`px-2.5 py-1.5 rounded-md border text-left transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        active
                          ? 'bg-white text-slate-950 border-white font-bold'
                          : 'bg-slate-950/75 text-slate-300 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="text-[11px] truncate">{m.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Match Rules Footer */}
          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Format: First to 3 Round Wins (Best of 5) · 3 Hearts per Round</span>
            <span className="text-sky-300 font-medium">Casual Pool · No RP Risk</span>
          </div>
        </section>

        {/* Right: Dedicated Casual Waiting Area + Queue Controls */}
        <section
          aria-label="Casual Waiting Room Roster"
          className="lg:col-span-5 bg-slate-900/92 border border-sky-400/25 rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between gap-4"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                <h2 className="font-display text-sm font-bold text-white truncate">
                  Casual Waiting Area
                </h2>
              </div>
              <div className="font-mono-num text-[11px] text-slate-300 whitespace-nowrap">
                {casualPlayers.length} in lounge · {queuedCount} queued ·{' '}
                {waitingSnapshot.casualInMatchCount} fighting
              </div>
            </div>

            <div className="mt-3 flex-1 min-h-[180px] max-h-[300px] overflow-y-auto divide-y divide-white/10">
              {casualPlayers.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Entering Casual Waiting Lounge...
                </div>
              ) : (
                casualPlayers.map((entry) => {
                  const isSelf = entry.clientId === clientId;
                  const prefLabel =
                    entry.preferredMap === 'random'
                      ? 'Random Stage'
                      : MAP_SPECS[entry.preferredMap].name;
                  const statusText =
                    entry.status === 'queued'
                      ? 'Searching Casual FT3'
                      : entry.status === 'in_match'
                      ? 'In Casual Match'
                      : 'In Lounge';
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
                              <span className="text-sky-400 font-semibold ml-1.5">(You)</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {FIGHTER_SPECS[entry.fighterId].name} · {prefLabel}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                          entry.status === 'queued'
                            ? 'text-sky-300'
                            : entry.status === 'in_match'
                            ? 'text-amber-300'
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

            {isQueuedCasual ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs px-1">
                  <div className="flex items-center gap-2 text-sky-300 font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Searching Casual FT3 opponent...</span>
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
                  Leave Casual Queue
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!connected}
                onClick={() => {
                  onUiClick?.();
                  onJoinCasualQueue();
                }}
                className="w-full h-11 px-4 rounded-lg bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Swords className="w-4 h-4" aria-hidden="true" />
                <span>Find Casual Opponent (First to 3)</span>
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
