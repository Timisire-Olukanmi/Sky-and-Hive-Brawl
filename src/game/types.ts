export type GamePhase =
  | 'HOME'
  | 'TITLE_MENU'
  | 'ONLINE_CASUAL'
  | 'ONLINE_RANKED'
  | 'ONLINE_TOURNAMENT'
  | 'PLAYING'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'REPLAY';

export type PlayMode =
  | '1P_AI'
  | '2P_LOCAL'
  | 'TRAINING'
  | 'ONLINE_CASUAL'
  | 'ONLINE_RANKED'
  | 'ONLINE_TOURNAMENT';

export type FighterId =
  | 'honey_shell'
  | 'cloudier'
  | 'eve'
  | 'spidra'
  | 'marshal_bolt'
  | 'pyro_jack'
  | 'aqua_nyx'
  | 'blade_zero'
  | 'moss_golem'
  | 'astro_pip';

export type MapId =
  | 'hive_canopy'
  | 'storm_citadel'
  | 'magma_foundry'
  | 'wind_mill_spire'
  | 'eclipse_temple'
  | 'neon_skyline'
  | 'frost_glacier'
  | 'cyber_factory'
  | 'coral_abyss'
  | 'cosmic_station';

export type AnimState =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'special'
  | 'ultimate'
  | 'recovery'
  | 'hitstun'
  | 'stunned'
  | 'taunt'
  | 'victory'
  | 'ko';

export type MoveKey =
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'special'
  | 'ultimate'
  | 'recovery';

export type SlashVisualKind =
  | 'honey_whip'
  | 'stinger_drill'
  | 'crystal_spire'
  | 'swarm'
  | 'boulder_knuckle'
  | 'gale_clap'
  | 'belly_slam'
  | 'thunder'
  | 'split_jab'
  | 'orbital_strike'
  | 'eclipse_spear'
  | 'eclipse_cleave'
  | 'duality_cataclysm'
  | 'scuttle_needle'
  | 'web_spin'
  | 'static_pounce'
  | 'tv_blare'
  | 'broadcast_overload'
  | 'baton_strike'
  | 'lasso_whip'
  | 'spur_kick'
  | 'deadeye_shot'
  | 'high_noon_lockdown'
  | 'fire_upper'
  | 'ember_hook'
  | 'meteor_crash'
  | 'inferno_nova'
  | 'tentacle_snap'
  | 'riptide_spin'
  | 'pearl_slam'
  | 'tidal_maelstrom'
  | 'iaido_slash'
  | 'cross_crescent'
  | 'dragon_fang'
  | 'omnislash_flash'
  | 'granite_jab'
  | 'tectonic_clap'
  | 'quake_stomp'
  | 'seismic_monolith'
  | 'star_tap'
  | 'orbit_roll'
  | 'comet_kick'
  | 'supernova_comet'
  | 'recovery_burst';

export interface CardStats {
  heart: number;
  attack: number;
  lightning: number;
  shield: number;
}

export interface MoveSpec {
  key: MoveKey;
  label: string;
  duration: number;
  activeStart: number;
  activeEnd: number;
  baseDamage: number;
  knockbackX: number;
  knockbackY: number;
  rangeX: number;
  rangeY: number;
  offsetX: number;
  offsetY: number;
  hitstop: number;
  ultGain: number;
  selfVx?: number;
  selfVy?: number;
  isProjectile?: boolean;
  isAreaAround?: boolean;
  appliesPoison?: number;
  appliesSlow?: number;
  appliesStun?: number;
  appliesConfuse?: number;
  slashKind: SlashVisualKind;
}

export interface FighterSpec {
  id: FighterId;
  name: string;
  title: string;
  accentColor: string;
  secondaryColor: string;
  cardStats: CardStats;
  maxHp: number;
  atk: number;
  def: number;
  moveSpeed: number;
  jumpVelocity: number;
  weight: number;
  width: number;
  height: number;
  moves: Record<MoveKey, MoveSpec>;
}

export interface PlatformMotion {
  kind: 'horizontal' | 'vertical' | 'orbit';
  ampX: number;
  ampY: number;
  speed: number;
  phase: number;
}

export interface Platform {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  prevX?: number;
  prevY?: number;
  width: number;
  height: number;
  passThrough: boolean;
  style:
    | 'solid'
    | 'honeycomb'
    | 'cloud'
    | 'citadel'
    | 'magma'
    | 'windmill'
    | 'temple'
    | 'city'
    | 'ice'
    | 'conveyor'
    | 'reef'
    | 'space';
  motion?: PlatformMotion;
  conveyorSpeed?: number;
  icy?: boolean;
  destructible?: boolean;
  hp?: number;
  maxHp?: number;
  broken?: boolean;
  respawnTimer?: number;
  shakeTimer?: number;
  scars?: number[];
}

