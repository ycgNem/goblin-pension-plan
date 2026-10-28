import { settings } from '../core/settings';
import { Sequencer, TRACKS, type TrackId } from './music';
import { SFX, type SfxId } from './sfx';
import type { Voice } from './synth';

const MUSIC_FADE = 1.2;

interface Playing {
  id: TrackId;
  gain: GainNode;
  seq: Sequencer;
}

/**
 * Owns the AudioContext. Browsers only allow sound after a user gesture, so nothing plays
 * until `unlock()` is called from one; requests made before that are remembered.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private playing: Playing | null = null;
  private wanted: TrackId | null = null;
  /** How many optional music layers to play (the Burrow theme grows with the home). */
  layer = 0;
  private lastSfx = new Map<SfxId, number>();

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.ratio.value = 6;
      this.master = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(limiter).connect(ctx.destination);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      if (this.wanted) this.start(this.wanted);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.musicBus.gain.value = settings.music;
    this.sfxBus.gain.value = settings.sfx;
  }

  sfx(id: SfxId, opts: { pitch?: number; vary?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    // Don't stack the same sound many times in one instant (a shotgun of hits, say).
    const last = this.lastSfx.get(id) ?? -1;
    if (ctx.currentTime - last < 0.025) return;
    this.lastSfx.set(id, ctx.currentTime);
    const pitch = (opts.pitch ?? 1) * (1 + (Math.random() - 0.5) * (opts.vary ?? 0.1));
    SFX[id](this.voice(this.sfxBus, ctx.currentTime), pitch);
  }

  music(id: TrackId | null): void {
    this.wanted = id;
    if (!this.ctx || this.playing?.id === id) return;
    this.start(id);
  }

  /** Call once per frame to keep the sequencer fed. */
  update(): void {
    if (this.ctx && this.playing) this.playing.seq.schedule(this.ctx.currentTime, this.layer);
  }

  private start(id: TrackId | null): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    if (this.playing) {
      const old = this.playing;
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE);
      setTimeout(() => old.gain.disconnect(), (MUSIC_FADE + 0.5) * 1000);
      this.playing = null;
    }
    if (!id) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + MUSIC_FADE);
    gain.connect(this.musicBus);
    this.playing = { id, gain, seq: new Sequencer(TRACKS[id], gain, (out, t) => this.voice(out, t), now + 0.05) };
  }

  private voice(out: AudioNode, t: number): Voice {
    return { ctx: this.ctx!, out, noise: this.noise, t };
  }
}

export const audio = new AudioEngine();
