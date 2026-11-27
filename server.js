// server.ts
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";

// src/game/constants.ts
var WORLD_WIDTH = 1280;
var WORLD_HEIGHT = 720;
var GRAVITY = 1750;
var MAX_FALL_SPEED = 980;
var FAST_FALL_MULTIPLIER = 1.45;
var GROUND_FRICTION = 2400;
var AIR_DRAG = 950;
var COYOTE_TIME = 0.11;
var JUMP_BUFFER_TIME = 0.12;
var STARTING_STOCKS = 5;
var BLAST_ZONE = {
  left: -170,
  right: WORLD_WIDTH + 170,
  top: -220,
  bottom: WORLD_HEIGHT + 170
};
var FIGHTER_SPECS = {
  honey_shell: {
    id: "honey_shell",
    name: "Honey Shell",
    title: "Venom Hive Guardian",
    accentColor: "#F59E0B",
    secondaryColor: "#C084FC",
    cardStats: {
      heart: 20,
      attack: 8,
      lightning: 14,
      shield: 2
    },
    maxHp: 200,
    atk: 8,
    def: 2,
    moveSpeed: 395,
    jumpVelocity: 715,
    weight: 0.92,
    width: 72,
    height: 88,
    moves: {
      attack1: {
        key: "attack1",
        label: "Honey Whip",
        duration: 0.25,
        activeStart: 0.06,
        activeEnd: 0.16,
        baseDamage: 14,
        knockbackX: 210,
        knockbackY: -130,
        rangeX: 128,
        rangeY: 34,
        offsetX: 74,
        offsetY: -44,
        hitstop: 0.03,
        ultGain: 10,
        selfVx: 80,
        appliesSlow: 1.3,
        slashKind: "honey_whip"
      },
      attack2: {
        key: "attack2",
        label: "Venom Stinger",
        duration: 0.34,
        activeStart: 0.09,
        activeEnd: 0.23,
        baseDamage: 18,
        knockbackX: 270,
        knockbackY: -220,
        rangeX: 94,
        rangeY: 42,
        offsetX: 48,
        offsetY: -44,
        hitstop: 0.042,
        ultGain: 14,
        selfVx: 370,
        appliesPoison: 2.5,
        slashKind: "stinger_drill"
      },
      attack3: {
        key: "attack3",
        label: "Crystal Spire",
        duration: 0.44,
        activeStart: 0.15,
        activeEnd: 0.29,
        baseDamage: 28,
        knockbackX: 220,
        knockbackY: -540,
        rangeX: 56,
        rangeY: 138,
        offsetX: 66,
        offsetY: -68,
        hitstop: 0.065,
        ultGain: 18,
        selfVx: 40,
        slashKind: "crystal_spire"
      },
      special: {
        key: "special",
        label: "Venom Honey Drop",
        duration: 0.36,
        activeStart: 0.12,
        activeEnd: 0.22,
        baseDamage: 16,
        knockbackX: 180,
        knockbackY: -150,
        rangeX: 56,
        rangeY: 56,
        offsetX: 40,
        offsetY: -54,
        hitstop: 0.035,
        ultGain: 13,
        selfVy: -190,
        isProjectile: true,
        appliesPoison: 4.5,
        appliesSlow: 2.4,
        slashKind: "honey_whip"
      },
      ultimate: {
        key: "ultimate",
        label: "Royal Hornet Barrage",
        duration: 0.64,
        activeStart: 0.14,
        activeEnd: 0.42,
        baseDamage: 30,
        knockbackX: 520,
        knockbackY: -420,
        rangeX: 190,
        rangeY: 160,
        offsetX: 0,
        offsetY: -50,
        hitstop: 0.065,
        ultGain: 0,
        selfVy: -220,
        isAreaAround: true,
        appliesPoison: 4.5,
        appliesSlow: 2.5,
        slashKind: "swarm"
      },
      recovery: {
        key: "recovery",
        label: "Amber Wing Ascent",
        duration: 0.36,
        activeStart: 0.06,
        activeEnd: 0.28,
        baseDamage: 12,
        knockbackX: 180,
        knockbackY: -320,
        rangeX: 90,
        rangeY: 90,
        offsetX: 0,
        offsetY: -44,
        hitstop: 0.03,
        ultGain: 8,
        selfVx: 180,
        selfVy: -760,
        isAreaAround: true,
        appliesSlow: 1,
        slashKind: "recovery_burst"
      }
    }
  },
  cloudier: {
    id: "cloudier",
    name: "Cloudier",
    title: "Storm Wall Colossus",
    accentColor: "#38BDF8",
    secondaryColor: "#E0F2FE",
    cardStats: {
      heart: 35,
      attack: 7,
      lightning: 20,
      shield: 4
    },
    maxHp: 350,
    atk: 7,
    def: 4,
    moveSpeed: 420,
    jumpVelocity: 675,
    weight: 1.15,
    width: 84,
    height: 94,
    moves: {
      attack1: {
        key: "attack1",
        label: "Boulder Knuckle",
        duration: 0.3,
        activeStart: 0.09,
        activeEnd: 0.2,
        baseDamage: 20,
        knockbackX: 370,
        knockbackY: -190,
        rangeX: 74,
        rangeY: 72,
        offsetX: 44,
        offsetY: -46,
        hitstop: 0.048,
        ultGain: 11,
        selfVx: 135,
        slashKind: "boulder_knuckle"
      },
      attack2: {
        key: "attack2",
        label: "Gale Clap",
        duration: 0.4,
        activeStart: 0.14,
        activeEnd: 0.27,
        baseDamage: 22,
        knockbackX: 450,
        knockbackY: -290,
        rangeX: 176,
        rangeY: 82,
        offsetX: 0,
        offsetY: -50,
        hitstop: 0.058,
        ultGain: 15,
        isAreaAround: true,
        appliesStun: 0.45,
        slashKind: "gale_clap"
      },
      attack3: {
        key: "attack3",
        label: "Tectonic Slam",
        duration: 0.5,
        activeStart: 0.19,
        activeEnd: 0.34,
        baseDamage: 34,
        knockbackX: 540,
        knockbackY: -440,
        rangeX: 186,
        rangeY: 58,
        offsetX: 0,
        offsetY: -26,
        hitstop: 0.075,
        ultGain: 19,
        selfVx: 140,
        selfVy: -180,
        isAreaAround: true,
        appliesStun: 0.7,
        slashKind: "belly_slam"
      },
      special: {
        key: "special",
        label: "Cumulus Wall",
        duration: 0.42,
        activeStart: 0.14,
        activeEnd: 0.28,
        baseDamage: 24,
        knockbackX: 170,
        knockbackY: -650,
        rangeX: 72,
        rangeY: 220,
        offsetX: 92,
        offsetY: -110,
        hitstop: 0.055,
        ultGain: 14,
        isProjectile: true,
        appliesStun: 1.25,
        slashKind: "gale_clap"
      },
      ultimate: {
        key: "ultimate",
        label: "Supercell Megaton",
        duration: 0.72,
        activeStart: 0.18,
        activeEnd: 0.52,
        baseDamage: 58,
        knockbackX: 760,
        knockbackY: -580,
        rangeX: 215,
        rangeY: 185,
        offsetX: 0,
        offsetY: -54,
        hitstop: 0.08,
        ultGain: 0,
        isAreaAround: true,
        appliesStun: 1.35,
        slashKind: "thunder"
      },
      recovery: {
        key: "recovery",
        label: "Updraft Lift",
        duration: 0.38,
        activeStart: 0.06,
        activeEnd: 0.28,
        baseDamage: 14,
        knockbackX: 220,
        knockbackY: -360,
        rangeX: 110,
        rangeY: 100,
        offsetX: 0,
        offsetY: -48,
        hitstop: 0.035,
        ultGain: 8,
        selfVx: 170,
        selfVy: -740,
        isAreaAround: true,
        slashKind: "recovery_burst"
      }
    }
  },
  eve: {
    id: "eve",
    name: "Eve",
    title: "Monochrome Eclipse Blade",
    accentColor: "#F4F4F5",
    secondaryColor: "#27272A",
    cardStats: {
      heart: 20,
      attack: 8,
      lightning: 52,
      shield: 2
    },
    maxHp: 200,
    atk: 8,
    def: 2,
    moveSpeed: 505,
    jumpVelocity: 745,
    weight: 0.85,
    width: 72,
    height: 90,
    moves: {
      // Attack 1: Ultra-fast split jab
      attack1: {
        key: "attack1",
        label: "Split Jab",
        duration: 0.2,
        activeStart: 0.04,
        activeEnd: 0.13,
        baseDamage: 12,
        knockbackX: 200,
        knockbackY: -120,
        rangeX: 96,
        rangeY: 38,
        offsetX: 54,
        offsetY: -46,
        hitstop: 0.025,
        ultGain: 10,
        selfVx: 180,
        slashKind: "split_jab"
      },
      // Attack 2: Twin orbiting companion orbs sweep around Eve
      attack2: {
        key: "attack2",
        label: "Orbital Twin Strike",
        duration: 0.3,
        activeStart: 0.08,
        activeEnd: 0.22,
        baseDamage: 18,
        knockbackX: 300,
        knockbackY: -270,
        rangeX: 142,
        rangeY: 68,
        offsetX: 0,
        offsetY: -46,
        hitstop: 0.04,
        ultGain: 14,
        isAreaAround: true,
        slashKind: "orbital_strike"
      },
      // Attack 3: Long piercing Eclipse Spear ray from the sketch
      attack3: {
        key: "attack3",
        label: "Eclipse Spear",
        duration: 0.36,
        activeStart: 0.11,
        activeEnd: 0.24,
        baseDamage: 24,
        knockbackX: 430,
        knockbackY: -210,
        rangeX: 168,
        rangeY: 36,
        offsetX: 94,
        offsetY: -50,
        hitstop: 0.055,
        ultGain: 17,
        selfVx: 90,
        slashKind: "eclipse_spear"
      },
      // Special: Giant Slow High-Damage Slash (long telegraph, avoidable, devastating if hit!)
      special: {
        key: "special",
        label: "Eclipse Cleave",
        duration: 0.92,
        activeStart: 0.52,
        activeEnd: 0.68,
        baseDamage: 56,
        knockbackX: 660,
        knockbackY: -440,
        rangeX: 224,
        rangeY: 168,
        offsetX: 96,
        offsetY: -64,
        hitstop: 0.085,
        ultGain: 24,
        selfVx: 110,
        slashKind: "eclipse_cleave"
      },
      // Ultimate: Duality Cross-Cut — blink-teleports & triggers 3 giant cross-cutting shadow waves
      ultimate: {
        key: "ultimate",
        label: "Duality Cross-Cut",
        duration: 0.65,
        activeStart: 0.14,
        activeEnd: 0.44,
        baseDamage: 28,
        knockbackX: 480,
        knockbackY: -360,
        rangeX: 210,
        rangeY: 170,
        offsetX: 0,
        offsetY: -52,
        hitstop: 0.065,
        ultGain: 0,
        isAreaAround: true,
        slashKind: "duality_cataclysm"
      },
      // Recovery: Eclipse Blink upward dash + slash
      recovery: {
        key: "recovery",
        label: "Eclipse Blink",
        duration: 0.32,
        activeStart: 0.05,
        activeEnd: 0.24,
        baseDamage: 14,
        knockbackX: 210,
        knockbackY: -360,
        rangeX: 96,
        rangeY: 96,
        offsetX: 0,
        offsetY: -46,
        hitstop: 0.032,
        ultGain: 8,
        selfVx: 240,
        selfVy: -820,
        isAreaAround: true,
        slashKind: "recovery_burst"
      }
    }
  },
  spidra: {
    id: "spidra",
    name: "Spydra",
    title: "Static Trickster Arachnid",
    accentColor: "#10B981",
    secondaryColor: "#F43F5E",
    cardStats: {
      heart: 30,
      attack: 6,
      lightning: 80,
      shield: 1
    },
    maxHp: 300,
    atk: 6,
    def: 1,
    moveSpeed: 575,
    jumpVelocity: 755,
    weight: 0.82,
    width: 76,
    height: 86,
    moves: {
      // Attack 1: Ultra-rapid forward spider-leg needle stab
      attack1: {
        key: "attack1",
        label: "Scuttle Needle",
        duration: 0.19,
        activeStart: 0.04,
        activeEnd: 0.13,
        baseDamage: 11,
        knockbackX: 195,
        knockbackY: -120,
        rangeX: 96,
        rangeY: 36,
        offsetX: 54,
        offsetY: -38,
        hitstop: 0.025,
        ultGain: 9,
        selfVx: 250,
        slashKind: "scuttle_needle"
      },
      // Attack 2: Fast 360-degree spider-leg spin sweep
      attack2: {
        key: "attack2",
        label: "Web Spin Kick",
        duration: 0.28,
        activeStart: 0.07,
        activeEnd: 0.2,
        baseDamage: 15,
        knockbackX: 280,
        knockbackY: -250,
        rangeX: 140,
        rangeY: 54,
        offsetX: 0,
        offsetY: -36,
        hitstop: 0.036,
        ultGain: 12,
        isAreaAround: true,
        slashKind: "web_spin"
      },
      // Attack 3: Speedy leaping screen-bash pounce
      attack3: {
        key: "attack3",
        label: "Static Pounce",
        duration: 0.36,
        activeStart: 0.1,
        activeEnd: 0.25,
        baseDamage: 21,
        knockbackX: 390,
        knockbackY: -310,
        rangeX: 88,
        rangeY: 78,
        offsetX: 46,
        offsetY: -46,
        hitstop: 0.05,
        ultGain: 16,
        selfVx: 410,
        selfVy: -210,
        slashKind: "static_pounce"
      },
      // Special: Short-range TV Blare cone — if it lands, inverts opponent controls for 3.5 seconds!
      special: {
        key: "special",
        label: "TV Blare",
        duration: 0.36,
        activeStart: 0.1,
        activeEnd: 0.24,
        baseDamage: 16,
        knockbackX: 240,
        knockbackY: -190,
        rangeX: 100,
        rangeY: 80,
        offsetX: 54,
        offsetY: -52,
        hitstop: 0.045,
        ultGain: 14,
        appliesConfuse: 3.5,
        slashKind: "tv_blare"
      },
      // Ultimate: Glitch Jammer Field — drops a persistent CRT static field that shocks & confuses
      ultimate: {
        key: "ultimate",
        label: "Glitch Jammer Field",
        duration: 0.62,
        activeStart: 0.14,
        activeEnd: 0.42,
        baseDamage: 28,
        knockbackX: 460,
        knockbackY: -380,
        rangeX: 210,
        rangeY: 165,
        offsetX: 0,
        offsetY: -48,
        hitstop: 0.06,
        ultGain: 0,
        isAreaAround: true,
        appliesConfuse: 4.5,
        slashKind: "broadcast_overload"
      },
      // Recovery: Grapple Thread upward silk boost
      recovery: {
        key: "recovery",
        label: "Grapple Thread",
        duration: 0.3,
        activeStart: 0.04,
        activeEnd: 0.22,
        baseDamage: 11,
        knockbackX: 190,
        knockbackY: -340,
        rangeX: 94,
        rangeY: 94,
        offsetX: 0,
        offsetY: -46,
        hitstop: 0.03,
        ultGain: 8,
        selfVx: 260,
        selfVy: -830,
        isAreaAround: true,
        slashKind: "recovery_burst"
      }
    }
  },
  marshal_bolt: {
    id: "marshal_bolt",
    name: "Marshal Bolt",
    title: "Cowboy Cop Automaton",
    accentColor: "#818CF8",
    secondaryColor: "#F43F5E",
    cardStats: {
      heart: 45,
      attack: 8,
      lightning: 54,
      shield: 3
    },
    maxHp: 450,
    atk: 8,
    def: 3,
    moveSpeed: 395,
    jumpVelocity: 705,
    weight: 1.05,
    width: 70,
    height: 98,
    moves: {
      // Attack 1: Quick-Draw Arc Baton
      attack1: {
        key: "attack1",
        label: "Quick-Draw Baton",
        duration: 0.25,
        activeStart: 0.06,
        activeEnd: 0.17,
        baseDamage: 14,
        knockbackX: 240,
        knockbackY: -150,
        rangeX: 92,
        rangeY: 46,
        offsetX: 52,
        offsetY: -52,
        hitstop: 0.035,
        ultGain: 10,
        selfVx: 130,
        slashKind: "baton_strike"
      },
      // Attack 2: Electric Laser Lasso Sweep
      attack2: {
        key: "attack2",
        label: "Laser Lasso",
        duration: 0.32,
        activeStart: 0.09,
        activeEnd: 0.23,
        baseDamage: 18,
        knockbackX: 300,
        knockbackY: -220,
        rangeX: 132,
        rangeY: 56,
        offsetX: 66,
        offsetY: -54,
        hitstop: 0.045,
        ultGain: 13,
        slashKind: "lasso_whip"
      },
      // Attack 3: Hydraulic Gear-Spur Kick
      attack3: {
        key: "attack3",
        label: "Gear-Spur Kick",
        duration: 0.42,
        activeStart: 0.14,
        activeEnd: 0.3,
        baseDamage: 27,
        knockbackX: 480,
        knockbackY: -340,
        rangeX: 98,
        rangeY: 74,
        offsetX: 50,
        offsetY: -44,
        hitstop: 0.065,
        ultGain: 17,
        selfVx: 240,
        slashKind: "spur_kick"
      },
      // Special: Deadeye Lasso Shot — electrified cuff bolt that stuns & yanks foe inward!
      special: {
        key: "special",
        label: "Deadeye Lasso Shot",
        duration: 0.38,
        activeStart: 0.12,
        activeEnd: 0.24,
        baseDamage: 16,
        knockbackX: 340,
        knockbackY: -220,
        rangeX: 70,
        rangeY: 46,
        offsetX: 48,
        offsetY: -56,
        hitstop: 0.045,
        ultGain: 14,
        isProjectile: true,
        appliesStun: 0.85,
        slashKind: "deadeye_shot"
      },
      // Ultimate: High-Noon Railgun — targeting crosshair lock followed by screen-wide piercing beam!
      ultimate: {
        key: "ultimate",
        label: "High-Noon Railgun",
        duration: 0.68,
        activeStart: 0.16,
        activeEnd: 0.44,
        baseDamage: 24,
        knockbackX: 460,
        knockbackY: -360,
        rangeX: 185,
        rangeY: 160,
        offsetX: 0,
        offsetY: -52,
        hitstop: 0.065,
        ultGain: 0,
        isAreaAround: true,
        appliesStun: 0.6,
        slashKind: "high_noon_lockdown"
      },
      // Recovery: Spur Thruster Jet Boost
      recovery: {
        key: "recovery",
        label: "Spur Thruster",
        duration: 0.34,
        activeStart: 0.05,
        activeEnd: 0.25,
        baseDamage: 14,
        knockbackX: 210,
        knockbackY: -360,
        rangeX: 98,
        rangeY: 100,
        offsetX: 0,
        offsetY: -48,
        hitstop: 0.035,
        ultGain: 8,
        selfVx: 210,
        selfVy: -790,
        isAreaAround: true,
        slashKind: "recovery_burst"
      }
    }
  },
  pyro_jack: {
    id: "pyro_jack",
    name: "Pyro Jack",
    title: "Furnace Lantern Bruiser",
    accentColor: "#F97316",
    secondaryColor: "#FACC15",
    cardStats: {
      heart: 50,
      attack: 9,
      lightning: 46,
      shield: 4
    },
    maxHp: 500,
    atk: 9,
    def: 4,
    moveSpeed: 365,
    jumpVelocity: 690,
    weight: 1.12,
    width: 78,
    height: 96,
    moves: {
      attack1: {
        key: "attack1",
        label: "Torch Upper",
        duration: 0.26,
        activeStart: 0.06,
        activeEnd: 0.17,
        baseDamage: 16,
        knockbackX: 240,
        knockbackY: -180,
        rangeX: 88,
        rangeY: 54,
        offsetX: 48,
        offsetY: -48,
        hitstop: 0.036,
        ultGain: 10,
        selfVx: 110,
        slashKind: "fire_upper"
      },
      attack2: {
        key: "attack2",
        label: "Ember Hook",
        duration: 0.34,
        activeStart: 0.09,
        activeEnd: 0.23,
        baseDamage: 20,
        knockbackX: 330,
        knockbackY: -220,
        rangeX: 104,
        rangeY: 54,
        offsetX: 54,
        offsetY: -48,
        hitstop: 0.048,
        ultGain: 14,
        selfVx: 170,
        slashKind: "ember_hook"
      },
      attack3: {
        key: "attack3",
        label: "Meteor Crash",
        duration: 0.44,
        activeStart: 0.14,
        activeEnd: 0.31,
        baseDamage: 30,
        knockbackX: 500,
        knockbackY: -390,
        rangeX: 118,
        rangeY: 88,
        offsetX: 58,
        offsetY: -44,
        hitstop: 0.068,
        ultGain: 18,
        selfVx: 210,
        selfVy: -140,
        slashKind: "meteor_crash"
      },
      special: {
        key: "special",
        label: "Ember Bomb",
        duration: 0.38,
        activeStart: 0.12,
        activeEnd: 0.24,
        baseDamage: 22,
        knockbackX: 380,
        knockbackY: -320,
        rangeX: 60,
        rangeY: 60,
        offsetX: 40,
        offsetY: -56,
        hitstop: 0.045,
        ultGain: 14,
        isProjectile: true,
        slashKind: "ember_hook"
      },
      ultimate: {
        key: "ultimate",
        label: "Volcano Fountain",
        duration: 0.7,
        activeStart: 0.16,
        activeEnd: 0.48,
        baseDamage: 32,
        knockbackX: 520,
        knockbackY: -440,
        rangeX: 200,
        rangeY: 170,
        offsetX: 0,
        offsetY: -52,
        hitstop: 0.075,
        ultGain: 0,
        selfVy: -240,
        isAreaAround: true,
        slashKind: "inferno_nova"
      },
      recovery: {
        key: "recovery",
        label: "Furnace Jet",
        duration: 0.36,
        activeStart: 0.06,
        activeEnd: 0.26,
        baseDamage: 14,
        knockbackX: 210,
        knockbackY: -350,
        rangeX: 98,
        rangeY: 100,
        offsetX: 0,
        offsetY: -46,
        hitstop: 0.034,
        ultGain: 8,
        selfVx: 190,
        selfVy: -750,
        isAreaAround: true,
        slashKind: "recovery_burst"
      }
    }
  },
  aqua_nyx: {
    id: "aqua_nyx",
    name: "Aqua Nyx",
    title: "Abyssal Jelly Mystic",
    accentColor: "#06B6D4",
    secondaryColor: "#F472B6",
    cardStats: {
      heart: 38,
      attack: 7,
      lightning: 68,
      shield: 2
    },
    maxHp: 380,
    atk: 7,
    def: 2,
    moveSpeed: 495,
    jumpVelocity: 750,
    weight: 0.86,
    width: 74,
    height: 92,
    moves: {
      attack1: {
        key: "attack1",
        label: "Tentacle Snap",
        duration: 0.22,
        activeStart: 0.05,
        activeEnd: 0.15,
        baseDamage: 12,
        knockbackX: 210,
        knockbackY: -135,
        rangeX: 112,
        rangeY: 42,
        offsetX: 62,
        offsetY: -44,
        hitstop: 0.03,
        ultGain: 10,
        selfVx: 130,
        slashKind: "tentacle_snap"
      },
      attack2: {
        key: "attack2",
        label: "Riptide Spin",
        duration: 0.31,
        activeStart: 0.08,
        activeEnd: 0.22,
        baseDamage: 17,
        knockbackX: 295,
        knockbackY: -260,
        rangeX: 148,
        rangeY: 66,
        offsetX: 0,
        offsetY: -46,
        hitstop: 0.04,
        ultGain: 14,
        isAreaAround: true,
        appliesSlow: 1.5,
        slashKind: "riptide_spin"
      },
      attack3: {
        key: "attack3",
        label: "Pearl Slam",
        duration: 0.4,
        activeStart: 0.12,
        activeEnd: 0.27,
        baseDamage: 24,
        knockbackX: 410,
        knockbackY: -360,
        rangeX: 102,
        rangeY: 78,
        offsetX: 54,
        offsetY: -48,
        hitstop: 0.056,
        ultGain: 17,
        selfVx: 220,
        slashKind: "pearl_slam"
      },
      special: {
        key: "special",
        label: "Bubble Prison",
        duration: 0.36,
        activeStart: 0.11,
        activeEnd: 0.23,
        baseDamage: 14,
        knockbackX: 90,
        knockbackY: -490,
        rangeX: 64,
        rangeY: 64,
        offsetX: 44,
        offsetY: -50,
        hitstop: 0.036,
        ultGain: 14,
        isProjectile: true,
        appliesSlow: 3.2,
        appliesStun: 0.9,
        slashKind: "tentacle_snap"
      },
      ultimate: {
        key: "ultimate",
        label: "Abyssal Whirlpool",
        duration: 0.68,
        activeStart: 0.16,
        activeEnd: 0.48,
        baseDamage: 26,
        knockbackX: 380,
        knockbackY: -360,
        rangeX: 205,
        rangeY: 170,
        offsetX: 0,
        offsetY: -50,
        hitstop: 0.068,
        ultGain: 0,
        isAreaAround: true,
        appliesSlow: 3.5,
        slashKind: "tidal_maelstrom"
      },
      recovery: {
        key: "recovery",
        label: "Geyser Pulse",
        duration: 0.32,
        activeStart: 0.05,
        activeEnd: 0.24,
        baseDamage: 12,
        knockbackX: 200,
        knockbackY: -350,
        rangeX: 96,
        rangeY: 96,
        offsetX: 0,
        offsetY: -46,
        hitstop: 0.032,
        ultGain: 8,
        selfVx: 210,
        selfVy: -800,
        isAreaAround: true,
        slashKind: "recovery_burst"
      }
    }
  },
  blade_zero: {
    id: "blade_zero",
    name: "BladeZero",
    title: "Cyber Katana Ronin",
    accentColor: "#EF4444",
    secondaryColor: "#E2E8F0",
    cardStats: {
      heart: 36,
      attack: 9,
      lightning: 76,
      shield: 2
    },
    maxHp: 360,
    atk: 9,
    def: 2,
    moveSpeed: 545,
    jumpVelocity: 745,
    weight: 0.88,
    width: 70,
    height: 94,
    moves: {
      attack1: {
        key: "attack1",
        label: "Iaido Draw",
        duration: 0.19,
        activeStart: 0.04,
        activeEnd: 0.13,
        baseDamage: 13,
        knockbackX: 215,
        knockbackY: -125,
        rangeX: 112,
        rangeY: 42,
        offsetX: 62,
        offsetY: -46,
        hitstop: 0.028,
        ultGain: 10,
        selfVx: 220,
        slashKind: "iaido_slash"
      },
      attack2: {
        key: "attack2",
        label: "Cross Crescent",
        duration: 0.28,
        activeStart: 0.07,
        activeEnd: 0.19,
        baseDamage: 18,
        knockbackX: 300,
        knockbackY: -230,
        rangeX: 118,
        rangeY: 72,
        offsetX: 62,
        offsetY: -48,
        hitstop: 0.042,
        ultGain: 13,
        selfVx: 240,
        slashKind: "cross_crescent"
      },
      attack3: {
        key: "attack3",
        label: "Dragon Fang",
        duration: 0.37,
        activeStart: 0.11,
        activeEnd: 0.25,
        baseDamage: 26,
        knockbackX: 460,
        knockbackY: -340,
        rangeX: 134,
        rangeY: 82,
        offsetX: 68,
        offsetY: -50,
        hitstop: 0.06,
        ultGain: 17,
        selfVx: 290,
        slashKind: "dragon_fang"
      },
      special: {
        key: "special",
        label: "Shadow Counter",
        duration: 0.56,
        activeStart: 0.04,
        activeEnd: 0.52,
        baseDamage: 32,
        knockbackX: 520,
        knockbackY: -340,
        rangeX: 120,
        rangeY: 80,
        offsetX: 0,
        offsetY: -48,
        hitstop: 0.075,
        ultGain: 16,
        isProjectile: true,
        slashKind: "iaido_slash"
      },
      ultimate: {
        key: "ultimate",
        label: "Judgement Blitz",
        duration: 0.72,
        activeStart: 0.1,
        activeEnd: 0.56,
        baseDamage: 18,
        knockbackX: 340,
        knockbackY: -260,
        rangeX: 220,
        rangeY: 165,
        offsetX: 60,
        offsetY: -50,
        hitstop: 0.055,
        ultGain: 0,
        selfVx: 480,
        isAreaAround: true,
        slashKind: "omnislash_flash"
      },
      recovery: {
        key: "recovery",
        label: "Air Dash Cut",
        duration: 0.3,
        activeStart: 0.04,
        activeEnd: 0.22,
        baseDamage: 14,
        knockbackX: 220,
        knockbackY: -350,
        rangeX: 102,
        rangeY: 102,
        offsetX: 0,
        offsetY: -46,
        hitstop: 0.032,
        ultGain: 8,
        selfVx: 250,
        selfVy: -810,
        isAreaAround: true,
        slashKind: "recovery_burst"
      }
    }
  },
  moss_golem: {
    id: "moss_golem",
    name: "Moss Golem",
    title: "Ancient Rune Titan",
    accentColor: "#22C55E",
    secondaryColor: "#A3E635",
    cardStats: {
      heart: 60,
      attack: 10,
      lightning: 34,
      shield: 5
    },
    maxHp: 600,
    atk: 10,
    def: 5,
    moveSpeed: 315,
    jumpVelocity: 655,
    weight: 1.28,
    width: 88,
    height: 100,
    moves: {
      attack1: {
        key: "attack1",
        label: "Granite Jab",
        duration: 0.3,
        activeStart: 0.09,
        activeEnd: 0.2,
        baseDamage: 20,
        knockbackX: 350,
        knockbackY: -180,
        rangeX: 84,
        rangeY: 72,
        offsetX: 50,
        offsetY: -48,
        hitstop: 0.05,
        ultGain: 11,
        selfVx: 100,
        slashKind: "granite_jab"
      },
      attack2: {
        key: "attack2",
        label: "Tectonic Clap",
        duration: 0.41,
        activeStart: 0.14,
        activeEnd: 0.28,
        baseDamage: 24,
        knockbackX: 460,
        knockbackY: -290,
        rangeX: 174,
        rangeY: 84,
        offsetX: 0,
        offsetY: -50,
        hitstop: 0.062,
        ultGain: 15,
        isAreaAround: true,
        appliesStun: 0.5,
        slashKind: "tectonic_clap"
      },
      attack3: {
        key: "attack3",
        label: "Quake Stomp",
        duration: 0.5,
        activeStart: 0.18,
        activeEnd: 0.34,
        baseDamage: 35,
        knockbackX: 560,
        knockbackY: -450,
        rangeX: 196,
        rangeY: 64,
        offsetX: 0,
        offsetY: -28,
        hitstop: 0.078,
        ultGain: 19,
        selfVx: 120,
        selfVy: -150,
        isAreaAround: true,
        appliesStun: 0.75,
        slashKind: "quake_stomp"
      },
      special: {
        key: "special",
        label: "Aegis Bastion",
        duration: 0.56,
        activeStart: 0.05,
        activeEnd: 0.5,
        baseDamage: 20,
        knockbackX: 430,
        knockbackY: -310,
        rangeX: 165,
        rangeY: 110,
        offsetX: 0,
        offsetY: -50,
        hitstop: 0.055,
        ultGain: 15,
        isAreaAround: true,
        slashKind: "tectonic_clap"
      },
      ultimate: {
        key: "ultimate",
        label: "Meteor Monolith",
        duration: 0.72,
        activeStart: 0.16,
        activeEnd: 0.48,
        baseDamage: 30,
        knockbackX: 520,
        knockbackY: -430,
        rangeX: 210,
        rangeY: 170,
        offsetX: 0,
        offsetY: -52,
        hitstop: 0.078,
        ultGain: 0,
        selfVy: -380,
        isAreaAround: true,
        appliesStun: 1,
        slashKind: "seismic_monolith"
      },
      recovery: {
        key: "recovery",
        label: "Geyser Heave",
        duration: 0.38,
        activeStart: 0.06,
        activeEnd: 0.28,
        baseDamage: 16,
        knockbackX: 240,
        knockbackY: -370,
        rangeX: 112,
        rangeY: 102,
        offsetX: 0,
        offsetY: -48,
        hitstop: 0.036,
        ultGain: 8,
        selfVx: 165,
        selfVy: -720,
        isAreaAround: true,
        slashKind: "recovery_burst"
      }
    }
  },
  astro_pip: {
    id: "astro_pip",
    name: "Astro Pip",
    title: "Cosmic Hamster Pilot",
    accentColor: "#A855F7",
    secondaryColor: "#FDE047",
    cardStats: {
      heart: 34,
      attack: 7,
      lightning: 74,
      shield: 2
    },
    maxHp: 340,
    atk: 7,
    def: 2,
    moveSpeed: 530,
    jumpVelocity: 760,
    weight: 0.8,
    width: 68,
    height: 86,
    moves: {
      attack1: {
        key: "attack1",
        label: "Star Tap",
        duration: 0.2,
        activeStart: 0.04,
        activeEnd: 0.13,
        baseDamage: 11,
        knockbackX: 195,
        knockbackY: -125,
        rangeX: 88,
        rangeY: 38,
        offsetX: 48,
        offsetY: -40,
        hitstop: 0.026,
        ultGain: 9,
        selfVx: 190,
        slashKind: "star_tap"
      },
      attack2: {
        key: "attack2",
        label: "Orbit Roll",
        duration: 0.29,
        activeStart: 0.07,
        activeEnd: 0.21,
        baseDamage: 16,
        knockbackX: 280,
        knockbackY: -245,
        rangeX: 136,
        rangeY: 60,
        offsetX: 0,
        offsetY: -40,
        hitstop: 0.038,
        ultGain: 13,
        selfVx: 240,
        isAreaAround: true,
        slashKind: "orbit_roll"
      },
      attack3: {
        key: "attack3",
        label: "Comet Kick",
        duration: 0.37,
        activeStart: 0.11,
        activeEnd: 0.25,
        baseDamage: 23,
        knockbackX: 410,
        knockbackY: -330,
        rangeX: 98,
        rangeY: 74,
        offsetX: 50,
        offsetY: -44,
        hitstop: 0.052,
        ultGain: 17,
        selfVx: 330,
        selfVy: -150,
        slashKind: "comet_kick"
      },
      special: {
        key: "special",
        label: "Ricochet Star",
        duration: 0.34,
        activeStart: 0.1,
        activeEnd: 0.22,
        baseDamage: 16,
        knockbackX: 265,
        knockbackY: -225,
        rangeX: 60,
        rangeY: 48,
        offsetX: 42,
        offsetY: -48,
        hitstop: 0.036,
        ultGain: 13,
        isProjectile: true,
        slashKind: "star_tap"
      },
      ultimate: {
        key: "ultimate",
        label: "Starfall Rain",
        duration: 0.58,
        activeStart: 0.14,
        activeEnd: 0.42,
        baseDamage: 24,
        knockbackX: 420,
        knockbackY: -360,
        rangeX: 190,
        rangeY: 160,
        offsetX: 0,
        offsetY: -46,
        hitstop: 0.06,
        ultGain: 0,
        isAreaAround: true,
        slashKind: "supernova_comet"
      },
      recovery: {
        key: "recovery",
        label: "Jetpack Boost",
        duration: 0.31,
        activeStart: 0.04,
        activeEnd: 0.23,
        baseDamage: 12,
        knockbackX: 195,
        knockbackY: -350,
        rangeX: 94,
        rangeY: 94,
        offsetX: 0,
        offsetY: -42,
        hitstop: 0.03,
        ultGain: 8,
        selfVx: 240,
        selfVy: -820,
        isAreaAround: true,
        slashKind: "recovery_burst"
      }
    }
  }
};
var MAP_SPECS = {
  hive_canopy: {
    id: "hive_canopy",
    name: "Hive Canopy",
    subtitle: "Sunlit Amber Boughs",
    mechanicNote: "Patrolling hornet swarm, breakable honeycomb perches + venom honey vats",
    skyTop: "#1E140B",
    skyMid: "#78350F",
    skyBottom: "#F59E0B",
    accentColor: "#FBBF24",
    platforms: [
      {
        x: 220,
        baseX: 220,
        y: 530,
        baseY: 530,
        width: 840,
        height: 44,
        passThrough: false,
        style: "solid",
        destructible: false,
        scars: []
      },
      {
        x: 310,
        baseX: 310,
        y: 385,
        baseY: 385,
        width: 220,
        height: 20,
        passThrough: true,
        style: "honeycomb",
        destructible: true,
        hp: 80,
        maxHp: 80,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      },
      {
        x: 750,
        baseX: 750,
        y: 385,
        baseY: 385,
        width: 220,
        height: 20,
        passThrough: true,
        style: "honeycomb",
        destructible: true,
        hp: 80,
        maxHp: 80,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      }
    ],
    obstacles: [
      {
        id: "canopy_hornet_swarm",
        kind: "hive_swarm",
        x: 640,
        y: 340,
        width: 76,
        height: 54,
        radius: 34,
        period: 7.5
      }
    ],
    destructibles: [
      {
        id: "hive_vat_left",
        kind: "honey_vat",
        x: 280,
        y: 530,
        width: 44,
        height: 52,
        maxHp: 45
      },
      {
        id: "hive_vat_right",
        kind: "honey_vat",
        x: 1e3,
        y: 530,
        width: 44,
        height: 52,
        maxHp: 45
      }
    ],
    spawnPoints: [
      { x: 430, y: 530 },
      { x: 850, y: 530 }
    ]
  },
  storm_citadel: {
    id: "storm_citadel",
    name: "Storm Citadel",
    subtitle: "High-Altitude Thunder Peaks",
    mechanicNote: "Overhead lightning strikes, cloud ledges + storm coil pylons",
    skyTop: "#060B19",
    skyMid: "#0F172A",
    skyBottom: "#1E3A5F",
    accentColor: "#38BDF8",
    platforms: [
      {
        x: 245,
        baseX: 245,
        y: 540,
        baseY: 540,
        width: 790,
        height: 46,
        passThrough: false,
        style: "citadel",
        destructible: false,
        scars: []
      },
      {
        x: 265,
        baseX: 265,
        y: 400,
        baseY: 400,
        width: 195,
        height: 20,
        passThrough: true,
        style: "cloud",
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      },
      {
        x: 820,
        baseX: 820,
        y: 400,
        baseY: 400,
        width: 195,
        height: 20,
        passThrough: true,
        style: "cloud",
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      },
      {
        x: 540,
        baseX: 540,
        y: 280,
        baseY: 280,
        width: 200,
        height: 20,
        passThrough: true,
        style: "cloud",
        destructible: true,
        hp: 85,
        maxHp: 85,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      }
    ],
    obstacles: [
      {
        id: "citadel_lightning_left",
        kind: "lightning_arc",
        x: 420,
        y: 540,
        width: 64,
        height: 520,
        period: 4.8,
        phase: 0
      },
      {
        id: "citadel_lightning_right",
        kind: "lightning_arc",
        x: 860,
        y: 540,
        width: 64,
        height: 520,
        period: 4.8,
        phase: 2.4
      }
    ],
    destructibles: [
      {
        id: "storm_pylon_left",
        kind: "storm_pylon",
        x: 305,
        y: 540,
        width: 38,
        height: 62,
        maxHp: 50
      },
      {
        id: "storm_pylon_right",
        kind: "storm_pylon",
        x: 975,
        y: 540,
        width: 38,
        height: 62,
        maxHp: 50
      }
    ],
    spawnPoints: [
      { x: 430, y: 540 },
      { x: 850, y: 540 }
    ]
  },
  magma_foundry: {
    id: "magma_foundry",
    name: "Magma Foundry",
    subtitle: "Split Basalt & Erupting Core",
    mechanicNote: "Gliding iron gondola, lava geyser + volatile magma crystals",
    skyTop: "#160705",
    skyMid: "#45120A",
    skyBottom: "#9A3412",
    accentColor: "#FB923C",
    platforms: [
      {
        x: 185,
        baseX: 185,
        y: 535,
        baseY: 535,
        width: 340,
        height: 44,
        passThrough: false,
        style: "magma",
        destructible: false,
        scars: []
      },
      {
        x: 755,
        baseX: 755,
        y: 535,
        baseY: 535,
        width: 340,
        height: 44,
        passThrough: false,
        style: "magma",
        destructible: false,
        scars: []
      },
      {
        // Moving Iron Gondola gliding across the molten center pit
        x: 550,
        baseX: 550,
        y: 410,
        baseY: 410,
        width: 180,
        height: 20,
        passThrough: true,
        style: "magma",
        destructible: true,
        hp: 85,
        maxHp: 85,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "horizontal",
          ampX: 165,
          ampY: 0,
          speed: 1.35,
          phase: 0
        }
      },
      {
        x: 245,
        baseX: 245,
        y: 350,
        baseY: 350,
        width: 155,
        height: 18,
        passThrough: true,
        style: "magma",
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      },
      {
        x: 880,
        baseX: 880,
        y: 350,
        baseY: 350,
        width: 155,
        height: 18,
        passThrough: true,
        style: "magma",
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      }
    ],
    obstacles: [
      {
        id: "center_geyser",
        kind: "lava_geyser",
        x: 640,
        y: 690,
        width: 82,
        height: 420,
        period: 5.5,
        phase: 0
      }
    ],
    destructibles: [
      {
        id: "magma_crystal_left",
        kind: "magma_crystal",
        x: 230,
        y: 535,
        width: 42,
        height: 58,
        maxHp: 45
      },
      {
        id: "magma_crystal_right",
        kind: "magma_crystal",
        x: 1050,
        y: 535,
        width: 42,
        height: 58,
        maxHp: 45
      }
    ],
    spawnPoints: [
      { x: 355, y: 535 },
      { x: 925, y: 535 }
    ]
  },
  wind_mill_spire: {
    id: "wind_mill_spire",
    name: "Gale Windmill",
    subtitle: "Orbiting Blades & Turbine",
    mechanicNote: "Breakable orbiting blades, wind bumper + updraft crates",
    skyTop: "#0F172A",
    skyMid: "#1E3A5F",
    skyBottom: "#0D9488",
    accentColor: "#2DD4BF",
    platforms: [
      {
        x: 270,
        baseX: 270,
        y: 545,
        baseY: 545,
        width: 740,
        height: 42,
        passThrough: false,
        style: "windmill",
        destructible: false,
        scars: []
      },
      {
        x: 340,
        baseX: 340,
        y: 390,
        baseY: 390,
        width: 165,
        height: 18,
        passThrough: true,
        style: "windmill",
        destructible: true,
        hp: 80,
        maxHp: 80,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "orbit",
          ampX: 90,
          ampY: 65,
          speed: 1.15,
          phase: 0
        }
      },
      {
        x: 775,
        baseX: 775,
        y: 390,
        baseY: 390,
        width: 165,
        height: 18,
        passThrough: true,
        style: "windmill",
        destructible: true,
        hp: 80,
        maxHp: 80,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "orbit",
          ampX: 90,
          ampY: 65,
          speed: 1.15,
          phase: Math.PI
        }
      }
    ],
    obstacles: [
      {
        id: "wind_turbine_bumper",
        kind: "wind_bumper",
        x: 640,
        y: 360,
        width: 72,
        height: 72,
        radius: 36
      }
    ],
    destructibles: [
      {
        id: "windmill_crate_left",
        kind: "windmill_crate",
        x: 320,
        y: 545,
        width: 46,
        height: 46,
        maxHp: 40
      },
      {
        id: "windmill_crate_right",
        kind: "windmill_crate",
        x: 960,
        y: 545,
        width: 46,
        height: 46,
        maxHp: 40
      }
    ],
    spawnPoints: [
      { x: 430, y: 545 },
      { x: 850, y: 545 }
    ]
  },
  eclipse_temple: {
    id: "eclipse_temple",
    name: "Eclipse Temple",
    subtitle: "Monochrome Duality Shrine",
    mechanicNote: "Breakable shrine ledges, spring runes, pendulum + duality urns",
    skyTop: "#09090B",
    skyMid: "#18181B",
    skyBottom: "#3F3F46",
    accentColor: "#F4F4F5",
    platforms: [
      {
        x: 220,
        baseX: 220,
        y: 545,
        baseY: 545,
        width: 840,
        height: 42,
        passThrough: false,
        style: "temple",
        destructible: false,
        scars: []
      },
      {
        x: 280,
        baseX: 280,
        y: 380,
        baseY: 380,
        width: 175,
        height: 18,
        passThrough: true,
        style: "temple",
        destructible: true,
        hp: 80,
        maxHp: 80,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "vertical",
          ampX: 0,
          ampY: 55,
          speed: 1.4,
          phase: 0
        }
      },
      {
        x: 825,
        baseX: 825,
        y: 380,
        baseY: 380,
        width: 175,
        height: 18,
        passThrough: true,
        style: "temple",
        destructible: true,
        hp: 80,
        maxHp: 80,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "vertical",
          ampX: 0,
          ampY: 55,
          speed: 1.4,
          phase: Math.PI
        }
      },
      {
        x: 545,
        baseX: 545,
        y: 255,
        baseY: 255,
        width: 190,
        height: 18,
        passThrough: true,
        style: "temple",
        destructible: true,
        hp: 85,
        maxHp: 85,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      }
    ],
    obstacles: [
      {
        id: "left_jump_rune",
        kind: "jump_pad",
        x: 265,
        y: 545,
        width: 58,
        height: 16
      },
      {
        id: "right_jump_rune",
        kind: "jump_pad",
        x: 1015,
        y: 545,
        width: 58,
        height: 16
      },
      {
        id: "eclipse_pendulum",
        kind: "eclipse_pendulum",
        x: 640,
        y: 265,
        width: 56,
        height: 56,
        radius: 28,
        swingRadius: 155,
        period: 3.4
      }
    ],
    destructibles: [
      {
        id: "eclipse_urn_left",
        kind: "eclipse_urn",
        x: 330,
        y: 545,
        width: 40,
        height: 54,
        maxHp: 45
      },
      {
        id: "eclipse_urn_right",
        kind: "eclipse_urn",
        x: 950,
        y: 545,
        width: 40,
        height: 54,
        maxHp: 45
      }
    ],
    spawnPoints: [
      { x: 430, y: 545 },
      { x: 850, y: 545 }
    ]
  },
  neon_skyline: {
    id: "neon_skyline",
    name: "Neon Skyline",
    subtitle: "Cyber City & Hover Traffic",
    mechanicNote: "Passing hover cars slam fighters across 2 lanes + breakable skywalks",
    skyTop: "#06071A",
    skyMid: "#1E1B4B",
    skyBottom: "#4C1D95",
    accentColor: "#22D3EE",
    platforms: [
      {
        x: 200,
        baseX: 200,
        y: 545,
        baseY: 545,
        width: 880,
        height: 42,
        passThrough: false,
        style: "city",
        destructible: false,
        scars: []
      },
      {
        x: 260,
        baseX: 260,
        y: 390,
        baseY: 390,
        width: 185,
        height: 18,
        passThrough: true,
        style: "city",
        destructible: true,
        hp: 80,
        maxHp: 80,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      },
      {
        x: 835,
        baseX: 835,
        y: 390,
        baseY: 390,
        width: 185,
        height: 18,
        passThrough: true,
        style: "city",
        destructible: true,
        hp: 80,
        maxHp: 80,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      },
      {
        x: 550,
        baseX: 550,
        y: 268,
        baseY: 268,
        width: 180,
        height: 18,
        passThrough: true,
        style: "city",
        destructible: true,
        hp: 85,
        maxHp: 85,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "horizontal",
          ampX: 175,
          ampY: 0,
          speed: 1.25,
          phase: 0
        }
      }
    ],
    obstacles: [
      {
        id: "hover_car_lower",
        kind: "hover_car",
        x: 640,
        y: 472,
        width: 120,
        height: 38,
        period: 4.8,
        phase: 1.4,
        direction: 1,
        speed: 820
      },
      {
        id: "hover_car_upper",
        kind: "hover_car",
        x: 640,
        y: 325,
        width: 114,
        height: 36,
        period: 5.5,
        phase: 3.7,
        direction: -1,
        speed: 880
      }
    ],
    destructibles: [
      {
        id: "neon_beacon_left",
        kind: "neon_beacon",
        x: 245,
        y: 545,
        width: 38,
        height: 46,
        maxHp: 45
      },
      {
        id: "neon_beacon_right",
        kind: "neon_beacon",
        x: 1035,
        y: 545,
        width: 38,
        height: 46,
        maxHp: 45
      }
    ],
    spawnPoints: [
      { x: 430, y: 545 },
      { x: 850, y: 545 }
    ]
  },
  frost_glacier: {
    id: "frost_glacier",
    name: "Frost Peaks",
    subtitle: "Aurora Ice & Falling Icicles",
    mechanicNote: "Plunging ceiling icicles, slick ice footing + shattering frost crystals",
    skyTop: "#041424",
    skyMid: "#0E3A5D",
    skyBottom: "#38BDF8",
    accentColor: "#7DD3FC",
    platforms: [
      {
        x: 240,
        baseX: 240,
        y: 540,
        baseY: 540,
        width: 800,
        height: 44,
        passThrough: false,
        style: "ice",
        icy: true,
        destructible: false,
        scars: []
      },
      {
        x: 280,
        baseX: 280,
        y: 375,
        baseY: 375,
        width: 170,
        height: 18,
        passThrough: true,
        style: "ice",
        icy: true,
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "vertical",
          ampX: 0,
          ampY: 44,
          speed: 1.35,
          phase: 0
        }
      },
      {
        x: 830,
        baseX: 830,
        y: 375,
        baseY: 375,
        width: 170,
        height: 18,
        passThrough: true,
        style: "ice",
        icy: true,
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "vertical",
          ampX: 0,
          ampY: 44,
          speed: 1.35,
          phase: Math.PI
        }
      },
      {
        x: 550,
        baseX: 550,
        y: 255,
        baseY: 255,
        width: 180,
        height: 18,
        passThrough: true,
        style: "ice",
        icy: true,
        destructible: true,
        hp: 80,
        maxHp: 80,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      }
    ],
    obstacles: [
      {
        id: "glacier_icicle_left",
        kind: "icicle_drop",
        x: 425,
        y: 540,
        width: 52,
        height: 64,
        period: 4.6,
        phase: 0.4
      },
      {
        id: "glacier_icicle_right",
        kind: "icicle_drop",
        x: 855,
        y: 540,
        width: 52,
        height: 64,
        period: 4.6,
        phase: 2.8
      }
    ],
    destructibles: [
      {
        id: "frost_crystal_left",
        kind: "frost_crystal",
        x: 275,
        y: 540,
        width: 42,
        height: 56,
        maxHp: 45
      },
      {
        id: "frost_crystal_right",
        kind: "frost_crystal",
        x: 1005,
        y: 540,
        width: 42,
        height: 56,
        maxHp: 45
      }
    ],
    spawnPoints: [
      { x: 430, y: 540 },
      { x: 850, y: 540 }
    ]
  },
  cyber_factory: {
    id: "cyber_factory",
    name: "Gearworks",
    subtitle: "Conveyors & Crusher Press",
    mechanicNote: "Hydraulic crusher piston, inward conveyor belts + steam boilers",
    skyTop: "#140E08",
    skyMid: "#292018",
    skyBottom: "#573D26",
    accentColor: "#F59E0B",
    platforms: [
      {
        x: 200,
        baseX: 200,
        y: 545,
        baseY: 545,
        width: 390,
        height: 42,
        passThrough: false,
        style: "conveyor",
        conveyorSpeed: 120,
        destructible: false,
        scars: []
      },
      {
        x: 690,
        baseX: 690,
        y: 545,
        baseY: 545,
        width: 390,
        height: 42,
        passThrough: false,
        style: "conveyor",
        conveyorSpeed: -120,
        destructible: false,
        scars: []
      },
      {
        x: 565,
        baseX: 565,
        y: 455,
        baseY: 455,
        width: 150,
        height: 18,
        passThrough: true,
        style: "conveyor",
        destructible: true,
        hp: 85,
        maxHp: 85,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "vertical",
          ampX: 0,
          ampY: 75,
          speed: 1.45,
          phase: 0
        }
      },
      {
        x: 290,
        baseX: 290,
        y: 340,
        baseY: 340,
        width: 175,
        height: 18,
        passThrough: true,
        style: "conveyor",
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      },
      {
        x: 815,
        baseX: 815,
        y: 340,
        baseY: 340,
        width: 175,
        height: 18,
        passThrough: true,
        style: "conveyor",
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      }
    ],
    obstacles: [
      {
        id: "factory_crusher_piston",
        kind: "crusher_piston",
        x: 640,
        y: 545,
        width: 150,
        height: 58,
        period: 5,
        phase: 0.5
      }
    ],
    destructibles: [
      {
        id: "steam_boiler_left",
        kind: "steam_boiler",
        x: 340,
        y: 545,
        width: 44,
        height: 54,
        maxHp: 45
      },
      {
        id: "steam_boiler_right",
        kind: "steam_boiler",
        x: 940,
        y: 545,
        width: 44,
        height: 54,
        maxHp: 45
      }
    ],
    spawnPoints: [
      { x: 430, y: 545 },
      { x: 850, y: 545 }
    ]
  },
  coral_abyss: {
    id: "coral_abyss",
    name: "Sunken Reef",
    subtitle: "Deep Trench Whirlpool",
    mechanicNote: "Abyssal whirlpool vortex, low-gravity underwater leaps + coral pods",
    skyTop: "#021526",
    skyMid: "#033454",
    skyBottom: "#0891B2",
    accentColor: "#22D3EE",
    gravityScale: 0.72,
    platforms: [
      {
        x: 230,
        baseX: 230,
        y: 550,
        baseY: 550,
        width: 820,
        height: 44,
        passThrough: false,
        style: "reef",
        destructible: false,
        scars: []
      },
      {
        x: 265,
        baseX: 265,
        y: 410,
        baseY: 410,
        width: 175,
        height: 18,
        passThrough: true,
        style: "reef",
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      },
      {
        x: 840,
        baseX: 840,
        y: 410,
        baseY: 410,
        width: 175,
        height: 18,
        passThrough: true,
        style: "reef",
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      },
      {
        x: 550,
        baseX: 550,
        y: 315,
        baseY: 315,
        width: 180,
        height: 18,
        passThrough: true,
        style: "reef",
        destructible: true,
        hp: 85,
        maxHp: 85,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "horizontal",
          ampX: 120,
          ampY: 0,
          speed: 1,
          phase: 0
        }
      }
    ],
    obstacles: [
      {
        id: "abyss_whirlpool",
        kind: "whirlpool_vortex",
        x: 640,
        y: 390,
        width: 110,
        height: 110,
        radius: 44,
        period: 5.6,
        phase: 0.8
      }
    ],
    destructibles: [
      {
        id: "coral_pod_left",
        kind: "coral_pod",
        x: 280,
        y: 550,
        width: 44,
        height: 50,
        maxHp: 45
      },
      {
        id: "coral_pod_right",
        kind: "coral_pod",
        x: 1e3,
        y: 550,
        width: 44,
        height: 50,
        maxHp: 45
      }
    ],
    spawnPoints: [
      { x: 430, y: 550 },
      { x: 850, y: 550 }
    ]
  },
  cosmic_station: {
    id: "cosmic_station",
    name: "Orbital Void",
    subtitle: "Low-G Defense Ring",
    mechanicNote: "Sweeping orbital defense laser, low-G ring + ULT-charging plasma cells",
    skyTop: "#030014",
    skyMid: "#13073A",
    skyBottom: "#311068",
    accentColor: "#C084FC",
    gravityScale: 0.8,
    platforms: [
      {
        x: 195,
        baseX: 195,
        y: 535,
        baseY: 535,
        width: 320,
        height: 42,
        passThrough: false,
        style: "space",
        destructible: false,
        scars: []
      },
      {
        x: 765,
        baseX: 765,
        y: 535,
        baseY: 535,
        width: 320,
        height: 42,
        passThrough: false,
        style: "space",
        destructible: false,
        scars: []
      },
      {
        x: 545,
        baseX: 545,
        y: 475,
        baseY: 475,
        width: 190,
        height: 18,
        passThrough: true,
        style: "space",
        destructible: true,
        hp: 85,
        maxHp: 85,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0
      },
      {
        x: 310,
        baseX: 310,
        y: 330,
        baseY: 330,
        width: 155,
        height: 18,
        passThrough: true,
        style: "space",
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "orbit",
          ampX: 75,
          ampY: 50,
          speed: 1.05,
          phase: 0
        }
      },
      {
        x: 815,
        baseX: 815,
        y: 330,
        baseY: 330,
        width: 155,
        height: 18,
        passThrough: true,
        style: "space",
        destructible: true,
        hp: 75,
        maxHp: 75,
        broken: false,
        respawnTimer: 0,
        shakeTimer: 0,
        motion: {
          kind: "orbit",
          ampX: 75,
          ampY: 50,
          speed: 1.05,
          phase: Math.PI
        }
      }
    ],
    obstacles: [
      {
        id: "orbital_laser_sweeper",
        kind: "laser_sweeper",
        x: 640,
        y: 80,
        width: 14,
        height: 480,
        period: 5.4,
        phase: 0.6
      }
    ],
    destructibles: [
      {
        id: "plasma_cell_left",
        kind: "plasma_cell",
        x: 470,
        y: 535,
        width: 40,
        height: 56,
        maxHp: 45
      },
      {
        id: "plasma_cell_right",
        kind: "plasma_cell",
        x: 810,
        y: 535,
        width: 40,
        height: 56,
        maxHp: 45
      }
    ],
    spawnPoints: [
      { x: 355, y: 535 },
      { x: 925, y: 535 }
    ]
  }
};

