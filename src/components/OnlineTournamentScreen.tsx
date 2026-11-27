import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  Crown,
  Flame,
  Home,
  Loader2,
  Lock,
  Medal,
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
  type TournamentStateSnapshot,
  type WaitingAreaSnapshot,
} from '../game/onlineTypes';
import {
  formatTournamentCountdown,
  formatTournamentDateRange,
  getTournamentScheduleStatus,
  TOURNAMENT_ACTIVE_DAYS,
  TOURNAMENT_CYCLE_DAYS,
} from '../game/tournamentSchedule';
import type { FighterId } from '../game/types';
import { ALL_FIGHTER_IDS, type TournamentStats } from '../types/account';
import { PixelFighterPortrait } from './PixelFighterPortrait';
import { TournamentBracket } from './TournamentBracket';

interface OnlineTournamentScreenProps {
  connected: boolean;
  clientId: string | null;
  playerName: string;
  selectedFighter: FighterId;
  tournamentStats: TournamentStats;
  waitingSnapshot: WaitingAreaSnapshot;
  tournamentSnapshot: TournamentStateSnapshot;
  inQueue: OnlineQueueType | null;
  queuePosition: number;
  queueEnteredAt: number | null;
  errorMessage: string | null;
  onSelectFighter: (id: FighterId) => void;
  onJoinTournamentQueue: () => void;
  onLeaveQueue: () => void;
  onSwitchToCasual: () => void;
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

export function OnlineTournamentScreen({
  connected,
  clientId,
  playerName,
  selectedFighter,
  tournamentStats,
  waitingSnapshot,
  tournamentSnapshot,
  inQueue,
  queuePosition,
  queueEnteredAt,
  errorMessage,
  onSelectFighter,
  onJoinTournamentQueue,
  onLeaveQueue,
  onSwitchToCasual,
  onSwitchToRanked,
  onBackHome,
  onUiClick,
}: OnlineTournamentScreenProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [rightTab, setRightTab] = useState<'waiting' | 'standings'>('waiting');
  const isQueuedTournament = inQueue === 'tournament';

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const liveSchedule = getTournamentScheduleStatus(nowMs);
  const fighterSpec = FIGHTER_SPECS[selectedFighter];
  const entrants = waitingSnapshot.tournamentWaiting;
  const queuedCount = entrants.filter((p) => p.status === 'queued').length;

  const isCurrentCycle = tournamentStats.cycleId === liveSchedule.cycleId && liveSchedule.isActive;
  const currentPoints = isCurrentCycle ? tournamentStats.points : 0;
  const currentWins = isCurrentCycle ? tournamentStats.wins : 0;
  const currentLosses = isCurrentCycle ? tournamentStats.losses : 0;
  const currentStreak = isCurrentCycle ? tournamentStats.streak : 0;

  const standingsList = liveSchedule.isActive
    ? tournamentSnapshot.standings
    : tournamentSnapshot.lastStandings;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-start gap-4 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-b from-slate-950/95 via-amber-950/30 to-slate-950/96 backdrop-blur-[2px]">
      {/* Tournament Top Header */}
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
                Bi-Weekly Tournament Arena
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-200/80 truncate">
              Global Cloud Server · Open {TOURNAMENT_ACTIVE_DAYS} Days Every {TOURNAMENT_CYCLE_DAYS / 7} Weeks · First to{' '}
              {TARGET_SERIES_WINS}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            className="h-10 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 border border-sky-400/30 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Casual Lounge
          </button>

          <button
            type="button"
            onClick={() => {
              onUiClick?.();
              onSwitchToRanked();
            }}
            className="h-10 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/30 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ranked Arena
          </button>
        </div>
      </header>

      {/* Bi-Weekly 7-Day Tournament Schedule Strip */}
      <section
        aria-label="Bi-Weekly Tournament Schedule"
        className={`w-full max-w-6xl rounded-xl border p-4 shadow-xl shrink-0 ${
          liveSchedule.isActive
            ? 'bg-slate-900/94 border-amber-400/45'
            : 'bg-slate-900/92 border-white/15'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className={liveSchedule.isActive ? 'text-emerald-400' : 'text-amber-300'}>
                {liveSchedule.isActive ? 'LIVE TOURNAMENT WEEK' : 'INTERMISSION WEEK · TOURNAMENT CLOSED'}
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-300">
                1 Week Active Every 2 Weeks
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="font-mono-num text-slate-400">
                Season #{liveSchedule.cycleNumber}
              </span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-white mt-0.5 truncate">
              {liveSchedule.isActive ? liveSchedule.title : `Next: ${liveSchedule.title}`}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono-num">
              {liveSchedule.isActive
                ? `Active Window: ${formatTournamentDateRange(
                    liveSchedule.activeWindowStartMs,
                    liveSchedule.activeWindowEndMs
                  )}`
                : `Next 7-Day Window: ${formatTournamentDateRange(
                    liveSchedule.nextTournamentStartMs,
                    liveSchedule.nextTournamentEndMs
                  )}`}
            </p>
          </div>

          <div className="lg:w-72 shrink-0">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>{liveSchedule.isActive ? 'Tournament Ends In' : 'Opens In'}</span>
              </span>
              <span className="font-mono-num font-extrabold text-amber-300">
                {formatTournamentCountdown(liveSchedule.msUntilTransition)}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full transition-[width] duration-300"
                style={{
                  width: `${liveSchedule.progressPct}%`,
                  backgroundColor: liveSchedule.isActive ? '#F59E0B' : '#38BDF8',
                }}
              />
            </div>
          </div>
        </div>

        {/* Upcoming 4 Bi-Weekly Cycles */}
        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {liveSchedule.upcomingWindows.map((win) => (
            <div
              key={win.cycleId}
              className={`px-3 py-2 rounded-lg border text-left ${
                win.status === 'live'
                  ? 'bg-amber-500/15 border-amber-400/50'
                  : 'bg-slate-950/75 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono-num">
                <span className={win.status === 'live' ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                  #{win.cycleNumber} · {win.status === 'live' ? 'Live Now' : 'Upcoming'}
                </span>
                <Calendar className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
              </div>
              <div className="text-xs font-bold text-white truncate mt-0.5">{win.title}</div>
              <div className="text-[11px] font-mono-num text-slate-400 mt-0.5 truncate">
                {formatTournamentDateRange(win.startMs, win.endMs)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Visual Cup Bracket */}
      <TournamentBracket
        connected={connected}
        clientId={clientId}
        playerName={playerName}
        selectedFighter={selectedFighter}
        currentPoints={currentPoints}
        currentWins={currentWins}
        currentLosses={currentLosses}
        currentStreak={currentStreak}
        waitingSnapshot={waitingSnapshot}
        tournamentSnapshot={tournamentSnapshot}
        inQueue={inQueue}
        onJoinTournamentQueue={onJoinTournamentQueue}
        onLeaveQueue={onLeaveQueue}
        onUiClick={onUiClick}
      />

      {/* Main Two-Column Tournament Workspace */}
      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch shrink-0">
        {/* Left: Player Tournament Standing & Fighter Lock-In */}
        <section
          aria-label="Tournament Standing and Fighter Selection"
          className="lg:col-span-7 bg-slate-900/92 border border-amber-400/25 rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between gap-4"
        >
          <div>
            <div className="pb-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-14 h-14 rounded-xl bg-slate-950 border-2 border-amber-400 flex flex-col items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-amber-400" aria-hidden="true" />
                  <span className="font-mono-num text-[10px] font-extrabold text-amber-300 mt-0.5">
                    CUP
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-400 truncate">
                    {playerName} · Tournament Standing
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-mono-num text-2xl font-extrabold text-white">
                      {currentPoints} TP
                    </span>
                    <span className="text-xs font-medium text-slate-400 font-mono-num">
                      Best {tournamentStats.bestPoints} TP · {tournamentStats.trophies} Crowns
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-left sm:text-right font-mono-num shrink-0">
                <div>
                  <div className="text-[11px] text-slate-400">Cup W/L</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    <span className="text-emerald-400">{currentWins}</span>
                    <span className="text-slate-500 mx-1">/</span>
                    <span className="text-rose-400">{currentLosses}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Career W/L</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">
                    {tournamentStats.careerWins}/{tournamentStats.careerLosses}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Streak</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5 flex items-center sm:justify-end gap-1">
                    {currentStreak > 0 && (
                      <Flame className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                    )}
                    <span>{currentStreak}W</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fighter Selection */}
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <PixelFighterPortrait id={selectedFighter} size={28} />
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    Tournament Fighter: <strong className="text-white">{fighterSpec.name}</strong>
                  </span>
                </div>
                <span className="text-[11px] text-amber-300/90 font-medium">
                  {isQueuedTournament ? 'Locked in Queue' : 'Select Entrant'}
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
                      disabled={isQueuedTournament}
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
              <span>Win FT3: +100 to +120 TP · Completed Loss: +25 TP · Random Official Stage</span>
            </span>
            <span className="text-amber-300 font-semibold">7-Day Bi-Weekly Cup</span>
          </div>
        </section>

        {/* Right: Isolated Tournament Waiting Room & Standings + Queue Action */}
        <section
          aria-label="Tournament Entrants and Standings"
          className="lg:col-span-5 bg-slate-900/92 border border-amber-400/25 rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between gap-4"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    onUiClick?.();
                    setRightTab('waiting');
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    rightTab === 'waiting'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Waiting Area ({entrants.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUiClick?.();
                    setRightTab('standings');
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    rightTab === 'standings'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Leaderboard ({standingsList.length})
                </button>
              </div>

              <div className="font-mono-num text-[11px] text-slate-300 whitespace-nowrap">
                {queuedCount} queued · {waitingSnapshot.tournamentInMatchCount} fighting
              </div>
            </div>

            {rightTab === 'waiting' ? (
              <div className="mt-3 flex-1 min-h-[180px] max-h-[260px] overflow-y-auto divide-y divide-white/10">
                {entrants.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    Entering Tournament Waiting Room...
                  </div>
                ) : (
                  entrants.map((entry) => {
                    const isSelf = entry.clientId === clientId;
                    const statusText =
                      entry.status === 'queued'
                        ? 'Searching Tournament FT3'
                        : entry.status === 'in_match'
                        ? 'In Tournament Match'
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
                              <span>{entry.tournamentPoints} TP</span>
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
            ) : (
              <div className="mt-3 flex-1 min-h-[180px] max-h-[260px] overflow-y-auto divide-y divide-white/10">
                {standingsList.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    {liveSchedule.isActive
                      ? 'No Tournament FT3 matches finished yet this week. Play a match to claim #1!'
                      : 'No standings recorded from the previous tournament cycle.'}
                  </div>
                ) : (
                  standingsList.map((row, idx) => (
                    <div
                      key={row.playerKey}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 text-center font-mono-num text-xs font-extrabold text-amber-300 shrink-0">
                          {idx === 0 ? (
                            <Medal className="w-4 h-4 text-amber-400 mx-auto" aria-hidden="true" />
                          ) : (
                            `#${idx + 1}`
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-slate-950 border border-white/10 flex items-center justify-center shrink-0">
                          <PixelFighterPortrait id={row.fighterId} size={24} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {row.displayName}
                          </div>
                          <div className="text-[11px] font-mono-num text-slate-400 truncate">
                            {row.wins}W-{row.losses}L · {FIGHTER_SPECS[row.fighterId].name}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono-num text-xs font-extrabold text-amber-300 whitespace-nowrap shrink-0">
                        {row.points} TP
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
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

            {!liveSchedule.isActive ? (
              <button
                type="button"
                disabled
                className="w-full h-11 px-4 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs sm:text-sm border border-white/10 flex items-center justify-center gap-2 opacity-80 cursor-not-allowed whitespace-nowrap"
              >
                <Lock className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                <span>
                  Tournament Closed · Opens in {formatTournamentCountdown(liveSchedule.msUntilTransition, false)}
                </span>
              </button>
            ) : isQueuedTournament ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs px-1">
                  <div className="flex items-center gap-2 text-amber-300 font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Searching Tournament FT3 opponent...</span>
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
                  Leave Tournament Queue
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!connected}
                onClick={() => {
                  onUiClick?.();
                  onJoinTournamentQueue();
                }}
                className="w-full h-11 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Swords className="w-4 h-4" aria-hidden="true" />
                <span>Enter Tournament Queue (First to 3)</span>
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
