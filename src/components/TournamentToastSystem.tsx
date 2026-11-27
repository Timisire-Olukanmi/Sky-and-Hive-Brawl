import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, Trophy, X } from 'lucide-react';
import {
  formatTournamentCountdown,
  formatTournamentDateRange,
  getTournamentAlertKind,
  type TournamentAlertKind,
  type TournamentScheduleStatus,
} from '../game/tournamentSchedule';

const DISMISSED_STORAGE_KEY = 'token_wars_dismissed_tournament_toasts_v1';

export interface TournamentToastPayload {
  alertKey: string;
  kind: TournamentAlertKind;
  cycleId: string;
  cycleNumber: number;
  title: string;
  dateRangeLabel: string;
  countdownLabel: string;
  statusLabel: string;
  headline: string;
  detailLine: string;
  ctaLabel: string;
}

export function buildTournamentToastPayload(
  schedule: TournamentScheduleStatus,
  waitingCount: number
): TournamentToastPayload | null {
  const kind = getTournamentAlertKind(schedule);
  if (!kind) return null;

  const countdown = formatTournamentCountdown(schedule.msUntilTransition, true);
  const windowStart =
    kind === 'live' ? schedule.activeWindowStartMs : schedule.nextTournamentStartMs;
  const windowEnd =
    kind === 'live' ? schedule.activeWindowEndMs : schedule.nextTournamentEndMs;
  const dateRangeLabel = formatTournamentDateRange(windowStart, windowEnd);
  const safeWaiting = Math.max(0, Math.floor(waitingCount));

  if (kind === 'live') {
    return {
      alertKey: `${schedule.cycleId}:live`,
      kind,
      cycleId: schedule.cycleId,
      cycleNumber: schedule.cycleNumber,
      title: schedule.title,
      dateRangeLabel,
      countdownLabel: `Ends in ${countdown}`,
      statusLabel: 'Live Now',
      headline: `${schedule.title} Is Live`,
      detailLine: `${safeWaiting} ${safeWaiting === 1 ? 'fighter' : 'fighters'} in lounge · First-to-3`,
      ctaLabel: 'Enter Tournament',
    };
  }

  return {
    alertKey: `${schedule.cycleId}:starting_soon`,
    kind,
    cycleId: schedule.cycleId,
    cycleNumber: schedule.cycleNumber,
    title: schedule.title,
    dateRangeLabel,
    countdownLabel: `Opens in ${countdown}`,
    statusLabel: 'Starting Soon',
    headline: `${schedule.title} Starts Soon`,
    detailLine: '7-day bi-weekly tournament window · First-to-3',
    ctaLabel: 'View Schedule',
  };
}

function readDismissedKeys(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function writeDismissedKeys(keys: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

interface TournamentToastSystemProps {
  schedule: TournamentScheduleStatus;
  waitingCount: number;
  onOpenTournamentArena: () => void;
  onUiClick?: () => void;
}

export function TournamentToastSystem({
  schedule,
  waitingCount,
  onOpenTournamentArena,
  onUiClick,
}: TournamentToastSystemProps) {
  const payload = useMemo(
    () => buildTournamentToastPayload(schedule, waitingCount),
    [schedule, waitingCount]
  );

  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => readDismissedKeys());
  const [renderedKey, setRenderedKey] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);
  const enterFrameRef = useRef<number | null>(null);

  const alertKey = payload?.alertKey ?? null;
  const isSuppressed = alertKey ? dismissedKeys.has(alertKey) : true;

  useEffect(() => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (enterFrameRef.current !== null) {
      window.cancelAnimationFrame(enterFrameRef.current);
      enterFrameRef.current = null;
    }

    if (!alertKey || isSuppressed) {
      setRenderedKey(null);
      setEntered(false);
      setExiting(false);
      return;
    }

    setRenderedKey(alertKey);
    setExiting(false);
    setEntered(false);
    enterFrameRef.current = window.requestAnimationFrame(() => {
      setEntered(true);
    });

    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      if (enterFrameRef.current !== null) {
        window.cancelAnimationFrame(enterFrameRef.current);
        enterFrameRef.current = null;
      }
    };
  }, [alertKey, isSuppressed]);

  const dismissCurrent = useCallback(() => {
    if (!alertKey || exiting) return;
    setExiting(true);
    setEntered(false);
    exitTimerRef.current = window.setTimeout(() => {
      setDismissedKeys((prev) => {
        const next = new Set(prev);
        next.add(alertKey);
        writeDismissedKeys(next);
        return next;
      });
      setRenderedKey(null);
      setExiting(false);
      exitTimerRef.current = null;
    }, 200);
  }, [alertKey, exiting]);

  const handleEnterArena = useCallback(() => {
    onUiClick?.();
    onOpenTournamentArena();
  }, [onOpenTournamentArena, onUiClick]);

  if (!payload || !renderedKey || renderedKey !== payload.alertKey) {
    return null;
  }

  const isLive = payload.kind === 'live';

  return (
    <section
      aria-label="Tournament notifications"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      <div
        role="status"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onUiClick?.();
            dismissCurrent();
          }
        }}
        className={`pointer-events-auto rounded-xl bg-slate-900/95 backdrop-blur-md shadow-2xl p-4 border transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          isLive ? 'border-amber-400/40' : 'border-sky-400/40'
        } ${
          entered && !exiting
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-3'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
              isLive
                ? 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                : 'bg-sky-500/15 border-sky-400/30 text-sky-300'
            }`}
          >
            {isLive ? (
              <Trophy className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Clock className="w-5 h-5" aria-hidden="true" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 truncate">
              <span className={isLive ? 'text-amber-300 font-semibold' : 'text-sky-300 font-semibold'}>
                {payload.statusLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{payload.dateRangeLabel}</span>
            </div>

            <h3 className="font-display text-sm font-extrabold text-white mt-0.5 truncate">
              {payload.headline}
            </h3>

            <p className="font-mono-num text-xs text-slate-200 mt-1">
              {payload.countdownLabel}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {payload.detailLine}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onUiClick?.();
              dismissCurrent();
            }}
            aria-label="Dismiss tournament notification"
            className="w-10 h-10 -mt-1 -mr-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleEnterArena}
            className={`flex-1 h-10 px-4 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
              isLive
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
            }`}
          >
            <span>{payload.ctaLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => {
              onUiClick?.();
              dismissCurrent();
            }}
            className="h-10 px-3.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}