// src/game/onlineTypes.ts
var TARGET_SERIES_WINS = 3;
var ONLINE_ROUND_STOCKS = 3;
function computeRankedRpDelta(winnerRp, loserRp) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRp - winnerRp) / 400));
  const rawGain = Math.round(24 + (1 - expectedWinner) * 18);
  const winnerGain = Math.max(16, Math.min(40, rawGain));
  const loserLoss = Math.max(12, Math.min(30, Math.round(winnerGain * 0.78)));
  return { winnerGain, loserLoss };
}
function computeTournamentPointsAward(winnerRounds, loserRounds, reason) {
  const margin = Math.max(1, winnerRounds - loserRounds);
  const dominanceBonus = reason === "forfeit" ? 0 : margin >= 3 ? 20 : margin >= 2 ? 10 : 0;
  const winnerTpGain = 100 + dominanceBonus;
  const loserTpGain = reason === "forfeit" ? 0 : 25;
  return { winnerTpGain, loserTpGain };
}

// src/game/tournamentSchedule.ts
var TOURNAMENT_CYCLE_DAYS = 14;
var TOURNAMENT_ACTIVE_DAYS = 7;
var MS_PER_HOUR = 60 * 60 * 1e3;
var MS_PER_DAY = 24 * MS_PER_HOUR;
var TOURNAMENT_ACTIVE_MS = TOURNAMENT_ACTIVE_DAYS * MS_PER_DAY;
var TOURNAMENT_CYCLE_MS = TOURNAMENT_CYCLE_DAYS * MS_PER_DAY;
var TOURNAMENT_STARTING_SOON_MS = 24 * MS_PER_HOUR;
var TOURNAMENT_ANCHOR_MS = Date.UTC(2026, 10, 23, 0, 0, 0);
var TOURNAMENT_TITLES = [
  "Hive Crown Grand Prix",
  "Storm Citadel Invitational",
  "Magma Foundry Cup",
  "Eclipse Temple Championship",
  "Cyber Skyline Open",
  "Cosmic Station Masters"
];
function getTournamentTitle(cycleNumber) {
  const idx = ((cycleNumber - 1) % TOURNAMENT_TITLES.length + TOURNAMENT_TITLES.length) % TOURNAMENT_TITLES.length;
  return TOURNAMENT_TITLES[idx];
}
function getTournamentCycleId(cycleNumber) {
  return `cycle_${Math.max(1, cycleNumber)}`;
}
function getTournamentScheduleStatus(nowMs = Date.now()) {
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();
  const delta = safeNow - TOURNAMENT_ANCHOR_MS;
  const rawIndex = Math.floor(delta / TOURNAMENT_CYCLE_MS);
  const cycleIndex = Math.max(0, rawIndex);
  const cycleStartMs = TOURNAMENT_ANCHOR_MS + cycleIndex * TOURNAMENT_CYCLE_MS;
  const offsetInCycle = safeNow - cycleStartMs;
  const isActive = offsetInCycle >= 0 && offsetInCycle < TOURNAMENT_ACTIVE_MS;
  const cycleNumber = cycleIndex + 1;
  const cycleId = getTournamentCycleId(cycleNumber);
  const title = getTournamentTitle(cycleNumber);
  const activeWindowStartMs = cycleStartMs;
  const activeWindowEndMs = cycleStartMs + TOURNAMENT_ACTIVE_MS;
  const nextCycleIndex = isActive ? cycleIndex + 1 : delta < 0 ? 0 : cycleIndex + 1;
  const nextCycleNumber = nextCycleIndex + 1;
  const nextTournamentStartMs = TOURNAMENT_ANCHOR_MS + nextCycleIndex * TOURNAMENT_CYCLE_MS;
  const nextTournamentEndMs = nextTournamentStartMs + TOURNAMENT_ACTIVE_MS;
  const msUntilTransition = isActive ? Math.max(0, activeWindowEndMs - safeNow) : Math.max(0, nextTournamentStartMs - safeNow);
  const phaseDuration = isActive ? TOURNAMENT_ACTIVE_MS : TOURNAMENT_CYCLE_MS - TOURNAMENT_ACTIVE_MS;
  const phaseElapsed = isActive ? Math.max(0, offsetInCycle) : Math.max(0, safeNow - activeWindowEndMs);
  const progressPct = Math.max(0, Math.min(100, Math.round(phaseElapsed / phaseDuration * 100)));
  const previousCycleNumber = isActive ? cycleNumber - 1 : cycleNumber;
  const previousCycleId = previousCycleNumber >= 1 ? getTournamentCycleId(previousCycleNumber) : null;
  const previousCycleTitle = previousCycleNumber >= 1 ? getTournamentTitle(previousCycleNumber) : null;
  const upcomingWindows = [];
  const firstVisibleIndex = isActive ? cycleIndex : nextCycleIndex;
  for (let i = 0; i < 4; i++) {
    const idx = firstVisibleIndex + i;
    const num = idx + 1;
    const startMs = TOURNAMENT_ANCHOR_MS + idx * TOURNAMENT_CYCLE_MS;
    const endMs = startMs + TOURNAMENT_ACTIVE_MS;
    upcomingWindows.push({
      cycleNumber: num,
      cycleId: getTournamentCycleId(num),
      title: getTournamentTitle(num),
      startMs,
      endMs,
      status: isActive && idx === cycleIndex ? "live" : "upcoming"
    });
  }
  return {
    nowMs: safeNow,
    cycleNumber,
    cycleId: isActive ? cycleId : getTournamentCycleId(nextCycleNumber),
    title: isActive ? title : getTournamentTitle(nextCycleNumber),
    isActive,
    activeWindowStartMs,
    activeWindowEndMs,
    nextTournamentStartMs,
    nextTournamentEndMs,
    msUntilTransition,
    progressPct,
    previousCycleId,
    previousCycleTitle,
    upcomingWindows
  };
}

