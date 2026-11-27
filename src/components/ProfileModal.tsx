import { useEffect, useState, type FormEvent } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { FIGHTER_SPECS, MAP_SPECS } from '../game/constants';
import type { FighterId } from '../game/types';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  ALL_FIGHTER_IDS,
  ALL_MAP_IDS,
  DISPLAY_NAME_MAX_LENGTH,
  type LocalPlayMode,
  type MapSelection,
} from '../types/account';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onProfileSaved: (saved: {
    favoriteFighter: FighterId;
    defaultMap: MapSelection;
    preferredMode: LocalPlayMode;
  }) => void;
  onUiClick?: () => void;
}

export function ProfileModal({
  open,
  onClose,
  onProfileSaved,
  onUiClick,
}: ProfileModalProps) {
  const { user, profile, privateAccount, updateUserProfile } = useFirebase();

  const [displayName, setDisplayName] = useState('');
  const [favoriteFighter, setFavoriteFighter] = useState<FighterId>('honey_shell');
  const [defaultMap, setDefaultMap] = useState<MapSelection>('hive_canopy');
  const [preferredMode, setPreferredMode] = useState<LocalPlayMode>('1P_AI');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open && profile) {
      setDisplayName(profile.displayName);
      setFavoriteFighter(profile.favoriteFighter);
      setDefaultMap(profile.defaultMap);
      setPreferredMode(profile.preferredMode);
      setErrorMsg(null);
    }
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open || !user || !profile) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setErrorMsg('Display name cannot be empty.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const ok = await updateUserProfile({
        displayName: trimmed,
        favoriteFighter,
        defaultMap,
        preferredMode,
      });
      if (ok) {
        onProfileSaved({ favoriteFighter, defaultMap, preferredMode });
        onClose();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto bg-slate-900 border border-white/15 rounded-xl p-5 sm:p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="profile-modal-title" className="font-display text-xl font-bold text-white">
              Player Profile &amp; Defaults
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Saved preferences auto-load whenever you sign in on any device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile editor"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="profile-display-name"
                className="text-xs font-medium text-slate-300"
              >
                Display Name
              </label>
              <span className="font-mono-num text-[11px] text-slate-500">
                {displayName.length}/{DISPLAY_NAME_MAX_LENGTH}
              </span>
            </div>
            <input
              id="profile-display-name"
              type="text"
              required
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="profile-fav-fighter"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Favorite Fighter
              </label>
              <select
                id="profile-fav-fighter"
                value={favoriteFighter}
                onChange={(e) => {
                  onUiClick?.();
                  setFavoriteFighter(e.target.value as FighterId);
                }}
                className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                {ALL_FIGHTER_IDS.map((id) => (
                  <option key={id} value={id}>
                    {FIGHTER_SPECS[id].name} · {FIGHTER_SPECS[id].title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-default-map"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Default Stage
              </label>
              <select
                id="profile-default-map"
                value={defaultMap}
                onChange={(e) => {
                  onUiClick?.();
                  setDefaultMap(e.target.value as MapSelection);
                }}
                className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="random">Random (Any of 10 Stages)</option>
                {ALL_MAP_IDS.map((mId) => (
                  <option key={mId} value={mId}>
                    {MAP_SPECS[mId].name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-300 mb-1.5">Preferred Battle Mode</div>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => {
                  onUiClick?.();
                  setPreferredMode('1P_AI');
                }}
                className={`h-9 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  preferredMode === '1P_AI'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                1P vs CPU
              </button>
              <button
                type="button"
                onClick={() => {
                  onUiClick?.();
                  setPreferredMode('2P_LOCAL');
                }}
                className={`h-9 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  preferredMode === '2P_LOCAL'
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                2P Local
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 text-xs text-slate-400 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span>Account Email</span>
              <span className="text-slate-200 font-mono-num truncate">
                {privateAccount?.email || 'Guest session (no email linked)'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>User ID</span>
              <span className="text-slate-400 font-mono-num text-[11px] truncate">
                {user.uid}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="px-3 py-2 rounded-lg bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          <div className="pt-1 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="w-4 h-4" aria-hidden="true" />
              )}
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
