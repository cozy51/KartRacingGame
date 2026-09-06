import * as THREE from 'three';
import { Kart } from '../kart/Kart';
import { Track } from '../track/Track';
import { ItemBox } from './ItemBox';
export type ItemType = 'Turbo' | 'Missile' | 'Mine' | 'Shield';
interface Projectile {
  mesh: THREE.Mesh;
  type: 'Missile' | 'Mine';
  owner: Kart;
  target: Kart | null;
  velocity: THREE.Vector3;
  life: number;
  age: number;
}
export class ItemManager {
  boxes: ItemBox[] = [];
  projectiles: Projectile[] = [];
  bubbles = new Map<number, THREE.Mesh>();
  events: { type: 'pickup' | 'hit' | 'boost'; position: THREE.Vector3; player: boolean }[] = [];
  timers = new Map<number, number>();
  constructor(
    private scene: THREE.Scene,
    private track: Track,
    private karts: Kart[],
  ) {
    for (const t of [0.073, 0.265, 0.439, 0.657, 0.836])
      for (const lane of [-4, 0, 4]) {
        const box = new ItemBox(track.path.sample(t, lane));
        this.boxes.push(box);
        scene.add(box.mesh);
      }
    for (const kart of karts) {
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(1.8, 16, 12),
        new THREE.MeshStandardMaterial({
          color: 0x71ead7,
          transparent: true,
          opacity: 0.22,
          emissive: 0x39aa98,
          wireframe: true,
        }),
      );
      bubble.visible = false;
      scene.add(bubble);
      this.bubbles.set(kart.id, bubble);
    }
  }
  update(dt: number, time: number, active: boolean) {
    for (const box of this.boxes) {
      box.update(dt, time);
      if (!active || box.cooldown > 0) continue;
      for (const kart of this.karts) {
        if (!kart.item && kart.position.distanceTo(box.position) < 2.5) {
          const types: ItemType[] = ['Turbo', 'Missile', 'Mine', 'Shield'];
          kart.item = types[Math.floor(Math.random() * types.length)];
          box.cooldown = 5;
          box.mesh.visible = false;
          this.events.push({
            type: 'pickup',
            position: box.mesh.position.clone(),
            player: kart.id === 0,
          });
          break;
        }
      }
    }
    for (const kart of this.karts) {
      const bubble = this.bubbles.get(kart.id)!;
      bubble.position.copy(kart.position).add(new THREE.Vector3(0, 1, 0));
      bubble.visible = kart.shieldTime > 0;
      bubble.rotation.y += dt;
      if (active && kart.id !== 0) {
        const timer = (this.timers.get(kart.id) ?? 0) + dt;
        this.timers.set(kart.id, timer);
        if (kart.item && timer > 2.2 + kart.id * 0.6) {
          this.use(kart);
          this.timers.set(kart.id, 0);
        }
      }
    }
    if (!active) return;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.age += dt;
      if (p.type === 'Missile') {
        if (p.target) {
          const desired = p.target.position
            .clone()
            .add(new THREE.Vector3(0, 0.9, 0))
            .sub(p.mesh.position)
            .normalize()
            .multiplyScalar(49);
          p.velocity.lerp(desired, 1 - Math.exp(-4 * dt));
        }
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.lookAt(p.mesh.position.clone().add(p.velocity));
      } else p.mesh.rotation.y += dt;
      let hit = false;
      for (const kart of this.karts) {
        if (kart === p.owner && p.age < 1.4) continue;
        if (
          kart.position
            .clone()
            .add(new THREE.Vector3(0, 0.8, 0))
            .distanceTo(p.mesh.position) < 1.55
        ) {
          if (kart.shieldTime <= 0) {
            kart.stunTime = 1.15;
            kart.speed *= 0.25;
            kart.boostTime = 0;
          } else kart.shieldTime = 0;
          hit = true;
          this.events.push({
            type: 'hit',
            position: p.mesh.position.clone(),
            player: kart.id === 0,
          });
          break;
        }
      }
      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }
  use(kart: Kart) {
    const type = kart.item;
    if (!type) return false;
    kart.item = null;
    if (type === 'Turbo') {
      kart.boost(2.5);
      this.events.push({ type: 'boost', position: kart.position.clone(), player: kart.id === 0 });
      return true;
    }
    if (type === 'Shield') {
      kart.shieldTime = 6;
      return true;
    }
    const forward = new THREE.Vector3(Math.sin(kart.heading), 0, Math.cos(kart.heading));
    const candidates = this.karts
      .filter((k) => k !== kart && k.position.clone().sub(kart.position).dot(forward) > 0)
      .sort(
        (a, b) =>
          a.position.distanceToSquared(kart.position) - b.position.distanceToSquared(kart.position),
      );
    const geo =
      type === 'Mine'
        ? new THREE.IcosahedronGeometry(0.8, 0)
        : new THREE.ConeGeometry(0.36, 1.4, 8);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: type === 'Mine' ? 0xf7ba5c : 0xf16f67,
        emissive: type === 'Mine' ? 0x61431a : 0x862828,
        emissiveIntensity: 0.35,
      }),
    );
    mesh.castShadow = true;
    mesh.position.copy(kart.position).addScaledVector(forward, type === 'Mine' ? -2.8 : 2.4);
    mesh.position.y += 0.7;
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      type,
      owner: kart,
      target: type === 'Missile' ? (candidates[0] ?? null) : null,
      velocity: forward.multiplyScalar(49),
      life: type === 'Mine' ? 18 : 6,
      age: 0,
    });
    return true;
  }
  reset() {
    for (const box of this.boxes) box.cooldown = 0;
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.projectiles = [];
    this.timers.clear();
    this.events = [];
  }
}