// src/game/simulation.ts
function createParticlePool(size = 200) {
  return Array.from({ length: size }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 4,
    color: "#FFFFFF",
    alpha: 1,
    life: 0,
    maxLife: 0.3,
    gravity: 0,
    shape: "circle"
  }));
}
function createMapPlatforms(mapId) {
  return MAP_SPECS[mapId].platforms.map((p) => ({
    ...p,
    prevX: p.x,
    prevY: p.y,
    motion: p.motion ? { ...p.motion } : void 0,
    scars: p.scars ? [...p.scars] : void 0
  }));
}
function createMapObstacles(mapId) {
  return MAP_SPECS[mapId].obstacles.map((o) => ({
    ...o,
    timer: o.phase ?? 0,
    state: "idle",
    currentX: o.x,
    currentY: o.y,
    currentHeight: 0,
    angle: 0,
    hitCooldowns: [0, 0]
  }));
}
function createMapDestructibles(mapId) {
  return MAP_SPECS[mapId].destructibles.map((d) => ({
    ...d,
    hp: d.maxHp,
    broken: false,
    respawnTimer: 0,
    shakeTimer: 0,
    hitFlashTimer: 0,
    hitCooldown: 0
  }));
}
function createFighter(slot, id, isAi, mapId, isDummy = false, startingStocks = STARTING_STOCKS) {
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
    animState: "idle",
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
    aiDesiredAction: "approach"
  };
}
function createInitialEngineState(phase, mode, mapId, p1Id, p2Id, startingStocks = STARTING_STOCKS) {
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
      createFighter(1, p2Id, mode === "1P_AI", mapId, mode === "TRAINING", startingStocks)
    ],
    platforms: createMapPlatforms(mapId),
    obstacles: createMapObstacles(mapId),
    destructibles: createMapDestructibles(mapId),
    projectiles: [],
    zones: [],
    timedActions: [],
    particles: createParticlePool(200),
    slashes: [],
    floatingNumbers: []
  };
}
function buildHudSnapshot(state) {
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
        heavyHitsLanded: state.players[0].heavyHitsLanded
      },
      {
        slot: 1,
        id: state.players[1].id,
        name: state.players[1].isDummy ? "Training Dummy" : FIGHTER_SPECS[state.players[1].id].name,
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
        heavyHitsLanded: state.players[1].heavyHitsLanded
      }
    ]
  };
}
function spawnParticleInState(state, x, y, vx, vy, size, color, maxLife, gravity = 320, shape = "circle") {
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
function isAttackAnim(anim) {
  return anim === "attack1" || anim === "attack2" || anim === "attack3" || anim === "special" || anim === "ultimate" || anim === "recovery";
}
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-4) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function findSurfaceYBelow(state, x, refY) {
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
function getPropAccentColor(kind) {
  switch (kind) {
    case "honey_vat":
      return "#FBBF24";
    case "storm_pylon":
      return "#38BDF8";
    case "magma_crystal":
      return "#FB923C";
    case "windmill_crate":
      return "#2DD4BF";
    case "neon_beacon":
      return "#22D3EE";
    case "frost_crystal":
      return "#7DD3FC";
    case "steam_boiler":
      return "#F59E0B";
    case "coral_pod":
      return "#22D3EE";
    case "plasma_cell":
      return "#C084FC";
    default:
      return "#FAFAFA";
  }
}
function stepPlatforms(state, dt) {
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
          "ring"
        );
      }
    }
    plat.prevX = plat.x;
    plat.prevY = plat.y;
    if (!plat.motion) continue;
    const t = state.matchTime * plat.motion.speed + plat.motion.phase;
    if (plat.motion.kind === "horizontal") {
      plat.x = plat.baseX + Math.sin(t) * plat.motion.ampX;
    } else if (plat.motion.kind === "vertical") {
      plat.y = plat.baseY + Math.sin(t) * plat.motion.ampY;
    } else if (plat.motion.kind === "orbit") {
      plat.x = plat.baseX + Math.cos(t) * plat.motion.ampX;
      plat.y = plat.baseY + Math.sin(t) * plat.motion.ampY;
    }
    const dx = plat.x - (plat.prevX ?? plat.x);
    const dy = plat.y - (plat.prevY ?? plat.y);
    if (!plat.broken && (dx !== 0 || dy !== 0)) {
      for (const f of state.players) {
        if (f.grounded && Math.abs(f.y - (plat.prevY ?? plat.y)) < 6 && f.x + f.width * 0.28 >= (plat.prevX ?? plat.x) && f.x - f.width * 0.28 <= (plat.prevX ?? plat.x) + plat.width) {
          f.x += dx;
          f.y += dy;
        }
      }
    }
  }
  if (state.mapId === "wind_mill_spire") {
    const cycle = state.matchTime % 8;
    if (cycle > 4.2 && cycle < 7.2) {
      const dir = Math.floor(state.matchTime / 8) % 2 === 0 ? 1 : -1;
      state.windForceX = dir * 210;
      for (const f of state.players) {
        if (!f.grounded && f.animState !== "ko") {
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
function stepVisualEffects(state, dt) {
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
function stepVictoryPhase(state, dt) {
  stepPlatforms(state, dt);
  if (state.winnerSlot === null) return;
  const winner = state.players[state.winnerSlot];
  if (winner.animState !== "victory") {
    winner.animState = "victory";
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
        const withinX = winner.x + winner.width * 0.28 >= plat.x && winner.x - winner.width * 0.28 <= plat.x + plat.width;
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
      Math.random() < 0.5 ? accent : "#FBBF24",
      0.6,
      40,
      "spark"
    );
  }
}
function stepCombatFrame(state, controls, dt, options = {}) {
  const sounds = [];
  const startingStocks = options.startingStocks ?? STARTING_STOCKS;
  const inputsUsed = [
    { moveDir: 0, jump: false, down: false, action: null },
    { moveDir: 0, jump: false, down: false, action: null }
  ];
  state.matchTime += dt;
  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    stepVisualEffects(state, dt * 0.25);
    return { sounds, inputsUsed };
  }
  const spawnHoneyPuddle = (x, y, ownerSlot) => {
    state.zones.push({
      id: state.nextEntityId++,
      ownerSlot,
      kind: "honey_puddle",
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
      hitTimers: [0, 0]
    });
    for (let i = 0; i < 10; i++) {
      spawnParticleInState(
        state,
        x + (Math.random() - 0.5) * 60,
        y - 4,
        (Math.random() - 0.5) * 140,
        -60 - Math.random() * 110,
        5,
        i % 2 === 0 ? "#A855F7" : "#FBBF24",
        0.35,
        360,
        "drip"
      );
    }
  };
  const addFloorScar = (plat, worldX) => {
    if (plat.passThrough || !plat.scars) return;
    const offset = Math.max(24, Math.min(plat.width - 24, worldX - plat.x));
    if (plat.scars.some((s) => Math.abs(s - offset) < 20)) return;
    plat.scars.push(offset);
    if (plat.scars.length > 6) {
      plat.scars.shift();
    }
  };
  const damagePlatform = (plat, dmg, impactX, debrisColor) => {
    if (!plat.destructible || plat.broken || plat.hp === void 0 || plat.maxHp === void 0) {
      return;
    }
    plat.hp = Math.max(0, plat.hp - dmg);
    plat.shakeTimer = 0.14;
    if (plat.hp <= 0) {
      plat.broken = true;
      plat.respawnTimer = 8.5;
      sounds.push({ type: "structureBreak" });
      state.shakeIntensity = Math.max(state.shakeIntensity, 8);
      for (const f of state.players) {
        if (f.grounded && Math.abs(f.y - plat.y) < 8 && f.x + f.width * 0.3 >= plat.x && f.x - f.width * 0.3 <= plat.x + plat.width) {
          f.grounded = false;
        }
      }
      const cx = plat.x + plat.width * 0.5;
      const cy = plat.y + plat.height * 0.5;
      spawnParticleInState(state, cx, cy, 0, 0, 48, debrisColor, 0.28, 0, "ring");
      for (let i = 0; i < 16; i++) {
        const px = plat.x + Math.random() * plat.width;
        spawnParticleInState(
          state,
          px,
          cy,
          (Math.random() - 0.5) * 260,
          -90 - Math.random() * 190,
          5 + Math.random() * 4,
          i % 2 === 0 ? debrisColor : "#CBD5E1",
          0.48,
          520,
          "spark"
        );
      }
    } else {
      sounds.push({ type: "crackHit" });
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
          "spark"
        );
      }
    }
  };
  const applyHit = (attacker, defender, damageRaw, kbX, kbY, dir, hitstop, ultGain, hitOpts) => {
    if (defender.invulnTimer > 0 || defender.animState === "ko") return false;
    if (defender.counterTimer > 0 && attacker && !hitOpts?.isHazard) {
      defender.counterTimer = 0;
      defender.invulnTimer = 0.38;
      const behindX = Math.max(90, Math.min(WORLD_WIDTH - 90, attacker.x - attacker.facing * 72));
      defender.x = behindX;
      defender.y = attacker.y;
      defender.facing = behindX <= attacker.x ? 1 : -1;
      sounds.push({ type: "stun" });
      sounds.push({ type: "attack", heavy: true });
      spawnParticleInState(
        state,
        defender.x,
        defender.y - defender.height * 0.5,
        0,
        0,
        48,
        "#EF4444",
        0.26,
        0,
        "ring"
      );
      state.slashes.push({
        x: attacker.x,
        y: attacker.y - attacker.height * 0.5,
        facing: defender.facing,
        color: "#EF4444",
        width: 145,
        height: 92,
        life: 0.25,
        maxLife: 0.25,
        angle: -0.35,
        kind: "iaido_slash"
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
    const spawnFloatingNumber = (x, y, text, color, scale = 1, maxLife = 0.85) => {
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
        maxLife
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
          const continuesCombo = attacker.comboWindowTimer > 0 || defender.hitstunTimer > 0 || defender.stunTimer > 0;
          attacker.currentComboCount = continuesCombo ? attacker.currentComboCount + 1 : 1;
          attacker.currentComboDamage = continuesCombo ? attacker.currentComboDamage + finalDamage : finalDamage;
          attacker.lastComboCount = attacker.currentComboCount;
          attacker.lastComboDamage = attacker.currentComboDamage;
          attacker.comboDisplayTimer = 2.4;
          attacker.comboWindowTimer = 1.45;
          attacker.longestCombo = Math.max(attacker.longestCombo, attacker.currentComboCount);
        }
      }
    }
    defender.ultCharge = Math.min(100, defender.ultCharge + ultGain * 0.45);
    if (state.mode === "TRAINING" && defender.isDummy) {
      spawnFloatingNumber(
        defender.x + (Math.random() - 0.5) * 28,
        defender.y - defender.height * 0.78,
        `${finalDamage}${heavy ? "!" : ""}`,
        heavy ? "#FB923C" : "#FEF08A",
        heavy ? 1.25 : 1,
        0.85
      );
    }
    const missingRatio = 1 - defender.hp / defender.maxHp;
    const knockbackScale = (0.85 + missingRatio * 0.95) / defSpec.weight * (hasShield ? 0.15 : 1);
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
      defender.hitstunTimer = defender.isDummy ? Math.min(0.45, 0.24 + (heavy ? 0.14 : 0)) : Math.min(0.45, 0.18 + missingRatio * 0.22);
      defender.animState = "hitstun";
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
      sounds.push({ type: "crackHit" });
      spawnParticleInState(
        state,
        defender.x,
        defender.y - defender.height * 0.5,
        0,
        0,
        42,
        "#A3E635",
        0.22,
        0,
        "ring"
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
        "HP FULL",
        "#34D399",
        1,
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
      sounds.push({ type: "stun" });
    }
    if (hitOpts?.appliesConfuse && hitOpts.appliesConfuse > 0) {
      defender.confuseTimer = Math.max(defender.confuseTimer, hitOpts.appliesConfuse);
    }
    state.hitstopTimer = Math.max(state.hitstopTimer, hitstop);
    state.shakeIntensity = Math.max(state.shakeIntensity, heavy ? 11 : 5);
    if (hitOpts?.isHazard) {
      sounds.push({ type: "hazardHit" });
    } else {
      sounds.push({ type: "hit", heavy });
    }
    const ringColor = hitOpts?.appliesConfuse ? "#10B981" : hitOpts?.appliesPoison ? "#C084FC" : attSpec ? attSpec.accentColor : "#FB923C";
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
      "ring"
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
        i % 2 === 0 ? ringColor : "#FFFFFF",
        0.32 + Math.random() * 0.15,
        420,
        "spark"
      );
    }
    return true;
  };
  const damageDestructible = (prop, attackerSlot, dmg) => {
    if (prop.broken || prop.hitCooldown > 0) return;
    const accent = getPropAccentColor(prop.kind);
    prop.hp = Math.max(0, prop.hp - dmg);
    prop.shakeTimer = 0.16;
    prop.hitFlashTimer = 0.1;
    prop.hitCooldown = 0.14;
    const cy = prop.y - prop.height * 0.5;
    if (prop.hp <= 0) {
      prop.broken = true;
      prop.respawnTimer = 11;
      sounds.push({ type: "structureBreak" });
      state.shakeIntensity = Math.max(state.shakeIntensity, 10);
      spawnParticleInState(state, prop.x, cy, 0, 0, 56, accent, 0.3, 0, "ring");
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
          i % 2 === 0 ? accent : "#FFFFFF",
          0.46,
          440,
          "spark"
        );
      }
      if (prop.kind === "honey_vat") {
        spawnHoneyPuddle(prop.x, prop.y, attackerSlot ?? 0);
      } else if (prop.kind === "storm_pylon") {
        state.lightningFlash = Math.max(state.lightningFlash, 0.65);
        for (const f of state.players) {
          if (f.animState === "ko") continue;
          const fy = f.y - f.height * 0.5;
          if (Math.hypot(f.x - prop.x, fy - cy) <= 155) {
            const dir = f.x >= prop.x ? 1 : -1;
            applyHit(null, f, 14, 340, -480, dir, 0.045, 6, {
              appliesStun: 0.75,
              isHazard: true
            });
          }
        }
      } else if (prop.kind === "magma_crystal") {
        for (const f of state.players) {
          if (f.animState === "ko") continue;
          const fy = f.y - f.height * 0.5;
          if (Math.hypot(f.x - prop.x, fy - cy) <= 160) {
            const dir = f.x >= prop.x ? 1 : -1;
            applyHit(null, f, 18, 460, -420, dir, 0.05, 8, { isHazard: true });
          }
        }
      } else if (prop.kind === "windmill_crate") {
        sounds.push({ type: "bouncePad" });
        for (const f of state.players) {
          if (f.animState === "ko") continue;
          const fy = f.y - f.height * 0.5;
          if (Math.hypot(f.x - prop.x, fy - cy) <= 150) {
            const dir = f.x >= prop.x ? 1 : -1;
            f.vy = -580;
            f.vx += dir * 240;
            f.grounded = false;
            f.recoveryUsed = false;
            f.squashX = 0.78;
            f.squashY = 1.26;
          }
        }
      } else if (prop.kind === "eclipse_urn") {
        if (attackerSlot !== null) {
          const breaker = state.players[attackerSlot];
          breaker.ultCharge = Math.min(100, breaker.ultCharge + 12);
        }
        for (const f of state.players) {
          if (f.animState === "ko" || f.slot === attackerSlot) continue;
          const fy = f.y - f.height * 0.5;
          if (Math.hypot(f.x - prop.x, fy - cy) <= 145) {
            const dir = f.x >= prop.x ? 1 : -1;
            applyHit(null, f, 12, 300, -320, dir, 0.035, 5, { isHazard: true });
          }
        }
      } else if (prop.kind === "neon_beacon") {
        spawnParticleInState(state, prop.x, cy, 0, 0, 72, "#EC4899", 0.32, 0, "ring");
        for (const f of state.players) {
          if (f.animState === "ko") continue;
          const fy = f.y - f.height * 0.5;
          if (Math.hypot(f.x - prop.x, fy - cy) <= 150) {
            const dir = f.x >= prop.x ? 1 : -1;
            applyHit(null, f, 14, 340, -360, dir, 0.04, 6, {
              appliesStun: 0.5,
              isHazard: true
            });
          }
        }
      } else if (prop.kind === "frost_crystal") {
        spawnParticleInState(state, prop.x, cy, 0, 0, 70, "#7DD3FC", 0.34, 0, "ring");
        for (const f of state.players) {
          if (f.animState === "ko") continue;
          const fy = f.y - f.height * 0.5;
          if (Math.hypot(f.x - prop.x, fy - cy) <= 155) {
            const dir = f.x >= prop.x ? 1 : -1;
            applyHit(null, f, 12, 300, -340, dir, 0.04, 5, {
              appliesSlow: 3.2,
              isHazard: true
            });
          }
        }
      } else if (prop.kind === "steam_boiler") {
        spawnParticleInState(state, prop.x, cy, 0, 0, 76, "#F59E0B", 0.34, 0, "ring");
        for (const f of state.players) {
          if (f.animState === "ko") continue;
          const fy = f.y - f.height * 0.5;
          if (Math.hypot(f.x - prop.x, fy - cy) <= 160) {
            const dir = f.x >= prop.x ? 1 : -1;
            applyHit(null, f, 16, 440, -460, dir, 0.05, 8, { isHazard: true });
          }
        }
      } else if (prop.kind === "coral_pod") {
        const attacker = attackerSlot !== null ? state.players[attackerSlot] : null;
        spawnParticleInState(state, prop.x, cy, 0, 0, 68, "#22D3EE", 0.34, 0, "ring");
        for (const f of state.players) {
          if (f.animState === "ko" || f.slot === attackerSlot) continue;
          const fy = f.y - f.height * 0.5;
          if (Math.hypot(f.x - prop.x, fy - cy) <= 150) {
            const dir = f.x >= prop.x ? 1 : -1;
            applyHit(attacker, f, 10, 260, -280, dir, 0.03, 4, {
              appliesSlow: 2.6,
              appliesPoison: 2.5,
              isHazard: true
            });
          }
        }
      } else if (prop.kind === "plasma_cell") {
        if (attackerSlot !== null) {
          const breaker = state.players[attackerSlot];
          breaker.ultCharge = Math.min(100, breaker.ultCharge + 15);
        }
        spawnParticleInState(state, prop.x, cy, 0, 0, 74, "#C084FC", 0.34, 0, "ring");
        for (const f of state.players) {
          if (f.animState === "ko" || f.slot === attackerSlot) continue;
          const fy = f.y - f.height * 0.5;
          if (Math.hypot(f.x - prop.x, fy - cy) <= 150) {
            const dir = f.x >= prop.x ? 1 : -1;
            applyHit(null, f, 14, 360, -360, dir, 0.04, 6, { isHazard: true });
          }
        }
      }
    } else {
      sounds.push({ type: "crackHit" });
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
          "spark"
        );
      }
    }
  };
  const triggerMove = (f, moveKey, aimDir = 0) => {
    const spec = FIGHTER_SPECS[f.id];
    const move = spec.moves[moveKey];
    if (moveKey === "special" && f.specialCooldown > 0) return;
    if (moveKey === "ultimate" && f.ultCharge < 100) return;
    if (moveKey === "recovery" && f.recoveryUsed) return;
    f.animState = moveKey;
    f.animTimer = 0;
    f.animDuration = move.duration;
    f.hasHitCurrentMove = false;
    if (moveKey === "recovery") {
      f.recoveryUsed = true;
      f.grounded = false;
      sounds.push({ type: "recovery" });
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
    } else if (moveKey === "special") {
      f.specialCooldown = f.id === "eve" ? 1.05 : f.id === "moss_golem" ? 1.15 : f.id === "blade_zero" ? 1.1 : 0.95;
      if (f.id === "blade_zero") {
        f.counterTimer = 0.52;
        sounds.push({ type: "stun" });
      } else if (f.id === "moss_golem") {
        f.shieldTimer = 1.25;
        sounds.push({ type: "cloudWall" });
      } else if (f.id === "cloudier") {
        sounds.push({ type: "cloudWall" });
      } else if (f.id === "eve") {
        sounds.push({ type: "chargeTelegraph" });
      } else if (f.id === "spidra") {
        sounds.push({ type: "tvBlare" });
      } else if (f.id === "marshal_bolt" || f.id === "astro_pip") {
        sounds.push({ type: "laserShot" });
      } else if (f.id === "pyro_jack") {
        sounds.push({ type: "special", isProj: false });
      } else {
        sounds.push({ type: "special", isProj: true });
      }
    } else if (moveKey === "ultimate") {
      f.ultCharge = 0;
      f.invulnTimer = Math.max(f.invulnTimer, 0.5);
      state.shakeIntensity = 12;
      if (f.id === "honey_shell") {
        f.hp = Math.min(f.maxHp, f.hp + 45);
        spawnParticleInState(
          state,
          f.x,
          f.y - f.height * 0.5,
          0,
          0,
          48,
          "#22C55E",
          0.36,
          0,
          "ring"
        );
        for (let h = 0; h < 12; h++) {
          spawnParticleInState(
            state,
            f.x + (Math.random() - 0.5) * 44,
            f.y - 10 - Math.random() * 60,
            (Math.random() - 0.5) * 60,
            -80 - Math.random() * 90,
            5,
            h % 2 === 0 ? "#4ADE80" : "#FDE047",
            0.48,
            -40,
            "spark"
          );
        }
      } else if (f.id === "astro_pip") {
        f.speedBoostTimer = 3;
        state.lightningFlash = 0.7;
      } else if (f.id === "cloudier") {
        state.lightningFlash = 1;
      }
      sounds.push({ type: "ultimate" });
    } else {
      sounds.push({ type: "attack", heavy: moveKey === "attack3" });
    }
    if (moveKey !== "recovery") {
      if (move.selfVx) {
        f.vx = f.facing * move.selfVx;
      }
      if (move.selfVy) {
        f.vy = move.selfVy;
        f.grounded = false;
      }
    }
    if (moveKey === "attack2" || moveKey === "recovery") {
      f.squashX = 0.84;
      f.squashY = 1.22;
    } else if (moveKey === "attack3" || moveKey === "ultimate") {
      f.squashX = 1.2;
      f.squashY = 0.84;
    } else {
      f.squashX = 1.12;
      f.squashY = 0.9;
    }
  };
  const triggerTaunt = (f) => {
    if (f.tauntCooldown > 0) return;
    f.animState = "taunt";
    f.animTimer = 0;
    f.animDuration = 0.58;
    f.tauntCooldown = 2.8;
    f.vx *= 0.25;
    f.squashX = 1.12;
    f.squashY = 0.88;
    sounds.push({ type: "taunt", fighterId: f.id });
  };
  const spawnMoveEffects = (f, moveKey) => {
    const spec = FIGHTER_SPECS[f.id];
    const move = spec.moves[moveKey];
    if (moveKey === "special" && (f.id === "honey_shell" || f.id === "cloudier" || f.id === "marshal_bolt" || f.id === "pyro_jack" || f.id === "aqua_nyx" || f.id === "blade_zero" || f.id === "astro_pip")) {
      if (f.id === "honey_shell") {
        const opp = state.players[f.slot === 0 ? 1 : 0];
        const dx = opp.x - f.x;
        const closeDrop = Math.abs(dx) < 160 && Math.sign(dx) === f.facing;
        state.projectiles.push({
          id: state.nextEntityId++,
          ownerSlot: f.slot,
          fighterId: f.id,
          kind: "venom_honey_drop",
          x: f.x + f.facing * 24,
          y: f.y - 82,
          vx: closeDrop ? dx * 1.65 : f.facing * 310,
          vy: closeDrop ? -340 : -370,
          radius: 15,
          damage: move.baseDamage,
          knockbackX: move.knockbackX,
          knockbackY: move.knockbackY,
          gravity: 980,
          life: 2,
          maxLife: 2,
          appliesPoison: move.appliesPoison ?? 4.5,
          appliesSlow: move.appliesSlow ?? 2.4,
          spawnsPuddleOnLand: true,
          rotation: 0
        });
      } else if (f.id === "marshal_bolt") {
        state.projectiles.push({
          id: state.nextEntityId++,
          ownerSlot: f.slot,
          fighterId: f.id,
          kind: "cuff_bolt",
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
          rotation: 0
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
          kind: "deadeye_shot"
        });
      } else if (f.id === "pyro_jack") {
        state.projectiles.push({
          id: state.nextEntityId++,
          ownerSlot: f.slot,
          fighterId: f.id,
          kind: "ember_bomb",
          x: f.x + f.facing * 28,
          y: f.y - 68,
          vx: f.facing * 430,
          vy: -410,
          radius: 16,
          damage: move.baseDamage,
          knockbackX: move.knockbackX,
          knockbackY: move.knockbackY,
          gravity: 980,
          life: 2,
          maxLife: 2,
          appliesPoison: 0,
          appliesSlow: 0,
          explodeRadius: 115,
          spawnsPuddleOnLand: false,
          rotation: 0
        });
      } else if (f.id === "aqua_nyx") {
        state.projectiles.push({
          id: state.nextEntityId++,
          ownerSlot: f.slot,
          fighterId: f.id,
          kind: "bubble_orb",
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
          rotation: 0
        });
      } else if (f.id === "blade_zero") {
        spawnParticleInState(
          state,
          f.x,
          f.y - f.height * 0.5,
          0,
          0,
          44,
          "#EF4444",
          0.25,
          0,
          "ring"
        );
      } else if (f.id === "astro_pip") {
        state.projectiles.push({
          id: state.nextEntityId++,
          ownerSlot: f.slot,
          fighterId: f.id,
          kind: "nova_star",
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
          rotation: 0
        });
      } else {
        const wallX = f.x + f.facing * move.offsetX;
        const surfaceY = findSurfaceYBelow(state, wallX, f.y);
        state.zones.push({
          id: state.nextEntityId++,
          ownerSlot: f.slot,
          kind: "cloud_wall",
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
          hitTimers: [0, 0]
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
            i % 2 === 0 ? "#E0F2FE" : "#38BDF8",
            0.38,
            200
          );
        }
      }
      return;
    }
    if (moveKey === "special" && f.id === "eve") {
      sounds.push({ type: "attack", heavy: true });
      state.shakeIntensity = Math.max(state.shakeIntensity, 9);
    } else if (moveKey === "special" && f.id === "moss_golem") {
      sounds.push({ type: "structureBreak" });
      state.shakeIntensity = Math.max(state.shakeIntensity, 7);
      spawnParticleInState(
        state,
        f.x,
        f.y - f.height * 0.5,
        0,
        0,
        56,
        "#A3E635",
        0.3,
        0,
        "ring"
      );
    } else if (moveKey === "special" && f.id === "spidra") {
      for (let i = 0; i < 10; i++) {
        spawnParticleInState(
          state,
          f.x + f.facing * (34 + Math.random() * 50),
          f.y - 46 + (Math.random() - 0.5) * 44,
          f.facing * (120 + Math.random() * 140),
          (Math.random() - 0.5) * 140,
          4 + Math.random() * 3,
          i % 2 === 0 ? "#10B981" : "#F43F5E",
          0.28,
          0,
          "spark"
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
      life: moveKey === "ultimate" ? 0.38 : moveKey === "special" ? 0.28 : 0.2,
      maxLife: moveKey === "ultimate" ? 0.38 : moveKey === "special" ? 0.28 : 0.2,
      kind: move.slashKind
    });
    if (moveKey === "ultimate") {
      const opp = state.players[f.slot === 0 ? 1 : 0];
      if (f.id === "honey_shell") {
        const delays = [0.06, 0.14, 0.22, 0.3, 0.38];
        const vels = [
          { vx: -360, vy: -260 },
          { vx: 360, vy: -260 },
          { vx: -460, vy: -120 },
          { vx: 460, vy: -120 },
          { vx: f.facing * 420, vy: -320 }
        ];
        delays.forEach((delay, idx) => {
          state.timedActions.push({
            timer: delay,
            ownerSlot: f.slot,
            kind: "hornet_stinger",
            x: f.x + (idx % 2 === 0 ? -24 : 24),
            y: f.y - 68,
            vx: vels[idx].vx,
            vy: vels[idx].vy
          });
        });
      } else if (f.id === "cloudier") {
        const offsets = [-190, 0, 190];
        for (const ox of offsets) {
          const px = Math.max(140, Math.min(WORLD_WIDTH - 140, f.x + ox));
          const surfaceY = findSurfaceYBelow(state, px, f.y);
          state.zones.push({
            id: state.nextEntityId++,
            ownerSlot: f.slot,
            kind: "lightning_pillar",
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
            hitTimers: [0, 0]
          });
          for (const plat of state.platforms) {
            if (!plat.broken && px >= plat.x && px <= plat.x + plat.width) {
              if (plat.destructible) {
                damagePlatform(plat, 42, px, "#38BDF8");
              } else {
                addFloorScar(plat, px);
              }
            }
          }
        }
      } else if (f.id === "eve") {
        const blinkDir = opp.x >= f.x ? 1 : -1;
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
            kind: "eve_cross_cut",
            x: opp.x,
            y: opp.y - opp.height * 0.5,
            angle: angles[idx],
            facing: blinkDir
          });
        });
      } else if (f.id === "spidra") {
        const surfaceY = findSurfaceYBelow(state, f.x, f.y);
        state.zones.push({
          id: state.nextEntityId++,
          ownerSlot: f.slot,
          kind: "glitch_field",
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
          appliesSlow: 2,
          appliesConfuse: 4.5,
          blocksProjectiles: false,
          hitTimers: [0, 0]
        });
        for (const dirVx of [-560, 560]) {
          state.projectiles.push({
            id: state.nextEntityId++,
            ownerSlot: f.slot,
            fighterId: f.id,
            kind: "static_orb",
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
            rotation: 0
          });
        }
      } else if (f.id === "marshal_bolt") {
        const muzzleX = f.x + f.facing * 26;
        const muzzleY = f.y - 54;
        const aimAngle = Math.atan2(opp.y - opp.height * 0.5 - muzzleY, opp.x - muzzleX);
        state.zones.push({
          id: state.nextEntityId++,
          ownerSlot: f.slot,
          kind: "railgun_beam",
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
          hitTimers: [0, 0]
        });
      } else if (f.id === "pyro_jack") {
        const eruptions = [
          { vx: -170, vy: -640 },
          { vx: 170, vy: -640 },
          { vx: -340, vy: -580 },
          { vx: 340, vy: -580 },
          { vx: -510, vy: -500 },
          { vx: 510, vy: -500 }
        ];
        eruptions.forEach((er, idx) => {
          state.timedActions.push({
            timer: 0.08 + idx * 0.08,
            ownerSlot: f.slot,
            kind: "volcano_bomb",
            x: f.x,
            y: f.y - 68,
            vx: er.vx,
            vy: er.vy
          });
        });
      } else if (f.id === "aqua_nyx") {
        const cx = Math.max(180, Math.min(WORLD_WIDTH - 180, f.x + f.facing * 60));
        const surfaceY = findSurfaceYBelow(state, cx, f.y);
        state.zones.push({
          id: state.nextEntityId++,
          ownerSlot: f.slot,
          kind: "whirlpool_zone",
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
          hitTimers: [0, 0]
        });
      } else if (f.id === "blade_zero") {
        const sliceAngles = [-0.55, 0.65, -0.25, 0.85, 0];
        sliceAngles.forEach((ang, idx) => {
          state.timedActions.push({
            timer: 0.08 + idx * 0.09,
            ownerSlot: f.slot,
            kind: "katana_slice",
            x: f.x,
            y: f.y - 48,
            angle: ang,
            facing: idx % 2 === 0 ? 1 : -1
          });
        });
      } else if (f.id === "moss_golem") {
        const targetXs = [
          Math.max(160, Math.min(WORLD_WIDTH - 160, opp.x - 160)),
          Math.max(160, Math.min(WORLD_WIDTH - 160, opp.x + 160)),
          Math.max(160, Math.min(WORLD_WIDTH - 160, opp.x)),
          Math.max(220, Math.min(WORLD_WIDTH - 220, f.x - 120)),
          Math.max(220, Math.min(WORLD_WIDTH - 220, f.x + 120))
        ];
        targetXs.forEach((tx, idx) => {
          state.timedActions.push({
            timer: 0.1 + idx * 0.12,
            ownerSlot: f.slot,
            kind: "sky_boulder",
            x: tx,
            y: -50
          });
        });
      } else {
        for (let k = 0; k < 8; k++) {
          const spawnX = 160 + (k * 145 + (opp.x - 500) * 0.35 + WORLD_WIDTH) % (WORLD_WIDTH - 320);
          const dirVx = k % 2 === 0 ? 170 : -170;
          state.timedActions.push({
            timer: 0.08 + k * 0.17,
            ownerSlot: f.slot,
            kind: "orbital_star",
            x: spawnX,
            y: -40,
            vx: dirVx,
            vy: 560
          });
        }
      }
      const count = 24;
      for (let i = 0; i < count; i++) {
        const ang = Math.PI * 2 * i / count;
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
          "spark"
        );
      }
    }
  };
  const handleStockLoss = (loser, winner) => {
    if (state.phase !== "PLAYING") return;
    if (state.mode === "TRAINING") {
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
        loser.animState = "idle";
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
      loser.invulnTimer = 1;
      loser.animState = "fall";
      return;
    }
    loser.stocks = Math.max(0, loser.stocks - 1);
    winner.koCount += 1;
    state.shakeIntensity = 16;
    sounds.push({ type: "ko" });
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
        "spark"
      );
    }
    if (loser.stocks <= 0) {
      loser.animState = "ko";
      loser.animTimer = 0;
      loser.animDuration = 0;
      winner.animState = "victory";
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
        const ang = Math.PI * 2 * i / 18;
        const spd = 120 + Math.random() * 160;
        spawnParticleInState(
          state,
          winner.x,
          winner.y - winner.height * 0.5,
          Math.cos(ang) * spd,
          Math.sin(ang) * spd - 90,
          5 + Math.random() * 4,
          i % 2 === 0 ? winAccent : "#FBBF24",
          0.55,
          180,
          "spark"
        );
      }
      state.phase = "GAME_OVER";
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
      loser.animState = "fall";
      loser.animTimer = 0;
      loser.animDuration = 0;
    }
  };
  const stepFighter = (f, opponent, ctrl) => {
    const spec = FIGHTER_SPECS[f.id];
    const plats2 = state.platforms;
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
        if (state.mode === "TRAINING" && opponent.isDummy && (opponent.hp < opponent.maxHp || opponent.poisonTimer > 0 || opponent.stunTimer > 0 || opponent.slowTimer > 0 || opponent.confuseTimer > 0)) {
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
            "#34D399",
            0.28,
            0,
            "ring"
          );
          state.floatingNumbers.push({
            id: state.nextEntityId++,
            x: opponent.x,
            y: opponent.y - opponent.height - 18,
            vx: 0,
            vy: -60,
            text: "HP RESET",
            color: "#34D399",
            scale: 0.95,
            life: 0.75,
            maxLife: 0.75
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
        if (state.mode === "TRAINING" && f.isDummy) {
          state.floatingNumbers.push({
            id: state.nextEntityId++,
            x: f.x + (Math.random() - 0.5) * 20,
            y: f.y - f.height * 0.72,
            vx: (Math.random() - 0.5) * 20,
            vy: -70,
            text: `${poisonDmg}`,
            color: "#C084FC",
            scale: 0.85,
            life: 0.65,
            maxLife: 0.65
          });
        }
        sounds.push({ type: "poisonTick" });
        for (let i = 0; i < 4; i++) {
          spawnParticleInState(
            state,
            f.x + (Math.random() - 0.5) * 34,
            f.y - Math.random() * f.height,
            (Math.random() - 0.5) * 40,
            -55 - Math.random() * 45,
            4.5,
            i % 2 === 0 ? "#A855F7" : "#FBBF24",
            0.38,
            -30,
            "drip"
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
          f.animState = f.stunTimer > 0 ? "stunned" : "idle";
        }
      } else if (f.stunTimer > 0) {
        f.stunTimer = Math.max(0, f.stunTimer - dt);
        f.animState = "stunned";
        f.animTimer += dt;
        if (f.stunTimer === 0) {
          f.animState = "idle";
        }
      } else {
        f.animState = "idle";
        f.animTimer += dt;
      }
      f.vx = 0;
      f.x = f.dummyAnchorX;
      const gravScale2 = MAP_SPECS[state.mapId].gravityScale ?? 1;
      f.vy = Math.min(MAX_FALL_SPEED * gravScale2, f.vy + GRAVITY * gravScale2 * dt);
      const prevDummyY = f.y;
      f.y += f.vy * dt;
      let dummyLanded = false;
      if (f.vy >= 0) {
        for (const plat of plats2) {
          if (plat.broken) continue;
          const withinX = f.x + f.width * 0.28 >= plat.x && f.x - f.width * 0.28 <= plat.x + plat.width;
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
    const recordedAction = directMove ? directMove : tauntPressed ? "taunt" : attackComboPressed ? "combo" : null;
    inputsUsed[f.slot] = {
      moveDir,
      jump: jumpPressed,
      down: downHeld,
      action: recordedAction
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
        f.animState = f.stunTimer > 0 ? "stunned" : f.grounded ? "idle" : "fall";
      }
    } else if (f.stunTimer > 0) {
      f.stunTimer = Math.max(0, f.stunTimer - dt);
      f.animState = "stunned";
      f.animTimer += dt;
      if (f.grounded) {
        if (f.vx > 0) f.vx = Math.max(0, f.vx - GROUND_FRICTION * 0.7 * dt);
        else if (f.vx < 0) f.vx = Math.min(0, f.vx + GROUND_FRICTION * 0.7 * dt);
      }
      if (f.stunTimer === 0) {
        f.animState = f.grounded ? "idle" : "fall";
      }
    } else {
      if (isAttackAnim(f.animState)) {
        const moveKey = f.animState;
        const move = spec.moves[moveKey];
        const prevTime = f.animTimer;
        f.animTimer += dt;
        if (moveKey === "recovery" && moveDir !== 0) {
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
            const isHeavy = moveKey === "attack3" || moveKey === "special" || moveKey === "ultimate";
            const structDmg = moveKey === "ultimate" ? 48 : moveKey === "special" ? 38 : moveKey === "attack3" ? 30 : 16;
            for (const prop of state.destructibles) {
              if (prop.broken) continue;
              const propCy = prop.y - prop.height * 0.5;
              if (Math.abs(boxCx - prop.x) <= halfW + prop.width * 0.5 && Math.abs(boxCy - propCy) <= halfH + prop.height * 0.5) {
                damageDestructible(prop, f.slot, structDmg);
              }
            }
            for (const plat of state.platforms) {
              if (plat.broken) continue;
              const platCx = plat.x + plat.width * 0.5;
              const platCy = plat.y + plat.height * 0.5;
              if (Math.abs(boxCx - platCx) <= halfW + plat.width * 0.5 && Math.abs(boxCy - platCy) <= halfH + plat.height * 0.5 + 10) {
                if (plat.destructible) {
                  damagePlatform(plat, structDmg, boxCx, spec.accentColor);
                } else if (isHeavy) {
                  addFloorScar(plat, boxCx);
                }
              }
            }
          }
        }
        if (!move.isProjectile && !f.hasHitCurrentMove && f.animTimer >= move.activeStart && f.animTimer <= move.activeEnd) {
          const boxCx = f.x + (move.isAreaAround ? 0 : f.facing * move.offsetX);
          const boxCy = f.y + move.offsetY;
          const halfW = move.rangeX * 0.5;
          const halfH = move.rangeY * 0.5;
          const oppCx = opponent.x;
          const oppCy = opponent.y - opponent.height * 0.5;
          const oppHalfW = opponent.width * 0.45;
          const oppHalfH = opponent.height * 0.5;
          const overlaps = Math.abs(boxCx - oppCx) <= halfW + oppHalfW && Math.abs(boxCy - oppCy) <= halfH + oppHalfH;
          if (overlaps) {
            const hitDir = move.isAreaAround ? opponent.x >= f.x ? 1 : -1 : f.facing;
            const landed2 = applyHit(
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
                appliesConfuse: move.appliesConfuse
              }
            );
            if (landed2) f.hasHitCurrentMove = true;
          }
        }
        if (f.animTimer >= f.animDuration) {
          f.animState = f.grounded ? "idle" : "fall";
          f.animTimer = 0;
          f.animDuration = 0;
        }
      } else if (f.animState === "taunt") {
        const prevTime = f.animTimer;
        f.animTimer += dt;
        const drag = f.grounded ? GROUND_FRICTION : AIR_DRAG;
        if (f.vx > 0) f.vx = Math.max(0, f.vx - drag * dt);
        else if (f.vx < 0) f.vx = Math.min(0, f.vx + drag * dt);
        if (prevTime < 0.2 && f.animTimer >= 0.2) {
          f.ultCharge = Math.min(100, f.ultCharge + 9);
          sounds.push({ type: "tauntBoost" });
          spawnParticleInState(
            state,
            f.x,
            f.y - f.height * 0.5,
            0,
            0,
            26,
            "#FBBF24",
            0.28,
            0,
            "ring"
          );
          for (let i = 0; i < 8; i++) {
            const ang = Math.PI * 2 * i / 8;
            spawnParticleInState(
              state,
              f.x + Math.cos(ang) * 18,
              f.y - f.height * 0.5 + Math.sin(ang) * 14,
              Math.cos(ang) * 70,
              -90 - Math.random() * 80,
              4,
              i % 2 === 0 ? "#FBBF24" : spec.accentColor,
              0.42,
              60,
              "spark"
            );
          }
        }
        if (f.animTimer >= f.animDuration) {
          f.animState = f.grounded ? "idle" : "fall";
          f.animTimer = 0;
          f.animDuration = 0;
        }
      } else {
        const standingPlat = f.grounded ? plats2.find(
          (p) => !p.broken && Math.abs(f.y - p.y) < 6 && f.x + f.width * 0.28 >= p.x && f.x - f.width * 0.28 <= p.x + p.width
        ) : void 0;
        if (standingPlat?.conveyorSpeed) {
          f.x += standingPlat.conveyorSpeed * dt;
        }
        const onIce = Boolean(standingPlat?.icy);
        const speedMult = (f.slowTimer > 0 ? 0.58 : 1) * (f.speedBoostTimer > 0 ? 1.45 : 1);
        const targetVx = moveDir * spec.moveSpeed * speedMult;
        if (moveDir !== 0) {
          f.facing = moveDir > 0 ? 1 : -1;
          const accel = f.grounded ? onIce ? 1250 : 2900 : 1850;
          if (f.vx < targetVx) f.vx = Math.min(targetVx, f.vx + accel * dt);
          else if (f.vx > targetVx) f.vx = Math.max(targetVx, f.vx - accel * dt);
        } else {
          const drag = f.grounded ? onIce ? GROUND_FRICTION * 0.22 : GROUND_FRICTION : AIR_DRAG;
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
            sounds.push({ type: "jump", double: isDouble });
            for (let i = 0; i < 5; i++) {
              spawnParticleInState(
                state,
                f.x + (Math.random() - 0.5) * 32,
                f.y,
                (Math.random() - 0.5) * 90,
                20 + Math.random() * 40,
                4,
                "#E2E8F0",
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
          const comboMoves = ["attack1", "attack2", "attack3"];
          const nextMove = comboMoves[f.comboStep];
          triggerMove(f, nextMove, moveDir);
          f.comboStep = (f.comboStep + 1) % 3;
          f.comboResetTimer = 0.85;
        } else {
          if (!f.grounded) {
            f.animState = f.vy < 0 ? "jump" : "fall";
          } else if (Math.abs(moveDir) > 0.1 || Math.abs(f.vx) > 35) {
            f.animState = "run";
          } else {
            f.animState = "idle";
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
      for (const plat of plats2) {
        if (plat.broken) continue;
        if (plat.passThrough && f.dropThroughTimer > 0) continue;
        const withinX = f.x + f.width * 0.28 >= plat.x && f.x - f.width * 0.28 <= plat.x + plat.width;
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
            spawnParticleInState(state, f.x, plat.y, 0, 0, 28, "#CBD5E1", 0.24, 0, "ring");
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
    const outOfBounds = f.x < BLAST_ZONE.left || f.x > BLAST_ZONE.right || f.y < BLAST_ZONE.top || f.y > BLAST_ZONE.bottom;
    if (f.hp <= 0 || outOfBounds) {
      handleStockLoss(f, opponent);
    }
  };
  const detonateExplosion = (x, y, ownerSlot, radius, damage, kbX, kbY, color, alreadyHitTarget) => {
    const attacker = state.players[ownerSlot];
    const target = state.players[ownerSlot === 0 ? 1 : 0];
    sounds.push({ type: "structureBreak" });
    state.shakeIntensity = Math.max(state.shakeIntensity, 8);
    spawnParticleInState(state, x, y, 0, 0, radius * 0.72, color, 0.28, 0, "ring");
    for (let k = 0; k < 14; k++) {
      const ang = Math.PI * 2 * k / 14;
      const spd = 140 + Math.random() * 210;
      spawnParticleInState(
        state,
        x,
        y,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd - 60,
        5.5,
        k % 2 === 0 ? color : "#FEF08A",
        0.36,
        260,
        "spark"
      );
    }
    if (!alreadyHitTarget && target.animState !== "ko") {
      const targetCy = target.y - target.height * 0.5;
      if (Math.hypot(target.x - x, targetCy - y) <= radius + target.width * 0.35) {
        const dir = target.x >= x ? 1 : -1;
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
          "ring"
        );
      }
    }
  }
  stepFighter(state.players[0], state.players[1], controls[0]);
  if (state.phase === "PLAYING") {
    stepFighter(state.players[1], state.players[0], controls[1]);
  }
  for (let i = state.timedActions.length - 1; i >= 0; i--) {
    const ta = state.timedActions[i];
    ta.timer -= dt;
    if (ta.timer > 0) continue;
    const caster = state.players[ta.ownerSlot];
    const opp = state.players[ta.ownerSlot === 0 ? 1 : 0];
    if (ta.kind === "hornet_stinger") {
      state.projectiles.push({
        id: state.nextEntityId++,
        ownerSlot: ta.ownerSlot,
        fighterId: caster.id,
        kind: "hornet_bolt",
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
        appliesPoison: 3,
        appliesSlow: 1.8,
        homing: true,
        spawnsPuddleOnLand: false,
        rotation: Math.atan2(ta.vy ?? -180, ta.vx ?? 420)
      });
      sounds.push({ type: "laserShot" });
    } else if (ta.kind === "katana_slice") {
      const side = ta.facing ?? 1;
      const oppCy = opp.y - opp.height * 0.5;
      caster.x = Math.max(90, Math.min(WORLD_WIDTH - 90, opp.x - side * 56));
      caster.y = opp.y;
      caster.facing = caster.x <= opp.x ? 1 : -1;
      caster.vx = 0;
      caster.vy = 0;
      sounds.push({ type: "attack", heavy: true });
      state.slashes.push({
        x: opp.x,
        y: oppCy,
        facing: caster.facing,
        color: "#EF4444",
        width: 175,
        height: 90,
        life: 0.24,
        maxLife: 0.24,
        angle: ta.angle ?? 0,
        kind: "iaido_slash"
      });
      if (opp.animState !== "ko" && Math.hypot(opp.x - caster.x, opp.y - caster.y) < 160) {
        applyHit(caster, opp, 14, 190, -210, caster.facing, 0.04, 0);
      }
    } else if (ta.kind === "sky_boulder") {
      state.projectiles.push({
        id: state.nextEntityId++,
        ownerSlot: ta.ownerSlot,
        fighterId: caster.id,
        kind: "boulder_rock",
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
        rotation: 0
      });
    } else if (ta.kind === "volcano_bomb") {
      sounds.push({ type: "special", isProj: false });
      state.projectiles.push({
        id: state.nextEntityId++,
        ownerSlot: ta.ownerSlot,
        fighterId: caster.id,
        kind: "ember_bomb",
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
        rotation: 0
      });
    } else if (ta.kind === "orbital_star") {
      sounds.push({ type: "laserShot" });
      state.projectiles.push({
        id: state.nextEntityId++,
        ownerSlot: ta.ownerSlot,
        fighterId: caster.id,
        kind: "nova_star",
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
        rotation: 0
      });
    } else if (ta.kind === "eve_cross_cut") {
      sounds.push({ type: "attack", heavy: true });
      const cx = opp.x;
      const cy = opp.y - opp.height * 0.5;
      state.zones.push({
        id: state.nextEntityId++,
        ownerSlot: ta.ownerSlot,
        kind: "cross_slash",
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
        hitTimers: [0, 0]
      });
      state.slashes.push({
        x: cx,
        y: cy,
        facing: ta.facing ?? 1,
        color: "#FAFAFA",
        width: 240,
        height: 120,
        life: 0.28,
        maxLife: 0.28,
        angle: ta.angle ?? 0,
        kind: "cross_crescent"
      });
    }
    state.timedActions.splice(i, 1);
  }
  const plats = state.platforms;
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    const prevY = p.y;
    p.life -= dt;
    const target = state.players[p.ownerSlot === 0 ? 1 : 0];
    const attacker = state.players[p.ownerSlot];
    const targetCy = target.y - target.height * 0.5;
    if (p.homing && target.animState !== "ko") {
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
          if (p.x >= plat.x && p.x <= plat.x + plat.width && prevY <= plat.y + 8 && p.y >= plat.y) {
            p.y = plat.y - 2;
            p.vy = -Math.abs(p.vy);
            bounced = true;
            break;
          }
        }
      }
      if (bounced) {
        p.bouncesLeft -= 1;
        sounds.push({ type: "bouncePad" });
        spawnParticleInState(state, p.x, p.y, 0, 0, 26, "#FDE047", 0.22, 0, "ring");
      }
    }
    if (p.kind === "venom_honey_drop" || p.kind === "ember_bomb" || p.kind === "shuriken_star" || p.kind === "boulder_rock" || p.kind === "nova_star") {
      p.rotation += dt * (p.kind === "shuriken_star" || p.kind === "nova_star" ? 14 : 7);
    }
    let blockedByWall = false;
    for (const z of state.zones) {
      if (z.blocksProjectiles && z.ownerSlot !== p.ownerSlot) {
        if (Math.abs(p.x - z.x) <= z.width * 0.5 + p.radius && p.y >= z.y - z.height && p.y <= z.y) {
          blockedByWall = true;
          spawnParticleInState(state, p.x, p.y, -p.vx * 0.2, -120, 12, "#E0F2FE", 0.22, 0, "ring");
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
        sounds.push({ type: "bouncePad" });
        spawnParticleInState(state, p.x, p.y, 0, 0, 34, "#A3E635", 0.25, 0, "ring");
        continue;
      }
      if (target.counterTimer > 0) {
        target.counterTimer = 0;
        target.invulnTimer = 0.35;
        sounds.push({ type: "stun" });
        spawnParticleInState(state, target.x, targetCy, 0, 0, 42, "#EF4444", 0.25, 0, "ring");
        if (attacker.animState !== "ko" && Math.hypot(attacker.x - target.x, attacker.y - target.y) < 580) {
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
            color: "#EF4444",
            width: 145,
            height: 92,
            life: 0.24,
            maxLife: 0.24,
            angle: -0.35,
            kind: "iaido_slash"
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
          appliesStun: p.appliesStun
        }
      );
      if (hit) {
        if (p.pullOnHit && !target.isDummy) {
          const pullDir = attacker.x >= target.x ? 1 : -1;
          target.vx = pullDir * 520;
          target.vy = -210;
          spawnParticleInState(state, target.x, targetCy, 0, 0, 30, "#38BDF8", 0.22, 0, "ring");
        }
        if (p.floatTrap && !target.isDummy) {
          target.vx *= 0.25;
          target.vy = -490;
          spawnParticleInState(state, target.x, targetCy, 0, 0, 38, "#06B6D4", 0.3, 0, "ring");
        }
        if (p.explodeRadius) {
          const expColor = p.kind === "ember_bomb" ? "#F97316" : p.kind === "boulder_rock" ? "#22C55E" : "#A855F7";
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
      if (Math.abs(p.x - prop.x) <= prop.width * 0.5 + p.radius && Math.abs(p.y - propCy) <= prop.height * 0.5 + p.radius) {
        if (p.explodeRadius) {
          const expColor = p.kind === "ember_bomb" ? "#F97316" : p.kind === "boulder_rock" ? "#22C55E" : "#A855F7";
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
    if ((p.spawnsPuddleOnLand || p.explodeRadius || p.kind === "ember_bomb" || p.kind === "boulder_rock") && p.vy > 0) {
      let landedOnPlat = false;
      for (const plat of plats) {
        if (plat.broken) continue;
        if (p.x >= plat.x && p.x <= plat.x + plat.width && prevY <= plat.y + 8 && p.y >= plat.y) {
          const impactColor = p.kind === "ember_bomb" ? "#F97316" : p.kind === "boulder_rock" ? "#22C55E" : p.kind === "nova_star" ? "#A855F7" : "#FBBF24";
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
              damagePlatform(plat, p.kind === "boulder_rock" ? 20 : 14, p.x, impactColor);
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
                  "spark"
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
    if (p.life <= 0 || p.y > BLAST_ZONE.bottom || p.x < BLAST_ZONE.left || p.x > BLAST_ZONE.right) {
      state.projectiles.splice(i, 1);
    }
  }
  for (let i = state.zones.length - 1; i >= 0; i--) {
    const z = state.zones[i];
    const prevTelegraph = z.telegraphTimer ?? 0;
    if (z.telegraphTimer !== void 0 && z.telegraphTimer > 0) {
      z.telegraphTimer = Math.max(0, z.telegraphTimer - dt);
    }
    z.life -= dt;
    z.hitTimers[0] = Math.max(0, z.hitTimers[0] - dt);
    z.hitTimers[1] = Math.max(0, z.hitTimers[1] - dt);
    if (z.height < z.targetHeight) {
      z.height = Math.min(z.targetHeight, z.height + z.targetHeight / 0.14 * dt);
    }
    const opponentSlot = z.ownerSlot === 0 ? 1 : 0;
    const target = state.players[opponentSlot];
    const attacker = state.players[z.ownerSlot];
    const targetCy = target.y - target.height * 0.5;
    if (z.kind === "railgun_beam") {
      if (z.telegraphTimer !== void 0 && z.telegraphTimer > 0) {
        const desiredAngle = Math.atan2(targetCy - z.y, target.x - z.x);
        let diff = desiredAngle - (z.angle ?? 0);
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        z.angle = (z.angle ?? 0) + Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      } else {
        if (prevTelegraph > 0) {
          sounds.push({ type: "ultimate" });
          state.shakeIntensity = Math.max(state.shakeIntensity, 12);
          state.lightningFlash = Math.max(state.lightningFlash, 0.7);
        }
        const ang = z.angle ?? 0;
        const x2 = z.x + Math.cos(ang) * z.width;
        const y2 = z.y + Math.sin(ang) * z.width;
        if (z.hitTimers[opponentSlot] <= 0 && target.animState !== "ko") {
          if (distToSegment(target.x, targetCy, z.x, z.y, x2, y2) <= z.height * 0.6 + target.width * 0.35) {
            z.hitTimers[opponentSlot] = 0.6;
            const pushDir = Math.cos(ang) >= 0 ? 1 : -1;
            applyHit(attacker, target, z.damage, z.knockbackX, z.knockbackY, pushDir, 0.065, 0, {
              appliesStun: z.appliesStun
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
    } else if (z.kind === "cross_slash") {
      const cy = z.y - z.height * 0.5;
      const ang = z.angle ?? 0;
      const halfW = z.width * 0.5;
      const x1 = z.x - Math.cos(ang) * halfW;
      const y1 = cy - Math.sin(ang) * halfW;
      const x2 = z.x + Math.cos(ang) * halfW;
      const y2 = cy + Math.sin(ang) * halfW;
      if (z.hitTimers[opponentSlot] <= 0 && target.animState !== "ko") {
        if (distToSegment(target.x, targetCy, x1, y1, x2, y2) <= 38 + target.width * 0.35) {
          z.hitTimers[opponentSlot] = 0.45;
          const pushDir = target.x >= z.x ? 1 : -1;
          applyHit(attacker, target, z.damage, z.knockbackX, z.knockbackY, pushDir, 0.045, 0);
        }
      }
      for (const prop of state.destructibles) {
        if (prop.broken || prop.hitCooldown > 0) continue;
        if (distToSegment(prop.x, prop.y - prop.height * 0.5, x1, y1, x2, y2) <= 38 + prop.width * 0.4) {
          damageDestructible(prop, z.ownerSlot, z.damage);
        }
      }
    } else if (z.kind === "whirlpool_zone") {
      const cy = z.y - z.height * 0.5;
      const dx = z.x - target.x;
      const dy = cy - targetCy;
      const dist = Math.hypot(dx, dy);
      if (target.animState !== "ko" && dist > 12 && dist <= z.width * 0.72) {
        const pull = (1 - dist / (z.width * 0.75)) * 420;
        target.vx += dx / dist * pull * dt;
        target.vy += dy / dist * pull * dt;
        target.slowTimer = Math.max(target.slowTimer, 0.25);
      }
      if (z.hitTimers[opponentSlot] <= 0 && target.animState !== "ko" && dist <= z.width * 0.48) {
        z.hitTimers[opponentSlot] = 0.55;
        target.hp = Math.max(0, target.hp - z.damage);
        attacker.damageDealt += z.damage;
        target.slowTimer = Math.max(target.slowTimer, z.appliesSlow);
        sounds.push({ type: "hit", heavy: false });
      }
      if (z.life <= 0) {
        sounds.push({ type: "structureBreak" });
        spawnParticleInState(state, z.x, cy, 0, 0, 120, "#F472B6", 0.32, 0, "ring");
        if (target.animState !== "ko" && dist <= z.width * 0.6) {
          const pushDir = target.x >= z.x ? 1 : -1;
          applyHit(attacker, target, 28, 340, -540, pushDir, 0.07, 0);
        }
      }
    } else {
      if (z.hitTimers[opponentSlot] <= 0 && target.animState !== "ko") {
        const zLeft = z.x - z.width * 0.5;
        const zRight = z.x + z.width * 0.5;
        const zTop = z.y - z.height;
        const zBottom = z.y;
        const tLeft = target.x - target.width * 0.4;
        const tRight = target.x + target.width * 0.4;
        const tTop = target.y - target.height;
        const tBottom = target.y;
        const overlaps = tRight >= zLeft && tLeft <= zRight && tBottom >= zTop && tTop <= zBottom;
        if (overlaps) {
          if (z.kind === "honey_puddle") {
            z.hitTimers[opponentSlot] = 0.55;
            target.poisonTimer = Math.max(target.poisonTimer, z.appliesPoison);
            target.poisonSourceSlot = z.ownerSlot;
            target.slowTimer = Math.max(target.slowTimer, z.appliesSlow);
            if (target.poisonTickTimer <= 0) target.poisonTickTimer = 0.3;
            target.hp = Math.max(0, target.hp - z.damage);
            attacker.damageDealt += z.damage;
            sounds.push({ type: "poisonTick" });
          } else if (z.kind === "glitch_field") {
            z.hitTimers[opponentSlot] = 0.48;
            const pushDir = target.x >= z.x ? 1 : -1;
            applyHit(attacker, target, z.damage, z.knockbackX, z.knockbackY, pushDir, 0.03, 0, {
              appliesSlow: z.appliesSlow,
              appliesConfuse: z.appliesConfuse
            });
          } else {
            z.hitTimers[opponentSlot] = 0.65;
            const pushDir = target.x >= z.x ? 1 : -1;
            applyHit(attacker, target, z.damage, z.knockbackX, z.knockbackY, pushDir, 0.055, 10, {
              appliesStun: z.appliesStun
            });
          }
        }
      }
      if (z.kind === "cloud_wall" || z.kind === "lightning_pillar" || z.kind === "glitch_field") {
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
  for (const obs of state.obstacles) {
    obs.timer += dt;
    obs.hitCooldowns[0] = Math.max(0, obs.hitCooldowns[0] - dt);
    obs.hitCooldowns[1] = Math.max(0, obs.hitCooldowns[1] - dt);
    if (obs.kind === "lava_geyser") {
      const period = obs.period ?? 5.5;
      const phase = obs.timer % period;
      if (phase < 2.6) {
        obs.state = "idle";
        obs.currentHeight = 0;
      } else if (phase < 3.9) {
        obs.state = "telegraph";
        obs.currentHeight = 0;
      } else {
        obs.state = "active";
        const activeRatio = Math.min(1, (phase - 3.9) / 0.2);
        obs.currentHeight = obs.height * activeRatio;
        for (const f of state.players) {
          if (obs.hitCooldowns[f.slot] > 0 || f.animState === "ko") continue;
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
    } else if (obs.kind === "wind_bumper") {
      obs.angle += dt * 4.5;
      const r = obs.radius ?? 36;
      for (const f of state.players) {
        if (obs.hitCooldowns[f.slot] > 0 || f.animState === "ko") continue;
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
          sounds.push({ type: "bouncePad" });
          spawnParticleInState(
            state,
            obs.currentX,
            obs.currentY,
            0,
            0,
            44,
            "#2DD4BF",
            0.25,
            0,
            "ring"
          );
        }
      }
    } else if (obs.kind === "jump_pad") {
      for (const f of state.players) {
        if (obs.hitCooldowns[f.slot] > 0 || f.animState === "ko") continue;
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
          sounds.push({ type: "bouncePad" });
          spawnParticleInState(state, obs.x, obs.y - 8, 0, 0, 32, "#FAFAFA", 0.25, 0, "ring");
        }
      }
    } else if (obs.kind === "eclipse_pendulum") {
      const period = obs.period ?? 3.4;
      const swingR = obs.swingRadius ?? 155;
      const swingAngle = Math.sin(obs.timer / period * Math.PI * 2) * 1.05;
      obs.currentX = obs.x + Math.sin(swingAngle) * swingR;
      obs.currentY = obs.y + Math.cos(swingAngle) * swingR;
      const r = obs.radius ?? 28;
      for (const f of state.players) {
        if (obs.hitCooldowns[f.slot] > 0 || f.animState === "ko") continue;
        const fy = f.y - f.height * 0.5;
        const dist = Math.hypot(f.x - obs.currentX, fy - obs.currentY);
        if (dist <= r + f.width * 0.38) {
          obs.hitCooldowns[f.slot] = 0.55;
          const dir = f.x >= obs.currentX ? 1 : -1;
          applyHit(null, f, 15, 420, -320, dir, 0.045, 6, { isHazard: true });
        }
      }
    } else if (obs.kind === "hive_swarm") {
      const period = obs.period ?? 7.5;
      const t = obs.timer / period * Math.PI * 2;
      obs.state = "active";
      obs.currentX = obs.x + Math.sin(t) * 320;
      obs.currentY = obs.y + Math.sin(t * 2) * 82;
      const r = obs.radius ?? 34;
      for (const f of state.players) {
        if (obs.hitCooldowns[f.slot] > 0 || f.animState === "ko") continue;
        const fy = f.y - f.height * 0.5;
        if (Math.hypot(f.x - obs.currentX, fy - obs.currentY) <= r + f.width * 0.34) {
          obs.hitCooldowns[f.slot] = 0.7;
          const dir = f.x >= obs.currentX ? 1 : -1;
          applyHit(null, f, 10, 280, -240, dir, 0.035, 5, {
            appliesPoison: 2.6,
            isHazard: true
          });
        }
      }
    } else if (obs.kind === "lightning_arc") {
      const period = obs.period ?? 4.8;
      const phase = obs.timer % period;
      const prevState = obs.state;
      if (phase < 2.5) {
        obs.state = "idle";
      } else if (phase < 3.7) {
        obs.state = "telegraph";
      } else {
        obs.state = "active";
        if (prevState !== "active") {
          state.lightningFlash = Math.max(state.lightningFlash, 0.55);
          state.shakeIntensity = Math.max(state.shakeIntensity, 6);
        }
        for (const f of state.players) {
          if (obs.hitCooldowns[f.slot] > 0 || f.animState === "ko") continue;
          const overlapX = Math.abs(f.x - obs.x) <= obs.width * 0.5 + f.width * 0.28;
          const overlapY = f.y >= 20 && f.y - f.height <= obs.y;
          if (overlapX && overlapY) {
            obs.hitCooldowns[f.slot] = 0.75;
            const dir = f.x >= obs.x ? 1 : -1;
            applyHit(null, f, 16, 290, -520, dir, 0.045, 7, {
              appliesStun: 0.75,
              isHazard: true
            });
          }
        }
      }
    } else if (obs.kind === "icicle_drop") {
      const period = obs.period ?? 4.6;
      const phase = obs.timer % period;
      if (phase < 2.2) {
        obs.state = "idle";
        obs.currentX = obs.x;
        obs.currentY = 42;
      } else if (phase < 3.4) {
        obs.state = "telegraph";
        obs.currentX = obs.x;
        obs.currentY = 42;
      } else {
        obs.state = "active";
        const dropRatio = Math.min(1, (phase - 3.4) / 0.48);
        obs.currentX = obs.x;
        obs.currentY = 42 + dropRatio * (obs.y - 42);
        if (dropRatio < 1) {
          for (const f of state.players) {
            if (obs.hitCooldowns[f.slot] > 0 || f.animState === "ko") continue;
            const fy = f.y - f.height * 0.5;
            const overlapX = Math.abs(f.x - obs.currentX) <= obs.width * 0.5 + f.width * 0.3;
            const overlapY = fy + f.height * 0.45 >= obs.currentY - obs.height && fy - f.height * 0.45 <= obs.currentY;
            if (overlapX && overlapY) {
              obs.hitCooldowns[f.slot] = 0.75;
              const dir = f.x >= obs.currentX ? 1 : -1;
              applyHit(null, f, 13, 250, -360, dir, 0.04, 5, {
                appliesSlow: 2.8,
                isHazard: true
              });
            }
          }
        }
      }
    } else if (obs.kind === "crusher_piston") {
      const period = obs.period ?? 5;
      const phase = obs.timer % period;
      const topY = 210;
      const prevY = obs.currentY;
      if (phase < 2.2) {
        obs.state = "idle";
        obs.currentY = topY;
      } else if (phase < 3.4) {
        obs.state = "telegraph";
        obs.currentY = topY + Math.sin(obs.timer * 34) * 3;
      } else if (phase < 4.1) {
        obs.state = "active";
        const slamRatio = Math.min(1, (phase - 3.4) / 0.16);
        obs.currentY = topY + slamRatio * (obs.y - topY);
        if (prevY < obs.y - 4 && obs.currentY >= obs.y - 4) {
          state.shakeIntensity = Math.max(state.shakeIntensity, 8);
          sounds.push({ type: "structureBreak" });
        }
        for (const f of state.players) {
          if (obs.hitCooldowns[f.slot] > 0 || f.animState === "ko") continue;
          const overlapX = Math.abs(f.x - obs.x) <= obs.width * 0.5 + f.width * 0.32;
          const overlapY = f.y >= obs.currentY - obs.height && f.y - f.height <= obs.currentY;
          if (overlapX && overlapY) {
            obs.hitCooldowns[f.slot] = 0.8;
            const dir = f.x >= obs.x ? 1 : -1;
            applyHit(null, f, 18, 440, -480, dir, 0.055, 7, { isHazard: true });
          }
        }
      } else {
        obs.state = "idle";
        const retract = Math.min(1, (phase - 4.1) / 0.9);
        obs.currentY = obs.y - retract * (obs.y - topY);
      }
    } else if (obs.kind === "whirlpool_vortex") {
      const period = obs.period ?? 5.6;
      const phase = obs.timer % period;
      const r = obs.radius ?? 44;
      if (phase < 2) {
        obs.state = "idle";
      } else if (phase < 3.2) {
        obs.state = "telegraph";
      } else {
        obs.state = "active";
        for (const f of state.players) {
          if (f.animState === "ko") continue;
          const fy = f.y - f.height * 0.5;
          const dx = obs.currentX - f.x;
          const dy = obs.currentY - fy;
          const dist = Math.hypot(dx, dy);
          if (dist > 10 && dist < 260) {
            const pull = (1 - dist / 260) * 320;
            f.vx += dx / dist * pull * dt;
            f.vy += dy / dist * pull * dt;
          }
          if (obs.hitCooldowns[f.slot] <= 0 && dist <= r + 14) {
            obs.hitCooldowns[f.slot] = 0.8;
            const dir = f.x >= obs.currentX ? 1 : -1;
            applyHit(null, f, 11, 380, -410, dir, 0.04, 5, {
              appliesSlow: 2.2,
              isHazard: true
            });
          }
        }
      }
    } else if (obs.kind === "laser_sweeper") {
      const period = obs.period ?? 5.4;
      const phase = obs.timer % period;
      if (phase < 1.8) {
        obs.state = "idle";
        obs.angle = -0.85;
      } else if (phase < 3) {
        obs.state = "telegraph";
        obs.angle = -0.85;
      } else {
        obs.state = "active";
        const sweepRatio = Math.min(1, (phase - 3) / (period - 3));
        obs.angle = -0.85 + sweepRatio * 1.7;
        const len = obs.height ?? 480;
        const x1 = obs.x;
        const y1 = obs.y;
        const x2 = x1 + Math.sin(obs.angle) * len;
        const y2 = y1 + Math.cos(obs.angle) * len;
        const segLenSq = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        for (const f of state.players) {
          if (obs.hitCooldowns[f.slot] > 0 || f.animState === "ko") continue;
          const fy = f.y - f.height * 0.5;
          const proj = Math.max(
            0,
            Math.min(1, ((f.x - x1) * (x2 - x1) + (fy - y1) * (y2 - y1)) / segLenSq)
          );
          const closestX = x1 + proj * (x2 - x1);
          const closestY = y1 + proj * (y2 - y1);
          if (Math.hypot(f.x - closestX, fy - closestY) <= 26) {
            obs.hitCooldowns[f.slot] = 0.7;
            const dir = Math.sin(obs.angle) >= 0 ? 1 : -1;
            applyHit(null, f, 15, 390, -330, dir, 0.045, 6, { isHazard: true });
          }
        }
      }
    } else if (obs.kind === "hover_car") {
      const period = obs.period ?? 5;
      const phase = obs.timer % period;
      const telegraphStart = period - 2.65;
      const activeStart = period - 1.55;
      const prevState = obs.state;
      if (phase < telegraphStart) {
        obs.state = "idle";
        obs.currentX = -400;
      } else if (phase < activeStart) {
        obs.state = "telegraph";
      } else {
        obs.state = "active";
        if (prevState !== "active") {
          sounds.push({ type: "hoverCarPass" });
        }
        const activeElapsed = phase - activeStart;
        const spd = obs.speed ?? 820;
        const dir = obs.direction ?? 1;
        obs.currentX = dir === 1 ? -140 + activeElapsed * spd : WORLD_WIDTH + 140 - activeElapsed * spd;
        obs.currentY = obs.y;
        if (Math.random() < dt * 28) {
          spawnParticleInState(
            state,
            obs.currentX - dir * (obs.width * 0.5),
            obs.currentY + (Math.random() - 0.5) * 12,
            -dir * (90 + Math.random() * 80),
            (Math.random() - 0.5) * 40,
            3.5,
            dir === 1 ? "#22D3EE" : "#EC4899",
            0.22,
            0,
            "spark"
          );
        }
        const carHalfW = obs.width * 0.46;
        const carHalfH = obs.height * 0.46;
        for (const f of state.players) {
          if (obs.hitCooldowns[f.slot] > 0 || f.animState === "ko") continue;
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

// src/types/account.ts
var ALL_MAP_IDS = [
  "hive_canopy",
  "storm_citadel",
  "magma_foundry",
  "wind_mill_spire",
  "eclipse_temple",
  "neon_skyline",
  "frost_glacier",
  "cyber_factory",
  "coral_abyss",
  "cosmic_station"
];
var ALL_FIGHTER_IDS = [
  "honey_shell",
  "cloudier",
  "eve",
  "spidra",
  "marshal_bolt",
  "pyro_jack",
  "aqua_nyx",
  "blade_zero",
  "moss_golem",
  "astro_pip"
];
var DEFAULT_RANKED_POINTS = 1e3;
var MAX_RANKED_POINTS = 1e4;
var MAX_TOURNAMENT_POINTS = 1e5;
var DISPLAY_NAME_MIN_LENGTH = 1;
var DISPLAY_NAME_MAX_LENGTH = 32;
function sanitizeDisplayName(name, fallback = "Brawler") {
  const trimmed = (name ?? "").trim();
  const base = trimmed.length >= DISPLAY_NAME_MIN_LENGTH ? trimmed : fallback;
  return base.slice(0, DISPLAY_NAME_MAX_LENGTH);
}
function sanitizeFighterId(value) {
  if (typeof value === "string" && ALL_FIGHTER_IDS.includes(value)) {
    return value;
  }
  return "honey_shell";
}
function sanitizeMapSelection(value) {
  if (value === "random") return "random";
  if (typeof value === "string" && ALL_MAP_IDS.includes(value)) {
    return value;
  }
  return "hive_canopy";
}

// server.ts
var PORT = Number(process.env.PORT) || 3e3;
var TICK_HZ = 60;
var TICK_DT = 1 / TICK_HZ;
var BROADCAST_EVERY_TICKS = 2;
var clients = /* @__PURE__ */ new Map();
var casualQueue = [];
var rankedQueue = [];
var tournamentQueue = [];
var activeMatches = /* @__PURE__ */ new Map();
var tournamentCycleLedgers = /* @__PURE__ */ new Map();
var tournamentCycleRecentMatches = /* @__PURE__ */ new Map();
var lastObservedTournamentActive = getTournamentScheduleStatus().isActive;
var lastObservedTournamentCycleId = getTournamentScheduleStatus().cycleId;
function createEmptyCumulativeStats() {
  return {
    damageDealt: 0,
    koCount: 0,
    hitsLanded: 0,
    longestCombo: 0,
    peakSingleHit: 0,
    heavyHitsLanded: 0
  };
}
function createEmptyInputState() {
  return {
    moveDir: 0,
    jumpHeld: false,
    downHeld: false,
    queued: {}
  };
}
function clampRankedPoints(raw) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_RANKED_POINTS;
  }
  return Math.max(0, Math.min(MAX_RANKED_POINTS, Math.floor(raw)));
}
function clampNonNegInt(raw, max) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.min(max, Math.floor(raw)));
}
function resolvePlayerKey(client) {
  if (client.accountUid && /^[a-zA-Z0-9_\-]{1,128}$/.test(client.accountUid)) {
    return `uid:${client.accountUid}`;
  }
  return `ws:${client.clientId}`;
}
function getCycleLedger(cycleId) {
  let ledger = tournamentCycleLedgers.get(cycleId);
  if (!ledger) {
    ledger = /* @__PURE__ */ new Map();
    tournamentCycleLedgers.set(cycleId, ledger);
  }
  return ledger;
}
function sortStandings(ledger) {
  if (!ledger) return [];
  return Array.from(ledger.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  }).slice(0, 25);
}
function syncClientToTournamentLedger(client, cycleId) {
  const playerKey = resolvePlayerKey(client);
  const ledger = getCycleLedger(cycleId);
  const existing = ledger.get(playerKey);
  if (existing) {
    existing.displayName = client.displayName;
    existing.fighterId = client.fighterId;
    if (client.tournamentCycleId === cycleId) {
      existing.points = Math.max(existing.points, client.tournamentPoints);
      existing.wins = Math.max(existing.wins, client.tournamentWins);
      existing.losses = Math.max(existing.losses, client.tournamentLosses);
    }
    client.tournamentCycleId = cycleId;
    client.tournamentPoints = existing.points;
    client.tournamentWins = existing.wins;
    client.tournamentLosses = existing.losses;
    client.tournamentStreak = existing.streak;
    existing.updatedAt = Date.now();
    return;
  }
  if (client.tournamentCycleId === cycleId && (client.tournamentPoints > 0 || client.tournamentWins > 0 || client.tournamentLosses > 0)) {
    ledger.set(playerKey, {
      playerKey,
      displayName: client.displayName,
      fighterId: client.fighterId,
      points: client.tournamentPoints,
      wins: client.tournamentWins,
      losses: client.tournamentLosses,
      streak: client.tournamentStreak,
      updatedAt: Date.now()
    });
  } else {
    client.tournamentCycleId = cycleId;
    client.tournamentPoints = 0;
    client.tournamentWins = 0;
    client.tournamentLosses = 0;
    client.tournamentStreak = 0;
  }
}
function toBracketPlayer(client, meta) {
  return {
    clientId: client.clientId,
    playerKey: resolvePlayerKey(client),
    displayName: meta.displayName,
    fighterId: meta.fighterId,
    tournamentPoints: meta.tournamentPoints
  };
}
function buildTournamentMatchRecord(room, status, winnerSlot = null, reason) {
  return {
    matchId: room.matchId,
    cycleId: room.tournamentCycleId || getTournamentScheduleStatus().cycleId,
    status,
    round: room.round,
    roundPhase: status === "completed" ? "completed" : room.roundPhase,
    targetWins: TARGET_SERIES_WINS,
    scores: [room.scores[0], room.scores[1]],
    mapId: room.mapId,
    players: [
      toBracketPlayer(room.clients[0], room.metas[0]),
      toBracketPlayer(room.clients[1], room.metas[1])
    ],
    winnerSlot,
    reason,
    startedAtMs: room.startedAtMs,
    finishedAtMs: status === "completed" ? Date.now() : void 0
  };
}
function buildTournamentStateSnapshot(nowMs = Date.now()) {
  const s = getTournamentScheduleStatus(nowMs);
  const currentLedger = tournamentCycleLedgers.get(s.cycleId);
  const lastLedger = s.previousCycleId ? tournamentCycleLedgers.get(s.previousCycleId) : void 0;
  const liveTournamentMatches = [];
  for (const room of activeMatches.values()) {
    if (room.queueType === "tournament" && !room.finished) {
      liveTournamentMatches.push(buildTournamentMatchRecord(room, "live"));
    }
  }
  const recentSourceCycle = s.isActive ? s.cycleId : s.previousCycleId;
  const recentMatches = recentSourceCycle ? (tournamentCycleRecentMatches.get(recentSourceCycle) ?? []).slice(0, 12) : [];
  return {
    serverNowMs: s.nowMs,
    cycleNumber: s.cycleNumber,
    cycleId: s.cycleId,
    title: s.title,
    isActive: s.isActive,
    activeWindowStartMs: s.activeWindowStartMs,
    activeWindowEndMs: s.activeWindowEndMs,
    nextTournamentStartMs: s.nextTournamentStartMs,
    nextTournamentEndMs: s.nextTournamentEndMs,
    msUntilTransition: s.msUntilTransition,
    progressPct: s.progressPct,
    upcomingWindows: s.upcomingWindows,
    standings: sortStandings(currentLedger),
    lastCycleId: s.previousCycleId,
    lastCycleTitle: s.previousCycleTitle,
    lastStandings: sortStandings(lastLedger),
    activeMatches: liveTournamentMatches,
    recentMatches
  };
}
function sendToClient(client, msg) {
  if (client.ws.readyState !== WebSocket.OPEN) return;
  try {
    client.ws.send(JSON.stringify(msg));
  } catch {
  }
}
function removeFromQueueList(list, clientId) {
  const idx = list.indexOf(clientId);
  if (idx !== -1) list.splice(idx, 1);
}
function toLobbyEntry(client) {
  return {
    clientId: client.clientId,
    displayName: client.displayName,
    fighterId: client.fighterId,
    preferredMap: client.preferredMap,
    rankedPoints: client.rankedPoints,
    tournamentPoints: client.tournamentPoints,
    status: client.matchId ? "in_match" : client.queue ? "queued" : "waiting",
    joinedAt: client.queueEnteredAt ?? client.joinedAt
  };
}
function buildWaitingAreaSnapshot() {
  const casualWaiting = [];
  const rankedWaiting = [];
  const tournamentWaiting = [];
  let casualInMatchCount = 0;
  let rankedInMatchCount = 0;
  let tournamentInMatchCount = 0;
  for (const room of activeMatches.values()) {
    if (room.finished) continue;
    if (room.queueType === "casual") casualInMatchCount += 2;
    else if (room.queueType === "ranked") rankedInMatchCount += 2;
    else tournamentInMatchCount += 2;
  }
  for (const client of clients.values()) {
    if (client.area === "casual") {
      casualWaiting.push(toLobbyEntry(client));
    } else if (client.area === "ranked") {
      rankedWaiting.push(toLobbyEntry(client));
    } else if (client.area === "tournament") {
      tournamentWaiting.push(toLobbyEntry(client));
    }
  }
  const sortEntries = (a, b) => {
    const order = { queued: 0, waiting: 1, in_match: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.joinedAt - b.joinedAt;
  };
  casualWaiting.sort(sortEntries);
  rankedWaiting.sort(sortEntries);
  tournamentWaiting.sort(sortEntries);
  return {
    casualWaiting,
    rankedWaiting,
    tournamentWaiting,
    casualInMatchCount,
    rankedInMatchCount,
    tournamentInMatchCount
  };
}
function broadcastPresence() {
  const snapshot = buildWaitingAreaSnapshot();
  const msg = { type: "presence:update", snapshot };
  const payload = JSON.stringify(msg);
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch {
      }
    }
  }
}
function broadcastTournamentUpdate() {
  const tournament = buildTournamentStateSnapshot();
  const msg = { type: "tournament:update", tournament };
  const payload = JSON.stringify(msg);
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch {
      }
    }
  }
}
function sendQueueStatuses(queueType) {
  const list = queueType === "casual" ? casualQueue : queueType === "ranked" ? rankedQueue : tournamentQueue;
  list.forEach((cid, idx) => {
    const client = clients.get(cid);
    if (!client) return;
    sendToClient(client, {
      type: "queue:status",
      inQueue: queueType,
      position: idx + 1,
      enteredAt: client.queueEnteredAt
    });
  });
}
function serializeEngineSnapshot(state) {
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
    floatingNumbers: state.floatingNumbers
  };
}
function pickMatchMap(c0, c1) {
  const candidates = [];
  if (c0.preferredMap !== "random") candidates.push(c0.preferredMap);
  if (c1.preferredMap !== "random") candidates.push(c1.preferredMap);
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return ALL_MAP_IDS[Math.floor(Math.random() * ALL_MAP_IDS.length)];
}
function buildFinalSeriesPlayers(room) {
  const hud = buildHudSnapshot(room.state);
  const combine = (slot) => {
    const cur = hud.players[slot];
    const prev = room.completedRoundStats[slot];
    return {
      ...cur,
      name: room.metas[slot].displayName,
      damageDealt: Math.round(prev.damageDealt + cur.damageDealt),
      koCount: prev.koCount + cur.koCount,
      hitsLanded: prev.hitsLanded + cur.hitsLanded,
      longestCombo: Math.max(prev.longestCombo, cur.longestCombo),
      peakSingleHit: Math.max(prev.peakSingleHit, cur.peakSingleHit),
      heavyHitsLanded: prev.heavyHitsLanded + cur.heavyHitsLanded
    };
  };
  return [combine(0), combine(1)];
}
function accumulateCurrentRoundStats(room) {
  for (const slot of [0, 1]) {
    const fighter = room.state.players[slot];
    const acc = room.completedRoundStats[slot];
    acc.damageDealt += fighter.damageDealt;
    acc.koCount += fighter.koCount;
    acc.hitsLanded += fighter.hitsLanded;
    acc.longestCombo = Math.max(acc.longestCombo, fighter.longestCombo);
    acc.peakSingleHit = Math.max(acc.peakSingleHit, fighter.peakSingleHit);
    acc.heavyHitsLanded += fighter.heavyHitsLanded;
  }
}
function broadcastMatchState(room, forceClearSounds = true) {
  const sounds = room.pendingSounds;
  if (forceClearSounds) {
    room.pendingSounds = [];
  }
  const msg = {
    type: "match:state",
    matchId: room.matchId,
    tick: room.tickCount,
    round: room.round,
    scores: [room.scores[0], room.scores[1]],
    roundPhase: room.roundPhase,
    roundTimer: Number(room.roundTimer.toFixed(2)),
    lastRoundWinnerSlot: room.lastRoundWinnerSlot,
    state: serializeEngineSnapshot(room.state),
    sounds
  };
  const payload = JSON.stringify(msg);
  for (const client of room.clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch {
      }
    }
  }
}
function finishMatchSeries(room, winnerSlot, reason) {
  if (room.finished) return;
  room.finished = true;
  room.roundPhase = "series_over";
  if (room.interval) {
    clearInterval(room.interval);
    room.interval = null;
  }
  const finalPlayers = buildFinalSeriesPlayers(room);
  const matchDurationSec = Math.max(1, Math.round((Date.now() - room.startedAtMs) / 1e3));
  const loserSlot = winnerSlot === 0 ? 1 : 0;
  const rpDelta = [0, 0];
  const newRp = [room.metas[0].rankedPoints, room.metas[1].rankedPoints];
  const tpDelta = [0, 0];
  const newTp = [room.metas[0].tournamentPoints, room.metas[1].tournamentPoints];
  if (room.queueType === "ranked") {
    const { winnerGain, loserLoss } = computeRankedRpDelta(
      room.metas[winnerSlot].rankedPoints,
      room.metas[loserSlot].rankedPoints
    );
    rpDelta[winnerSlot] = winnerGain;
    rpDelta[loserSlot] = -loserLoss;
    newRp[winnerSlot] = Math.min(MAX_RANKED_POINTS, room.metas[winnerSlot].rankedPoints + winnerGain);
    newRp[loserSlot] = Math.max(0, room.metas[loserSlot].rankedPoints - loserLoss);
    room.clients[winnerSlot].rankedPoints = newRp[winnerSlot];
    room.clients[loserSlot].rankedPoints = newRp[loserSlot];
  } else if (room.queueType === "tournament") {
    const cycleId = room.tournamentCycleId || getTournamentScheduleStatus().cycleId;
    const { winnerTpGain, loserTpGain } = computeTournamentPointsAward(
      room.scores[winnerSlot],
      room.scores[loserSlot],
      reason
    );
    tpDelta[winnerSlot] = winnerTpGain;
    tpDelta[loserSlot] = loserTpGain;
    const ledger = getCycleLedger(cycleId);
    for (const slot of [winnerSlot, loserSlot]) {
      const client = room.clients[slot];
      const meta = room.metas[slot];
      const won = slot === winnerSlot;
      const gain = tpDelta[slot];
      const nextPoints = Math.min(MAX_TOURNAMENT_POINTS, meta.tournamentPoints + gain);
      newTp[slot] = nextPoints;
      client.tournamentCycleId = cycleId;
      client.tournamentPoints = nextPoints;
      client.tournamentWins = (client.tournamentWins || 0) + (won ? 1 : 0);
      client.tournamentLosses = (client.tournamentLosses || 0) + (won ? 0 : 1);
      client.tournamentStreak = won ? (client.tournamentStreak || 0) + 1 : 0;
      const playerKey = resolvePlayerKey(client);
      const prevEntry = ledger.get(playerKey);
      ledger.set(playerKey, {
        playerKey,
        displayName: meta.displayName,
        fighterId: meta.fighterId,
        points: Math.max(prevEntry?.points ?? 0, nextPoints),
        wins: (prevEntry?.wins ?? 0) + (won ? 1 : 0),
        losses: (prevEntry?.losses ?? 0) + (won ? 0 : 1),
        streak: won ? (prevEntry?.streak ?? 0) + 1 : 0,
        updatedAt: Date.now()
      });
    }
  }
  const msg = {
    type: "match:series_over",
    matchId: room.matchId,
    queueType: room.queueType,
    winnerSlot,
    reason,
    scores: [room.scores[0], room.scores[1]],
    finalPlayers,
    matchDurationSec,
    rpDelta,
    newRp,
    tpDelta,
    newTp,
    tournamentCycleId: room.tournamentCycleId
  };
  for (const client of room.clients) {
    sendToClient(client, msg);
    if (client.matchId === room.matchId) {
      client.matchId = null;
      client.queue = null;
      client.queueEnteredAt = null;
    }
  }
  if (room.queueType === "tournament") {
    const cycleId = room.tournamentCycleId || getTournamentScheduleStatus().cycleId;
    const history = tournamentCycleRecentMatches.get(cycleId) ?? [];
    history.unshift(buildTournamentMatchRecord(room, "completed", winnerSlot, reason));
    if (history.length > 16) history.length = 16;
    tournamentCycleRecentMatches.set(cycleId, history);
  }
  activeMatches.delete(room.matchId);
  broadcastPresence();
  if (room.queueType === "tournament") {
    broadcastTournamentUpdate();
  }
}
function consumeFighterControls(inputState, isConfused) {
  const q = inputState.queued;
  let directMove = null;
  if (q.ultimate) directMove = "ultimate";
  else if (q.recovery) directMove = "recovery";
  else if (q.special) directMove = "special";
  else if (q.attack3) directMove = "attack3";
  else if (q.attack2) directMove = "attack2";
  else if (q.attack1) directMove = "attack1";
  const rawMoveDir = inputState.moveDir;
  const rawJump = Boolean(q.jump);
  const rawDown = inputState.downHeld;
  const ctrl = {
    moveDir: isConfused ? -rawMoveDir : rawMoveDir,
    jumpPressed: isConfused ? rawDown && !rawJump : rawJump,
    downHeld: isConfused ? inputState.jumpHeld : rawDown,
    attackComboPressed: Boolean(q.attackCombo),
    tauntPressed: Boolean(q.taunt),
    directMove
  };
  inputState.queued = {};
  return ctrl;
}
function stepMatchRoom(room) {
  if (room.finished) return;
  room.tickCount += 1;
  if (room.roundPhase === "intro") {
    room.roundTimer = Math.max(0, room.roundTimer - TICK_DT);
    room.state.ambientTime += TICK_DT;
    stepPlatforms(room.state, TICK_DT);
    stepVisualEffects(room.state, TICK_DT);
    room.inputs[0].queued = {};
    room.inputs[1].queued = {};
    if (room.roundTimer <= 0) {
      room.roundPhase = "fighting";
      room.roundTimer = 0;
      broadcastMatchState(room);
      if (room.queueType === "tournament") {
        broadcastTournamentUpdate();
      }
      return;
    }
  } else if (room.roundPhase === "fighting") {
    const c0 = consumeFighterControls(room.inputs[0], room.state.players[0].confuseTimer > 0);
    const c1 = consumeFighterControls(room.inputs[1], room.state.players[1].confuseTimer > 0);
    let roundEndedWinner = null;
    const { sounds } = stepCombatFrame(room.state, [c0, c1], TICK_DT, {
      startingStocks: ONLINE_ROUND_STOCKS,
      onMatchEnd: (winnerSlot) => {
        roundEndedWinner = winnerSlot;
      }
    });
    if (sounds.length > 0) {
      room.pendingSounds.push(...sounds);
    }
    if (roundEndedWinner !== null) {
      room.scores[roundEndedWinner] += 1;
      room.lastRoundWinnerSlot = roundEndedWinner;
      if (room.scores[roundEndedWinner] >= TARGET_SERIES_WINS) {
        broadcastMatchState(room);
        finishMatchSeries(room, roundEndedWinner, "ko");
        return;
      }
      room.roundPhase = "round_over";
      room.roundTimer = 2.6;
      broadcastMatchState(room);
      if (room.queueType === "tournament") {
        broadcastTournamentUpdate();
      }
      return;
    }
  } else if (room.roundPhase === "round_over") {
    room.roundTimer = Math.max(0, room.roundTimer - TICK_DT);
    stepVictoryPhase(room.state, TICK_DT);
    stepVisualEffects(room.state, TICK_DT);
    room.inputs[0].queued = {};
    room.inputs[1].queued = {};
    if (room.roundTimer <= 0) {
      accumulateCurrentRoundStats(room);
      room.round += 1;
      const playMode = room.queueType === "ranked" ? "ONLINE_RANKED" : room.queueType === "tournament" ? "ONLINE_TOURNAMENT" : "ONLINE_CASUAL";
      room.state = createInitialEngineState(
        "PLAYING",
        playMode,
        room.mapId,
        room.metas[0].fighterId,
        room.metas[1].fighterId,
        ONLINE_ROUND_STOCKS
      );
      room.roundPhase = "intro";
      room.roundTimer = 1.4;
      broadcastMatchState(room);
      if (room.queueType === "tournament") {
        broadcastTournamentUpdate();
      }
      return;
    }
  }
  if (room.tickCount % BROADCAST_EVERY_TICKS === 0) {
    broadcastMatchState(room);
  }
}
function startOnlineMatch(queueType, c0, c1) {
  const matchId = `m_${crypto.randomUUID()}`;
  const mapId = pickMatchMap(c0, c1);
  const playMode = queueType === "ranked" ? "ONLINE_RANKED" : queueType === "tournament" ? "ONLINE_TOURNAMENT" : "ONLINE_CASUAL";
  const schedule = queueType === "tournament" ? getTournamentScheduleStatus() : null;
  c0.queue = null;
  c0.queueEnteredAt = null;
  c0.matchId = matchId;
  c0.area = queueType;
  c1.queue = null;
  c1.queueEnteredAt = null;
  c1.matchId = matchId;
  c1.area = queueType;
  const metas = [
    {
      clientId: c0.clientId,
      accountUid: c0.accountUid,
      displayName: c0.displayName,
      fighterId: c0.fighterId,
      rankedPoints: c0.rankedPoints,
      tournamentPoints: c0.tournamentPoints
    },
    {
      clientId: c1.clientId,
      accountUid: c1.accountUid,
      displayName: c1.displayName,
      fighterId: c1.fighterId,
      rankedPoints: c1.rankedPoints,
      tournamentPoints: c1.tournamentPoints
    }
  ];
  const room = {
    matchId,
    queueType,
    tournamentCycleId: schedule?.cycleId,
    tournamentTitle: schedule?.title,
    mapId,
    clients: [c0, c1],
    metas,
    inputs: [createEmptyInputState(), createEmptyInputState()],
    state: createInitialEngineState(
      "PLAYING",
      playMode,
      mapId,
      metas[0].fighterId,
      metas[1].fighterId,
      ONLINE_ROUND_STOCKS
    ),
    round: 1,
    scores: [0, 0],
    roundPhase: "intro",
    roundTimer: 1.5,
    lastRoundWinnerSlot: null,
    tickCount: 0,
    startedAtMs: Date.now(),
    pendingSounds: [],
    completedRoundStats: [createEmptyCumulativeStats(), createEmptyCumulativeStats()],
    interval: null,
    finished: false
  };
  activeMatches.set(matchId, room);
  sendToClient(c0, {
    type: "queue:status",
    inQueue: null,
    position: 0,
    enteredAt: null
  });
  sendToClient(c1, {
    type: "queue:status",
    inQueue: null,
    position: 0,
    enteredAt: null
  });
  sendToClient(c0, {
    type: "match:started",
    matchId,
    queueType,
    yourSlot: 0,
    mapId,
    targetWins: TARGET_SERIES_WINS,
    round: 1,
    scores: [0, 0],
    players: metas,
    tournamentCycleId: schedule?.cycleId,
    tournamentTitle: schedule?.title
  });
  sendToClient(c1, {
    type: "match:started",
    matchId,
    queueType,
    yourSlot: 1,
    mapId,
    targetWins: TARGET_SERIES_WINS,
    round: 1,
    scores: [0, 0],
    players: metas,
    tournamentCycleId: schedule?.cycleId,
    tournamentTitle: schedule?.title
  });
  broadcastMatchState(room);
  broadcastPresence();
  if (queueType === "tournament") {
    broadcastTournamentUpdate();
  }
  room.interval = setInterval(() => {
    stepMatchRoom(room);
  }, Math.round(1e3 / TICK_HZ));
}
function pruneQueue(list, queueType) {
  const valid = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const c = clients.get(list[i]);
    if (!c || c.ws.readyState !== WebSocket.OPEN || c.queue !== queueType || c.matchId) {
      list.splice(i, 1);
    }
  }
  for (const cid of list) {
    const c = clients.get(cid);
    if (c) valid.push(c);
  }
  return valid;
}
function tryMatchmake(queueType) {
  if (queueType === "casual") {
    const queued2 = pruneQueue(casualQueue, "casual");
    while (queued2.length >= 2) {
      const p0 = queued2.shift();
      const p1 = queued2.shift();
      removeFromQueueList(casualQueue, p0.clientId);
      removeFromQueueList(casualQueue, p1.clientId);
      startOnlineMatch("casual", p0, p1);
    }
    sendQueueStatuses("casual");
    return;
  }
  if (queueType === "tournament") {
    const schedule = getTournamentScheduleStatus();
    if (!schedule.isActive) {
      return;
    }
    const queued2 = pruneQueue(tournamentQueue, "tournament");
    while (queued2.length >= 2) {
      let bestI = 0;
      let bestJ = 1;
      let bestDiff = Math.abs(queued2[0].tournamentPoints - queued2[1].tournamentPoints);
      for (let i = 0; i < queued2.length; i++) {
        for (let j = i + 1; j < queued2.length; j++) {
          const diff = Math.abs(queued2[i].tournamentPoints - queued2[j].tournamentPoints);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestI = i;
            bestJ = j;
          }
        }
      }
      const p0 = queued2[bestI];
      const p1 = queued2[bestJ];
      queued2.splice(bestJ, 1);
      queued2.splice(bestI, 1);
      removeFromQueueList(tournamentQueue, p0.clientId);
      removeFromQueueList(tournamentQueue, p1.clientId);
      startOnlineMatch("tournament", p0, p1);
    }
    sendQueueStatuses("tournament");
    return;
  }
  const queued = pruneQueue(rankedQueue, "ranked");
  while (queued.length >= 2) {
    let bestI = 0;
    let bestJ = 1;
    let bestDiff = Math.abs(queued[0].rankedPoints - queued[1].rankedPoints);
    for (let i = 0; i < queued.length; i++) {
      for (let j = i + 1; j < queued.length; j++) {
        const diff = Math.abs(queued[i].rankedPoints - queued[j].rankedPoints);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const p0 = queued[bestI];
    const p1 = queued[bestJ];
    queued.splice(bestJ, 1);
    queued.splice(bestI, 1);
    removeFromQueueList(rankedQueue, p0.clientId);
    removeFromQueueList(rankedQueue, p1.clientId);
    startOnlineMatch("ranked", p0, p1);
  }
  sendQueueStatuses("ranked");
}
function handleClientLeaveMatch(client, matchId) {
  const targetMatchId = matchId || client.matchId;
  if (!targetMatchId) return;
  const room = activeMatches.get(targetMatchId);
  if (!room || room.finished) {
    if (client.matchId === targetMatchId) client.matchId = null;
    return;
  }
  const slot = room.clients[0].clientId === client.clientId ? 0 : room.clients[1].clientId === client.clientId ? 1 : null;
  if (slot === null) return;
  const winnerSlot = slot === 0 ? 1 : 0;
  finishMatchSeries(room, winnerSlot, "forfeit");
}
function leaveAllQueues(client) {
  const prevQueue = client.queue;
  removeFromQueueList(casualQueue, client.clientId);
  removeFromQueueList(rankedQueue, client.clientId);
  removeFromQueueList(tournamentQueue, client.clientId);
  client.queue = null;
  client.queueEnteredAt = null;
  sendToClient(client, {
    type: "queue:status",
    inQueue: null,
    position: 0,
    enteredAt: null
  });
  if (prevQueue) {
    sendQueueStatuses(prevQueue);
  }
}
function applyClientMetadata(client, parsed) {
  if (typeof parsed.accountUid === "string" && /^[a-zA-Z0-9_\-]{1,128}$/.test(parsed.accountUid)) {
    client.accountUid = parsed.accountUid;
  }
  client.displayName = sanitizeDisplayName(parsed.displayName, `Fighter-${client.clientId.slice(0, 4)}`);
  client.fighterId = sanitizeFighterId(parsed.fighterId);
  client.preferredMap = sanitizeMapSelection(parsed.preferredMap);
  client.rankedPoints = clampRankedPoints(parsed.rankedPoints);
  const schedule = getTournamentScheduleStatus();
  const incomingCycleId = typeof parsed.tournamentCycleId === "string" && /^(cycle_[0-9]+|none)$/.test(parsed.tournamentCycleId) ? parsed.tournamentCycleId : schedule.cycleId;
  if (incomingCycleId === schedule.cycleId) {
    client.tournamentCycleId = incomingCycleId;
    client.tournamentPoints = Math.max(
      client.tournamentPoints,
      clampNonNegInt(parsed.tournamentPoints, MAX_TOURNAMENT_POINTS)
    );
    client.tournamentWins = Math.max(
      client.tournamentWins,
      clampNonNegInt(parsed.tournamentWins, 1e6)
    );
    client.tournamentLosses = Math.max(
      client.tournamentLosses,
      clampNonNegInt(parsed.tournamentLosses, 1e6)
    );
    client.tournamentStreak = clampNonNegInt(parsed.tournamentStreak, 1e6);
  }
  if (schedule.isActive) {
    syncClientToTournamentLedger(client, schedule.cycleId);
  }
}
function handleClientMessage(client, raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    sendToClient(client, { type: "error", message: "Malformed JSON payload." });
    return;
  }
  if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
    return;
  }
  switch (parsed.type) {
    case "presence:enter": {
      const area = parsed.area === "casual" || parsed.area === "ranked" || parsed.area === "tournament" ? parsed.area : "none";
      applyClientMetadata(client, parsed);
      if (client.queue && client.queue !== area) {
        leaveAllQueues(client);
      }
      client.area = area;
      broadcastPresence();
      if (area === "tournament") {
        broadcastTournamentUpdate();
      }
      break;
    }
    case "queue:join": {
      if (client.matchId) {
        sendToClient(client, { type: "error", message: "Already in an active match." });
        return;
      }
      const queueType = parsed.queue === "ranked" ? "ranked" : parsed.queue === "tournament" ? "tournament" : "casual";
      applyClientMetadata(client, parsed);
      if (queueType === "tournament") {
        const schedule = getTournamentScheduleStatus();
        if (!schedule.isActive) {
          sendToClient(client, {
            type: "error",
            message: "Bi-weekly Tournament is currently closed. Tournaments run for 1 week every 2 weeks."
          });
          sendToClient(client, {
            type: "tournament:update",
            tournament: buildTournamentStateSnapshot()
          });
          return;
        }
      }
      removeFromQueueList(casualQueue, client.clientId);
      removeFromQueueList(rankedQueue, client.clientId);
      removeFromQueueList(tournamentQueue, client.clientId);
      client.area = queueType;
      client.queue = queueType;
      client.queueEnteredAt = Date.now();
      if (queueType === "casual") {
        casualQueue.push(client.clientId);
      } else if (queueType === "ranked") {
        rankedQueue.push(client.clientId);
      } else {
        tournamentQueue.push(client.clientId);
      }
      tryMatchmake(queueType);
      broadcastPresence();
      break;
    }
    case "queue:leave": {
      leaveAllQueues(client);
      broadcastPresence();
      break;
    }
    case "match:input": {
      if (!client.matchId || parsed.matchId !== client.matchId) return;
      const room = activeMatches.get(client.matchId);
      if (!room || room.finished) return;
      const slot = room.clients[0].clientId === client.clientId ? 0 : room.clients[1].clientId === client.clientId ? 1 : null;
      if (slot === null) return;
      const target = room.inputs[slot];
      const rawDir = Number(parsed.moveDir);
      target.moveDir = Number.isFinite(rawDir) ? Math.max(-1, Math.min(1, Math.round(rawDir))) : 0;
      target.jumpHeld = Boolean(parsed.jumpHeld);
      target.downHeld = Boolean(parsed.downHeld);
      const act = parsed.actions;
      if (act && typeof act === "object") {
        if (act.jump) target.queued.jump = true;
        if (act.attackCombo) target.queued.attackCombo = true;
        if (act.attack1) target.queued.attack1 = true;
        if (act.attack2) target.queued.attack2 = true;
        if (act.attack3) target.queued.attack3 = true;
        if (act.special) target.queued.special = true;
        if (act.ultimate) target.queued.ultimate = true;
        if (act.recovery) target.queued.recovery = true;
        if (act.taunt) target.queued.taunt = true;
      }
      break;
    }
    case "match:leave": {
      handleClientLeaveMatch(client, parsed.matchId);
      break;
    }
  }
}
async function startServer() {
  const app = express();
  app.use(express.json());
  app.get("/api/health", (_req, res) => {
    const snap = buildWaitingAreaSnapshot();
    const tournament = buildTournamentStateSnapshot();
    res.json({
      ok: true,
      connectedClients: clients.size,
      casualWaiting: snap.casualWaiting.length,
      rankedWaiting: snap.rankedWaiting.length,
      tournamentWaiting: snap.tournamentWaiting.length,
      casualInMatch: snap.casualInMatchCount,
      rankedInMatch: snap.rankedInMatchCount,
      tournamentInMatch: snap.tournamentInMatchCount,
      tournamentActive: tournament.isActive,
      tournamentCycleId: tournament.cycleId
    });
  });
  app.get("/api/online/status", (_req, res) => {
    res.json(buildWaitingAreaSnapshot());
  });
  app.get("/api/tournament/schedule", (_req, res) => {
    res.json(buildTournamentStateSnapshot());
  });
  if (process.env.NODE_ENV === "production") {
    const distDir = path.resolve(import.meta.dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true",
        watch: process.env.DISABLE_HMR === "true" ? null : {}
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  const server = http.createServer(app);
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 32768
  });
  wss.on("connection", (ws) => {
    const clientId = crypto.randomUUID();
    const fallbackFighter = "honey_shell";
    const schedule = getTournamentScheduleStatus();
    const client = {
      clientId,
      ws,
      isAlive: true,
      area: "none",
      queue: null,
      queueEnteredAt: null,
      matchId: null,
      displayName: `Fighter-${clientId.slice(0, 4)}`,
      fighterId: fallbackFighter in FIGHTER_SPECS ? fallbackFighter : "honey_shell",
      preferredMap: "random",
      rankedPoints: DEFAULT_RANKED_POINTS,
      tournamentPoints: 0,
      tournamentWins: 0,
      tournamentLosses: 0,
      tournamentStreak: 0,
      tournamentCycleId: schedule.cycleId,
      joinedAt: Date.now()
    };
    clients.set(clientId, client);
    sendToClient(client, {
      type: "connected",
      clientId,
      snapshot: buildWaitingAreaSnapshot(),
      tournament: buildTournamentStateSnapshot()
    });
    ws.on("pong", () => {
      client.isAlive = true;
    });
    ws.on("message", (data) => {
      const text = typeof data === "string" ? data : data.toString("utf8");
      handleClientMessage(client, text);
    });
    ws.on("close", () => {
      if (client.matchId) {
        handleClientLeaveMatch(client, client.matchId);
      }
      leaveAllQueues(client);
      clients.delete(clientId);
      broadcastPresence();
    });
    ws.on("error", () => {
      if (client.matchId) {
        handleClientLeaveMatch(client, client.matchId);
      }
      leaveAllQueues(client);
      clients.delete(clientId);
      broadcastPresence();
    });
  });
  const heartbeatInterval = setInterval(() => {
    for (const client of clients.values()) {
      if (!client.isAlive) {
        client.ws.terminate();
        continue;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch {
      }
    }
    const sched = getTournamentScheduleStatus();
    if (sched.isActive !== lastObservedTournamentActive || sched.cycleId !== lastObservedTournamentCycleId) {
      lastObservedTournamentActive = sched.isActive;
      lastObservedTournamentCycleId = sched.cycleId;
      if (!sched.isActive) {
        for (const cid of [...tournamentQueue]) {
          const queuedClient = clients.get(cid);
          if (queuedClient) {
            leaveAllQueues(queuedClient);
          }
        }
        tournamentQueue.length = 0;
        broadcastPresence();
      }
      broadcastTournamentUpdate();
    }
  }, 15e3);
  server.on("close", () => {
    clearInterval(heartbeatInterval);
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Token Wars server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start Token Wars server:", err);
  process.exit(1);
});
