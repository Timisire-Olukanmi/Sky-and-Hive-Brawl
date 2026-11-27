import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';

export type TouchControlsPreference = 'auto' | 'on' | 'off';

export const TOUCH_CONTROLS_PREF_KEY = 'sky_hive_brawl_touch_controls_v1';

export interface TouchInputState {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  downHeld: boolean;
  justJump: boolean;
  justAttackCombo: boolean;
  justSpecial: boolean;
  justRecovery: boolean;
  justUltimate: boolean;
  justTaunt: boolean;
}

export function createEmptyTouchInputState(): TouchInputState {
  return {
    left: false,
    right: false,
    jumpHeld: false,
    downHeld: false,
    justJump: false,
    justAttackCombo: false,
    justSpecial: false,
    justRecovery: false,
    justUltimate: false,
    justTaunt: false,
  };
}

export function clearTouchHeldState(state: TouchInputState): void {
  state.left = false;
  state.right = false;
  state.jumpHeld = false;
  state.downHeld = false;
  state.justJump = false;
  state.justAttackCombo = false;
  state.justSpecial = false;
  state.justRecovery = false;
  state.justUltimate = false;
  state.justTaunt = false;
}

export function loadTouchControlsPreference(): TouchControlsPreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = window.localStorage.getItem(TOUCH_CONTROLS_PREF_KEY);
    if (raw === 'on' || raw === 'off' || raw === 'auto') {
      return raw;
    }
  } catch {
    // Ignore storage read errors
  }
  return 'auto';
}

export function saveTouchControlsPreference(pref: TouchControlsPreference): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOUCH_CONTROLS_PREF_KEY, pref);
  } catch {
    // Ignore storage write errors
  }
}

export function detectCoarseTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || 'ontouchstart' in window;
  const narrow = window.innerWidth < 900;
  return coarse || hasTouch || narrow;
}

type ActionButtonId = 'jump' | 'attack' | 'special' | 'recovery' | 'ultimate' | 'taunt';

interface MobileControlsProps {
  touchStateRef: { current: TouchInputState };
  ultCharge: number;
  fighterAccentColor: string;
  isTrainingMode: boolean;
  onRefillTrainingUlt?: () => void;
  onResetTraining?: () => void;
}

