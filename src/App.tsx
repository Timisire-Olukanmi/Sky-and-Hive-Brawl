import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Pause, Play, RotateCcw, Film, FastForward, ArrowLeft, Trophy } from 'lucide-react';
import {
  AIR_DRAG,
  BLAST_ZONE,
  COYOTE_TIME,
  FAST_FALL_MULTIPLIER,
  FIGHTER_SPECS,
  GRAVITY,
  GROUND_FRICTION,
  JUMP_BUFFER_TIME,
  MAP_SPECS,
  MAX_FALL_SPEED,
  STARTING_STOCKS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './game/constants';
import { soundSynth } from './game/audio';
import { renderGameFrame, renderWinnersPodiumStage } from './game/renderer';
import { PersistentScoreboard } from './components/PersistentScoreboard';
import { usePersistentScoreboard } from './hooks/usePersistentScoreboard';
import type {
  AnimState,
  DestructiblePropRuntime,
  FighterEntity,
  FighterId,
  GameEngineState,
  GamePhase,
  HudSnapshot,
  MapId,
  MoveKey,
  ObstacleRuntime,
  ParticleEntity,
  Platform,
  PlayMode,
  ReplayFrame,
  ReplayHudState,
  ReplayInputAction,
  ReplayInputState,
} from './game/types';

function createParticlePool(size = 200): ParticleEntity[] {
  return Array.from({ length: size }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 4,
    color: '#FFFFFF',
    alpha: 1,
    life: 0,
    maxLife: 0.3,
    gravity: 0,
    shape: 'circle',
  }));
}

function createMapPlatforms(mapId: MapId): Platform[] {
  return MAP_SPECS[mapId].platforms.map((p) => ({
    ...p,
    prevX: p.x,
    prevY: p.y,
    motion: p.motion ? { ...p.motion } : undefined,
    scars: p.scars ? [...p.scars] : undefined,
  }));
}

function createMapObstacles(mapId: MapId): ObstacleRuntime[] {
  return MAP_SPECS[mapId].obstacles.map((o) => ({
    ...o,
    timer: o.phase ?? 0,
    state: 'idle',
    currentX: o.x,
    currentY: o.y,
    currentHeight: 0,
    angle: 0,
    hitCooldowns: [0, 0],
  }));
}

function createMapDestructibles(mapId: MapId): DestructiblePropRuntime[] {
  return MAP_SPECS[mapId].destructibles.map((d) => ({
    ...d,
    hp: d.maxHp,
    broken: false,
    respawnTimer: 0,
    shakeTimer: 0,
    hitFlashTimer: 0,
    hitCooldown: 0,
  }));
}

function createFighter(
  slot: 0 | 1,
  id: FighterId,
  isAi: boolean,
  mapId: MapId
): FighterEntity {
  const spec = FIGHTER_SPECS[id];
  const spawn = MAP_SPECS[mapId].spawnPoints[slot];
  return {
    slot,
    id,
    isAi,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    width: spec.width,
    height: spec.height,
    facing: slot === 0 ? 1 : -1,
    grounded: true,
    jumpsRemaining: 2,
    recoveryUsed: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    dropThroughTimer: 0,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    stocks: STARTING_STOCKS,
    ultCharge: 0,
    damageDealt: 0,
    koCount: 0,
    animState: 'idle',
    animTimer: 0,
    animDuration: 0,
    comboStep: 0,
    comboResetTimer: 0,
    hasHitCurrentMove: false,
    specialCooldown: 0,
    tauntCooldown: 0,
    hitFlashTimer: 0,
    hitstunTimer: 0,
    stunTimer: 0,
    invulnTimer: 0,
    slowTimer: 0,
    confuseTimer: 0,
    poisonTimer: 0,
    poisonTickTimer: 0,
    poisonSourceSlot: null,
    counterTimer: 0,
    shieldTimer: 0,
    speedBoostTimer: 0,
    squashX: 1,
    squashY: 1,
    aiDecisionTimer: 0.15,
    aiDesiredAction: 'approach',
  };
}

function createInitialEngineState(
  phase: GamePhase,
  mode: PlayMode,
  mapId: MapId,
  p1Id: FighterId,
  p2Id: FighterId
): GameEngineState {
  return {
    phase,
    mode,
    mapId,
    matchTime: 0,
    ambientTime: 0,
    hitstopTimer: 0,
    shakeIntensity: 0,
    lightningFlash: 0,
    windForceX: 0,
    winnerSlot: null,
    nextEntityId: 1,
    players: [
      createFighter(0, p1Id, false, mapId),
      createFighter(1, p2Id, mode === '1P_AI', mapId),
    ],
    platforms: createMapPlatforms(mapId),
    obstacles: createMapObstacles(mapId),
    destructibles: createMapDestructibles(mapId),
    projectiles: [],
    zones: [],
    timedActions: [],
    particles: createParticlePool(200),
    slashes: [],
  };
}

function buildHudSnapshot(state: GameEngineState): HudSnapshot {
  return {
    phase: state.phase,
    mode: state.mode,
    mapId: state.mapId,
    matchTime: Math.floor(state.matchTime),
    winnerSlot: state.winnerSlot,
    players: [
      {
        slot: 0,
        id: state.players[0].id,
        name: FIGHTER_SPECS[state.players[0].id].name,
        isAi: state.players[0].isAi,
        hp: Math.max(0, Math.ceil(state.players[0].hp)),
        maxHp: state.players[0].maxHp,
        stocks: state.players[0].stocks,
        ultCharge: Math.floor(state.players[0].ultCharge),
        animState: state.players[0].animState,
        poisoned: state.players[0].poisonTimer > 0,
        stunned: state.players[0].stunTimer > 0,
        slowed: state.players[0].slowTimer > 0,
        confused: state.players[0].confuseTimer > 0,
        x: Math.round(state.players[0].x),
        y: Math.round(state.players[0].y),
        damageDealt: Math.round(state.players[0].damageDealt),
        koCount: state.players[0].koCount,
      },
      {
        slot: 1,
        id: state.players[1].id,
        name: FIGHTER_SPECS[state.players[1].id].name,
        isAi: state.players[1].isAi,
        hp: Math.max(0, Math.ceil(state.players[1].hp)),
        maxHp: state.players[1].maxHp,
        stocks: state.players[1].stocks,
        ultCharge: Math.floor(state.players[1].ultCharge),
        animState: state.players[1].animState,
        poisoned: state.players[1].poisonTimer > 0,
        stunned: state.players[1].stunTimer > 0,
        slowed: state.players[1].slowTimer > 0,
        confused: state.players[1].confuseTimer > 0,
        x: Math.round(state.players[1].x),
        y: Math.round(state.players[1].y),
        damageDealt: Math.round(state.players[1].damageDealt),
        koCount: state.players[1].koCount,
      },
    ],
  };
}

function formatAnimLabel(anim: AnimState): string {
  switch (anim) {
    case 'attack1':
      return 'Attack 1';
    case 'attack2':
      return 'Attack 2';
    case 'attack3':
      return 'Attack 3';
    case 'special':
      return 'Special';
    case 'ultimate':
      return 'Ultimate';
    case 'recovery':
      return 'Recovery';
    case 'hitstun':
      return 'Hitstun';
    case 'stunned':
      return 'Stunned';
    case 'taunt':
      return 'Taunt';
    case 'victory':
      return 'Victory';
    case 'ko':
      return 'KO';
    case 'run':
      return 'Run';
    case 'jump':
      return 'Jump';
    case 'fall':
      return 'Fall';
    default:
      return 'Idle';
  }
}

const EMPTY_REPLAY_INPUT: ReplayInputState = {
  moveDir: 0,
  jump: false,
  down: false,
  action: null,
};

function captureReplayFrame(
  state: GameEngineState,
  inputs: [ReplayInputState, ReplayInputState],
  overrideTime?: number
): ReplayFrame {
  const activeParticles: ParticleEntity[] = [];
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    if (p.active) {
      activeParticles.push({ ...p });
    }
  }
  return {
    matchTime: overrideTime ?? state.matchTime,
    ambientTime: state.ambientTime,
    shakeIntensity: state.shakeIntensity,
    lightningFlash: state.lightningFlash,
    windForceX: state.windForceX,
    players: [{ ...state.players[0] }, { ...state.players[1] }],
    inputs: [{ ...inputs[0] }, { ...inputs[1] }],
    platforms: state.platforms.map((p) => ({
      ...p,
      motion: p.motion ? { ...p.motion } : undefined,
      scars: p.scars ? [...p.scars] : undefined,
    })),
    obstacles: state.obstacles.map((o) => ({
      ...o,
      hitCooldowns: [o.hitCooldowns[0], o.hitCooldowns[1]],
    })),
    destructibles: state.destructibles.map((d) => ({ ...d })),
    projectiles: state.projectiles.map((p) => ({ ...p })),
    zones: state.zones.map((z) => ({
      ...z,
      hitTimers: [z.hitTimers[0], z.hitTimers[1]],
    })),
    slashes: state.slashes.map((s) => ({ ...s })),
    activeParticles,
  };
}

function applyReplayFrame(state: GameEngineState, frame: ReplayFrame): void {
  state.matchTime = frame.matchTime;
  state.ambientTime = frame.ambientTime;
  state.shakeIntensity = frame.shakeIntensity;
  state.lightningFlash = frame.lightningFlash;
  state.windForceX = frame.windForceX;
  state.players = [{ ...frame.players[0] }, { ...frame.players[1] }];
  state.platforms = frame.platforms.map((p) => ({
    ...p,
    motion: p.motion ? { ...p.motion } : undefined,
    scars: p.scars ? [...p.scars] : undefined,
  }));
  state.obstacles = frame.obstacles.map((o) => ({
    ...o,
    hitCooldowns: [o.hitCooldowns[0], o.hitCooldowns[1]],
  }));
  state.destructibles = frame.destructibles.map((d) => ({ ...d }));
  state.projectiles = frame.projectiles.map((p) => ({ ...p }));
  state.zones = frame.zones.map((z) => ({
    ...z,
    hitTimers: [z.hitTimers[0], z.hitTimers[1]],
  }));
  state.slashes = frame.slashes.map((s) => ({ ...s }));

  for (let i = 0; i < state.particles.length; i++) {
    if (i < frame.activeParticles.length) {
      state.particles[i] = { ...frame.activeParticles[i], active: true };
    } else {
      state.particles[i].active = false;
    }
  }
}

