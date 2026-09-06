import * as THREE from 'three';
import { PlayerKart } from '../kart/PlayerKart';
import { Input } from '../utils/Input';
import { ChaseCamera } from '../camera/ChaseCamera';
import { Track } from '../track/Track';
import { RaceManager } from './RaceManager';
import { AIKart } from '../kart/AIKart';
import { Kart, type Controls } from '../kart/Kart';
import { ItemManager } from '../items/ItemManager';
import { GameUI } from '../ui/GameUI';
import { ParticleSystem } from '../effects/ParticleSystem';
import { AudioManager } from '../audio/AudioManager';
export class Game {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 1600);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  input = new Input();
  player = new PlayerKart(this.input);
  chase = new ChaseCamera(this.camera);
  last = 0;
  track = new Track();
  karts: Kart[] = [
    this.player,
    new AIKart(1, 'NOVA', 0x69c5b7, this.track.path),
    new AIKart(2, 'MILO', 0xfac65f, this.track.path),
    new AIKart(3, 'ECHO', 0x9a8acf, this.track.path),
  ];
  race = new RaceManager(this.track.path, this.karts);
  items = new ItemManager(this.scene, this.track, this.karts);
  particles = new ParticleSystem(this.scene);
  audio = new AudioManager();
  beep = 0;
  previousLap = 1;
  ui = new GameUI(
    this.track,
    () => this.start(),
    () => this.race.pause(),
    () => {
      this.race.reset();
      this.items.reset();
      this.particles.reset();
    },
    (v) => this.audio.setVolume(v),
  );
  constructor() {
    this.scene.background = new THREE.Color(0xb4e4e5);
    this.scene.fog = new THREE.Fog(0xb4e4e5, 160, 700);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0xb4e4e5);
    document.querySelector('#app')!.append(this.renderer.domElement);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffeed3, 2.5);
    sun.position.set(70, 120, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, far: 400 });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.scene.add(this.track.mesh, ...this.karts.map((k) => k.mesh));
    this.camera.position.copy(this.player.position).add(new THREE.Vector3(7, 6, -10));
    this.camera.lookAt(this.player.position);
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    requestAnimationFrame(this.frame);
    addEventListener('blur', () => {
      if (this.race.state === 'racing' || this.race.state === 'countdown') this.race.pause();
    });
  }
  start() {
    this.items.reset();
    this.particles.reset();
    this.race.start();
    this.input.clear();
    this.beep = 0;
    this.previousLap = 1;
    this.audio.setVolume(this.ui.volume);
    this.audio.start();
    for (const kart of this.karts) if (kart instanceof AIKart) kart.difficulty = this.ui.difficulty;
  }
  step(dt: number, pilot?: Controls) {
    if (this.input.take('Escape')) this.race.pause();
    this.race.tick(dt);
    const active = this.race.state === 'racing',
      frozen = this.race.state === 'paused' || this.race.state === 'finished';
    if (this.race.state === 'countdown') {
      const value = Math.min(3, Math.ceil(this.race.countdown));
      if (value !== this.beep) {
        this.beep = value;
        this.audio.countdown();
      }
    } else if (active && this.beep !== -1) {
      this.beep = -1;
      this.audio.countdown(true);
    }
    if (active) {
      for (const kart of this.karts) {
        kart.drive(
          dt,
          kart instanceof AIKart
            ? kart.controls(this.karts, this.race.elapsed)
            : (pilot ?? this.player.controls()),
        );
        if (kart.surface(dt, this.track)) {
          this.race.recover(kart);
          if (kart.id === 0) this.ui.notify('チェックポイントに復帰');
        }
        if (kart.landed) this.particles.emit(kart.position, 0xe7d8b4, 0.25, 18, 7);
        if (kart.id === 0 && kart.boostStarted) {
          this.audio.boost();
          this.ui.notify('MINI TURBO!');
        }
        this.race.update(kart);
      }
      if (this.input.take('KeyR')) {
        this.race.recover(this.player);
        this.ui.notify('チェックポイントに復帰');
      }
      if (this.input.take('ShiftLeft') || this.input.take('ShiftRight'))
        this.items.use(this.player);
    }
    this.items.update(frozen ? 0 : dt, this.race.elapsed, active);
    for (const event of this.items.events) {
      this.particles.emit(event.position, event.type === 'hit' ? 0xffad77 : 0x98f3d8, 0.18, 20, 5);
      if (event.player) {
        if (event.type === 'pickup') {
          this.audio.pickup();
          this.ui.notify(`${this.player.item?.toUpperCase()} READY / SHIFT で使用`);
        } else if (event.type === 'boost') this.audio.boost();
        else this.audio.hit();
      }
    }
    this.items.events = [];
    const lap = this.race.progress.get(0)!.lap;
    if (lap !== this.previousLap) {
      this.previousLap = lap;
      this.ui.notify(lap === 3 ? 'FINAL LAP!' : 'LAP 2 / KEEP IT FLOWING');
      this.audio.pickup();
    }
    this.particles.update(frozen ? 0 : dt, this.karts, active);
    this.audio.update(this.player.speed, active);
    for (const kart of this.karts) kart.update(frozen ? 0 : dt);
    this.input.endFrame();
  }
  frame = (time: number) => {
    const dt = Math.min((time - this.last) / 1000, 0.05);
    this.last = time;
    if (!(import.meta.env.DEV && location.search.includes('test=1'))) this.step(dt);
    if (this.race.state === 'menu') {
      const target = new THREE.Vector3(31 + Math.sin(time * 0.000045) * 5, 24, -143);
      this.camera.position.lerp(target, 1 - Math.exp(-dt * 2));
      this.camera.lookAt(-4, 2, -29);
      this.camera.fov = 52;
      this.camera.updateProjectionMatrix();
    } else this.chase.update(this.player, dt);
    this.ui.update(this.race, this.player, dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.frame);
  };
}
