import type { HudFighterSnapshot } from './types';

export type FeatCategoryId = 'damage' | 'kos' | 'combo' | 'peak_hit' | 'hits';

export interface MatchFeatComparison {
  id: FeatCategoryId;
  label: string;
  p1Value: number;
  p2Value: number;
  p1Display: string;
  p2Display: string;
  leaderSlot: 0 | 1 | 'tie';
  weight: number;
}

export interface PlayerFeatStanding {
  slot: 0 | 1;
  featsLed: number;
  significanceScore: number;
  damageSharePct: number;
  dps: number;
  avgDamagePerHit: number;
  standoutLabels: string[];
}

export interface MatchAnalysisResult {
  mvpSlot: 0 | 1;
  winnerIsMvp: boolean;
  totalFeatCategories: number;
  feats: MatchFeatComparison[];
  players: [PlayerFeatStanding, PlayerFeatStanding];
  headline: string;
  detailLine: string;
  matchDurationSec: number;
}

function resolveLeader(p1Value: number, p2Value: number): 0 | 1 | 'tie' {
  if (p1Value > p2Value) return 0;
  if (p2Value > p1Value) return 1;
  return 'tie';
}

function getSlotLabel(player: HudFighterSnapshot): string {
  if (player.slot === 0) return 'Player 1';
  return player.isAi ? 'CPU' : 'Player 2';
}

export function formatMatchDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function analyzeMatchFeats(
  p1: HudFighterSnapshot,
  p2: HudFighterSnapshot,
  winnerSlot: 0 | 1,
  matchDurationSec: number
): MatchAnalysisResult {
  const duration = Math.max(1, Math.round(matchDurationSec));
  const totalDamage = p1.damageDealt + p2.damageDealt;

  const feats: MatchFeatComparison[] = [
    {
      id: 'damage',
      label: 'Damage Dealt',
      p1Value: p1.damageDealt,
      p2Value: p2.damageDealt,
      p1Display: `${p1.damageDealt}`,
      p2Display: `${p2.damageDealt}`,
      leaderSlot: resolveLeader(p1.damageDealt, p2.damageDealt),
      weight: 3,
    },
    {
      id: 'kos',
      label: 'Total KOs',
      p1Value: p1.koCount,
      p2Value: p2.koCount,
      p1Display: `${p1.koCount}`,
      p2Display: `${p2.koCount}`,
      leaderSlot: resolveLeader(p1.koCount, p2.koCount),
      weight: 3,
    },
    {
      id: 'combo',
      label: 'Longest Combo',
      p1Value: p1.longestCombo,
      p2Value: p2.longestCombo,
      p1Display: `${p1.longestCombo}x`,
      p2Display: `${p2.longestCombo}x`,
      leaderSlot: resolveLeader(p1.longestCombo, p2.longestCombo),
      weight: 2.5,
    },
    {
      id: 'peak_hit',
      label: 'Heaviest Hit',
      p1Value: p1.peakSingleHit,
      p2Value: p2.peakSingleHit,
      p1Display: `${p1.peakSingleHit}`,
      p2Display: `${p2.peakSingleHit}`,
      leaderSlot: resolveLeader(p1.peakSingleHit, p2.peakSingleHit),
      weight: 2,
    },
    {
      id: 'hits',
      label: 'Hits Landed',
      p1Value: p1.hitsLanded,
      p2Value: p2.hitsLanded,
      p1Display: `${p1.hitsLanded}`,
      p2Display: `${p2.hitsLanded}`,
      leaderSlot: resolveLeader(p1.hitsLanded, p2.hitsLanded),
      weight: 1.5,
    },
  ];

  const buildStanding = (player: HudFighterSnapshot): PlayerFeatStanding => {
    const slot = player.slot;
    const ledFeats = feats.filter((f) => f.leaderSlot === slot);
    const featWeightSum = ledFeats.reduce((acc, f) => acc + f.weight, 0);
    const damageShareRatio = totalDamage > 0 ? player.damageDealt / totalDamage : 0.5;
    const damageSharePct = Math.round(damageShareRatio * 100);
    const dps = Number((player.damageDealt / duration).toFixed(1));
    const avgDamagePerHit =
      player.hitsLanded > 0 ? Math.round(player.damageDealt / player.hitsLanded) : 0;

    // Combine number of feat wins, weighted combat impact, and subtle match-win tiebreak
    const rawImpact =
      featWeightSum * 10 +
      damageShareRatio * 12 +
      player.koCount * 4 +
      player.longestCombo * 1.5 +
      player.peakSingleHit * 0.2 +
      (winnerSlot === slot ? 0.05 : 0);

    return {
      slot,
      featsLed: ledFeats.length,
      significanceScore: Number(rawImpact.toFixed(2)),
      damageSharePct,
      dps,
      avgDamagePerHit,
      standoutLabels: ledFeats.map((f) => f.label),
    };
  };

  const p1Standing = buildStanding(p1);
  const p2Standing = buildStanding(p2);

  let mvpSlot: 0 | 1;
  if (p1Standing.featsLed !== p2Standing.featsLed) {
    mvpSlot = p1Standing.featsLed > p2Standing.featsLed ? 0 : 1;
  } else if (p1Standing.significanceScore !== p2Standing.significanceScore) {
    mvpSlot = p1Standing.significanceScore > p2Standing.significanceScore ? 0 : 1;
  } else {
    mvpSlot = winnerSlot;
  }

  const mvpPlayer = mvpSlot === 0 ? p1 : p2;
  const mvpStanding = mvpSlot === 0 ? p1Standing : p2Standing;
  const mvpTag = getSlotLabel(mvpPlayer);
  const winnerIsMvp = mvpSlot === winnerSlot;

  let headline: string;
  if (mvpStanding.featsLed === feats.length) {
    headline = `${mvpTag} swept all ${feats.length} combat feats`;
  } else if (mvpStanding.featsLed >= 3) {
    headline = winnerIsMvp
      ? `${mvpTag} led ${mvpStanding.featsLed} of ${feats.length} combat feats`
      : `${mvpTag} led ${mvpStanding.featsLed} of ${feats.length} feats despite the loss`;
  } else if (mvpStanding.featsLed > 0) {
    headline = winnerIsMvp
      ? `${mvpTag} edged out ${mvpStanding.featsLed} standout feat${mvpStanding.featsLed === 1 ? '' : 's'}`
      : `${mvpTag} took top honors in ${mvpStanding.featsLed} feat${mvpStanding.featsLed === 1 ? '' : 's'} as runner-up`;
  } else {
    headline = `Evenly matched bout — ${mvpTag} took the decisive edge`;
  }

  const detailSegments: string[] = [];
  if (totalDamage > 0) {
    detailSegments.push(`${mvpStanding.damageSharePct}% of match damage`);
  }
  if (mvpPlayer.longestCombo > 0) {
    detailSegments.push(`${mvpPlayer.longestCombo}x peak combo`);
  }
  if (mvpPlayer.peakSingleHit > 0) {
    detailSegments.push(`${mvpPlayer.peakSingleHit} max hit`);
  }
  if (mvpStanding.dps > 0) {
    detailSegments.push(`${mvpStanding.dps} DMG/s`);
  }

  const detailLine =
    detailSegments.length > 0
      ? detailSegments.join(' · ')
      : `${mvpPlayer.koCount} KOs · ${mvpPlayer.damageDealt} total damage`;

  return {
    mvpSlot,
    winnerIsMvp,
    totalFeatCategories: feats.length,
    feats,
    players: [p1Standing, p2Standing],
    headline,
    detailLine,
    matchDurationSec: duration,
  };
}
