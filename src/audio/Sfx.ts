/**
 * Efeitos sonoros e música sintetizados com Web Audio (estilo chiptune).
 * Sem arquivos externos: tudo gerado em tempo real.
 */
type Wave = OscillatorType;

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private currentTrack: string | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.35;
        this.musicGain.connect(this.master);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Deve ser chamado após um gesto do usuário para liberar o áudio no navegador. */
  unlock() {
    this.ensure();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  private tone(
    freq: number,
    duration: number,
    wave: Wave = 'square',
    volume = 0.5,
    slideTo?: number,
    dest?: AudioNode,
    startAt = 0,
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + startAt;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(dest ?? this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, volume = 0.4) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  hover() {
    this.tone(880, 0.04, 'square', 0.12);
  }
  select() {
    this.tone(660, 0.06, 'square', 0.25);
    this.tone(990, 0.08, 'square', 0.2, undefined, undefined, 0.05);
  }
  back() {
    this.tone(440, 0.08, 'square', 0.2, 220);
  }
  tick() {
    this.tone(1200, 0.02, 'square', 0.06);
  }
  hit() {
    this.noise(0.15, 0.5);
    this.tone(180, 0.15, 'sawtooth', 0.4, 60);
  }
  crit() {
    this.noise(0.25, 0.6);
    this.tone(120, 0.3, 'sawtooth', 0.5, 40);
    this.tone(1400, 0.1, 'square', 0.3, 700, undefined, 0.05);
  }
  heal() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.3, undefined, undefined, i * 0.07));
  }
  buff() {
    [392, 494, 587].forEach((f, i) => this.tone(f, 0.12, 'square', 0.25, undefined, undefined, i * 0.06));
  }
  debuff() {
    [587, 494, 392].forEach((f, i) => this.tone(f, 0.12, 'square', 0.25, undefined, undefined, i * 0.06));
  }
  miss() {
    this.tone(600, 0.12, 'triangle', 0.2, 300);
  }
  magic() {
    for (let i = 0; i < 6; i++) this.tone(700 + i * 150, 0.08, 'square', 0.18, undefined, undefined, i * 0.04);
  }
  stun() {
    this.tone(300, 0.3, 'square', 0.3, 900);
  }
  coin() {
    this.tone(1046, 0.06, 'square', 0.25);
    this.tone(1568, 0.14, 'square', 0.25, undefined, undefined, 0.06);
  }
  levelUp() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.18, 'square', 0.3, undefined, undefined, i * 0.09));
  }
  victory() {
    const notes = [523, 523, 523, 659, 784, 659, 784];
    const dur = [0.1, 0.1, 0.1, 0.25, 0.15, 0.1, 0.4];
    let t = 0;
    notes.forEach((f, i) => {
      this.tone(f, dur[i], 'square', 0.3, undefined, undefined, t);
      this.tone(f / 2, dur[i], 'triangle', 0.2, undefined, undefined, t);
      t += dur[i] + 0.03;
    });
  }
  defeat() {
    [392, 370, 349, 262].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.25, f * 0.9, undefined, i * 0.3));
  }
  bossRoar() {
    this.noise(0.6, 0.6);
    this.tone(80, 0.7, 'sawtooth', 0.5, 40);
    this.tone(120, 0.7, 'square', 0.3, 50);
  }
  step() {
    this.tone(220, 0.05, 'triangle', 0.15, 160);
  }

  // ---------------- Música ----------------

  private tracks: Record<string, { bpm: number; bass: number[]; lead: number[] }> = {
    title: {
      bpm: 100,
      bass: [130.8, 0, 130.8, 0, 98, 0, 110, 0, 130.8, 0, 130.8, 0, 87.3, 0, 98, 0],
      lead: [523, 0, 659, 784, 0, 659, 523, 0, 587, 0, 659, 0, 494, 0, 523, 0],
    },
    map: {
      bpm: 112,
      bass: [130.8, 0, 130.8, 0, 174.6, 0, 174.6, 0, 196, 0, 196, 0, 174.6, 0, 146.8, 0],
      lead: [659, 0, 784, 0, 880, 0, 784, 659, 0, 587, 0, 659, 0, 523, 0, 0],
    },
    battle: {
      bpm: 150,
      bass: [110, 110, 0, 110, 130.8, 0, 110, 0, 98, 98, 0, 98, 116.5, 0, 98, 0],
      lead: [440, 0, 523, 440, 0, 659, 0, 587, 392, 0, 466, 392, 0, 587, 0, 523],
    },
    boss: {
      bpm: 165,
      bass: [82.4, 82.4, 0, 82.4, 87.3, 0, 82.4, 0, 73.4, 73.4, 0, 73.4, 77.8, 0, 73.4, 0],
      lead: [659, 0, 622, 659, 0, 740, 0, 659, 587, 0, 554, 587, 0, 659, 0, 622],
    },
    victory: {
      bpm: 120,
      bass: [130.8, 0, 164.8, 0, 196, 0, 130.8, 0, 174.6, 0, 130.8, 0, 196, 0, 130.8, 0],
      lead: [784, 0, 880, 0, 1046, 0, 880, 784, 0, 698, 0, 784, 0, 1046, 0, 0],
    },
  };

  playMusic(track: keyof typeof this.tracks) {
    if (this.currentTrack === track) return;
    this.stopMusic();
    const ctx = this.ensure();
    if (!ctx) return;
    this.currentTrack = track as string;
    const def = this.tracks[track];
    const stepMs = (60 / def.bpm / 2) * 1000;
    this.musicStep = 0;
    const play = () => {
      if (!this.musicGain) return;
      const i = this.musicStep % 16;
      const b = def.bass[i];
      const l = def.lead[i];
      const stepSec = stepMs / 1000;
      if (b) this.tone(b, stepSec * 0.9, 'triangle', 0.35, undefined, this.musicGain);
      if (l) this.tone(l, stepSec * 0.7, 'square', 0.12, undefined, this.musicGain);
      if (i % 4 === 0) this.tone(60, 0.08, 'sine', 0.4, 30, this.musicGain);
      this.musicStep++;
    };
    play();
    this.musicTimer = window.setInterval(play, stepMs);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.currentTrack = null;
  }
}

export const Sfx = new SfxEngine();
