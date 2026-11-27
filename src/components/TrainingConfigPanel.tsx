import { useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal, Zap } from 'lucide-react';
import {
  TRAINING_DUMMY_BEHAVIOR_OPTIONS,
  getDefaultKnockbackForBehavior,
  type TrainingDummyBehavior,
  type TrainingDummyConfig,
} from '../game/trainingDummy';

interface TrainingConfigPanelProps {
  config: TrainingDummyConfig;
  onChangeConfig: (next: TrainingDummyConfig) => void;
  onResetDummy: () => void;
  onRefillUlt: () => void;
  onUiClick?: () => void;
}

const SPEED_OPTIONS: readonly { value: 0.75 | 1 | 1.3; label: string }[] = [
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1.0x' },
  { value: 1.3, label: '1.3x' },
];

export function TrainingConfigPanel({
  config,
  onChangeConfig,
  onResetDummy,
  onRefillUlt,
  onUiClick,
}: TrainingConfigPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const activeOption =
    TRAINING_DUMMY_BEHAVIOR_OPTIONS.find((opt) => opt.id === config.behavior) ??
    TRAINING_DUMMY_BEHAVIOR_OPTIONS[0];

  const handleSelectBehavior = (behavior: TrainingDummyBehavior) => {
    onUiClick?.();
    onChangeConfig({
      ...config,
      behavior,
      knockbackEnabled: getDefaultKnockbackForBehavior(behavior),
    });
  };

  return (
    <aside
      aria-label="Training dummy configuration"
      className="pointer-events-auto flex flex-col items-end gap-2 self-end"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={(e) => {
          e.currentTarget.blur();
          onUiClick?.();
          setExpanded((prev) => !prev);
        }}
        className="h-10 px-3.5 rounded-xl bg-slate-950/92 hover:bg-slate-900 border border-emerald-400/35 text-xs font-bold text-white shadow-lg backdrop-blur-md flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
        <span>Dummy Config</span>
        <span className="text-slate-500" aria-hidden="true">
          ·
        </span>
        <span className="text-emerald-300 font-semibold">{activeOption.shortLabel}</span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div className="w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-slate-950/92 border border-white/15 shadow-2xl backdrop-blur-md p-3.5 text-left">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
            <div>
              <h2 className="font-display text-sm font-extrabold text-white">
                Dummy Behavior
              </h2>
              <p className="text-[11px] text-slate-400">
                Simulate real match responses
              </p>
            </div>
            <span className="font-mono-num text-[11px] font-semibold text-emerald-300 whitespace-nowrap shrink-0">
              {config.knockbackEnabled ? 'Realistic KB' : 'Anchored'}
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="Training dummy behavior mode"
            className="mt-2.5 flex flex-col gap-1.5"
          >
            {TRAINING_DUMMY_BEHAVIOR_OPTIONS.map((opt) => {
              const selected = opt.id === config.behavior;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleSelectBehavior(opt.id);
                  }}
                  className={`w-full px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    selected
                      ? 'bg-emerald-500/18 border-emerald-400/55 text-white'
                      : 'bg-slate-900/75 hover:bg-slate-800/80 border-white/10 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold whitespace-nowrap">{opt.label}</span>
                    {selected && (
                      <span className="text-[10px] font-semibold text-emerald-300 whitespace-nowrap shrink-0">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-300">Knockback</span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onUiClick?.();
                    onChangeConfig({ ...config, knockbackEnabled: false });
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    !config.knockbackEnabled
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Anchored
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onUiClick?.();
                    onChangeConfig({ ...config, knockbackEnabled: true });
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.knockbackEnabled
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Realistic
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-300">Auto-Reset HP</span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onUiClick?.();
                    onChangeConfig({ ...config, autoResetHp: true });
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.autoResetHp
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  On
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onUiClick?.();
                    onChangeConfig({ ...config, autoResetHp: false });
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    !config.autoResetHp
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Off
                </button>
              </div>
            </div>

            {config.behavior !== 'standing_still' && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-300">Pace</span>
                <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-white/10 font-mono-num">
                  {SPEED_OPTIONS.map((sp) => (
                    <button
                      key={sp.value}
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onUiClick?.();
                        onChangeConfig({ ...config, moveSpeedScale: sp.value });
                      }}
                      className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        config.moveSpeedScale === sp.value
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/10 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onResetDummy();
              }}
              className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-400/25 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Reset Dummy</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRefillUlt();
              }}
              className="h-9 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Fill Ult (F)</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
