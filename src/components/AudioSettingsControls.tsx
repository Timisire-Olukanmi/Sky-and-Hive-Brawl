import { useRef } from 'react';
import { Gamepad2, Music, Volume2, VolumeX } from 'lucide-react';
import { MAP_SPECS } from '../game/constants';
import { STAGE_MUSIC_METADATA } from '../game/music';
import type { MapId } from '../game/types';
import type { TouchControlsPreference } from './MobileControls';

interface AudioSettingsControlsProps {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  activeStageId?: MapId | null;
  touchControlsPref?: TouchControlsPreference;
  onChangeTouchControlsPref?: (pref: TouchControlsPreference) => void;
  onChangeMusicVolume: (volume: number) => void;
  onChangeSfxVolume: (volume: number) => void;
  onPreviewSfx?: () => void;
  onToggleMute: () => void;
}

export function AudioSettingsControls({
  musicVolume,
  sfxVolume,
  muted,
  activeStageId,
  touchControlsPref,
  onChangeTouchControlsPref,
  onChangeMusicVolume,
  onChangeSfxVolume,
  onPreviewSfx,
  onToggleMute,
}: AudioSettingsControlsProps) {
  const prevMusicRef = useRef(musicVolume > 0.02 ? musicVolume : 0.55);
  const prevSfxRef = useRef(sfxVolume > 0.02 ? sfxVolume : 0.85);

  if (musicVolume > 0.02) {
    prevMusicRef.current = musicVolume;
  }
  if (sfxVolume > 0.02) {
    prevSfxRef.current = sfxVolume;
  }

  const musicPct = Math.round(musicVolume * 100);
  const sfxPct = Math.round(sfxVolume * 100);
  const trackMeta = activeStageId ? STAGE_MUSIC_METADATA[activeStageId] : null;
  const stageSpec = activeStageId ? MAP_SPECS[activeStageId] : null;

  const toggleMusicChannel = () => {
    if (musicVolume > 0.01) {
      prevMusicRef.current = musicVolume;
      onChangeMusicVolume(0);
    } else {
      onChangeMusicVolume(prevMusicRef.current || 0.55);
    }
  };

  const toggleSfxChannel = () => {
    if (sfxVolume > 0.01) {
      prevSfxRef.current = sfxVolume;
      onChangeSfxVolume(0);
    } else {
      onChangeSfxVolume(prevSfxRef.current || 0.85);
      onPreviewSfx?.();
    }
  };

  return (
    <div className="bg-slate-950/75 border border-white/10 rounded-lg p-3.5 text-left">
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-slate-200 tracking-wide">
            Audio Settings
          </h3>
          {trackMeta && stageSpec ? (
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {trackMeta.title} · {stageSpec.name} · {trackMeta.bpm} BPM
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              Unique loopable tracks play for all 10 stages
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          aria-pressed={muted}
          className={`px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
            muted
              ? 'bg-rose-500/20 border-rose-400/40 text-rose-200 hover:bg-rose-500/30'
              : 'bg-slate-900 border-white/15 text-slate-200 hover:bg-slate-800'
          }`}
        >
          {muted ? (
            <VolumeX className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{muted ? 'All Muted' : 'Mute All'}</span>
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {/* Background Music Volume Slider */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <button
              type="button"
              onClick={toggleMusicChannel}
              aria-label={musicPct === 0 ? 'Unmute background music' : 'Mute background music'}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <Music
                className={`w-3.5 h-3.5 shrink-0 ${
                  muted || musicPct === 0 ? 'text-slate-500' : 'text-amber-400'
                }`}
                aria-hidden="true"
              />
              <span>Music Volume</span>
            </button>
            <span
              className={`font-mono-num text-xs font-semibold ${
                muted || musicPct === 0 ? 'text-slate-500' : 'text-amber-300'
              }`}
            >
              {muted ? 'Muted' : `${musicPct}%`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={musicPct}
            onChange={(e) => onChangeMusicVolume(Number(e.target.value) / 100)}
            aria-label="Music Volume"
            className="w-full h-2 accent-amber-400 cursor-pointer"
          />
        </div>

        {/* Sound Effects Volume Slider */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <button
              type="button"
              onClick={toggleSfxChannel}
              aria-label={sfxPct === 0 ? 'Unmute sound effects' : 'Mute sound effects'}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-sky-300 transition-colors cursor-pointer"
            >
              {muted || sfxPct === 0 ? (
                <VolumeX className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 shrink-0 text-sky-400" aria-hidden="true" />
              )}
              <span>Sound Effects Volume</span>
            </button>
            <span
              className={`font-mono-num text-xs font-semibold ${
                muted || sfxPct === 0 ? 'text-slate-500' : 'text-sky-300'
              }`}
            >
              {muted ? 'Muted' : `${sfxPct}%`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={sfxPct}
            onChange={(e) => onChangeSfxVolume(Number(e.target.value) / 100)}
            onPointerUp={() => onPreviewSfx?.()}
            onKeyUp={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                onPreviewSfx?.();
              }
            }}
            aria-label="Sound Effects Volume"
            className="w-full h-2 accent-sky-400 cursor-pointer"
          />
        </div>

        {touchControlsPref !== undefined && onChangeTouchControlsPref && (
          <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
              <Gamepad2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
              <span>Touch Controls</span>
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-md bg-slate-900 border border-white/10">
              {(['auto', 'on', 'off'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChangeTouchControlsPref(opt)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                    touchControlsPref === opt
                      ? 'bg-emerald-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
