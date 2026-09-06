import * as THREE from 'three';
import { Kart } from '../kart/Kart';
export class ChaseCamera {
  private look = new THREE.Vector3();
  private initialized = false;
  constructor(private camera: THREE.PerspectiveCamera) {}
  update(kart: Kart, dt: number) {
    const forward = new THREE.Vector3(Math.sin(kart.heading), 0, Math.cos(kart.heading));
    const target = kart.position
      .clone()
      .addScaledVector(forward, -10 - Math.abs(kart.speed) * 0.14)
      .add(new THREE.Vector3(0, 5.8, 0));
    if (kart.drifting)
      target.add(new THREE.Vector3(forward.z, 0, -forward.x).multiplyScalar(kart.steering * 1.8));
    this.camera.position.lerp(target, 1 - Math.exp(-5 * dt));
    const lookTarget = kart.position
      .clone()
      .addScaledVector(forward, 6)
      .add(new THREE.Vector3(0, 1.1, 0));
    if (!this.initialized) {
      this.look.copy(lookTarget);
      this.initialized = true;
    }
    this.look.lerp(lookTarget, 1 - Math.exp(-8 * dt));
    this.camera.lookAt(this.look);
    this.camera.fov = THREE.MathUtils.damp(
      this.camera.fov,
      52 + Math.abs(kart.speed) * 0.3 + (kart.boostTime > 0 ? 5 : 0),
      3,
      dt,
    );
    this.camera.updateProjectionMatrix();
  }
}
