import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = path.join(root, 'assets/raw');
const output = path.join(root, 'assets/clips');
await mkdir(raw, { recursive: true });
await mkdir(output, { recursive: true });
const audio = JSON.parse(await readFile(path.join(root, 'assets/audio/manifest.json'), 'utf8'));
const origin = process.env.BOUNTEX_CAPTURE_ORIGIN || 'http://127.0.0.1:5180';
const production = 'https://bountex.vercel.app';
const selected = process.argv.slice(2);
let manifests = [];
if (selected.length) {
  try { manifests = JSON.parse(await readFile(path.join(root, 'assets/capture-manifest.json'), 'utf8')).scenes; } catch {}
}
const hold = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));
const task = (page) => page.locator('.task-card').filter({ hasText: 'Test our new Mini App' });
async function role(page, name) {
  await page.locator('.wallet-button').click();
  await page.getByRole('button', { name: `Try as a ${name}` }).click();
}
async function dismiss(page) {
  await page.getByRole('button', { name: 'Dismiss notification' }).evaluateAll(buttons => buttons.forEach(button => button.click()));
}
async function claim(page) {
  await role(page, 'worker');
  await task(page).click();
  await page.getByRole('button', { name: 'Claim this bounty' }).click();
}
async function submit(page) {
  await claim(page);
  await page.getByLabel('Your submission').fill('I tested the task flow and documented three reproducible usability issues with screenshots and steps.');
  await page.getByLabel('Proof link').fill('https://example.com/preview-bug-report');
  await page.getByRole('button', { name: 'Submit for review' }).click();
}
async function creatorReview(page) {
  await submit(page);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await role(page, 'creator');
  await page.getByRole('button', { name: 'My work', exact: true }).click();
  await page.getByRole('button', { name: /I’ve posted/ }).click();
  await task(page).click();
}
for (const timing of audio.scenes) {
  const { id, duration } = timing;
  if (selected.length && !selected.includes(id)) continue;
  const browser = await chromium.launch({ headless: true, args: id === 'opening'
    ? ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: id === 'opening' ? 'no-preference' : 'reduce', recordVideo: { dir: raw, size: { width: 1280, height: 800 } } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let started, finished, rawFile;
  try {
    if (id !== 'closing') await page.route('**/api/**', route => {
      if (new URL(route.request().url()).pathname === '/api/config') return route.fulfill({ json: { configured: false, network: 'mainnet', paymentsReady: false } });
      return route.fulfill({ status: 503, json: { error: 'Recorded preview uses no live backend writes.' } });
    });
    await page.goto(id === 'closing' ? production : origin);
    if (id === 'closing') await expect(page.locator('.mode-indicator')).toContainText('Mainnet · Live', { timeout: 30_000 });
    else await expect(page.locator('.task-card')).toHaveCount(9, { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    if (id === 'opening') await expect(page.locator('.canvas-wrap canvas')).toBeVisible({ timeout: 30_000 });
    if (id === 'create') {
      await role(page, 'creator');
      await page.getByRole('button', { name: 'Post a bounty', exact: true }).first().click();
    } else if (id === 'claim') {
      await role(page, 'worker'); await task(page).click();
    } else if (id === 'submit') await claim(page);
    else if (id === 'review') await creatorReview(page);
    else if (id === 'receipt') { await creatorReview(page); await page.getByRole('button', { name: 'Approve work' }).click(); }
    await dismiss(page);
    started = Date.now();
    if (id === 'explore') {
      await page.getByRole('tab', { name: 'Development', exact: true }).click();
      await hold(0.5);
      await page.getByLabel('Sort bounties').selectOption('reward');
      await page.getByLabel('Search bounties').fill('Mini App');
      await page.locator('.feed').scrollIntoViewIfNeeded();
    } else if (id === 'create') {
      await page.getByLabel('Bounty title').fill('Test a Nimiq Mini App on mobile');
      await page.getByLabel('What needs doing?').fill('Test the task flow and report three usability issues with clear reproduction steps.');
      await page.locator('.form-panel select').selectOption('Development');
      await page.getByLabel('Requirement 1').fill('Three bug reports with screenshots and reproduction steps');
      await page.getByRole('button', { name: 'Publish bounty' }).scrollIntoViewIfNeeded();
    } else if (id === 'claim') {
      await hold(1);
      await page.getByRole('button', { name: 'Claim this bounty' }).click();
      await page.getByRole('button', { name: 'Close dialog' }).click();
      await page.getByRole('button', { name: 'My work', exact: true }).click();
    } else if (id === 'submit') {
      await page.getByLabel('Your submission').fill('I tested the task flow and documented three reproducible usability issues with screenshots and steps.');
      await page.getByLabel('Proof link').fill('https://example.com/preview-bug-report');
      await hold(0.6);
      await page.getByRole('button', { name: 'Submit for review' }).click();
    } else if (id === 'review') {
      await page.getByLabel('Feedback', { exact: true }).fill('Clear findings and useful steps. Thanks for testing.');
      await hold(0.7);
      await page.getByRole('button', { name: 'Approve work' }).click();
      await expect(page.getByRole('dialog').getByText('Awaiting payment', { exact: true })).toBeVisible();
    } else if (id === 'receipt') {
      await page.getByRole('button', { name: 'Preview a payout' }).click();
      await expect(page.getByText('This creates a sample receipt. No NIM will be sent.')).toBeVisible();
      await hold(0.8);
      await page.getByRole('button', { name: 'Simulate payout' }).click();
      await page.locator('.receipt').scrollIntoViewIfNeeded();
      await dismiss(page);
    } else if (id === 'closing') {
      await page.locator('.wallet-button').click();
      await expect(page.getByRole('button', { name: 'Connect Nimiq Pay' })).toBeVisible();
    }
    await hold(Math.max(2, duration - (Date.now() - started) / 1000));
    finished = Date.now();
    rawFile = await page.video().path();
    await context.close();
    if (errors.length) throw new Error(`Browser errors in ${id}: ${errors.join('; ')}`);
    const recorded = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', rawFile], { encoding: 'utf8' }).trim());
    const sourceStart = Math.max(0, recorded - (finished - started) / 1000);
    const file = path.join(output, id + '.mp4');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', sourceStart.toFixed(3), '-i', rawFile, '-t', duration.toFixed(3), '-vf', 'fps=30,tpad=stop_mode=clone:stop_duration=2', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { timeout: 55_000 });
    manifests = manifests.filter(scene => scene.id !== id);
    manifests.push({ id, file: `clips/${id}.mp4`, rawFile: path.basename(rawFile), duration, sourceStart, recordKind: id === 'closing' ? 'Read-only public mainnet page' : 'Labeled local preview workflow', noLiveWrites: true, noNimTransferred: true, pageErrors: 0 });
    await writeFile(path.join(root, 'assets/capture-manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), previewOrigin: origin, production, scenes: manifests }, null, 2) + '\n');
    console.log(`Captured ${id}: ${duration.toFixed(2)} seconds, no live writes or payment.`);
  } finally { await browser.close(); }
}