export type DestructiblePropKind =
  | 'honey_vat'
  | 'storm_pylon'
  | 'magma_crystal'
  | 'windmill_crate'
  | 'eclipse_urn'
  | 'neon_beacon'
  | 'frost_crystal'
  | 'steam_boiler'
  | 'coral_pod'
  | 'plasma_cell';

export interface DestructiblePropSpec {
  id: string;
  kind: DestructiblePropKind;
  x: number;
  y: number;
  width: number;
  height: number;
  maxHp: number;
}

export interface DestructiblePropRuntime extends DestructiblePropSpec {
  hp: number;
  broken: boolean;
  respawnTimer: number;
  shakeTimer: number;
  hitFlashTimer: number;
  hitCooldown: number;
}

export interface ObstacleSpec {
  id: string;
  kind:
    | 'lava_geyser'
    | 'wind_bumper'
    | 'jump_pad'
    | 'eclipse_pendulum'
    | 'hover_car'
    | 'hive_swarm'
    | 'lightning_arc'
    | 'icicle_drop'
    | 'crusher_piston'
    | 'whirlpool_vortex'
    | 'laser_sweeper';
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  period?: number;
  phase?: number;
  swingRadius?: number;
  direction?: 1 | -1;
  speed?: number;
}

export interface ObstacleRuntime extends ObstacleSpec {
  timer: number;
  state: 'idle' | 'telegraph' | 'active';
  currentX: number;
  currentY: number;
  currentHeight: number;
  angle: number;
  hitCooldowns: [number, number];
}

export interface MapSpec {
  id: MapId;
  name: string;
  subtitle: string;
  mechanicNote: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  accentColor: string;
  gravityScale?: number;
  platforms: Platform[];
  obstacles: ObstacleSpec[];
  destructibles: DestructiblePropSpec[];
  spawnPoints: [{ x: number; y: number }, { x: number; y: number }];
}

export interface FighterEntity {
  slot: 0 | 1;
  id: FighterId;
  isAi: boolean;
  isDummy: boolean;
  dummyAnchorX: number;
  dummyAnchorY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: 1 | -1;
  grounded: boolean;
  jumpsRemaining: number;
  recoveryUsed: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  dropThroughTimer: number;

  hp: number;
  maxHp: number;
  stocks: number;
  ultCharge: number;
  damageDealt: number;
  koCount: number;
  hitsLanded: number;
  longestCombo: number;
  currentComboCount: number;
  currentComboDamage: number;
  lastComboCount: number;
  lastComboDamage: number;
  comboDisplayTimer: number;
  comboWindowTimer: number;
  peakSingleHit: number;
  heavyHitsLanded: number;

  animState: AnimState;
  animTimer: number;
  animDuration: number;
  comboStep: 0 | 1 | 2;
  comboResetTimer: number;
  hasHitCurrentMove: boolean;
  specialCooldown: number;
  tauntCooldown: number;

  hitFlashTimer: number;
  hitstunTimer: number;
  stunTimer: number;
  invulnTimer: number;
  slowTimer: number;
  confuseTimer: number;
  poisonTimer: number;
  poisonTickTimer: number;
  poisonSourceSlot: 0 | 1 | null;
  counterTimer: number;
  shieldTimer: number;
  speedBoostTimer: number;
  squashX: number;
  squashY: number;

  aiDecisionTimer: number;
  aiDesiredAction: 'approach' | 'retreat' | 'jump' | 'idle' | 'roam_left' | 'roam_right';
}

export interface ProjectileEntity {
  id: number;
  ownerSlot: 0 | 1;
  fighterId: FighterId;
  kind:
    | 'venom_honey_drop'
    | 'hornet_bolt'
    | 'eclipse_dart'
    | 'static_orb'
    | 'cuff_bolt'
    | 'sheriff_star'
    | 'ember_bomb'
    | 'bubble_orb'
    | 'shuriken_star'
    | 'boulder_rock'
    | 'nova_star';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  knockbackX: number;
  knockbackY: number;
  gravity: number;
  life: number;
  maxLife: number;
  appliesPoison: number;
  appliesSlow: number;
  appliesConfuse?: number;
  appliesStun?: number;
  spawnsPuddleOnLand: boolean;
  homing?: boolean;
  pullOnHit?: boolean;
  explodeRadius?: number;
  bouncesLeft?: number;
  floatTrap?: boolean;
  rotation: number;
}

