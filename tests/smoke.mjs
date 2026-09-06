import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const base = 'http://127.0.0.1:5173';
let server;
try {
  await fetch(base);
} catch {
  server = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--', '--port', '5173'],
    { shell: process.platform === 'win32', windowsHide: true, stdio: 'ignore' },
  );
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      await fetch(base);
      break;
    } catch {}
  }
}
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL ?? 'chrome',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const report = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
});
async function check(name, fn) {
  const detail = await fn();
  report.push({ name, passed: true, detail });
  console.log(`PASS ${name}${detail ? ' ' + JSON.stringify(detail) : ''}`);
}
try {
  await page.goto(`${base}/?test=1`);
  await page.waitForFunction(() => window.__game);
  await page.waitForTimeout(1000);
  assert(await page.locator('#start').isVisible());
  await page.screenshot({ path: 'test-results/menu.png' });
  await check('Start button and countdown', async () => {
    await page.click('#start');
    return page.evaluate(() => {
      const g = window.__game,
        values = new Set();
      for (let i = 0; i < 230; i++) {
        g.step(1 / 60);
        if (g.race.state === 'countdown') values.add(Math.min(3, Math.ceil(g.race.countdown)));
      }
      if (g.race.state !== 'racing' || values.size !== 3) throw Error('countdown failed');
      return [...values];
    });
  });
  await check('Keyboard acceleration, steering, brake and reverse', async () => {
    await page.keyboard.down('KeyW');
    await page.evaluate(() => {
      for (let i = 0; i < 100; i++) window.__game.step(1 / 60);
    });
    const speed = await page.evaluate(() => window.__game.player.speed);
    assert(speed > 20);
    const before = await page.evaluate(() => window.__game.player.heading);
    await page.keyboard.down('KeyA');
    await page.evaluate(() => {
      for (let i = 0; i < 15; i++) window.__game.step(1 / 60);
    });
    assert((await page.evaluate(() => window.__game.player.heading)) > before);
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyS');
    await page.evaluate(() => {
      for (let i = 0; i < 150; i++) window.__game.step(1 / 60);
    });
    assert((await page.evaluate(() => window.__game.player.speed)) < -1);
    await page.keyboard.up('KeyS');
    return { forwardSpeed: speed };
  });
  await check('Escape pauses simulation and resumes', async () => {
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__game.step(1 / 60));
    const before = await page.evaluate(() => ({
      time: window.__game.race.elapsed,
      p: window.__game.player.position.toArray(),
      state: window.__game.race.state,
    }));
    assert.equal(before.state, 'paused');
    await page.evaluate(() => {
      for (let i = 0; i < 120; i++) window.__game.step(1 / 60);
    });
    assert.deepEqual(
      await page.evaluate(() => ({
        time: window.__game.race.elapsed,
        p: window.__game.player.position.toArray(),
        state: window.__game.race.state,
      })),
      before,
    );
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__game.step(1 / 60));
    assert.equal(await page.evaluate(() => window.__game.race.state), 'racing');
  });
  await check('Three drift levels, lateral slip and release boost', async () => {
    await page.evaluate(() => {
      const g = window.__game;
      g.race.recover(g.player);
      g.player.speed = 25;
    });
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await page.keyboard.down('Space');
    const levels = await page.evaluate(() => {
      const g = window.__game,
        levels = new Set();
      for (let i = 0; i < 155; i++) {
        g.player.drive(1 / 60, g.player.controls());
        levels.add(g.player.driftLevel);
      }
      const forward = Math.atan2(g.player.velocity.x, g.player.velocity.z);
      return {
        levels: [...levels],
        slip: Math.abs(forward - g.player.heading),
        drifting: g.player.drifting,
      };
    });
    assert.deepEqual(levels.levels, [0, 1, 2, 3]);
    assert(levels.drifting && levels.slip > 0.1);
    await page.keyboard.up('Space');
    await page.evaluate(() => {
      const g = window.__game;
      g.player.drive(1 / 60, g.player.controls());
    });
    assert((await page.evaluate(() => window.__game.player.boostTime)) > 1.5);
    assert((await page.evaluate(() => window.__game.player.speed)) > 30);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    return levels;
  });
  await check('Ramp jump and suspension landing', () =>
    page.evaluate(() => {
      const g = window.__game,
        k = g.player;
      g.race.recover(k);
      k.position.copy(g.track.path.sample(g.track.rampT - 0.004));
      const dir = g.track.path.tangent(g.track.rampT);
      k.heading = Math.atan2(dir.x, dir.z);
      k.speed = 29;
      let jumped = false,
        landed = false,
        maxHeight = 0;
      for (let i = 0; i < 160; i++) {
        g.step(1 / 60, { throttle: 1, steer: 0, drift: false });
        jumped ||= k.airborne;
        landed ||= k.landed;
        maxHeight = Math.max(maxHeight, k.position.y - g.track.path.nearest(k.position).point.y);
      }
      if (!jumped || !landed || maxHeight < 2) throw Error('jump/landing failed');
      return { jumped, landed, maxHeight };
    }),
  );
  await check('Crystal pickup, Shift use, respawn and all four items', async () => {
    const item = await page.evaluate(() => {
      const g = window.__game;
      g.items.reset();
      g.race.recover(g.player);
      const box = g.items.boxes[0];
      g.player.position.copy(box.position);
      g.items.update(0.01, 0, true);
      if (!g.player.item || box.cooldown === 0) throw Error('pickup failed');
      const item = g.player.item;
      g.player.item = 'Turbo';
      return item;
    });
    await page.keyboard.press('ShiftLeft');
    await page.evaluate(() => window.__game.step(1 / 60));
    assert((await page.evaluate(() => window.__game.player.boostTime)) > 2);
    assert.equal(await page.evaluate(() => window.__game.player.item), null);
    return page.evaluate((item) => {
      const g = window.__game,
        p = g.player,
        target = g.karts[1];
      g.items.reset();
      p.position.copy(g.track.path.sample(0.04));
      const dir = g.track.path.tangent(0.04);
      p.heading = Math.atan2(dir.x, dir.z);
      for (const k of g.karts.slice(1)) k.position.copy(g.track.path.sample(0.9));
      target.position.copy(p.position).addScaledVector(dir, 16);
      target.resetEffects();
      p.item = 'Missile';
      g.items.use(p);
      if (g.items.projectiles[0].target !== target) throw Error('homing target failed');
      for (let i = 0; i < 90; i++) g.items.update(1 / 60, 0, true);
      if (target.stunTime <= 0) throw Error('missile did not hit');
      g.items.reset();
      target.resetEffects();
      p.item = 'Mine';
      g.items.use(p);
      target.position.copy(g.items.projectiles[0].mesh.position);
      target.position.y -= 0.7;
      g.items.update(0.02, 0, true);
      if (target.stunTime <= 0) throw Error('mine did not hit');
      g.items.reset();
      target.resetEffects();
      target.item = 'Shield';
      g.items.use(target);
      if (target.shieldTime !== 6) throw Error('shield activation failed');
      p.item = 'Mine';
      g.items.use(p);
      target.position.copy(g.items.projectiles[0].mesh.position);
      target.position.y -= 0.7;
      g.items.update(0.02, 0, true);
      if (target.stunTime !== 0 || target.shieldTime !== 0) throw Error('shield did not block');
      const box = g.items.boxes[0];
      box.cooldown = 5;
      box.update(5.1, 0);
      if (box.cooldown !== 0 || !box.mesh.visible) throw Error('respawn failed');
      return {
        randomPickup: item,
        verified: ['Turbo', 'Missile', 'Mine', 'Shield'],
        boxRespawn: true,
      };
    }, item);
  });
  await check('Off-road slowdown, fall recovery and R key', async () => {
    const detail = await page.evaluate(() => {
      const g = window.__game,
        k = g.player;
      g.race.recover(k);
      k.speed = 25;
      k.position.copy(g.track.path.sample(0.03, 9));
      k.surface(0.5, g.track);
      if (k.speed >= 15) throw Error('grass slowdown failed');
      k.position.set(600, -2, 600);
      for (let i = 0; i < 130; i++) g.step(1 / 60, { throttle: 0, steer: 0, drift: false });
      if (k.fallTime !== 0 || g.track.path.nearest(k.position).distance > 5)
        throw Error('fall recovery failed');
      return { grassSlows: true, fallRecovered: true };
    });
    await page.keyboard.press('KeyR');
    await page.evaluate(() => window.__game.step(1 / 60));
    assert.equal(await page.evaluate(() => window.__game.player.speed), 0);
    return detail;
  });
  await check('Reverse driving and checkpoint shortcuts cannot add laps', () =>
    page.evaluate(() => {
      const g = window.__game;
      g.start();
      g.race.state = 'racing';
      for (let i = 0; i < 900; i++) {
        g.player.position.copy(g.track.path.sample((((0.006 - i / 900) % 1) + 1) % 1));
        g.race.update(g.player);
      }
      let p = g.race.progress.get(0);
      if (p.gates !== 0 || p.lap !== 1) throw Error('reverse awarded lap');
      for (const t of [0.3, 0.6, 0.9, 0]) {
        g.player.position.copy(g.track.path.sample(t));
        g.race.update(g.player);
      }
      p = g.race.progress.get(0);
      if (p.gates !== 0) throw Error('shortcut awarded gates');
      return { gates: p.gates, lap: p.lap };
    }),
  );
  await check('Three physical laps, moving CPU, rank changes and FINISH', () =>
    page.evaluate(async () => {
      const g = window.__game;
      g.start();
      const { AIKart } = await import('/src/kart/AIKart.ts');
      const driver = new AIKart(0, 'TEST', 0xffffff, g.track.path);
      driver.difficulty = 'Hard';
      const ranks = new Set();
      let jumps = 0,
        wasAir = false;
      for (let i = 0; i < 60 * 240 && g.race.state !== 'finished'; i++) {
        driver.position.copy(g.player.position);
        driver.heading = g.player.heading;
        driver.speed = g.player.speed;
        g.step(1 / 60, driver.controls(g.karts, g.race.elapsed));
        ranks.add(g.race.order().indexOf(g.player) + 1);
        if (g.player.airborne && !wasAir) jumps++;
        wasAir = g.player.airborne;
      }
      const p = g.race.progress.get(0);
      if (g.race.state !== 'finished' || p.lapTimes.length !== 3 || p.gates !== 72)
        throw Error('full race failed');
      if (ranks.size < 2 || jumps !== 3) throw Error('race dynamics missing');
      if (g.karts.slice(1).some((k) => g.race.progress.get(k.id).gates < 48))
        throw Error('CPU stuck');
      return {
        lapTimes: p.lapTimes,
        ranks: [...ranks],
        jumps,
        checkpoints: p.gates,
        elapsed: g.race.elapsed,
      };
    }),
  );
  await page.waitForTimeout(300);
  assert(await page.locator('#finish').isVisible());
  await page.screenshot({ path: 'test-results/finish.png' });
  await check('All CPU finish with waypoint steering', () =>
    page.evaluate(() => {
      const g = window.__game;
      g.start();
      for (let i = 0; i < 60 * 230; i++) {
        g.step(1 / 60, { throttle: 0, steer: 0, drift: false });
        if (g.karts.slice(1).every((k) => g.race.progress.get(k.id).finishedAt !== null)) break;
      }
      const times = g.karts.slice(1).map((k) => g.race.progress.get(k.id).finishedAt);
      if (times.some((t) => t === null)) throw Error('CPU failed to finish');
      return times;
    }),
  );
  await check('Responsive layout and volume persistence', async () => {
    await page.evaluate(() => {
      const g = window.__game;
      g.race.reset();
      const input = document.querySelector('#volume');
      input.value = '.31';
      input.dispatchEvent(new Event('input'));
    });
    for (const viewport of [
      { width: 900, height: 640 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(250);
      const rect = await page.locator('#start').boundingBox();
      assert(
        rect &&
          rect.x >= 0 &&
          rect.y >= 0 &&
          rect.x + rect.width <= viewport.width &&
          rect.y + rect.height <= viewport.height,
      );
      assert.equal(
        await page.evaluate(() => window.__game.camera.aspect),
        viewport.width / viewport.height,
      );
    }
    await page.screenshot({ path: 'test-results/narrow.png' });
    await page.reload();
    await page.waitForFunction(() => window.__game);
    assert.equal(await page.evaluate(() => window.__game.ui.volume), 0.31);
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base);
  await page.waitForFunction(() => window.__game);
  await page.click('#start');
  await page.waitForTimeout(4100);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1800);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'test-results/race.png' });
  await check('Real-time render performance and WebGL', () =>
    page.evaluate(async () => {
      const frames = [];
      let last = performance.now();
      await new Promise((resolve) => {
        function frame(t) {
          frames.push(t - last);
          last = t;
          if (frames.length === 120) resolve();
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      const g = window.__game;
      if (g.renderer.getContext().isContextLost()) throw Error('WebGL context lost');
      return {
        averageFps: Math.round(1000 / (frames.reduce((a, b) => a + b, 0) / frames.length)),
        drawCalls: g.renderer.info.render.calls,
        triangles: g.renderer.info.render.triangles,
      };
    }),
  );
  assert.deepEqual(errors, []);
  console.log('PASS no browser errors');
  await writeFile(
    'test-results/report.json',
    JSON.stringify({ browser: process.env.BROWSER_CHANNEL ?? 'chrome', report, errors }, null, 2),
  );
} finally {
  await browser.close();
  if (server) server.kill();
}
