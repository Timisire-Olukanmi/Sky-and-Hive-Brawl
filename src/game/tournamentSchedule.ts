export const TOURNAMENT_CYCLE_DAYS = 14;
export const TOURNAMENT_ACTIVE_DAYS = 7;

export const MS_PER_HOUR = 60 * 60 * 1000;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const TOURNAMENT_ACTIVE_MS = TOURNAMENT_ACTIVE_DAYS * MS_PER_DAY;
export const TOURNAMENT_CYCLE_MS = TOURNAMENT_CYCLE_DAYS * MS_PER_DAY;
export const TOURNAMENT_STARTING_SOON_MS = 24 * MS_PER_HOUR;

// Monday Nov 23, 2026 00:00:00 UTC — Week 1 of each 2-week cycle is a 7-day live tournament
export const TOURNAMENT_ANCHOR_MS = Date.UTC(2026, 10, 23, 0, 0, 0);

export type TournamentAlertKind = 'live' | 'starting_soon';

const TOURNAMENT_TITLES = [
  'Hive Crown Grand Prix',
  'Storm Citadel Invitational',
  'Magma Foundry Cup',
  'Eclipse Temple Championship',
  'Cyber Skyline Open',
  'Cosmic Station Masters',
] as const;

export interface TournamentWindowSummary {
  cycleNumber: number;
  cycleId: string;
  title: string;
  startMs: number;
  endMs: number;
  status: 'live' | 'upcoming';
}

export interface TournamentScheduleStatus {
  nowMs: number;
  cycleNumber: number;
  cycleId: string;
  title: string;
  isActive: boolean;
  activeWindowStartMs: number;
  activeWindowEndMs: number;
  nextTournamentStartMs: number;
  nextTournamentEndMs: number;
  msUntilTransition: number;
  progressPct: number;
  previousCycleId: string | null;
  previousCycleTitle: string | null;
  upcomingWindows: TournamentWindowSummary[];
}

export function getTournamentTitle(cycleNumber: number): string {
  const idx = ((cycleNumber - 1) % TOURNAMENT_TITLES.length + TOURNAMENT_TITLES.length) % TOURNAMENT_TITLES.length;
  return TOURNAMENT_TITLES[idx];
}

export function getTournamentCycleId(cycleNumber: number): string {
  return `cycle_${Math.max(1, cycleNumber)}`;
}

export function getTournamentScheduleStatus(nowMs = Date.now()): TournamentScheduleStatus {
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();
  const delta = safeNow - TOURNAMENT_ANCHOR_MS;
  const rawIndex = Math.floor(delta / TOURNAMENT_CYCLE_MS);
  const cycleIndex = Math.max(0, rawIndex);
  const cycleStartMs = TOURNAMENT_ANCHOR_MS + cycleIndex * TOURNAMENT_CYCLE_MS;
  const offsetInCycle = safeNow - cycleStartMs;

  const isActive = offsetInCycle >= 0 && offsetInCycle < TOURNAMENT_ACTIVE_MS;
  const cycleNumber = cycleIndex + 1;
  const cycleId = getTournamentCycleId(cycleNumber);
  const title = getTournamentTitle(cycleNumber);

  const activeWindowStartMs = cycleStartMs;
  const activeWindowEndMs = cycleStartMs + TOURNAMENT_ACTIVE_MS;

  const nextCycleIndex = isActive ? cycleIndex + 1 : delta < 0 ? 0 : cycleIndex + 1;
  const nextCycleNumber = nextCycleIndex + 1;
  const nextTournamentStartMs = TOURNAMENT_ANCHOR_MS + nextCycleIndex * TOURNAMENT_CYCLE_MS;
  const nextTournamentEndMs = nextTournamentStartMs + TOURNAMENT_ACTIVE_MS;

  const msUntilTransition = isActive
    ? Math.max(0, activeWindowEndMs - safeNow)
    : Math.max(0, nextTournamentStartMs - safeNow);

  const phaseDuration = isActive
    ? TOURNAMENT_ACTIVE_MS
    : TOURNAMENT_CYCLE_MS - TOURNAMENT_ACTIVE_MS;
  const phaseElapsed = isActive
    ? Math.max(0, offsetInCycle)
    : Math.max(0, safeNow - activeWindowEndMs);
  const progressPct = Math.max(0, Math.min(100, Math.round((phaseElapsed / phaseDuration) * 100)));

  const previousCycleNumber = isActive ? cycleNumber - 1 : cycleNumber;
  const previousCycleId = previousCycleNumber >= 1 ? getTournamentCycleId(previousCycleNumber) : null;
  const previousCycleTitle = previousCycleNumber >= 1 ? getTournamentTitle(previousCycleNumber) : null;

  const upcomingWindows: TournamentWindowSummary[] = [];
  const firstVisibleIndex = isActive ? cycleIndex : nextCycleIndex;
  for (let i = 0; i < 4; i++) {
    const idx = firstVisibleIndex + i;
    const num = idx + 1;
    const startMs = TOURNAMENT_ANCHOR_MS + idx * TOURNAMENT_CYCLE_MS;
    const endMs = startMs + TOURNAMENT_ACTIVE_MS;
    upcomingWindows.push({
      cycleNumber: num,
      cycleId: getTournamentCycleId(num),
      title: getTournamentTitle(num),
      startMs,
      endMs,
      status: isActive && idx === cycleIndex ? 'live' : 'upcoming',
    });
  }

  return {
    nowMs: safeNow,
    cycleNumber,
    cycleId: isActive ? cycleId : getTournamentCycleId(nextCycleNumber),
    title: isActive ? title : getTournamentTitle(nextCycleNumber),
    isActive,
    activeWindowStartMs,
    activeWindowEndMs,
    nextTournamentStartMs,
    nextTournamentEndMs,
    msUntilTransition,
    progressPct,
    previousCycleId,
    previousCycleTitle,
    upcomingWindows,
  };
}

export function formatTournamentCountdown(ms: number, includeSeconds = true): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (includeSeconds) {
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
}

export function formatTournamentDateRange(startMs: number, endMs: number): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${fmt.format(new Date(startMs))} – ${fmt.format(new Date(endMs))} UTC`;
}

export function getTournamentAlertKind(
  schedule: TournamentScheduleStatus,
  startingSoonThresholdMs = TOURNAMENT_STARTING_SOON_MS
): TournamentAlertKind | null {
  if (schedule.isActive) {
    return 'live';
  }
  if (schedule.msUntilTransition >= 0 && schedule.msUntilTransition <= startingSoonThresholdMs) {
    return 'starting_soon';
  }
  return null;
}
