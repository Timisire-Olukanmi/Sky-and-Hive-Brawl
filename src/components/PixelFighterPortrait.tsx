import { useEffect, useRef } from 'react';
import { renderPixelFighterPortrait } from '../game/renderer';
import type { FighterId } from '../game/types';

interface PixelFighterPortraitProps {
  id: FighterId;
  size?: number;
  className?: string;
}

export function PixelFighterPortrait({
  id,
  size = 24,
  className = '',
}: PixelFighterPortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderPixelFighterPortrait(ctx, size, size, id, 0);
  }, [id, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      aria-hidden="true"
      className={`pixelated shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
