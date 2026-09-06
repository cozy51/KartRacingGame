import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('ERROR', e.message));
await page.goto('http://127.0.0.1:5173/?test=1');
await page.waitForFunction(() => window.__game);
await page.click('#start');
const result = await page.evaluate(async () => {
  const g = window.__game;
  const { AIKart } = await import('/src/kart/AIKart.ts');
  const driver = new AIKart(0, 'TEST', 0xffffff, g.track.path);
  driver.difficulty = 'Hard';
  const ranks = new Set();
  let jumps = 0,
    previousAir = false;
  let maxOff = 0;
  let maxSpeed = 0;
  for (let i = 0; i < 60 * 240 && g.race.state !== 'finished'; i++) {
    driver.position.copy(g.player.position);
    driver.heading = g.player.heading;
    driver.speed = g.player.speed;
    g.step(1 / 60, driver.controls(g.karts, g.race.elapsed));
    ranks.add(g.race.order().indexOf(g.player) + 1);
    if (g.player.airborne && !previousAir) jumps++;
    previousAir = g.player.airborne;
    maxOff = Math.max(maxOff, g.track.path.nearest(g.player.position).distance);
    maxSpeed = Math.max(maxSpeed, g.player.speed);
  }
  return {
    state: g.race.state,
    elapsed: g.race.elapsed,
    progress: [...g.race.progress],
    ranks: [...ranks],
    jumps,
    maxOff,
    maxSpeed,
    length: g.track.path.length,
    positions: g.karts.map((k) => ({
      id: k.id,
      t: g.track.path.nearest(k.position).t,
      off: g.track.path.nearest(k.position).distance,
    })),
    calls: g.renderer.info.render.calls,
  };
});
console.log(JSON.stringify(result, null, 2));
await page.waitForTimeout(500);
await page.screenshot({ path: 'test-results/finish.png' });
await browser.close();
