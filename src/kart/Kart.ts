import * as THREE from 'three';
import { box, cylinder } from '../utils/mesh';
import { CONFIG } from '../config';
import { Track } from '../track/Track';
export interface Controls {
  throttle: number;
  steer: number;
  drift: boolean;
}
export class Kart {
  readonly mesh = new THREE.Group();
  readonly body = new THREE.Group();
  readonly wheels: THREE.Group[] = [];
  position = new THREE.Vector3(0, 0, 0);
  velocity = new THREE.Vector3();
  heading = 0;
  speed = 0;
  steering = 0;
  driftTime = 0;
  drifting = false;
  driftLevel = 0;
  boostTime = 0;
  verticalSpeed = 0;
  airborne = false;
  landing = 0;
  fallTime = 0;
  rampCooldown = 0;
  shieldTime = 0;
  stunTime = 0;
  item: 'Turbo' | 'Missile' | 'Mine' | 'Shield' | null = null;
  landed = false;
  boostStarted = false;
  constructor(
    public id: number,
    public name: string,
    public color: number,
  ) {
    this.mesh.add(this.body);
    this.body.add(
      box(1.65, 0.45, 2.7, color, 0, 0.7),
      box(1.35, 0.25, 1.1, color, 0, 0.88, 1),
      box(1.65, 0.17, 0.2, 0x22323e, 0, 0.45, 1.55),
      box(1.7, 0.2, 0.2, 0x22323e, 0, 0.45, -1.45),
      box(0.8, 0.7, 0.4, 0x23323d, 0, 1, -0.65),
    );
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xffe4c0 }),
    );
    head.position.set(0, 1.68, -0.3);
    head.castShadow = true;
    this.body.add(head);
    this.body.add(
      box(0.62, 0.55, 0.55, 0xeff4e5, 0, 1.12, -0.3),
      box(0.57, 0.15, 0.25, 0x163849, 0, 1.72, 0.01),
    );
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color }),
    );
    helmet.position.set(0, 1.72, -0.3);
    this.body.add(helmet);
    const steer = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.045, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0x182d34 }),
    );
    steer.rotation.x = -0.7;
    steer.position.set(0, 1.16, 0.42);
    this.body.add(steer);
    for (const z of [-0.92, 0.92])
      for (const x of [-0.94, 0.94]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.4, z);
        const wheel = cylinder(0.39, 0.32, 0x192d34);
        wheel.rotation.z = Math.PI / 2;
        pivot.add(wheel);
        const hub = cylinder(0.21, 0.34, 0xffebbd);
        hub.rotation.z = Math.PI / 2;
        pivot.add(hub);
        this.wheels.push(pivot);
        this.mesh.add(pivot);
      }
  }
  drive(dt: number, controls: Controls) {
    this.boostStarted = false;
    this.boostTime = Math.max(0, this.boostTime - dt);
    this.stunTime = Math.max(0, this.stunTime - dt);
    this.shieldTime = Math.max(0, this.shieldTime - dt);
    const drift =
      controls.drift &&
      Math.abs(controls.steer) > 0.1 &&
      this.speed > 9 &&
      !this.airborne &&
      this.stunTime === 0;
    if (drift) {
      this.driftTime += dt;
      this.driftLevel =
        this.driftTime > 2.3 ? 3 : this.driftTime > 1.4 ? 2 : this.driftTime > 0.65 ? 1 : 0;
    } else if (this.drifting) {
      if (!controls.drift && this.driftLevel > 0) this.boost(0.45 + this.driftLevel * 0.45);
      this.driftTime = 0;
      this.driftLevel = 0;
    }
    this.drifting = drift;
    if (this.stunTime > 0) {
      this.speed *= Math.exp(-6 * dt);
      controls = { throttle: 0, steer: 0, drift: false };
    }
    this.speed +=
      controls.throttle * (controls.throttle < 0 && this.speed > 0 ? 28 : CONFIG.acceleration) * dt;
    if (this.boostTime > 0) this.speed += 30 * dt;
    this.speed *= Math.exp(-(controls.throttle === 0 && this.boostTime <= 0 ? 1.05 : 0.18) * dt);
    this.speed = THREE.MathUtils.clamp(this.speed, -9, this.boostTime > 0 ? 45 : CONFIG.maxSpeed);
    this.steering = THREE.MathUtils.damp(this.steering, controls.steer, 9, dt);
    this.heading +=
      this.steering *
      (1.85 - 0.65 * Math.min(Math.abs(this.speed) / CONFIG.maxSpeed, 1)) *
      (drift ? 1.3 : 1) *
      (this.airborne ? 0.5 : 1) *
      Math.min(Math.abs(this.speed) / 6, 1) *
      Math.sign(this.speed) *
      dt;
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.velocity.lerp(
      forward.multiplyScalar(this.speed),
      1 - Math.exp(-(drift ? 2.1 : this.airborne ? 1.5 : 8) * dt),
    );
    this.position.addScaledVector(this.velocity, dt);
  }
  boost(duration: number) {
    this.boostTime = Math.max(this.boostTime, duration);
    this.speed = Math.max(this.speed, 32);
    this.boostStarted = true;
  }
  surface(dt: number, track: Track) {
    this.landed = false;
    this.rampCooldown = Math.max(0, this.rampCooldown - dt);
    this.landing = Math.max(0, this.landing - dt * 2.8);
    const near = track.path.nearest(this.position);
    if (near.distance > 48 || this.fallTime > 0) {
      this.fallTime += dt;
      this.verticalSpeed -= 22 * dt;
      this.position.y += this.verticalSpeed * dt;
      return this.fallTime > 2;
    }
    if (near.distance > track.width / 2 && !this.airborne) this.speed *= Math.exp(-2.5 * dt);
    if (near.distance > 10 && near.distance < 13 && !this.airborne) {
      const side = Math.sign(near.lateral);
      const normal = new THREE.Vector3(near.direction.z, 0, -near.direction.x);
      this.position.addScaledVector(normal, -side * (near.distance - 9.9));
      this.speed *= 0.92;
      this.velocity.multiplyScalar(0.8);
    }
    const rampDist = (near.t - track.rampT) * track.path.length;
    if (
      !this.airborne &&
      this.rampCooldown === 0 &&
      Math.abs(near.lateral) < 6 &&
      rampDist >= -3.5 &&
      rampDist < 4 &&
      this.speed > 12
    ) {
      this.position.y = near.point.y + Math.max(0, ((rampDist + 3.5) / 7) * 1.8);
      if (rampDist > 2) {
        this.airborne = true;
        this.verticalSpeed = 9 + this.speed * 0.07;
        this.rampCooldown = 2;
      }
    } else if (!this.airborne) this.position.y = near.point.y;
    if (this.airborne) {
      this.verticalSpeed -= 25 * dt;
      this.position.y += this.verticalSpeed * dt;
      if (this.position.y <= near.point.y && this.verticalSpeed < 0) {
        this.position.y = near.point.y;
        this.airborne = false;
        this.verticalSpeed = 0;
        this.landing = 1;
        this.landed = true;
      }
    }
    return false;
  }
  resetEffects() {
    this.driftTime = 0;
    this.driftLevel = 0;
    this.drifting = false;
    this.boostTime = 0;
    this.verticalSpeed = 0;
    this.airborne = false;
    this.landing = 0;
    this.fallTime = 0;
    this.rampCooldown = 0;
    this.shieldTime = 0;
    this.stunTime = 0;
    this.item = null;
  }
  update(dt: number) {
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
    this.body.rotation.z = THREE.MathUtils.damp(
      this.body.rotation.z,
      this.drifting ? -this.steering * 0.14 : 0,
      8,
      dt,
    );
    this.body.rotation.y = THREE.MathUtils.damp(
      this.body.rotation.y,
      this.drifting ? this.steering * 0.18 : 0,
      7,
      dt,
    );
    this.body.rotation.x = THREE.MathUtils.damp(
      this.body.rotation.x,
      this.airborne ? -this.verticalSpeed * 0.018 : 0,
      5,
      dt,
    );
    this.body.position.y = -Math.sin(this.landing * Math.PI) * 0.23;
    for (let i = 0; i < this.wheels.length; i++) {
      const wheel = this.wheels[i];
      wheel.rotation.y = i > 1 ? this.steering * 0.4 : 0;
      for (const part of wheel.children) part.rotateY((this.speed * dt) / 0.39);
    }
  }
}
