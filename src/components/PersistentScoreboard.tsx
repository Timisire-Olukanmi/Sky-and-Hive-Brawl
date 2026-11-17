import { useState } from 'react';
import { Flame, RotateCcw, Trophy } from 'lucide-react';
import type { PlayMode } from '../game/types';
import type { PlayerRecord, ScoreboardStats } from '../hooks/usePersistentScoreboard';

interface PersistentScoreboardProps {
  scoreboard: ScoreboardStats;
  activeMode: PlayMode;
  onReset: () => void;
  onUiClick?: () => void;
}

function formatWinRate(record: PlayerRecord): string {
  const total = record.wins + record.losses;
  if (total === 0) return '—';
  return `${Math.round((record.wins / total) * 100)}%`;
}

export function PersistentScoreboard({
  scoreboard,
  activeMode,
  onReset,
  onUiClick,
}: PersistentScoreboardProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);

  const totalMatches = scoreboard.p1.wins + scoreboard.p1.losses;

  const entries: Array<{
    key: 'p1' | 'p2' | 'cpu';
    label: string;
    role: string;
    record: PlayerRecord;
    accentClass: string;
    isActiveParticipant: boolean;
  }> = [
    {
      key: 'p1',
      label: 'Player 1',
      role: 'Human',
      record: scoreboard.p1,
      accentClass: 'text-amber-400',
      isActiveParticipant: true,
    },
    {
      key: 'p2',
      label: 'Player 2',
      role: '2P Local',
      record: scoreboard.p2,
      accentClass: 'text-sky-400',
      isActiveParticipant: activeMode === '2P_LOCAL',
    },
    {
      key: 'cpu',
      label: 'CPU',
      role: 'AI Opponent',
      record: scoreboard.cpu,
      accentClass: 'text-emerald-400',
      isActiveParticipant: activeMode === '1P_AI',
    },
  ];

  return (
    <section
      aria-label="Persistent Match Scoreboard"
      className="pb-3.5 mb-3.5 border-b border-white/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <h2 className="font-display text-sm font-bold text-white tracking-tight">
            Lifetime Scoreboard
          </h2>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-slate-400 font-mono-num">
            {totalMatches === 0
              ? 'No matches recorded yet'
              : `${totalMatches} ${totalMatches === 1 ? 'match' : 'matches'} played`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {confirmingReset ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onUiClick?.();
                  onReset();
                  setConfirmingReset(false);
                }}
                className="px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  onUiClick?.();
                  setConfirmingReset(false);
                }}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={totalMatches === 0}
              onClick={() => {
                onUiClick?.();
                setConfirmingReset(true);
              }}
              className="px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white text-xs font-medium border border-white/10 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Reset Scores</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
        {entries.map((entry, idx) => {
          const played = entry.record.wins + entry.record.losses;
          const winRate = formatWinRate(entry.record);
          return (
            <div
              key={entry.key}
              className={`flex items-center justify-between gap-3 py-1.5 sm:py-0.5 ${
                idx === 0 ? 'sm:pr-4' : idx === 1 ? 'sm:px-4' : 'sm:pl-4'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`font-display text-sm font-bold truncate ${
                      entry.isActiveParticipant ? entry.accentClass : 'text-slate-200'
                    }`}
                  >
                    {entry.label}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate">
                    {entry.role}
                  </span>
                  {entry.record.currentStreak > 3 && (
                    <span
                      title={`${entry.label} is on a ${entry.record.currentStreak}-win streak`}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono-num text-[10px] font-bold leading-none whitespace-nowrap shrink-0"
                    >
                      <Flame className="w-3 h-3 text-amber-400" aria-hidden="true" />
                      <span>{entry.record.currentStreak}W Streak</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono-num">
                  {played === 0 ? 'Awaiting first match' : `${played} played · Win ${winRate}`}
                </div>
              </div>

              <div className="flex items-baseline gap-3 font-mono-num shrink-0">
                <div className="text-right">
                  <div className="text-[10px] font-medium text-slate-400">Wins</div>
                  <div className="text-base font-extrabold text-emerald-400 leading-tight">
                    {entry.record.wins}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-medium text-slate-400">Losses</div>
                  <div className="text-base font-extrabold text-rose-400 leading-tight">
                    {entry.record.losses}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-medium text-slate-400">Streak</div>
                  <div
                    className={`text-base font-extrabold leading-tight ${
                      entry.record.currentStreak > 3
                        ? 'text-amber-300'
                        : entry.record.currentStreak > 0
                        ? 'text-slate-100'
                        : 'text-slate-500'
                    }`}
                  >
                    {entry.record.currentStreak}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
