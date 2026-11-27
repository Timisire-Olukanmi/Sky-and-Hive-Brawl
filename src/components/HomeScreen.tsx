import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  Flame,
  Loader2,
  LogOut,
  Mail,
  Settings2,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  User as UserIcon,
  X,
} from 'lucide-react';
import { FIGHTER_SPECS, MAP_SPECS } from '../game/constants';
import type { FighterId, PlayMode } from '../game/types';
import { useFirebase } from '../contexts/FirebaseContext';
import type { ScoreboardStats } from '../hooks/usePersistentScoreboard';
import {
  ALL_FIGHTER_IDS,
  DISPLAY_NAME_MAX_LENGTH,
  getRankTier,
  type AuthProviderKind,
  type MapSelection,
  type OnlineStats,
  type TournamentStats,
} from '../types/account';
import {
  formatTournamentCountdown,
  getTournamentScheduleStatus,
} from '../game/tournamentSchedule';
import type { TournamentStateSnapshot, WaitingAreaSnapshot } from '../game/onlineTypes';
import { GitHubMark, GoogleMark } from './AccountBar';
import { PixelFighterPortrait } from './PixelFighterPortrait';
import { TournamentToastSystem } from './TournamentToastSystem';

type HomeAuthTab = 'signup' | 'signin' | 'reset';

interface HomeScreenProps {
  scoreboard: ScoreboardStats;
  onlineStats: OnlineStats;
  tournamentStats: TournamentStats;
  waitingSnapshot: WaitingAreaSnapshot;
  tournamentSnapshot?: TournamentStateSnapshot;
  selectedMode: PlayMode;
  selectedMap: MapSelection;
  p1Fighter: FighterId;
  p2Fighter: FighterId;
  onEnterArenaSetup: () => void;
  onQuickBattle: () => void;
  onStartTraining: () => void;
  onOpenCasualLounge: () => void;
  onOpenRankedArena: () => void;
  onOpenTournamentArena: () => void;
  onOpenProfileModal: () => void;
  onOpenUpgradeModal: () => void;
  onUiClick?: () => void;
}

function formatProviderLabel(provider?: AuthProviderKind): string {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'github':
      return 'GitHub';
    case 'password':
      return 'Email';
    case 'anonymous':
      return 'Guest';
    default:
      return 'Account';
  }
}

