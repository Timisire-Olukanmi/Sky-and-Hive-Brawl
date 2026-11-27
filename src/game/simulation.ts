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
} from './constants';
import type { SerializedEngineSnapshot, SoundEvent } from './onlineTypes';
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
  ReplayInputAction,
  ReplayInputState,
} from './types';

export interface FighterControlInput {
  moveDir: number;
  jumpPressed: boolean;
  downHeld: boolean;
  attackComboPressed: boolean;
  tauntPressed: boolean;
  directMove: MoveKey | null;
}

export const EMPTY_CONTROL_INPUT: FighterControlInput = {
  moveDir: 0,
  jumpPressed: false,
  downHeld: false,
  attackComboPressed: false,
  tauntPressed: false,
  directMove: null,
};

export function createParticlePool(size = 200): ParticleEntity[] {
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

export function createMapPlatforms(mapId: MapId): Platform[] {
  return MAP_SPECS[mapId].platforms.map((p) => ({
    ...p,
    prevX: p.x,
    prevY: p.y,
    motion: p.motion ? { ...p.motion } : undefined,
    scars: p.scars ? [...p.scars] : undefined,
  }));
}

export function createMapObstacles(mapId: MapId): ObstacleRuntime[] {
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

export function createMapDestructibles(mapId: MapId): DestructiblePropRuntime[] {
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

export function createFighter(
  slot: 0 | 1,
  id: FighterId,
  isAi: boolean,
  mapId: MapId,
  isDummy = false,
  startingStocks = STARTING_STOCKS
): FighterEntity {
  const spec = FIGHTER_SPECS[id];
  const spawn = MAP_SPECS[mapId].spawnPoints[slot];
  return {
    slot,
    id,
    isAi: isDummy ? false : isAi,
    isDummy,
    dummyAnchorX: spawn.x,
    dummyAnchorY: spawn.y,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    width: isDummy ? 68 : spec.width,
    height: isDummy ? 98 : spec.height,
    facing: slot === 0 ? 1 : -1,
    grounded: true,
    jumpsRemaining: 2,
    recoveryUsed: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    dropThroughTimer: 0,
    hp: isDummy ? 999 : spec.maxHp,
    maxHp: isDummy ? 999 : spec.maxHp,
    stocks: isDummy ? 99 : startingStocks,
    ultCharge: 0,
    damageDealt: 0,
    koCount: 0,
    hitsLanded: 0,
    longestCombo: 0,
    currentComboCount: 0,
    currentComboDamage: 0,
    lastComboCount: 0,
    lastComboDamage: 0,
    comboDisplayTimer: 0,
    comboWindowTimer: 0,
    peakSingleHit: 0,
    heavyHitsLanded: 0,
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

export function createInitialEngineState(
  phase: GamePhase,
  mode: PlayMode,
  mapId: MapId,
  p1Id: FighterId,
  p2Id: FighterId,
  startingStocks = STARTING_STOCKS
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
      createFighter(0, p1Id, false, mapId, false, startingStocks),
      createFighter(1, p2Id, mode === '1P_AI', mapId, mode === 'TRAINING', startingStocks),
    ],
    platforms: createMapPlatforms(mapId),
    obstacles: createMapObstacles(mapId),
    destructibles: createMapDestructibles(mapId),
    projectiles: [],
    zones: [],
    timedActions: [],
    particles: createParticlePool(200),
    slashes: [],
    floatingNumbers: [],
  };
}

export function buildHudSnapshot(state: GameEngineState): HudSnapshot {
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
        isDummy: state.players[0].isDummy,
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
        hitsLanded: state.players[0].hitsLanded,
        longestCombo: state.players[0].longestCombo,
        currentComboCount: state.players[0].currentComboCount,
        currentComboDamage: Math.round(state.players[0].currentComboDamage),
        lastComboCount: state.players[0].lastComboCount,
        lastComboDamage: Math.round(state.players[0].lastComboDamage),
        peakSingleHit: Math.round(state.players[0].peakSingleHit),
        heavyHitsLanded: state.players[0].heavyHitsLanded,
      },
      {
        slot: 1,
        id: state.players[1].id,
        name: state.players[1].isDummy
          ? 'Training Dummy'
          : FIGHTER_SPECS[state.players[1].id].name,
        isAi: state.players[1].isAi,
        isDummy: state.players[1].isDummy,
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
        hitsLanded: state.players[1].hitsLanded,
        longestCombo: state.players[1].longestCombo,
        currentComboCount: state.players[1].currentComboCount,
        currentComboDamage: Math.round(state.players[1].currentComboDamage),
        lastComboCount: state.players[1].lastComboCount,
        lastComboDamage: Math.round(state.players[1].lastComboDamage),
        peakSingleHit: Math.round(state.players[1].peakSingleHit),
        heavyHitsLanded: state.players[1].heavyHitsLanded,
      },
    ],
  };
}

