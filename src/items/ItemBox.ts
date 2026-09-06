import * as THREE from 'three';
export class ItemBox {
  mesh = new THREE.Group();
  cooldown = 0;
  constructor(public position: THREE.Vector3) {
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.95),
      new THREE.MeshStandardMaterial({
        color: 0x7af4cf,
        emissive: 0x2a9e90,
        emissiveIntensity: 0.5,
        metalness: 0.3,
        roughness: 0.25,
      }),
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.065, 6, 20),
      new THREE.MeshStandardMaterial({
        color: 0xffefb7,
        emissive: 0xffd083,
        emissiveIntensity: 0.4,
      }),
    );
    ring.rotation.x = Math.PI / 3;
    this.mesh.add(core, ring);
    this.mesh.position.copy(position);
  }
  update(dt: number, time: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.mesh.visible = this.cooldown === 0;
    this.mesh.rotation.y += dt * 1.3;
    this.mesh.position.y = this.position.y + 1.5 + Math.sin(time * 2 + this.position.x) * 0.25;
  }
}
