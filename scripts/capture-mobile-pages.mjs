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

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

async function waitForScreen() {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function saveScreen(route, name) {
  const startedAt = Date.now();
  let status = 'ok';
  let finalPath = '';
  let note = '';

  try {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForScreen();
    finalPath = new URL(page.url()).pathname;
    await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
    if (finalPath !== route && route !== '/dashboard') note = `Reindirizzata a ${finalPath}`;
  } catch (error) {
    status = 'errore';
    note = error instanceof Error ? error.message : String(error);
  }

  report.push({ route, name, finalPath, status, note, elapsedMs: Date.now() - startedAt });
}

for (const [route, name] of publicRoutes) await saveScreen(route, name);

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
  : detectedPath.startsWith('/coach')
    ? 'coach'
    : detectedPath.startsWith('/coaching')
      ? 'cliente_coaching'
      : detectedPath.startsWith('/palestra')
        ? 'cliente_palestra'
        : null;

if (!detectedRole) throw new Error(`Ruolo non riconosciuto: ${detectedPath}`);
for (const [route, name] of roleRoutes[detectedRole]) await saveScreen(route, name);

await fs.writeFile(path.join(outputDir, 'audit-report.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  device: 'iPhone 15 Pro / WebKit',
  detectedPath,
  detectedRole,
  screenshots: report,
  consoleErrors: [...new Set(consoleErrors)],
}, null, 2));

await browser.close();
console.log(`Audit completato: ${report.length} schermate, ruolo ${detectedRole}.`);