export function serializeEngineSnapshot(state: GameEngineState): SerializedEngineSnapshot {
  return {
    phase: state.phase,
    mode: state.mode,
    mapId: state.mapId,
    matchTime: state.matchTime,
    ambientTime: state.ambientTime,
    hitstopTimer: state.hitstopTimer,
    shakeIntensity: state.shakeIntensity,
    lightningFlash: state.lightningFlash,
    windForceX: state.windForceX,
    winnerSlot: state.winnerSlot,
    players: state.players,
    platforms: state.platforms,
    obstacles: state.obstacles,
    destructibles: state.destructibles,
    projectiles: state.projectiles,
    zones: state.zones,
    slashes: state.slashes,
    activeParticles: state.particles.filter((p) => p.active),
    floatingNumbers: state.floatingNumbers,
  };
}

export function spawnParticleInState(
  state: GameEngineState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  size: number,
  color: string,
  maxLife: number,
  gravity = 320,
  shape: ParticleEntity['shape'] = 'circle'
): void {
  const pool = state.particles;
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
}

function isAttackAnim(anim: AnimState): boolean {
  return (
    anim === 'attack1' ||
    anim === 'attack2' ||
    anim === 'attack3' ||
    anim === 'special' ||
    anim === 'ultimate' ||
    anim === 'recovery'
  );
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function findSurfaceYBelow(state: GameEngineState, x: number, refY: number): number {
  const plats = state.platforms;
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
}

function getPropAccentColor(kind: DestructiblePropRuntime['kind']): string {
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
}

export function stepPlatforms(state: GameEngineState, dt: number): void {
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
        spawnParticleInState(
          state,
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
}

export function stepVisualEffects(state: GameEngineState, dt: number): void {
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

  for (let i = state.floatingNumbers.length - 1; i >= 0; i--) {
    const fn = state.floatingNumbers[i];
    fn.life -= dt;
    if (fn.life <= 0) {
      state.floatingNumbers.splice(i, 1);
      continue;
    }
    fn.x += fn.vx * dt;
    fn.y += fn.vy * dt;
    fn.vy += 120 * dt;
  }
}

export function stepVictoryPhase(state: GameEngineState, dt: number): void {
  stepPlatforms(state, dt);
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
    spawnParticleInState(
      state,
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
}

export function stepAttractDemo(state: GameEngineState, dt: number): void {
  state.matchTime += dt;
  stepPlatforms(state, dt);
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
  stepVisualEffects(state, dt);
}

export function computeAiControls(
  ai: FighterEntity,
  target: FighterEntity,
  state: GameEngineState,
  dt: number
): FighterControlInput {
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

  const plats = state.platforms;
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
      state.projectiles.some(
        (p) =>
          p.ownerSlot !== ai.slot &&
          Math.hypot(p.x - ai.x, p.y - (ai.y - ai.height * 0.5)) < 175
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

  const isConfused = ai.confuseTimer > 0;
  let directMove: MoveKey | null = null;
  if (wantRecovery) directMove = 'recovery';
  else if (wantSpecial) directMove = 'special';
  else if (wantUltimate) directMove = 'ultimate';

  return {
    moveDir: isConfused ? -moveDir : moveDir,
    jumpPressed: isConfused ? wantDrop : wantJump,
    downHeld: isConfused ? wantJump : wantDrop,
    attackComboPressed: wantAttack,
    tauntPressed: wantTaunt,
    directMove,
  };
}

export interface StepCombatOptions {
  startingStocks?: number;
  onMatchEnd?: (winnerSlot: 0 | 1) => void;
}

export function stepCombatFrame(
  state: GameEngineState,
  controls: [FighterControlInput, FighterControlInput],
  dt: number,
  options: StepCombatOptions = {}
): {
  sounds: SoundEvent[];
  inputsUsed: [ReplayInputState, ReplayInputState];
} {
  const sounds: SoundEvent[] = [];
  const startingStocks = options.startingStocks ?? STARTING_STOCKS;
  const inputsUsed: [ReplayInputState, ReplayInputState] = [
    { moveDir: 0, jump: false, down: false, action: null },
    { moveDir: 0, jump: false, down: false, action: null },
  ];

  state.matchTime += dt;

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    stepVisualEffects(state, dt * 0.25);
    return { sounds, inputsUsed };
  }

  const spawnHoneyPuddle = (x: number, y: number, ownerSlot: 0 | 1) => {
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
      spawnParticleInState(
        state,
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
    plat.hp = Math.max(0, plat.hp - dmg);
    plat.shakeTimer = 0.14;

    if (plat.hp <= 0) {
      plat.broken = true;
      plat.respawnTimer = 8.5;
      sounds.push({ type: 'structureBreak' });
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
      spawnParticleInState(state, cx, cy, 0, 0, 48, debrisColor, 0.28, 0, 'ring');
      for (let i = 0; i < 16; i++) {
        const px = plat.x + Math.random() * plat.width;
        spawnParticleInState(
          state,
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
      sounds.push({ type: 'crackHit' });
      for (let i = 0; i < 5; i++) {
        spawnParticleInState(
          state,
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

  const applyHit = (
    attacker: FighterEntity | null,
    defender: FighterEntity,
    damageRaw: number,
    kbX: number,
    kbY: number,
    dir: 1 | -1,
    hitstop: number,
    ultGain: number,
    hitOpts?: {
      appliesSlow?: number;
      appliesPoison?: number;
      appliesStun?: number;
      appliesConfuse?: number;
      isHazard?: boolean;
    }
  ): boolean => {
    if (defender.invulnTimer > 0 || defender.animState === 'ko') return false;

    if (defender.counterTimer > 0 && attacker && !hitOpts?.isHazard) {
      defender.counterTimer = 0;
      defender.invulnTimer = 0.38;
      const behindX = Math.max(90, Math.min(WORLD_WIDTH - 90, attacker.x - attacker.facing * 72));
      defender.x = behindX;
      defender.y = attacker.y;
      defender.facing = behindX <= attacker.x ? 1 : -1;
      sounds.push({ type: 'stun' });
      sounds.push({ type: 'attack', heavy: true });
      spawnParticleInState(
        state,
        defender.x,
        defender.y - defender.height * 0.5,
        0,
        0,
        48,
        '#EF4444',
        0.26,
        0,
        'ring'
      );
      state.slashes.push({
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
    const finalDamage = Math.max(
      hasShield ? 2 : 4,
      Math.round(effectiveRaw * atkMultiplier - defReduction)
    );

    const spawnFloatingNumber = (
      x: number,
      y: number,
      text: string,
      color: string,
      scale = 1,
      maxLife = 0.85
    ) => {
      const list = state.floatingNumbers;
      list.push({
        id: state.nextEntityId++,
        x,
        y,
        vx: (Math.random() - 0.5) * 34,
        vy: -92,
        text,
        color,
        scale,
        life: maxLife,
        maxLife,
      });
      if (list.length > 40) {
        list.shift();
      }
    };

    const heavy = finalDamage >= 24 || (hitOpts?.appliesStun ?? 0) > 0.6;

    defender.hp = Math.max(0, defender.hp - finalDamage);
    if (attacker && attacker.slot !== defender.slot) {
      attacker.damageDealt += finalDamage;
      attacker.ultCharge = Math.min(100, attacker.ultCharge + ultGain);
      if (!hitOpts?.isHazard) {
        attacker.hitsLanded += 1;
        attacker.peakSingleHit = Math.max(attacker.peakSingleHit, finalDamage);
        if (heavy) attacker.heavyHitsLanded += 1;
        if (!hasShield) {
          const continuesCombo =
            attacker.comboWindowTimer > 0 ||
            defender.hitstunTimer > 0 ||
            defender.stunTimer > 0;
          attacker.currentComboCount = continuesCombo ? attacker.currentComboCount + 1 : 1;
          attacker.currentComboDamage = continuesCombo
            ? attacker.currentComboDamage + finalDamage
            : finalDamage;
          attacker.lastComboCount = attacker.currentComboCount;
          attacker.lastComboDamage = attacker.currentComboDamage;
          attacker.comboDisplayTimer = 2.4;
          attacker.comboWindowTimer = 1.45;
          attacker.longestCombo = Math.max(attacker.longestCombo, attacker.currentComboCount);
        }
      }
    }
    defender.ultCharge = Math.min(100, defender.ultCharge + ultGain * 0.45);

    if (state.mode === 'TRAINING' && defender.isDummy) {
      spawnFloatingNumber(
        defender.x + (Math.random() - 0.5) * 28,
        defender.y - defender.height * 0.78,
        `${finalDamage}${heavy ? '!' : ''}`,
        heavy ? '#FB923C' : '#FEF08A',
        heavy ? 1.25 : 1.0,
        0.85
      );
    }

    const missingRatio = 1 - defender.hp / defender.maxHp;
    const knockbackScale =
      ((0.85 + missingRatio * 0.95) / defSpec.weight) * (hasShield ? 0.15 : 1);

    if (!defender.isDummy) {
      defender.vx = dir * kbX * knockbackScale;
      defender.vy = kbY * knockbackScale;
    } else {
      defender.vx = 0;
      defender.vy = 0;
    }
    if (!hasShield) {
      if (!defender.isDummy) {
        defender.grounded = false;
      }
      defender.recoveryUsed = false;
      defender.hitFlashTimer = 0.12;
      defender.hitstunTimer = defender.isDummy
        ? Math.min(0.45, 0.24 + (heavy ? 0.14 : 0))
        : Math.min(0.45, 0.18 + missingRatio * 0.22);
      defender.animState = 'hitstun';
      defender.animTimer = 0;
      defender.animDuration = defender.hitstunTimer;
      defender.squashX = 0.76;
      defender.squashY = 1.25;
      if (!hitOpts?.isHazard) {
        defender.currentComboCount = 0;
        defender.currentComboDamage = 0;
        defender.comboWindowTimer = 0;
      }
    } else {
      defender.hitFlashTimer = 0.07;
      sounds.push({ type: 'crackHit' });
      spawnParticleInState(
        state,
        defender.x,
        defender.y - defender.height * 0.5,
        0,
        0,
        42,
        '#A3E635',
        0.22,
        0,
        'ring'
      );
    }

    if (defender.isDummy && defender.hp <= 0) {
      defender.hp = defender.maxHp;
      defender.poisonTimer = 0;
      defender.slowTimer = 0;
      defender.stunTimer = 0;
      defender.confuseTimer = 0;
      spawnFloatingNumber(
        defender.x,
        defender.y - defender.height - 20,
        'HP FULL',
        '#34D399',
        1.0,
        0.9
      );
    }

    if (hitOpts?.appliesSlow && hitOpts.appliesSlow > 0) {
      defender.slowTimer = Math.max(defender.slowTimer, hitOpts.appliesSlow);
    }
    if (hitOpts?.appliesPoison && hitOpts.appliesPoison > 0 && attacker) {
      defender.poisonTimer = Math.max(defender.poisonTimer, hitOpts.appliesPoison);
      defender.poisonSourceSlot = attacker.slot;
      if (defender.poisonTickTimer <= 0) defender.poisonTickTimer = 0.45;
    }
    if (hitOpts?.appliesStun && hitOpts.appliesStun > 0) {
      defender.stunTimer = Math.max(defender.stunTimer, hitOpts.appliesStun);
      sounds.push({ type: 'stun' });
    }
    if (hitOpts?.appliesConfuse && hitOpts.appliesConfuse > 0) {
      defender.confuseTimer = Math.max(defender.confuseTimer, hitOpts.appliesConfuse);
    }

    state.hitstopTimer = Math.max(state.hitstopTimer, hitstop);
    state.shakeIntensity = Math.max(state.shakeIntensity, heavy ? 11 : 5);
    if (hitOpts?.isHazard) {
      sounds.push({ type: 'hazardHit' });
    } else {
      sounds.push({ type: 'hit', heavy });
    }

    const ringColor = hitOpts?.appliesConfuse
      ? '#10B981'
      : hitOpts?.appliesPoison
      ? '#C084FC'
      : attSpec
      ? attSpec.accentColor
      : '#FB923C';

    spawnParticleInState(
      state,
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
      spawnParticleInState(
        state,
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
    const accent = getPropAccentColor(prop.kind);
    prop.hp = Math.max(0, prop.hp - dmg);
    prop.shakeTimer = 0.16;
    prop.hitFlashTimer = 0.1;
    prop.hitCooldown = 0.14;

    const cy = prop.y - prop.height * 0.5;

    if (prop.hp <= 0) {
      prop.broken = true;
      prop.respawnTimer = 11.0;
      sounds.push({ type: 'structureBreak' });
      state.shakeIntensity = Math.max(state.shakeIntensity, 10);

      spawnParticleInState(state, prop.x, cy, 0, 0, 56, accent, 0.3, 0, 'ring');
      for (let i = 0; i < 18; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 140 + Math.random() * 240;
        spawnParticleInState(
          state,
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
        sounds.push({ type: 'bouncePad' });
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
        spawnParticleInState(state, prop.x, cy, 0, 0, 72, '#EC4899', 0.32, 0, 'ring');
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
        spawnParticleInState(state, prop.x, cy, 0, 0, 70, '#7DD3FC', 0.34, 0, 'ring');
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
        spawnParticleInState(state, prop.x, cy, 0, 0, 76, '#F59E0B', 0.34, 0, 'ring');
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
        spawnParticleInState(state, prop.x, cy, 0, 0, 68, '#22D3EE', 0.34, 0, 'ring');
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
        spawnParticleInState(state, prop.x, cy, 0, 0, 74, '#C084FC', 0.34, 0, 'ring');
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
      sounds.push({ type: 'crackHit' });
      for (let i = 0; i < 6; i++) {
        spawnParticleInState(
          state,
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
      sounds.push({ type: 'recovery' });
      const steer = aimDir !== 0 ? aimDir : f.facing;
      f.facing = steer > 0 ? 1 : -1;
      f.vx = steer * (move.selfVx ?? 180);
      f.vy = move.selfVy ?? -760;

      for (let i = 0; i < 10; i++) {
        spawnParticleInState(
          state,
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
      f.specialCooldown =
        f.id === 'eve' ? 1.05 : f.id === 'moss_golem' ? 1.15 : f.id === 'blade_zero' ? 1.1 : 0.95;
      if (f.id === 'blade_zero') {
        f.counterTimer = 0.52;
        sounds.push({ type: 'stun' });
      } else if (f.id === 'moss_golem') {
        f.shieldTimer = 1.25;
        sounds.push({ type: 'cloudWall' });
      } else if (f.id === 'cloudier') {
        sounds.push({ type: 'cloudWall' });
      } else if (f.id === 'eve') {
        sounds.push({ type: 'chargeTelegraph' });
      } else if (f.id === 'spidra') {
        sounds.push({ type: 'tvBlare' });
      } else if (f.id === 'marshal_bolt' || f.id === 'astro_pip') {
        sounds.push({ type: 'laserShot' });
      } else if (f.id === 'pyro_jack') {
        sounds.push({ type: 'special', isProj: false });
      } else {
        sounds.push({ type: 'special', isProj: true });
      }
    } else if (moveKey === 'ultimate') {
      f.ultCharge = 0;
      f.invulnTimer = Math.max(f.invulnTimer, 0.5);
      state.shakeIntensity = 12;
      if (f.id === 'honey_shell') {
        f.hp = Math.min(f.maxHp, f.hp + 45);
        spawnParticleInState(
          state,
          f.x,
          f.y - f.height * 0.5,
          0,
          0,
          48,
          '#22C55E',
          0.36,
          0,
          'ring'
        );
        for (let h = 0; h < 12; h++) {
          spawnParticleInState(
            state,
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
        state.lightningFlash = 0.7;
      } else if (f.id === 'cloudier') {
        state.lightningFlash = 1;
      }
      sounds.push({ type: 'ultimate' });
    } else {
      sounds.push({ type: 'attack', heavy: moveKey === 'attack3' });
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
    sounds.push({ type: 'taunt', fighterId: f.id });
  };

  const spawnMoveEffects = (f: FighterEntity, moveKey: MoveKey) => {
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
        spawnParticleInState(
          state,
          f.x,
          f.y - f.height * 0.5,
          0,
          0,
          44,
          '#EF4444',
          0.25,
          0,
          'ring'
        );
      } else if (f.id === 'astro_pip') {
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
        const wallX = f.x + f.facing * move.offsetX;
        const surfaceY = findSurfaceYBelow(state, wallX, f.y);
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
          spawnParticleInState(
            state,
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
      sounds.push({ type: 'attack', heavy: true });
      state.shakeIntensity = Math.max(state.shakeIntensity, 9);
    } else if (moveKey === 'special' && f.id === 'moss_golem') {
      sounds.push({ type: 'structureBreak' });
      state.shakeIntensity = Math.max(state.shakeIntensity, 7);
      spawnParticleInState(
        state,
        f.x,
        f.y - f.height * 0.5,
        0,
        0,
        56,
        '#A3E635',
        0.3,
        0,
        'ring'
      );
    } else if (moveKey === 'special' && f.id === 'spidra') {
      for (let i = 0; i < 10; i++) {
        spawnParticleInState(
          state,
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
        const offsets = [-190, 0, 190];
        for (const ox of offsets) {
          const px = Math.max(140, Math.min(WORLD_WIDTH - 140, f.x + ox));
          const surfaceY = findSurfaceYBelow(state, px, f.y);
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
        const surfaceY = findSurfaceYBelow(state, f.x, f.y);
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
        const cx = Math.max(180, Math.min(WORLD_WIDTH - 180, f.x + f.facing * 60));
        const surfaceY = findSurfaceYBelow(state, cx, f.y);
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
        for (let k = 0; k < 8; k++) {
          const spawnX =
            160 + ((k * 145 + (opp.x - 500) * 0.35 + WORLD_WIDTH) % (WORLD_WIDTH - 320));
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
        spawnParticleInState(
          state,
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

  const handleStockLoss = (loser: FighterEntity, winner: FighterEntity) => {
    if (state.phase !== 'PLAYING') return;
    if (state.mode === 'TRAINING') {
      if (loser.isDummy) {
        loser.hp = loser.maxHp;
        loser.x = loser.dummyAnchorX;
        loser.y = loser.dummyAnchorY;
        loser.vx = 0;
        loser.vy = 0;
        loser.poisonTimer = 0;
        loser.slowTimer = 0;
        loser.stunTimer = 0;
        loser.confuseTimer = 0;
        loser.animState = 'idle';
        return;
      }
      const spawn = MAP_SPECS[state.mapId].spawnPoints[loser.slot];
      loser.x = spawn.x;
      loser.y = 140;
      loser.vx = 0;
      loser.vy = 0;
      loser.hp = loser.maxHp;
      loser.stocks = startingStocks;
      loser.jumpsRemaining = 2;
      loser.recoveryUsed = false;
      loser.invulnTimer = 1.0;
      loser.animState = 'fall';
      return;
    }

    loser.stocks = Math.max(0, loser.stocks - 1);
    winner.koCount += 1;
    state.shakeIntensity = 16;
    sounds.push({ type: 'ko' });

    for (let i = 0; i < 24; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 180 + Math.random() * 340;
      spawnParticleInState(
        state,
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
        spawnParticleInState(
          state,
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
      options.onMatchEnd?.(winner.slot);
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
    }
  };

  const stepFighter = (
    f: FighterEntity,
    opponent: FighterEntity,
    ctrl: FighterControlInput
  ) => {
    const spec = FIGHTER_SPECS[f.id];
    const plats = state.platforms;

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
    if (f.comboDisplayTimer > 0) {
      f.comboDisplayTimer = Math.max(0, f.comboDisplayTimer - dt);
    }
    if (f.comboWindowTimer > 0) {
      f.comboWindowTimer = Math.max(0, f.comboWindowTimer - dt);
      if (f.comboWindowTimer === 0) {
        f.currentComboCount = 0;
        f.currentComboDamage = 0;
        if (
          state.mode === 'TRAINING' &&
          opponent.isDummy &&
          (opponent.hp < opponent.maxHp ||
            opponent.poisonTimer > 0 ||
            opponent.stunTimer > 0 ||
            opponent.slowTimer > 0 ||
            opponent.confuseTimer > 0)
        ) {
          opponent.hp = opponent.maxHp;
          opponent.poisonTimer = 0;
          opponent.poisonSourceSlot = null;
          opponent.slowTimer = 0;
          opponent.stunTimer = 0;
          opponent.confuseTimer = 0;
          spawnParticleInState(
            state,
            opponent.x,
            opponent.y - opponent.height * 0.5,
            0,
            0,
            38,
            '#34D399',
            0.28,
            0,
            'ring'
          );
          state.floatingNumbers.push({
            id: state.nextEntityId++,
            x: opponent.x,
            y: opponent.y - opponent.height - 18,
            vx: 0,
            vy: -60,
            text: 'HP RESET',
            color: '#34D399',
            scale: 0.95,
            life: 0.75,
            maxLife: 0.75,
          });
        }
      }
    }

    if (f.poisonTimer > 0) {
      f.poisonTimer = Math.max(0, f.poisonTimer - dt);
      f.poisonTickTimer -= dt;
      if (f.poisonTickTimer <= 0) {
        f.poisonTickTimer = 0.5;
        const poisonDmg = 5;
        f.hp = Math.max(0, f.hp - poisonDmg);
        if (f.poisonSourceSlot !== null) {
          state.players[f.poisonSourceSlot].damageDealt += poisonDmg;
        }
        if (state.mode === 'TRAINING' && f.isDummy) {
          state.floatingNumbers.push({
            id: state.nextEntityId++,
            x: f.x + (Math.random() - 0.5) * 20,
            y: f.y - f.height * 0.72,
            vx: (Math.random() - 0.5) * 20,
            vy: -70,
            text: `${poisonDmg}`,
            color: '#C084FC',
            scale: 0.85,
            life: 0.65,
            maxLife: 0.65,
          });
        }
        sounds.push({ type: 'poisonTick' });
        for (let i = 0; i < 4; i++) {
          spawnParticleInState(
            state,
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

    if (f.isDummy) {
      if (f.hitstunTimer > 0) {
        f.hitstunTimer = Math.max(0, f.hitstunTimer - dt);
        if (f.stunTimer > 0) f.stunTimer = Math.max(0, f.stunTimer - dt);
        f.animTimer += dt;
        if (f.hitstunTimer === 0) {
          f.animState = f.stunTimer > 0 ? 'stunned' : 'idle';
        }
      } else if (f.stunTimer > 0) {
        f.stunTimer = Math.max(0, f.stunTimer - dt);
        f.animState = 'stunned';
        f.animTimer += dt;
        if (f.stunTimer === 0) {
          f.animState = 'idle';
        }
      } else {
        f.animState = 'idle';
        f.animTimer += dt;
      }

      f.vx = 0;
      f.x = f.dummyAnchorX;
      const gravScale = MAP_SPECS[state.mapId].gravityScale ?? 1;
      f.vy = Math.min(MAX_FALL_SPEED * gravScale, f.vy + GRAVITY * gravScale * dt);
      const prevDummyY = f.y;
      f.y += f.vy * dt;
      let dummyLanded = false;
      if (f.vy >= 0) {
        for (const plat of plats) {
          if (plat.broken) continue;
          const withinX =
            f.x + f.width * 0.28 >= plat.x && f.x - f.width * 0.28 <= plat.x + plat.width;
          const crossedTop = prevDummyY <= plat.y + 10 && f.y >= plat.y;
          if (withinX && crossedTop) {
            f.y = plat.y;
            f.vy = 0;
            f.grounded = true;
            dummyLanded = true;
            break;
          }
        }
      }
      if (!dummyLanded) f.grounded = false;
      if (f.y > BLAST_ZONE.bottom || f.hp <= 0) {
        f.hp = f.maxHp;
        f.x = f.dummyAnchorX;
        f.y = f.dummyAnchorY;
        f.vx = 0;
        f.vy = 0;
      }
      return;
    }

    f.ultCharge = Math.min(100, f.ultCharge + dt * 2.2);

    const { moveDir, jumpPressed, downHeld, attackComboPressed, tauntPressed, directMove } = ctrl;

    const recordedAction: ReplayInputAction = directMove
      ? directMove
      : tauntPressed
      ? 'taunt'
      : attackComboPressed
      ? 'combo'
      : null;
    inputsUsed[f.slot] = {
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

            for (const prop of state.destructibles) {
              if (prop.broken) continue;
              const propCy = prop.y - prop.height * 0.5;
              if (
                Math.abs(boxCx - prop.x) <= halfW + prop.width * 0.5 &&
                Math.abs(boxCy - propCy) <= halfH + prop.height * 0.5
              ) {
                damageDestructible(prop, f.slot, structDmg);
              }
            }

            for (const plat of state.platforms) {
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
          sounds.push({ type: 'tauntBoost' });
          spawnParticleInState(
            state,
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
            spawnParticleInState(
              state,
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
            sounds.push({ type: 'jump', double: isDouble });

            for (let i = 0; i < 5; i++) {
              spawnParticleInState(
                state,
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
    const gravScale = MAP_SPECS[state.mapId].gravityScale ?? 1;
    f.vy = Math.min(
      MAX_FALL_SPEED * gravScale * fallMult,
      f.vy + GRAVITY * gravScale * fallMult * dt
    );

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
            state.shakeIntensity = Math.max(state.shakeIntensity, 6);
            spawnParticleInState(state, f.x, plat.y, 0, 0, 28, '#CBD5E1', 0.24, 0, 'ring');
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
    const attacker = state.players[ownerSlot];
    const target = state.players[ownerSlot === 0 ? 1 : 0];
    sounds.push({ type: 'structureBreak' });
    state.shakeIntensity = Math.max(state.shakeIntensity, 8);
    spawnParticleInState(state, x, y, 0, 0, radius * 0.72, color, 0.28, 0, 'ring');
    for (let k = 0; k < 14; k++) {
      const ang = (Math.PI * 2 * k) / 14;
      const spd = 140 + Math.random() * 210;
      spawnParticleInState(
        state,
        x,
        y,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd - 60,
        5.5,
        k % 2 === 0 ? color : '#FEF08A',
        0.36,
        260,
        'spark'
      );
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

  stepPlatforms(state, dt);

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
        spawnParticleInState(
          state,
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

  stepFighter(state.players[0], state.players[1], controls[0]);
  if (state.phase === 'PLAYING') {
    stepFighter(state.players[1], state.players[0], controls[1]);
  }

  // Timed actions
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
      sounds.push({ type: 'laserShot' });
    } else if (ta.kind === 'katana_slice') {
      const side: 1 | -1 = ta.facing ?? 1;
      const oppCy = opp.y - opp.height * 0.5;
      caster.x = Math.max(90, Math.min(WORLD_WIDTH - 90, opp.x - side * 56));
      caster.y = opp.y;
      caster.facing = caster.x <= opp.x ? 1 : -1;
      caster.vx = 0;
      caster.vy = 0;
      sounds.push({ type: 'attack', heavy: true });
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
      sounds.push({ type: 'special', isProj: false });
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
      sounds.push({ type: 'laserShot' });
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
      sounds.push({ type: 'attack', heavy: true });
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

  // Projectiles
  const plats = state.platforms;
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    const prevY = p.y;
    p.life -= dt;

    const target = state.players[p.ownerSlot === 0 ? 1 : 0];
    const attacker = state.players[p.ownerSlot];
    const targetCy = target.y - target.height * 0.5;

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
        sounds.push({ type: 'bouncePad' });
        spawnParticleInState(state, p.x, p.y, 0, 0, 26, '#FDE047', 0.22, 0, 'ring');
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
          spawnParticleInState(state, p.x, p.y, -p.vx * 0.2, -120, 12, '#E0F2FE', 0.22, 0, 'ring');
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
      if (target.shieldTimer > 0) {
        p.ownerSlot = target.slot;
        p.fighterId = target.id;
        p.vx = -p.vx * 1.4;
        p.vy = -Math.abs(p.vy) * 0.6 - 40;
        p.life = Math.max(p.life, 1.1);
        p.damage = Math.round(p.damage * 1.25);
        sounds.push({ type: 'bouncePad' });
        spawnParticleInState(state, p.x, p.y, 0, 0, 34, '#A3E635', 0.25, 0, 'ring');
        continue;
      }

      if (target.counterTimer > 0) {
        target.counterTimer = 0;
        target.invulnTimer = 0.35;
        sounds.push({ type: 'stun' });
        spawnParticleInState(state, target.x, targetCy, 0, 0, 42, '#EF4444', 0.25, 0, 'ring');
        if (
          attacker.animState !== 'ko' &&
          Math.hypot(attacker.x - target.x, attacker.y - target.y) < 580
        ) {
          const behindX = Math.max(
            90,
            Math.min(WORLD_WIDTH - 90, attacker.x - attacker.facing * 72)
          );
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
        if (p.pullOnHit && !target.isDummy) {
          const pullDir: 1 | -1 = attacker.x >= target.x ? 1 : -1;
          target.vx = pullDir * 520;
          target.vy = -210;
          spawnParticleInState(state, target.x, targetCy, 0, 0, 30, '#38BDF8', 0.22, 0, 'ring');
        }
        if (p.floatTrap && !target.isDummy) {
          target.vx *= 0.25;
          target.vy = -490;
          spawnParticleInState(state, target.x, targetCy, 0, 0, 38, '#06B6D4', 0.3, 0, 'ring');
        }
        if (p.explodeRadius) {
          const expColor =
            p.kind === 'ember_bomb'
              ? '#F97316'
              : p.kind === 'boulder_rock'
              ? '#22C55E'
              : '#A855F7';
          detonateExplosion(
            p.x,
            p.y,
            p.ownerSlot,
            p.explodeRadius,
            p.damage,
            p.knockbackX,
            p.knockbackY,
            expColor,
            true
          );
        }
        if (p.spawnsPuddleOnLand) {
          const surfaceY = findSurfaceYBelow(state, p.x, target.y);
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
            p.kind === 'ember_bomb'
              ? '#F97316'
              : p.kind === 'boulder_rock'
              ? '#22C55E'
              : '#A855F7';
          detonateExplosion(
            p.x,
            p.y,
            p.ownerSlot,
            p.explodeRadius,
            p.damage,
            p.knockbackX,
            p.knockbackY,
            expColor,
            false
          );
        } else {
          damageDestructible(prop, p.ownerSlot, p.damage);
        }
        if (p.spawnsPuddleOnLand) {
          const surfaceY = findSurfaceYBelow(state, p.x, prop.y);
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
      (p.spawnsPuddleOnLand ||
        p.explodeRadius ||
        p.kind === 'ember_bomb' ||
        p.kind === 'boulder_rock') &&
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
                spawnParticleInState(
                  state,
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

  // Zones
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
        const desiredAngle = Math.atan2(targetCy - z.y, target.x - z.x);
        let diff = desiredAngle - (z.angle ?? 0);
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        z.angle = (z.angle ?? 0) + Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      } else {
        if (prevTelegraph > 0) {
          sounds.push({ type: 'ultimate' });
          state.shakeIntensity = Math.max(state.shakeIntensity, 12);
          state.lightningFlash = Math.max(state.lightningFlash, 0.7);
        }
        const ang = z.angle ?? 0;
        const x2 = z.x + Math.cos(ang) * z.width;
        const y2 = z.y + Math.sin(ang) * z.width;

        if (z.hitTimers[opponentSlot] <= 0 && target.animState !== 'ko') {
          if (
            distToSegment(target.x, targetCy, z.x, z.y, x2, y2) <=
            z.height * 0.6 + target.width * 0.35
          ) {
            z.hitTimers[opponentSlot] = 0.6;
            const pushDir: 1 | -1 = Math.cos(ang) >= 0 ? 1 : -1;
            applyHit(attacker, target, z.damage, z.knockbackX, z.knockbackY, pushDir, 0.065, 0, {
              appliesStun: z.appliesStun,
            });
          }
        }
        for (const prop of state.destructibles) {
          if (prop.broken || prop.hitCooldown > 0) continue;
          if (
            distToSegment(prop.x, prop.y - prop.height * 0.5, z.x, z.y, x2, y2) <=
            z.height * 0.6 + prop.width * 0.4
          ) {
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
        if (
          distToSegment(prop.x, prop.y - prop.height * 0.5, x1, y1, x2, y2) <=
          38 + prop.width * 0.4
        ) {
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
        sounds.push({ type: 'hit', heavy: false });
      }
      if (z.life <= 0) {
        sounds.push({ type: 'structureBreak' });
        spawnParticleInState(state, z.x, cy, 0, 0, 120, '#F472B6', 0.32, 0, 'ring');
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
            sounds.push({ type: 'poisonTick' });
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
            applyHit(attacker, target, z.damage, z.knockbackX, z.knockbackY, pushDir, 0.055, 10, {
              appliesStun: z.appliesStun,
            });
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

  // Obstacles
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
          sounds.push({ type: 'bouncePad' });
          spawnParticleInState(
            state,
            obs.currentX,
            obs.currentY,
            0,
            0,
            44,
            '#2DD4BF',
            0.25,
            0,
            'ring'
          );
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
          sounds.push({ type: 'bouncePad' });
          spawnParticleInState(state, obs.x, obs.y - 8, 0, 0, 32, '#FAFAFA', 0.25, 0, 'ring');
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
          sounds.push({ type: 'structureBreak' });
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
          sounds.push({ type: 'hoverCarPass' });
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
          spawnParticleInState(
            state,
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

  stepVisualEffects(state, dt);

  return { sounds, inputsUsed };
}
