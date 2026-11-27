import { WORLD_WIDTH } from './constants';
import type { FighterEntity, Platform } from './types';

export type TrainingDummyBehavior =
  | 'standing_still'
  | 'auto_recover'
  | 'random_movement';

export interface TrainingDummyConfig {
  behavior: TrainingDummyBehavior;
  knockbackEnabled: boolean;
  autoResetHp: boolean;
  moveSpeedScale: 0.75 | 1 | 1.3;
}

export interface TrainingDummyBehaviorOption {
  id: TrainingDummyBehavior;
  label: string;
  shortLabel: string;
  description: string;
  defaultKnockback: boolean;
}

export const TRAINING_DUMMY_BEHAVIOR_OPTIONS: readonly TrainingDummyBehaviorOption[] = [
  {
    id: 'standing_still',
    label: 'Standing Still',
    shortLabel: 'Static',
    description: 'Holds position cleanly for repeatable combo routes.',
    defaultKnockback: false,
  },
  {
    id: 'auto_recover',
    label: 'Auto-Recover',
    shortLabel: 'Recover',
    description: 'Takes knockback and jumps or bursts back onto the stage.',
    defaultKnockback: true,
  },
  {
    id: 'random_movement',
    label: 'Random Jump / Movement',
    shortLabel: 'Roam',
    description: 'Patrols platforms, hops unpredictably, and recovers from edges.',
    defaultKnockback: true,
  },
] as const;

export const DEFAULT_TRAINING_DUMMY_CONFIG: TrainingDummyConfig = {
  behavior: 'standing_still',
  knockbackEnabled: false,
  autoResetHp: true,
  moveSpeedScale: 1,
};

export interface TrainingDummyControlOutput {
  moveDir: -1 | 0 | 1;
  wantJump: boolean;
  wantDrop: boolean;
  wantRecovery: boolean;
}

export const DUMMY_BASE_MOVE_SPEED = 290;
export const DUMMY_JUMP_VELOCITY = 660;
export const DUMMY_RECOVERY_VY = -730;

export function getDefaultKnockbackForBehavior(behavior: TrainingDummyBehavior): boolean {
  return behavior !== 'standing_still';
}

export function computeTrainingDummyControls(
  dummy: FighterEntity,
  opponent: FighterEntity,
  platforms: Platform[],
  config: TrainingDummyConfig,
  dt: number,
  randomFn: () => number = Math.random
): TrainingDummyControlOutput {
  if (config.behavior === 'standing_still') {
    return {
      moveDir: 0,
      wantJump: false,
      wantDrop: false,
      wantRecovery: false,
    };
  }

  const mainPlat = platforms[0];
  const stageCenter = WORLD_WIDTH * 0.5;
  const standingPlat = dummy.grounded
    ? platforms.find(
        (p) =>
          !p.broken &&
          Math.abs(dummy.y - p.y) <= 12 &&
          dummy.x >= p.x + 12 &&
          dummy.x <= p.x + p.width - 12
      )
    : undefined;

  const overSafePlatform = platforms.some(
    (p) =>
      !p.broken &&
      dummy.x >= p.x + 14 &&
      dummy.x <= p.x + p.width - 14 &&
      dummy.y <= p.y + 34
  );

  // Priority 1: Always recover back onto the stage when launched off-ledge or below main stage
  if (!overSafePlatform || (mainPlat && dummy.y > mainPlat.y + 36)) {
    const moveDir: -1 | 1 = dummy.x < stageCenter ? 1 : -1;
    let wantJump = false;
    let wantRecovery = false;

    if (dummy.vy > 20 || (mainPlat && dummy.y > mainPlat.y + 20)) {
      if (dummy.jumpsRemaining > 0) {
        wantJump = true;
      } else if (!dummy.recoveryUsed) {
        wantRecovery = true;
      }
    }

    return {
      moveDir,
      wantJump,
      wantDrop: false,
      wantRecovery,
    };
  }

  if (config.behavior === 'auto_recover') {
    const anchorDx = dummy.dummyAnchorX - dummy.x;
    const anchorDy = dummy.dummyAnchorY - dummy.y;

    let moveDir: -1 | 0 | 1 = 0;
    let wantJump = false;
    let wantDrop = false;

    if (Math.abs(anchorDx) > 36) {
      moveDir = anchorDx > 0 ? 1 : -1;
    }

    if (dummy.grounded) {
      if (anchorDy < -65 && dummy.jumpsRemaining > 0) {
        wantJump = true;
      } else if (
        anchorDy > 65 &&
        standingPlat?.passThrough &&
        mainPlat &&
        mainPlat.y > dummy.y + 20
      ) {
        wantDrop = true;
      }
    } else if (dummy.vy > 30 && anchorDy < -30 && dummy.jumpsRemaining > 0) {
      wantJump = true;
    }

    return {
      moveDir,
      wantJump,
      wantDrop,
      wantRecovery: false,
    };
  }

  // Behavior: 'random_movement' (patrol platforms, random jumps, platform drops, edge safe)
  dummy.aiDecisionTimer -= dt;
  let wantJump = false;
  let wantDrop = false;

  if (dummy.aiDecisionTimer <= 0) {
    dummy.aiDecisionTimer = 0.32 + randomFn() * 0.56;
    const roll = randomFn();
    if (roll < 0.36) {
      dummy.aiDesiredAction = 'roam_left';
    } else if (roll < 0.72) {
      dummy.aiDesiredAction = 'roam_right';
    } else if (roll < 0.88) {
      dummy.aiDesiredAction = 'idle';
    } else {
      dummy.aiDesiredAction = opponent.x >= dummy.x ? 'roam_right' : 'roam_left';
    }

    if (dummy.grounded) {
      if (
        standingPlat?.passThrough &&
        mainPlat &&
        mainPlat.y > dummy.y + 20 &&
        randomFn() < 0.24
      ) {
        wantDrop = true;
      } else if (randomFn() < 0.44) {
        wantJump = true;
      }
    } else if (dummy.jumpsRemaining > 0 && dummy.vy > -40 && randomFn() < 0.35) {
      wantJump = true;
    }
  }

  let moveDir: -1 | 0 | 1 =
    dummy.aiDesiredAction === 'roam_left'
      ? -1
      : dummy.aiDesiredAction === 'roam_right'
      ? 1
      : 0;

  // Keep random roaming inside safe platform boundaries unless hopping between ledges
  const activePlat = standingPlat ?? mainPlat;
  if (activePlat) {
    const margin = 44;
    if (dummy.x <= activePlat.x + margin && moveDir === -1) {
      moveDir = 1;
      dummy.aiDesiredAction = 'roam_right';
    } else if (dummy.x >= activePlat.x + activePlat.width - margin && moveDir === 1) {
      moveDir = -1;
      dummy.aiDesiredAction = 'roam_left';
    }
  }

  return {
    moveDir,
    wantJump,
    wantDrop,
    wantRecovery: false,
  };
}