function formatReplayInputBadges(inp: ReplayInputState): string[] {
  const tags: string[] = [];
  if (inp.moveDir < 0) tags.push('←');
  else if (inp.moveDir > 0) tags.push('→');
  if (inp.jump) tags.push('JMP');
  if (inp.down) tags.push('DRP');
  if (inp.action === 'combo' || inp.action === 'attack1' || inp.action === 'attack2' || inp.action === 'attack3') {
    tags.push('ATK');
  } else if (inp.action === 'special') tags.push('SPC');
  else if (inp.action === 'recovery') tags.push('REC');
  else if (inp.action === 'ultimate') tags.push('ULT');
  else if (inp.action === 'taunt') tags.push('TNT');
  return tags;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [selectedMode, setSelectedMode] = useState<PlayMode>('1P_AI');
  const [selectedMap, setSelectedMap] = useState<MapId>('hive_canopy');
  const [p1Fighter, setP1Fighter] = useState<FighterId>('honey_shell');
  const [p2Fighter, setP2Fighter] = useState<FighterId>('spidra');
  const [muted, setMuted] = useState(false);

  const { scoreboard, recordMatchResult, resetScoreboard } = usePersistentScoreboard();
  const recordMatchResultRef = useRef(recordMatchResult);
  recordMatchResultRef.current = recordMatchResult;
  const matchRecordedRef = useRef<boolean>(false);

  const engineRef = useRef<GameEngineState>(
    createInitialEngineState('TITLE_MENU', '1P_AI', 'hive_canopy', 'honey_shell', 'spidra')
  );

  const heldKeysRef = useRef<Set<string>>(new Set());
  const justPressedRef = useRef<Set<string>>(new Set());

  const [hud, setHud] = useState<HudSnapshot>(() => buildHudSnapshot(engineRef.current));
  const lastHudSyncRef = useRef<number>(0);

  const frameInputsRef = useRef<[ReplayInputState, ReplayInputState]>([
    { ...EMPTY_REPLAY_INPUT },
    { ...EMPTY_REPLAY_INPUT },
  ]);
  const replayFramesRef = useRef<ReplayFrame[]>([]);
  const victoryRecordTailRef = useRef<number>(0);
  const preReplayFrameRef = useRef<ReplayFrame | null>(null);
  const replayKoOffsetsRef = useRef<number[]>([]);
  const replayPlayingRef = useRef<boolean>(false);
  const replaySpeedRef = useRef<0.5 | 1 | 2>(1);
  const replayElapsedRef = useRef<number>(0);

  const [replayAvailable, setReplayAvailable] = useState(false);
  const [replayDurationSec, setReplayDurationSec] = useState(0);
  const [replayHud, setReplayHud] = useState<ReplayHudState>({
    playing: false,
    speed: 1,
    elapsed: 0,
    duration: 0,
    frameIndex: 0,
    totalFrames: 0,
    inputs: [{ ...EMPTY_REPLAY_INPUT }, { ...EMPTY_REPLAY_INPUT }],
    koOffsets: [],
  });

  const syncHudImmediate = useCallback(() => {
    setHud(buildHudSnapshot(engineRef.current));
  }, []);

  const syncReplayUi = useCallback((frameIdx: number) => {
    const frames = replayFramesRef.current;
    if (frames.length === 0) return;
    const startT = frames[0].matchTime;
    const endT = frames[frames.length - 1].matchTime;
    const duration = Math.max(0.016, endT - startT);
    const clampedIdx = Math.max(0, Math.min(frames.length - 1, frameIdx));
    const frame = frames[clampedIdx];
    setReplayHud({
      playing: replayPlayingRef.current,
      speed: replaySpeedRef.current,
      elapsed: Math.min(duration, Math.max(0, replayElapsedRef.current)),
      duration,
      frameIndex: clampedIdx,
      totalFrames: frames.length,
      inputs: [{ ...frame.inputs[0] }, { ...frame.inputs[1] }],
      koOffsets: replayKoOffsetsRef.current,
    });
  }, []);

  const spawnParticle = useCallback(
    (
      x: number,
      y: number,
      vx: number,
      vy: number,
      size: number,
      color: string,
      maxLife: number,
      gravity = 320,
      shape: ParticleEntity['shape'] = 'circle'
    ) => {
      const pool = engineRef.current.particles;
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].active) {
          pool[i].active = true;
          pool[i].x = x;
          pool[i].y = y;
          pool[i].vx = vx;
          pool[i].vy = vy;
          pool[i].size = size;
          pool[i].color = color;
          pool[i].alpha = 1;
          pool[i].life = maxLife;
          pool[i].maxLife = maxLife;
          pool[i].gravity = gravity;
          pool[i].shape = shape;
          return;
        }
      }
    },
    []
  );

  const startMatch = useCallback(() => {
    soundSynth.playUiClick();
    matchRecordedRef.current = false;
    const next = createInitialEngineState(
      'PLAYING',
      selectedMode,
      selectedMap,
      p1Fighter,
      p2Fighter
    );
    engineRef.current = next;
    replayFramesRef.current = [];
    victoryRecordTailRef.current = 0;
    preReplayFrameRef.current = null;
    replayKoOffsetsRef.current = [];
    replayPlayingRef.current = false;
    replayElapsedRef.current = 0;
    setReplayAvailable(false);
    setReplayDurationSec(0);
    justPressedRef.current.clear();
    syncHudImmediate();
  }, [p1Fighter, p2Fighter, selectedMap, selectedMode, syncHudImmediate]);

  const rematchMatch = useCallback(() => {
    soundSynth.playUiClick();
    matchRecordedRef.current = false;
    const prev = engineRef.current;
    const next = createInitialEngineState(
      'PLAYING',
      prev.mode,
      prev.mapId,
      prev.players[0].id,
      prev.players[1].id
    );
    engineRef.current = next;
    replayFramesRef.current = [];
    victoryRecordTailRef.current = 0;
    preReplayFrameRef.current = null;
    replayKoOffsetsRef.current = [];
    replayPlayingRef.current = false;
    replayElapsedRef.current = 0;
    setReplayAvailable(false);
    setReplayDurationSec(0);
    justPressedRef.current.clear();
    syncHudImmediate();
  }, [syncHudImmediate]);

  const startReplay = useCallback(() => {
    const frames = replayFramesRef.current;
    if (frames.length < 2) return;
    soundSynth.playUiClick();

    if (engineRef.current.phase === 'GAME_OVER') {
      preReplayFrameRef.current = captureReplayFrame(engineRef.current, [
        { ...EMPTY_REPLAY_INPUT },
        { ...EMPTY_REPLAY_INPUT },
      ]);
    }

    const startT = frames[0].matchTime;
    const endT = frames[frames.length - 1].matchTime;
    const duration = Math.max(0.016, endT - startT);
    const koOffsets: number[] = [];
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];
      if (
        curr.players[0].stocks < prev.players[0].stocks ||
        curr.players[1].stocks < prev.players[1].stocks
      ) {
        koOffsets.push(Math.min(1, Math.max(0, (curr.matchTime - startT) / duration)));
      }
    }
    replayKoOffsetsRef.current = koOffsets;
    replayElapsedRef.current = 0;
    replaySpeedRef.current = 1;
    replayPlayingRef.current = true;

    engineRef.current.phase = 'REPLAY';
    applyReplayFrame(engineRef.current, frames[0]);
    syncHudImmediate();
    syncReplayUi(0);
  }, [syncHudImmediate, syncReplayUi]);

  const exitReplay = useCallback(() => {
    soundSynth.playUiClick();
    replayPlayingRef.current = false;
    engineRef.current.phase = 'GAME_OVER';
    if (preReplayFrameRef.current) {
      applyReplayFrame(engineRef.current, preReplayFrameRef.current);
    } else if (replayFramesRef.current.length > 0) {
      applyReplayFrame(
        engineRef.current,
        replayFramesRef.current[replayFramesRef.current.length - 1]
      );
    }
    syncHudImmediate();
  }, [syncHudImmediate]);

  const toggleReplayPlay = useCallback(() => {
    const frames = replayFramesRef.current;
    if (frames.length < 2) return;
    soundSynth.playUiClick();
    const duration = Math.max(
      0.016,
      frames[frames.length - 1].matchTime - frames[0].matchTime
    );
    if (!replayPlayingRef.current && replayElapsedRef.current >= duration - 0.02) {
      replayElapsedRef.current = 0;
      applyReplayFrame(engineRef.current, frames[0]);
      replayPlayingRef.current = true;
      syncHudImmediate();
      syncReplayUi(0);
      return;
    }
    replayPlayingRef.current = !replayPlayingRef.current;
    syncReplayUi(replayHud.frameIndex);
  }, [replayHud.frameIndex, syncHudImmediate, syncReplayUi]);

  const restartReplay = useCallback(() => {
    const frames = replayFramesRef.current;
    if (frames.length < 2) return;
    soundSynth.playUiClick();
    replayElapsedRef.current = 0;
    replayPlayingRef.current = true;
    applyReplayFrame(engineRef.current, frames[0]);
    syncHudImmediate();
    syncReplayUi(0);
  }, [syncHudImmediate, syncReplayUi]);

  const cycleReplaySpeed = useCallback(() => {
    soundSynth.playUiClick();
    const next: 0.5 | 1 | 2 =
      replaySpeedRef.current === 1 ? 2 : replaySpeedRef.current === 2 ? 0.5 : 1;
    replaySpeedRef.current = next;
    syncReplayUi(replayHud.frameIndex);
  }, [replayHud.frameIndex, syncReplayUi]);

  const scrubReplay = useCallback(
    (fraction: number) => {
      const frames = replayFramesRef.current;
      if (frames.length < 2) return;
      const clamped = Math.max(0, Math.min(1, fraction));
      const startT = frames[0].matchTime;
      const duration = Math.max(0.016, frames[frames.length - 1].matchTime - startT);
      replayElapsedRef.current = clamped * duration;
      const targetT = startT + replayElapsedRef.current;

      let lo = 0;
      let hi = frames.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (frames[mid].matchTime <= targetT) lo = mid;
        else hi = mid - 1;
      }

      applyReplayFrame(engineRef.current, frames[lo]);
      syncHudImmediate();
      syncReplayUi(lo);
    },
    [syncHudImmediate, syncReplayUi]
  );

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (engine.phase === 'PLAYING') {
      engine.phase = 'PAUSED';
      soundSynth.playUiClick();
      syncHudImmediate();
    } else if (engine.phase === 'PAUSED') {
      engine.phase = 'PLAYING';
      soundSynth.playUiClick();
      syncHudImmediate();
    }
  }, [syncHudImmediate]);

  const returnToTitle = useCallback(() => {
    soundSynth.playUiClick();
    matchRecordedRef.current = false;
    replayFramesRef.current = [];
    replayPlayingRef.current = false;
    setReplayAvailable(false);
    engineRef.current = createInitialEngineState(
      'TITLE_MENU',
      selectedMode,
      selectedMap,
      p1Fighter,
      p2Fighter
    );
    syncHudImmediate();
  }, [p1Fighter, p2Fighter, selectedMap, selectedMode, syncHudImmediate]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundSynth.setMuted(next);
      if (!next) soundSynth.playUiClick();
      return next;
    });
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine.phase === 'TITLE_MENU') {
      engine.mode = selectedMode;
      engine.mapId = selectedMap;
      engine.platforms = createMapPlatforms(selectedMap);
      engine.obstacles = createMapObstacles(selectedMap);
      engine.destructibles = createMapDestructibles(selectedMap);
      engine.players[0] = createFighter(0, p1Fighter, false, selectedMap);
      engine.players[1] = createFighter(1, p2Fighter, true, selectedMap);
      engine.projectiles = [];
      engine.zones = [];
      engine.timedActions = [];
      engine.slashes = [];
      syncHudImmediate();
    }
  }, [p1Fighter, p2Fighter, selectedMap, selectedMode, syncHudImmediate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        code === 'Space' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      if (code === 'Escape') {
        const phase = engineRef.current.phase;
        if (phase === 'PLAYING' || phase === 'PAUSED') {
          togglePause();
        } else if (phase === 'REPLAY') {
          exitReplay();
        }
        return;
      }

      if (code === 'KeyM') {
        toggleMute();
        return;
      }

      if (engineRef.current.phase === 'REPLAY' && code === 'Space') {
        toggleReplayPlay();
        return;
      }

      if (engineRef.current.phase === 'TITLE_MENU' && (code === 'Enter' || code === 'Space')) {
        startMatch();
        return;
      }

      if (engineRef.current.phase === 'GAME_OVER' && code === 'Enter') {
        rematchMatch();
        return;
      }

      if (!heldKeysRef.current.has(code)) {
        justPressedRef.current.add(code);
      }
      heldKeysRef.current.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.code);
    };

    const handleBlur = () => {
      heldKeysRef.current.clear();
      justPressedRef.current.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [exitReplay, rematchMatch, startMatch, toggleMute, togglePause, toggleReplayPlay]);

  // 2D HTML5 Canvas Game Engine Loop inside App
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let canvasPixelWidth = container.clientWidth;
    let canvasPixelHeight = container.clientHeight;

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      canvasPixelWidth = Math.max(320, Math.floor(rect.width));
      canvasPixelHeight = Math.max(240, Math.floor(rect.height));
      canvas.width = Math.floor(canvasPixelWidth * dpr);
      canvas.height = Math.floor(canvasPixelHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);

    const isAttackAnim = (anim: AnimState) =>
      anim === 'attack1' ||
      anim === 'attack2' ||
      anim === 'attack3' ||
      anim === 'special' ||
      anim === 'ultimate' ||
      anim === 'recovery';

    const distToSegment = (
      px: number,
      py: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ): number => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq <= 0.0001) return Math.hypot(px - x1, py - y1);
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    };

    const findSurfaceYBelow = (x: number, refY: number): number => {
      const plats = engineRef.current.platforms;
      let bestY = plats[0].y;
      let bestDist = Infinity;
      for (const plat of plats) {
        if (plat.broken) continue;
        if (x >= plat.x - 10 && x <= plat.x + plat.width + 10) {
          const d = Math.abs(plat.y - refY);
          if (plat.y >= refY - 25 && d < bestDist) {
            bestDist = d;
            bestY = plat.y;
          }
        }
      }
      return bestY;
    };

    const spawnHoneyPuddle = (x: number, y: number, ownerSlot: 0 | 1) => {
      const state = engineRef.current;
      state.zones.push({
        id: state.nextEntityId++,
        ownerSlot,
        kind: 'honey_puddle',
        x,
        y,
        width: 124,
        height: 18,
        targetHeight: 18,
        life: 3.8,
        maxLife: 3.8,
        damage: 4,
        knockbackX: 0,
        knockbackY: 0,
        appliesStun: 0,
        appliesPoison: 3.5,
        appliesSlow: 2.2,
        blocksProjectiles: false,
        hitTimers: [0, 0],
      });
      for (let i = 0; i < 10; i++) {
        spawnParticle(
          x + (Math.random() - 0.5) * 60,
          y - 4,
          (Math.random() - 0.5) * 140,
          -60 - Math.random() * 110,
          5,
          i % 2 === 0 ? '#A855F7' : '#FBBF24',
          0.35,
          360,
          'drip'
        );
      }
    };

    const addFloorScar = (plat: Platform, worldX: number) => {
      if (plat.passThrough || !plat.scars) return;
      const offset = Math.max(24, Math.min(plat.width - 24, worldX - plat.x));
      if (plat.scars.some((s) => Math.abs(s - offset) < 20)) return;
      plat.scars.push(offset);
      if (plat.scars.length > 6) {
        plat.scars.shift();
      }
    };

    const damagePlatform = (plat: Platform, dmg: number, impactX: number, debrisColor: string) => {
      if (!plat.destructible || plat.broken || plat.hp === undefined || plat.maxHp === undefined) {
        return;
      }
      const state = engineRef.current;
      plat.hp = Math.max(0, plat.hp - dmg);
      plat.shakeTimer = 0.14;

      if (plat.hp <= 0) {
        plat.broken = true;
        plat.respawnTimer = 8.5;
        soundSynth.playStructureBreak();
        state.shakeIntensity = Math.max(state.shakeIntensity, 8);

        for (const f of state.players) {
          if (
            f.grounded &&
            Math.abs(f.y - plat.y) < 8 &&
            f.x + f.width * 0.3 >= plat.x &&
            f.x - f.width * 0.3 <= plat.x + plat.width
          ) {
            f.grounded = false;
          }
        }

        const cx = plat.x + plat.width * 0.5;
        const cy = plat.y + plat.height * 0.5;
        spawnParticle(cx, cy, 0, 0, 48, debrisColor, 0.28, 0, 'ring');
        for (let i = 0; i < 16; i++) {
          const px = plat.x + Math.random() * plat.width;
          spawnParticle(
            px,
            cy,
            (Math.random() - 0.5) * 260,
            -90 - Math.random() * 190,
            5 + Math.random() * 4,
            i % 2 === 0 ? debrisColor : '#CBD5E1',
            0.48,
            520,
            'spark'
          );
        }
      } else {
        soundSynth.playCrackHit();
        for (let i = 0; i < 5; i++) {
          spawnParticle(
            Math.max(plat.x + 8, Math.min(plat.x + plat.width - 8, impactX)),
            plat.y + plat.height * 0.5,
            (Math.random() - 0.5) * 160,
            -70 - Math.random() * 100,
            3.5,
            debrisColor,
            0.28,
            420,
            'spark'
          );
        }
      }
    };

    const getPropAccentColor = (kind: DestructiblePropRuntime['kind']): string => {
      switch (kind) {
        case 'honey_vat':
          return '#FBBF24';
        case 'storm_pylon':
          return '#38BDF8';
        case 'magma_crystal':
          return '#FB923C';
        case 'windmill_crate':
          return '#2DD4BF';
        case 'neon_beacon':
          return '#22D3EE';
        case 'frost_crystal':
          return '#7DD3FC';
        case 'steam_boiler':
          return '#F59E0B';
        case 'coral_pod':
          return '#22D3EE';
        case 'plasma_cell':
          return '#C084FC';
        default:
          return '#FAFAFA';
      }
    };

    const triggerMove = (f: FighterEntity, moveKey: MoveKey, aimDir = 0) => {
      const spec = FIGHTER_SPECS[f.id];
      const move = spec.moves[moveKey];

      if (moveKey === 'special' && f.specialCooldown > 0) return;
      if (moveKey === 'ultimate' && f.ultCharge < 100) return;
      if (moveKey === 'recovery' && f.recoveryUsed) return;

      f.animState = moveKey;
      f.animTimer = 0;
      f.animDuration = move.duration;
      f.hasHitCurrentMove = false;

      if (moveKey === 'recovery') {
        f.recoveryUsed = true;
        f.grounded = false;
        soundSynth.playRecovery();
        const steer = aimDir !== 0 ? aimDir : f.facing;
        f.facing = steer > 0 ? 1 : -1;
        f.vx = steer * (move.selfVx ?? 180);
        f.vy = move.selfVy ?? -760;

        for (let i = 0; i < 10; i++) {
          spawnParticle(
            f.x + (Math.random() - 0.5) * 30,
            f.y - 20,
            (Math.random() - 0.5) * 120,
            80 + Math.random() * 140,
            5,
            spec.accentColor,
            0.32,
            180
          );
        }
      } else if (moveKey === 'special') {
        f.specialCooldown = f.id === 'eve' ? 1.05 : f.id === 'moss_golem' ? 1.15 : f.id === 'blade_zero' ? 1.1 : 0.95;
        if (f.id === 'blade_zero') {
          f.counterTimer = 0.52;
          soundSynth.playStun();
        } else if (f.id === 'moss_golem') {
          f.shieldTimer = 1.25;
          soundSynth.playCloudWall();
        } else if (f.id === 'cloudier') {
          soundSynth.playCloudWall();
        } else if (f.id === 'eve') {
          soundSynth.playChargeTelegraph();
        } else if (f.id === 'spidra') {
          soundSynth.playTvBlare();
        } else if (f.id === 'marshal_bolt' || f.id === 'astro_pip') {
          soundSynth.playLaserShot();
        } else if (f.id === 'pyro_jack') {
          soundSynth.playSpecial(false);
        } else {
          soundSynth.playSpecial(true);
        }
      } else if (moveKey === 'ultimate') {
        f.ultCharge = 0;
        f.invulnTimer = Math.max(f.invulnTimer, 0.5);
        engineRef.current.shakeIntensity = 12;
        if (f.id === 'honey_shell') {
          f.hp = Math.min(f.maxHp, f.hp + 45);
          spawnParticle(f.x, f.y - f.height * 0.5, 0, 0, 48, '#22C55E', 0.36, 0, 'ring');
          for (let h = 0; h < 12; h++) {
            spawnParticle(
              f.x + (Math.random() - 0.5) * 44,
              f.y - 10 - Math.random() * 60,
              (Math.random() - 0.5) * 60,
              -80 - Math.random() * 90,
              5,
              h % 2 === 0 ? '#4ADE80' : '#FDE047',
              0.48,
              -40,
              'spark'
            );
          }
        } else if (f.id === 'astro_pip') {
          f.speedBoostTimer = 3.0;
          engineRef.current.lightningFlash = 0.7;
        } else if (f.id === 'cloudier') {
          engineRef.current.lightningFlash = 1;
        }
        soundSynth.playUltimate();
      } else {
        soundSynth.playAttack(moveKey === 'attack3');
      }

      if (moveKey !== 'recovery') {
        if (move.selfVx) {
          f.vx = f.facing * move.selfVx;
        }
        if (move.selfVy) {
          f.vy = move.selfVy;
          f.grounded = false;
        }
      }

      if (moveKey === 'attack2' || moveKey === 'recovery') {
        f.squashX = 0.84;
        f.squashY = 1.22;
      } else if (moveKey === 'attack3' || moveKey === 'ultimate') {
        f.squashX = 1.2;
        f.squashY = 0.84;
      } else {
        f.squashX = 1.12;
        f.squashY = 0.9;
      }
    };

    const triggerTaunt = (f: FighterEntity) => {
      if (f.tauntCooldown > 0) return;
      f.animState = 'taunt';
      f.animTimer = 0;
      f.animDuration = 0.58;
      f.tauntCooldown = 2.8;
      f.vx *= 0.25;
      f.squashX = 1.12;
      f.squashY = 0.88;
      soundSynth.playTaunt(f.id);
    };

    const spawnMoveEffects = (f: FighterEntity, moveKey: MoveKey) => {
      const state = engineRef.current;
      const spec = FIGHTER_SPECS[f.id];
      const move = spec.moves[moveKey];

      if (
        moveKey === 'special' &&
        (f.id === 'honey_shell' ||
          f.id === 'cloudier' ||
          f.id === 'marshal_bolt' ||
          f.id === 'pyro_jack' ||
          f.id === 'aqua_nyx' ||
          f.id === 'blade_zero' ||
          f.id === 'astro_pip')
      ) {
        if (f.id === 'honey_shell') {
          const opp = state.players[f.slot === 0 ? 1 : 0];
          const dx = opp.x - f.x;
          const closeDrop = Math.abs(dx) < 160 && Math.sign(dx) === f.facing;
          state.projectiles.push({
            id: state.nextEntityId++,
            ownerSlot: f.slot,
            fighterId: f.id,
            kind: 'venom_honey_drop',
            x: f.x + f.facing * 24,
            y: f.y - 82,
            vx: closeDrop ? dx * 1.65 : f.facing * 310,
            vy: closeDrop ? -340 : -370,
            radius: 15,
            damage: move.baseDamage,
            knockbackX: move.knockbackX,
            knockbackY: move.knockbackY,
            gravity: 980,
            life: 2.0,
            maxLife: 2.0,
            appliesPoison: move.appliesPoison ?? 4.5,
            appliesSlow: move.appliesSlow ?? 2.4,
            spawnsPuddleOnLand: true,
            rotation: 0,
          });
        } else if (f.id === 'marshal_bolt') {
          // Deadeye Lasso Shot: electrified bolt that stuns and pulls hit opponent inward!
          state.projectiles.push({
            id: state.nextEntityId++,
            ownerSlot: f.slot,
            fighterId: f.id,
            kind: 'cuff_bolt',
            x: f.x + f.facing * 34,
            y: f.y - 54,
            vx: f.facing * 720,
            vy: 0,
            radius: 14,
            damage: move.baseDamage,
            knockbackX: move.knockbackX,
            knockbackY: move.knockbackY,
            gravity: 0,
            life: 1.05,
            maxLife: 1.05,
            appliesPoison: 0,
            appliesSlow: 0,
            appliesStun: move.appliesStun ?? 0.85,
            pullOnHit: true,
            spawnsPuddleOnLand: false,
            rotation: 0,
          });
          state.slashes.push({
            x: f.x + f.facing * 38,
            y: f.y - 54,
            facing: f.facing,
            color: spec.accentColor,
            width: 56,
            height: 36,
            life: 0.18,
            maxLife: 0.18,
            kind: 'deadeye_shot',
          });
        } else if (f.id === 'pyro_jack') {
          // Ember Bomb: arcing explosive bomb with 115px blast radius on hit or landing!
          state.projectiles.push({
            id: state.nextEntityId++,
            ownerSlot: f.slot,
            fighterId: f.id,
            kind: 'ember_bomb',
            x: f.x + f.facing * 28,
            y: f.y - 68,
            vx: f.facing * 430,
            vy: -410,
            radius: 16,
            damage: move.baseDamage,
            knockbackX: move.knockbackX,
            knockbackY: move.knockbackY,
            gravity: 980,
            life: 2.0,
            maxLife: 2.0,
            appliesPoison: 0,
            appliesSlow: 0,
            explodeRadius: 115,
            spawnsPuddleOnLand: false,
            rotation: 0,
          });
        } else if (f.id === 'aqua_nyx') {
          // Bubble Prison: slow floating bubble that traps & launches victim high upward!
          state.projectiles.push({
            id: state.nextEntityId++,
            ownerSlot: f.slot,
            fighterId: f.id,
            kind: 'bubble_orb',
            x: f.x + f.facing * 32,
            y: f.y - 52,
            vx: f.facing * 290,
            vy: -20,
            radius: 21,
            damage: move.baseDamage,
            knockbackX: move.knockbackX,
            knockbackY: move.knockbackY,
            gravity: 0,
            life: 2.1,
            maxLife: 2.1,
            appliesPoison: 0,
            appliesSlow: move.appliesSlow ?? 3.2,
            appliesStun: move.appliesStun ?? 0.9,
            floatTrap: true,
            spawnsPuddleOnLand: false,
            rotation: 0,
          });
        } else if (f.id === 'blade_zero') {
          // Shadow Counter Stance already activated in triggerMove — emit blade glint
          spawnParticle(f.x, f.y - f.height * 0.5, 0, 0, 44, '#EF4444', 0.25, 0, 'ring');
        } else if (f.id === 'astro_pip') {
          // Ricochet Star: bounces up to 3 times off arena walls, ceiling, and platforms!
          state.projectiles.push({
            id: state.nextEntityId++,
            ownerSlot: f.slot,
            fighterId: f.id,
            kind: 'nova_star',
            x: f.x + f.facing * 30,
            y: f.y - 48,
            vx: f.facing * 640,
            vy: -220,
            radius: 15,
            damage: move.baseDamage,
            knockbackX: move.knockbackX,
            knockbackY: move.knockbackY,
            gravity: 0,
            life: 2.4,
            maxLife: 2.4,
            appliesPoison: 0,
            appliesSlow: 0,
            bouncesLeft: 3,
            spawnsPuddleOnLand: false,
            rotation: 0,
          });
        } else {
          // Cloudier's Cumulus Wall
          const wallX = f.x + f.facing * move.offsetX;
          const surfaceY = findSurfaceYBelow(wallX, f.y);
          state.zones.push({
            id: state.nextEntityId++,
            ownerSlot: f.slot,
            kind: 'cloud_wall',
            x: wallX,
            y: surfaceY,
            width: move.rangeX,
            height: 24,
            targetHeight: move.rangeY,
            life: 1.5,
            maxLife: 1.5,
            damage: move.baseDamage,
            knockbackX: move.knockbackX,
            knockbackY: move.knockbackY,
            appliesStun: move.appliesStun ?? 1.25,
            appliesPoison: 0,
            appliesSlow: 0,
            blocksProjectiles: true,
            hitTimers: [0, 0],
          });
          state.shakeIntensity = Math.max(state.shakeIntensity, 7);
          for (let i = 0; i < 12; i++) {
            spawnParticle(
              wallX + (Math.random() - 0.5) * 48,
              surfaceY - 10,
              (Math.random() - 0.5) * 120,
              -140 - Math.random() * 180,
              6 + Math.random() * 5,
              i % 2 === 0 ? '#E0F2FE' : '#38BDF8',
              0.38,
              200
            );
          }
        }
        return;
      }

      if (moveKey === 'special' && f.id === 'eve') {
        soundSynth.playAttack(true);
        state.shakeIntensity = Math.max(state.shakeIntensity, 9);
      } else if (moveKey === 'special' && f.id === 'moss_golem') {
        soundSynth.playStructureBreak();
        state.shakeIntensity = Math.max(state.shakeIntensity, 7);
        spawnParticle(f.x, f.y - f.height * 0.5, 0, 0, 56, '#A3E635', 0.3, 0, 'ring');
      } else if (moveKey === 'special' && f.id === 'spidra') {
        for (let i = 0; i < 10; i++) {
          spawnParticle(
            f.x + f.facing * (34 + Math.random() * 50),
            f.y - 46 + (Math.random() - 0.5) * 44,
            f.facing * (120 + Math.random() * 140),
            (Math.random() - 0.5) * 140,
            4 + Math.random() * 3,
            i % 2 === 0 ? '#10B981' : '#F43F5E',
            0.28,
            0,
            'spark'
          );
        }
      }

      state.slashes.push({
        x: f.x + (move.isAreaAround ? 0 : f.facing * move.offsetX),
        y: f.y + move.offsetY,
        facing: f.facing,
        color: spec.accentColor,
        width: move.rangeX,
        height: move.rangeY,
        life: moveKey === 'ultimate' ? 0.38 : moveKey === 'special' ? 0.28 : 0.2,
        maxLife: moveKey === 'ultimate' ? 0.38 : moveKey === 'special' ? 0.28 : 0.2,
        kind: move.slashKind,
      });

      if (moveKey === 'ultimate') {
        const opp = state.players[f.slot === 0 ? 1 : 0];
        if (f.id === 'honey_shell') {
          // Royal Hornet Barrage: healed +45 HP on activation; launch 5 staggered homing hornet bolts
          const delays = [0.06, 0.14, 0.22, 0.3, 0.38];
          const vels = [
            { vx: -360, vy: -260 },
            { vx: 360, vy: -260 },
            { vx: -460, vy: -120 },
            { vx: 460, vy: -120 },
            { vx: f.facing * 420, vy: -320 },
          ];
          delays.forEach((delay, idx) => {
            state.timedActions.push({
              timer: delay,
              ownerSlot: f.slot,
              kind: 'hornet_stinger',
              x: f.x + (idx % 2 === 0 ? -24 : 24),
              y: f.y - 68,
              vx: vels[idx].vx,
              vy: vels[idx].vy,
            });
          });
        } else if (f.id === 'cloudier') {
          // Supercell Pillars: 3 sky-to-ground lightning columns across stage
          const offsets = [-190, 0, 190];
          for (const ox of offsets) {
            const px = Math.max(140, Math.min(WORLD_WIDTH - 140, f.x + ox));
            const surfaceY = findSurfaceYBelow(px, f.y);
            state.zones.push({
              id: state.nextEntityId++,
              ownerSlot: f.slot,
              kind: 'lightning_pillar',
              x: px,
              y: surfaceY,
              width: 66,
              height: 620,
              targetHeight: 620,
              life: 0.65,
              maxLife: 0.65,
              damage: 24,
              knockbackX: ox === 0 ? 320 : Math.sign(ox) * 440,
              knockbackY: -590,
              appliesStun: 1.35,
              appliesPoison: 0,
              appliesSlow: 0,
              blocksProjectiles: false,
              hitTimers: [0, 0],
            });
            for (const plat of state.platforms) {
              if (!plat.broken && px >= plat.x && px <= plat.x + plat.width) {
                if (plat.destructible) {
                  damagePlatform(plat, 42, px, '#38BDF8');
                } else {
                  addFloorScar(plat, px);
                }
              }
            }
          }
        } else if (f.id === 'eve') {
          // Duality Cross-Cut: shadow-blinks beside opponent and schedules 3 giant angled cross slashes!
          const blinkDir: 1 | -1 = opp.x >= f.x ? 1 : -1;
          const targetX = Math.max(150, Math.min(WORLD_WIDTH - 150, opp.x - blinkDir * 72));
          f.x = targetX;
          f.y = Math.min(f.y, opp.y);
          f.facing = blinkDir;
          const angles = [-0.65, 0.65, 0];
          const delays = [0.05, 0.19, 0.33];
          delays.forEach((delay, idx) => {
            state.timedActions.push({
              timer: delay,
              ownerSlot: f.slot,
              kind: 'eve_cross_cut',
              x: opp.x,
              y: opp.y - opp.height * 0.5,
              angle: angles[idx],
              facing: blinkDir,
            });
          });
        } else if (f.id === 'spidra') {
          // Glitch Jammer Field: 2.8s persistent static zone that shocks, slows & confuses inside + 2 side orbs
          const surfaceY = findSurfaceYBelow(f.x, f.y);
          state.zones.push({
            id: state.nextEntityId++,
            ownerSlot: f.slot,
            kind: 'glitch_field',
            x: f.x,
            y: surfaceY,
            width: 260,
            height: 150,
            targetHeight: 150,
            life: 2.8,
            maxLife: 2.8,
            damage: 8,
            knockbackX: 210,
            knockbackY: -180,
            appliesStun: 0,
            appliesPoison: 0,
            appliesSlow: 2.0,
            appliesConfuse: 4.5,
            blocksProjectiles: false,
            hitTimers: [0, 0],
          });
          for (const dirVx of [-560, 560]) {
            state.projectiles.push({
              id: state.nextEntityId++,
              ownerSlot: f.slot,
              fighterId: f.id,
              kind: 'static_orb',
              x: f.x,
              y: f.y - 48,
              vx: dirVx,
              vy: 0,
              radius: 14,
              damage: 14,
              knockbackX: 280,
              knockbackY: -220,
              gravity: 0,
              life: 1.1,
              maxLife: 1.1,
              appliesPoison: 0,
              appliesSlow: 0,
              appliesConfuse: 4.5,
              spawnsPuddleOnLand: false,
              rotation: 0,
            });
          }
        } else if (f.id === 'marshal_bolt') {
          // High-Noon Railgun: targeting lock crosshair for 0.52s, then full-screen piercing sheriff beam!
          const muzzleX = f.x + f.facing * 26;
          const muzzleY = f.y - 54;
          const aimAngle = Math.atan2(opp.y - opp.height * 0.5 - muzzleY, opp.x - muzzleX);
          state.zones.push({
            id: state.nextEntityId++,
            ownerSlot: f.slot,
            kind: 'railgun_beam',
            x: muzzleX,
            y: muzzleY,
            width: 1550,
            height: 48,
            targetHeight: 48,
            life: 0.92,
            maxLife: 0.92,
            telegraphTimer: 0.52,
            angle: aimAngle,
            damage: 38,
            knockbackX: 680,
            knockbackY: -320,
            appliesStun: 0.8,
            appliesPoison: 0,
            appliesSlow: 0,
            blocksProjectiles: false,
            hitTimers: [0, 0],
          });
        } else if (f.id === 'pyro_jack') {
          // Volcano Fountain: 6 staggered magma bombs fanning upward left & right
          const eruptions = [
            { vx: -170, vy: -640 },
            { vx: 170, vy: -640 },
            { vx: -340, vy: -580 },
            { vx: 340, vy: -580 },
            { vx: -510, vy: -500 },
            { vx: 510, vy: -500 },
          ];
          eruptions.forEach((er, idx) => {
            state.timedActions.push({
              timer: 0.08 + idx * 0.08,
              ownerSlot: f.slot,
              kind: 'volcano_bomb',
              x: f.x,
              y: f.y - 68,
              vx: er.vx,
              vy: er.vy,
            });
          });
        } else if (f.id === 'aqua_nyx') {
          // Abyssal Whirlpool: 2.6s vortex that pulls enemies inward & bursts upward on expiry!
          const cx = Math.max(180, Math.min(WORLD_WIDTH - 180, f.x + f.facing * 60));
          const surfaceY = findSurfaceYBelow(cx, f.y);
          state.zones.push({
            id: state.nextEntityId++,
            ownerSlot: f.slot,
            kind: 'whirlpool_zone',
            x: cx,
            y: surfaceY,
            width: 300,
            height: 220,
            targetHeight: 220,
            life: 2.6,
            maxLife: 2.6,
            damage: 6,
            knockbackX: 80,
            knockbackY: -120,
            appliesStun: 0,
            appliesPoison: 0,
            appliesSlow: 2.5,
            blocksProjectiles: false,
            hitTimers: [0, 0],
          });
        } else if (f.id === 'blade_zero') {
          // Judgement Blitz: 5 rapid staggered teleporting multi-angle katana cuts!
          const sliceAngles = [-0.55, 0.65, -0.25, 0.85, 0];
          sliceAngles.forEach((ang, idx) => {
            state.timedActions.push({
              timer: 0.08 + idx * 0.09,
              ownerSlot: f.slot,
              kind: 'katana_slice',
              x: f.x,
              y: f.y - 48,
              angle: ang,
              facing: idx % 2 === 0 ? 1 : -1,
            });
          });
        } else if (f.id === 'moss_golem') {
          // Meteor Monolith: 5 staggered sky boulders crashing down around the opponent and stage!
          const targetXs = [
            Math.max(160, Math.min(WORLD_WIDTH - 160, opp.x - 160)),
            Math.max(160, Math.min(WORLD_WIDTH - 160, opp.x + 160)),
            Math.max(160, Math.min(WORLD_WIDTH - 160, opp.x)),
            Math.max(220, Math.min(WORLD_WIDTH - 220, f.x - 120)),
            Math.max(220, Math.min(WORLD_WIDTH - 220, f.x + 120)),
          ];
          targetXs.forEach((tx, idx) => {
            state.timedActions.push({
              timer: 0.1 + idx * 0.12,
              ownerSlot: f.slot,
              kind: 'sky_boulder',
              x: tx,
              y: -50,
            });
          });
        } else {
          // Astro Pip Starfall Rain: 3.0s speed overdrive + 8 diagonal orbital star meteors!
          for (let k = 0; k < 8; k++) {
            const spawnX = 160 + ((k * 145 + (opp.x - 500) * 0.35 + WORLD_WIDTH) % (WORLD_WIDTH - 320));
            const dirVx = k % 2 === 0 ? 170 : -170;
            state.timedActions.push({
              timer: 0.08 + k * 0.17,
              ownerSlot: f.slot,
              kind: 'orbital_star',
              x: spawnX,
              y: -40,
              vx: dirVx,
              vy: 560,
            });
          }
        }

        const count = 24;
        for (let i = 0; i < count; i++) {
          const ang = (Math.PI * 2 * i) / count;
          const spd = 240 + Math.random() * 240;
          spawnParticle(
            f.x,
            f.y - 46,
            Math.cos(ang) * spd,
            Math.sin(ang) * spd,
            6 + Math.random() * 5,
            i % 2 === 0 ? spec.accentColor : spec.secondaryColor,
            0.45,
            120,
            'spark'
          );
        }
      }
    };

    const applyHit = (
      attacker: FighterEntity | null,
      defender: FighterEntity,
      damageRaw: number,
      kbX: number,
      kbY: number,
      dir: 1 | -1,
      hitstop: number,
      ultGain: number,
      options?: {
        appliesSlow?: number;
        appliesPoison?: number;
        appliesStun?: number;
        appliesConfuse?: number;
        isHazard?: boolean;
      }
    ) => {
      if (defender.invulnTimer > 0 || defender.animState === 'ko') return false;

      // BladeZero Shadow Counter Parry!
      if (defender.counterTimer > 0 && attacker && !options?.isHazard) {
        defender.counterTimer = 0;
        defender.invulnTimer = 0.38;
        const behindX = Math.max(90, Math.min(WORLD_WIDTH - 90, attacker.x - attacker.facing * 72));
        defender.x = behindX;
        defender.y = attacker.y;
        defender.facing = behindX <= attacker.x ? 1 : -1;
        soundSynth.playStun();
        soundSynth.playAttack(true);
        spawnParticle(defender.x, defender.y - defender.height * 0.5, 0, 0, 48, '#EF4444', 0.26, 0, 'ring');
        engineRef.current.slashes.push({
          x: attacker.x,
          y: attacker.y - attacker.height * 0.5,
          facing: defender.facing,
          color: '#EF4444',
          width: 145,
          height: 92,
          life: 0.25,
          maxLife: 0.25,
          angle: -0.35,
          kind: 'iaido_slash',
        });
        applyHit(defender, attacker, 32, 520, -340, defender.facing, 0.075, 16);
        return false;
      }

      const attSpec = attacker ? FIGHTER_SPECS[attacker.id] : null;
      const defSpec = FIGHTER_SPECS[defender.id];
      const hasShield = defender.shieldTimer > 0;

      const atkMultiplier = attSpec ? 1 + (attSpec.atk - 7) * 0.06 : 1;
      const defReduction = defSpec.def * 0.85;
      const effectiveRaw = hasShield ? damageRaw * 0.25 : damageRaw;
      const finalDamage = Math.max(hasShield ? 2 : 4, Math.round(effectiveRaw * atkMultiplier - defReduction));

      defender.hp = Math.max(0, defender.hp - finalDamage);
      if (attacker) {
        attacker.damageDealt += finalDamage;
        attacker.ultCharge = Math.min(100, attacker.ultCharge + ultGain);
      }
      defender.ultCharge = Math.min(100, defender.ultCharge + ultGain * 0.45);

      const missingRatio = 1 - defender.hp / defender.maxHp;
      const knockbackScale = ((0.85 + missingRatio * 0.95) / defSpec.weight) * (hasShield ? 0.15 : 1);

      defender.vx = dir * kbX * knockbackScale;
      defender.vy = kbY * knockbackScale;
      if (!hasShield) {
        defender.grounded = false;
        defender.recoveryUsed = false; // Taking a hit refreshes recovery like Smash!
        defender.hitFlashTimer = 0.12;
        defender.hitstunTimer = Math.min(0.45, 0.18 + missingRatio * 0.22);
        defender.animState = 'hitstun';
        defender.animTimer = 0;
        defender.animDuration = defender.hitstunTimer;
        defender.squashX = 0.78;
        defender.squashY = 1.24;
      } else {
        defender.hitFlashTimer = 0.07;
        soundSynth.playCrackHit();
        spawnParticle(defender.x, defender.y - defender.height * 0.5, 0, 0, 42, '#A3E635', 0.22, 0, 'ring');
      }

      if (options?.appliesSlow && options.appliesSlow > 0) {
        defender.slowTimer = Math.max(defender.slowTimer, options.appliesSlow);
      }
      if (options?.appliesPoison && options.appliesPoison > 0 && attacker) {
        defender.poisonTimer = Math.max(defender.poisonTimer, options.appliesPoison);
        defender.poisonSourceSlot = attacker.slot;
        if (defender.poisonTickTimer <= 0) defender.poisonTickTimer = 0.45;
      }
      if (options?.appliesStun && options.appliesStun > 0) {
        defender.stunTimer = Math.max(defender.stunTimer, options.appliesStun);
        soundSynth.playStun();
      }
      if (options?.appliesConfuse && options.appliesConfuse > 0) {
        defender.confuseTimer = Math.max(defender.confuseTimer, options.appliesConfuse);
      }

      const heavy = finalDamage >= 24 || (options?.appliesStun ?? 0) > 0.6;
      engineRef.current.hitstopTimer = Math.max(engineRef.current.hitstopTimer, hitstop);
      engineRef.current.shakeIntensity = Math.max(
        engineRef.current.shakeIntensity,
        heavy ? 11 : 5
      );
      if (options?.isHazard) {
        soundSynth.playHazardHit();
      } else {
        soundSynth.playHit(heavy);
      }

      const ringColor = options?.appliesConfuse
        ? '#10B981'
        : options?.appliesPoison
        ? '#C084FC'
        : attSpec
        ? attSpec.accentColor
        : '#FB923C';

      spawnParticle(
        defender.x,
        defender.y - defender.height * 0.5,
        0,
        0,
        heavy ? 40 : 24,
        ringColor,
        0.22,
        0,
        'ring'
      );
      for (let i = 0; i < (heavy ? 14 : 8); i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 140 + Math.random() * 260;
        spawnParticle(
          defender.x,
          defender.y - defender.height * 0.5,
          Math.cos(ang) * spd,
          Math.sin(ang) * spd - 60,
          4 + Math.random() * 4,
          i % 2 === 0 ? ringColor : '#FFFFFF',
          0.32 + Math.random() * 0.15,
          420,
          'spark'
        );
      }

      return true;
    };

    const damageDestructible = (
      prop: DestructiblePropRuntime,
      attackerSlot: 0 | 1 | null,
      dmg: number
    ) => {
      if (prop.broken || prop.hitCooldown > 0) return;
      const state = engineRef.current;
      const accent = getPropAccentColor(prop.kind);
      prop.hp = Math.max(0, prop.hp - dmg);
      prop.shakeTimer = 0.16;
      prop.hitFlashTimer = 0.1;
      prop.hitCooldown = 0.14;

      const cy = prop.y - prop.height * 0.5;

      if (prop.hp <= 0) {
        prop.broken = true;
        prop.respawnTimer = 11.0;
        soundSynth.playStructureBreak();
        state.shakeIntensity = Math.max(state.shakeIntensity, 10);

        spawnParticle(prop.x, cy, 0, 0, 56, accent, 0.3, 0, 'ring');
        for (let i = 0; i < 18; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 140 + Math.random() * 240;
          spawnParticle(
            prop.x,
            cy,
            Math.cos(ang) * spd,
            Math.sin(ang) * spd - 80,
            5 + Math.random() * 4,
            i % 2 === 0 ? accent : '#FFFFFF',
            0.46,
            440,
            'spark'
          );
        }

        if (prop.kind === 'honey_vat') {
          spawnHoneyPuddle(prop.x, prop.y, attackerSlot ?? 0);
        } else if (prop.kind === 'storm_pylon') {
          state.lightningFlash = Math.max(state.lightningFlash, 0.65);
          for (const f of state.players) {
            if (f.animState === 'ko') continue;
            const fy = f.y - f.height * 0.5;
            if (Math.hypot(f.x - prop.x, fy - cy) <= 155) {
              const dir: 1 | -1 = f.x >= prop.x ? 1 : -1;
              applyHit(null, f, 14, 340, -480, dir, 0.045, 6, {
                appliesStun: 0.75,
                isHazard: true,
              });
            }
          }
        } else if (prop.kind === 'magma_crystal') {
          for (const f of state.players) {
            if (f.animState === 'ko') continue;
            const fy = f.y - f.height * 0.5;
            if (Math.hypot(f.x - prop.x, fy - cy) <= 160) {
              const dir: 1 | -1 = f.x >= prop.x ? 1 : -1;
              applyHit(null, f, 18, 460, -420, dir, 0.05, 8, { isHazard: true });
            }
          }
        } else if (prop.kind === 'windmill_crate') {
          soundSynth.playBouncePad();
          for (const f of state.players) {
            if (f.animState === 'ko') continue;
            const fy = f.y - f.height * 0.5;
            if (Math.hypot(f.x - prop.x, fy - cy) <= 150) {
              const dir: 1 | -1 = f.x >= prop.x ? 1 : -1;
              f.vy = -580;
              f.vx += dir * 240;
              f.grounded = false;
              f.recoveryUsed = false;
              f.squashX = 0.78;
              f.squashY = 1.26;
            }
          }
        } else if (prop.kind === 'eclipse_urn') {
          if (attackerSlot !== null) {
            const breaker = state.players[attackerSlot];
            breaker.ultCharge = Math.min(100, breaker.ultCharge + 12);
          }
          for (const f of state.players) {
            if (f.animState === 'ko' || f.slot === attackerSlot) continue;
            const fy = f.y - f.height * 0.5;
            if (Math.hypot(f.x - prop.x, fy - cy) <= 145) {
              const dir: 1 | -1 = f.x >= prop.x ? 1 : -1;
              applyHit(null, f, 12, 300, -320, dir, 0.035, 5, { isHazard: true });
            }
          }
        } else if (prop.kind === 'neon_beacon') {
          spawnParticle(prop.x, cy, 0, 0, 72, '#EC4899', 0.32, 0, 'ring');
          for (const f of state.players) {
            if (f.animState === 'ko') continue;
            const fy = f.y - f.height * 0.5;
            if (Math.hypot(f.x - prop.x, fy - cy) <= 150) {
              const dir: 1 | -1 = f.x >= prop.x ? 1 : -1;
              applyHit(null, f, 14, 340, -360, dir, 0.04, 6, {
                appliesStun: 0.5,
                isHazard: true,
              });
            }
          }
        } else if (prop.kind === 'frost_crystal') {
          spawnParticle(prop.x, cy, 0, 0, 70, '#7DD3FC', 0.34, 0, 'ring');
          for (const f of state.players) {
            if (f.animState === 'ko') continue;
            const fy = f.y - f.height * 0.5;
            if (Math.hypot(f.x - prop.x, fy - cy) <= 155) {
              const dir: 1 | -1 = f.x >= prop.x ? 1 : -1;
              applyHit(null, f, 12, 300, -340, dir, 0.04, 5, {
                appliesSlow: 3.2,
                isHazard: true,
              });
            }
          }
        } else if (prop.kind === 'steam_boiler') {
          spawnParticle(prop.x, cy, 0, 0, 76, '#F59E0B', 0.34, 0, 'ring');
          for (const f of state.players) {
            if (f.animState === 'ko') continue;
            const fy = f.y - f.height * 0.5;
            if (Math.hypot(f.x - prop.x, fy - cy) <= 160) {
              const dir: 1 | -1 = f.x >= prop.x ? 1 : -1;
              applyHit(null, f, 16, 440, -460, dir, 0.05, 8, { isHazard: true });
            }
          }
        } else if (prop.kind === 'coral_pod') {
          const attacker = attackerSlot !== null ? state.players[attackerSlot] : null;
          spawnParticle(prop.x, cy, 0, 0, 68, '#22D3EE', 0.34, 0, 'ring');
          for (const f of state.players) {
            if (f.animState === 'ko' || f.slot === attackerSlot) continue;
            const fy = f.y - f.height * 0.5;
            if (Math.hypot(f.x - prop.x, fy - cy) <= 150) {
              const dir: 1 | -1 = f.x >= prop.x ? 1 : -1;
              applyHit(attacker, f, 10, 260, -280, dir, 0.03, 4, {
                appliesSlow: 2.6,
                appliesPoison: 2.5,
                isHazard: true,
              });
            }
          }
        } else if (prop.kind === 'plasma_cell') {
          if (attackerSlot !== null) {
            const breaker = state.players[attackerSlot];
            breaker.ultCharge = Math.min(100, breaker.ultCharge + 15);
          }
          spawnParticle(prop.x, cy, 0, 0, 74, '#C084FC', 0.34, 0, 'ring');
          for (const f of state.players) {
            if (f.animState === 'ko' || f.slot === attackerSlot) continue;
            const fy = f.y - f.height * 0.5;
            if (Math.hypot(f.x - prop.x, fy - cy) <= 150) {
              const dir: 1 | -1 = f.x >= prop.x ? 1 : -1;
              applyHit(null, f, 14, 360, -360, dir, 0.04, 6, { isHazard: true });
            }
          }
        }
      } else {
        soundSynth.playCrackHit();
        for (let i = 0; i < 6; i++) {
          spawnParticle(
            prop.x + (Math.random() - 0.5) * 20,
            cy,
            (Math.random() - 0.5) * 180,
            -90 - Math.random() * 110,
            4,
            accent,
            0.3,
            400,
            'spark'
          );
        }
      }
    };

    const handleStockLoss = (loser: FighterEntity, winner: FighterEntity) => {
      const state = engineRef.current;
      if (state.phase !== 'PLAYING') return;
      loser.stocks = Math.max(0, loser.stocks - 1);
      winner.koCount += 1;
      state.shakeIntensity = 16;
      soundSynth.playKO();

      for (let i = 0; i < 24; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 180 + Math.random() * 340;
        spawnParticle(
          Math.max(40, Math.min(WORLD_WIDTH - 40, loser.x)),
          Math.max(40, Math.min(WORLD_HEIGHT - 40, loser.y)),
          Math.cos(ang) * spd,
          Math.sin(ang) * spd,
          7 + Math.random() * 6,
          FIGHTER_SPECS[loser.id].accentColor,
          0.55,
          240,
          'spark'
        );
      }

      if (loser.stocks <= 0) {
        loser.animState = 'ko';
        loser.animTimer = 0;
        loser.animDuration = 0;

        winner.animState = 'victory';
        winner.animTimer = 0;
        winner.animDuration = 1.1;
        winner.vx = 0;
        winner.hitstunTimer = 0;
        winner.stunTimer = 0;
        winner.hitFlashTimer = 0;
        winner.slowTimer = 0;
        winner.confuseTimer = 0;
        winner.poisonTimer = 0;
        winner.poisonSourceSlot = null;
        winner.counterTimer = 0;
        winner.shieldTimer = 0;
        winner.speedBoostTimer = 0;
        winner.invulnTimer = 0;
        winner.squashX = 1.14;
        winner.squashY = 0.88;
        winner.facing = winner.x <= WORLD_WIDTH * 0.5 ? 1 : -1;

        const winAccent = FIGHTER_SPECS[winner.id].accentColor;
        for (let i = 0; i < 18; i++) {
          const ang = (Math.PI * 2 * i) / 18;
          const spd = 120 + Math.random() * 160;
          spawnParticle(
            winner.x,
            winner.y - winner.height * 0.5,
            Math.cos(ang) * spd,
            Math.sin(ang) * spd - 90,
            5 + Math.random() * 4,
            i % 2 === 0 ? winAccent : '#FBBF24',
            0.55,
            180,
            'spark'
          );
        }

        state.phase = 'GAME_OVER';
        state.winnerSlot = winner.slot;
        if (!matchRecordedRef.current) {
          matchRecordedRef.current = true;
          recordMatchResultRef.current(winner.slot, state.mode);
        }
        victoryRecordTailRef.current = 0;
        const frames = replayFramesRef.current;
        if (frames.length >= 2) {
          setReplayAvailable(true);
          setReplayDurationSec(
            Math.max(1, Math.round(frames[frames.length - 1].matchTime - frames[0].matchTime))
          );
        }
        syncHudImmediate();
      } else {
        const spawn = MAP_SPECS[state.mapId].spawnPoints[loser.slot];
        loser.x = spawn.x;
        loser.y = 140;
        loser.vx = 0;
        loser.vy = 0;
        loser.hp = loser.maxHp;
        loser.jumpsRemaining = 2;
        loser.recoveryUsed = false;
        loser.hitstunTimer = 0;
        loser.stunTimer = 0;
        loser.slowTimer = 0;
        loser.confuseTimer = 0;
        loser.tauntCooldown = 0;
        loser.poisonTimer = 0;
        loser.poisonSourceSlot = null;
        loser.counterTimer = 0;
        loser.shieldTimer = 0;
        loser.speedBoostTimer = 0;
        loser.invulnTimer = 1.6;
        loser.animState = 'fall';
        loser.animTimer = 0;
        loser.animDuration = 0;
        syncHudImmediate();
      }
    };

    const computeAiControls = (ai: FighterEntity, target: FighterEntity, dt: number) => {
      ai.aiDecisionTimer -= dt;
      const dx = target.x - ai.x;
      const dy = target.y - ai.y;
      const dist = Math.abs(dx);

      let moveDir = 0;
      let wantJump = false;
      let wantDrop = false;
      let wantAttack = false;
      let wantSpecial = false;
      let wantUltimate = false;
      let wantRecovery = false;
      let wantTaunt = false;

      const plats = engineRef.current.platforms;
      const mainPlat = plats[0];
      const stageCenter = WORLD_WIDTH * 0.5;
      const overSafePlatform = plats.some(
        (p) => !p.broken && ai.x >= p.x + 15 && ai.x <= p.x + p.width - 15 && ai.y <= p.y + 30
      );

      if (!overSafePlatform || ai.y > 570) {
        moveDir = ai.x < stageCenter ? 1 : -1;
        if (ai.vy > 40) {
          if (ai.jumpsRemaining > 0) {
            wantJump = true;
          } else if (!ai.recoveryUsed) {
            wantRecovery = true;
          }
        }
      } else {
        if (ai.aiDecisionTimer <= 0) {
          ai.aiDecisionTimer = 0.14 + Math.random() * 0.16;
          if (dist > 130) {
            ai.aiDesiredAction = 'approach';
          } else if (Math.random() < 0.22) {
            ai.aiDesiredAction = 'retreat';
          } else {
            ai.aiDesiredAction = 'approach';
          }
        }

        if (ai.aiDesiredAction === 'approach' && dist > 68) {
          moveDir = dx > 0 ? 1 : -1;
        } else if (ai.aiDesiredAction === 'retreat' && dist < 110) {
          moveDir = dx > 0 ? -1 : 1;
        }

        if (dy < -75 && ai.grounded && Math.random() < 0.08) {
          wantJump = true;
        } else if (dy > 90 && ai.grounded && Math.random() < 0.06 && mainPlat.y > ai.y + 20) {
          wantDrop = true;
        }

        const incomingThreat =
          (dist < 145 && isAttackAnim(target.animState)) ||
          engineRef.current.projectiles.some(
            (p) => p.ownerSlot !== ai.slot && Math.hypot(p.x - ai.x, p.y - (ai.y - ai.height * 0.5)) < 175
          );
        const longRangeUlt =
          ai.id === 'honey_shell' ||
          ai.id === 'marshal_bolt' ||
          ai.id === 'moss_golem' ||
          ai.id === 'astro_pip' ||
          ai.id === 'eve';

        if (ai.ultCharge >= 100 && dist < (longRangeUlt ? 520 : 230) && Math.abs(dy) < 220) {
          wantUltimate = true;
        } else if (
          (ai.id === 'blade_zero' || ai.id === 'moss_golem') &&
          ai.specialCooldown <= 0 &&
          incomingThreat &&
          Math.random() < 0.14
        ) {
          wantSpecial = true;
        } else if (
          dist > (ai.id === 'spidra' || ai.id === 'moss_golem' ? 28 : 65) &&
          dist <
            (ai.id === 'eve'
              ? 190
              : ai.id === 'cloudier' || ai.id === 'moss_golem'
              ? 150
              : ai.id === 'spidra'
              ? 105
              : ai.id === 'marshal_bolt' || ai.id === 'astro_pip'
              ? 460
              : 340) &&
          Math.abs(dy) < 110 &&
          ai.specialCooldown <= 0 &&
          ai.id !== 'blade_zero' &&
          Math.random() < (ai.id === 'spidra' ? 0.085 : 0.055)
        ) {
          wantSpecial = true;
        } else if (dist < 120 && Math.abs(dy) < 75 && Math.random() < 0.14) {
          wantAttack = true;
        } else if (
          dist > 280 &&
          ai.grounded &&
          ai.tauntCooldown <= 0 &&
          ai.ultCharge < 95 &&
          Math.random() < 0.006
        ) {
          wantTaunt = true;
        }
      }

      return { moveDir, wantJump, wantDrop, wantAttack, wantSpecial, wantUltimate, wantRecovery, wantTaunt };
    };

    const stepPlatforms = (dt: number) => {
      const state = engineRef.current;
      for (const plat of state.platforms) {
        if (plat.shakeTimer && plat.shakeTimer > 0) {
          plat.shakeTimer = Math.max(0, plat.shakeTimer - dt);
        }
        if (plat.broken) {
          plat.respawnTimer = Math.max(0, (plat.respawnTimer ?? 0) - dt);
          if (plat.respawnTimer <= 0) {
            plat.broken = false;
            plat.hp = plat.maxHp ?? 80;
            plat.respawnTimer = 0;
            plat.shakeTimer = 0;
            spawnParticle(
              plat.x + plat.width * 0.5,
              plat.y + plat.height * 0.5,
              0,
              0,
              42,
              MAP_SPECS[state.mapId].accentColor,
              0.28,
              0,
              'ring'
            );
          }
        }

        plat.prevX = plat.x;
        plat.prevY = plat.y;
        if (!plat.motion) continue;

        const t = state.matchTime * plat.motion.speed + plat.motion.phase;
        if (plat.motion.kind === 'horizontal') {
          plat.x = plat.baseX + Math.sin(t) * plat.motion.ampX;
        } else if (plat.motion.kind === 'vertical') {
          plat.y = plat.baseY + Math.sin(t) * plat.motion.ampY;
        } else if (plat.motion.kind === 'orbit') {
          plat.x = plat.baseX + Math.cos(t) * plat.motion.ampX;
          plat.y = plat.baseY + Math.sin(t) * plat.motion.ampY;
        }

        const dx = plat.x - (plat.prevX ?? plat.x);
        const dy = plat.y - (plat.prevY ?? plat.y);
        if (!plat.broken && (dx !== 0 || dy !== 0)) {
          for (const f of state.players) {
            if (
              f.grounded &&
              Math.abs(f.y - (plat.prevY ?? plat.y)) < 6 &&
              f.x + f.width * 0.28 >= (plat.prevX ?? plat.x) &&
              f.x - f.width * 0.28 <= (plat.prevX ?? plat.x) + plat.width
            ) {
              f.x += dx;
              f.y += dy;
            }
          }
        }
      }

      // Windmill Map Periodic Gusts
      if (state.mapId === 'wind_mill_spire') {
        const cycle = state.matchTime % 8;
        if (cycle > 4.2 && cycle < 7.2) {
          const dir = Math.floor(state.matchTime / 8) % 2 === 0 ? 1 : -1;
          state.windForceX = dir * 210;
          for (const f of state.players) {
            if (!f.grounded && f.animState !== 'ko') {
              f.vx += state.windForceX * dt;
            }
          }
        } else {
          state.windForceX = 0;
        }
      } else {
        state.windForceX = 0;
      }
    };

    const stepDestructibles = (dt: number) => {
      const state = engineRef.current;
      for (const d of state.destructibles) {
        if (d.shakeTimer > 0) d.shakeTimer = Math.max(0, d.shakeTimer - dt);
        if (d.hitFlashTimer > 0) d.hitFlashTimer = Math.max(0, d.hitFlashTimer - dt);
        if (d.hitCooldown > 0) d.hitCooldown = Math.max(0, d.hitCooldown - dt);
        if (d.broken) {
          d.respawnTimer = Math.max(0, d.respawnTimer - dt);
          if (d.respawnTimer <= 0) {
            d.broken = false;
            d.hp = d.maxHp;
            d.shakeTimer = 0;
            d.hitFlashTimer = 0;
            spawnParticle(
              d.x,
              d.y - d.height * 0.5,
              0,
              0,
              36,
              getPropAccentColor(d.kind),
              0.28,
              0,
              'ring'
            );
          }
        }
      }
    };

    const stepObstacles = (dt: number) => {
      const state = engineRef.current;
      for (const obs of state.obstacles) {
        obs.timer += dt;
        obs.hitCooldowns[0] = Math.max(0, obs.hitCooldowns[0] - dt);
        obs.hitCooldowns[1] = Math.max(0, obs.hitCooldowns[1] - dt);

        if (obs.kind === 'lava_geyser') {
          const period = obs.period ?? 5.5;
          const phase = obs.timer % period;
          if (phase < 2.6) {
            obs.state = 'idle';
            obs.currentHeight = 0;
          } else if (phase < 3.9) {
            obs.state = 'telegraph';
            obs.currentHeight = 0;
          } else {
            obs.state = 'active';
            const activeRatio = Math.min(1, (phase - 3.9) / 0.2);
            obs.currentHeight = obs.height * activeRatio;

            for (const f of state.players) {
              if (obs.hitCooldowns[f.slot] > 0 || f.animState === 'ko') continue;
              const overlapX = Math.abs(f.x - obs.x) <= obs.width * 0.5 + f.width * 0.3;
              const overlapY = f.y >= obs.y - obs.currentHeight && f.y - f.height <= obs.y;
              if (overlapX && overlapY) {
                obs.hitCooldowns[f.slot] = 0.7;
                applyHit(
                  null,
                  f,
                  16,
                  f.x >= obs.x ? 260 : -260,
                  -660,
                  f.x >= obs.x ? 1 : -1,
                  0.04,
                  6,
                  { isHazard: true }
                );
              }
            }
          }
        } else if (obs.kind === 'wind_bumper') {
          obs.angle += dt * 4.5;
          const r = obs.radius ?? 36;
          for (const f of state.players) {
            if (obs.hitCooldowns[f.slot] > 0 || f.animState === 'ko') continue;
            const fy = f.y - f.height * 0.5;
            const dist = Math.hypot(f.x - obs.currentX, fy - obs.currentY);
            if (dist <= r + f.width * 0.42) {
              obs.hitCooldowns[f.slot] = 0.35;
              const ang = Math.atan2(fy - obs.currentY, f.x - obs.currentX);
              f.vx = Math.cos(ang) * 560;
              f.vy = Math.sin(ang) * 560 - 140;
              f.grounded = false;
              f.recoveryUsed = false;
              f.squashX = 0.78;
              f.squashY = 1.25;
              soundSynth.playBouncePad();
              spawnParticle(obs.currentX, obs.currentY, 0, 0, 44, '#2DD4BF', 0.25, 0, 'ring');
            }
          }
        } else if (obs.kind === 'jump_pad') {
          for (const f of state.players) {
            if (obs.hitCooldowns[f.slot] > 0 || f.animState === 'ko') continue;
            const overlapX = Math.abs(f.x - obs.x) <= obs.width * 0.55;
            const overlapY = Math.abs(f.y - obs.y) <= 22 && f.vy >= -40;
            if (overlapX && overlapY) {
              obs.hitCooldowns[f.slot] = 0.35;
              f.vy = -880;
              f.grounded = false;
              f.jumpsRemaining = 2;
              f.recoveryUsed = false;
              f.squashX = 0.75;
              f.squashY = 1.3;
              soundSynth.playBouncePad();
              spawnParticle(obs.x, obs.y - 8, 0, 0, 32, '#FAFAFA', 0.25, 0, 'ring');
            }
          }
        } else if (obs.kind === 'eclipse_pendulum') {
          const period = obs.period ?? 3.4;
          const swingR = obs.swingRadius ?? 155;
          const swingAngle = Math.sin((obs.timer / period) * Math.PI * 2) * 1.05;
          obs.currentX = obs.x + Math.sin(swingAngle) * swingR;
          obs.currentY = obs.y + Math.cos(swingAngle) * swingR;
          const r = obs.radius ?? 28;

          for (const f of state.players) {
            if (obs.hitCooldowns[f.slot] > 0 || f.animState === 'ko') continue;
            const fy = f.y - f.height * 0.5;
            const dist = Math.hypot(f.x - obs.currentX, fy - obs.currentY);
            if (dist <= r + f.width * 0.38) {
              obs.hitCooldowns[f.slot] = 0.55;
              const dir: 1 | -1 = f.x >= obs.currentX ? 1 : -1;
              applyHit(null, f, 15, 420, -320, dir, 0.045, 6, { isHazard: true });
            }
          }
        } else if (obs.kind === 'hive_swarm') {
          const period = obs.period ?? 7.5;
          const t = (obs.timer / period) * Math.PI * 2;
          obs.state = 'active';
          obs.currentX = obs.x + Math.sin(t) * 320;
          obs.currentY = obs.y + Math.sin(t * 2) * 82;
          const r = obs.radius ?? 34;

          for (const f of state.players) {
            if (obs.hitCooldowns[f.slot] > 0 || f.animState === 'ko') continue;
            const fy = f.y - f.height * 0.5;
            if (Math.hypot(f.x - obs.currentX, fy - obs.currentY) <= r + f.width * 0.34) {
              obs.hitCooldowns[f.slot] = 0.7;
              const dir: 1 | -1 = f.x >= obs.currentX ? 1 : -1;
              applyHit(null, f, 10, 280, -240, dir, 0.035, 5, {
                appliesPoison: 2.6,
                isHazard: true,
              });
            }
          }
        } else if (obs.kind === 'lightning_arc') {
          const period = obs.period ?? 4.8;
          const phase = obs.timer % period;
          const prevState = obs.state;
          if (phase < 2.5) {
            obs.state = 'idle';
          } else if (phase < 3.7) {
            obs.state = 'telegraph';
          } else {
            obs.state = 'active';
            if (prevState !== 'active') {
              state.lightningFlash = Math.max(state.lightningFlash, 0.55);
              state.shakeIntensity = Math.max(state.shakeIntensity, 6);
            }
            for (const f of state.players) {
              if (obs.hitCooldowns[f.slot] > 0 || f.animState === 'ko') continue;
              const overlapX = Math.abs(f.x - obs.x) <= obs.width * 0.5 + f.width * 0.28;
              const overlapY = f.y >= 20 && f.y - f.height <= obs.y;
              if (overlapX && overlapY) {
                obs.hitCooldowns[f.slot] = 0.75;
                const dir: 1 | -1 = f.x >= obs.x ? 1 : -1;
                applyHit(null, f, 16, 290, -520, dir, 0.045, 7, {
                  appliesStun: 0.75,
                  isHazard: true,
                });
              }
            }
          }
        } else if (obs.kind === 'icicle_drop') {
          const period = obs.period ?? 4.6;
          const phase = obs.timer % period;
          if (phase < 2.2) {
            obs.state = 'idle';
            obs.currentX = obs.x;
            obs.currentY = 42;
          } else if (phase < 3.4) {
            obs.state = 'telegraph';
            obs.currentX = obs.x;
            obs.currentY = 42;
          } else {
            obs.state = 'active';
            const dropRatio = Math.min(1, (phase - 3.4) / 0.48);
            obs.currentX = obs.x;
            obs.currentY = 42 + dropRatio * (obs.y - 42);
            if (dropRatio < 1) {
              for (const f of state.players) {
                if (obs.hitCooldowns[f.slot] > 0 || f.animState === 'ko') continue;
                const fy = f.y - f.height * 0.5;
                const overlapX = Math.abs(f.x - obs.currentX) <= obs.width * 0.5 + f.width * 0.3;
                const overlapY =
                  fy + f.height * 0.45 >= obs.currentY - obs.height &&
                  fy - f.height * 0.45 <= obs.currentY;
                if (overlapX && overlapY) {
                  obs.hitCooldowns[f.slot] = 0.75;
                  const dir: 1 | -1 = f.x >= obs.currentX ? 1 : -1;
                  applyHit(null, f, 13, 250, -360, dir, 0.04, 5, {
                    appliesSlow: 2.8,
                    isHazard: true,
                  });
                }
              }
            }
          }
        } else if (obs.kind === 'crusher_piston') {
          const period = obs.period ?? 5.0;
          const phase = obs.timer % period;
          const topY = 210;
          const prevY = obs.currentY;
          if (phase < 2.2) {
            obs.state = 'idle';
            obs.currentY = topY;
          } else if (phase < 3.4) {
            obs.state = 'telegraph';
            obs.currentY = topY + Math.sin(obs.timer * 34) * 3;
          } else if (phase < 4.1) {
            obs.state = 'active';
            const slamRatio = Math.min(1, (phase - 3.4) / 0.16);
            obs.currentY = topY + slamRatio * (obs.y - topY);
            if (prevY < obs.y - 4 && obs.currentY >= obs.y - 4) {
              state.shakeIntensity = Math.max(state.shakeIntensity, 8);
              soundSynth.playStructureBreak();
            }
            for (const f of state.players) {
              if (obs.hitCooldowns[f.slot] > 0 || f.animState === 'ko') continue;
              const overlapX = Math.abs(f.x - obs.x) <= obs.width * 0.5 + f.width * 0.32;
              const overlapY =
                f.y >= obs.currentY - obs.height && f.y - f.height <= obs.currentY;
              if (overlapX && overlapY) {
                obs.hitCooldowns[f.slot] = 0.8;
                const dir: 1 | -1 = f.x >= obs.x ? 1 : -1;
                applyHit(null, f, 18, 440, -480, dir, 0.055, 7, { isHazard: true });
              }
            }
          } else {
            obs.state = 'idle';
            const retract = Math.min(1, (phase - 4.1) / 0.9);
            obs.currentY = obs.y - retract * (obs.y - topY);
          }
        } else if (obs.kind === 'whirlpool_vortex') {
          const period = obs.period ?? 5.6;
          const phase = obs.timer % period;
          const r = obs.radius ?? 44;
          if (phase < 2.0) {
            obs.state = 'idle';
          } else if (phase < 3.2) {
            obs.state = 'telegraph';
          } else {
            obs.state = 'active';
            for (const f of state.players) {
              if (f.animState === 'ko') continue;
              const fy = f.y - f.height * 0.5;
              const dx = obs.currentX - f.x;
              const dy = obs.currentY - fy;
              const dist = Math.hypot(dx, dy);
              if (dist > 10 && dist < 260) {
                const pull = (1 - dist / 260) * 320;
                f.vx += (dx / dist) * pull * dt;
                f.vy += (dy / dist) * pull * dt;
              }
              if (obs.hitCooldowns[f.slot] <= 0 && dist <= r + 14) {
                obs.hitCooldowns[f.slot] = 0.8;
                const dir: 1 | -1 = f.x >= obs.currentX ? 1 : -1;
                applyHit(null, f, 11, 380, -410, dir, 0.04, 5, {
                  appliesSlow: 2.2,
                  isHazard: true,
                });
              }
            }
          }
        } else if (obs.kind === 'laser_sweeper') {
          const period = obs.period ?? 5.4;
          const phase = obs.timer % period;
          if (phase < 1.8) {
            obs.state = 'idle';
            obs.angle = -0.85;
          } else if (phase < 3.0) {
            obs.state = 'telegraph';
            obs.angle = -0.85;
          } else {
            obs.state = 'active';
            const sweepRatio = Math.min(1, (phase - 3.0) / (period - 3.0));
            obs.angle = -0.85 + sweepRatio * 1.7;
            const len = obs.height ?? 480;
            const x1 = obs.x;
            const y1 = obs.y;
            const x2 = x1 + Math.sin(obs.angle) * len;
            const y2 = y1 + Math.cos(obs.angle) * len;
            const segLenSq = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);

            for (const f of state.players) {
              if (obs.hitCooldowns[f.slot] > 0 || f.animState === 'ko') continue;
              const fy = f.y - f.height * 0.5;
              const proj = Math.max(
                0,
                Math.min(1, ((f.x - x1) * (x2 - x1) + (fy - y1) * (y2 - y1)) / segLenSq)
              );
              const closestX = x1 + proj * (x2 - x1);
              const closestY = y1 + proj * (y2 - y1);
              if (Math.hypot(f.x - closestX, fy - closestY) <= 26) {
                obs.hitCooldowns[f.slot] = 0.7;
                const dir: 1 | -1 = Math.sin(obs.angle) >= 0 ? 1 : -1;
                applyHit(null, f, 15, 390, -330, dir, 0.045, 6, { isHazard: true });
              }
            }
          }
        } else if (obs.kind === 'hover_car') {
          const period = obs.period ?? 5.0;
          const phase = obs.timer % period;
          const telegraphStart = period - 2.65;
          const activeStart = period - 1.55;
          const prevState = obs.state;

          if (phase < telegraphStart) {
            obs.state = 'idle';
            obs.currentX = -400;
          } else if (phase < activeStart) {
            obs.state = 'telegraph';
          } else {
            obs.state = 'active';
            if (prevState !== 'active') {
              soundSynth.playHoverCarPass();
            }
            const activeElapsed = phase - activeStart;
            const spd = obs.speed ?? 820;
            const dir = obs.direction ?? 1;
            obs.currentX =
              dir === 1
                ? -140 + activeElapsed * spd
                : WORLD_WIDTH + 140 - activeElapsed * spd;
            obs.currentY = obs.y;

            if (Math.random() < dt * 28) {
              spawnParticle(
                obs.currentX - dir * (obs.width * 0.5),
                obs.currentY + (Math.random() - 0.5) * 12,
                -dir * (90 + Math.random() * 80),
                (Math.random() - 0.5) * 40,
                3.5,
                dir === 1 ? '#22D3EE' : '#EC4899',
                0.22,
                0,
                'spark'
              );
            }

            const carHalfW = obs.width * 0.46;
            const carHalfH = obs.height * 0.46;
            for (const f of state.players) {
              if (obs.hitCooldowns[f.slot] > 0 || f.animState === 'ko') continue;
              const fy = f.y - f.height * 0.5;
              const overlapX = Math.abs(f.x - obs.currentX) <= carHalfW + f.width * 0.34;
              const overlapY = Math.abs(fy - obs.currentY) <= carHalfH + f.height * 0.42;
              if (overlapX && overlapY) {
                obs.hitCooldowns[f.slot] = 0.75;
                applyHit(null, f, 16, 520, -340, dir, 0.055, 8, { isHazard: true });
              }
            }
          }
        }
      }
    };

    const stepFighter = (f: FighterEntity, opponent: FighterEntity, dt: number) => {
      const spec = FIGHTER_SPECS[f.id];
      const plats = engineRef.current.platforms;

      f.squashX += (1 - f.squashX) * Math.min(1, dt * 14);
      f.squashY += (1 - f.squashY) * Math.min(1, dt * 14);

      if (f.hitFlashTimer > 0) f.hitFlashTimer = Math.max(0, f.hitFlashTimer - dt);
      if (f.invulnTimer > 0) f.invulnTimer = Math.max(0, f.invulnTimer - dt);
      if (f.slowTimer > 0) f.slowTimer = Math.max(0, f.slowTimer - dt);
      if (f.confuseTimer > 0) f.confuseTimer = Math.max(0, f.confuseTimer - dt);
      if (f.counterTimer > 0) f.counterTimer = Math.max(0, f.counterTimer - dt);
      if (f.shieldTimer > 0) f.shieldTimer = Math.max(0, f.shieldTimer - dt);
      if (f.speedBoostTimer > 0) f.speedBoostTimer = Math.max(0, f.speedBoostTimer - dt);
      if (f.specialCooldown > 0) f.specialCooldown = Math.max(0, f.specialCooldown - dt);
      if (f.tauntCooldown > 0) f.tauntCooldown = Math.max(0, f.tauntCooldown - dt);
      if (f.dropThroughTimer > 0) f.dropThroughTimer = Math.max(0, f.dropThroughTimer - dt);
      if (f.comboResetTimer > 0) {
        f.comboResetTimer = Math.max(0, f.comboResetTimer - dt);
        if (f.comboResetTimer === 0) f.comboStep = 0;
      }

      // Honey Poison DoT
      if (f.poisonTimer > 0) {
        f.poisonTimer = Math.max(0, f.poisonTimer - dt);
        f.poisonTickTimer -= dt;
        if (f.poisonTickTimer <= 0) {
          f.poisonTickTimer = 0.5;
          const poisonDmg = 5;
          f.hp = Math.max(0, f.hp - poisonDmg);
          if (f.poisonSourceSlot !== null) {
            engineRef.current.players[f.poisonSourceSlot].damageDealt += poisonDmg;
          }
          soundSynth.playPoisonTick();
          for (let i = 0; i < 4; i++) {
            spawnParticle(
              f.x + (Math.random() - 0.5) * 34,
              f.y - Math.random() * f.height,
              (Math.random() - 0.5) * 40,
              -55 - Math.random() * 45,
              4.5,
              i % 2 === 0 ? '#A855F7' : '#FBBF24',
              0.38,
              -30,
              'drip'
            );
          }
        }
        if (f.poisonTimer === 0) {
          f.poisonSourceSlot = null;
        }
      }

      f.ultCharge = Math.min(100, f.ultCharge + dt * 2.2);

      let moveDir = 0;
      let jumpPressed = false;
      let downHeld = false;
      let attackComboPressed = false;
      let tauntPressed = false;
      let directMove: MoveKey | null = null;

      const isConfused = f.confuseTimer > 0;

      if (f.isAi) {
        const aiOut = computeAiControls(f, opponent, dt);
        moveDir = isConfused ? -aiOut.moveDir : aiOut.moveDir;
        jumpPressed = isConfused ? aiOut.wantDrop : aiOut.wantJump;
        downHeld = isConfused ? aiOut.wantJump : aiOut.wantDrop;
        attackComboPressed = aiOut.wantAttack;
        tauntPressed = aiOut.wantTaunt;
        if (aiOut.wantRecovery) directMove = 'recovery';
        else if (aiOut.wantSpecial) directMove = 'special';
        else if (aiOut.wantUltimate) directMove = 'ultimate';
      } else {
        const held = heldKeysRef.current;
        const just = justPressedRef.current;

        if (f.slot === 0) {
          if (held.has('KeyA')) moveDir -= 1;
          if (held.has('KeyD')) moveDir += 1;
          if (engineRef.current.mode === '1P_AI') {
            if (held.has('ArrowLeft')) moveDir -= 1;
            if (held.has('ArrowRight')) moveDir += 1;
          }
          moveDir = Math.max(-1, Math.min(1, moveDir));
          if (isConfused) moveDir = -moveDir;

          const rawUpHeld =
            held.has('KeyW') || (engineRef.current.mode === '1P_AI' && held.has('ArrowUp'));
          const rawUpJust =
            just.has('KeyW') || (engineRef.current.mode === '1P_AI' && just.has('ArrowUp'));
          const rawDownHeld =
            held.has('KeyS') || (engineRef.current.mode === '1P_AI' && held.has('ArrowDown'));
          const rawDownJust =
            just.has('KeyS') || (engineRef.current.mode === '1P_AI' && just.has('ArrowDown'));

          const upHeld = isConfused ? rawDownHeld : rawUpHeld;
          jumpPressed = isConfused ? rawDownJust : rawUpJust;
          downHeld = isConfused ? rawUpHeld : rawDownHeld;

          if (just.has('KeyR') || (upHeld && just.has('KeyK'))) {
            directMove = 'recovery';
          } else if (just.has('KeyU')) directMove = 'attack1';
          else if (just.has('KeyI')) directMove = 'attack2';
          else if (just.has('KeyO')) directMove = 'attack3';
          else if (just.has('KeyK')) directMove = 'special';
          else if (just.has('KeyL')) directMove = 'ultimate';
          else if (just.has('KeyT')) tauntPressed = true;
          else if (just.has('KeyJ') || just.has('Space')) attackComboPressed = true;
        } else {
          if (held.has('ArrowLeft')) moveDir -= 1;
          if (held.has('ArrowRight')) moveDir += 1;
          if (isConfused) moveDir = -moveDir;

          const rawUpHeld = held.has('ArrowUp');
          const rawUpJust = just.has('ArrowUp');
          const rawDownHeld = held.has('ArrowDown');
          const rawDownJust = just.has('ArrowDown');

          const upHeld = isConfused ? rawDownHeld : rawUpHeld;
          jumpPressed = isConfused ? rawDownJust : rawUpJust;
          downHeld = isConfused ? rawUpHeld : rawDownHeld;

          if (just.has('Backslash') || just.has('Numpad0') || (upHeld && just.has('Period'))) {
            directMove = 'recovery';
          } else if (just.has('Comma') || just.has('Numpad1')) attackComboPressed = true;
          else if (just.has('Period') || just.has('Numpad2')) directMove = 'special';
          else if (just.has('Slash') || just.has('Numpad3')) directMove = 'ultimate';
          else if (just.has('Semicolon') || just.has('Quote') || just.has('NumpadDecimal')) {
            tauntPressed = true;
          }
        }
      }

      const recordedAction: ReplayInputAction = directMove
        ? directMove
        : tauntPressed
        ? 'taunt'
        : attackComboPressed
        ? 'combo'
        : null;
      frameInputsRef.current[f.slot] = {
        moveDir,
        jump: jumpPressed,
        down: downHeld,
        action: recordedAction,
      };

      if (jumpPressed) {
        f.jumpBufferTimer = JUMP_BUFFER_TIME;
      } else if (f.jumpBufferTimer > 0) {
        f.jumpBufferTimer = Math.max(0, f.jumpBufferTimer - dt);
      }

      if (f.grounded) {
        f.coyoteTimer = COYOTE_TIME;
        f.jumpsRemaining = 2;
        f.recoveryUsed = false;
      } else if (f.coyoteTimer > 0) {
        f.coyoteTimer = Math.max(0, f.coyoteTimer - dt);
      }

      if (f.hitstunTimer > 0) {
        f.hitstunTimer = Math.max(0, f.hitstunTimer - dt);
        if (f.stunTimer > 0) f.stunTimer = Math.max(0, f.stunTimer - dt);
        f.animTimer += dt;
        if (f.hitstunTimer === 0) {
          f.animState = f.stunTimer > 0 ? 'stunned' : f.grounded ? 'idle' : 'fall';
        }
      } else if (f.stunTimer > 0) {
        f.stunTimer = Math.max(0, f.stunTimer - dt);
        f.animState = 'stunned';
        f.animTimer += dt;
        if (f.grounded) {
          if (f.vx > 0) f.vx = Math.max(0, f.vx - GROUND_FRICTION * 0.7 * dt);
          else if (f.vx < 0) f.vx = Math.min(0, f.vx + GROUND_FRICTION * 0.7 * dt);
        }
        if (f.stunTimer === 0) {
          f.animState = f.grounded ? 'idle' : 'fall';
        }
      } else {
        if (isAttackAnim(f.animState)) {
          const moveKey = f.animState as MoveKey;
          const move = spec.moves[moveKey];
          const prevTime = f.animTimer;
          f.animTimer += dt;

          // Allow gentle air steering during recovery
          if (moveKey === 'recovery' && moveDir !== 0) {
            f.vx += moveDir * 720 * dt;
            f.vx = Math.max(-340, Math.min(340, f.vx));
          }

          if (prevTime < move.activeStart && f.animTimer >= move.activeStart) {
            spawnMoveEffects(f, moveKey);

            if (!move.isProjectile) {
              const boxCx = f.x + (move.isAreaAround ? 0 : f.facing * move.offsetX);
              const boxCy = f.y + move.offsetY;
              const halfW = move.rangeX * 0.5;
              const halfH = move.rangeY * 0.5;
              const isHeavy =
                moveKey === 'attack3' || moveKey === 'special' || moveKey === 'ultimate';
              const structDmg =
                moveKey === 'ultimate'
                  ? 48
                  : moveKey === 'special'
                  ? 38
                  : moveKey === 'attack3'
                  ? 30
                  : 16;

              for (const prop of engineRef.current.destructibles) {
                if (prop.broken) continue;
                const propCy = prop.y - prop.height * 0.5;
                if (
                  Math.abs(boxCx - prop.x) <= halfW + prop.width * 0.5 &&
                  Math.abs(boxCy - propCy) <= halfH + prop.height * 0.5
                ) {
                  damageDestructible(prop, f.slot, structDmg);
                }
              }

              for (const plat of engineRef.current.platforms) {
                if (plat.broken) continue;
                const platCx = plat.x + plat.width * 0.5;
                const platCy = plat.y + plat.height * 0.5;
                if (
                  Math.abs(boxCx - platCx) <= halfW + plat.width * 0.5 &&
                  Math.abs(boxCy - platCy) <= halfH + plat.height * 0.5 + 10
                ) {
                  if (plat.destructible) {
                    damagePlatform(plat, structDmg, boxCx, spec.accentColor);
                  } else if (isHeavy) {
                    addFloorScar(plat, boxCx);
                  }
                }
              }
            }
          }

          if (
            !move.isProjectile &&
            !f.hasHitCurrentMove &&
            f.animTimer >= move.activeStart &&
            f.animTimer <= move.activeEnd
          ) {
            const boxCx = f.x + (move.isAreaAround ? 0 : f.facing * move.offsetX);
            const boxCy = f.y + move.offsetY;
            const halfW = move.rangeX * 0.5;
            const halfH = move.rangeY * 0.5;

            const oppCx = opponent.x;
            const oppCy = opponent.y - opponent.height * 0.5;
            const oppHalfW = opponent.width * 0.45;
            const oppHalfH = opponent.height * 0.5;

            const overlaps =
              Math.abs(boxCx - oppCx) <= halfW + oppHalfW &&
              Math.abs(boxCy - oppCy) <= halfH + oppHalfH;

            if (overlaps) {
              const hitDir: 1 | -1 = move.isAreaAround
                ? opponent.x >= f.x
                  ? 1
                  : -1
                : f.facing;
              const landed = applyHit(
                f,
                opponent,
                move.baseDamage,
                move.knockbackX,
                move.knockbackY,
                hitDir,
                move.hitstop,
                move.ultGain,
                {
                  appliesSlow: move.appliesSlow,
                  appliesPoison: move.appliesPoison,
                  appliesStun: move.appliesStun,
                  appliesConfuse: move.appliesConfuse,
                }
              );
              if (landed) f.hasHitCurrentMove = true;
            }
          }

          if (f.animTimer >= f.animDuration) {
            f.animState = f.grounded ? 'idle' : 'fall';
            f.animTimer = 0;
            f.animDuration = 0;
          }
        } else if (f.animState === 'taunt') {
          const prevTime = f.animTimer;
          f.animTimer += dt;
          const drag = f.grounded ? GROUND_FRICTION : AIR_DRAG;
          if (f.vx > 0) f.vx = Math.max(0, f.vx - drag * dt);
          else if (f.vx < 0) f.vx = Math.min(0, f.vx + drag * dt);

          if (prevTime < 0.2 && f.animTimer >= 0.2) {
            f.ultCharge = Math.min(100, f.ultCharge + 9);
            soundSynth.playTauntBoost();
            spawnParticle(
              f.x,
              f.y - f.height * 0.5,
              0,
              0,
              26,
              '#FBBF24',
              0.28,
              0,
              'ring'
            );
            for (let i = 0; i < 8; i++) {
              const ang = (Math.PI * 2 * i) / 8;
              spawnParticle(
                f.x + Math.cos(ang) * 18,
                f.y - f.height * 0.5 + Math.sin(ang) * 14,
                Math.cos(ang) * 70,
                -90 - Math.random() * 80,
                4,
                i % 2 === 0 ? '#FBBF24' : spec.accentColor,
                0.42,
                60,
                'spark'
              );
            }
          }

          if (f.animTimer >= f.animDuration) {
            f.animState = f.grounded ? 'idle' : 'fall';
            f.animTimer = 0;
            f.animDuration = 0;
          }
        } else {
          const standingPlat = f.grounded
            ? plats.find(
                (p) =>
                  !p.broken &&
                  Math.abs(f.y - p.y) < 6 &&
                  f.x + f.width * 0.28 >= p.x &&
                  f.x - f.width * 0.28 <= p.x + p.width
              )
            : undefined;

          if (standingPlat?.conveyorSpeed) {
            f.x += standingPlat.conveyorSpeed * dt;
          }

          const onIce = Boolean(standingPlat?.icy);
          const speedMult = (f.slowTimer > 0 ? 0.58 : 1) * (f.speedBoostTimer > 0 ? 1.45 : 1);
          const targetVx = moveDir * spec.moveSpeed * speedMult;

          if (moveDir !== 0) {
            f.facing = moveDir > 0 ? 1 : -1;
            const accel = f.grounded ? (onIce ? 1250 : 2900) : 1850;
            if (f.vx < targetVx) f.vx = Math.min(targetVx, f.vx + accel * dt);
            else if (f.vx > targetVx) f.vx = Math.max(targetVx, f.vx - accel * dt);
          } else {
            const drag = f.grounded ? (onIce ? GROUND_FRICTION * 0.22 : GROUND_FRICTION) : AIR_DRAG;
            if (f.vx > 0) f.vx = Math.max(0, f.vx - drag * dt);
            else if (f.vx < 0) f.vx = Math.min(0, f.vx + drag * dt);
          }

          if (downHeld && f.grounded) {
            f.dropThroughTimer = 0.18;
            f.grounded = false;
          }

          if (f.jumpBufferTimer > 0) {
            if (f.coyoteTimer > 0 || f.jumpsRemaining > 0) {
              const isDouble = f.coyoteTimer <= 0;
              f.vy = -spec.jumpVelocity * (isDouble ? 0.92 : 1);
              f.grounded = false;
              f.coyoteTimer = 0;
              f.jumpBufferTimer = 0;
              f.jumpsRemaining = Math.max(0, isDouble ? f.jumpsRemaining - 1 : 1);
              f.squashX = 0.82;
              f.squashY = 1.22;
              soundSynth.playJump(isDouble);

              for (let i = 0; i < 5; i++) {
                spawnParticle(
                  f.x + (Math.random() - 0.5) * 32,
                  f.y,
                  (Math.random() - 0.5) * 90,
                  20 + Math.random() * 40,
                  4,
                  '#E2E8F0',
                  0.24,
                  80
                );
              }
            }
          }

          if (directMove) {
            triggerMove(f, directMove, moveDir);
          } else if (tauntPressed && f.tauntCooldown <= 0) {
            triggerTaunt(f);
          } else if (attackComboPressed) {
            const comboMoves: [MoveKey, MoveKey, MoveKey] = ['attack1', 'attack2', 'attack3'];
            const nextMove = comboMoves[f.comboStep];
            triggerMove(f, nextMove, moveDir);
            f.comboStep = ((f.comboStep + 1) % 3) as 0 | 1 | 2;
            f.comboResetTimer = 0.85;
          } else {
            if (!f.grounded) {
              f.animState = f.vy < 0 ? 'jump' : 'fall';
            } else if (Math.abs(moveDir) > 0.1 || Math.abs(f.vx) > 35) {
              f.animState = 'run';
            } else {
              f.animState = 'idle';
            }
            f.animTimer += dt;
          }
        }
      }

      const fallMult = downHeld && !f.grounded && f.vy > 0 ? FAST_FALL_MULTIPLIER : 1;
      const gravScale = MAP_SPECS[engineRef.current.mapId].gravityScale ?? 1;
      f.vy = Math.min(MAX_FALL_SPEED * gravScale * fallMult, f.vy + GRAVITY * gravScale * fallMult * dt);

      const prevY = f.y;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      let landed = false;
      if (f.vy >= 0) {
        for (const plat of plats) {
          if (plat.broken) continue;
          if (plat.passThrough && f.dropThroughTimer > 0) continue;
          const withinX =
            f.x + f.width * 0.28 >= plat.x && f.x - f.width * 0.28 <= plat.x + plat.width;
          const crossedTop = prevY <= plat.y + 10 && f.y >= plat.y;
          if (withinX && crossedTop) {
            if (!f.grounded && f.vy > 220) {
              f.squashX = 1.22;
              f.squashY = 0.78;
            }
            if (f.hitstunTimer > 0 && f.vy > 360) {
              if (plat.destructible) {
                damagePlatform(plat, 28, f.x, spec.accentColor);
              } else {
                addFloorScar(plat, f.x);
              }
              engineRef.current.shakeIntensity = Math.max(engineRef.current.shakeIntensity, 6);
              spawnParticle(f.x, plat.y, 0, 0, 28, '#CBD5E1', 0.24, 0, 'ring');
            }
            f.y = plat.y;
            f.vy = 0;
            f.grounded = true;
            f.recoveryUsed = false;
            landed = true;
            break;
          }
        }
      }
      if (!landed) {
        f.grounded = false;
      }

      const outOfBounds =
        f.x < BLAST_ZONE.left ||
        f.x > BLAST_ZONE.right ||
        f.y < BLAST_ZONE.top ||
        f.y > BLAST_ZONE.bottom;

      if (f.hp <= 0 || outOfBounds) {
        handleStockLoss(f, opponent);
      }
    };

    const detonateExplosion = (
      x: number,
      y: number,
      ownerSlot: 0 | 1,
      radius: number,
      damage: number,
      kbX: number,
      kbY: number,
      color: string,
      alreadyHitTarget: boolean
    ) => {
      const state = engineRef.current;
      const attacker = state.players[ownerSlot];
      const target = state.players[ownerSlot === 0 ? 1 : 0];
      soundSynth.playStructureBreak();
      state.shakeIntensity = Math.max(state.shakeIntensity, 8);
      spawnParticle(x, y, 0, 0, radius * 0.72, color, 0.28, 0, 'ring');
      for (let k = 0; k < 14; k++) {
        const ang = (Math.PI * 2 * k) / 14;
        const spd = 140 + Math.random() * 210;
        spawnParticle(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd - 60, 5.5, k % 2 === 0 ? color : '#FEF08A', 0.36, 260, 'spark');
      }

      if (!alreadyHitTarget && target.animState !== 'ko') {
        const targetCy = target.y - target.height * 0.5;
        if (Math.hypot(target.x - x, targetCy - y) <= radius + target.width * 0.35) {
          const dir: 1 | -1 = target.x >= x ? 1 : -1;
          applyHit(attacker, target, damage, kbX, kbY, dir, 0.05, 10);
        }
      }

      for (const prop of state.destructibles) {
        if (prop.broken) continue;
        const propCy = prop.y - prop.height * 0.5;
        if (Math.hypot(prop.x - x, propCy - y) <= radius + prop.width * 0.4) {
          damageDestructible(prop, ownerSlot, damage);
        }
      }

      for (const plat of state.platforms) {
        if (plat.broken) continue;
        const closestX = Math.max(plat.x, Math.min(plat.x + plat.width, x));
        const closestY = Math.max(plat.y, Math.min(plat.y + plat.height, y));
        if (Math.hypot(closestX - x, closestY - y) <= radius * 0.75) {
          if (plat.destructible) {
            damagePlatform(plat, Math.round(damage * 0.9), x, color);
          } else {
            addFloorScar(plat, closestX);
          }
        }
      }
    };

    const stepTimedActions = (dt: number) => {
      const state = engineRef.current;
      for (let i = state.timedActions.length - 1; i >= 0; i--) {
        const ta = state.timedActions[i];
        ta.timer -= dt;
        if (ta.timer > 0) continue;

        const caster = state.players[ta.ownerSlot];
        const opp = state.players[ta.ownerSlot === 0 ? 1 : 0];

        if (ta.kind === 'hornet_stinger') {
          state.projectiles.push({
            id: state.nextEntityId++,
            ownerSlot: ta.ownerSlot,
            fighterId: caster.id,
            kind: 'hornet_bolt',
            x: caster.x + ((ta.vx ?? 0) >= 0 ? 22 : -22),
            y: caster.y - 62,
            vx: ta.vx ?? 420,
            vy: ta.vy ?? -180,
            radius: 13,
            damage: 13,
            knockbackX: 250,
            knockbackY: -180,
            gravity: 0,
            life: 1.65,
            maxLife: 1.65,
            appliesPoison: 3.0,
            appliesSlow: 1.8,
            homing: true,
            spawnsPuddleOnLand: false,
            rotation: Math.atan2(ta.vy ?? -180, ta.vx ?? 420),
          });
          soundSynth.playLaserShot();
        } else if (ta.kind === 'katana_slice') {
          const side: 1 | -1 = ta.facing ?? 1;
          const oppCy = opp.y - opp.height * 0.5;
          caster.x = Math.max(90, Math.min(WORLD_WIDTH - 90, opp.x - side * 56));
          caster.y = opp.y;
          caster.facing = caster.x <= opp.x ? 1 : -1;
          caster.vx = 0;
          caster.vy = 0;
          soundSynth.playAttack(true);
          state.slashes.push({
            x: opp.x,
            y: oppCy,
            facing: caster.facing,
            color: '#EF4444',
            width: 175,
            height: 90,
            life: 0.24,
            maxLife: 0.24,
            angle: ta.angle ?? 0,
            kind: 'iaido_slash',
          });
          if (opp.animState !== 'ko' && Math.hypot(opp.x - caster.x, opp.y - caster.y) < 160) {
            applyHit(caster, opp, 14, 190, -210, caster.facing, 0.04, 0);
          }
        } else if (ta.kind === 'sky_boulder') {
          state.projectiles.push({
            id: state.nextEntityId++,
            ownerSlot: ta.ownerSlot,
            fighterId: caster.id,
            kind: 'boulder_rock',
            x: ta.x,
            y: ta.y,
            vx: (Math.random() - 0.5) * 60,
            vy: 360,
            radius: 22,
            damage: 24,
            knockbackX: 380,
            knockbackY: -360,
            gravity: 960,
            life: 2.2,
            maxLife: 2.2,
            appliesPoison: 0,
            appliesSlow: 0,
            explodeRadius: 95,
            spawnsPuddleOnLand: false,
            rotation: 0,
          });
        } else if (ta.kind === 'volcano_bomb') {
          soundSynth.playSpecial(false);
          state.projectiles.push({
            id: state.nextEntityId++,
            ownerSlot: ta.ownerSlot,
            fighterId: caster.id,
            kind: 'ember_bomb',
            x: caster.x,
            y: caster.y - 68,
            vx: ta.vx ?? 320,
            vy: ta.vy ?? -560,
            radius: 17,
            damage: 20,
            knockbackX: 380,
            knockbackY: -360,
            gravity: 980,
            life: 2.3,
            maxLife: 2.3,
            appliesPoison: 0,
            appliesSlow: 0,
            explodeRadius: 120,
            spawnsPuddleOnLand: false,
            rotation: 0,
          });
        } else if (ta.kind === 'orbital_star') {
          soundSynth.playLaserShot();
          state.projectiles.push({
            id: state.nextEntityId++,
            ownerSlot: ta.ownerSlot,
            fighterId: caster.id,
            kind: 'nova_star',
            x: ta.x,
            y: ta.y,
            vx: ta.vx ?? 150,
            vy: ta.vy ?? 560,
            radius: 16,
            damage: 18,
            knockbackX: 310,
            knockbackY: -280,
            gravity: 160,
            life: 1.8,
            maxLife: 1.8,
            appliesPoison: 0,
            appliesSlow: 0,
            explodeRadius: 85,
            spawnsPuddleOnLand: false,
            rotation: 0,
          });
        } else if (ta.kind === 'eve_cross_cut') {
          soundSynth.playAttack(true);
          const cx = opp.x;
          const cy = opp.y - opp.height * 0.5;
          state.zones.push({
            id: state.nextEntityId++,
            ownerSlot: ta.ownerSlot,
            kind: 'cross_slash',
            x: cx,
            y: cy + 35,
            width: 340,
            height: 70,
            targetHeight: 70,
            life: 0.34,
            maxLife: 0.34,
            angle: ta.angle ?? 0,
            damage: 22,
            knockbackX: 360,
            knockbackY: -290,
            appliesStun: 0,
            appliesPoison: 0,
            appliesSlow: 0,
            blocksProjectiles: false,
            hitTimers: [0, 0],
          });
          state.slashes.push({
            x: cx,
            y: cy,
            facing: ta.facing ?? 1,
            color: '#FAFAFA',
            width: 240,
            height: 120,
            life: 0.28,
            maxLife: 0.28,
            angle: ta.angle ?? 0,
            kind: 'cross_crescent',
          });
        }

        state.timedActions.splice(i, 1);
      }
    };

    const stepProjectiles = (dt: number) => {
      const state = engineRef.current;
      const plats = state.platforms;

      for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const p = state.projectiles[i];
        const prevY = p.y;
        p.life -= dt;

        const target = state.players[p.ownerSlot === 0 ? 1 : 0];
        const attacker = state.players[p.ownerSlot];
        const targetCy = target.y - target.height * 0.5;

        // Homing missile steering (Honey Shell Royal Hornet Barrage)
        if (p.homing && target.animState !== 'ko') {
          const speed = Math.max(360, Math.hypot(p.vx, p.vy));
          const desiredAngle = Math.atan2(targetCy - p.y, target.x - p.x);
          const curAngle = Math.atan2(p.vy, p.vx);
          let diff = desiredAngle - curAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const nextAngle = curAngle + Math.max(-5.2 * dt, Math.min(5.2 * dt, diff));
          p.vx = Math.cos(nextAngle) * speed;
          p.vy = Math.sin(nextAngle) * speed;
          p.rotation = nextAngle;
        }

        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Ricochet Star bounces off walls, ceiling, and platforms
        if (p.bouncesLeft && p.bouncesLeft > 0) {
          let bounced = false;
          if (p.x < 70 && p.vx < 0) {
            p.x = 70;
            p.vx = Math.abs(p.vx);
            bounced = true;
          } else if (p.x > WORLD_WIDTH - 70 && p.vx > 0) {
            p.x = WORLD_WIDTH - 70;
            p.vx = -Math.abs(p.vx);
            bounced = true;
          }
          if (p.y < 40 && p.vy < 0) {
            p.y = 40;
            p.vy = Math.abs(p.vy);
            bounced = true;
          }
          if (p.vy > 0) {
            for (const plat of plats) {
              if (plat.broken) continue;
              if (
                p.x >= plat.x &&
                p.x <= plat.x + plat.width &&
                prevY <= plat.y + 8 &&
                p.y >= plat.y
              ) {
                p.y = plat.y - 2;
                p.vy = -Math.abs(p.vy);
                bounced = true;
                break;
              }
            }
          }
          if (bounced) {
            p.bouncesLeft -= 1;
            soundSynth.playBouncePad();
            spawnParticle(p.x, p.y, 0, 0, 26, '#FDE047', 0.22, 0, 'ring');
          }
        }

        if (
          p.kind === 'venom_honey_drop' ||
          p.kind === 'ember_bomb' ||
          p.kind === 'shuriken_star' ||
          p.kind === 'boulder_rock' ||
          p.kind === 'nova_star'
        ) {
          p.rotation += dt * (p.kind === 'shuriken_star' || p.kind === 'nova_star' ? 14 : 7);
        }

        let blockedByWall = false;
        for (const z of state.zones) {
          if (z.blocksProjectiles && z.ownerSlot !== p.ownerSlot) {
            if (
              Math.abs(p.x - z.x) <= z.width * 0.5 + p.radius &&
              p.y >= z.y - z.height &&
              p.y <= z.y
            ) {
              blockedByWall = true;
              spawnParticle(p.x, p.y, -p.vx * 0.2, -120, 12, '#E0F2FE', 0.22, 0, 'ring');
              break;
            }
          }
        }
        if (blockedByWall) {
          state.projectiles.splice(i, 1);
          continue;
        }

        const dist = Math.hypot(p.x - target.x, p.y - targetCy);

        if (dist <= p.radius + target.width * 0.42) {
          // Moss Golem Aegis Bastion reflects enemy projectiles!
          if (target.shieldTimer > 0) {
            p.ownerSlot = target.slot;
            p.fighterId = target.id;
            p.vx = -p.vx * 1.4;
            p.vy = -Math.abs(p.vy) * 0.6 - 40;
            p.life = Math.max(p.life, 1.1);
            p.damage = Math.round(p.damage * 1.25);
            soundSynth.playBouncePad();
            spawnParticle(p.x, p.y, 0, 0, 34, '#A3E635', 0.25, 0, 'ring');
            continue;
          }

          // BladeZero Shadow Counter parries incoming projectiles!
          if (target.counterTimer > 0) {
            target.counterTimer = 0;
            target.invulnTimer = 0.35;
            soundSynth.playStun();
            spawnParticle(target.x, targetCy, 0, 0, 42, '#EF4444', 0.25, 0, 'ring');
            if (attacker.animState !== 'ko' && Math.hypot(attacker.x - target.x, attacker.y - target.y) < 580) {
              const behindX = Math.max(90, Math.min(WORLD_WIDTH - 90, attacker.x - attacker.facing * 72));
              target.x = behindX;
              target.y = attacker.y;
              target.facing = behindX <= attacker.x ? 1 : -1;
              state.slashes.push({
                x: attacker.x,
                y: attacker.y - attacker.height * 0.5,
                facing: target.facing,
                color: '#EF4444',
                width: 145,
                height: 92,
                life: 0.24,
                maxLife: 0.24,
                angle: -0.35,
                kind: 'iaido_slash',
              });
              applyHit(target, attacker, 32, 520, -340, target.facing, 0.075, 16);
            }
            state.projectiles.splice(i, 1);
            continue;
          }

          const hit = applyHit(
            attacker,
            target,
            p.damage,
            p.knockbackX,
            p.knockbackY,
            p.vx >= 0 ? 1 : -1,
            0.035,
            8,
            {
              appliesSlow: p.appliesSlow,
              appliesPoison: p.appliesPoison,
              appliesConfuse: p.appliesConfuse,
              appliesStun: p.appliesStun,
            }
          );
          if (hit) {
            if (p.pullOnHit) {
              const pullDir: 1 | -1 = attacker.x >= target.x ? 1 : -1;
              target.vx = pullDir * 520;
              target.vy = -210;
              spawnParticle(target.x, targetCy, 0, 0, 30, '#38BDF8', 0.22, 0, 'ring');
            }
            if (p.floatTrap) {
              target.vx *= 0.25;
              target.vy = -490;
              spawnParticle(target.x, targetCy, 0, 0, 38, '#06B6D4', 0.3, 0, 'ring');
            }
            if (p.explodeRadius) {
              const expColor =
                p.kind === 'ember_bomb' ? '#F97316' : p.kind === 'boulder_rock' ? '#22C55E' : '#A855F7';
              detonateExplosion(p.x, p.y, p.ownerSlot, p.explodeRadius, p.damage, p.knockbackX, p.knockbackY, expColor, true);
            }
            if (p.spawnsPuddleOnLand) {
              const surfaceY = findSurfaceYBelow(p.x, target.y);
              spawnHoneyPuddle(p.x, surfaceY, p.ownerSlot);
            }
            state.projectiles.splice(i, 1);
            continue;
          }
        }

        let hitProp = false;
        for (const prop of state.destructibles) {
          if (prop.broken) continue;
          const propCy = prop.y - prop.height * 0.5;
          if (
            Math.abs(p.x - prop.x) <= prop.width * 0.5 + p.radius &&
            Math.abs(p.y - propCy) <= prop.height * 0.5 + p.radius
          ) {
            if (p.explodeRadius) {
              const expColor =
                p.kind === 'ember_bomb' ? '#F97316' : p.kind === 'boulder_rock' ? '#22C55E' : '#A855F7';
              detonateExplosion(p.x, p.y, p.ownerSlot, p.explodeRadius, p.damage, p.knockbackX, p.knockbackY, expColor, false);
            } else {
              damageDestructible(prop, p.ownerSlot, p.damage);
            }
            if (p.spawnsPuddleOnLand) {
              const surfaceY = findSurfaceYBelow(p.x, prop.y);
              spawnHoneyPuddle(p.x, surfaceY, p.ownerSlot);
            }
            hitProp = true;
            break;
          }
        }
        if (hitProp) {
          state.projectiles.splice(i, 1);
          continue;
        }

        if (
          (p.spawnsPuddleOnLand || p.explodeRadius || p.kind === 'ember_bomb' || p.kind === 'boulder_rock') &&
          p.vy > 0
        ) {
          let landedOnPlat = false;
          for (const plat of plats) {
            if (plat.broken) continue;
            if (
              p.x >= plat.x &&
              p.x <= plat.x + plat.width &&
              prevY <= plat.y + 8 &&
              p.y >= plat.y
            ) {
              const impactColor =
                p.kind === 'ember_bomb'
                  ? '#F97316'
                  : p.kind === 'boulder_rock'
                  ? '#22C55E'
                  : p.kind === 'nova_star'
                  ? '#A855F7'
                  : '#FBBF24';
              if (p.explodeRadius) {
                detonateExplosion(
                  p.x,
                  plat.y,
                  p.ownerSlot,
                  p.explodeRadius,
                  p.damage,
                  p.knockbackX,
                  p.knockbackY,
                  impactColor,
                  false
                );
              } else {
                if (plat.destructible) {
                  damagePlatform(plat, p.kind === 'boulder_rock' ? 20 : 14, p.x, impactColor);
                }
                if (p.spawnsPuddleOnLand) {
                  spawnHoneyPuddle(p.x, plat.y, p.ownerSlot);
                } else {
                  for (let k = 0; k < 8; k++) {
                    spawnParticle(
                      p.x,
                      plat.y - 4,
                      (Math.random() - 0.5) * 220,
                      -90 - Math.random() * 140,
                      5,
                      impactColor,
                      0.28,
                      320,
                      'spark'
                    );
                  }
                }
              }
              landedOnPlat = true;
              break;
            }
          }
          if (landedOnPlat) {
            state.projectiles.splice(i, 1);
            continue;
          }
        }

        if (
          p.life <= 0 ||
          p.y > BLAST_ZONE.bottom ||
          p.x < BLAST_ZONE.left ||
          p.x > BLAST_ZONE.right
        ) {
          state.projectiles.splice(i, 1);
        }
      }
    };

    const stepZones = (dt: number) => {
      const state = engineRef.current;
      for (let i = state.zones.length - 1; i >= 0; i--) {
        const z = state.zones[i];
        const prevTelegraph = z.telegraphTimer ?? 0;
        if (z.telegraphTimer !== undefined && z.telegraphTimer > 0) {
          z.telegraphTimer = Math.max(0, z.telegraphTimer - dt);
        }
        z.life -= dt;
        z.hitTimers[0] = Math.max(0, z.hitTimers[0] - dt);
        z.hitTimers[1] = Math.max(0, z.hitTimers[1] - dt);

        if (z.height < z.targetHeight) {
          z.height = Math.min(z.targetHeight, z.height + (z.targetHeight / 0.14) * dt);
        }

        const opponentSlot: 0 | 1 = z.ownerSlot === 0 ? 1 : 0;
        const target = state.players[opponentSlot];
        const attacker = state.players[z.ownerSlot];
        const targetCy = target.y - target.height * 0.5;

        if (z.kind === 'railgun_beam') {
          if (z.telegraphTimer !== undefined && z.telegraphTimer > 0) {
            // Track opponent smoothly during lock-on phase
            const desiredAngle = Math.atan2(targetCy - z.y, target.x - z.x);
            let diff = desiredAngle - (z.angle ?? 0);
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            z.angle = (z.angle ?? 0) + Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
          } else {
            if (prevTelegraph > 0) {
              soundSynth.playUltimate();
              state.shakeIntensity = Math.max(state.shakeIntensity, 12);
              state.lightningFlash = Math.max(state.lightningFlash, 0.7);
            }
            const ang = z.angle ?? 0;
            const x2 = z.x + Math.cos(ang) * z.width;
            const y2 = z.y + Math.sin(ang) * z.width;

            if (z.hitTimers[opponentSlot] <= 0 && target.animState !== 'ko') {
              if (distToSegment(target.x, targetCy, z.x, z.y, x2, y2) <= z.height * 0.6 + target.width * 0.35) {
                z.hitTimers[opponentSlot] = 0.6;
                const pushDir: 1 | -1 = Math.cos(ang) >= 0 ? 1 : -1;
                applyHit(attacker, target, z.damage, z.knockbackX, z.knockbackY, pushDir, 0.065, 0, {
                  appliesStun: z.appliesStun,
                });
              }
            }
            for (const prop of state.destructibles) {
              if (prop.broken || prop.hitCooldown > 0) continue;
              if (distToSegment(prop.x, prop.y - prop.height * 0.5, z.x, z.y, x2, y2) <= z.height * 0.6 + prop.width * 0.4) {
                damageDestructible(prop, z.ownerSlot, z.damage);
              }
            }
          }
        } else if (z.kind === 'cross_slash') {
          const cy = z.y - z.height * 0.5;
          const ang = z.angle ?? 0;
          const halfW = z.width * 0.5;
          const x1 = z.x - Math.cos(ang) * halfW;
          const y1 = cy - Math.sin(ang) * halfW;
          const x2 = z.x + Math.cos(ang) * halfW;
          const y2 = cy + Math.sin(ang) * halfW;

          if (z.hitTimers[opponentSlot] <= 0 && target.animState !== 'ko') {
            if (distToSegment(target.x, targetCy, x1, y1, x2, y2) <= 38 + target.width * 0.35) {
              z.hitTimers[opponentSlot] = 0.45;
              const pushDir: 1 | -1 = target.x >= z.x ? 1 : -1;
              applyHit(attacker, target, z.damage, z.knockbackX, z.knockbackY, pushDir, 0.045, 0);
            }
          }
          for (const prop of state.destructibles) {
            if (prop.broken || prop.hitCooldown > 0) continue;
            if (distToSegment(prop.x, prop.y - prop.height * 0.5, x1, y1, x2, y2) <= 38 + prop.width * 0.4) {
              damageDestructible(prop, z.ownerSlot, z.damage);
            }
          }
        } else if (z.kind === 'whirlpool_zone') {
          const cy = z.y - z.height * 0.5;
          const dx = z.x - target.x;
          const dy = cy - targetCy;
          const dist = Math.hypot(dx, dy);
          if (target.animState !== 'ko' && dist > 12 && dist <= z.width * 0.72) {
            const pull = (1 - dist / (z.width * 0.75)) * 420;
            target.vx += (dx / dist) * pull * dt;
            target.vy += (dy / dist) * pull * dt;
            target.slowTimer = Math.max(target.slowTimer, 0.25);
          }
          if (z.hitTimers[opponentSlot] <= 0 && target.animState !== 'ko' && dist <= z.width * 0.48) {
            z.hitTimers[opponentSlot] = 0.55;
            target.hp = Math.max(0, target.hp - z.damage);
            attacker.damageDealt += z.damage;
            target.slowTimer = Math.max(target.slowTimer, z.appliesSlow);
            soundSynth.playHit(false);
          }
          // Final explosive burst as whirlpool expires
          if (z.life <= 0) {
            soundSynth.playStructureBreak();
            spawnParticle(z.x, cy, 0, 0, 120, '#F472B6', 0.32, 0, 'ring');
            if (target.animState !== 'ko' && dist <= z.width * 0.6) {
              const pushDir: 1 | -1 = target.x >= z.x ? 1 : -1;
              applyHit(attacker, target, 28, 340, -540, pushDir, 0.07, 0);
            }
          }
        } else {
          if (z.hitTimers[opponentSlot] <= 0 && target.animState !== 'ko') {
            const zLeft = z.x - z.width * 0.5;
            const zRight = z.x + z.width * 0.5;
            const zTop = z.y - z.height;
            const zBottom = z.y;

            const tLeft = target.x - target.width * 0.4;
            const tRight = target.x + target.width * 0.4;
            const tTop = target.y - target.height;
            const tBottom = target.y;

            const overlaps =
              tRight >= zLeft && tLeft <= zRight && tBottom >= zTop && tTop <= zBottom;

            if (overlaps) {
              if (z.kind === 'honey_puddle') {
                z.hitTimers[opponentSlot] = 0.55;
                target.poisonTimer = Math.max(target.poisonTimer, z.appliesPoison);
                target.poisonSourceSlot = z.ownerSlot;
                target.slowTimer = Math.max(target.slowTimer, z.appliesSlow);
                if (target.poisonTickTimer <= 0) target.poisonTickTimer = 0.3;
                target.hp = Math.max(0, target.hp - z.damage);
                attacker.damageDealt += z.damage;
                soundSynth.playPoisonTick();
              } else if (z.kind === 'glitch_field') {
                z.hitTimers[opponentSlot] = 0.48;
                const pushDir: 1 | -1 = target.x >= z.x ? 1 : -1;
                applyHit(attacker, target, z.damage, z.knockbackX, z.knockbackY, pushDir, 0.03, 0, {
                  appliesSlow: z.appliesSlow,
                  appliesConfuse: z.appliesConfuse,
                });
              } else {
                z.hitTimers[opponentSlot] = 0.65;
                const pushDir: 1 | -1 = target.x >= z.x ? 1 : -1;
                applyHit(
                  attacker,
                  target,
                  z.damage,
                  z.knockbackX,
                  z.knockbackY,
                  pushDir,
                  0.055,
                  10,
                  { appliesStun: z.appliesStun }
                );
              }
            }
          }

          if (z.kind === 'cloud_wall' || z.kind === 'lightning_pillar' || z.kind === 'glitch_field') {
            const zLeft = z.x - z.width * 0.5;
            const zRight = z.x + z.width * 0.5;
            const zTop = z.y - z.height;
            const zBottom = z.y;
            for (const prop of state.destructibles) {
              if (prop.broken || prop.hitCooldown > 0) continue;
              const pLeft = prop.x - prop.width * 0.5;
              const pRight = prop.x + prop.width * 0.5;
              const pTop = prop.y - prop.height;
              const pBottom = prop.y;
              if (pRight >= zLeft && pLeft <= zRight && pBottom >= zTop && pTop <= zBottom) {
                damageDestructible(prop, z.ownerSlot, z.damage);
              }
            }
          }
        }

        if (z.life <= 0) {
          state.zones.splice(i, 1);
        }
      }
    };

    const stepVisualEffects = (dt: number) => {
      const state = engineRef.current;
      if (state.shakeIntensity > 0) {
        state.shakeIntensity = Math.max(0, state.shakeIntensity - dt * 36);
      }
      if (state.lightningFlash > 0) {
        state.lightningFlash = Math.max(0, state.lightningFlash - dt * 2.4);
      }

      for (let i = state.slashes.length - 1; i >= 0; i--) {
        state.slashes[i].life -= dt;
        if (state.slashes[i].life <= 0) {
          state.slashes.splice(i, 1);
        }
      }

      for (let i = 0; i < state.particles.length; i++) {
        const p = state.particles[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    };

    const stepVictoryPhase = (dt: number) => {
      const state = engineRef.current;
      stepPlatforms(dt);
      if (state.winnerSlot === null) return;

      const winner = state.players[state.winnerSlot];
      if (winner.animState !== 'victory') {
        winner.animState = 'victory';
        winner.animTimer = 0;
        winner.animDuration = 1.1;
      }

      winner.animTimer += dt;
      winner.squashX += (1 - winner.squashX) * Math.min(1, dt * 12);
      winner.squashY += (1 - winner.squashY) * Math.min(1, dt * 12);

      // Settle airborne winner cleanly onto stage so their victory pose is showcased
      if (!winner.grounded) {
        const mainPlat = state.platforms[0];
        if (winner.x < mainPlat.x + 60 || winner.x > mainPlat.x + mainPlat.width - 60) {
          winner.x += (WORLD_WIDTH * 0.5 - winner.x) * Math.min(1, dt * 4);
        }
        const prevY = winner.y;
        winner.vy = Math.min(MAX_FALL_SPEED, winner.vy + GRAVITY * dt);
        winner.y += winner.vy * dt;
        if (winner.vy >= 0) {
          for (const plat of state.platforms) {
            if (plat.broken) continue;
            const withinX =
              winner.x + winner.width * 0.28 >= plat.x &&
              winner.x - winner.width * 0.28 <= plat.x + plat.width;
            const crossedTop = prevY <= plat.y + 10 && winner.y >= plat.y;
            if (withinX && crossedTop) {
              winner.y = plat.y;
              winner.vy = 0;
              winner.grounded = true;
              winner.squashX = 1.16;
              winner.squashY = 0.84;
              break;
            }
          }
        }
        if (!winner.grounded && winner.y > mainPlat.y) {
          winner.y = mainPlat.y;
          winner.vy = 0;
          winner.grounded = true;
        }
      }

      if (Math.random() < dt * 7) {
        const accent = FIGHTER_SPECS[winner.id].accentColor;
        spawnParticle(
          winner.x + (Math.random() - 0.5) * 76,
          winner.y - 12 - Math.random() * 48,
          (Math.random() - 0.5) * 45,
          -95 - Math.random() * 85,
          4 + Math.random() * 3,
          Math.random() < 0.5 ? accent : '#FBBF24',
          0.6,
          40,
          'spark'
        );
      }
    };

    const stepAttractDemo = (dt: number) => {
      const state = engineRef.current;
      state.matchTime += dt;
      stepPlatforms(dt);
      for (const obs of state.obstacles) {
        obs.timer += dt;
        if (obs.kind === 'wind_bumper') obs.angle += dt * 3.5;
        if (obs.kind === 'eclipse_pendulum') {
          const swingAngle = Math.sin((obs.timer / (obs.period ?? 3.4)) * Math.PI * 2) * 1.05;
          obs.currentX = obs.x + Math.sin(swingAngle) * (obs.swingRadius ?? 155);
          obs.currentY = obs.y + Math.cos(swingAngle) * (obs.swingRadius ?? 155);
        } else if (obs.kind === 'hover_car') {
          const period = obs.period ?? 5.0;
          const phase = obs.timer % period;
          const telegraphStart = period - 2.65;
          const activeStart = period - 1.55;
          if (phase < telegraphStart) {
            obs.state = 'idle';
            obs.currentX = -400;
          } else if (phase < activeStart) {
            obs.state = 'telegraph';
          } else {
            obs.state = 'active';
            const activeElapsed = phase - activeStart;
            const spd = obs.speed ?? 820;
            const dir = obs.direction ?? 1;
            obs.currentX =
              dir === 1
                ? -140 + activeElapsed * spd
                : WORLD_WIDTH + 140 - activeElapsed * spd;
            obs.currentY = obs.y;
          }
        } else if (obs.kind === 'hive_swarm') {
          const t = (obs.timer / (obs.period ?? 7.5)) * Math.PI * 2;
          obs.currentX = obs.x + Math.sin(t) * 320;
          obs.currentY = obs.y + Math.sin(t * 2) * 82;
        } else if (obs.kind === 'lightning_arc') {
          const phase = obs.timer % (obs.period ?? 4.8);
          obs.state = phase < 2.5 ? 'idle' : phase < 3.7 ? 'telegraph' : 'active';
        } else if (obs.kind === 'icicle_drop') {
          const phase = obs.timer % (obs.period ?? 4.6);
          if (phase < 2.2) {
            obs.state = 'idle';
            obs.currentX = obs.x;
            obs.currentY = 42;
          } else if (phase < 3.4) {
            obs.state = 'telegraph';
            obs.currentX = obs.x;
            obs.currentY = 42;
          } else {
            obs.state = 'active';
            obs.currentX = obs.x;
            obs.currentY = 42 + Math.min(1, (phase - 3.4) / 0.48) * (obs.y - 42);
          }
        } else if (obs.kind === 'crusher_piston') {
          const phase = obs.timer % (obs.period ?? 5.0);
          if (phase < 2.2) {
            obs.state = 'idle';
            obs.currentY = 210;
          } else if (phase < 3.4) {
            obs.state = 'telegraph';
            obs.currentY = 210 + Math.sin(obs.timer * 34) * 3;
          } else if (phase < 4.1) {
            obs.state = 'active';
            obs.currentY = 210 + Math.min(1, (phase - 3.4) / 0.16) * (obs.y - 210);
          } else {
            obs.state = 'idle';
            obs.currentY = obs.y - Math.min(1, (phase - 4.1) / 0.9) * (obs.y - 210);
          }
        } else if (obs.kind === 'whirlpool_vortex') {
          const phase = obs.timer % (obs.period ?? 5.6);
          obs.state = phase < 2.0 ? 'idle' : phase < 3.2 ? 'telegraph' : 'active';
        } else if (obs.kind === 'laser_sweeper') {
          const period = obs.period ?? 5.4;
          const phase = obs.timer % period;
          if (phase < 1.8) {
            obs.state = 'idle';
            obs.angle = -0.85;
          } else if (phase < 3.0) {
            obs.state = 'telegraph';
            obs.angle = -0.85;
          } else {
            obs.state = 'active';
            obs.angle = -0.85 + Math.min(1, (phase - 3.0) / (period - 3.0)) * 1.7;
          }
        }
      }
      for (const p of state.players) {
        p.animTimer += dt;
        p.squashX += (1 - p.squashX) * Math.min(1, dt * 10);
        p.squashY += (1 - p.squashY) * Math.min(1, dt * 10);
      }
      stepVisualEffects(dt);
    };

    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const state = engineRef.current;
      state.ambientTime += dt;

      if (state.phase === 'TITLE_MENU') {
        stepAttractDemo(dt);
      } else if (state.phase === 'PLAYING') {
        state.matchTime += dt;

        if (state.hitstopTimer > 0) {
          state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
          stepVisualEffects(dt * 0.25);
        } else {
          stepPlatforms(dt);
          stepDestructibles(dt);
          stepFighter(state.players[0], state.players[1], dt);
          if (state.phase === 'PLAYING') {
            stepFighter(state.players[1], state.players[0], dt);
          }
          stepTimedActions(dt);
          stepProjectiles(dt);
          stepZones(dt);
          stepObstacles(dt);
          stepVisualEffects(dt);
        }

        // Record last 30 seconds of player inputs & game state
        const buf = replayFramesRef.current;
        const frameTime = state.matchTime;
        buf.push(captureReplayFrame(state, frameInputsRef.current, frameTime));
        const cutoff = frameTime - 30;
        while (buf.length > 1 && buf[0].matchTime < cutoff) {
          buf.shift();
        }

        justPressedRef.current.clear();

        if (now - lastHudSyncRef.current > 80) {
          lastHudSyncRef.current = now;
          setHud(buildHudSnapshot(state));
        }
      } else if (state.phase === 'GAME_OVER') {
        stepVictoryPhase(dt);
        stepVisualEffects(dt);

        if (victoryRecordTailRef.current < 1.2) {
          victoryRecordTailRef.current += dt;
          const tailTime = state.matchTime + victoryRecordTailRef.current;
          const buf = replayFramesRef.current;
          buf.push(
            captureReplayFrame(
              state,
              [{ ...EMPTY_REPLAY_INPUT }, { ...EMPTY_REPLAY_INPUT }],
              tailTime
            )
          );
          const cutoff = tailTime - 30;
          while (buf.length > 1 && buf[0].matchTime < cutoff) {
            buf.shift();
          }
          if (buf.length >= 2 && now - lastHudSyncRef.current > 200) {
            lastHudSyncRef.current = now;
            setReplayDurationSec(
              Math.max(1, Math.round(buf[buf.length - 1].matchTime - buf[0].matchTime))
            );
          }
        }
      } else if (state.phase === 'REPLAY') {
        const frames = replayFramesRef.current;
        if (frames.length >= 2) {
          const startT = frames[0].matchTime;
          const endT = frames[frames.length - 1].matchTime;
          const duration = Math.max(0.016, endT - startT);

          if (replayPlayingRef.current) {
            replayElapsedRef.current += dt * replaySpeedRef.current;
            if (replayElapsedRef.current >= duration) {
              replayElapsedRef.current = duration;
              replayPlayingRef.current = false;
            }
          }

          const targetT = startT + replayElapsedRef.current;
          let lo = 0;
          let hi = frames.length - 1;
          while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (frames[mid].matchTime <= targetT) lo = mid;
            else hi = mid - 1;
          }

          applyReplayFrame(state, frames[lo]);

          if (now - lastHudSyncRef.current > 65 || !replayPlayingRef.current) {
            lastHudSyncRef.current = now;
            setHud(buildHudSnapshot(state));
            syncReplayUi(lo);
          }
        }
      }

      renderGameFrame(ctx, canvasPixelWidth, canvasPixelHeight, state);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [spawnParticle, syncHudImmediate, syncReplayUi]);

  const p1 = hud.players[0];
  const p2 = hud.players[1];
  const p1Spec = FIGHTER_SPECS[p1.id];
  const p2Spec = FIGHTER_SPECS[p2.id];

  const winner = hud.winnerSlot !== null ? hud.players[hud.winnerSlot] : null;

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-[100dvh] overflow-hidden bg-slate-950 select-none"
    >
      {/* Isolated 60fps HTML5 Canvas Engine Surface */}
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Top-Right Utility Controls */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-950/80 border border-white/15 text-slate-200 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {(hud.phase === 'PLAYING' || hud.phase === 'PAUSED') && (
          <button
            type="button"
            onClick={togglePause}
            aria-label={hud.phase === 'PAUSED' ? 'Resume match' : 'Pause match'}
            className="h-10 px-3 flex items-center gap-1.5 rounded-lg bg-slate-950/80 border border-white/15 text-slate-200 hover:bg-slate-900 hover:text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {hud.phase === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{hud.phase === 'PAUSED' ? 'Resume' : 'Pause'}</span>
          </button>
        )}

        {hud.phase === 'REPLAY' && (
          <button
            type="button"
            onClick={exitReplay}
            className="h-10 px-3 flex items-center gap-1.5 rounded-lg bg-slate-950/85 border border-white/15 text-slate-200 hover:bg-slate-900 hover:text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Results</span>
          </button>
        )}
      </div>

      {/* Unobstructed Active Match & Replay Perimeter HUD */}
      {(hud.phase === 'PLAYING' || hud.phase === 'PAUSED' || hud.phase === 'REPLAY') && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4 pr-28 sm:pr-36">
            <FighterHudCard player={p1} spec={p1Spec} align="left" />

            <div className="hidden md:flex flex-col items-center pt-1">
              {hud.phase === 'REPLAY' ? (
                <>
                  <span className="font-mono-num text-xs font-extrabold tracking-widest text-amber-400 drop-shadow">
                    MATCH REPLAY · {replayHud.speed}x
                  </span>
                  <span className="font-mono-num text-lg font-bold text-white drop-shadow">
                    {replayHud.elapsed.toFixed(1)}s / {replayHud.duration.toFixed(1)}s
                  </span>
                </>
              ) : (
                <>
                  <span className="font-mono-num text-xl font-bold text-white tracking-tight drop-shadow">
                    {String(Math.floor(hud.matchTime / 60)).padStart(2, '0')}:
                    {String(hud.matchTime % 60).padStart(2, '0')}
                  </span>
                  <span className="text-[11px] font-medium text-slate-300/80 whitespace-nowrap">
                    {MAP_SPECS[hud.mapId].name}
                  </span>
                </>
              )}
            </div>

            <FighterHudCard player={p2} spec={p2Spec} align="right" />
          </div>

          {hud.phase === 'REPLAY' ? (
            <div className="pointer-events-auto mx-auto w-full max-w-3xl bg-slate-950/88 border border-white/15 rounded-xl px-4 py-3 shadow-2xl">
              <div className="flex items-center justify-between gap-3 text-[11px] font-mono-num text-slate-300 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-amber-400">P1:</span>
                  {formatReplayInputBadges(replayHud.inputs[0]).length > 0 ? (
                    formatReplayInputBadges(replayHud.inputs[0]).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 font-bold"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">IDLE</span>
                  )}
                </div>

                <div className="text-slate-400 font-semibold hidden sm:block">
                  {MAP_SPECS[hud.mapId].name} · Highlight Window
                </div>

                <div className="flex items-center gap-1.5 min-w-0 justify-end">
                  <span className="font-bold text-sky-400">
                    {p2.isAi ? 'CPU:' : 'P2:'}
                  </span>
                  {formatReplayInputBadges(replayHud.inputs[1]).length > 0 ? (
                    formatReplayInputBadges(replayHud.inputs[1]).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-200 font-bold"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">IDLE</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleReplayPlay}
                  aria-label={replayHud.playing ? 'Pause replay' : 'Play replay'}
                  className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {replayHud.playing ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {replayHud.playing
                      ? 'Pause'
                      : replayHud.elapsed >= replayHud.duration - 0.02
                      ? 'Rewatch'
                      : 'Play'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={restartReplay}
                  aria-label="Restart replay"
                  className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={cycleReplaySpeed}
                  className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-mono-num font-bold text-xs flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5 text-amber-400" />
                  <span>{replayHud.speed}x</span>
                </button>

                <div className="relative flex-1 flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    value={Math.round(
                      (replayHud.elapsed / Math.max(0.016, replayHud.duration)) * 1000
                    )}
                    onChange={(e) => scrubReplay(Number(e.target.value) / 1000)}
                    aria-label="Scrub match replay timeline"
                    className="w-full accent-amber-400 cursor-pointer h-2"
                  />
                  {replayHud.koOffsets.map((offset, idx) => (
                    <span
                      key={idx}
                      title="KO Event"
                      className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-1.5 h-3.5 rounded-sm bg-rose-500 border border-white/70"
                      style={{ left: `calc(${offset * 100}% - 3px)` }}
                    />
                  ))}
                </div>

                <span className="font-mono-num text-[11px] text-slate-300 whitespace-nowrap shrink-0">
                  {replayHud.elapsed.toFixed(1)}s / {replayHud.duration.toFixed(1)}s
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <p className="text-[11px] text-slate-200/75 font-medium tracking-wide bg-slate-950/55 px-3 py-1 rounded-md border border-white/10 whitespace-nowrap">
                {hud.mode === '1P_AI'
                  ? 'A/D Move · W Jump · S Drop · J Attack · K Special · R (W+K) Recovery · L Ultimate · T Taunt · Esc Pause'
                  : 'P1: WASD + J/K/R/L/T · P2: Arrows + , / . / \\ / / / ; · Esc Pause'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Title Screen Shell */}
      {hud.phase === 'TITLE_MENU' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-between gap-3 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-b from-slate-950/75 via-slate-950/35 to-slate-950/85">
          <div className="flex flex-col items-center text-center shrink-0">
            <svg
              viewBox="0 0 460 102"
              className="w-[300px] sm:w-[420px] h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]"
              role="img"
              aria-label="Sky and Hive Brawl"
            >
              <defs>
                <linearGradient id="titleGold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FDE68A" />
                  <stop offset="50%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
              <polygon
                points="32,26 48,17 64,26 64,44 48,53 32,44"
                fill="#F59E0B"
                stroke="#18181B"
                strokeWidth="3"
              />
              <circle cx="412" cy="36" r="14" fill="#E0F2FE" stroke="#18181B" strokeWidth="3" />
              <circle cx="426" cy="40" r="11" fill="#FFFFFF" stroke="#18181B" strokeWidth="3" />
              <text
                x="230"
                y="54"
                textAnchor="middle"
                fill="url(#titleGold)"
                stroke="#18181B"
                strokeWidth="6"
                paintOrder="stroke"
                style={{
                  fontFamily: 'Bricolage Grotesque, sans-serif',
                  fontWeight: 800,
                  fontSize: '40px',
                  letterSpacing: '-0.02em',
                }}
              >
                SKY &amp; HIVE BRAWL
              </text>
              <text
                x="230"
                y="84"
                textAnchor="middle"
                fill="#E2E8F0"
                style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontWeight: 600,
                  fontSize: '13px',
                  letterSpacing: '0.08em',
                }}
              >
                10 FIGHTERS · 10 INTERACTIVE STAGES
              </text>
            </svg>
          </div>

          <div className="w-full max-w-6xl bg-slate-950/88 border border-white/15 rounded-xl p-4 sm:p-5 shadow-2xl">
            <PersistentScoreboard
              scoreboard={scoreboard}
              activeMode={selectedMode}
              onReset={resetScoreboard}
              onUiClick={() => soundSynth.playUiClick()}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Mode & 10 Interactive Maps */}
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-1.5">Battle Mode</div>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        soundSynth.playUiClick();
                        setSelectedMode('1P_AI');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedMode === '1P_AI'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      1P vs CPU
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundSynth.playUiClick();
                        setSelectedMode('2P_LOCAL');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedMode === '2P_LOCAL'
                          ? 'bg-sky-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      2P Local
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-1.5">Arena Stage</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        'hive_canopy',
                        'storm_citadel',
                        'magma_foundry',
                        'wind_mill_spire',
                        'eclipse_temple',
                        'neon_skyline',
                        'frost_glacier',
                        'cyber_factory',
                        'coral_abyss',
                        'cosmic_station',
                      ] as MapId[]
                    ).map((mId) => {
                      const m = MAP_SPECS[mId];
                      const active = selectedMap === mId;
                      return (
                        <button
                          key={mId}
                          type="button"
                          onClick={() => {
                            soundSynth.playUiClick();
                            setSelectedMap(mId);
                          }}
                          className={`text-left px-2 py-1.5 rounded-md border transition-colors cursor-pointer ${
                            active
                              ? 'bg-white text-slate-950 border-white'
                              : 'bg-slate-900/90 text-slate-300 border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="text-[11px] font-bold truncate leading-tight">{m.name}</div>
                          <div
                            className={`text-[9px] truncate leading-tight mt-0.5 ${
                              active ? 'text-slate-700 font-medium' : 'text-slate-400'
                            }`}
                          >
                            {m.subtitle}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
                    {MAP_SPECS[selectedMap].mechanicNote}
                  </p>
                </div>
              </div>

              <FighterSelectorColumn
                label="Player 1"
                selected={p1Fighter}
                onSelect={(id) => {
                  soundSynth.playUiClick();
                  setP1Fighter(id);
                }}
              />

              <FighterSelectorColumn
                label={selectedMode === '1P_AI' ? 'CPU Opponent' : 'Player 2'}
                selected={p2Fighter}
                onSelect={(id) => {
                  soundSynth.playUiClick();
                  setP2Fighter(id);
                }}
              />
            </div>

            <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                3 Attacks · Special · Up-Recovery (R / W+K) · Ultimate · Stage Obstacles
              </span>
              <button
                type="button"
                onClick={startMatch}
                className="w-full sm:w-auto px-7 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Start Match
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-300/85 font-medium tracking-wide text-center">
            WASD Move · W Jump · J Attacks · K Special · R (W+K) Recovery · L Ultimate · T Taunt · Esc Pause
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {hud.phase === 'PAUSED' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-xl p-6 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-white">Match Paused</h2>
            <p className="text-sm text-slate-400 mt-1">
              {p1Spec.name} vs {p2Spec.name} · {MAP_SPECS[hud.mapId].name}
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={togglePause}
                className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                Resume Match
              </button>
              <button
                type="button"
                onClick={startMatch}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-white/10 transition-colors cursor-pointer"
              >
                Restart Match
              </button>
              <button
                type="button"
                onClick={returnToTitle}
                className="w-full py-2.5 px-4 rounded-lg bg-transparent hover:bg-slate-800 text-slate-300 font-medium text-sm border border-white/10 transition-colors cursor-pointer"
              >
                Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Specialized Winner's Podium Overlay */}
      {hud.phase === 'GAME_OVER' && winner && (
        <WinnersPodiumOverlay
          winner={winner}
          runnerUp={winner.slot === 0 ? p2 : p1}
          mapName={MAP_SPECS[hud.mapId].name}
          replayAvailable={replayAvailable}
          replayDurationSec={replayDurationSec}
          onWatchReplay={startReplay}
          onRematch={rematchMatch}
          onReturnToTitle={returnToTitle}
        />
      )}
    </div>
  );
}

function FighterHudCard({
  player,
  spec,
  align,
}: {
  player: HudSnapshot['players'][number];
  spec: (typeof FIGHTER_SPECS)[FighterId];
  align: 'left' | 'right';
}) {
  const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const ultReady = player.ultCharge >= 100;
  const tag = player.slot === 0 ? 'P1' : player.isAi ? 'CPU' : 'P2';

  const activeStatuses: string[] = [];
  if (player.confused) activeStatuses.push('Confused');
  if (player.stunned) activeStatuses.push('Stunned');
  if (player.poisoned) activeStatuses.push('Poisoned');
  if (player.slowed) activeStatuses.push('Slowed');

  return (
    <div
      className={`w-60 sm:w-72 bg-slate-950/80 border border-white/15 rounded-xl p-3 shadow-lg ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <div
        className={`flex items-baseline justify-between gap-2 ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span
            className="font-mono-num text-xs font-bold shrink-0"
            style={{ color: spec.accentColor }}
          >
            {tag}
          </span>
          <span className="font-display font-bold text-sm text-white truncate">
            {player.name}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0" aria-label={`${player.stocks} hearts remaining`}>
          {Array.from({ length: STARTING_STOCKS }).map((_, idx) => {
            const filled = idx < player.stocks;
            return (
              <svg
                key={idx}
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5"
                aria-hidden="true"
              >
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill={filled ? '#EF4444' : 'rgba(148,163,184,0.2)'}
                  stroke={filled ? '#FCA5A5' : 'rgba(148,163,184,0.35)'}
                  strokeWidth="1.5"
                />
              </svg>
            );
          })}
        </div>
      </div>

      <div className="mt-2 h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full transition-[width] duration-75"
          style={{
            width: `${hpPct}%`,
            backgroundColor: hpPct > 35 ? spec.accentColor : '#EF4444',
          }}
        />
      </div>

      <div
        className={`mt-1.5 flex items-center justify-between text-[11px] font-mono-num text-slate-300 ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        <span>
          HP {player.hp}/{player.maxHp}
        </span>
        <span className={ultReady ? 'text-amber-300 font-bold' : 'text-slate-400'}>
          ULT {ultReady ? 'READY' : `${player.ultCharge}%`}
        </span>
        <span className="text-slate-400">
          {activeStatuses.length > 0 ? activeStatuses.join(' · ') : formatAnimLabel(player.animState)}
        </span>
      </div>
    </div>
  );
}

function FighterSelectorColumn({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: FighterId;
  onSelect: (id: FighterId) => void;
}) {
  const summaries: Record<FighterId, string> = {
    honey_shell: 'Venom Honey Pool · Ult: +45 HP Heal & Homing Hornets',
    cloudier: 'Projectile-Blocking Wall · Ult: Triple Storm Pillars',
    eve: '56 DMG Slow Cleave · Ult: Shadow Blink Cross-Cuts',
    spidra: '3.5s Confuse Cone · Ult: Glitch Jammer Field',
    marshal_bolt: 'Stun Lasso Pull · Ult: Lock-On Railgun Beam',
    pyro_jack: 'Explosive Ember Bomb · Ult: Volcano Bomb Eruption',
    aqua_nyx: 'Float Bubble Prison · Ult: Suction Whirlpool',
    blade_zero: 'Teleport Parry Counter · Ult: 5-Hit Judgement Blitz',
    moss_golem: 'Reflect & Armor Bastion · Ult: Sky Meteor Rain',
    astro_pip: '3-Bounce Ricochet Star · Ult: Speed Boost + Starfall',
  };

  const selectedSpec = FIGHTER_SPECS[selected];

  return (
    <div className="flex flex-col">
      <div className="text-xs font-semibold text-slate-400 mb-1.5">{label}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            'honey_shell',
            'cloudier',
            'eve',
            'spidra',
            'marshal_bolt',
            'pyro_jack',
            'aqua_nyx',
            'blade_zero',
            'moss_golem',
            'astro_pip',
          ] as FighterId[]
        ).map((id) => {
          const spec = FIGHTER_SPECS[id];
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`text-left px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                active
                  ? 'bg-slate-800 border-amber-400/75 text-white'
                  : 'bg-slate-900/80 border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <FighterMiniIcon id={id} />
                <span className="font-display font-bold text-xs truncate">{spec.name}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[9px] font-mono-num text-slate-400">
                <span>HP {spec.cardStats.heart}</span>
                <span>ATK {spec.cardStats.attack}</span>
                <span>SPD {spec.cardStats.lightning}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/10">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-bold text-white truncate">{selectedSpec.name}</span>
          <span className="font-medium truncate" style={{ color: selectedSpec.accentColor }}>
            {selectedSpec.title}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 truncate mt-0.5">{summaries[selected]}</div>
      </div>
    </div>
  );
}

function FighterMiniIcon({ id }: { id: FighterId }) {
  if (id === 'honey_shell') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
        <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="#F59E0B" stroke="#18181B" strokeWidth="2" />
        <circle cx="12" cy="12" r="3" fill="#FEF3C7" />
      </svg>
    );
  }
  if (id === 'cloudier') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
        <circle cx="10" cy="13" r="6" fill="#E0F2FE" stroke="#18181B" strokeWidth="2" />
        <circle cx="15" cy="14" r="5" fill="#FFFFFF" stroke="#18181B" strokeWidth="2" />
      </svg>
    );
  }
  if (id === 'eve') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="#18181B" stroke="#FAFAFA" strokeWidth="2" />
        <path d="M12 4 A8 8 0 0 0 12 20 Z" fill="#FAFAFA" />
      </svg>
    );
  }
  if (id === 'marshal_bolt') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
        <circle cx="12" cy="4" r="2.2" fill="#F43F5E" />
        <rect x="7" y="5.5" width="10" height="5" rx="1.5" fill="#1E293B" stroke="#FBBF24" strokeWidth="1.2" />
        <path d="M3 10.5 Q12 8.5 21 10.5 Q12 12 3 10.5 Z" fill="#334155" stroke="#18181B" strokeWidth="1.2" />
        <rect x="6.5" y="11.5" width="11" height="8" rx="2.5" fill="#1E3A8A" stroke="#818CF8" strokeWidth="1.5" />
        <rect x="8.5" y="13.5" width="7" height="3.5" rx="1" fill="#09090B" />
        <circle cx="10.5" cy="15.2" r="1" fill="#38BDF8" />
        <circle cx="13.5" cy="15.2" r="1" fill="#38BDF8" />
      </svg>
    );
  }
  if (id === 'pyro_jack') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
        <path d="M9 7 Q12 1 15 7" fill="#FACC15" stroke="#F97316" strokeWidth="1.6" />
        <ellipse cx="12" cy="14" rx="8" ry="6.5" fill="#F97316" stroke="#18181B" strokeWidth="1.8" />
        <polygon points="8,12 10.5,11 10,13.5" fill="#FEF08A" />
        <polygon points="16,12 13.5,11 14,13.5" fill="#FEF08A" />
        <path d="M8.5 16.5 Q12 19 15.5 16.5" stroke="#FEF08A" strokeWidth="1.8" fill="none" />
      </svg>
    );
  }
  if (id === 'aqua_nyx') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
        <path d="M4 13 A8 8 0 0 1 20 13 Z" fill="#06B6D4" stroke="#18181B" strokeWidth="1.8" />
        <circle cx="9.5" cy="9.5" r="1.4" fill="#F472B6" />
        <circle cx="14.5" cy="9" r="1.2" fill="#CFFAFE" />
        <path d="M7 14 Q6 18 8 21 M12 14 Q13 18 11.5 21 M17 14 Q18 18 16 21" stroke="#F472B6" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (id === 'blade_zero') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
        <path d="M7 6 L4 2 L10 5 Z M17 6 L20 2 L14 5 Z" fill="#EF4444" />
        <rect x="6" y="6" width="12" height="12" rx="3" fill="#CBD5E1" stroke="#18181B" strokeWidth="1.8" />
        <rect x="8" y="10" width="9" height="3.5" rx="1" fill="#09090B" />
        <rect x="9.5" y="11" width="6" height="1.5" fill="#EF4444" />
      </svg>
    );
  }
  if (id === 'moss_golem') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
        <rect x="4.5" y="6" width="15" height="14" rx="3.5" fill="#64748B" stroke="#18181B" strokeWidth="1.8" />
        <path d="M5 8 Q9 3 12 6 Q15 3 19 8" fill="#22C55E" stroke="#18181B" strokeWidth="1.4" />
        <circle cx="9.5" cy="12.5" r="1.6" fill="#A3E635" />
        <circle cx="14.5" cy="12.5" r="1.6" fill="#A3E635" />
      </svg>
    );
  }
  if (id === 'astro_pip') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12.5" r="8" fill="#9333EA" fillOpacity="0.25" stroke="#E9D5FF" strokeWidth="1.8" />
        <circle cx="12" cy="13" r="5" fill="#FDBA74" stroke="#18181B" strokeWidth="1.4" />
        <circle cx="10.2" cy="12.3" r="1" fill="#18181B" />
        <circle cx="13.8" cy="12.3" r="1" fill="#18181B" />
        <circle cx="12" cy="2.5" r="1.5" fill="#FDE047" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
      <line x1="9" y1="6" x2="6" y2="2" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="6" x2="18" y2="2" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
      <rect x="5" y="6" width="14" height="10" rx="2.5" fill="#334155" stroke="#10B981" strokeWidth="1.8" />
      <rect x="7" y="8" width="10" height="6" rx="1" fill="#064E3B" />
      <path d="M8 16 L4 21 M10 16 L8 21 M14 16 L16 21 M16 16 L20 21" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WinnersPodiumOverlay({
  winner,
  runnerUp,
  mapName,
  replayAvailable,
  replayDurationSec,
  onWatchReplay,
  onRematch,
  onReturnToTitle,
}: {
  winner: HudSnapshot['players'][number];
  runnerUp: HudSnapshot['players'][number];
  mapName: string;
  replayAvailable: boolean;
  replayDurationSec: number;
  onWatchReplay: () => void;
  onRematch: () => void;
  onReturnToTitle: () => void;
}) {
  const podiumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spec = FIGHTER_SPECS[winner.id];
  const winnerTag = winner.slot === 0 ? 'Player 1' : winner.isAi ? 'CPU' : 'Player 2';
  const runnerTag = runnerUp.slot === 0 ? 'Player 1' : runnerUp.isAi ? 'CPU' : 'Player 2';

  useEffect(() => {
    const canvas = podiumCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const logicalW = 460;
    const logicalH = 216;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(logicalW * dpr);
    canvas.height = Math.floor(logicalH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      renderWinnersPodiumStage(ctx, logicalW, logicalH, winner.id, winner.slot, 0.35);
      return;
    }

    let rafId = 0;
    const startMs = performance.now();
    const renderFrame = (now: number) => {
      const elapsed = (now - startMs) / 1000;
      renderWinnersPodiumStage(ctx, logicalW, logicalH, winner.id, winner.slot, elapsed);
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [winner.id, winner.slot]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="winners-podium-title"
      className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/65 p-4"
    >
      <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto bg-slate-900/95 border border-white/15 rounded-xl p-5 sm:p-6 shadow-2xl text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-400">
          <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Winner&apos;s Podium</span>
        </div>

        <h2
          id="winners-podium-title"
          className="font-display text-3xl font-extrabold text-white mt-1 text-balance"
        >
          {winnerTag} Wins
        </h2>
        <p className="text-sm text-slate-300 mt-1">
          <span className="font-semibold" style={{ color: spec.accentColor }}>
            {winner.name}
          </span>
          <span className="mx-1.5 text-slate-500" aria-hidden="true">
            ·
          </span>
          <span>{mapName}</span>
        </p>

        {/* Animated Winner's Podium Canvas */}
        <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-slate-950">
          <canvas
            ref={podiumCanvasRef}
            aria-label={`${winner.name} performing victory animation atop the Winner's Podium`}
            className="block w-full aspect-[460/216]"
          />
        </div>

        {/* Winner Metrics Row */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-white/10 py-2">
          <div>
            <div className="text-[11px] font-medium text-slate-400">Total KOs</div>
            <div className="font-mono-num text-2xl font-extrabold text-amber-400 mt-0.5">
              {winner.koCount}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Hearts Left</div>
            <div className="font-mono-num text-2xl font-bold text-white mt-0.5">
              {winner.stocks}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Damage Dealt</div>
            <div className="font-mono-num text-2xl font-bold text-white mt-0.5">
              {winner.damageDealt}
            </div>
          </div>
        </div>

        {/* Runner-up line */}
        <div className="mt-1 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono-num">
          <span>
            2nd: {runnerTag} ({runnerUp.name})
          </span>
          <span>
            {runnerUp.koCount} KOs · {runnerUp.damageDealt} DMG
          </span>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {replayAvailable && (
            <button
              type="button"
              onClick={onWatchReplay}
              className="w-full py-2.5 px-4 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              <Film className="w-4 h-4" />
              <span>Watch Replay ({replayDurationSec}s)</span>
            </button>
          )}
          <button
            type="button"
            onClick={onRematch}
            className="flex-1 py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Rematch</span>
          </button>
          <button
            type="button"
            onClick={onReturnToTitle}
            className="py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}
