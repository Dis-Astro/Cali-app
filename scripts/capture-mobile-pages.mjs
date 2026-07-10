import { webkit, devices } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { publicRoutes, roleRoutes } from './mobile-audit-routes.mjs';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const account = process.env.E2E_EMAIL;
const secret = process.env.E2E_PASSWORD;
const outputDir = process.env.SCREENSHOT_DIR || 'build/mobile-screenshots';

if (!account || !secret) throw new Error('Credenziali E2E mancanti.');
await fs.mkdir(outputDir, { recursive: true });

const browser = await webkit.launch();
const context = await browser.newContext({
  ...devices['iPhone 15 Pro'],
  locale: 'it-IT',
  timezoneId: 'Europe/Rome',
  colorScheme: 'dark',
});
const page = await context.newPage();
const report = [];
const consoleErrors = [];
const networkErrors = [];

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400) {
    networkErrors.push({
      status: response.status(),
      method: response.request().method(),
      url: response.url(),
    });
  }
});

async function waitForScreen() {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function saveViewport(route, name) {
  const startedAt = Date.now();
  let status = 'ok';
  let finalPath = '';
  let note = '';
  const files = [];

  try {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForScreen();
    finalPath = new URL(page.url()).pathname;

    const firstFile = `${name}-01.png`;
    await page.screenshot({ path: path.join(outputDir, firstFile), fullPage: false });
    files.push(firstFile);

    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = page.viewportSize()?.height || 844;

    if (scrollHeight > viewportHeight * 1.35) {
      await page.evaluate((height) => window.scrollTo({ top: height * 0.8, behavior: 'instant' }), viewportHeight);
      await page.waitForTimeout(500);
      const secondFile = `${name}-02.png`;
      await page.screenshot({ path: path.join(outputDir, secondFile), fullPage: false });
      files.push(secondFile);
    }

    if (scrollHeight > viewportHeight * 2.2) {
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(500);
      const thirdFile = `${name}-03.png`;
      await page.screenshot({ path: path.join(outputDir, thirdFile), fullPage: false });
      files.push(thirdFile);
    }

    if (finalPath !== route && route !== '/dashboard') note = `Reindirizzata a ${finalPath}`;
  } catch (error) {
    status = 'errore';
    note = error instanceof Error ? error.message : String(error);
  }

  report.push({ route, name, files, finalPath, status, note, elapsedMs: Date.now() - startedAt });
}

for (const [route, name] of publicRoutes) await saveViewport(route, name);

await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
await page.locator('#email').fill(account);
await page.locator('#password').fill(secret);
await page.getByRole('button', { name: /accedi/i }).click();
await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
await page.waitForTimeout(3000);

await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const detectedPath = new URL(page.url()).pathname;
const detectedRole = detectedPath.startsWith('/admin')
  ? 'admin'
  : detectedPath.startsWith('/coaching')
    ? 'cliente_coaching'
    : detectedPath.startsWith('/coach')
      ? 'coach'
      : detectedPath.startsWith('/palestra')
        ? 'cliente_palestra'
        : null;

if (!detectedRole) throw new Error(`Ruolo non riconosciuto: ${detectedPath}`);
for (const [route, name] of roleRoutes[detectedRole]) await saveViewport(route, name);

await fs.writeFile(path.join(outputDir, 'audit-report.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  device: 'iPhone 15 Pro / WebKit',
  captureMode: 'viewport-based',
  detectedPath,
  detectedRole,
  screenshots: report,
  consoleErrors: [...new Set(consoleErrors)],
  networkErrors: networkErrors.filter((item, index, array) =>
    array.findIndex((candidate) => candidate.status === item.status && candidate.method === item.method && candidate.url === item.url) === index
  ),
}, null, 2));

await browser.close();
console.log(`Audit completato: ${report.length} pagine, ruolo ${detectedRole}.`);
