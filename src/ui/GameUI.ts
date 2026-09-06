import { CONFIG, type Difficulty } from '../config';
import { RaceManager } from '../game/RaceManager';
import { Kart } from '../kart/Kart';
import { Track } from '../track/Track';
export function formatTime(s: number) {
  if (!Number.isFinite(s)) return '--:--.---';
  const ms = Math.floor(s * 1000);
  return `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, '0')}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, '0')}.${(ms % 1000).toString().padStart(3, '0')}`;
}
const symbols = { Turbo: 'ϟ', Missile: '➤', Mine: '✹', Shield: '⬡' };
export class GameUI {
  root = document.createElement('div');
  difficulty: Difficulty = 'Normal';
  volume = 0.18;
  private map: HTMLCanvasElement;
  private lastState = '';
  private notificationTime = 0;
  constructor(
    readonly track: Track,
    onStart: () => void,
    onPause: () => void,
    onMenu: () => void,
    onVolume: (n: number) => void,
  ) {
    try {
      this.volume = Number(localStorage.getItem('tka-volume') ?? 0.18);
      if (!Number.isFinite(this.volume)) this.volume = 0.18;
      this.volume = Math.max(0, Math.min(1, this.volume));
    } catch {}
    this.root.id = 'ui';
    this.root.innerHTML = `
 <div id="menu" class="menu"><header class="menu-header"><div class="wordmark"><span class="brand-icon">≋</span> TURBO KART<span class="brand-small">RACING CLUB</span></div><span class="edition">ORIGINAL ARCADE SERIES <b> / 01</b></span></header>
 <main class="hero"><div class="eyebrow"><span class="live-dot"></span> A LITTLE COAST. A LOT OF TURBO.</div><h1 aria-label="${CONFIG.title}"><span>TURBO</span><span class="coral">KART</span><span>ARENA<span class="title-star">✳</span></span></h1><p class="hero-copy">海風を切って、限界のその先へ。<br>ドリフトをつないで、きみだけの最速ラインを。</p><div class="race-spec"><span>03 <small>LAPS</small></span><i></i><span>04 <small>RACERS</small></span><i></i><span>∞ <small>GOOD TIMES</small></span></div><div class="difficulty"><span>DIFFICULTY</span><div role="group" aria-label="難易度">${(['Easy', 'Normal', 'Hard'] as const).map((d) => `<button class="difficulty-button ${d === 'Normal' ? 'selected' : ''}" data-difficulty="${d}" aria-pressed="${d === 'Normal'}">${d.toUpperCase()}</button>`).join('')}</div></div><button id="start" class="primary">START RACE <span>↗</span></button><p class="start-hint">キーボードでプレイ <span>•</span> 目指せ、表彰台。</p></main>
 <aside class="course-card"><div class="course-top"><span class="tiny-label">YOUR NEXT ESCAPE</span><span>01 / 01</span></div><div class="course-title">SUN COVE<span>サンコーブ・サーキット</span></div><canvas id="course-map" width="360" height="200" aria-label="コースの全体図"></canvas><div class="course-tags"><span>COASTAL</span><span>↗ ELEVATION</span><span>☀ 26°</span></div></aside><footer class="menu-footer"><span>BUILT FOR THE JOY OF RACING.</span><span>FIND YOUR FAST. <b>✳</b></span></footer></div>
 <div id="hud" hidden><section class="position-panel"><span class="tiny-label">POSITION</span><div><strong id="position">1</strong><span>/ 4</span></div><span class="tiny-label">YOU / CORAL COMET</span></section><section class="timer-panel"><span class="tiny-label">LAP TIME</span><strong id="lap-time">00:00.000</strong><div>BEST <span id="best-time">--:--.---</span></div></section><section class="lap-panel"><div class="lap-heading"><span class="tiny-label">LAP</span><button id="pause-button" class="icon-button" aria-label="ポーズ">Ⅱ</button></div><strong><span id="lap">1</span><small> / ${CONFIG.laps}</small></strong><div class="lap-bars"><i></i><i></i><i></i></div></section><section class="map-panel"><span class="tiny-label">SUN COVE CIRCUIT</span><canvas id="minimap" width="320" height="270" aria-label="カート位置のミニマップ"></canvas><span class="map-legend">🟠 YOU　 ● RIVALS</span></section><section class="item-panel"><div id="item-symbol">◇</div><div><span class="tiny-label">YOUR ITEM</span><strong id="item-name">EMPTY</strong><span id="item-help">クリスタルを集めよう</span></div><kbd>SHIFT</kbd></section><section class="speed-panel"><span id="boost-status">CORAL COMET / 01</span><div><strong id="speed">000</strong><span>km/h</span></div><div class="speed-track"><i id="speed-fill"></i></div><div class="drift-meter"><i></i><i></i><i></i><span id="drift-label">DRIFT CHARGE</span></div></section><div class="race-controls"><span><kbd>W A S D</kbd> DRIVE</span><span><kbd>SPACE</kbd> DRIFT</span><span><kbd>R</kbd> RESET</span><span><kbd>ESC</kbd> PAUSE</span></div><div id="notice" aria-live="polite"></div><div id="countdown"></div><div id="speed-lines"></div><div id="wrong-way" hidden>↶ 逆走しています</div></div>
 <div class="sound-control"><span>◖))</span><input id="volume" aria-label="音量" type="range" min="0" max="1" step=".01" value="${this.volume}"><span id="volume-label">${Math.round(this.volume * 100)}%</span></div>
 <div id="pause" class="modal" hidden><div class="modal-card"><span class="eyebrow">TAKE A BREATHER</span><h2>PIT STOP.</h2><p>ひと息ついたら、コースへ戻ろう。</p><button id="resume" class="primary">RESUME RACE <span>↗</span></button><button id="restart" class="secondary">RESTART</button><button id="back-menu" class="text-button">タイトルへ戻る</button><div class="control-guide">W / ↑ アクセル · S / ↓ ブレーキ・バック<br>A D / ← → ステアリング<br>Space ドリフト · Shift アイテム · R 復帰</div></div></div>
 <div id="finish" class="modal" hidden><div class="modal-card result"><span class="eyebrow">THAT WAS A GOOD RUN.</span><h2>FINISH!</h2><p id="result-subtitle"></p><div id="result-list"></div><div class="result-stats"><div><span>TOTAL TIME</span><b id="result-total"></b></div><div><span>BEST LAP</span><b id="result-best"></b></div></div><div id="result-laps"></div><button id="again" class="primary">RACE AGAIN <span>↗</span></button><button id="finish-menu" class="text-button">タイトルへ戻る</button></div></div>`;
    this.root.querySelectorAll('h1>span').forEach((e, i) => {
      e.childNodes[0].textContent = CONFIG.titleLines[i] ?? '';
    });
    this.root.querySelector('.wordmark')!.childNodes[1].textContent = ` ${CONFIG.brand} `;
    this.root.querySelector('.course-title')!.childNodes[0].textContent = CONFIG.trackShortName;
    this.root.querySelector('.course-title span')!.textContent = CONFIG.trackNameJa;
    this.root.querySelector('.map-panel .tiny-label')!.textContent = CONFIG.trackName.toUpperCase();
    document.body.append(this.root);
    this.map = this.el('minimap') as HTMLCanvasElement;
    this.el('start').onclick = onStart;
    this.el('pause-button').onclick = this.el('resume').onclick = onPause;
    this.el('restart').onclick = this.el('again').onclick = onStart;
    this.el('back-menu').onclick = this.el('finish-menu').onclick = onMenu;
    this.root.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(
      (b) =>
        (b.onclick = () => {
          this.difficulty = b.dataset.difficulty as Difficulty;
          this.root.querySelectorAll('[data-difficulty]').forEach((x) => {
            x.classList.toggle('selected', x === b);
            x.setAttribute('aria-pressed', String(x === b));
          });
        }),
    );
    (this.el('volume') as HTMLInputElement).oninput = (e) => {
      this.volume = Number((e.target as HTMLInputElement).value);
      this.el('volume-label').textContent = `${Math.round(this.volume * 100)}%`;
      onVolume(this.volume);
      try {
        localStorage.setItem('tka-volume', String(this.volume));
      } catch {}
    };
    this.drawMap(this.el('course-map') as HTMLCanvasElement, []);
  }
  el(id: string) {
    return this.root.querySelector<HTMLElement>(`#${id}`)!;
  }
  notify(message: string) {
    this.el('notice').textContent = message;
    this.notificationTime = 2.3;
  }
  update(race: RaceManager, player: Kart, dt: number) {
    const state = race.state;
    this.el('menu').hidden = state !== 'menu';
    this.el('hud').hidden = state === 'menu';
    this.el('pause').hidden = state !== 'paused';
    this.el('finish').hidden = state !== 'finished';
    this.root.dataset.state = state;
    const p = race.progress.get(0)!,
      order = race.order(),
      rank = order.indexOf(player) + 1;
    this.el('position').textContent = String(rank);
    this.el('lap').textContent = String(p.lap);
    this.el('lap-time').textContent = formatTime(
      p.finishedAt !== null ? p.lapTimes.at(-1)! : race.elapsed - p.lapStart,
    );
    this.el('best-time').textContent = formatTime(Math.min(...p.lapTimes));
    this.el('speed').textContent = Math.round(Math.abs(player.speed) * 3.6)
      .toString()
      .padStart(3, '0');
    this.el('speed-fill').style.width = `${Math.min(100, (Math.abs(player.speed) / 45) * 100)}%`;
    this.el('item-symbol').textContent = player.item ? symbols[player.item] : '◇';
    this.el('item-name').textContent = player.item?.toUpperCase() ?? 'EMPTY';
    this.el('item-help').textContent = player.item ? 'Shift で使用' : 'クリスタルを集めよう';
    this.root.querySelector('.item-panel')!.classList.toggle('has-item', !!player.item);
    this.root
      .querySelectorAll('.lap-bars i')
      .forEach((e, i) => e.classList.toggle('active', i < p.lap));
    this.root
      .querySelectorAll('.drift-meter i')
      .forEach((e, i) => e.classList.toggle('active', i < player.driftLevel));
    this.el('drift-label').textContent = player.drifting
      ? `CHARGING / LV.${player.driftLevel}`
      : 'DRIFT CHARGE';
    this.el('boost-status').textContent =
      player.fallTime > 0
        ? 'RECOVERING…'
        : player.shieldTime > 0
          ? 'SHIELD ACTIVE'
          : player.boostTime > 0
            ? 'TURBO ACTIVE'
            : player.airborne
              ? 'CATCHING AIR!'
              : 'CORAL COMET / 01';
    this.el('countdown').textContent =
      state === 'countdown'
        ? String(Math.min(3, Math.ceil(race.countdown)))
        : state === 'racing' && race.elapsed < 0.8
          ? 'GO!'
          : '';
    this.el('speed-lines').classList.toggle('active', player.boostTime > 0 && state === 'racing');
    const n = this.track.path.nearest(player.position);
    this.el('wrong-way').hidden = !(
      state === 'racing' &&
      player.speed > 5 &&
      Math.sin(player.heading) * n.direction.x + Math.cos(player.heading) * n.direction.z < -0.35
    );
    this.notificationTime -= dt;
    this.el('notice').classList.toggle('visible', this.notificationTime > 0);
    this.drawMap(this.map, race.karts);
    if (state === 'finished' && this.lastState !== 'finished') {
      this.el('result-subtitle').textContent =
        rank === 1
          ? '優勝！ 最高のラインを駆け抜けた。'
          : `${rank}位でフィニッシュ。次は、もうひとつ上へ。`;
      this.el('result-list').innerHTML = order
        .map(
          (k, i) =>
            `<div class="result-row ${k.id === 0 ? 'you' : ''}"><span>${String(i + 1).padStart(2, '0')}</span><i style="background:#${k.color.toString(16).padStart(6, '0')}"></i><strong>${k.name}</strong><span>${race.progress.get(k.id)!.finishedAt === null ? 'RACING' : formatTime(race.progress.get(k.id)!.finishedAt!)}</span></div>`,
        )
        .join('');
      this.el('result-total').textContent = formatTime(p.finishedAt!);
      this.el('result-best').textContent = formatTime(Math.min(...p.lapTimes));
      this.el('result-laps').textContent = p.lapTimes
        .map((t, i) => `L${i + 1} ${formatTime(t)}`)
        .join('   /   ');
    }
    this.lastState = state;
  }
  private drawMap(canvas: HTMLCanvasElement, karts: Kart[]) {
    const ctx = canvas.getContext('2d')!,
      w = canvas.width,
      h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const scale = Math.min((w - 40) / 300, (h - 30) / 345),
      xy = (x: number, z: number) => [w / 2 + (x - 3) * scale, h / 2 + (z + 10) * scale];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    this.track.path.points.forEach((p, i) => {
      const [x, y] = xy(p.x, p.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = '#ffffff22';
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.strokeStyle = '#f3e9cf';
    ctx.lineWidth = 4;
    ctx.stroke();
    const p = this.track.path.point(0),
      [x, y] = xy(p.x, p.z);
    ctx.fillStyle = '#ff8966';
    ctx.fillRect(x - 5, y - 3, 10, 6);
    for (const k of [...karts].reverse()) {
      const [kx, ky] = xy(k.position.x, k.position.z);
      ctx.beginPath();
      ctx.arc(kx, ky, k.id === 0 ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = `#${k.color.toString(16).padStart(6, '0')}`;
      ctx.fill();
      if (k.id === 0) {
        ctx.strokeStyle = '#fff7dc';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
}
