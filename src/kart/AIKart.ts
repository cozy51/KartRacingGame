import * as THREE from 'three';
import { Kart, type Controls } from './Kart';
import { WaypointSystem } from '../track/WaypointSystem';
import { DIFFICULTY, type Difficulty, CONFIG } from '../config';
export class AIKart extends Kart {
  difficulty: Difficulty = 'Normal';
  constructor(
    id: number,
    name: string,
    color: number,
    readonly path: WaypointSystem,
  ) {
    super(id, name, color);
  }
  controls(karts: Kart[], time: number): Controls {
    const near = this.path.nearest(this.position),
      lookAhead = 5 + Math.abs(this.speed) * 0.55;
    let lane = Math.sin(time * 0.32 + this.id * 2) * 1.1 + (this.id - 2) * 1.5;
    for (const other of karts) {
      if (other === this) continue;
      const offset = other.position.clone().sub(this.position);
      const ahead = offset.dot(near.direction);
      if (ahead > 0 && ahead < 11 && offset.length() < 12) {
        lane += near.lateral > this.path.nearest(other.position).lateral ? 2.5 : -2.5;
      }
    }
    lane = THREE.MathUtils.clamp(lane, -4.6, 4.6);
    const target = this.path.sample(near.t + lookAhead / this.path.length, lane);
    const desired = Math.atan2(target.x - this.position.x, target.z - this.position.z);
    const angle =
      THREE.MathUtils.euclideanModulo(desired - this.heading + Math.PI, Math.PI * 2) - Math.PI;
    const bend = this.path.tangent(near.t + 23 / this.path.length).angleTo(near.direction);
    const targetSpeed =
      CONFIG.maxSpeed *
      DIFFICULTY[this.difficulty] *
      (0.97 + this.id * 0.015) *
      THREE.MathUtils.clamp(1 - bend * 0.44, 0.52, 1);
    return {
      throttle: this.speed < targetSpeed ? 1 : this.speed > targetSpeed + 2 ? -0.45 : 0,
      steer: THREE.MathUtils.clamp(angle * 2.4, -1, 1),
      drift: false,
    };
  }
}
