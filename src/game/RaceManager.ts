import { Kart } from '../kart/Kart';
import { WaypointSystem } from '../track/WaypointSystem';
import { CONFIG } from '../config';
export type RaceState = 'menu' | 'countdown' | 'racing' | 'paused' | 'finished';
export interface Progress {
  lap: number;
  nextGate: number;
  gates: number;
  previous: number;
  lapStart: number;
  lapTimes: number[];
  finishedAt: number | null;
  fraction: number;
}
export class RaceManager {
  state: RaceState = 'menu';
  previousState: RaceState = 'racing';
  countdown = 3.7;
  elapsed = 0;
  readonly gates = 24;
  progress = new Map<number, Progress>();
  constructor(
    readonly path: WaypointSystem,
    readonly karts: Kart[],
  ) {
    this.reset();
  }
  reset() {
    this.state = 'menu';
    this.countdown = 3.7;
    this.elapsed = 0;
    for (const k of this.karts) {
      const t = 0.006 + Math.floor(k.id / 2) * 0.004;
      k.position.copy(this.path.sample(t, k.id % 2 ? 2.4 : -2.4));
      const d = this.path.tangent(t);
      k.heading = Math.atan2(d.x, d.z);
      k.speed = 0;
      k.velocity.set(0, 0, 0);
      k.resetEffects();
      this.progress.set(k.id, {
        lap: 1,
        nextGate: 1,
        gates: 0,
        previous: t,
        lapStart: 0,
        lapTimes: [],
        finishedAt: null,
        fraction: 0,
      });
    }
  }
  start() {
    this.reset();
    this.state = 'countdown';
  }
  pause() {
    if (this.state === 'paused') this.state = this.previousState;
    else if (this.state === 'racing' || this.state === 'countdown') {
      this.previousState = this.state;
      this.state = 'paused';
    }
  }
  tick(dt: number) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.state = 'racing';
    } else if (this.state === 'racing') this.elapsed += dt;
  }
  update(kart: Kart) {
    const p = this.progress.get(kart.id)!;
    if (p.finishedAt !== null) return;
    const near = this.path.nearest(kart.position),
      t = near.t;
    const delta = ((t - p.previous + 1.5) % 1) - 0.5;
    const gate = p.nextGate / this.gates;
    const toGate = (gate - p.previous + 1) % 1;
    if (
      delta > 0 &&
      delta < 0.025 &&
      toGate <= delta + 0.00001 &&
      near.distance < 11 &&
      kart.position.y > -3
    ) {
      p.gates++;
      p.nextGate = (p.nextGate + 1) % this.gates;
      if (p.nextGate === 1) {
        p.lapTimes.push(this.elapsed - p.lapStart);
        p.lapStart = this.elapsed;
        if (p.lap === CONFIG.laps) {
          p.finishedAt = this.elapsed;
          if (kart.id === 0) this.state = 'finished';
        } else p.lap++;
      }
    }
    p.previous = t;
    const lastGate = ((p.nextGate + this.gates - 1) % this.gates) / this.gates;
    p.fraction = Math.min(((t - lastGate + 1) % 1) * this.gates, 0.99);
  }
  recover(kart: Kart) {
    const p = this.progress.get(kart.id)!;
    const t = ((p.nextGate + this.gates - 1) % this.gates) / this.gates + 0.003;
    kart.position.copy(this.path.sample(t, kart.id % 2 ? 2 : -2));
    const dir = this.path.tangent(t);
    kart.heading = Math.atan2(dir.x, dir.z);
    kart.speed = 0;
    kart.velocity.set(0, 0, 0);
    kart.resetEffects();
    p.previous = t;
  }
  order() {
    return [...this.karts].sort((a, b) => {
      const pa = this.progress.get(a.id)!,
        pb = this.progress.get(b.id)!;
      if (pa.finishedAt !== null || pb.finishedAt !== null)
        return (pa.finishedAt ?? Infinity) - (pb.finishedAt ?? Infinity);
      return pb.gates + pb.fraction - pa.gates - pa.fraction;
    });
  }
}
