import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5173');
await page.waitForTimeout(1500);
console.log(
  JSON.stringify({ phase: process.argv[2], canvas: await page.locator('canvas').count(), errors }),
);
await browser.close();
if (errors.length) process.exit(1);