export interface ZoneEntity {
  id: number;
  ownerSlot: 0 | 1;
  kind:
    | 'cloud_wall'
    | 'honey_puddle'
    | 'lightning_pillar'
    | 'glitch_field'
    | 'whirlpool_zone'
    | 'railgun_beam'
    | 'cross_slash';
  x: number;
  y: number;
  width: number;
  height: number;
  targetHeight: number;
  life: number;
  maxLife: number;
  damage: number;
  knockbackX: number;
  knockbackY: number;
  appliesStun: number;
  appliesPoison: number;
  appliesSlow: number;
  appliesConfuse?: number;
  angle?: number;
  telegraphTimer?: number;
  blocksProjectiles: boolean;
  hitTimers: [number, number];
}

export interface TimedAction {
  timer: number;
  ownerSlot: 0 | 1;
  kind:
    | 'hornet_stinger'
    | 'katana_slice'
    | 'sky_boulder'
    | 'volcano_bomb'
    | 'orbital_star'
    | 'eve_cross_cut';
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  angle?: number;
  facing?: 1 | -1;
}

export interface ParticleEntity {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  shape: 'circle' | 'spark' | 'ring' | 'drip';
}

export interface SlashEffect {
  x: number;
  y: number;
  facing: 1 | -1;
  color: string;
  width: number;
  height: number;
  life: number;
  maxLife: number;
  angle?: number;
  kind: SlashVisualKind;
}

export interface GameEngineState {
  phase: GamePhase;
  mode: PlayMode;
  mapId: MapId;
  matchTime: number;
  ambientTime: number;
  hitstopTimer: number;
  shakeIntensity: number;
  lightningFlash: number;
  windForceX: number;
  winnerSlot: 0 | 1 | null;
  nextEntityId: number;
  players: [FighterEntity, FighterEntity];
  platforms: Platform[];
  obstacles: ObstacleRuntime[];
  destructibles: DestructiblePropRuntime[];
  projectiles: ProjectileEntity[];
  zones: ZoneEntity[];
  timedActions: TimedAction[];
  particles: ParticleEntity[];
  slashes: SlashEffect[];
  floatingNumbers: FloatingNumberEntity[];
}

export interface FloatingNumberEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface HudFighterSnapshot {
  slot: 0 | 1;
  id: FighterId;
  name: string;
  isAi: boolean;
  isDummy: boolean;
  hp: number;
  maxHp: number;
  stocks: number;
  ultCharge: number;
  animState: AnimState;
  poisoned: boolean;
  stunned: boolean;
  slowed: boolean;
  confused: boolean;
  x: number;
  y: number;
  damageDealt: number;
  koCount: number;
  hitsLanded: number;
  longestCombo: number;
  currentComboCount: number;
  currentComboDamage: number;
  lastComboCount: number;
  lastComboDamage: number;
  peakSingleHit: number;
  heavyHitsLanded: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  mode: PlayMode;
  mapId: MapId;
  matchTime: number;
  winnerSlot: 0 | 1 | null;
  players: [HudFighterSnapshot, HudFighterSnapshot];
}

export type ReplayInputAction =
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'special'
  | 'ultimate'
  | 'recovery'
  | 'taunt'
  | 'combo'
  | null;

export interface ReplayInputState {
  moveDir: number;
  jump: boolean;
  down: boolean;
  action: ReplayInputAction;
}

export interface ReplayFrame {
  matchTime: number;
  ambientTime: number;
  shakeIntensity: number;
  lightningFlash: number;
  windForceX: number;
  players: [FighterEntity, FighterEntity];
  inputs: [ReplayInputState, ReplayInputState];
  platforms: Platform[];
  obstacles: ObstacleRuntime[];
  destructibles: DestructiblePropRuntime[];
  projectiles: ProjectileEntity[];
  zones: ZoneEntity[];
  slashes: SlashEffect[];
  activeParticles: ParticleEntity[];
  floatingNumbers?: FloatingNumberEntity[];
}

export interface ReplayHudState {
  playing: boolean;
  speed: 0.5 | 1 | 2;
  elapsed: number;
  duration: number;
  frameIndex: number;
  totalFrames: number;
  inputs: [ReplayInputState, ReplayInputState];
  koOffsets: number[];
}
