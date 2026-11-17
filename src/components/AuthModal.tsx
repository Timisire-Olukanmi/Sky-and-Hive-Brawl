import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, Mail, X } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { DISPLAY_NAME_MAX_LENGTH } from '../types/account';
import { GitHubMark, GoogleMark } from './AccountBar';

type AuthModalTab = 'signin' | 'signup' | 'reset';

interface AuthModalProps {
  open: boolean;
  initialMode: 'signin' | 'signup' | 'upgrade';
  onClose: () => void;
  onUiClick?: () => void;
}

export function AuthModal({ open, initialMode, onClose, onUiClick }: AuthModalProps) {
  const {
    authPendingProvider,
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithGitHub,
    signInAsGuest,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    linkGuestWithGoogle,
    linkGuestWithEmail,
  } = useFirebase();

  const isUpgradeMode = initialMode === 'upgrade';
  const [tab, setTab] = useState<AuthModalTab>(initialMode === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(initialMode === 'signup' ? 'signup' : 'signin');
      setLocalValidationError(null);
      setResetSent(false);
      clearAuthError();
    }
  }, [clearAuthError, initialMode, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const isBusy = authPendingProvider !== null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalValidationError(null);
    setResetSent(false);
    clearAuthError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setLocalValidationError('Enter a valid email address.');
      return;
    }

    if (tab === 'reset' && !isUpgradeMode) {
      const ok = await sendPasswordReset(trimmedEmail);
      if (ok) setResetSent(true);
      return;
    }

    if (password.length < 6) {
      setLocalValidationError('Password must be at least 6 characters.');
      return;
    }

    if (isUpgradeMode) {
      const ok = await linkGuestWithEmail(trimmedEmail, password, displayName);
      if (ok) onClose();
      return;
    }

    if (tab === 'signup') {
      if (!displayName.trim()) {
        setLocalValidationError('Enter a player display name.');
        return;
      }
      const ok = await registerWithEmail(trimmedEmail, password, displayName);
      if (ok) onClose();
      return;
    }

    const ok = await signInWithEmail(trimmedEmail, password);
    if (ok) onClose();
  };

  const handleSocialAction = async (provider: 'google' | 'github' | 'guest') => {
    onUiClick?.();
    setLocalValidationError(null);
    let ok = false;
    if (isUpgradeMode && provider === 'google') {
      ok = await linkGuestWithGoogle();
    } else if (provider === 'google') {
      ok = await signInWithGoogle();
    } else if (provider === 'github') {
      ok = await signInWithGitHub();
    } else {
      ok = await signInAsGuest();
    }
    if (ok) onClose();
  };

  const activeError = localValidationError || authError?.message || null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-xl p-5 sm:p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="auth-modal-title" className="font-display text-xl font-bold text-white">
              {isUpgradeMode ? 'Save Guest Account' : 'Player Sign In'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isUpgradeMode
                ? 'Link Google or Email to keep your current wins, losses, and streaks permanently.'
                : 'Sign in with one click or use your email and password.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign-in modal"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* One-Click Social Buttons */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleSocialAction('google')}
            className="h-10 px-3 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {authPendingProvider === 'google' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <GoogleMark />
            )}
            <span>{isUpgradeMode ? 'Link Google' : 'Google'}</span>
          </button>

          {!isUpgradeMode && (
            <>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleSocialAction('github')}
                className="h-10 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white text-xs font-semibold border border-white/15 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
                onClick={() => void handleSocialAction('guest')}
                className="h-10 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 text-xs font-semibold border border-white/15 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {authPendingProvider === 'anonymous' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                <span>Guest</span>
              </button>
            </>
          )}
        </div>

        <div className="my-4 flex items-center gap-3 text-[11px] text-slate-500">
          <div className="h-px flex-1 bg-white/10" />
          <span>or with email</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {!isUpgradeMode && (
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-lg border border-white/10 mb-4">
            <button
              type="button"
              onClick={() => {
                onUiClick?.();
                setTab('signin');
                setLocalValidationError(null);
                setResetSent(false);
                clearAuthError();
              }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'signin' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                onUiClick?.();
                setTab('signup');
                setLocalValidationError(null);
                setResetSent(false);
                clearAuthError();
              }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'signup' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                onUiClick?.();
                setTab('reset');
                setLocalValidationError(null);
                setResetSent(false);
                clearAuthError();
              }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'reset' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Reset
            </button>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          {(tab === 'signup' || isUpgradeMode) && (
            <div>
              <label
                htmlFor="auth-display-name"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Display Name {isUpgradeMode ? '(optional)' : ''}
              </label>
              <input
                id="auth-display-name"
                type="text"
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. AceBrawler"
                className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@example.com"
              className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {tab !== 'reset' && (
            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full h-10 pl-3 pr-10 rounded-lg bg-slate-950 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          )}

          {activeError && (
            <div className="px-3 py-2 rounded-lg bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200">
              <div>{activeError}</div>
              {authError?.setupHint && (
                <div className="text-[11px] text-rose-200/80 mt-0.5">{authError.setupHint}</div>
              )}
            </div>
          )}

          {resetSent && (
            <div className="px-3 py-2 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-xs text-emerald-200">
              Password reset email sent. Check your inbox and spam folder.
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className="w-full h-10 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {authPendingProvider === 'password' ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Mail className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {isUpgradeMode
                ? 'Link Email & Save'
                : tab === 'signup'
                ? 'Create Account'
                : tab === 'reset'
                ? 'Send Reset Link'
                : 'Sign In'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
