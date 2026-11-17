import {
  AlertCircle,
  Cloud,
  CloudOff,
  Loader2,
  LogOut,
  Mail,
  Settings2,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { FIGHTER_SPECS } from '../game/constants';
import { useFirebase } from '../contexts/FirebaseContext';
import type { AuthProviderKind } from '../types/account';

interface AccountBarProps {
  onOpenEmailAuth: (mode?: 'signin' | 'signup' | 'upgrade') => void;
  onOpenProfileModal: () => void;
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

export function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.25-.96 2.31-2.04 3.02l3.3 2.56c1.92-1.77 3.03-4.38 3.03-7.48 0-.72-.06-1.41-.19-2.08H12z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.75 0 5.06-.91 6.75-2.46l-3.3-2.56c-.91.61-2.08.98-3.45.98-2.65 0-4.9-1.79-5.7-4.2H2.89v2.64C4.57 19.74 8.01 22 12 22z"
      />
      <path
        fill="#4A90E2"
        d="M6.3 13.76A5.99 5.99 0 0 1 5.98 12c0-.61.11-1.2.32-1.76V7.6H2.89A9.97 9.97 0 0 0 2 12c0 1.61.39 3.13 1.09 4.4l3.21-2.64z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.04c1.5 0 2.84.52 3.9 1.53l2.92-2.92C17.05 3 14.74 2 12 2 8.01 2 4.57 4.26 2.89 7.6l3.41 2.64c.8-2.41 3.05-4.2 5.7-4.2z"
      />
    </svg>
  );
}

export function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0 fill-current" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.38-3.37-1.38-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.38 9.38 0 0 1 12 6.96c.85 0 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.81 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.25C22 6.59 17.52 2 12 2z" />
    </svg>
  );
}

export function AccountBar({
  onOpenEmailAuth,
  onOpenProfileModal,
  onUiClick,
}: AccountBarProps) {
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
    signOutUser,
  } = useFirebase();

  const isBusy = authPendingProvider !== null;
  const fighterAccent = profile
    ? FIGHTER_SPECS[profile.favoriteFighter].accentColor
    : '#F59E0B';
  const displayName =
    profile?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    (user?.isAnonymous ? 'Guest Fighter' : 'Brawler');

  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <section
      aria-label="Player Account and Login"
      className="pb-3.5 mb-3.5 border-b border-white/10"
    >
      {!authReady ? (
        <div className="flex items-center justify-between gap-3 py-1 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" aria-hidden="true" />
            <span>Checking account session...</span>
          </div>
          <span className="text-[11px] text-slate-500">Local saves active</span>
        </div>
      ) : user ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-display text-xs font-extrabold text-slate-950 shrink-0 border border-white/20"
              style={{ backgroundColor: fighterAccent }}
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display text-sm font-bold text-white truncate">
                  {displayName}
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs text-slate-300 whitespace-nowrap shrink-0">
                  {formatProviderLabel(privateAccount?.authProvider)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                {syncStatus === 'syncing' || profileLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-sky-400 shrink-0" aria-hidden="true" />
                    <span>Syncing cloud profile...</span>
                  </>
                ) : syncStatus === 'error' ? (
                  <>
                    <CloudOff className="w-3 h-3 text-rose-400 shrink-0" aria-hidden="true" />
                    <span className="text-rose-300">Cloud sync unavailable · Local saved</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                    <span>
                      Cloud synced
                      {profile
                        ? ` · ${FIGHTER_SPECS[profile.favoriteFighter].name} main`
                        : ''}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {privateAccount?.isGuest && (
              <button
                type="button"
                onClick={() => {
                  onUiClick?.();
                  onOpenEmailAuth('upgrade');
                }}
                className="px-2.5 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Save Account</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onUiClick?.();
                onOpenProfileModal();
              }}
              className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold border border-white/15 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              <Settings2 className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              <span>Edit Profile</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onUiClick?.();
                void signOutUser();
              }}
              className="px-2.5 py-1.5 rounded-md bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-white/10 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-white font-display">
              <span>Player Account</span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-sans font-normal text-slate-400">
                One-click sign-in to sync wins, streaks &amp; fighter defaults
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                onUiClick?.();
                void signInWithGoogle();
              }}
              className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
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
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white text-xs font-semibold border border-white/15 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
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
              className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-slate-200 hover:text-white text-xs font-semibold border border-white/15 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              {authPendingProvider === 'anonymous' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              )}
              <span>Guest</span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                onUiClick?.();
                onOpenEmailAuth('signin');
              }}
              className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <Mail className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Email</span>
            </button>
          </div>
        </div>
      )}

      {authError && (
        <div
          role="alert"
          className="mt-2.5 flex items-start justify-between gap-2.5 px-3 py-2 rounded-lg bg-rose-950/70 border border-rose-500/40 text-xs text-rose-100"
        >
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <div className="font-semibold text-rose-100">{authError.message}</div>
              {authError.setupHint && (
                <div className="text-[11px] text-rose-200/85 mt-0.5">{authError.setupHint}</div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={clearAuthError}
            aria-label="Dismiss authentication message"
            className="p-0.5 text-rose-300 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