export function MobileControls({
  touchStateRef,
  ultCharge,
  fighterAccentColor,
  isTrainingMode,
  onRefillTrainingUlt,
  onResetTraining,
}: MobileControlsProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const padPointerIdRef = useRef<number | null>(null);
  const actionPointersRef = useRef<Map<number, ActionButtonId>>(new Map());

  const [padVisual, setPadVisual] = useState<{
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    knobX: number;
    knobY: number;
    active: boolean;
  }>({
    left: false,
    right: false,
    up: false,
    down: false,
    knobX: 0,
    knobY: 0,
    active: false,
  });

  const [pressedActions, setPressedActions] = useState<Record<ActionButtonId, boolean>>({
    jump: false,
    attack: false,
    special: false,
    recovery: false,
    ultimate: false,
    taunt: false,
  });

  const syncPressedActionVisuals = useCallback(() => {
    const next: Record<ActionButtonId, boolean> = {
      jump: false,
      attack: false,
      special: false,
      recovery: false,
      ultimate: false,
      taunt: false,
    };
    let anyJump = false;
    actionPointersRef.current.forEach((act) => {
      next[act] = true;
      if (act === 'jump') anyJump = true;
    });
    touchStateRef.current.jumpHeld = anyJump || padVisual.up;
    setPressedActions(next);
  }, [padVisual.up, touchStateRef]);

  const updatePadFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const maxR = rect.width * 0.42;

      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(maxR, dist);
      const ang = Math.atan2(dy, dx);
      const knobX = dist > 1 ? Math.cos(ang) * clampedDist : 0;
      const knobY = dist > 1 ? Math.sin(ang) * clampedDist : 0;

      const deadzone = rect.width * 0.13;
      const left = dx < -deadzone;
      const right = dx > deadzone;
      const up = dy < -deadzone * 1.15;
      const down = dy > deadzone * 1.15;

      const st = touchStateRef.current;
      const wasUp = st.jumpHeld;
      st.left = left;
      st.right = right;
      st.downHeld = down;

      let anyButtonJump = false;
      actionPointersRef.current.forEach((act) => {
        if (act === 'jump') anyButtonJump = true;
      });
      st.jumpHeld = up || anyButtonJump;
      if (up && !wasUp) {
        st.justJump = true;
      }

      setPadVisual({
        left,
        right,
        up,
        down,
        knobX,
        knobY,
        active: true,
      });
    },
    [touchStateRef]
  );

  const releasePad = useCallback(() => {
    padPointerIdRef.current = null;
    const st = touchStateRef.current;
    st.left = false;
    st.right = false;
    st.downHeld = false;
    let anyButtonJump = false;
    actionPointersRef.current.forEach((act) => {
      if (act === 'jump') anyButtonJump = true;
    });
    st.jumpHeld = anyButtonJump;
    setPadVisual({
      left: false,
      right: false,
      up: false,
      down: false,
      knobX: 0,
      knobY: 0,
      active: false,
    });
  }, [touchStateRef]);

  useEffect(() => {
    const resetAll = () => {
      padPointerIdRef.current = null;
      actionPointersRef.current.clear();
      clearTouchHeldState(touchStateRef.current);
      setPadVisual({
        left: false,
        right: false,
        up: false,
        down: false,
        knobX: 0,
        knobY: 0,
        active: false,
      });
      setPressedActions({
        jump: false,
        attack: false,
        special: false,
        recovery: false,
        ultimate: false,
        taunt: false,
      });
    };

    window.addEventListener('blur', resetAll);
    const onVisChange = () => {
      if (document.hidden) resetAll();
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('blur', resetAll);
      document.removeEventListener('visibilitychange', onVisChange);
      resetAll();
    };
  }, [touchStateRef]);

  const handleActionDown = (action: ActionButtonId) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture errors
    }

    actionPointersRef.current.set(e.pointerId, action);
    const st = touchStateRef.current;
    switch (action) {
      case 'jump':
        st.justJump = true;
        st.jumpHeld = true;
        break;
      case 'attack':
        st.justAttackCombo = true;
        break;
      case 'special':
        st.justSpecial = true;
        break;
      case 'recovery':
        st.justRecovery = true;
        break;
      case 'ultimate':
        st.justUltimate = true;
        break;
      case 'taunt':
        st.justTaunt = true;
        break;
    }
    syncPressedActionVisuals();
  };

  const handleActionUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (actionPointersRef.current.has(e.pointerId)) {
      actionPointersRef.current.delete(e.pointerId);
      syncPressedActionVisuals();
    }
  };

  const ultReady = ultCharge >= 100;

  return (
    <div
      aria-label="Mobile touch controls"
      className="pointer-events-none fixed inset-0 z-25 flex items-end justify-between px-3 sm:px-6 pb-3 sm:pb-5 select-none touch-none"
    >
      {/* Left Thumb Zone: Multi-Direction Slide Pad */}
      <div className="pointer-events-auto flex flex-col items-start gap-2 touch-none">
        <div
          ref={padRef}
          role="application"
          aria-label="Movement D-Pad"
          onPointerDown={(e) => {
            e.preventDefault();
            if (padPointerIdRef.current !== null) return;
            padPointerIdRef.current = e.pointerId;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // Ignore
            }
            updatePadFromClientPoint(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (padPointerIdRef.current !== e.pointerId) return;
            e.preventDefault();
            updatePadFromClientPoint(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (padPointerIdRef.current !== e.pointerId) return;
            e.preventDefault();
            releasePad();
          }}
          onPointerCancel={(e) => {
            if (padPointerIdRef.current !== e.pointerId) return;
            releasePad();
          }}
          className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-slate-950/65 border-2 border-white/20 backdrop-blur-[2px] shadow-2xl touch-none"
        >
          {/* Directional Indicators */}
          <div
            className={`absolute top-2.5 left-1/2 -translate-x-1/2 w-11 h-9 rounded-lg flex items-center justify-center transition-colors ${
              padVisual.up ? 'bg-amber-400/35 text-amber-200' : 'text-slate-300/75'
            }`}
          >
            <ArrowUp className="w-5 h-5" aria-hidden="true" />
          </div>
          <div
            className={`absolute bottom-2.5 left-1/2 -translate-x-1/2 w-11 h-9 rounded-lg flex items-center justify-center transition-colors ${
              padVisual.down ? 'bg-sky-400/35 text-sky-200' : 'text-slate-300/75'
            }`}
          >
            <ArrowDown className="w-5 h-5" aria-hidden="true" />
          </div>
          <div
            className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-11 rounded-lg flex items-center justify-center transition-colors ${
              padVisual.left ? 'bg-white/25 text-white' : 'text-slate-300/75'
            }`}
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </div>
          <div
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-11 rounded-lg flex items-center justify-center transition-colors ${
              padVisual.right ? 'bg-white/25 text-white' : 'text-slate-300/75'
            }`}
          >
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </div>

          {/* Center Thumb Puck */}
          <div
            className={`absolute left-1/2 top-1/2 w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 shadow-lg transition-transform duration-75 ${
              padVisual.active ? 'bg-slate-800/90 border-amber-300' : 'bg-slate-900/85 border-white/30'
            }`}
            style={{
              transform: `translate(calc(-50% + ${padVisual.knobX}px), calc(-50% + ${padVisual.knobY}px))`,
              borderColor: padVisual.active ? fighterAccentColor : undefined,
            }}
          />
        </div>
      </div>

      {/* Right Thumb Zone: Combat Action Cluster */}
      <div className="pointer-events-auto flex flex-col items-end gap-2 touch-none">
        {isTrainingMode && (
          <div className="flex items-center gap-1.5 mb-0.5">
            {onRefillTrainingUlt && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRefillTrainingUlt();
                }}
                className="h-10 px-3 rounded-lg bg-amber-500/85 active:bg-amber-400 text-slate-950 font-extrabold text-[11px] border border-amber-200/60 shadow-lg cursor-pointer touch-none"
              >
                Fill Ult
              </button>
            )}
            {onResetTraining && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onResetTraining();
                }}
                className="h-10 px-3 rounded-lg bg-slate-900/85 active:bg-slate-800 text-emerald-300 font-bold text-[11px] border border-emerald-400/40 shadow-lg flex items-center gap-1 cursor-pointer touch-none"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
            )}
          </div>
        )}

        {/* Top Auxiliary Row: Taunt + Recovery + Ultimate */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Taunt"
            onPointerDown={handleActionDown('taunt')}
            onPointerUp={handleActionUp}
            onPointerCancel={handleActionUp}
            className={`w-11 h-11 rounded-xl border font-display font-bold text-[11px] shadow-lg transition-transform touch-none ${
              pressedActions.taunt
                ? 'scale-95 bg-slate-700 border-white text-white'
                : 'bg-slate-950/75 border-white/20 text-slate-200'
            }`}
          >
            TNT
          </button>

          <button
            type="button"
            aria-label="Up Recovery"
            onPointerDown={handleActionDown('recovery')}
            onPointerUp={handleActionUp}
            onPointerCancel={handleActionUp}
            className={`w-12 h-12 rounded-full border-2 font-display font-extrabold text-[11px] flex flex-col items-center justify-center shadow-lg transition-transform touch-none ${
              pressedActions.recovery
                ? 'scale-95 bg-emerald-400 border-emerald-200 text-slate-950'
                : 'bg-emerald-950/80 border-emerald-400/70 text-emerald-200'
            }`}
          >
            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="leading-none">REC</span>
          </button>

          <button
            type="button"
            aria-label="Ultimate Attack"
            onPointerDown={handleActionDown('ultimate')}
            onPointerUp={handleActionUp}
            onPointerCancel={handleActionUp}
            className={`w-14 h-14 rounded-full border-2 font-display font-extrabold text-[11px] flex flex-col items-center justify-center shadow-xl transition-transform touch-none ${
              pressedActions.ultimate
                ? 'scale-95 bg-amber-300 border-white text-slate-950'
                : ultReady
                ? 'bg-amber-500/90 border-amber-200 text-slate-950'
                : 'bg-slate-950/75 border-white/20 text-slate-400'
            }`}
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span className="leading-none mt-0.5">{ultReady ? 'ULT' : `${ultCharge}%`}</span>
          </button>
        </div>

        {/* Main Thumb Row: Jump + Special + Attack */}
        <div className="flex items-end gap-2.5 pr-0.5">
          <button
            type="button"
            aria-label="Jump"
            onPointerDown={handleActionDown('jump')}
            onPointerUp={handleActionUp}
            onPointerCancel={handleActionUp}
            className={`w-12 h-12 rounded-full border-2 font-display font-extrabold text-[11px] flex flex-col items-center justify-center shadow-lg transition-transform touch-none ${
              pressedActions.jump
                ? 'scale-95 bg-slate-200 border-white text-slate-950'
                : 'bg-slate-900/85 border-white/35 text-white'
            }`}
          >
            <ArrowUp className="w-4 h-4" aria-hidden="true" />
            <span className="leading-none">JMP</span>
          </button>

          <button
            type="button"
            aria-label="Special Move"
            onPointerDown={handleActionDown('special')}
            onPointerUp={handleActionUp}
            onPointerCancel={handleActionUp}
            className={`w-14 h-14 rounded-full border-2 font-display font-extrabold text-xs flex flex-col items-center justify-center shadow-xl transition-transform touch-none ${
              pressedActions.special
                ? 'scale-95 bg-sky-300 border-white text-slate-950'
                : 'bg-sky-600/80 border-sky-300 text-white'
            }`}
          >
            <Zap className="w-4 h-4" aria-hidden="true" />
            <span className="leading-none mt-0.5">SPC</span>
          </button>

          <button
            type="button"
            aria-label="Attack Combo"
            onPointerDown={handleActionDown('attack')}
            onPointerUp={handleActionUp}
            onPointerCancel={handleActionUp}
            className={`w-16 h-16 rounded-full border-2 font-display font-extrabold text-xs flex flex-col items-center justify-center shadow-2xl transition-transform touch-none ${
              pressedActions.attack
                ? 'scale-95 bg-amber-300 border-white text-slate-950'
                : 'bg-amber-500/85 border-amber-200 text-slate-950'
            }`}
          >
            <Swords className="w-5 h-5" aria-hidden="true" />
            <span className="leading-none mt-0.5">ATK</span>
          </button>
        </div>
      </div>
    </div>
  );
}
