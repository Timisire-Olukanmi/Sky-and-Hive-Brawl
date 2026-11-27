class SoundSynth {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private volume = 0.85;

  public getOrCreateContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (!this.sfxGain && this.ctx) {
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.sfxGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public resumeContext(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public getNoiseBuffer(): AudioBuffer | null {
    const ctx = this.getOrCreateContext();
    if (!ctx) return null;
    if (!this.noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.5);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  private ensureContext(): { ctx: AudioContext; bus: GainNode } | null {
    if (this.muted || this.volume <= 0.001 || typeof window === 'undefined') return null;
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.sfxGain) return null;
    return { ctx, bus: this.sfxGain };
  }

  private syncGain(): void {
    if (!this.ctx || !this.sfxGain) return;
    const target = this.muted ? 0 : this.volume;
    this.sfxGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.015);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.syncGain();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.85));
    this.syncGain();
  }

  public getVolume(): number {
    return this.volume;
  }

  public playJump(doubleJump = false): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const base = doubleJump ? 320 : 220;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 2.1, now + 0.11);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playAttack(heavy = false): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = heavy ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(heavy ? 180 : 290, now);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 65 : 110, now + (heavy ? 0.16 : 0.09));
    gain.gain.setValueAtTime(heavy ? 0.14 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.17 : 0.1));
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + (heavy ? 0.18 : 0.11));
  }

  public playHit(heavy = false): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(heavy ? 150 : 220, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + (heavy ? 0.19 : 0.11));
    gain.gain.setValueAtTime(heavy ? 0.22 : 0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.2 : 0.12));
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + (heavy ? 0.21 : 0.13));
  }

  public playSpecial(isHoney: boolean): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isHoney ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(isHoney ? 440 : 190, now);
    osc.frequency.exponentialRampToValueAtTime(isHoney ? 680 : 95, now + 0.18);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playUltimate(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const freqs = [130, 195, 260];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 2.4, now + 0.26);
      osc.frequency.exponentialRampToValueAtTime(f * 0.75, now + 0.52);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.54);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(now);
      osc.stop(now + 0.55);
    });
  }

  public playKO(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.42);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  public playUiClick(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.05);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playCloudWall(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.22);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playStun(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playPoisonTick(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.08);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playRecovery(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.19);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playChargeTelegraph(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.45);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.44);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.52);
  }

  public playBouncePad(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.16);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playHazardHit(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.2);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playTvBlare(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    [320, 485].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'square' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 1.45, now + 0.11);
      osc.frequency.linearRampToValueAtTime(freq * 0.72, now + 0.26);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(now);
      osc.stop(now + 0.29);
    });
  }

  public playLaserShot(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1080, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.16);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playTaunt(fighterId: string): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const patterns: Record<string, { freqs: number[]; type: OscillatorType }> = {
      honey_shell: { freqs: [460, 620, 780], type: 'triangle' },
      cloudier: { freqs: [220, 330, 440], type: 'sawtooth' },
      eve: { freqs: [580, 740, 880], type: 'sine' },
      spidra: { freqs: [390, 780, 520], type: 'square' },
      marshal_bolt: { freqs: [640, 480, 760], type: 'square' },
      pyro_jack: { freqs: [260, 390, 520], type: 'sawtooth' },
      aqua_nyx: { freqs: [480, 640, 840], type: 'sine' },
      blade_zero: { freqs: [660, 990, 1180], type: 'triangle' },
      moss_golem: { freqs: [140, 190, 260], type: 'sawtooth' },
      astro_pip: { freqs: [560, 760, 1040], type: 'sine' },
    };
    const cfg = patterns[fighterId] ?? patterns.honey_shell;
    cfg.freqs.forEach((freq, idx) => {
      const t = now + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = cfg.type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, t + 0.055);
      gain.gain.setValueAtTime(0.075, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(t);
      osc.stop(t + 0.08);
    });
  }

  public playTauntBoost(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(990, now + 0.12);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playCrackHit(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.08);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playStructureBreak(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    [130, 82].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.24);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(now);
      osc.stop(now + 0.27);
    });
  }

  public playHoverCarPass(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.36);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

export const soundSynth = new SoundSynth();
