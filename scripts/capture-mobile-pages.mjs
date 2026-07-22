import { webkit, devices } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { publicRoutes, roleRoutes } from './mobile-audit-routes.mjs';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const account = process.env.E2E_EMAIL;
const secret = process.env.E2E_PASSWORD;
const outputDir = process.env.SCREENSHOT_DIR || 'build/mobile-screenshots';
const expectedRole = process.env.E2E_EXPECTED_ROLE || '';
const skipPublic = process.env.E2E_SKIP_PUBLIC === '1';

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
    networkErrors.push({ status: response.status(), method: response.request().method(), url: response.url() });
  }
});

async function waitForScreen() {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function saveCurrentViewport(name, note = '') {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(outputDir, file), fullPage: false });
  report.push({
    route: new URL(page.url()).pathname + new URL(page.url()).search,
    name,
    files: [file],
    finalPath: new URL(page.url()).pathname,
    status: 'ok',
    note,
    elapsedMs: 0,
  });
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
    const finalUrl = new URL(page.url());
    finalPath = finalUrl.pathname;

    const firstFile = `${name}-01.png`;
    await page.screenshot({ path: path.join(outputDir, firstFile), fullPage: false });
    files.push(firstFile);

    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = page.viewportSize()?.height || 844;

    if (scrollHeight > viewportHeight * 1.35) {
      await page.evaluate((height) => window.scrollTo(0, height * 0.8), viewportHeight);
      await page.waitForTimeout(500);
      const secondFile = `${name}-02.png`;
      await page.screenshot({ path: path.join(outputDir, secondFile), fullPage: false });
      files.push(secondFile);
    }

    if (scrollHeight > viewportHeight * 2.2) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(500);
      const thirdFile = `${name}-03.png`;
      await page.screenshot({ path: path.join(outputDir, thirdFile), fullPage: false });
      files.push(thirdFile);
    }

    if (finalPath !== route.split('?')[0] && route !== '/dashboard') note = `Reindirizzata a ${finalPath}`;
  } catch (error) {
    status = 'errore';
    note = error instanceof Error ? error.message : String(error);
  }

  report.push({ route, name, files, finalPath, status, note, elapsedMs: Date.now() - startedAt });
}

async function captureCoachingFlow() {
  await page.goto(`${baseURL}/coaching/scheda`, { waitUntil: 'domcontentloaded' });
  await waitForScreen();

  const detailsToggle = page.getByTestId('plan-details-toggle');
  if (await detailsToggle.count()) {
    await detailsToggle.click();
    await page.waitForTimeout(350);
    await saveCurrentViewport('37-coaching-scheda-indicazioni-complete', 'Indicazioni complete espanse');
    await detailsToggle.click();
  }

  const firstDay = page.getByTestId('workout-day-link').first();
  if (await firstDay.count()) {
    await firstDay.click();
    await waitForScreen();
    await saveCurrentViewport('38-coaching-giorno-chiuso', 'Primo giorno con esercizi chiusi');
    const firstExercise = page.getByTestId('exercise-toggle').first();
    if (await firstExercise.count()) {
      await firstExercise.click();
      await page.waitForTimeout(500);
      await saveCurrentViewport('39-coaching-esercizio-aperto', 'Primo esercizio aperto con testo completo');

      const timerLauncher = page.getByTestId('workout-timer-launcher').first();
      if (await timerLauncher.count()) {
        await timerLauncher.click();
        await page.waitForTimeout(350);
        await saveCurrentViewport('41-coaching-timer-configurazione', 'Timer libero aperto dall’esercizio');

        const openTimerButton = page.getByRole('button', { name: 'Apri timer', exact: true });
        if (await openTimerButton.count()) {
          await openTimerButton.click();
          await page.waitForTimeout(350);

          const timerScreen = page.getByTestId('workout-timer-screen');
          if (!await timerScreen.count()) throw new Error('La schermata Timer non si è aperta.');
          await saveCurrentViewport('42-coaching-timer-fullscreen', 'Timer fullscreen con testo esercizio visibile');

          const startTimer = page.getByTestId('timer-start');
          if (!await startTimer.count()) throw new Error('Il pulsante di avvio Timer non è disponibile.');
          await startTimer.click();
          await page.waitForTimeout(500);

          const preparationValue = (await page.getByTestId('timer-display').textContent())?.trim();
          if (preparationValue !== '10' && preparationValue !== '9') {
            throw new Error(`Countdown di preparazione inatteso: ${preparationValue || 'vuoto'}`);
          }
          await saveCurrentViewport('43-coaching-timer-preparazione', 'Countdown iniziale di 10 secondi');

          const closeTimer = page.getByRole('button', { name: 'Chiudi timer', exact: true });
          if (await closeTimer.count()) await closeTimer.click();
        }
      }
    }
  }

  await page.goto(`${baseURL}/coaching/archivio`, { waitUntil: 'domcontentloaded' });
  await waitForScreen();
  const archiveLinks = page.locator('a[href^="/coaching/scheda?planId="]');
  if (await archiveLinks.count()) {
    await archiveLinks.first().click();
    await waitForScreen();
    const selectedUrl = new URL(page.url());
    const planId = selectedUrl.searchParams.get('planId');
    const archivedDay = page.getByTestId('workout-day-link').first();
    if (planId && await archivedDay.count()) {
      await archivedDay.click();
      await waitForScreen();
      const preserved = new URL(page.url()).searchParams.get('planId') === planId;
      await saveCurrentViewport('40-coaching-archivio-giorno', preserved ? 'Archivio: planId preservato' : 'ERRORE: planId non preservato');
      if (!preserved) throw new Error('Il planId della scheda archiviata non è stato preservato.');
    }
  }
}

