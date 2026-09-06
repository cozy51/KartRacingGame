import * as THREE from 'three';
import { Kart } from '../kart/Kart';
interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}
export class ParticleSystem {
  readonly capacity = 360;
  mesh: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private cursor = 0;
  private dummy = new THREE.Object3D();
  private cadence = 0;
  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false }),
      this.capacity,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }
  emit(position: THREE.Vector3, color: number, size = 0.16, count = 8, power = 2) {
    for (let i = 0; i < count; i++) {
      const p: Particle = {
        position: position.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * power,
          Math.random() * power + 1,
          (Math.random() - 0.5) * power,
        ),
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        size,
        color: new THREE.Color(color),
      };
      if (this.particles.length < this.capacity) this.particles.push(p);
      else this.particles[this.cursor++ % this.capacity] = p;
    }
  }
  update(dt: number, karts: Kart[], active: boolean) {
    this.cadence += dt;
    if (active && this.cadence > 0.035) {
      this.cadence = 0;
      for (const k of karts) {
        const back = new THREE.Vector3(-Math.sin(k.heading), 0, -Math.cos(k.heading));
        const rear = k.position.clone().addScaledVector(back, 1.15);
        rear.y += 0.3;
        if (k.drifting) {
          for (const side of [-1, 1]) {
            const p = rear
              .clone()
              .add(
                new THREE.Vector3(
                  Math.cos(k.heading) * side * 0.9,
                  0,
                  -Math.sin(k.heading) * side * 0.9,
                ),
              );
            this.emit(p, 0xc8d5c0, 0.23, 1, 1);
            if (k.driftLevel > 0)
              this.emit(p, [0, 0x75ead5, 0xffc368, 0xeb8fcc][k.driftLevel], 0.1, 2, 3);
          }
        }
        if (k.boostTime > 0) {
          this.emit(rear, 0xffb167, 0.2, 3, 1);
          this.emit(rear.addScaledVector(back, 0.7), 0x9ff8d7, 0.13, 2, 1);
        }
      }
    }
    let visible = 0;
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.velocity.y -= dt * 1.7;
      p.position.addScaledVector(p.velocity, dt);
      this.dummy.position.copy(p.position);
      this.dummy.scale.setScalar(p.size * Math.min(1, p.life / 0.22));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(visible, this.dummy.matrix);
      this.mesh.setColorAt(visible, p.color);
      visible++;
    }
    this.mesh.count = visible;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  reset() {
    this.particles = [];
    this.mesh.count = 0;
  }
}
