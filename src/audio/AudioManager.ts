export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  volume = 0.18;
  start() {
    try {
      if (!this.context) {
        const ctx = (this.context = new AudioContext());
        this.master = ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(ctx.destination);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 330;
        this.engine = ctx.createOscillator();
        this.engine.type = 'sawtooth';
        this.engine.frequency.value = 42;
        this.engineGain = ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engine.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engine.start();
      }
      void this.context.resume().catch(() => {});
    } catch {}
  }
  setVolume(volume: number) {
    this.volume = volume;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.08);
  }
  update(speed: number, active: boolean) {
    if (!this.context || !this.engine || !this.engineGain) return;
    this.engine.frequency.setTargetAtTime(38 + Math.abs(speed) * 3, this.context.currentTime, 0.09);
    this.engineGain.gain.setTargetAtTime(active ? 0.055 : 0, this.context.currentTime, 0.08);
  }
  tone(frequency: number, duration = 0.12, ending = frequency, type: OscillatorType = 'sine') {
    if (!this.context || !this.master) return;
    const ctx = this.context,
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, ending), ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  countdown(go = false) {
    this.tone(go ? 880 : 440, go ? 0.4 : 0.13, go ? 1320 : 440);
  }
  pickup() {
    this.tone(650, 0.25, 1300);
  }
  boost() {
    this.tone(100, 0.45, 470, 'triangle');
  }
  hit() {
    this.tone(180, 0.25, 40, 'triangle');
  }
}
