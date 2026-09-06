import * as THREE from 'three';
export class WaypointSystem {
  readonly count = 900;
  readonly curve: THREE.CatmullRomCurve3;
  readonly points: THREE.Vector3[];
  readonly length: number;
  constructor() {
    const raw = [
      [0, 0, -100],
      [0, 0, 0],
      [0, 0, 100],
      [48, 3, 151],
      [113, 9, 131],
      [140, 12, 67],
      [103, 8, 24],
      [68, 4, 57],
      [49, 2, 22],
      [95, 0, -35],
      [134, 0, -104],
      [87, 0, -151],
      [29, 0, -172],
      [-57, 0, -150],
      [-126, 2, -91],
      [-136, 5, 0],
      [-100, 3, 78],
      [-58, 0, 88],
      [-42, 0, 40],
      [-65, 0, -22],
      [-54, 0, -86],
    ];
    this.curve = new THREE.CatmullRomCurve3(
      raw.map((p) => new THREE.Vector3(p[0] * 0.82, p[1], p[2] * 0.82)),
      true,
      'catmullrom',
      0.3,
    );
    this.curve.arcLengthDivisions = 3000;
    this.curve.updateArcLengths();
    this.points = Array.from({ length: this.count }, (_, i) =>
      this.curve.getPointAt(i / this.count),
    );
    this.length = this.curve.getLength();
  }
  point(t: number) {
    return this.curve.getPointAt(THREE.MathUtils.euclideanModulo(t, 1));
  }
  tangent(t: number) {
    return this.curve.getTangentAt(THREE.MathUtils.euclideanModulo(t, 1)).normalize();
  }
  sample(t: number, lane = 0) {
    const p = this.point(t),
      d = this.tangent(t);
    return p.add(new THREE.Vector3(d.z, 0, -d.x).multiplyScalar(lane));
  }
  nearest(position: THREE.Vector3) {
    let index = 0,
      best = Infinity;
    for (let i = 0; i < this.count; i++) {
      const p = this.points[i];
      const d = (p.x - position.x) ** 2 + (p.z - position.z) ** 2;
      if (d < best) {
        best = d;
        index = i;
      }
    }
    const t = index / this.count,
      point = this.points[index],
      direction = this.tangent(t);
    return {
      index,
      t,
      point,
      distance: Math.sqrt(best),
      lateral: (position.x - point.x) * direction.z - (position.z - point.z) * direction.x,
      direction,
    };
  }
}