async function captureAdminFlow() {
  await page.goto(`${baseURL}/admin`, { waitUntil: 'domcontentloaded' });
  await waitForScreen();
  const menuButton = page.getByRole('button', { name: 'Apri menu amministratore' });
  if (await menuButton.count()) {
    await menuButton.click();
    await page.waitForTimeout(350);
    await saveCurrentViewport('19-admin-menu-mobile', 'Menu mobile amministratore aperto');
  }

  await page.goto(`${baseURL}/admin/utenti`, { waitUntil: 'domcontentloaded' });
  await waitForScreen();
  const newUserButton = page.getByRole('button', { name: /nuovo utente/i });
  if (await newUserButton.count()) {
    await newUserButton.click();
    await page.waitForTimeout(350);
    await saveCurrentViewport('20-admin-nuovo-utente', 'Finestra aperta senza salvare dati');
  }
}

if (!skipPublic) {
  for (const [route, name] of publicRoutes) await saveViewport(route, name);
}

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
if (expectedRole && detectedRole !== expectedRole) {
  throw new Error(`Ruolo errato: atteso ${expectedRole}, rilevato ${detectedRole}`);
}

for (const [route, name] of roleRoutes[detectedRole]) await saveViewport(route, name);
if (detectedRole === 'cliente_coaching') await captureCoachingFlow();
if (detectedRole === 'admin') await captureAdminFlow();

const uniqueConsoleErrors = [...new Set(consoleErrors)];
const uniqueNetworkErrors = networkErrors.filter((item, index, array) =>
  array.findIndex((candidate) => candidate.status === item.status && candidate.method === item.method && candidate.url === item.url) === index
);

await fs.writeFile(path.join(outputDir, 'audit-report.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  device: 'iPhone 15 Pro / WebKit',
  captureMode: 'viewport-based',
  detectedPath,
  detectedRole,
  screenshots: report,
  consoleErrors: uniqueConsoleErrors,
  networkErrors: uniqueNetworkErrors,
}, null, 2));

await browser.close();

const failedRoutes = report.filter((item) => item.status !== 'ok');
if (failedRoutes.length || uniqueConsoleErrors.length || uniqueNetworkErrors.length) {
  console.error(JSON.stringify({ failedRoutes, uniqueConsoleErrors, uniqueNetworkErrors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Audit completato: ${report.length} schermate, ruolo ${detectedRole}, nessun errore.`);
}
