// Revisión en navegador con una partida simulada; no modifica datos del usuario.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5182', '--strictPort'], { stdio: 'pipe' });
let browser;
try {
  await new Promise((resolve, reject) => { server.stdout.on('data', d => { if (d.toString().includes('Local:')) resolve(); }); server.on('exit', c => reject(Error('Vite ' + c))); });
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await mkdir('artifacts', { recursive: true });
  await page.goto('http://127.0.0.1:5182/?debug');
  await page.getByRole('button', { name: 'Saltar intro' }).click();
  await page.getByRole('button', { name: 'JUGAR AHORA' }).click();
  await page.waitForFunction(() => window.__rr?.car.getObjectByName('Coche Blender'));
  await page.evaluate(async () => {
    const e = window.__rr; e.paused = true; cancelAnimationFrame(e.raf); await e.texturesReady();
    window.reviewHud = { dist: 1200, v: 28, level: 3, lives: 3, time: 45, boost: 0, invuln: 0, status: 'playing' };
    e.onHud(window.reviewHud); e.renderer.render(e.scene, e.camera);
  });
  await page.getByRole('status', { name: '3 de 3 vidas' }).waitFor();
  assert.equal(await page.locator('.voxel-heart.is-full').count(), 3);
  await page.locator('.voxel-lives').screenshot({ path: 'artifacts/hearts-full.png' });
  await page.evaluate(() => window.__rr.onHud({ ...window.reviewHud, lives: 2 }));
  await page.locator('.voxel-heart.is-lost').waitFor();
  assert.equal(await page.locator('.voxel-heart.is-empty').count(), 1);
  await page.waitForTimeout(750);
  await page.locator('.voxel-lives').screenshot({ path: 'artifacts/hearts-damage.png' });
  await page.evaluate(() => window.__rr.onHud({ ...window.reviewHud, lives: 1 }));
  await page.locator('.voxel-lives.is-critical').waitFor();
  assert.equal(await page.locator('.voxel-heart.is-last').count(), 1);
  await page.evaluate(() => window.__rr.onHud({ ...window.reviewHud, lives: 0 }));
  await page.getByRole('status', { name: '0 de 3 vidas' }).waitFor();
  assert.equal(await page.locator('.voxel-heart.is-empty').count(), 3);

  const sampleCount = await page.evaluate(async () => {
    const { GameCore } = await import('/src/game/logic.js');
    const core = new GameCore(2024);
    while (core.status === 'playing' && core.time < 120) core.update(1 / 60, { up: true });
    window.__rr.onEvent({ type: 'result', result: core.result() });
    return core.samples.length;
  });
  await page.getByRole('button', { name: 'VER ANÁLISIS NUMÉRICO →' }).click();
  const chart = page.locator('.card--chart').first();
  await chart.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const plot = page.locator('.telemetry-plot svg').first();
  await plot.hover({ position: { x: 400, y: 150 } });
  await page.locator('.telemetry-tooltip').waitFor();
  await chart.screenshot({ path: 'artifacts/chart-speed.png' });
  await plot.focus(); await page.keyboard.press('End');
  const endText = await page.locator('.telemetry-tooltip > strong').textContent();
  await page.keyboard.press('Home');
  assert.notEqual(await page.locator('.telemetry-tooltip > strong').textContent(), endText);
  assert.equal(await page.locator('.telemetry-tooltip b').textContent(), '20');
  const legend = page.locator('.telemetry-legend button').first();
  await legend.click(); assert.equal(await legend.getAttribute('aria-pressed'), 'false');
  await legend.click(); assert.equal(await legend.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.telemetry-events > span').count(), 3);
  const tabs = await page.locator('.tabs button').allTextContents();
  for (let i = 1; i < tabs.length; i++) {
    await page.getByRole('button', { name: tabs[i], exact: true }).click();
    assert.equal(await page.locator('.telemetry-chart').count(), 1, tabs[i]);
    await page.locator('.card--chart').scrollIntoViewIfNeeded();
    assert(await page.locator('.telemetry-plot path[d]').evaluateAll(nodes => nodes.every(n => !/NaN|Infinity/.test(n.getAttribute('d')))));
    if (i === 4) {
      await page.waitForTimeout(750);
      const widths = await page.locator('.telemetry-bar-track').evaluateAll(nodes => nodes.map(n => n.firstElementChild.getBoundingClientRect().width / n.getBoundingClientRect().width));
      assert(Math.abs(Math.max(...widths) - 1) < .001);
      await page.locator('.card--chart').screenshot({ path: 'artifacts/chart-bars.png' });
    }
    if (i === 8) await page.locator('.card--chart').screenshot({ path: 'artifacts/chart-convergence.png' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Resumen', exact: true }).click();
  await page.locator('.card--chart').scrollIntoViewIfNeeded();
  await page.locator('.card--chart').screenshot({ path: 'artifacts/chart-mobile.png' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await page.getByRole('button', { name: 'JUGAR AHORA' }).click();
  await page.getByRole('status', { name: '3 de 3 vidas' }).waitFor();
  await page.locator('.hud').screenshot({ path: 'artifacts/hud-mobile.png' });
  assert.deepEqual(errors, []);
  await writeFile('artifacts/charts-review.json', JSON.stringify({ charts: tabs.length, sampleCount, hearts: [3, 2, 1, 0], keyboard: true, legend: true, mobile: true, errors }, null, 2));
  console.log('OK: 9 gráficas, muestras simuladas, leyendas, teclado, corazones 3/2/1/0, móvil y cero errores.');
} finally { await browser?.close(); server.kill(); }
