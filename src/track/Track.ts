import * as THREE from 'three';
import { WaypointSystem } from './WaypointSystem';
import { box, cylinder } from '../utils/mesh';
import { CONFIG } from '../config';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export class Track {
  readonly mesh = new THREE.Group();
  readonly path = new WaypointSystem();
  readonly width = CONFIG.roadWidth;
  readonly rampT = 0.205;
  constructor() {
    this.terrain();
    this.ribbon(-this.width / 2, this.width / 2, 0x485c61, 0.02);
    this.ribbon(-8.3, -7.5, 0xf1e7ca, 0.06);
    this.ribbon(7.5, 8.3, 0xf1e7ca, 0.06);
    for (let i = 0; i < 360; i++) {
      const t = i / 360,
        p = this.path.point(t),
        d = this.path.tangent(t),
        angle = Math.atan2(d.x, d.z);
      if (i % 2 === 0) {
        for (const side of [-1, 1]) {
          const curb = box(
            0.8,
            0.1,
            this.path.length / 360 + 0.08,
            i % 4 === 0 ? 0xf18566 : 0xffefce,
          );
          curb.position.copy(this.path.sample(t, side * 7.9));
          curb.position.y += 0.11;
          curb.rotation.y = angle;
          this.mesh.add(curb);
        }
      }
      if (i % 3 === 0) {
        const dash = box(0.12, 0.025, 2.7, 0xccd6c6);
        dash.position.copy(p);
        dash.position.y += 0.05;
        dash.rotation.y = angle;
        this.mesh.add(dash);
      }
      if (i % 2 === 0)
        for (const side of [-1, 1]) {
          const rail = box(0.28, 0.43, this.path.length / 180 + 0.3, 0xe4e6d7);
          rail.position.copy(this.path.sample(t, side * 10.4));
          rail.position.y += 1;
          rail.rotation.y = angle;
          this.mesh.add(rail);
          const post = box(0.25, 1, 0.25, 0x3c7971);
          post.position.copy(rail.position);
          post.position.y -= 0.5;
          this.mesh.add(post);
        }
    }
    this.start();
    this.ramp();
    this.tunnel();
    this.scenery();
    this.batchStaticGeometry();
  }
  private terrain() {
    const g = new THREE.PlaneGeometry(430, 465, 110, 120);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const p = new THREE.Vector3(pos.getX(i), 0, pos.getZ(i)),
        near = this.path.nearest(p);
      pos.setY(i, near.point.y * Math.exp(-Math.max(0, near.distance - 10) * 0.06) - 0.8);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x94bc80, roughness: 1 }));
    m.receiveShadow = true;
    this.mesh.add(m);
  }
  private batchStaticGeometry() {
    this.mesh.updateMatrixWorld(true);
    const groups = new Map<
      string,
      {
        geometries: THREE.BufferGeometry[];
        material: THREE.MeshStandardMaterial;
        meshes: THREE.Mesh[];
      }
    >();
    this.mesh.traverse((obj) => {
      if (
        !(obj instanceof THREE.Mesh) ||
        obj instanceof THREE.InstancedMesh ||
        Array.isArray(obj.material)
      )
        return;
      const material = obj.material as THREE.MeshStandardMaterial;
      if (material.map) return;
      const key = `${material.color.getHex()}-${material.roughness}-${material.side}`;
      let group = groups.get(key);
      if (!group) {
        group = { geometries: [], material, meshes: [] };
        groups.set(key, group);
      }
      let geometry = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
      if (geometry.index) geometry = geometry.toNonIndexed();
      if (!geometry.getAttribute('uv'))
        geometry.setAttribute(
          'uv',
          new THREE.Float32BufferAttribute(
            new Float32Array(geometry.getAttribute('position').count * 2),
            2,
          ),
        );
      group.geometries.push(geometry);
      group.meshes.push(obj);
    });
    for (const group of groups.values()) {
      const merged = mergeGeometries(group.geometries);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, group.material);
      mesh.castShadow = group.meshes.some((m) => m.castShadow);
      mesh.receiveShadow = true;
      for (const original of group.meshes) {
        original.removeFromParent();
        original.geometry.dispose();
        if (original.material !== group.material) (original.material as THREE.Material).dispose();
      }
      for (const geometry of group.geometries) geometry.dispose();
      this.mesh.add(mesh);
    }
  }
  private ribbon(left: number, right: number, color: number, lift: number) {
    const vertices: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= this.path.count; i++) {
      for (const side of [left, right]) {
        const p = this.path.sample(i / this.path.count, side);
        vertices.push(p.x, p.y + lift, p.z);
      }
      if (i < this.path.count) {
        const j = i * 2;
        indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide }),
    );
    m.receiveShadow = true;
    this.mesh.add(m);
  }
  sign(text: string, width: number, height: number, color = '#183a40', ink = '#fff5d6') {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = ink;
    ctx.font = '900 96px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 130, 970);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.35), [
      new THREE.MeshStandardMaterial({ color: 0x204b4c }),
      new THREE.MeshStandardMaterial({ color: 0x204b4c }),
      new THREE.MeshStandardMaterial({ color: 0x204b4c }),
      new THREE.MeshStandardMaterial({ color: 0x204b4c }),
      new THREE.MeshStandardMaterial({ map: texture }),
      new THREE.MeshStandardMaterial({ map: texture }),
    ]);
  }
  private start() {
    const g = new THREE.Group();
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 3; j++)
        g.add(
          box(1.25, 0.04, 0.8, (i + j) % 2 ? 0x21434a : 0xfff3d8, -6.875 + i * 1.25, 0.09, j * 0.8),
        );
    for (const x of [-10, 10])
      g.add(box(0.75, 8, 0.75, 0xecc49b, x, 4), box(1.6, 0.4, 1.6, 0x1e6264, x, 0.2));
    const sign = this.sign('SUN COVE  /  RACEWAY', 21, 2);
    sign.position.y = 7;
    g.add(sign);
    const p = this.path.point(0),
      d = this.path.tangent(0);
    g.position.copy(p);
    g.rotation.y = Math.atan2(d.x, d.z);
    this.mesh.add(g);
  }
  private ramp() {
    const ramp = new THREE.Group();
    const depth = 7;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [-6, 0, -depth / 2, 6, 0, -depth / 2, -6, 1.8, depth / 2, 6, 1.8, depth / 2],
        3,
      ),
    );
    g.setIndex([0, 2, 1, 1, 2, 3]);
    g.computeVertexNormals();
    ramp.add(
      new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color: 0xf5b757, side: THREE.DoubleSide }),
      ),
    );
    for (const x of [-3, 0, 3]) {
      const arrow = this.sign('↑', 1.6, 2, '#f5b757', '#fff4d6');
      arrow.rotation.x = -Math.PI / 2 + 0.25;
      arrow.position.set(x, 1, 0);
      ramp.add(arrow);
    }
    ramp.position.copy(this.path.point(this.rampT));
    ramp.position.y += 0.1;
    const d = this.path.tangent(this.rampT);
    ramp.rotation.y = Math.atan2(d.x, d.z);
    this.mesh.add(ramp);
  }
  private tunnel() {
    for (let i = 0; i < 13; i++) {
      const t = 0.568 + i * 0.003,
        p = this.path.point(t),
        d = this.path.tangent(t);
      const g = new THREE.Group();
      g.add(
        box(1.3, 7, 4.3, 0x46736a, -9, 3),
        box(1.3, 7, 4.3, 0x46736a, 9, 3),
        box(19, 1.5, 4.3, 0x6e9881, 0, 7),
      );
      if (i % 3 === 0) g.add(box(13, 0.1, 0.18, 0xffda86, 0, 6.1));
      g.position.copy(p);
      g.rotation.y = Math.atan2(d.x, d.z);
      this.mesh.add(g);
    }
  }
  private scenery() {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(2200, 2200),
      new THREE.MeshStandardMaterial({ color: 0x5ab9c5, roughness: 0.45 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -10;
    sea.receiveShadow = true;
    this.mesh.add(sea);
    const island = cylinder(1, 9, 0xd7bc87, 0, -6, 0, 64);
    island.scale.set(220, 1, 239);
    this.mesh.add(island);
    const grass = cylinder(1, 0.6, 0x94bc80, 0, -1.2, 0, 64);
    grass.scale.set(211, 1, 230);
    this.mesh.add(grass);
    let seed = 71;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.4, 0.65, 3.7, 6),
      new THREE.MeshStandardMaterial({ color: 0xa17c58 }),
      150,
    );
    const leaves = new THREE.InstancedMesh(
      new THREE.ConeGeometry(3.1, 7, 7),
      new THREE.MeshStandardMaterial({ color: 0x427c64 }),
      150,
    );
    const m = new THREE.Object3D();
    let n = 0;
    for (let attempt = 0; n < 150 && attempt < 3000; attempt++) {
      const x = (rand() - 0.5) * 380,
        z = (rand() - 0.5) * 410,
        p = new THREE.Vector3(x, 0, z),
        near = this.path.nearest(p);
      if (near.distance < 17 || (x * x) / 205 ** 2 + (z * z) / 220 ** 2 > 0.92) continue;
      const ground = near.distance < 37 ? near.point.y : -1;
      const scale = 0.65 + rand() * 0.8;
      m.scale.setScalar(scale);
      m.rotation.y = rand() * 6.28;
      m.position.set(x, ground + 1.8 * scale, z);
      m.updateMatrix();
      trunks.setMatrixAt(n, m.matrix);
      m.position.y = ground + 6 * scale;
      m.updateMatrix();
      leaves.setMatrixAt(n, m.matrix);
      leaves.setColorAt(
        n,
        new THREE.Color().setHSL(0.39 + rand() * 0.05, 0.28, 0.3 + rand() * 0.16),
      );
      n++;
    }
    trunks.count = leaves.count = n;
    trunks.castShadow = leaves.castShadow = true;
    this.mesh.add(trunks, leaves);
    for (let i = 0; i < 8; i++) {
      const t = 0.07 + i * 0.115,
        g = new THREE.Group();
      const sign = this.sign(
        i % 2 ? 'FIND YOUR FAST.' : 'TURBO / CLUB',
        10,
        2.5,
        i % 2 ? '#ee835f' : '#20575a',
      );
      sign.position.y = 4;
      g.add(sign, box(0.3, 4, 0.3, 0xe3c3a0, -4, 2), box(0.3, 4, 0.3, 0xe3c3a0, 4, 2));
      g.position.copy(this.path.sample(t, 15));
      const d = this.path.tangent(t);
      g.rotation.y = Math.atan2(d.x, d.z) - 0.5;
      this.mesh.add(g);
    }
    for (let i = 0; i < 7; i++) {
      const t = 0.01 + i * 0.008,
        g = new THREE.Group();
      g.add(
        box(9, 5, 6, [0xf4cd8c, 0xed9c7d, 0x7ca7a0][i % 3], 0, 2.5),
        box(10, 0.6, 7, 0xf1e2bc, 0, 5.3),
      );
      for (const x of [-2.5, 0, 2.5]) g.add(box(1.5, 1.5, 0.1, 0x315b62, x, 3.1, 3.1));
      g.position.copy(this.path.sample(t, -21));
      g.rotation.y = Math.PI / 2;
      this.mesh.add(g);
    }
    const stands = new THREE.Group();
    for (let r = 0; r < 5; r++) {
      stands.add(box(6 + r * 1.8, 0.6, 36, 0xe6ca98, -r * 0.8, r * 0.9));
      for (let j = 0; j < 24; j++) {
        const person = cylinder(
          0.3,
          0.85,
          [0xec8660, 0xf4d99b, 0x598b9a, 0xede9d6][j % 4],
          -r * 1.55,
          r * 0.9 + 0.7,
          -16 + j * 1.4,
          6,
        );
        stands.add(person);
      }
    }
    stands.position.copy(this.path.sample(0.048, 25));
    this.mesh.add(stands);
    const tireGeo = new THREE.TorusGeometry(0.65, 0.27, 6, 10);
    const tires = new THREE.InstancedMesh(
      tireGeo,
      new THREE.MeshStandardMaterial({ color: 0x293c42 }),
      72,
    );
    let k = 0;
    for (let i = 0; i < 36; i++)
      for (let level = 0; level < 2; level++) {
        m.scale.setScalar(1);
        m.position.copy(this.path.sample(0.3 + i * 0.0015, -11.8));
        m.position.y += 0.4 + level * 0.5;
        m.rotation.set(Math.PI / 2, 0, 0);
        m.updateMatrix();
        tires.setMatrixAt(k++, m.matrix);
      }
    tires.castShadow = true;
    this.mesh.add(tires);
    for (let i = 0; i < 16; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(1, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xfff6df, roughness: 1 }),
        );
        puff.position.set(j * 9, j === 1 ? 3 : 0, 0);
        puff.scale.set(10, 4, 5);
        cloud.add(puff);
      }
      cloud.position.set(Math.cos(i) * 340, 65 + (i % 3) * 12, Math.sin(i) * 340);
      this.mesh.add(cloud);
    }
  }
}
