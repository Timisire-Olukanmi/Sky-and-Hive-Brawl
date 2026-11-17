import { FIGHTER_SPECS, MAP_SPECS, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import type {
  DestructiblePropRuntime,
  FighterEntity,
  FighterId,
  GameEngineState,
  MapSpec,
  ObstacleRuntime,
  Platform,
  ProjectileEntity,
  SlashEffect,
  ZoneEntity,
} from './types';

const INK = '#18181B';

export function renderGameFrame(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  state: GameEngineState
): void {
  const map = MAP_SPECS[state.mapId];

  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bgGrad.addColorStop(0, map.skyTop);
  bgGrad.addColorStop(0.58, map.skyMid);
  bgGrad.addColorStop(1, map.skyBottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const scale = Math.min(canvasWidth / WORLD_WIDTH, canvasHeight / WORLD_HEIGHT);
  const offsetX = (canvasWidth - WORLD_WIDTH * scale) * 0.5;
  const offsetY = (canvasHeight - WORLD_HEIGHT * scale) * 0.5;

  const shakeX =
    state.shakeIntensity > 0.2
      ? (Math.random() - 0.5) * state.shakeIntensity * 2
      : 0;
  const shakeY =
    state.shakeIntensity > 0.2
      ? (Math.random() - 0.5) * state.shakeIntensity * 2
      : 0;

  ctx.save();
  ctx.translate(offsetX + shakeX * scale, offsetY + shakeY * scale);
  ctx.scale(scale, scale);

  // 1. Background Scenery
  drawMapBackdrop(ctx, map, state.ambientTime, state.lightningFlash, state.windForceX);

  // 2. Dynamic Platforms (reads live state.platforms)
  for (const platform of state.platforms) {
    drawPlatform(ctx, platform, state.ambientTime);
  }

  // 3. Stage Obstacles behind/on platforms (lava geyser, jump pads, wind bumper, pendulum)
  for (const obs of state.obstacles) {
    drawObstacle(ctx, obs, state.ambientTime);
  }

  // 4. Ground Zones behind fighters (honey puddles)
  for (const zone of state.zones) {
    if (zone.kind === 'honey_puddle') {
      drawZoneEffect(ctx, zone, state.ambientTime);
    }
  }

  // 4.5. Map-themed Destructible Stage Props
  for (const prop of state.destructibles) {
    drawDestructible(ctx, prop, state.ambientTime);
  }

  // 5. Fighters
  for (const player of state.players) {
    if (player.stocks > 0 || player.animState === 'ko') {
      drawFighter(ctx, player, state.ambientTime);
    }
  }

  // 6. Towering Zones (Cloud Wall & Lightning Pillars)
  for (const zone of state.zones) {
    if (zone.kind !== 'honey_puddle') {
      drawZoneEffect(ctx, zone, state.ambientTime);
    }
  }

  // 7. Distinct Attack Visuals
  for (const slash of state.slashes) {
    drawSlashEffect(ctx, slash);
  }

  // 8. Projectiles
  for (const proj of state.projectiles) {
    drawProjectile(ctx, proj);
  }

  // 9. Pooled Particles
  for (const p of state.particles) {
    if (!p.active) continue;
    const t = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = p.alpha * t;
    if (p.shape === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(2, p.size * 0.14 * t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.8 - t * 0.8), 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.shape === 'spark') {
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillRect(-p.size * 1.4, -p.size * 0.35, p.size * 2.8, p.size * 0.7);
    } else if (p.shape === 'drip') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.65, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (state.lightningFlash > 0.01) {
    ctx.save();
    ctx.fillStyle = `rgba(224, 242, 254, ${Math.min(0.45, state.lightningFlash * 0.45)})`;
    ctx.fillRect(-200, -200, WORLD_WIDTH + 400, WORLD_HEIGHT + 400);
    ctx.restore();
  }

  ctx.restore();
}

function drawMapBackdrop(
  ctx: CanvasRenderingContext2D,
  map: MapSpec,
  time: number,
  lightningFlash: number,
  windForceX: number
): void {
  if (map.id === 'hive_canopy') {
    const sunGrad = ctx.createRadialGradient(640, 260, 30, 640, 320, 560);
    sunGrad.addColorStop(0, 'rgba(254, 243, 199, 0.34)');
    sunGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.14)');
    sunGrad.addColorStop(1, 'rgba(120, 53, 15, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(-100, -100, WORLD_WIDTH + 200, WORLD_HEIGHT + 200);

    ctx.fillStyle = 'rgba(41, 20, 6, 0.36)';
    for (const tx of [110, 340, 940, 1170]) {
      ctx.fillRect(tx - 24, 120, 48, WORLD_HEIGHT);
      ctx.beginPath();
      ctx.arc(tx, 140, 140, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(253, 224, 71, 0.12)';
    ctx.lineWidth = 2;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 7; col++) {
        const hx = 180 + col * 155 + (row % 2) * 77;
        const hy = 150 + row * 120;
        drawHexagon(ctx, hx, hy, 44);
      }
    }

    ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
    for (let i = 0; i < 18; i++) {
      const px = ((i * 197 + time * 18) % (WORLD_WIDTH + 80)) - 40;
      const py = 110 + ((i * 93) % 440) + Math.sin(time * 1.4 + i) * 18;
      ctx.beginPath();
      ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (map.id === 'storm_citadel') {
    const glowGrad = ctx.createRadialGradient(640, 340, 40, 640, 340, 600);
    glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
    glowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(-100, -100, WORLD_WIDTH + 200, WORLD_HEIGHT + 200);

    for (let i = 0; i < 6; i++) {
      const cx = ((i * 260 + time * (10 + (i % 3) * 5)) % (WORLD_WIDTH + 280)) - 140;
      const cy = 120 + (i % 3) * 110;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(30, 41, 59, 0.65)' : 'rgba(51, 65, 85, 0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, 55, 0, Math.PI * 2);
      ctx.arc(cx + 48, cy - 12, 46, 0, Math.PI * 2);
      ctx.arc(cx + 92, cy + 6, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    if (Math.sin(time * 0.9) > 0.96 || lightningFlash > 0.1) {
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(980, 30);
      ctx.lineTo(955, 130);
      ctx.lineTo(990, 195);
      ctx.lineTo(940, 310);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    const spires = [
      [150, 720, 210, 340, 280, 720],
      [1010, 720, 1080, 310, 1150, 720],
    ];
    for (const s of spires) {
      ctx.beginPath();
      ctx.moveTo(s[0], s[1]);
      ctx.lineTo(s[2], s[3]);
      ctx.lineTo(s[4], s[5]);
      ctx.closePath();
      ctx.fill();
    }
  } else if (map.id === 'magma_foundry') {
    // Volcanic glow & distant foundry pillars
    const magmaGlow = ctx.createLinearGradient(0, 420, 0, WORLD_HEIGHT);
    magmaGlow.addColorStop(0, 'rgba(251, 146, 60, 0)');
    magmaGlow.addColorStop(1, 'rgba(234, 88, 12, 0.5)');
    ctx.fillStyle = magmaGlow;
    ctx.fillRect(-100, 420, WORLD_WIDTH + 200, 340);

    ctx.fillStyle = 'rgba(24, 9, 6, 0.65)';
    for (const px of [120, 460, 820, 1140]) {
      ctx.fillRect(px - 22, 0, 44, WORLD_HEIGHT);
    }

    // Molten lava sea at the very bottom
    ctx.fillStyle = '#EA580C';
    ctx.fillRect(-150, WORLD_HEIGHT - 36, WORLD_WIDTH + 300, 120);
    ctx.fillStyle = '#FDBA74';
    for (let x = -40; x < WORLD_WIDTH + 60; x += 90) {
      const waveY = WORLD_HEIGHT - 34 + Math.sin(time * 3 + x * 0.05) * 4;
      ctx.beginPath();
      ctx.ellipse(x, waveY, 34, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rising embers
    ctx.fillStyle = 'rgba(253, 186, 116, 0.65)';
    for (let i = 0; i < 20; i++) {
      const ex = ((i * 157 + Math.sin(time + i) * 30) % WORLD_WIDTH);
      const ey = WORLD_HEIGHT - ((time * 70 + i * 63) % WORLD_HEIGHT);
      ctx.beginPath();
      ctx.arc(ex, ey, 2.2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (map.id === 'wind_mill_spire') {
    // Giant distant windmill tower & rotating sails
    ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.beginPath();
    ctx.moveTo(575, 720);
    ctx.lineTo(605, 310);
    ctx.lineTo(675, 310);
    ctx.lineTo(705, 720);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(640, 330);
    ctx.rotate(time * 0.45);
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.16)';
    ctx.lineWidth = 10;
    for (let b = 0; b < 4; b++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -250);
      ctx.stroke();
      ctx.fillStyle = 'rgba(45, 212, 191, 0.1)';
      ctx.fillRect(6, -240, 44, 175);
    }
    ctx.restore();

    // Active wind gust streaks when windForceX is active
    if (Math.abs(windForceX) > 20) {
      const dir = Math.sign(windForceX);
      ctx.strokeStyle = 'rgba(153, 246, 228, 0.35)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 10; i++) {
        const wy = 110 + i * 54;
        const wx = ((time * 540 * dir + i * 190) % (WORLD_WIDTH + 200) + WORLD_WIDTH + 200) % (WORLD_WIDTH + 200) - 100;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + 95 * dir, wy);
        ctx.stroke();
      }
    }
  } else if (map.id === 'eclipse_temple') {
    // Eclipse Temple: giant monochrome solar eclipse & duality horizon
    ctx.save();
    // Glowing eclipse corona
    const corona = ctx.createRadialGradient(640, 240, 82, 640, 240, 220);
    corona.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    corona.addColorStop(0.25, 'rgba(228, 228, 231, 0.28)');
    corona.addColorStop(1, 'rgba(24, 24, 27, 0)');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(640, 240, 220, 0, Math.PI * 2);
    ctx.fill();

    // Pitch black eclipse core
    ctx.fillStyle = '#09090B';
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(640, 240, 82, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Faint monochrome temple columns
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(190, 140, 36, 580);
    ctx.fillRect(1054, 140, 36, 580);
    ctx.restore();
  } else if (map.id === 'neon_skyline') {
    // Neon Skyline: cyber skyscraper silhouettes, glowing windows, distant traffic streaks
    const cityGlow = ctx.createRadialGradient(640, 520, 40, 640, 520, 650);
    cityGlow.addColorStop(0, 'rgba(34, 211, 238, 0.2)');
    cityGlow.addColorStop(0.5, 'rgba(236, 72, 153, 0.14)');
    cityGlow.addColorStop(1, 'rgba(6, 7, 26, 0)');
    ctx.fillStyle = cityGlow;
    ctx.fillRect(-100, -100, WORLD_WIDTH + 200, WORLD_HEIGHT + 200);

    const towers = [
      { x: 40, w: 120, h: 420 },
      { x: 185, w: 95, h: 350 },
      { x: 310, w: 130, h: 480 },
      { x: 480, w: 110, h: 390 },
      { x: 630, w: 125, h: 510 },
      { x: 790, w: 105, h: 410 },
      { x: 930, w: 135, h: 470 },
      { x: 1100, w: 120, h: 380 },
    ];
    for (let idx = 0; idx < towers.length; idx++) {
      const t = towers[idx];
      const topY = WORLD_HEIGHT - t.h;
      ctx.fillStyle = idx % 2 === 0 ? 'rgba(15, 23, 42, 0.85)' : 'rgba(30, 27, 75, 0.78)';
      ctx.fillRect(t.x, topY, t.w, t.h);

      // Neon rooftop strip
      ctx.fillStyle = idx % 2 === 0 ? 'rgba(34, 211, 238, 0.55)' : 'rgba(244, 63, 94, 0.5)';
      ctx.fillRect(t.x + 4, topY, t.w - 8, 4);

      // Lit window grid
      for (let wy = topY + 24; wy < WORLD_HEIGHT - 80; wy += 26) {
        for (let wx = t.x + 14; wx < t.x + t.w - 18; wx += 22) {
          if (((wx * 7 + wy * 3 + idx) % 5) !== 0) {
            ctx.fillStyle =
              (wx + wy) % 4 === 0
                ? 'rgba(34, 211, 238, 0.35)'
                : 'rgba(250, 204, 21, 0.25)';
            ctx.fillRect(wx, wy, 10, 12);
          }
        }
      }
    }

    // Distant background hover traffic streaks
    for (let i = 0; i < 6; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      const ly = 160 + i * 56;
      const lx =
        ((time * (220 + i * 35) * dir + i * 240) % (WORLD_WIDTH + 200) + WORLD_WIDTH + 200) %
          (WORLD_WIDTH + 200) -
        100;
      ctx.fillStyle = dir === 1 ? 'rgba(34, 211, 238, 0.45)' : 'rgba(244, 63, 94, 0.45)';
      ctx.fillRect(lx, ly, 36, 4);
    }
  } else if (map.id === 'frost_glacier') {
    // Aurora borealis ribbons + snow-capped glacier peaks + snowfall
    for (let band = 0; band < 3; band++) {
      ctx.strokeStyle =
        band === 0
          ? 'rgba(45, 212, 191, 0.28)'
          : band === 1
          ? 'rgba(56, 189, 248, 0.24)'
          : 'rgba(167, 139, 250, 0.2)';
      ctx.lineWidth = 28;
      ctx.beginPath();
      for (let x = -40; x <= WORLD_WIDTH + 40; x += 80) {
        const y = 110 + band * 45 + Math.sin(time * 0.9 + x * 0.006 + band) * 32;
        if (x === -40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(12, 74, 110, 0.55)';
    const peaks = [
      [0, 720, 220, 290, 460, 720],
      [340, 720, 620, 240, 900, 720],
      [780, 720, 1040, 270, 1280, 720],
    ];
    for (const pk of peaks) {
      ctx.beginPath();
      ctx.moveTo(pk[0], pk[1]);
      ctx.lineTo(pk[2], pk[3]);
      ctx.lineTo(pk[4], pk[5]);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
    for (let i = 0; i < 24; i++) {
      const sx = ((i * 173 + Math.sin(time + i) * 28) % WORLD_WIDTH + WORLD_WIDTH) % WORLD_WIDTH;
      const sy = (time * 48 + i * 57) % WORLD_HEIGHT;
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (map.id === 'cyber_factory') {
    // Rotating Giant Brass/Steel Clockwork Gears
    const gears = [
      { x: 240, y: 260, r: 120, spd: 0.35 },
      { x: 640, y: 290, r: 155, spd: -0.25 },
      { x: 1030, y: 250, r: 115, spd: 0.38 },
    ];
    for (const g of gears) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(time * g.spd);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(0, 0, g.r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
      for (let t = 0; t < 12; t++) {
        ctx.rotate((Math.PI * 2) / 12);
        ctx.fillRect(-10, -g.r - 22, 20, 24);
      }
      ctx.lineWidth = 6;
      for (let s = 0; s < 4; s++) {
        ctx.beginPath();
        ctx.moveTo(-g.r, 0);
        ctx.lineTo(g.r, 0);
        ctx.stroke();
        ctx.rotate(Math.PI / 4);
      }
      ctx.restore();
    }
  } else if (map.id === 'coral_abyss') {
    // Sunken Reef: Underwater light rays + rising bubbles + distant coral silhouettes
    for (let i = 0; i < 4; i++) {
      const rx = 180 + i * 280 + Math.sin(time * 0.5 + i) * 30;
      const rayGrad = ctx.createLinearGradient(rx, 0, rx + 80, 560);
      rayGrad.addColorStop(0, 'rgba(103, 232, 249, 0.22)');
      rayGrad.addColorStop(1, 'rgba(8, 145, 178, 0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(rx - 35, 0);
      ctx.lineTo(rx + 45, 0);
      ctx.lineTo(rx + 140, 580);
      ctx.lineTo(rx - 20, 580);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(6, 78, 109, 0.5)';
    for (const cx of [110, 320, 960, 1170]) {
      ctx.beginPath();
      ctx.roundRect(cx - 18, 360, 36, 360, 16);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(165, 243, 252, 0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const bx = ((i * 139 + Math.sin(time * 1.4 + i) * 16) % WORLD_WIDTH + WORLD_WIDTH) % WORLD_WIDTH;
      const by = WORLD_HEIGHT - ((time * 52 + i * 71) % WORLD_HEIGHT);
      ctx.beginPath();
      ctx.arc(bx, by, 3 + (i % 4), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    // Cosmic Station: starfield + ringed purple gas giant
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let i = 0; i < 36; i++) {
      const sx = (i * 197 + 41) % WORLD_WIDTH;
      const sy = (i * 89 + 29) % (WORLD_HEIGHT - 140);
      const twinkle = 0.4 + Math.abs(Math.sin(time * 2 + i)) * 0.6;
      ctx.globalAlpha = twinkle;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ringed planet
    const pGrad = ctx.createRadialGradient(930, 185, 20, 950, 200, 120);
    pGrad.addColorStop(0, '#E879F9');
    pGrad.addColorStop(0.6, '#7E22CE');
    pGrad.addColorStop(1, '#3B0764');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(950, 200, 95, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(232, 121, 249, 0.45)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(950, 205, 165, 32, -0.22, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, time: number): void {
  if (p.broken) {
    if (p.respawnTimer !== undefined && p.respawnTimer <= 1.5) {
      const pulse = 0.25 + Math.abs(Math.sin(time * 12)) * 0.45;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle =
        p.style === 'honeycomb'
          ? '#FBBF24'
          : p.style === 'cloud'
          ? '#38BDF8'
          : p.style === 'magma'
          ? '#FB923C'
          : p.style === 'windmill'
          ? '#2DD4BF'
          : p.style === 'city' || p.style === 'reef'
          ? '#22D3EE'
          : p.style === 'ice'
          ? '#7DD3FC'
          : p.style === 'conveyor'
          ? '#F59E0B'
          : p.style === 'space'
          ? '#C084FC'
          : '#FAFAFA';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.width, p.height, 8);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  ctx.save();
  if (p.shakeTimer && p.shakeTimer > 0) {
    const jx = Math.sin(time * 75) * 3.5;
    const jy = Math.cos(time * 60) * 2;
    ctx.translate(jx, jy);
  }

  if (p.style === 'solid') {
    ctx.fillStyle = '#451A03';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#290F02';
    ctx.beginPath();
    ctx.moveTo(p.x + 28, p.y + p.height - 2);
    for (let x = p.x + 60; x < p.x + p.width - 40; x += 64) {
      ctx.lineTo(x, p.y + p.height + 22 + ((x * 7) % 16));
      ctx.lineTo(x + 32, p.y + p.height - 2);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.roundRect(p.x + 2, p.y, p.width - 4, 11, [8, 8, 2, 2]);
    ctx.fill();
  } else if (p.style === 'honeycomb') {
    ctx.fillStyle = '#D97706';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FDE68A';
    ctx.fillRect(p.x + 8, p.y + 3, p.width - 16, 4);
  } else if (p.style === 'citadel') {
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(p.x + 18, p.y + p.height - 2);
    for (let x = p.x + 48; x < p.x + p.width - 30; x += 56) {
      ctx.lineTo(x, p.y + p.height + 28 + ((x * 13) % 24));
      ctx.lineTo(x + 28, p.y + p.height - 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(p.x + 4, p.y + 1, p.width - 8, 6);
  } else if (p.style === 'cloud') {
    const bob = Math.sin(time * 2 + p.x * 0.01) * 1.5;
    ctx.translate(0, bob);
    ctx.fillStyle = '#E2E8F0';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(p.x + 6, p.y + 2, p.width - 12, 6, 4);
    ctx.fill();
  } else if (p.style === 'magma') {
    ctx.fillStyle = '#292524';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FB923C';
    ctx.fillRect(p.x + 4, p.y + 1, p.width - 8, 5);
  } else if (p.style === 'windmill') {
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2DD4BF';
    ctx.fillRect(p.x + 6, p.y + 2, p.width - 12, 5);
  } else if (p.style === 'city') {
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#22D3EE';
    ctx.fillRect(p.x + 6, p.y + 2, p.width - 12, 4);
    if (!p.passThrough) {
      ctx.fillStyle = '#EC4899';
      for (let rx = p.x + 28; rx < p.x + p.width - 36; rx += 54) {
        ctx.fillRect(rx, p.y + 14, 24, 4);
      }
    }
  } else if (p.style === 'ice') {
    ctx.fillStyle = '#0284C7';
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#BAE6FD';
    ctx.fillRect(p.x + 4, p.y + 1, p.width - 8, 6);
  } else if (p.style === 'conveyor') {
    ctx.fillStyle = '#27272A';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(p.x + 4, p.y + 1, p.width - 8, 5);

    if (p.conveyorSpeed) {
      const dir = Math.sign(p.conveyorSpeed);
      const scroll = ((time * Math.abs(p.conveyorSpeed) * 0.6) % 28) * dir;
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.2;
      for (let cx = p.x + 24; cx < p.x + p.width - 24; cx += 28) {
        const ax = cx + scroll;
        if (ax < p.x + 12 || ax > p.x + p.width - 12) continue;
        ctx.beginPath();
        ctx.moveTo(ax - 6 * dir, p.y + 12);
        ctx.lineTo(ax + 4 * dir, p.y + 19);
        ctx.lineTo(ax - 6 * dir, p.y + 26);
        ctx.stroke();
      }
    }
  } else if (p.style === 'reef') {
    ctx.fillStyle = '#0E7490';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#22D3EE';
    ctx.fillRect(p.x + 6, p.y + 2, p.width - 12, 5);
  } else if (p.style === 'space') {
    ctx.fillStyle = '#1E1B4B';
    ctx.strokeStyle = '#C084FC';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E879F9';
    ctx.fillRect(p.x + 6, p.y + 2, p.width - 12, 4);
  } else {
    // Eclipse Temple split black-and-white stone platform
    ctx.fillStyle = '#27272A';
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(p.x + 2, p.y + 1, p.width * 0.5 - 2, 5);
    ctx.fillStyle = '#18181B';
    ctx.fillRect(p.x + p.width * 0.5, p.y + 1, p.width * 0.5 - 2, 5);
  }

  // Impact crater / crack scars on main indestructible stage floors
  if (!p.passThrough && p.scars && p.scars.length > 0) {
    ctx.strokeStyle = p.style === 'temple' ? '#E4E4E7' : '#09090B';
    ctx.fillStyle = 'rgba(9, 9, 11, 0.55)';
    for (const offset of p.scars) {
      const sx = p.x + offset;
      ctx.beginPath();
      ctx.ellipse(sx, p.y + 4, 15, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - 11, p.y + 3);
      ctx.lineTo(sx - 4, p.y + 13);
      ctx.lineTo(sx + 2, p.y + 19);
      ctx.moveTo(sx - 4, p.y + 13);
      ctx.lineTo(sx + 8, p.y + 16);
      ctx.moveTo(sx + 10, p.y + 4);
      ctx.lineTo(sx + 5, p.y + 11);
      ctx.stroke();
    }
  }

  // Progressive fracture cracks on destructible secondary platforms
  if (p.destructible && p.maxHp && p.hp !== undefined && p.hp < p.maxHp) {
    const ratio = p.hp / p.maxHp;
    if (ratio < 0.78) {
      ctx.strokeStyle = ratio < 0.4 ? '#EF4444' : INK;
      ctx.lineWidth = ratio < 0.4 ? 2.4 : 1.8;
      const midX = p.x + p.width * 0.5;
      ctx.beginPath();
      ctx.moveTo(midX - 24, p.y);
      ctx.lineTo(midX - 14, p.y + p.height * 0.52);
      ctx.lineTo(midX - 20, p.y + p.height);
      ctx.moveTo(midX + 18, p.y);
      ctx.lineTo(midX + 10, p.y + p.height * 0.48);
      ctx.lineTo(midX + 16, p.y + p.height);
      if (ratio < 0.4) {
        ctx.moveTo(p.x + p.width * 0.22, p.y + 2);
        ctx.lineTo(p.x + p.width * 0.28, p.y + p.height - 2);
        ctx.moveTo(p.x + p.width * 0.78, p.y + 2);
        ctx.lineTo(p.x + p.width * 0.72, p.y + p.height - 2);
        ctx.moveTo(midX - 14, p.y + p.height * 0.52);
        ctx.lineTo(midX + 10, p.y + p.height * 0.48);
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawDestructible(
  ctx: CanvasRenderingContext2D,
  d: DestructiblePropRuntime,
  time: number
): void {
  if (d.broken) {
    if (d.respawnTimer <= 1.5) {
      const pulse = 0.25 + Math.abs(Math.sin(time * 12)) * 0.45;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle =
        d.kind === 'honey_vat'
          ? '#FBBF24'
          : d.kind === 'storm_pylon'
          ? '#38BDF8'
          : d.kind === 'magma_crystal'
          ? '#FB923C'
          : d.kind === 'windmill_crate'
          ? '#2DD4BF'
          : d.kind === 'neon_beacon' || d.kind === 'coral_pod'
          ? '#22D3EE'
          : d.kind === 'frost_crystal'
          ? '#7DD3FC'
          : d.kind === 'steam_boiler'
          ? '#F59E0B'
          : d.kind === 'plasma_cell'
          ? '#C084FC'
          : '#FAFAFA';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(d.x - d.width * 0.5, d.y - d.height, d.width, d.height);
      ctx.restore();
    }
    return;
  }

  ctx.save();
  const jitterX = d.shakeTimer > 0 ? Math.sin(time * 80) * 3.2 : 0;
  ctx.translate(d.x + jitterX, d.y);

  const w = d.width;
  const h = d.height;
  const ratio = d.maxHp > 0 ? d.hp / d.maxHp : 1;

  if (d.kind === 'honey_vat') {
    // Barrel / Venom Honey Vat
    ctx.fillStyle = '#92400E';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-w * 0.5, -h + 6, w, h - 6, 10);
    ctx.fill();
    ctx.stroke();

    // Metal hoops
    ctx.fillStyle = '#475569';
    ctx.fillRect(-w * 0.48, -h + 16, w * 0.96, 5);
    ctx.fillRect(-w * 0.48, -14, w * 0.96, 5);

    // Bubbling purple/gold toxic honey top
    ctx.fillStyle = '#A855F7';
    ctx.beginPath();
    ctx.ellipse(0, -h + 7, w * 0.44, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.ellipse(-4, -h + 6, w * 0.24, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (d.kind === 'storm_pylon') {
    // Grounded Storm Coil Pylon
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-w * 0.48, -14, w * 0.96, 14, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(-9, -h + 14, 18, h - 26, 4);
    ctx.fill();
    ctx.stroke();

    // Copper rings
    ctx.fillStyle = '#0EA5E9';
    ctx.fillRect(-13, -h + 24, 26, 5);
    ctx.fillRect(-13, -h + 36, 26, 5);

    // Crackling Top Orb
    const orbPulse = 0.85 + Math.sin(time * 9) * 0.15;
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(0, -h + 10, 11 * orbPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.arc(-3, -h + 7, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (d.kind === 'magma_crystal') {
    // Basalt base + glowing molten shards
    ctx.fillStyle = '#292524';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-w * 0.48, -12, w * 0.96, 12, 4);
    ctx.fill();
    ctx.stroke();

    const glow = 0.8 + Math.sin(time * 6) * 0.2;
    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.moveTo(-14, -10);
    ctx.lineTo(-18, -h * 0.65);
    ctx.lineTo(-6, -h * 0.78);
    ctx.lineTo(0, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FB923C';
    ctx.beginPath();
    ctx.moveTo(-7, -10);
    ctx.lineTo(0, -h);
    ctx.lineTo(10, -h * 0.72);
    ctx.lineTo(8, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = `rgba(254, 240, 138, ${glow})`;
    ctx.beginPath();
    ctx.moveTo(-2, -14);
    ctx.lineTo(0, -h * 0.72);
    ctx.lineTo(4, -14);
    ctx.closePath();
    ctx.fill();
  } else if (d.kind === 'windmill_crate') {
    // Timber Sky-Gale Crate
    ctx.fillStyle = '#78350F';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-w * 0.5, -h, w, h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, -h + 6);
    ctx.lineTo(w * 0.38, -6);
    ctx.moveTo(w * 0.38, -h + 6);
    ctx.lineTo(-w * 0.38, -6);
    ctx.stroke();

    // Glowing teal wind rune core
    ctx.fillStyle = '#2DD4BF';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -h * 0.5, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (d.kind === 'neon_beacon') {
    // Cyber City Holo-Bollard Beacon
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-w * 0.42, -h + 12, w * 0.84, h - 12, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#EC4899';
    ctx.fillRect(-w * 0.28, -h + 18, w * 0.56, 8);
    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.arc(0, -h + 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (d.kind === 'frost_crystal') {
    // Faceted Glacial Crystal Spire
    ctx.fillStyle = '#0284C7';
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, 0);
    ctx.lineTo(-w * 0.25, -h * 0.7);
    ctx.lineTo(0, -h);
    ctx.lineTo(w * 0.28, -h * 0.65);
    ctx.lineTo(w * 0.45, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(0, -h + 8);
    ctx.lineTo(7, -h * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (d.kind === 'steam_boiler') {
    // Brass & Copper Pressurized Steam Tank
    ctx.fillStyle = '#9A3412';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-w * 0.45, -h + 8, w * 0.9, h - 8, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-w * 0.43, -h * 0.55, w * 0.86, 8);
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(0, -h * 0.72, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (d.kind === 'coral_pod') {
    // Glowing Bioluminescent Coral Pod
    ctx.fillStyle = '#0E7490';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.42, w * 0.46, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.arc(-6, -h * 0.52, 5.5, 0, Math.PI * 2);
    ctx.arc(7, -h * 0.36, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (d.kind === 'plasma_cell') {
    // Sci-Fi Violet Plasma Battery Pod
    ctx.fillStyle = '#1E1B4B';
    ctx.strokeStyle = '#C084FC';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-w * 0.42, -h + 6, w * 0.84, h - 6, 8);
    ctx.fill();
    ctx.stroke();

    const pulse = 0.75 + Math.sin(time * 8) * 0.25;
    ctx.fillStyle = `rgba(232, 121, 249, ${pulse})`;
    ctx.fillRect(-w * 0.24, -h + 16, w * 0.48, h - 28);
  } else {
    // Eclipse Duality Urn
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-w * 0.42, -h + 10, w * 0.84, h - 10, 12);
    ctx.fill();
    ctx.stroke();

    // Split left white face
    ctx.fillStyle = '#FAFAFA';
    ctx.beginPath();
    ctx.roundRect(-w * 0.4, -h + 12, w * 0.4, h - 14, [10, 0, 0, 10]);
    ctx.fill();

    // Urn collar rim
    ctx.fillStyle = '#52525B';
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-w * 0.3, -h, w * 0.6, 11, 4);
    ctx.fill();
    ctx.stroke();
  }

  // Damage cracks on prop
  if (ratio < 0.85) {
    ctx.strokeStyle = ratio < 0.45 ? '#FEF08A' : INK;
    ctx.lineWidth = ratio < 0.45 ? 2.4 : 1.8;
    ctx.beginPath();
    ctx.moveTo(-w * 0.25, -h * 0.72);
    ctx.lineTo(2, -h * 0.48);
    ctx.lineTo(-6, -h * 0.25);
    if (ratio < 0.45) {
      ctx.moveTo(w * 0.28, -h * 0.65);
      ctx.lineTo(2, -h * 0.48);
      ctx.lineTo(w * 0.22, -h * 0.2);
    }
    ctx.stroke();
  }

  // White hit flash
  if (d.hitFlashTimer > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.roundRect(-w * 0.5, -h, w, h, 8);
    ctx.fill();
  }

  ctx.restore();
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: ObstacleRuntime, time: number): void {
  ctx.save();
  if (obs.kind === 'lava_geyser') {
    if (obs.state === 'telegraph') {
      // Glowing warning column before eruption
      const pulse = 0.25 + Math.abs(Math.sin(time * 16)) * 0.35;
      ctx.fillStyle = `rgba(251, 146, 60, ${pulse})`;
      ctx.fillRect(obs.x - obs.width * 0.5, obs.y - 260, obs.width, 260);
      ctx.strokeStyle = '#FDBA74';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(obs.x - obs.width * 0.5, obs.y - 260, obs.width, 260);
    } else if (obs.state === 'active') {
      const h = obs.currentHeight;
      const gGrad = ctx.createLinearGradient(0, obs.y - h, 0, obs.y);
      gGrad.addColorStop(0, '#FEF08A');
      gGrad.addColorStop(0.5, '#FB923C');
      gGrad.addColorStop(1, '#DC2626');
      ctx.fillStyle = gGrad;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(obs.x - obs.width * 0.5, obs.y - h, obs.width, h, 24);
      ctx.fill();
      ctx.stroke();
    }
  } else if (obs.kind === 'wind_bumper') {
    const r = obs.radius ?? 36;
    ctx.translate(obs.currentX, obs.currentY);
    ctx.rotate(obs.angle);

    // Outer bumper ring
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#2DD4BF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Spinning turbine fins
    ctx.fillStyle = '#99F6E4';
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.roundRect(-5, -r + 5, 10, r - 8, 4);
      ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (obs.kind === 'jump_pad') {
    // Glowing Eclipse Spring Rune Pad
    const glow = 0.65 + Math.sin(time * 6) * 0.25;
    ctx.fillStyle = '#FAFAFA';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(obs.x - obs.width * 0.5, obs.y - obs.height, obs.width, obs.height, 6);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${glow})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(obs.x - 14, obs.y - obs.height - 6);
    ctx.lineTo(obs.x, obs.y - obs.height - 16);
    ctx.lineTo(obs.x + 14, obs.y - obs.height - 6);
    ctx.stroke();
  } else if (obs.kind === 'eclipse_pendulum') {
    const r = obs.radius ?? 28;
    // Anchor chain
    ctx.strokeStyle = '#A1A1AA';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y);
    ctx.lineTo(obs.currentX, obs.currentY);
    ctx.stroke();

    ctx.fillStyle = '#FAFAFA';
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, 7, 0, Math.PI * 2);
    ctx.fill();

    // Split black-and-white swinging blade orb
    ctx.translate(obs.currentX, obs.currentY);
    ctx.rotate(time * 5);
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FAFAFA';
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (obs.kind === 'hive_swarm') {
    const r = obs.radius ?? 34;
    ctx.translate(obs.currentX, obs.currentY);

    // Buzzing danger aura
    ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // 5 orbiting buzzing hornets
    for (let i = 0; i < 5; i++) {
      const ang = time * (4.2 + (i % 2) * 1.1) + (i * Math.PI * 2) / 5;
      const dist = (i === 0 ? 4 : r * 0.54) + Math.sin(time * 9 + i) * 4;
      const hx = Math.cos(ang) * dist;
      const hy = Math.sin(ang * 1.2) * (dist * 0.72);
      const wingFlap = Math.sin(time * 42 + i * 2) * 4;

      ctx.save();
      ctx.translate(hx, hy);
      // Wings
      ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
      ctx.beginPath();
      ctx.ellipse(-2, -6 + wingFlap * 0.4, 5, 3, -0.4, 0, Math.PI * 2);
      ctx.ellipse(2, -6 - wingFlap * 0.4, 5, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Striped body
      ctx.fillStyle = '#FBBF24';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#18181B';
      ctx.fillRect(-3, -4, 3, 8);
      ctx.fillRect(2, -3.5, 2.5, 7);
      ctx.restore();
    }
  } else if (obs.kind === 'lightning_arc') {
    if (obs.state === 'telegraph') {
      const pulse = 0.22 + Math.abs(Math.sin(time * 18)) * 0.36;
      ctx.fillStyle = `rgba(56, 189, 248, ${pulse * 0.45})`;
      ctx.fillRect(obs.x - obs.width * 0.45, 24, obs.width * 0.9, obs.y - 24);
      ctx.strokeStyle = '#7DD3FC';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 7]);
      ctx.strokeRect(obs.x - obs.width * 0.45, 24, obs.width * 0.9, obs.y - 24);
      ctx.setLineDash([]);

      // Sky charge node
      ctx.fillStyle = '#E0F2FE';
      ctx.beginPath();
      ctx.arc(obs.x, 38, 12 + Math.sin(time * 24) * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.state === 'active') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
      ctx.fillRect(obs.x - obs.width * 0.5, 20, obs.width, obs.y - 20);

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(obs.x, 20);
      for (let ly = 70; ly < obs.y; ly += 52) {
        ctx.lineTo(obs.x + Math.sin(time * 48 + ly) * 16, ly);
      }
      ctx.lineTo(obs.x, obs.y);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Ground impact arc
      ctx.fillStyle = '#E0F2FE';
      ctx.beginPath();
      ctx.ellipse(obs.x, obs.y - 2, obs.width * 0.55, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (obs.kind === 'icicle_drop') {
    const w = obs.width;
    const h = obs.height;
    if (obs.state === 'telegraph') {
      const pulse = 0.22 + Math.abs(Math.sin(time * 15)) * 0.3;
      ctx.strokeStyle = `rgba(125, 211, 252, ${pulse + 0.25})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(obs.x, 86);
      ctx.lineTo(obs.x, obs.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Trembling ceiling icicle
      const jitter = Math.sin(time * 42) * 3;
      ctx.fillStyle = '#BAE6FD';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(obs.x - w * 0.45 + jitter, 42);
      ctx.lineTo(obs.x + w * 0.45 + jitter, 42);
      ctx.lineTo(obs.x + jitter, 42 + h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (obs.state === 'active') {
      const cx = obs.currentX;
      const tipY = obs.currentY;
      const g = ctx.createLinearGradient(cx, tipY - h, cx, tipY);
      g.addColorStop(0, '#0284C7');
      g.addColorStop(0.55, '#7DD3FC');
      g.addColorStop(1, '#FFFFFF');
      ctx.fillStyle = g;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.48, tipY - h);
      ctx.lineTo(cx + w * 0.48, tipY - h);
      ctx.lineTo(cx, tipY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (obs.kind === 'crusher_piston') {
    const w = obs.width;
    const h = obs.height;
    const blockY = obs.currentY;

    // Ground danger zone telegraph
    if (obs.state === 'telegraph' || obs.state === 'active') {
      const pulse = obs.state === 'telegraph' ? 0.35 + Math.abs(Math.sin(time * 16)) * 0.35 : 0.45;
      ctx.fillStyle = `rgba(245, 158, 11, ${pulse * 0.35})`;
      ctx.fillRect(obs.x - w * 0.5, obs.y - 10, w, 10);
    }

    // Hydraulic support shaft from ceiling
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillRect(obs.x - 16, 0, 32, Math.max(0, blockY - h));
    ctx.strokeRect(obs.x - 16, 0, 32, Math.max(0, blockY - h));

    // Piston block body
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(obs.x - w * 0.5, blockY - h, w, h, 8);
    ctx.fill();
    ctx.stroke();

    // Hazard warning stripes along bottom edge
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(obs.x - w * 0.46, blockY - 14, w * 0.92, 10);
    ctx.fillStyle = '#18181B';
    for (let sx = -w * 0.42; sx < w * 0.42; sx += 24) {
      ctx.fillRect(obs.x + sx, blockY - 14, 10, 10);
    }

    // Warning beacon light
    ctx.fillStyle = obs.state === 'telegraph' ? '#EF4444' : obs.state === 'active' ? '#FDE047' : '#64748B';
    ctx.beginPath();
    ctx.arc(obs.x, blockY - h * 0.58, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (obs.kind === 'whirlpool_vortex') {
    const r = obs.radius ?? 44;
    ctx.translate(obs.currentX, obs.currentY);

    if (obs.state === 'idle') {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const isAct = obs.state === 'active';
      const spin = time * (isAct ? 7.5 : 3.2);
      const outerR = isAct ? r * 1.15 : r * 0.9;

      ctx.fillStyle = isAct ? 'rgba(6, 182, 212, 0.34)' : 'rgba(56, 189, 248, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, outerR, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(spin);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.strokeStyle = isAct ? '#E0F2FE' : '#67E8F9';
        ctx.lineWidth = isAct ? 4 : 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, outerR * 0.78, 0, Math.PI * 0.42);
        ctx.stroke();
      }
      ctx.fillStyle = isAct ? '#FFFFFF' : '#22D3EE';
      ctx.beginPath();
      ctx.arc(0, 0, isAct ? 12 : 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (obs.kind === 'laser_sweeper') {
    const len = obs.height ?? 480;
    const endX = obs.x + Math.sin(obs.angle) * len;
    const endY = obs.y + Math.cos(obs.angle) * len;

    // Ceiling laser beam
    if (obs.state === 'telegraph') {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (obs.state === 'active') {
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)';
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 10;
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // Ceiling orbital turret housing
    ctx.fillStyle = '#1E1B4B';
    ctx.strokeStyle = '#C084FC';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = obs.state === 'active' ? '#F43F5E' : '#FDE047';
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (obs.kind === 'hover_car') {
    const dir = obs.direction ?? 1;
    const isCyan = dir === 1;
    const mainColor = isCyan ? '#22D3EE' : '#EC4899';
    const trimColor = isCyan ? '#FDE047' : '#A855F7';

    if (obs.state === 'telegraph') {
      const pulse = 0.22 + Math.abs(Math.sin(time * 16)) * 0.38;
      ctx.fillStyle = isCyan
        ? `rgba(34, 211, 238, ${pulse * 0.45})`
        : `rgba(236, 72, 153, ${pulse * 0.45})`;
      ctx.fillRect(0, obs.y - obs.height * 0.5, WORLD_WIDTH, obs.height);

      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(0, obs.y);
      ctx.lineTo(WORLD_WIDTH, obs.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Directional traffic chevrons
      ctx.lineWidth = 3;
      const slide = ((time * 160) % 90) * dir;
      for (let cx = 80; cx < WORLD_WIDTH - 40; cx += 90) {
        const ax = cx + slide;
        ctx.beginPath();
        ctx.moveTo(ax - 8 * dir, obs.y - 9);
        ctx.lineTo(ax + 6 * dir, obs.y);
        ctx.lineTo(ax - 8 * dir, obs.y + 9);
        ctx.stroke();
      }
    } else if (obs.state === 'active') {
      const w = obs.width;
      const h = obs.height;
      ctx.translate(obs.currentX, obs.currentY);
      ctx.scale(dir, 1);

      // Headlight beam cone
      const beam = ctx.createLinearGradient(w * 0.42, 0, w * 1.45, 0);
      beam.addColorStop(0, isCyan ? 'rgba(254, 240, 138, 0.55)' : 'rgba(244, 114, 182, 0.55)');
      beam.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(w * 0.42, -5);
      ctx.lineTo(w * 1.45, -20);
      ctx.lineTo(w * 1.45, 18);
      ctx.lineTo(w * 0.42, 6);
      ctx.closePath();
      ctx.fill();

      // Rear twin plasma thruster flames
      ctx.fillStyle = trimColor;
      ctx.beginPath();
      ctx.moveTo(-w * 0.48, -6);
      ctx.lineTo(-w * 0.78 - Math.sin(time * 40) * 8, 0);
      ctx.lineTo(-w * 0.48, 6);
      ctx.closePath();
      ctx.fill();

      // Aerodynamic hover car chassis
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-w * 0.48, h * 0.35);
      ctx.lineTo(-w * 0.42, -h * 0.35);
      ctx.lineTo(w * 0.15, -h * 0.45);
      ctx.lineTo(w * 0.5, 0);
      ctx.lineTo(w * 0.44, h * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing neon canopy
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.moveTo(-w * 0.14, -h * 0.32);
      ctx.lineTo(w * 0.12, -h * 0.36);
      ctx.lineTo(w * 0.28, -2);
      ctx.lineTo(-w * 0.2, -2);
      ctx.closePath();
      ctx.fill();

      // Hover anti-grav pads under chassis
      ctx.fillStyle = trimColor;
      ctx.beginPath();
      ctx.ellipse(-w * 0.24, h * 0.44, 14, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(w * 0.22, h * 0.44, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawZoneEffect(ctx: CanvasRenderingContext2D, z: ZoneEntity, time: number): void {
  const fade = Math.min(1, z.life / Math.min(0.35, z.maxLife));
  ctx.save();
  ctx.globalAlpha = fade;

  if (z.kind === 'cloud_wall') {
    const h = z.height;
    const w = z.width;
    const topY = z.y - h;

    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.ellipse(z.x, z.y, w * 0.72, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    const steps = Math.max(2, Math.ceil(h / 42));
    for (let i = 0; i < steps; i++) {
      const py = z.y - 20 - (i / Math.max(1, steps - 1)) * Math.max(0, h - 42);
      const sway = Math.sin(time * 9 + i * 1.3) * 4;
      const r = w * 0.48 + (i % 2) * 5;

      ctx.fillStyle = i % 2 === 0 ? '#F8FAFC' : '#E0F2FE';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(z.x + sway, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#BAE6FD';
      ctx.beginPath();
      ctx.arc(z.x - r * 0.35 + sway, py + 4, r * 0.52, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(z.x - 10, z.y - 12);
    ctx.lineTo(z.x + 12, topY + h * 0.65);
    ctx.lineTo(z.x - 14, topY + h * 0.35);
    ctx.lineTo(z.x + 8, topY + 14);
    ctx.stroke();
  } else if (z.kind === 'honey_puddle') {
    ctx.fillStyle = '#A855F7';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(z.x, z.y - 2, z.width * 0.52, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.ellipse(z.x, z.y - 3, z.width * 0.38, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 4; i++) {
      const bx = z.x + Math.sin(time * 3 + i * 2.1) * (z.width * 0.32);
      const cycle = (time * 1.8 + i * 0.27) % 1;
      const by = z.y - 6 - cycle * 24;
      ctx.fillStyle = i % 2 === 0 ? '#D8B4FE' : '#FDE047';
      ctx.beginPath();
      ctx.arc(bx, by, 3.5 * (1 - cycle * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (z.kind === 'lightning_pillar') {
    const topY = z.y - z.height;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.fillRect(z.x - z.width * 0.5, topY, z.width, z.height);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(z.x, topY);
    for (let y = topY + 60; y < z.y; y += 65) {
      const jitter = Math.sin(time * 45 + y) * 18;
      ctx.lineTo(z.x + jitter, y);
    }
    ctx.lineTo(z.x, z.y);
    ctx.stroke();

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 12;
    ctx.globalAlpha = fade * 0.5;
    ctx.stroke();
  } else if (z.kind === 'glitch_field') {
    const topY = z.y - z.height;
    const leftX = z.x - z.width * 0.5;
    ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
    ctx.strokeStyle = Math.floor(time * 20) % 2 === 0 ? '#10B981' : '#F43F5E';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(leftX, topY, z.width, z.height, 14);
    ctx.fill();
    ctx.stroke();

    // Scanlines & glitch blocks
    for (let sy = topY + 12; sy < z.y - 8; sy += 16) {
      ctx.fillStyle = sy % 32 === 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.2)';
      const jitter = Math.sin(time * 32 + sy) * 8;
      ctx.fillRect(leftX + 8 + Math.max(0, jitter), sy, z.width - 16 - Math.abs(jitter), 3);
    }
    for (let g = 0; g < 6; g++) {
      const gx = leftX + 20 + ((g * 47 + Math.floor(time * 14) * 31) % Math.max(20, z.width - 40));
      const gy = topY + 18 + ((g * 29 + Math.floor(time * 18) * 19) % Math.max(20, z.height - 36));
      ctx.fillStyle = g % 2 === 0 ? '#10B981' : '#F43F5E';
      ctx.fillRect(gx, gy, 14, 8);
    }
  } else if (z.kind === 'whirlpool_zone') {
    const cy = z.y - z.height * 0.5;
    const rMax = Math.min(z.width, z.height) * 0.5;
    const aboutToPop = z.life < 0.35;

    ctx.translate(z.x, cy);
    ctx.fillStyle = aboutToPop ? 'rgba(244, 114, 182, 0.28)' : 'rgba(6, 182, 212, 0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, rMax, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(-time * 5.8);
    for (let arm = 0; arm < 4; arm++) {
      ctx.rotate(Math.PI * 0.5);
      ctx.strokeStyle = arm % 2 === 0 ? '#06B6D4' : '#F472B6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let t = 0.2; t <= 1; t += 0.15) {
        const ang = t * Math.PI * 1.4;
        const rr = rMax * (1 - t * 0.85);
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        if (t <= 0.25) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = aboutToPop ? '#FEF08A' : '#CFFAFE';
    ctx.lineWidth = aboutToPop ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, rMax * (aboutToPop ? 1.04 : 0.94), 0, Math.PI * 2);
    ctx.stroke();
  } else if (z.kind === 'railgun_beam') {
    const angle = z.angle ?? 0;
    const len = z.width;
    const telegraph = z.telegraphTimer ?? 0;
    ctx.translate(z.x, z.y);
    ctx.rotate(angle);

    if (telegraph > 0) {
      const pulse = 0.45 + Math.abs(Math.sin(time * 28)) * 0.5;
      ctx.strokeStyle = `rgba(244, 63, 94, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // Muzzle charge ring
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 14 + pulse * 10, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const thickness = z.height * fade;
      ctx.fillStyle = 'rgba(129, 140, 248, 0.32)';
      ctx.fillRect(0, -thickness * 0.85, len, thickness * 1.7);
      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(0, -thickness * 0.42, len, thickness * 0.84);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, -thickness * 0.2, len, thickness * 0.4);
    }
  } else if (z.kind === 'cross_slash') {
    const cy = z.y - z.height * 0.5;
    ctx.translate(z.x, cy);
    ctx.rotate(z.angle ?? 0);

    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 4 * fade;
    ctx.beginPath();
    ctx.ellipse(0, 0, z.width * 0.5, Math.max(10, 24 * fade), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5 * fade;
    ctx.beginPath();
    ctx.moveTo(-z.width * 0.48, 0);
    ctx.lineTo(z.width * 0.48, 0);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFighter(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  ctx.save();

  if (f.invulnTimer > 0 && Math.floor(f.invulnTimer * 18) % 2 === 0) {
    ctx.globalAlpha = 0.55;
  }

  if (f.grounded) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 2, f.width * 0.44, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (f.slowTimer > 0 && f.grounded) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 1, f.width * 0.48, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tagLabel = f.slot === 0 ? 'P1' : f.isAi ? 'CPU' : 'P2';
  const tagColor = f.slot === 0 ? '#FBBF24' : '#38BDF8';
  ctx.save();
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = tagColor;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.lineWidth = 3;
  ctx.strokeText(tagLabel, f.x, f.y - f.height - 26);
  ctx.fillText(tagLabel, f.x, f.y - f.height - 26);
  ctx.restore();

  if (f.animState === 'victory') {
    const specColor = FIGHTER_SPECS[f.id].accentColor;
    const pulse = 0.85 + Math.sin(time * 5) * 0.15;
    ctx.save();
    const beamGrad = ctx.createLinearGradient(f.x, f.y - 260, f.x, f.y + 8);
    beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    beamGrad.addColorStop(0.55, `${specColor}22`);
    beamGrad.addColorStop(1, `${specColor}55`);
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(f.x - 32, f.y - 260);
    ctx.lineTo(f.x + 32, f.y - 260);
    ctx.lineTo(f.x + 56 * pulse, f.y + 4);
    ctx.lineTo(f.x - 56 * pulse, f.y + 4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = specColor;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 2, f.width * 0.62 * pulse, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (f.animState === 'taunt') {
    const p = f.animDuration > 0 ? Math.min(1, f.animTimer / f.animDuration) : 0;
    const specColor = FIGHTER_SPECS[f.id].accentColor;

    ctx.save();
    ctx.strokeStyle = specColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = Math.sin(p * Math.PI) * 0.75;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 1, f.width * (0.45 + p * 0.25), 7, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (p >= 0.34) {
      const pop = Math.min(1, (p - 0.34) / 0.66);
      ctx.globalAlpha = 1 - pop * 0.65;
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FBBF24';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = 3;
      const floatY = f.y - f.height - 42 - pop * 18;
      ctx.strokeText('ULT +9%', f.x, floatY);
      ctx.fillText('ULT +9%', f.x, floatY);
    }
    ctx.restore();
  }

  ctx.translate(f.x, f.y);
  const stunWobble = f.stunTimer > 0 ? Math.sin(time * 28) * 3 : 0;
  ctx.translate(stunWobble, 0);
  ctx.scale(f.facing * f.squashX, f.squashY);

  if (f.animState === 'hitstun') {
    ctx.rotate(-0.22);
  } else if (f.animState === 'stunned') {
    ctx.rotate(Math.sin(time * 12) * 0.1);
  } else if (f.animState === 'run') {
    ctx.rotate(0.08);
  }

  drawFighterRigById(ctx, f, time);

  if (f.poisonTimer > 0 && Math.sin(time * 10) > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(168, 85, 247, 0.35)';
    ctx.fillRect(-100, -140, 200, 160);
  }

  if (f.hitFlashTimer > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fillRect(-100, -140, 200, 160);
  }

  ctx.restore();

  if (f.stunTimer > 0) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const ang = time * 6.5 + (i * Math.PI * 2) / 3;
      const sx = f.x + Math.cos(ang) * 26;
      const sy = f.y - f.height - 8 + Math.sin(ang) * 7;
      ctx.fillStyle = i % 2 === 0 ? '#FACC15' : '#38BDF8';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  if (f.confuseTimer > 0) {
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const ang = -time * 5.2 + i * Math.PI;
      const cx = f.x + Math.cos(ang) * 28;
      const cy = f.y - f.height - 14 + Math.sin(ang) * 6;
      ctx.fillStyle = i === 0 ? '#10B981' : '#F43F5E';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.rect(cx - 4.5, cy - 4.5, 9, 9);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  if (f.counterTimer > 0) {
    ctx.save();
    const cy = f.y - f.height * 0.5;
    const pulse = 0.85 + Math.sin(time * 24) * 0.15;
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(f.x, cy, f.width * 0.68 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(f.x, cy, f.width * 0.78, time * 5, time * 5 + Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (f.shieldTimer > 0) {
    ctx.save();
    const cy = f.y - f.height * 0.5;
    const r = Math.max(f.width, f.height) * 0.66;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
    ctx.strokeStyle = '#A3E635';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(f.x, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(163, 230, 53, 0.65)';
    ctx.lineWidth = 2;
    drawHexagon(ctx, f.x, cy, r * 0.82);
    ctx.restore();
  }

  if (f.speedBoostTimer > 0) {
    ctx.save();
    const cy = f.y - f.height * 0.5;
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.75)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(f.x, cy, f.width * 0.68, f.height * 0.58, time * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawHoneyShellRig(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  const p = f.animDuration > 0 ? Math.min(1, f.animTimer / f.animDuration) : 0;
  const idleBob = f.animState === 'idle' ? Math.sin(time * 4.5 + f.slot) * 2.5 : 0;
  const runBob = f.animState === 'run' ? Math.abs(Math.sin(time * 14)) * 5 : 0;

  let bodyY = -idleBob - runBob;
  let wingBackAngle = Math.sin(time * 5.2) * 0.08;
  let wingFrontAngle = -Math.sin(time * 5.2) * 0.08;
  let wingFrontReachX = 0;
  let wingFrontReachY = 0;

  if (f.animState === 'jump' || f.animState === 'recovery') {
    const flap = f.animState === 'recovery' ? Math.sin(time * 32) * 0.55 : -0.45;
    wingBackAngle = flap;
    wingFrontAngle = -flap;
  } else if (f.animState === 'fall') {
    wingBackAngle = 0.35;
    wingFrontAngle = 0.35;
  } else if (f.animState === 'attack1') {
    const thrust = Math.sin(p * Math.PI);
    wingFrontReachX = thrust * 32;
    wingFrontAngle = -0.55 * thrust;
  } else if (f.animState === 'attack2') {
    const drill = Math.sin(p * Math.PI);
    bodyY -= 6 * drill;
    wingFrontReachX = 24 * drill;
    wingBackAngle = 0.55 * drill;
  } else if (f.animState === 'attack3') {
    const slam = p < 0.35 ? -p * 1.4 : Math.sin(Math.min(1, (p - 0.35) / 0.65) * Math.PI);
    bodyY += p < 0.35 ? -16 : 6;
    wingFrontReachY = slam * 18;
    wingFrontReachX = slam * 16;
  } else if (f.animState === 'special') {
    const recoil = Math.sin(p * Math.PI);
    bodyY -= recoil * 14;
    wingFrontAngle = -1.1 * recoil;
    wingBackAngle = 1.1 * recoil;
  } else if (f.animState === 'ultimate') {
    bodyY -= 12 + Math.sin(time * 25) * 3;
    wingFrontAngle = -0.7 + Math.sin(time * 30) * 0.4;
    wingBackAngle = 0.7 - Math.sin(time * 30) * 0.4;
  } else if (f.animState === 'taunt') {
    const wiggle = Math.sin(p * Math.PI * 5);
    bodyY -= Math.abs(wiggle) * 7;
    wingFrontAngle = -0.75 + Math.sin(p * Math.PI * 8) * 0.38;
    wingBackAngle = 0.75 - Math.sin(p * Math.PI * 8) * 0.38;
    wingFrontReachX = wiggle * 4;
  } else if (f.animState === 'victory') {
    const cheer = Math.abs(Math.sin(f.animTimer * 6.5));
    bodyY -= cheer * 11;
    wingFrontAngle = -1.05 + Math.sin(f.animTimer * 9) * 0.16;
    wingBackAngle = 1.05 - Math.sin(f.animTimer * 9) * 0.16;
    wingFrontReachY = -8;
  }

  ctx.save();
  ctx.translate(0, bodyY);
  if (f.animState === 'taunt') {
    ctx.rotate(Math.sin(p * Math.PI * 4) * 0.14);
  }

  ctx.save();
  ctx.translate(-24, -52);
  ctx.rotate(wingBackAngle);
  drawHoneyWing(ctx, -1);
  ctx.restore();

  ctx.fillStyle = '#94A3B8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-30, -18);
  ctx.lineTo(-22, 0);
  ctx.lineTo(-12, -10);
  ctx.lineTo(-2, 2);
  ctx.lineTo(10, -10);
  ctx.lineTo(20, 0);
  ctx.lineTo(30, -18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(-24, -17);
  ctx.lineTo(-17, -6);
  ctx.lineTo(-8, -17);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#B45309';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-27, -44, 54, 27, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FEF3C7';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-9, -34, 8, 6, 0.12, 0, Math.PI * 2);
  ctx.ellipse(11, -34, 8, 6, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (f.animState === 'victory') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(-8, -33, 3.6, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, -33, 3.6, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else if (f.animState === 'taunt') {
    ctx.fillStyle = '#18181B';
    ctx.beginPath();
    ctx.arc(-7, -34, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(12, -33, 3.5, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else {
    ctx.fillStyle = f.animState === 'ultimate' ? '#A855F7' : '#18181B';
    ctx.beginPath();
    ctx.arc(-7, -34, 2.7, 0, Math.PI * 2);
    ctx.arc(13, -34, 2.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#FBBF24';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-29, -42);
  ctx.quadraticCurveTo(-18, -33, -10, -41);
  ctx.quadraticCurveTo(0, -32, 10, -41);
  ctx.quadraticCurveTo(20, -33, 29, -42);
  ctx.lineTo(27, -48);
  ctx.lineTo(-27, -48);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.roundRect(-30, -64, 60, 20, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#451A03';
  ctx.beginPath();
  ctx.arc(3, -47, 10, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.roundRect(-23, -78, 46, 16, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FCD34D';
  ctx.beginPath();
  ctx.roundRect(-15, -90, 30, 14, 7);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.translate(22 + wingFrontReachX, -52 + wingFrontReachY);
  ctx.rotate(wingFrontAngle);
  drawHoneyWing(ctx, 1);
  ctx.restore();

  ctx.restore();
}

function drawHoneyWing(ctx: CanvasRenderingContext2D, dir: 1 | -1): void {
  ctx.save();
  ctx.scale(dir, 1);
  ctx.fillStyle = '#FBBF24';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.quadraticCurveTo(18, -14, 22, 4);
  ctx.lineTo(22, 24);
  ctx.arc(17, 24, 4, 0, Math.PI);
  ctx.lineTo(13, 14);
  ctx.lineTo(11, 27);
  ctx.arc(7, 27, 4, 0, Math.PI);
  ctx.lineTo(3, 15);
  ctx.lineTo(1, 24);
  ctx.arc(-3, 24, 4, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FEF3C7';
  ctx.beginPath();
  ctx.ellipse(9, 2, 3, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCloudierRig(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  const p = f.animDuration > 0 ? Math.min(1, f.animTimer / f.animDuration) : 0;
  const breathe = f.animState === 'idle' ? Math.sin(time * 4 + f.slot) * 2 : 0;
  const runCycle = f.animState === 'run' ? Math.sin(time * 15) : 0;

  let bodyY = -breathe - Math.abs(runCycle) * 4;
  let frontArmX = 24;
  let frontArmY = -56;
  let frontArmRot = 0;
  let backArmX = -26;
  let backArmY = -56;
  let backArmRot = 0;
  const showBoulderInHand = f.animState === 'idle' || f.animState === 'attack1';

  if (f.animState === 'run') {
    frontArmRot = runCycle * 0.45;
    backArmRot = -runCycle * 0.45;
  } else if (f.animState === 'jump' || f.animState === 'recovery') {
    frontArmRot = -0.8;
    backArmRot = 0.8;
  } else if (f.animState === 'attack1') {
    const punch = Math.sin(p * Math.PI);
    frontArmX += punch * 30;
    frontArmY -= punch * 6;
    frontArmRot = -0.35 * punch;
  } else if (f.animState === 'attack2') {
    const clap = Math.sin(p * Math.PI);
    frontArmX = 26 - clap * 14;
    backArmX = -26 + clap * 14;
    frontArmY = -66;
    backArmY = -66;
    frontArmRot = -1.1 * clap;
    backArmRot = 1.1 * clap;
  } else if (f.animState === 'attack3') {
    const slam = p < 0.4 ? -p * 2 : Math.sin(Math.min(1, (p - 0.4) / 0.6) * Math.PI);
    bodyY += p < 0.4 ? -16 : 8;
    frontArmRot = -0.7 * slam;
    backArmRot = 0.7 * slam;
  } else if (f.animState === 'special') {
    const lift = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
    frontArmX += 14 * lift;
    frontArmY -= 24 * lift;
    frontArmRot = -1.4 * lift;
    backArmRot = 0.5 * lift;
  } else if (f.animState === 'ultimate') {
    bodyY -= 16;
    frontArmRot = -1.3 + Math.sin(time * 24) * 0.25;
    backArmRot = 1.3 - Math.sin(time * 24) * 0.25;
  } else if (f.animState === 'taunt') {
    const beckon = Math.sin(p * Math.PI * 4);
    bodyY -= Math.abs(Math.sin(p * Math.PI * 2)) * 5;
    backArmY = -66;
    backArmRot = 2.1;
    frontArmX = 28;
    frontArmY = -62;
    frontArmRot = -1.15 + beckon * 0.42;
  } else if (f.animState === 'victory') {
    const flexPulse = Math.sin(f.animTimer * 5.5);
    bodyY -= Math.abs(flexPulse) * 6;
    frontArmY = -66;
    backArmY = -66;
    frontArmRot = -2.2 + flexPulse * 0.12;
    backArmRot = 2.2 - flexPulse * 0.12;
  }

  ctx.save();
  ctx.translate(0, bodyY);

  ctx.save();
  ctx.translate(backArmX, backArmY);
  ctx.rotate(backArmRot);
  drawMuscularCloudArm(ctx, -1, false);
  ctx.restore();

  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  const legStride = f.animState === 'run' ? runCycle * 10 : 0;

  ctx.beginPath();
  ctx.roundRect(-18 + legStride, -24, 15, 24, 6);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(4 - legStride, -24, 15, 24, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(-24, -64, 48, 44, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#E0F2FE';
  ctx.beginPath();
  ctx.roundRect(-21, -36, 42, 13, 6);
  ctx.fill();

  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, -54);
  ctx.lineTo(0, -30);
  ctx.moveTo(-8, -48);
  ctx.lineTo(8, -48);
  ctx.moveTo(-8, -40);
  ctx.lineTo(8, -40);
  ctx.moveTo(-7, -33);
  ctx.lineTo(7, -33);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, -76, 18, 0, Math.PI * 2);
  ctx.arc(-13, -72, 12, 0, Math.PI * 2);
  ctx.arc(13, -72, 12, 0, Math.PI * 2);
  ctx.arc(-7, -86, 11, 0, Math.PI * 2);
  ctx.arc(8, -86, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, -76, 22, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(244, 114, 182, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-12, -71, 4.5, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(12, -71, 4.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  if (f.stunTimer > 0) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -80);
    ctx.lineTo(-3, -74);
    ctx.moveTo(-3, -80);
    ctx.lineTo(-9, -74);
    ctx.moveTo(4, -80);
    ctx.lineTo(10, -74);
    ctx.moveTo(10, -80);
    ctx.lineTo(4, -74);
    ctx.stroke();
  } else if (f.animState === 'victory') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(-6, -75, 4, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(7, -75, 4, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else if (f.animState === 'taunt') {
    ctx.beginPath();
    ctx.ellipse(-6, -77, 2.8, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(7, -75, 4, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(-6, -77, 2.8, 5.2, 0, 0, Math.PI * 2);
    ctx.ellipse(7, -77, 2.8, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-2.5, -70, 2.8, 0.1, Math.PI - 0.1);
  ctx.arc(3, -70, 2.8, 0.1, Math.PI - 0.1);
  ctx.stroke();

  ctx.save();
  ctx.translate(frontArmX, frontArmY);
  ctx.rotate(frontArmRot);
  drawMuscularCloudArm(ctx, 1, showBoulderInHand);
  ctx.restore();

  ctx.restore();
}

function drawMuscularCloudArm(
  ctx: CanvasRenderingContext2D,
  dir: 1 | -1,
  withBoulder: boolean
): void {
  ctx.save();
  ctx.scale(dir, 1);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;

  ctx.beginPath();
  ctx.arc(2, -4, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(8, 11, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F1F5F9';
  ctx.beginPath();
  ctx.roundRect(0, 18, 19, 17, 5);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(6, 26);
  ctx.lineTo(6, 35);
  ctx.moveTo(12, 26);
  ctx.lineTo(12, 35);
  ctx.stroke();

  if (withBoulder) {
    ctx.fillStyle = '#78716C';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(1, 31, 20, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#44403C';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(3, 39);
    ctx.lineTo(19, 39);
    ctx.moveTo(11, 32);
    ctx.lineTo(11, 46);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEveRig(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  // Faithful to uploaded sketch: monochrome split white/black silhouette + twin companion orbs + giant blade charge
  const p = f.animDuration > 0 ? Math.min(1, f.animTimer / f.animDuration) : 0;
  const hover = Math.sin(time * 5.5 + f.slot) * 3;
  const runLean = f.animState === 'run' ? 0.14 : 0;

  let bodyY = -hover;
  let orbOrbitOffset = 0;

  if (f.animState === 'attack1') {
    bodyY -= Math.sin(p * Math.PI) * 4;
  } else if (f.animState === 'attack2') {
    orbOrbitOffset = p * Math.PI * 2;
  } else if (f.animState === 'special') {
    // Long windup telegraph before giant slash (0 -> 0.56)
    if (p < 0.56) {
      bodyY -= (p / 0.56) * 12;
    } else {
      bodyY += 6;
    }
  } else if (f.animState === 'recovery' || f.animState === 'ultimate') {
    bodyY -= 12;
  } else if (f.animState === 'taunt') {
    bodyY -= 8 + Math.sin(p * Math.PI) * 5;
    orbOrbitOffset = p * Math.PI * 4;
  } else if (f.animState === 'victory') {
    bodyY -= 14 + Math.sin(f.animTimer * 4) * 4;
    orbOrbitOffset = f.animTimer * 3.2;
  }

  ctx.save();
  ctx.translate(0, bodyY);
  ctx.rotate(runLean);

  // Twin Companion Orbs (White arch spirit + Dark shadow pot orb from sketch)
  const isOrbOrbit = f.animState === 'attack2' || f.animState === 'taunt' || f.animState === 'victory';
  const orbitRx = f.animState === 'victory' ? 46 : f.animState === 'taunt' ? 42 : 58;
  const orbitRy = f.animState === 'victory' ? 18 : f.animState === 'taunt' ? 22 : 26;
  const orbitCy = f.animState === 'victory' ? -64 : f.animState === 'taunt' ? -56 : -44;
  const whiteOrbX = isOrbOrbit ? Math.cos(orbOrbitOffset) * orbitRx : -34;
  const whiteOrbY = isOrbOrbit
    ? orbitCy + Math.sin(orbOrbitOffset) * orbitRy
    : -26 + Math.sin(time * 4) * 4;
  const darkOrbX = isOrbOrbit ? Math.cos(orbOrbitOffset + Math.PI) * orbitRx : 34;
  const darkOrbY = isOrbOrbit
    ? orbitCy + Math.sin(orbOrbitOffset + Math.PI) * orbitRy
    : -42 + Math.cos(time * 4) * 4;

  // White companion spirit orb
  ctx.fillStyle = '#FAFAFA';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(whiteOrbX, whiteOrbY, 9, Math.PI, 0);
  ctx.lineTo(whiteOrbX + 9, whiteOrbY + 7);
  ctx.lineTo(whiteOrbX - 9, whiteOrbY + 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(whiteOrbX + 1, whiteOrbY - 1, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Dark companion urn orb
  ctx.fillStyle = '#18181B';
  ctx.strokeStyle = '#FAFAFA';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(darkOrbX, darkOrbY, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FAFAFA';
  ctx.beginPath();
  ctx.arc(darkOrbX + 3, darkOrbY - 2, 2, 0, Math.PI * 2);
  ctx.fill();

  // Split Monochrome Cloak / Body (Left White Striped, Right Deep Black)
  // Left white wing/robe
  ctx.fillStyle = '#FAFAFA';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-2, -64);
  ctx.lineTo(-24, -12);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-2, -64);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Stripe detail on white cloak side
  ctx.strokeStyle = '#52525B';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-12, -26);
  ctx.lineTo(-10, -8);
  ctx.moveTo(-18, -18);
  ctx.lineTo(-16, -8);
  ctx.stroke();

  // Right black cloak side
  ctx.fillStyle = '#18181B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-2, -64);
  ctx.lineTo(22, -10);
  ctx.lineTo(2, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // White inner highlight on black side
  ctx.fillStyle = '#E4E4E7';
  ctx.beginPath();
  ctx.moveTo(4, -30);
  ctx.lineTo(10, -10);
  ctx.lineTo(3, -10);
  ctx.closePath();
  ctx.fill();

  // Split Black & White Hooded Head (matching Eve's yin-yang head)
  ctx.save();
  ctx.translate(0, -72);

  // Left half white
  ctx.fillStyle = '#FAFAFA';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 14, Math.PI * 0.5, Math.PI * 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right half black
  ctx.fillStyle = '#18181B';
  ctx.beginPath();
  ctx.arc(0, 0, 14, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sharp glowing contrasting eyes
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-5, -1, 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FAFAFA';
  ctx.beginPath();
  ctx.arc(6, -1, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Telegraph giant monochrome blade charging behind Eve during slow Special windup!
  if (f.animState === 'special' && p < 0.58) {
    const chargeRatio = p / 0.56;
    ctx.save();
    ctx.translate(-12, -56);
    ctx.rotate(-1.25 + chargeRatio * 0.35);

    // Charging glint ring
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * (1.2 - chargeRatio * 0.6), 0, Math.PI * 2);
    ctx.stroke();

    // Giant monochrome greatsword blade raised overhead
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(95 * (0.5 + 0.5 * chargeRatio), -18);
    ctx.lineTo(118 * (0.5 + 0.5 * chargeRatio), 0);
    ctx.lineTo(95 * (0.5 + 0.5 * chargeRatio), 18);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (f.animState === 'victory') {
    // Victory monochrome Eclipse Blade planted triumphantly at Eve's side
    ctx.save();
    ctx.translate(22, -16);
    ctx.rotate(-1.38);
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(74, -12);
    ctx.lineTo(92, 0);
    ctx.lineTo(74, 12);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawSpidraRig(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  const p = f.animDuration > 0 ? Math.min(1, f.animTimer / f.animDuration) : 0;
  const idleBob = f.animState === 'idle' ? Math.sin(time * 7 + f.slot) * 2.5 : 0;
  const scuttle = f.animState === 'run' ? Math.sin(time * 28) : Math.sin(time * 5) * 0.15;

  let bodyY = -idleBob;
  let headTilt = 0;
  let frontLegReach = 0;

  if (f.animState === 'run') {
    bodyY -= Math.abs(scuttle) * 4;
    headTilt = 0.12;
  } else if (f.animState === 'jump' || f.animState === 'recovery') {
    bodyY -= 6;
  } else if (f.animState === 'attack1') {
    frontLegReach = Math.sin(p * Math.PI) * 26;
  } else if (f.animState === 'attack2') {
    headTilt = Math.sin(p * Math.PI * 2) * 0.25;
  } else if (f.animState === 'attack3') {
    headTilt = 0.26 * Math.sin(p * Math.PI);
    bodyY -= Math.sin(p * Math.PI) * 8;
  } else if (f.animState === 'special' || f.animState === 'ultimate') {
    headTilt = -0.14;
    bodyY -= 4;
  } else if (f.animState === 'taunt') {
    bodyY -= Math.abs(Math.sin(p * Math.PI * 4)) * 6;
    headTilt = Math.sin(p * Math.PI * 3) * 0.16;
  } else if (f.animState === 'victory') {
    bodyY -= 6 + Math.abs(Math.sin(f.animTimer * 8.5)) * 7;
    headTilt = Math.sin(f.animTimer * 5) * 0.13;
  }

  ctx.save();
  ctx.translate(0, bodyY);

  // 4 Articulated Spider Legs (2 back, 2 front) springing from thorax below TV monitor
  const legBases = [
    { bx: -14, dir: -1, phase: 0, reach: 0 },
    { bx: -6, dir: -1, phase: Math.PI, reach: 0 },
    { bx: 8, dir: 1, phase: Math.PI * 0.5, reach: frontLegReach * 0.6 },
    { bx: 16, dir: 1, phase: Math.PI * 1.5, reach: frontLegReach },
  ];

  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let idx = 0; idx < legBases.length; idx++) {
    const leg = legBases[idx];
    const isVictoryFront = f.animState === 'victory' && idx >= 2;
    const isTauntFront = f.animState === 'taunt' && idx === 3;
    const stride =
      f.animState === 'run'
        ? Math.sin(time * 28 + leg.phase) * 11
        : f.animState === 'victory'
        ? Math.sin(f.animTimer * 10 + leg.phase) * 5
        : f.animState === 'taunt'
        ? Math.sin(p * Math.PI * 6 + leg.phase) * 4
        : Math.sin(time * 4 + leg.phase) * 2;
    const lift = f.animState === 'run' ? Math.max(0, -Math.cos(time * 28 + leg.phase)) * 10 : 0;
    const kneeX = leg.bx + leg.dir * (22 + leg.reach * 0.5) + stride * 0.4;
    const kneeY = isVictoryFront
      ? -56 - Math.sin(f.animTimer * 9 + idx) * 6
      : isTauntFront
      ? -52
      : -44 - lift;
    const footX = leg.bx + leg.dir * (30 + leg.reach) + stride;
    const footY = isVictoryFront
      ? -68 - Math.sin(f.animTimer * 9 + idx) * 8
      : isTauntFront
      ? -62 + Math.sin(p * Math.PI * 6) * 8
      : f.grounded
      ? -lift
      : -6 - lift * 0.5;

    ctx.lineWidth = 7;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(leg.bx, -26);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    ctx.lineWidth = 3.2;
    ctx.strokeStyle = '#10B981';
    ctx.beginPath();
    ctx.moveTo(leg.bx, -26);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
  }

  // Compact Mechanical Spider Thorax
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(0, -26, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Retro CRT TV Monitor Head
  ctx.save();
  ctx.translate(0, -56);
  ctx.rotate(headTilt);

  // Twin V-Antennas on top of TV
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-6, -24);
  ctx.lineTo(-18, -42);
  ctx.moveTo(6, -24);
  ctx.lineTo(18, -42);
  ctx.stroke();

  ctx.fillStyle = '#F43F5E';
  ctx.beginPath();
  ctx.arc(-18, -42, 3.5, 0, Math.PI * 2);
  ctx.arc(18, -42, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Outer TV Chassis
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-29, -24, 58, 46, 8);
  ctx.fill();
  ctx.stroke();

  // Inner CRT Screen
  const isBlaring = f.animState === 'special' || f.animState === 'ultimate';
  ctx.fillStyle = isBlaring ? '#064E3B' : '#09090B';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-23, -18, 38, 34, 5);
  ctx.fill();
  ctx.stroke();

  // Side Dials / Knobs on right bezel
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.arc(21, -8, 3.2, 0, Math.PI * 2);
  ctx.arc(21, 3, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Expressive TV Screen Display
  if (f.animState === 'victory') {
    // Celebratory ^ ◡ ^ CRT arcade victory face + star glint
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-15, -3);
    ctx.lineTo(-11, -9);
    ctx.lineTo(-7, -3);
    ctx.moveTo(-1, -3);
    ctx.lineTo(3, -9);
    ctx.lineTo(7, -3);
    ctx.stroke();

    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(-4, 3, 7, 0.1, Math.PI - 0.1);
    ctx.stroke();

    ctx.fillStyle = Math.floor(f.animTimer * 8) % 2 === 0 ? '#FBBF24' : '#10B981';
    ctx.fillRect(-20, -15, 4, 4);
    ctx.fillRect(8, -15, 4, 4);
  } else if (f.animState === 'taunt') {
    // Mischievous > ◡ • CRT glitch-wink taunt face
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-15, -9);
    ctx.lineTo(-9, -5);
    ctx.lineTo(-15, -1);
    ctx.stroke();

    ctx.fillStyle = '#F43F5E';
    ctx.beginPath();
    ctx.arc(4, -5, 3.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(-4, 3, 6.5, 0.1, Math.PI - 0.1);
    ctx.stroke();
  } else if (isBlaring) {
    // Swirling hypno-static rings during TV Blare
    ctx.strokeStyle = Math.floor(time * 24) % 2 === 0 ? '#10B981' : '#F43F5E';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(-4, -1, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-4, -1, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (f.stunTimer > 0 || f.hitstunTimer > 0) {
    // Static snow lines when hit
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, -7);
    ctx.lineTo(10, -7);
    ctx.moveTo(-15, 2);
    ctx.lineTo(8, 2);
    ctx.stroke();
  } else {
    // Glowing neon emerald spider-eyes + cheeky grin on CRT screen
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(-11, -5, 3.5, 0, Math.PI * 2);
    ctx.arc(3, -5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F43F5E';
    ctx.beginPath();
    ctx.arc(-14, -12, 2, 0, Math.PI * 2);
    ctx.arc(6, -12, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(-4, 2, 6, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

function drawMarshalBoltRig(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  const p = f.animDuration > 0 ? Math.min(1, f.animTimer / f.animDuration) : 0;
  const idleBob = f.animState === 'idle' ? Math.sin(time * 4.4 + f.slot) * 2 : 0;
  const stride = f.animState === 'run' ? Math.sin(time * 16) : 0;

  let bodyY = -idleBob - (f.animState === 'run' ? Math.abs(stride) * 4 : 0);
  let hatTilt = 0;
  let armAngle = 0.25;
  let armReach = 0;
  let kickOut = 0;

  if (f.animState === 'attack1') {
    const s = Math.sin(p * Math.PI);
    armAngle = -0.35 * s;
    armReach = s * 22;
  } else if (f.animState === 'attack2') {
    armAngle = -0.8 + Math.sin(p * Math.PI * 2) * 0.9;
    armReach = 16;
  } else if (f.animState === 'attack3') {
    const k = Math.sin(p * Math.PI);
    kickOut = k * 24;
    bodyY -= k * 8;
    hatTilt = -0.1 * k;
  } else if (f.animState === 'special') {
    const recoil = Math.sin(p * Math.PI);
    armAngle = -0.15;
    armReach = 14 - recoil * 6;
    hatTilt = -0.12 * recoil;
  } else if (f.animState === 'ultimate') {
    bodyY -= 12;
    armAngle = -0.9;
    hatTilt = -0.08;
  } else if (f.animState === 'taunt') {
    const tip = Math.sin(p * Math.PI);
    hatTilt = 0.22 * tip;
    armAngle = -1.35 * tip;
  } else if (f.animState === 'victory') {
    const tip = Math.sin(f.animTimer * 3.5) * 0.14;
    bodyY -= Math.abs(Math.sin(f.animTimer * 5)) * 6;
    hatTilt = -0.12 + tip;
    armAngle = -1.4 + Math.sin(f.animTimer * 6) * 0.15;
  }

  ctx.save();
  ctx.translate(0, bodyY);

  // Legs & Hydraulic Cowboy Boots with Gear Spurs
  const legs = [
    { ox: -10 - stride * 9, oy: 0 },
    { ox: 10 + stride * 9 + kickOut, oy: -kickOut * 0.45 },
  ];
  for (let i = 0; i < legs.length; i++) {
    const lx = legs[i].ox;
    const ly = legs[i].oy;
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(lx - 6, -26 + ly, 12, 16, 4);
    ctx.fill();
    ctx.stroke();

    // Cowboy Boot
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(lx - 7, -12 + ly, 18, 12, 4);
    ctx.fill();
    ctx.stroke();

    // Spinning Gold Gear Spur on heel
    ctx.save();
    ctx.translate(lx - 8, -5 + ly);
    ctx.rotate(time * 5 + i);
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (f.animState === 'recovery' || f.animState === 'jump') {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(lx - 4, 0 + ly);
      ctx.lineTo(lx + 4, 0 + ly);
      ctx.lineTo(lx, 12 + Math.sin(time * 35) * 4 + ly);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Cobalt Police Chassis Torso
  ctx.fillStyle = '#1E3A8A';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.roundRect(-22, -60, 44, 38, 8);
  ctx.fill();
  ctx.stroke();

  // Steel Shoulder Armor Trim
  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.roundRect(-25, -60, 50, 10, 5);
  ctx.fill();
  ctx.stroke();

  // Utility Holster Belt & Gold Buckle
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(-21, -30, 42, 7);
  ctx.fillStyle = '#FBBF24';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.fillRect(-6, -31, 12, 9);
  ctx.strokeRect(-6, -31, 12, 9);

  // Gold 5-Point Sheriff Star Badge on Chest
  ctx.save();
  ctx.translate(7, -43);
  ctx.fillStyle = '#FBBF24';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? 7.5 : 3.4;
    const ang = -Math.PI * 0.5 + (k * Math.PI) / 5;
    const sx = Math.cos(ang) * r;
    const sy = Math.sin(ang) * r;
    if (k === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Robot Head + Cowboy Hat + Flashing Police Siren
  ctx.save();
  ctx.translate(0, -73);
  ctx.rotate(hatTilt);

  // Metallic Head Visor
  ctx.fillStyle = '#94A3B8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(-15, -13, 30, 24, 7);
  ctx.fill();
  ctx.stroke();

  // Dark Visor Band & Glowing LED Eyes
  ctx.fillStyle = '#09090B';
  ctx.beginPath();
  ctx.roundRect(-11, -8, 24, 11, 3);
  ctx.fill();

  ctx.fillStyle = f.animState === 'victory' ? '#FBBF24' : '#38BDF8';
  if (f.animState === 'victory') {
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-4, -2, 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, -2, 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-4, -2.5, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -2.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Police Siren Beacon (Red/Blue flashing dome above Stetson!)
  const redFlash = Math.floor(time * 9) % 2 === 0;
  ctx.fillStyle = redFlash ? '#F43F5E' : '#3B82F6';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, -28, 5.5, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Stetson Cowboy Hat Crown & Brim
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-15, -26, 30, 14, 5);
  ctx.fill();
  ctx.stroke();

  // Gold Hatband
  ctx.fillStyle = '#FBBF24';
  ctx.fillRect(-14, -16, 28, 4);

  // Sweeping Cowboy Hat Brim
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(-28, -11);
  ctx.quadraticCurveTo(0, -16, 29, -11);
  ctx.quadraticCurveTo(0, -7, -28, -11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Articulated Right Arm + Laser Sidearm
  ctx.save();
  ctx.translate(14 + armReach, -48);
  ctx.rotate(armAngle);
  ctx.fillStyle = '#64748B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-4, -5, 22, 10, 4);
  ctx.fill();
  ctx.stroke();

  // Cyber Revolver / Arc Blaster
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.roundRect(14, -6, 15, 7, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(24, -4, 5, 3);
  ctx.restore();

  ctx.restore();
}

function drawFighterRigById(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  switch (f.id) {
    case 'honey_shell':
      drawHoneyShellRig(ctx, f, time);
      break;
    case 'cloudier':
      drawCloudierRig(ctx, f, time);
      break;
    case 'eve':
      drawEveRig(ctx, f, time);
      break;
    case 'spidra':
      drawSpidraRig(ctx, f, time);
      break;
    case 'marshal_bolt':
      drawMarshalBoltRig(ctx, f, time);
      break;
    case 'pyro_jack':
      drawPyroJackRig(ctx, f, time);
      break;
    case 'aqua_nyx':
      drawAquaNyxRig(ctx, f, time);
      break;
    case 'blade_zero':
      drawBladeZeroRig(ctx, f, time);
      break;
    case 'moss_golem':
      drawMossGolemRig(ctx, f, time);
      break;
    case 'astro_pip':
      drawAstroPipRig(ctx, f, time);
      break;
  }
}

function drawPyroJackRig(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  const p = f.animDuration > 0 ? Math.min(1, f.animTimer / f.animDuration) : 0;
  const idleBob = f.animState === 'idle' ? Math.sin(time * 4.2 + f.slot) * 2.5 : 0;
  const stride = f.animState === 'run' ? Math.sin(time * 14) : 0;

  let bodyY = -idleBob;
  let armAngle = 0.2;
  let punchOffset = 0;
  let headTilt = 0;

  if (f.animState === 'attack1') {
    const s = Math.sin(p * Math.PI);
    armAngle = -1.2 * s;
    punchOffset = s * 18;
  } else if (f.animState === 'attack2') {
    const s = Math.sin(p * Math.PI);
    armAngle = -0.25 * s;
    punchOffset = s * 24;
  } else if (f.animState === 'attack3') {
    const s = Math.sin(p * Math.PI);
    bodyY -= s * 16;
    armAngle = 0.6 * s;
    punchOffset = s * 20;
  } else if (f.animState === 'special') {
    armAngle = -0.9 + Math.sin(p * Math.PI) * 0.8;
    punchOffset = 14;
  } else if (f.animState === 'ultimate') {
    bodyY -= 12;
    armAngle = -1.3;
  } else if (f.animState === 'taunt') {
    headTilt = Math.sin(p * Math.PI * 2) * 0.2;
    armAngle = -1.1 * Math.sin(p * Math.PI);
  } else if (f.animState === 'victory') {
    bodyY -= Math.abs(Math.sin(f.animTimer * 4.8)) * 7;
    armAngle = -1.35 + Math.sin(f.animTimer * 5) * 0.16;
    headTilt = Math.sin(f.animTimer * 3) * 0.1;
  }

  ctx.save();
  ctx.translate(0, bodyY);

  // Heavy Iron Furnace Boots
  const legs = [-11 - stride * 9, 11 + stride * 9];
  for (const lx of legs) {
    ctx.fillStyle = '#292524';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(lx - 8, -22, 16, 22, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F97316';
    ctx.fillRect(lx - 5, -9, 10, 4);
  }

  // Cast-Iron Furnace Torso
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.roundRect(-24, -60, 48, 42, 10);
  ctx.fill();
  ctx.stroke();

  // Glowing Furnace Core Grate
  ctx.fillStyle = '#EA580C';
  ctx.beginPath();
  ctx.roundRect(-13, -52, 26, 20, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(-10, -47, 20, 4);
  ctx.fillRect(-10, -39, 20, 4);

  // Pumpkin Jack-O-Lantern Head + Crown Flame
  ctx.save();
  ctx.translate(0, -76);
  ctx.rotate(headTilt);

  // Dancing Flame Crown
  const flicker = Math.sin(time * 24) * 3;
  ctx.fillStyle = '#F97316';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, -12);
  ctx.quadraticCurveTo(-8, -32 + flicker, 0, -36 - flicker);
  ctx.quadraticCurveTo(9, -30 + flicker, 12, -12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.moveTo(-6, -12);
  ctx.quadraticCurveTo(0, -28 - flicker * 0.6, 6, -12);
  ctx.closePath();
  ctx.fill();

  // Pumpkin Head
  ctx.fillStyle = '#F97316';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, 21, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Carved Glowing Eyes & Grin
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.moveTo(-10, -4);
  ctx.lineTo(-3, -7);
  ctx.lineTo(-4, 0);
  ctx.closePath();
  ctx.moveTo(4, -7);
  ctx.lineTo(11, -4);
  ctx.lineTo(5, 0);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 4, 9, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.fill();
  ctx.restore();

  // Fiery Gauntlet Fist
  ctx.save();
  ctx.translate(16 + punchOffset, -44);
  ctx.rotate(armAngle);
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-5, -8, 22, 16, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(14, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawAquaNyxRig(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  const p = f.animDuration > 0 ? Math.min(1, f.animTimer / f.animDuration) : 0;
  const hover = Math.sin(time * 4.5 + f.slot) * 4;
  let bodyY = -hover - 6;
  let bellSquish = 1 + Math.sin(time * 4.5) * 0.05;
  let tentacleReach = 0;

  if (f.animState === 'attack1') {
    tentacleReach = Math.sin(p * Math.PI) * 24;
  } else if (f.animState === 'attack2') {
    bellSquish = 1.15;
    tentacleReach = 12;
  } else if (f.animState === 'attack3') {
    bodyY -= Math.sin(p * Math.PI) * 14;
    tentacleReach = Math.sin(p * Math.PI) * 20;
  } else if (f.animState === 'special') {
    bellSquish = 0.88 + Math.sin(p * Math.PI) * 0.2;
  } else if (f.animState === 'ultimate') {
    bodyY -= 16;
    bellSquish = 1.22;
  } else if (f.animState === 'taunt') {
    bodyY -= Math.sin(p * Math.PI * 2) * 8;
  } else if (f.animState === 'victory') {
    bodyY -= Math.sin(f.animTimer * 3.8) * 9 + 4;
    bellSquish = 1 + Math.sin(f.animTimer * 5) * 0.09;
  }

  ctx.save();
  ctx.translate(0, bodyY);

  // Flowing Bioluminescent Tentacles
  for (let i = -2; i <= 2; i++) {
    const wave = Math.sin(time * 6 + i * 1.1) * 6;
    const baseX = i * 8;
    const reach = i > 0 ? tentacleReach : 0;
    ctx.strokeStyle = i % 2 === 0 ? '#06B6D4' : '#F472B6';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(baseX, -38);
    ctx.quadraticCurveTo(baseX + wave + reach * 0.5, -18, baseX - wave * 0.6 + reach, 2);
    ctx.stroke();

    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // Luminous Pearl Core Torso
  ctx.fillStyle = '#0E7490';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(0, -48, 17, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Translucent Glowing Jellyfish Bell Cap
  ctx.save();
  ctx.translate(0, -64);
  ctx.scale(bellSquish, 2 - bellSquish);
  const bellGrad = ctx.createRadialGradient(-4, -12, 4, 0, -6, 30);
  bellGrad.addColorStop(0, '#CFFAFE');
  bellGrad.addColorStop(0.55, '#06B6D4');
  bellGrad.addColorStop(1, '#EC4899');
  ctx.fillStyle = bellGrad;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.arc(0, 0, 26, Math.PI, 0);
  ctx.quadraticCurveTo(0, 8, -26, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Bioluminescent Spots
  ctx.fillStyle = '#FDF2F8';
  ctx.beginPath();
  ctx.arc(-9, -12, 3.5, 0, Math.PI * 2);
  ctx.arc(8, -14, 3, 0, Math.PI * 2);
  ctx.arc(0, -19, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Cute Glowing Eyes
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(-6, -50, 3.2, 0, Math.PI * 2);
  ctx.arc(7, -50, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBladeZeroRig(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  const p = f.animDuration > 0 ? Math.min(1, f.animTimer / f.animDuration) : 0;
  const idleBob = f.animState === 'idle' ? Math.sin(time * 5 + f.slot) * 2 : 0;
  const stride = f.animState === 'run' ? Math.sin(time * 18) : 0;

  let bodyY = -idleBob - (f.animState === 'run' ? Math.abs(stride) * 4 : 0);
  let bladeAngle = -0.35;
  let slashReach = 0;

  if (f.animState === 'attack1') {
    const s = Math.sin(p * Math.PI);
    bladeAngle = -1.4 + s * 2.1;
    slashReach = s * 16;
  } else if (f.animState === 'attack2') {
    const s = Math.sin(p * Math.PI);
    bladeAngle = 1.2 - s * 2.5;
    slashReach = s * 20;
  } else if (f.animState === 'attack3') {
    const s = Math.sin(p * Math.PI);
    bladeAngle = -0.1;
    slashReach = s * 26;
    bodyY -= s * 8;
  } else if (f.animState === 'special') {
    bladeAngle = -1.0 + Math.sin(p * Math.PI) * 1.4;
    slashReach = 12;
  } else if (f.animState === 'ultimate') {
    bladeAngle = p * Math.PI * 6;
    bodyY -= 12;
  } else if (f.animState === 'taunt') {
    bladeAngle = -1.45 * Math.sin(p * Math.PI);
  } else if (f.animState === 'victory') {
    bodyY -= Math.abs(Math.sin(f.animTimer * 4)) * 5;
    bladeAngle = -1.35 + Math.sin(f.animTimer * 3.5) * 0.14;
  }

  ctx.save();
  ctx.translate(0, bodyY);

  // Flowing Crimson Scarf Tails
  const scarfWave = Math.sin(time * 12) * 5;
  ctx.fillStyle = '#EF4444';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-6, -58);
  ctx.quadraticCurveTo(-24, -62 + scarfWave, -36, -46 - scarfWave * 0.5);
  ctx.quadraticCurveTo(-22, -46, -8, -50);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cyber Shinobi Legs
  const legs = [-9 - stride * 10, 9 + stride * 10];
  for (const lx of legs) {
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(lx - 5, -24, 10, 24, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#EF4444';
    ctx.fillRect(lx - 4, -12, 8, 3);
  }

  // Chrome Torso Armor
  ctx.fillStyle = '#E2E8F0';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(-16, -60, 32, 38, 7);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.fillRect(-12, -52, 24, 18);
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(-8, -46, 16, 4);

  // Horned Cyber-Ronin Helmet & Red Visor
  ctx.save();
  ctx.translate(0, -73);
  ctx.fillStyle = '#CBD5E1';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(-14, -13, 28, 24, 8);
  ctx.fill();
  ctx.stroke();

  // Twin V-Crest Horns
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.moveTo(-6, -12);
  ctx.lineTo(-14, -24);
  ctx.lineTo(-1, -13);
  ctx.moveTo(6, -12);
  ctx.lineTo(14, -24);
  ctx.lineTo(1, -13);
  ctx.fill();

  // Glowing Visor Slit
  ctx.fillStyle = '#09090B';
  ctx.fillRect(-10, -4, 22, 8);
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(-6, -2, 16, 4);
  ctx.restore();

  // Plasma Katana Arm
  ctx.save();
  ctx.translate(12 + slashReach, -44);
  ctx.rotate(bladeAngle);
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.fillRect(-4, -3, 14, 6);
  ctx.strokeRect(-4, -3, 14, 6);

  // Glowing Red/White Katana Blade
  ctx.fillStyle = '#FEF2F2';
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(10, -3);
  ctx.lineTo(44, -6);
  ctx.lineTo(48, 0);
  ctx.lineTo(10, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawMossGolemRig(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  const p = f.animDuration > 0 ? Math.min(1, f.animTimer / f.animDuration) : 0;
  const idleBob = f.animState === 'idle' ? Math.sin(time * 3.2 + f.slot) * 2 : 0;
  const stride = f.animState === 'run' ? Math.sin(time * 11) : 0;

  let bodyY = -idleBob;
  let fistReach = 0;
  let fistY = 0;

  if (f.animState === 'attack1') {
    const s = Math.sin(p * Math.PI);
    fistReach = s * 24;
  } else if (f.animState === 'attack2') {
    const s = Math.sin(p * Math.PI);
    fistReach = s * 18;
    fistY = -8 * s;
  } else if (f.animState === 'attack3') {
    const s = Math.sin(p * Math.PI);
    bodyY -= s * 14;
    fistY = s * 14;
  } else if (f.animState === 'special') {
    const s = Math.sin(p * Math.PI);
    fistY = -20 * s;
    fistReach = s * 14;
  } else if (f.animState === 'ultimate') {
    bodyY -= 12;
    fistY = -16;
  } else if (f.animState === 'taunt') {
    bodyY -= Math.abs(Math.sin(p * Math.PI * 2)) * 8;
  } else if (f.animState === 'victory') {
    bodyY -= Math.abs(Math.sin(f.animTimer * 3.6)) * 6;
    fistY = -14 - Math.sin(f.animTimer * 4) * 6;
  }

  ctx.save();
  ctx.translate(0, bodyY);

  // Heavy Stone Pillar Feet
  const legs = [-14 - stride * 8, 14 + stride * 8];
  for (const lx of legs) {
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(lx - 10, -24, 20, 24, 6);
    ctx.fill();
    ctx.stroke();
  }

  // Massive Granite Torso
  ctx.fillStyle = '#64748B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-29, -68, 58, 48, 12);
  ctx.fill();
  ctx.stroke();

  // Leafy Moss Canopy on Shoulders
  ctx.fillStyle = '#22C55E';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(-18, -68, 12, Math.PI, 0);
  ctx.arc(0, -71, 14, Math.PI, 0);
  ctx.arc(18, -68, 12, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glowing Ancient Chest Rune
  ctx.strokeStyle = '#A3E635';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.lineTo(-9, -43);
  ctx.lineTo(0, -30);
  ctx.lineTo(9, -43);
  ctx.closePath();
  ctx.stroke();

  // Monolith Head & Glowing Lime Eyes
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.roundRect(-18, -90, 36, 26, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#A3E635';
  ctx.beginPath();
  ctx.arc(-6, -77, 3.6, 0, Math.PI * 2);
  ctx.arc(7, -77, 3.6, 0, Math.PI * 2);
  ctx.fill();

  // Giant Stone Fist
  ctx.save();
  ctx.translate(22 + fistReach, -42 + fistY);
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.roundRect(-10, -10, 24, 22, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#22C55E';
  ctx.fillRect(-6, -10, 16, 5);
  ctx.restore();

  ctx.restore();
}

function drawAstroPipRig(ctx: CanvasRenderingContext2D, f: FighterEntity, time: number): void {
  const p = f.animDuration > 0 ? Math.min(1, f.animTimer / f.animDuration) : 0;
  const idleBob = f.animState === 'idle' ? Math.sin(time * 5.2 + f.slot) * 3 : 0;
  const stride = f.animState === 'run' ? Math.sin(time * 18) : 0;

  let bodyY = -idleBob - (f.animState === 'run' ? Math.abs(stride) * 4 : 0);
  let armAngle = 0.25;
  let rollAngle = 0;

  if (f.animState === 'attack1') {
    armAngle = -1.2 * Math.sin(p * Math.PI);
  } else if (f.animState === 'attack2') {
    rollAngle = p * Math.PI * 2;
  } else if (f.animState === 'attack3') {
    bodyY -= Math.sin(p * Math.PI) * 14;
    rollAngle = Math.sin(p * Math.PI) * 0.4;
  } else if (f.animState === 'special') {
    armAngle = -0.6;
  } else if (f.animState === 'ultimate') {
    bodyY -= 16;
    rollAngle = p * Math.PI * 4;
  } else if (f.animState === 'taunt') {
    armAngle = -1.5 * Math.sin(p * Math.PI);
    bodyY -= Math.abs(Math.sin(p * Math.PI * 2)) * 8;
  } else if (f.animState === 'victory') {
    bodyY -= Math.abs(Math.sin(f.animTimer * 5.5)) * 10;
    armAngle = -1.35 + Math.sin(f.animTimer * 6) * 0.2;
  }

  ctx.save();
  ctx.translate(0, bodyY);
  ctx.rotate(rollAngle);

  // Mini Space Boots
  const legs = [-8 - stride * 8, 8 + stride * 8];
  for (const lx of legs) {
    ctx.fillStyle = '#6B21A8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(lx - 6, -18, 12, 18, 5);
    ctx.fill();
    ctx.stroke();
  }

  // Jetpack Flame
  if (f.animState === 'recovery' || f.animState === 'jump' || f.animState === 'victory') {
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.moveTo(-18, -32);
    ctx.lineTo(-10, -32);
    ctx.lineTo(-14, -14 - Math.sin(time * 40) * 5);
    ctx.closePath();
    ctx.fill();
  }

  // Purple Pilot Suit Torso
  ctx.fillStyle = '#9333EA';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(-17, -46, 34, 30, 10);
  ctx.fill();
  ctx.stroke();

  // Yellow Star Chest Emblem
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(0, -32, 6, 0, Math.PI * 2);
  ctx.fill();

  // Bubble Glass Space Helmet + Cute Hamster Inside!
  ctx.save();
  ctx.translate(0, -60);

  // Fluffy Hamster Ears & Face
  ctx.fillStyle = '#F59E0B';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-10, -10, 5, 0, Math.PI * 2);
  ctx.arc(10, -10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FDBA74';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Rosy Cheeks & Bright Eyes
  ctx.fillStyle = '#FB7185';
  ctx.beginPath();
  ctx.arc(-8, 4, 3, 0, Math.PI * 2);
  ctx.arc(8, 4, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#18181B';
  ctx.beginPath();
  ctx.arc(-4.5, -2, 2.3, 0, Math.PI * 2);
  ctx.arc(5.5, -2, 2.3, 0, Math.PI * 2);
  ctx.fill();

  // Transparent Bubble Dome Overlay
  ctx.fillStyle = 'rgba(192, 132, 252, 0.22)';
  ctx.strokeStyle = '#E9D5FF';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, -1, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Antenna Star
  ctx.strokeStyle = '#FDE047';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(0, -27);
  ctx.stroke();
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(0, -29, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Pilot Arm + Mini Star Wand
  ctx.save();
  ctx.translate(14, -36);
  ctx.rotate(armAngle);
  ctx.fillStyle = '#C084FC';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-3, -4, 16, 8, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(15, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawSlashEffect(ctx: CanvasRenderingContext2D, s: SlashEffect): void {
  const t = Math.max(0, s.life / s.maxLife);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(s.facing, 1);
  if (s.angle) ctx.rotate(s.angle);
  ctx.globalAlpha = t;

  if (s.kind === 'honey_whip') {
    const len = s.width * (1.05 - t * 0.2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 11 * t;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-len * 0.35, 0);
    ctx.quadraticCurveTo(len * 0.1, -18 * t, len * 0.6, 4);
    ctx.stroke();

    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 6 * t;
    ctx.stroke();

    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.arc(len * 0.6, 6, 6 * t, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.kind === 'stinger_drill') {
    ctx.fillStyle = '#C084FC';
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 3 * t;
    ctx.beginPath();
    ctx.moveTo(-s.width * 0.35, -s.height * 0.45);
    ctx.lineTo(s.width * 0.65, 0);
    ctx.lineTo(-s.width * 0.35, s.height * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (s.kind === 'crystal_spire') {
    const grow = Math.min(1, (1 - t) * 2.2 + 0.35);
    const h = s.height * grow;
    const w = s.width;
    ctx.fillStyle = '#CBD5E1';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-w * 0.48, s.height * 0.5);
    ctx.lineTo(-w * 0.22, s.height * 0.5 - h * 0.72);
    ctx.lineTo(0, s.height * 0.5 - h);
    ctx.lineTo(w * 0.24, s.height * 0.5 - h * 0.68);
    ctx.lineTo(w * 0.48, s.height * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (s.kind === 'boulder_knuckle') {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4 * t;
    ctx.beginPath();
    ctx.arc(10, 0, s.width * 0.45 * (1.2 - t * 0.3), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.arc(18, 0, 14 * t, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.kind === 'gale_clap') {
    const span = s.width * 0.5 * (1.15 - t * 0.35);
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 8 * t;
    ctx.beginPath();
    ctx.arc(-span * 0.35, 0, s.height * 0.5, Math.PI * 0.6, Math.PI * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(span * 0.35, 0, s.height * 0.5, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
  } else if (s.kind === 'belly_slam') {
    const w = s.width * (1.1 - t * 0.25);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4 * t;
    ctx.beginPath();
    ctx.ellipse(0, 16, w * 0.5, 16 * t, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (s.kind === 'split_jab') {
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 6 * t;
    ctx.beginPath();
    ctx.moveTo(-s.width * 0.3, -6);
    ctx.lineTo(s.width * 0.55, -2);
    ctx.stroke();
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 5 * t;
    ctx.beginPath();
    ctx.moveTo(-s.width * 0.3, 6);
    ctx.lineTo(s.width * 0.55, 2);
    ctx.stroke();
  } else if (s.kind === 'orbital_strike') {
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 6 * t;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.width * 0.5, s.height * 0.48, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.kind === 'eclipse_spear') {
    // Jagged split black-and-white horizontal spear ray matching Eve's sketch!
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 3 * t;
    ctx.beginPath();
    ctx.moveTo(-s.width * 0.45, -14 * t);
    ctx.lineTo(s.width * 0.32, -8 * t);
    ctx.lineTo(s.width * 0.55, 0);
    ctx.lineTo(s.width * 0.32, 8 * t);
    ctx.lineTo(-s.width * 0.45, 14 * t);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (s.kind === 'eclipse_cleave') {
    // GIANT SLOW HIGH-DAMAGE MONOCHROME SLASH CRESCENT
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 6 * t;
    ctx.beginPath();
    ctx.arc(-30, 0, s.width * 0.62, -Math.PI * 0.44, Math.PI * 0.44);
    ctx.arc(-56, 0, s.width * 0.45, Math.PI * 0.42, -Math.PI * 0.42, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner bright slash core
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4 * t;
    ctx.beginPath();
    ctx.arc(-36, 0, s.width * 0.56, -Math.PI * 0.38, Math.PI * 0.38);
    ctx.stroke();
  } else if (s.kind === 'scuttle_needle') {
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 5 * t;
    ctx.beginPath();
    ctx.moveTo(-s.width * 0.3, -4);
    ctx.lineTo(s.width * 0.55, 0);
    ctx.moveTo(-s.width * 0.25, 6);
    ctx.lineTo(s.width * 0.45, 4);
    ctx.stroke();
  } else if (s.kind === 'web_spin') {
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 5 * t;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.width * 0.48, s.height * 0.44, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.kind === 'static_pounce') {
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 6 * t;
    ctx.beginPath();
    ctx.arc(6, 0, s.width * 0.48, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
  } else if (s.kind === 'tv_blare') {
    // Short-range CRT Static & Hypno Sound Cone
    const reach = s.width * (0.95 - t * 0.15);
    for (let ring = 0; ring < 3; ring++) {
      const dist = 16 + ring * (reach * 0.28);
      ctx.strokeStyle = ring % 2 === 0 ? '#10B981' : '#F43F5E';
      ctx.lineWidth = (7 - ring) * t;
      ctx.beginPath();
      ctx.arc(-10, 0, dist, -Math.PI * 0.34, Math.PI * 0.34);
      ctx.stroke();
    }
  } else if (s.kind === 'recovery_burst') {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 6 * t;
    ctx.beginPath();
    ctx.arc(0, 12, s.width * 0.45 * (1.2 - t * 0.4), Math.PI, Math.PI * 2);
    ctx.stroke();
  } else if (s.kind === 'baton_strike') {
    ctx.strokeStyle = '#818CF8';
    ctx.lineWidth = 8 * t;
    ctx.beginPath();
    ctx.arc(-6, 0, s.width * 0.46, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
  } else if (s.kind === 'lasso_whip') {
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 5 * t;
    ctx.beginPath();
    ctx.ellipse(6, 0, s.width * 0.48, s.height * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.kind === 'spur_kick') {
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 8 * t;
    ctx.beginPath();
    ctx.moveTo(-s.width * 0.25, 10);
    ctx.lineTo(s.width * 0.52, -10);
    ctx.stroke();
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 4 * t;
    ctx.stroke();
  } else if (s.kind === 'deadeye_shot') {
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 6 * t;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(s.width * 0.65, 0);
    ctx.stroke();
  } else if (s.kind === 'fire_upper' || s.kind === 'ember_hook' || s.kind === 'meteor_crash') {
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = (s.kind === 'meteor_crash' ? 10 : 7) * t;
    ctx.beginPath();
    ctx.arc(0, 0, s.width * 0.48, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3.5 * t;
    ctx.stroke();
  } else if (s.kind === 'tentacle_snap' || s.kind === 'riptide_spin' || s.kind === 'pearl_slam') {
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 6 * t;
    ctx.beginPath();
    if (s.kind === 'riptide_spin') {
      ctx.ellipse(0, 0, s.width * 0.48, s.height * 0.45, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(-8, 0, s.width * 0.48, -Math.PI * 0.35, Math.PI * 0.35);
    }
    ctx.stroke();
    ctx.strokeStyle = '#F472B6';
    ctx.lineWidth = 3 * t;
    ctx.stroke();
  } else if (s.kind === 'iaido_slash' || s.kind === 'cross_crescent' || s.kind === 'dragon_fang') {
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 7 * t;
    ctx.beginPath();
    if (s.kind === 'cross_crescent') {
      ctx.moveTo(-s.width * 0.35, -s.height * 0.35);
      ctx.lineTo(s.width * 0.45, s.height * 0.35);
      ctx.moveTo(-s.width * 0.35, s.height * 0.35);
      ctx.lineTo(s.width * 0.45, -s.height * 0.35);
    } else {
      ctx.arc(-10, 0, s.width * 0.52, -Math.PI * 0.36, Math.PI * 0.36);
    }
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.6 * t;
    ctx.stroke();
  } else if (s.kind === 'granite_jab' || s.kind === 'tectonic_clap' || s.kind === 'quake_stomp') {
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 8 * t;
    ctx.beginPath();
    if (s.kind === 'granite_jab') {
      ctx.arc(8, 0, s.width * 0.45, 0, Math.PI * 2);
    } else {
      ctx.ellipse(0, 8, s.width * 0.5, s.height * 0.35, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.strokeStyle = '#A3E635';
    ctx.lineWidth = 3.5 * t;
    ctx.stroke();
  } else if (s.kind === 'star_tap' || s.kind === 'orbit_roll' || s.kind === 'comet_kick') {
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 6 * t;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.width * 0.48, s.height * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 3 * t;
    ctx.stroke();
  } else {
    // Ultimate bursts (swarm, thunder, duality_cataclysm, broadcast_overload, high_noon_lockdown, inferno_nova, tidal_maelstrom, omnislash_flash, seismic_monolith, supernova_comet)
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 10 * t;
    ctx.beginPath();
    ctx.arc(0, 0, s.width * 0.5 * (1.25 - t * 0.55), 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3 * t;
    ctx.beginPath();
    ctx.arc(0, 0, s.width * 0.5 * (1.05 - t * 0.45), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: ProjectileEntity): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);

  if (p.kind === 'venom_honey_drop') {
    ctx.fillStyle = '#A855F7';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(-p.radius * 0.22, -p.radius * 0.22, p.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'hornet_bolt') {
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(p.radius * 1.4, 0);
    ctx.lineTo(-p.radius, -p.radius * 0.55);
    ctx.lineTo(-p.radius * 0.6, 0);
    ctx.lineTo(-p.radius, p.radius * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'eclipse_dart') {
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(p.radius * 1.6, 0);
    ctx.lineTo(-p.radius, -p.radius * 0.55);
    ctx.lineTo(-p.radius, p.radius * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'static_orb') {
    ctx.fillStyle = '#10B981';
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.rect(-p.radius * 0.85, -p.radius * 0.85, p.radius * 1.7, p.radius * 1.7);
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'cuff_bolt') {
    ctx.fillStyle = '#38BDF8';
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(-p.radius * 0.45, 0, p.radius * 0.52, 0, Math.PI * 2);
    ctx.arc(p.radius * 0.45, 0, p.radius * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'sheriff_star') {
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? p.radius * 1.25 : p.radius * 0.55;
      const ang = (k * Math.PI) / 5;
      const sx = Math.cos(ang) * r;
      const sy = Math.sin(ang) * r;
      if (k === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'ember_bomb') {
    ctx.fillStyle = '#F97316';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(-p.radius * 0.2, -p.radius * 0.2, p.radius * 0.52, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'bubble_orb') {
    ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.strokeStyle = '#CFFAFE';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-p.radius * 0.34, -p.radius * 0.34, p.radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'shuriken_star') {
    ctx.fillStyle = '#E2E8F0';
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const r = k % 2 === 0 ? p.radius * 1.3 : p.radius * 0.42;
      const ang = (k * Math.PI) / 4;
      const sx = Math.cos(ang) * r;
      const sy = Math.sin(ang) * r;
      if (k === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'boulder_rock') {
    ctx.fillStyle = '#64748B';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-p.radius, -p.radius * 0.4);
    ctx.lineTo(-p.radius * 0.3, -p.radius);
    ctx.lineTo(p.radius * 0.75, -p.radius * 0.7);
    ctx.lineTo(p.radius, p.radius * 0.3);
    ctx.lineTo(p.radius * 0.2, p.radius);
    ctx.lineTo(-p.radius * 0.8, p.radius * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(-p.radius * 0.2, -p.radius * 0.35, p.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'nova_star') {
    ctx.fillStyle = '#FDE047';
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? p.radius * 1.28 : p.radius * 0.52;
      const ang = (k * Math.PI) / 5;
      const sx = Math.cos(ang) * r;
      const sy = Math.sin(ang) * r;
      if (k === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

export function renderWinnersPodiumStage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  winnerId: FighterId,
  winnerSlot: 0 | 1,
  time: number
): void {
  const spec = FIGHTER_SPECS[winnerId];
  const accent = spec.accentColor;

  ctx.clearRect(0, 0, width, height);

  // Dark stage backdrop with subtle radial spotlight
  const bg = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    18,
    width * 0.5,
    height * 0.55,
    width * 0.68
  );
  bg.addColorStop(0, '#1E293B');
  bg.addColorStop(0.65, '#0F172A');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const cx = width * 0.5;
  const podiumTopY = height - 62;
  const podiumWidth = 152;
  const podiumHeight = 50;

  // Overhead championship spotlight beam
  const pulse = 0.92 + Math.sin(time * 4.2) * 0.08;
  const beam = ctx.createLinearGradient(cx, 0, cx, podiumTopY + 6);
  beam.addColorStop(0, `${accent}00`);
  beam.addColorStop(0.35, `${accent}1A`);
  beam.addColorStop(1, `${accent}44`);
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(cx - 42, 0);
  ctx.lineTo(cx + 42, 0);
  ctx.lineTo(cx + 98 * pulse, podiumTopY + 4);
  ctx.lineTo(cx - 98 * pulse, podiumTopY + 4);
  ctx.closePath();
  ctx.fill();

  // Fighter-specific animated aura behind the podium figure
  ctx.save();
  if (winnerId === 'honey_shell') {
    for (let i = 0; i < 6; i++) {
      const a = time * 1.4 + (i * Math.PI) / 3;
      const rx = cx + Math.cos(a) * 68;
      const ry = podiumTopY - 58 + Math.sin(a * 1.3) * 26;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(251, 191, 36, 0.45)' : 'rgba(253, 230, 138, 0.35)';
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ha = (k * Math.PI) / 3;
        const px = rx + Math.cos(ha) * 7;
        const py = ry + Math.sin(ha) * 7;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  } else if (winnerId === 'cloudier') {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const lift = ((time * 28 + i * 26) % 78);
      ctx.globalAlpha = Math.max(0, 1 - lift / 78) * 0.65;
      ctx.beginPath();
      ctx.ellipse(cx, podiumTopY - 14 - lift, 54 + lift * 0.25, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (winnerId === 'eve') {
    ctx.translate(cx, podiumTopY - 56);
    ctx.rotate(time * 0.9);
    ctx.strokeStyle = 'rgba(250, 250, 250, 0.42)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(24, 24, 27, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 62, Math.PI, Math.PI * 2);
    ctx.stroke();
  } else if (winnerId === 'marshal_bolt') {
    const redOn = Math.floor(time * 8) % 2 === 0;
    ctx.fillStyle = redOn ? 'rgba(244, 63, 94, 0.25)' : 'rgba(59, 130, 246, 0.25)';
    ctx.beginPath();
    ctx.arc(cx, podiumTopY - 72, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FBBF24';
    for (let i = 0; i < 6; i++) {
      const a = time * 1.5 + (i * Math.PI) / 3;
      const sx = cx + Math.cos(a) * 68;
      const sy = podiumTopY - 56 + Math.sin(a) * 28;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (winnerId === 'spidra') {
    for (let i = 0; i < 8; i++) {
      const p = ((time * 1.1 + i * 0.13) % 1);
      const sx = cx + Math.sin(i * 2.7) * 74;
      const sy = podiumTopY - 12 - p * 98;
      ctx.fillStyle = i % 2 === 0 ? '#10B981' : '#F43F5E';
      ctx.globalAlpha = (1 - p) * 0.8;
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
    }
  } else {
    const primary = FIGHTER_SPECS[winnerId].accentColor;
    const secondary = FIGHTER_SPECS[winnerId].secondaryColor;
    for (let i = 0; i < 8; i++) {
      const a = time * 1.6 + (i * Math.PI) / 4;
      const rx = cx + Math.cos(a) * 66;
      const ry = podiumTopY - 56 + Math.sin(a * 1.4) * 28;
      ctx.fillStyle = i % 2 === 0 ? primary : secondary;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.arc(rx, ry, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Flanking lower step accents for authentic championship podium silhouette
  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx - podiumWidth * 0.5 - 66, podiumTopY + 24, 68, 28, [6, 0, 0, 4]);
  ctx.roundRect(cx + podiumWidth * 0.5 - 2, podiumTopY + 30, 68, 22, [0, 6, 4, 0]);
  ctx.fill();
  ctx.stroke();

  // 1st-Place Winner's Podium Pedestal
  const pedGrad = ctx.createLinearGradient(0, podiumTopY, 0, podiumTopY + podiumHeight);
  pedGrad.addColorStop(0, '#334155');
  pedGrad.addColorStop(1, '#0F172A');
  ctx.fillStyle = pedGrad;
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(cx - podiumWidth * 0.5, podiumTopY, podiumWidth, podiumHeight, [8, 8, 4, 4]);
  ctx.fill();
  ctx.stroke();

  // Top gold trim bar
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.roundRect(cx - podiumWidth * 0.5 - 4, podiumTopY - 5, podiumWidth + 8, 9, 4);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Engraved 1ST emblem on podium front
  ctx.fillStyle = '#FDE68A';
  ctx.font = '800 18px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1ST', cx, podiumTopY + podiumHeight * 0.54);
  ctx.restore();

  // Floor contact shadow on top of podium
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(cx, podiumTopY - 4, 40, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Winning fighter standing on the 1st-place pedestal performing their unique victory animation
  const podiumFighter: FighterEntity = {
    slot: winnerSlot,
    id: winnerId,
    isAi: false,
    x: cx,
    y: podiumTopY - 5,
    vx: 0,
    vy: 0,
    width: spec.width,
    height: spec.height,
    facing: 1,
    grounded: true,
    jumpsRemaining: 2,
    recoveryUsed: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    dropThroughTimer: 0,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    stocks: 5,
    ultCharge: 100,
    damageDealt: 0,
    koCount: 0,
    animState: 'victory',
    animTimer: time,
    animDuration: 1.1,
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
    aiDecisionTimer: 0,
    aiDesiredAction: 'approach',
  };

  ctx.save();
  ctx.translate(cx, podiumTopY - 5);
  ctx.scale(1.36, 1.36);
  drawFighterRigById(ctx, podiumFighter, time);
  ctx.restore();
}