export function HomeScreen({
  scoreboard,
  onlineStats,
  tournamentStats,
  waitingSnapshot,
  tournamentSnapshot,
  selectedMode,
  selectedMap,
  p1Fighter,
  p2Fighter,
  onEnterArenaSetup,
  onQuickBattle,
  onStartTraining,
  onOpenCasualLounge,
  onOpenRankedArena,
  onOpenTournamentArena,
  onOpenProfileModal,
  onOpenUpgradeModal,
  onUiClick,
}: HomeScreenProps) {
  const {
    user,
    authReady,
    profile,
    privateAccount,
    profileLoading,
    syncStatus,
    authPendingProvider,
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithGitHub,
    signInAsGuest,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    signOutUser,
  } = useFirebase();

  const [authTab, setAuthTab] = useState<HomeAuthTab>('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  useEffect(() => {
    if (tournamentSnapshot?.serverNowMs) {
      setServerOffsetMs(tournamentSnapshot.serverNowMs - Date.now());
    }
  }, [tournamentSnapshot?.serverNowMs]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const tournamentSchedule = getTournamentScheduleStatus(nowMs + serverOffsetMs);
  const currentCycleTp =
    tournamentStats.cycleId === tournamentSchedule.cycleId && tournamentSchedule.isActive
      ? tournamentStats.points
      : 0;

  const isBusy = authPendingProvider !== null;
  const activeError = localError || authError?.message || null;

  const p1Spec = FIGHTER_SPECS[p1Fighter];
  const p2Spec = FIGHTER_SPECS[p2Fighter];
  const mapLabel = selectedMap === 'random' ? 'Random Stage (All 10)' : MAP_SPECS[selectedMap].name;

  const accountDisplayName =
    profile?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    (user?.isAnonymous ? 'Guest Fighter' : 'Brawler');

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetSent(false);
    clearAuthError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setLocalError('Enter a valid email address.');
      return;
    }

    if (authTab === 'reset') {
      const ok = await sendPasswordReset(trimmedEmail);
      if (ok) setResetSent(true);
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    if (authTab === 'signup') {
      if (!displayName.trim()) {
        setLocalError('Enter a player display name.');
        return;
      }
      await registerWithEmail(trimmedEmail, password, displayName);
      return;
    }

    await signInWithEmail(trimmedEmail, password);
  };

  const totalMatches = scoreboard.p1.wins + scoreboard.p1.losses;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between gap-3 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-b from-slate-950/90 via-slate-950/82 to-slate-950/94 backdrop-blur-[2px]">
      {/* Token Wars Hero Lockup + Pixel Fighter Lineup */}
      <header className="w-full max-w-5xl flex flex-col items-center text-center shrink-0">
        <div className="flex items-center justify-center gap-3">
          <svg
            viewBox="0 0 460 88"
            className="w-[310px] sm:w-[440px] h-auto drop-shadow-[0_6px_0_rgba(2,6,23,0.9)]"
            role="img"
            aria-label="Token Wars"
          >
            <defs>
              <linearGradient id="tokenWarsGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="48%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
            </defs>
            {/* Pixelated Gold Token Crest Left */}
            <g shapeRendering="crispEdges">
              <rect x="26" y="20" width="24" height="24" fill="#F59E0B" stroke="#141418" strokeWidth="3" />
              <rect x="32" y="26" width="12" height="12" fill="#FEF08A" />
              <rect x="36" y="29" width="4" height="6" fill="#B45309" />
              {/* Pixelated Twin Blades Right */}
              <rect x="410" y="20" width="24" height="24" fill="#0EA5E9" stroke="#141418" strokeWidth="3" />
              <rect x="416" y="26" width="12" height="12" fill="#E0F2FE" />
              <rect x="420" y="28" width="4" height="8" fill="#0369A1" />
            </g>
            <text
              x="230"
              y="48"
              textAnchor="middle"
              fill="url(#tokenWarsGold)"
              stroke="#141418"
              strokeWidth="7"
              paintOrder="stroke"
              style={{
                fontFamily: 'Bricolage Grotesque, sans-serif',
                fontWeight: 800,
                fontSize: '42px',
                letterSpacing: '0.03em',
              }}
            >
              TOKEN WARS
            </text>
            <text
              x="230"
              y="74"
              textAnchor="middle"
              fill="#CBD5E1"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: '11.5px',
                letterSpacing: '0.11em',
              }}
            >
              PIXEL PLATFORM BRAWLER · 10 FIGHTERS · 10 ARENAS
            </text>
          </svg>
        </div>

        {/* Crisp Pixelated Character Lineup */}
        <div
          aria-label="Playable Pixel Fighters Showcase"
          className="mt-1 flex items-center justify-center gap-1.5 sm:gap-2.5 flex-wrap"
        >
          {ALL_FIGHTER_IDS.map((id) => (
            <div
              key={id}
              title={FIGHTER_SPECS[id].name}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-slate-900/90 border border-white/10 flex items-center justify-center"
            >
              <PixelFighterPortrait id={id} size={28} />
            </div>
          ))}
        </div>
      </header>

      {/* Main Two-Column Dark Home Console: Embedded Sign-Up + Arena Command */}
      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Embedded Sign-Up / Account Card */}
        <section
          aria-label="Token Wars Account Sign Up and Login"
          className="lg:col-span-7 bg-slate-900/95 border border-white/15 rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between"
        >
          {!authReady ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2 text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" aria-hidden="true" />
              <span>Connecting to Token Wars player database...</span>
            </div>
          ) : user ? (
            <div className="flex flex-col justify-between h-full gap-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-14 h-14 rounded-xl bg-slate-950 border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: p1Spec.accentColor }}
                    >
                      <PixelFighterPortrait
                        id={profile?.favoriteFighter ?? p1Fighter}
                        size={44}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="font-display text-xl font-extrabold text-white truncate">
                          {accountDisplayName}
                        </h2>
                        <span className="text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs font-semibold text-amber-400 whitespace-nowrap shrink-0">
                          {formatProviderLabel(privateAccount?.authProvider)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                        {syncStatus === 'syncing' || profileLoading ? (
                          <>
                            <Loader2
                              className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0"
                              aria-hidden="true"
                            />
                            <span>Syncing cloud save...</span>
                          </>
                        ) : syncStatus === 'error' ? (
                          <>
                            <CloudOff className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />
                            <span className="text-rose-300">Cloud sync offline · Local active</span>
                          </>
                        ) : (
                          <>
                            <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                            <span>
                              Cloud synced · {p1Spec.name} main
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-3 text-left">
                  <div>
                    <div className="text-[11px] font-medium text-slate-400">Favorite Fighter</div>
                    <div className="text-sm font-bold text-white mt-0.5 truncate">
                      {FIGHTER_SPECS[profile?.favoriteFighter ?? p1Fighter].name}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-400">Default Stage</div>
                    <div className="text-sm font-bold text-white mt-0.5 truncate">
                      {(profile?.defaultMap ?? selectedMap) === 'random'
                        ? 'Random'
                        : MAP_SPECS[(profile?.defaultMap ?? selectedMap) as Exclude<MapSelection, 'random'>].name}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-400">Default Mode</div>
                    <div className="text-sm font-bold text-white mt-0.5 truncate">
                      {profile?.preferredMode === '2P_LOCAL' ? '2P Local' : '1P vs CPU'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
                {privateAccount?.isGuest && (
                  <button
                    type="button"
                    onClick={() => {
                      onUiClick?.();
                      onOpenUpgradeModal();
                    }}
                    className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Upgrade &amp; Save Account</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onUiClick?.();
                    onOpenProfileModal();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-white/15 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                  <span>Edit Profile &amp; Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUiClick?.();
                    void signOutUser();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-white/10 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ml-auto"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-white">
                    Create Your Token Wars Account
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sign up or log in with one click to sync wins, streaks, and fighter loadouts.
                  </p>
                </div>
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              </div>

              {/* One-Click Login Buttons */}
              <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    onUiClick?.();
                    void signInWithGoogle();
                  }}
                  className="h-9 px-3 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {authPendingProvider === 'google' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <GoogleMark />
                  )}
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    onUiClick?.();
                    void signInWithGitHub();
                  }}
                  className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white text-xs font-semibold border border-white/15 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {authPendingProvider === 'github' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <GitHubMark />
                  )}
                  <span>GitHub</span>
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    onUiClick?.();
                    void signInAsGuest();
                  }}
                  className="h-9 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-60 text-slate-200 hover:text-white text-xs font-semibold border border-white/15 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {authPendingProvider === 'anonymous' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  )}
                  <span>Guest One-Click</span>
                </button>
              </div>

              <div className="my-3.5 flex items-center gap-3 text-[11px] text-slate-500">
                <div className="h-px flex-1 bg-white/10" />
                <span>or with email</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Tabs: Sign Up (default), Log In, Reset */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-lg border border-white/10 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    onUiClick?.();
                    setAuthTab('signup');
                    setLocalError(null);
                    setResetSent(false);
                    clearAuthError();
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    authTab === 'signup' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUiClick?.();
                    setAuthTab('signin');
                    setLocalError(null);
                    setResetSent(false);
                    clearAuthError();
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    authTab === 'signin' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUiClick?.();
                    setAuthTab('reset');
                    setLocalError(null);
                    setResetSent(false);
                    clearAuthError();
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    authTab === 'reset' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Reset
                </button>
              </div>

              <form onSubmit={(e) => void handleFormSubmit(e)} className="space-y-2.5">
                {authTab === 'signup' && (
                  <div>
                    <label
                      htmlFor="home-display-name"
                      className="block text-[11px] font-medium text-slate-300 mb-1"
                    >
                      Player Tag / Display Name
                    </label>
                    <input
                      id="home-display-name"
                      type="text"
                      maxLength={DISPLAY_NAME_MAX_LENGTH}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. PixelKing"
                      className="w-full h-9 px-3 rounded-lg bg-slate-950 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className={authTab === 'reset' ? 'sm:col-span-2' : ''}>
                    <label
                      htmlFor="home-email"
                      className="block text-[11px] font-medium text-slate-300 mb-1"
                    >
                      Email Address
                    </label>
                    <input
                      id="home-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="player@example.com"
                      className="w-full h-9 px-3 rounded-lg bg-slate-950 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {authTab !== 'reset' && (
                    <div>
                      <label
                        htmlFor="home-password"
                        className="block text-[11px] font-medium text-slate-300 mb-1"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="home-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete={authTab === 'signup' ? 'new-password' : 'current-password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="w-full h-9 pl-3 pr-9 rounded-lg bg-slate-950 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {activeError && (
                  <div
                    role="alert"
                    className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-rose-950/70 border border-rose-500/40 text-xs text-rose-100"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <div>{activeError}</div>
                        {authError?.setupHint && (
                          <div className="text-[11px] text-rose-200/80 mt-0.5">
                            {authError.setupHint}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalError(null);
                        clearAuthError();
                      }}
                      aria-label="Dismiss error"
                      className="text-rose-300 hover:text-white shrink-0 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {resetSent && (
                  <div className="px-3 py-2 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-xs text-emerald-200">
                    Password reset email sent. Check your inbox.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full h-9 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {authPendingProvider === 'password' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {authTab === 'signup'
                      ? 'Create Account'
                      : authTab === 'reset'
                      ? 'Send Reset Link'
                      : 'Log In with Email'}
                  </span>
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Right: Arena Command, Matchup Preview & Scoreboard */}
        <section
          aria-label="Arena Command and Scoreboard"
          className="lg:col-span-5 bg-slate-900/95 border border-white/15 rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between gap-4"
        >
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                <h2 className="font-display text-sm font-bold text-white truncate">
                  Career Scoreboard
                </h2>
              </div>
              <span className="font-mono-num text-[11px] text-slate-400 whitespace-nowrap">
                {totalMatches} {totalMatches === 1 ? 'match' : 'matches'}
              </span>
            </div>

            <div className="mt-2.5 divide-y divide-white/10">
              {[
                { label: 'Player 1', record: scoreboard.p1, accent: 'text-amber-400' },
                { label: 'Player 2', record: scoreboard.p2, accent: 'text-sky-400' },
                { label: 'CPU', record: scoreboard.cpu, accent: 'text-emerald-400' },
              ].map((row) => (
                <div key={row.label} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`font-display text-xs font-bold ${row.accent}`}>
                      {row.label}
                    </span>
                    {row.record.currentStreak > 3 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono-num text-[10px] font-bold leading-none whitespace-nowrap">
                        <Flame className="w-2.5 h-2.5 text-amber-400" aria-hidden="true" />
                        <span>{row.record.currentStreak}W</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono-num text-xs shrink-0">
                    <span className="text-emerald-400 font-bold">{row.record.wins}W</span>
                    <span className="text-rose-400 font-bold">{row.record.losses}L</span>
                    <span className="text-slate-300">{row.record.currentStreak} STRK</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Active Pixel Matchup Card */}
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-950 border border-white/10 flex items-center justify-center shrink-0">
                  <PixelFighterPortrait id={p1Fighter} size={32} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-white truncate">
                    {p1Spec.name} vs {p2Spec.name}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {selectedMode === 'TRAINING'
                      ? 'Training Dummy'
                      : selectedMode === '1P_AI'
                      ? '1P vs CPU'
                      : '2P Local'}{' '}
                    · {mapLabel}
                  </div>
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-950 border border-white/10 flex items-center justify-center shrink-0">
                <PixelFighterPortrait id={p2Fighter} size={32} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
            {/* Online First-to-Three Modes: Strictly Isolated Casual Lounge vs Ranked Arena */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onUiClick?.();
                  onOpenCasualLounge();
                }}
                className="w-full px-3 py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-left border border-sky-400/40 transition-colors cursor-pointer"
              >
                <div className="text-xs font-extrabold text-sky-300 whitespace-nowrap">
                  Online Casuals · FT3
                </div>
                <div className="text-[11px] font-mono-num text-slate-300 mt-0.5 truncate">
                  {waitingSnapshot.casualWaiting.length} waiting · {onlineStats.casualWins}W-
                  {onlineStats.casualLosses}L
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUiClick?.();
                  onOpenRankedArena();
                }}
                className="w-full px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-left border border-amber-400/45 transition-colors cursor-pointer"
              >
                <div className="text-xs font-extrabold text-amber-300 whitespace-nowrap">
                  Online Ranked · FT3
                </div>
                <div className="text-[11px] font-mono-num text-slate-300 mt-0.5 truncate">
                  {waitingSnapshot.rankedWaiting.length} waiting ·{' '}
                  <span style={{ color: getRankTier(onlineStats.rankedPoints).color }}>
                    {getRankTier(onlineStats.rankedPoints).name}
                  </span>{' '}
                  {onlineStats.rankedPoints} RP
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onUiClick?.();
                onOpenTournamentArena();
              }}
              className={`w-full px-3 py-2 rounded-lg text-left border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                tournamentSchedule.isActive
                  ? 'bg-gradient-to-r from-amber-500/20 to-rose-500/15 hover:from-amber-500/30 hover:to-rose-500/25 border-amber-400/50'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-white/15'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-extrabold text-amber-300 whitespace-nowrap">
                  <Trophy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Bi-Weekly Tournament · {tournamentSchedule.isActive ? 'LIVE NOW' : 'CLOSED'}</span>
                </div>
                <div className="text-[11px] font-mono-num text-slate-300 mt-0.5 truncate">
                  {tournamentSchedule.isActive
                    ? `1 wk every 2 wks · Ends in ${formatTournamentCountdown(tournamentSchedule.msUntilTransition, false)} · ${waitingSnapshot.tournamentWaiting.length} waiting`
                    : `1 wk every 2 wks · Opens in ${formatTournamentCountdown(tournamentSchedule.msUntilTransition, false)}`}
                </div>
              </div>
              <div className="font-mono-num text-xs font-extrabold text-white shrink-0">
                {currentCycleTp} TP
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onUiClick?.();
                onEnterArenaSetup();
              }}
              className="w-full h-11 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Offline Arena Setup</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onUiClick?.();
                  onQuickBattle();
                }}
                className="w-full h-10 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-white/15 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Swords className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                <span>Quick Battle</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onUiClick?.();
                  onStartTraining();
                }}
                className="w-full h-10 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 font-bold text-xs border border-emerald-400/25 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Training Dummy</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="text-xs text-slate-400 font-medium tracking-wide text-center shrink-0">
        WASD Move · W Jump · J Attacks · K Special · R (W+K) Recovery · L Ultimate · T Taunt · Esc Pause
      </footer>

      <TournamentToastSystem
        schedule={tournamentSchedule}
        waitingCount={waitingSnapshot.tournamentWaiting.length}
        onOpenTournamentArena={onOpenTournamentArena}
        onUiClick={onUiClick}
      />
    </div>
  );
}
