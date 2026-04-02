#!/usr/bin/env node
/**
 * Comprehensive Visual Audit v4 — robust error handling, tooltip dismissal
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.AUDIT_URL || 'https://mfpulse.jslwealth.in';
const OUT_DIR = join(process.cwd(), 'qa_screenshots');
const WIDTH = 1440;
const HEIGHT = 900;

let shotIndex = 0;

async function shot(page, label, opts = {}) {
  shotIndex++;
  const prefix = String(shotIndex).padStart(2, '0');
  const safeName = label.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const fileName = `${prefix}_${safeName}.png`;

  try {
    if (opts.fullPage) {
      await page.screenshot({ path: join(OUT_DIR, fileName), fullPage: true });
    } else {
      await page.screenshot({
        path: join(OUT_DIR, fileName),
        clip: { x: 0, y: 0, width: opts.width || WIDTH, height: opts.height || HEIGHT },
      });
    }
    console.log(`  [${prefix}] ${label}`);
  } catch (e) {
    console.log(`  [${prefix}] ${label} — SCREENSHOT FAILED: ${e.message.slice(0, 80)}`);
  }
  return fileName;
}

async function safeClick(page, locator, waitMs = 2000) {
  try {
    // Warn about overlays instead of removing them — QA should catch stuck modals
    const overlayCount = await page.evaluate(() => {
      return document.querySelectorAll('.fixed.inset-0').length;
    });
    if (overlayCount > 0) {
      console.warn(`  [WARNING] ${overlayCount} overlay(s) detected (.fixed.inset-0) — may block interaction`);
    }
    await locator.click({ timeout: 5000 });
    await page.waitForTimeout(waitMs);
    return true;
  } catch {
    return false;
  }
}

async function openPage(browser, path, waitMs = 5000) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const url = `${BASE_URL}${path}`;
  console.log(`  Opening ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  } catch {
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    } catch (e) {
      console.error(`  FAILED to load ${url}: ${e.message.slice(0, 80)}`);
    }
  }
  await page.waitForTimeout(waitMs);
  return { page, context };
}

async function run() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // ====== 1. DASHBOARD ======
  console.log('\n=== DASHBOARD ===');
  {
    const { page, context } = await openPage(browser, '/', 4000);
    // Click Dashboard nav if we landed on Universe
    try {
      await page.locator('a').filter({ hasText: 'Dashboard' }).first().click({ timeout: 3000 });
      await page.waitForTimeout(4000);
    } catch { /* may already be on dashboard */ }
    await shot(page, 'dashboard_above_fold');
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(400);
    await shot(page, 'dashboard_mid');
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(400);
    await shot(page, 'dashboard_lower');
    await shot(page, 'dashboard_full', { fullPage: true });
    await context.close();
  }

  // ====== 2. UNIVERSE ======
  console.log('\n=== UNIVERSE ===');
  {
    const { page, context } = await openPage(browser, '/universe', 6000);
    await shot(page, 'universe_above_fold');

    // Bubble click
    const canvas = page.locator('canvas').first();
    if (await canvas.count() > 0) {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.35);
        await page.waitForTimeout(1500);
        await shot(page, 'universe_tooltip');

        // Dismiss tooltip by pressing Escape or clicking the backdrop
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        // Force-remove overlay
        await page.evaluate(() => {
          document.querySelectorAll('.fixed.inset-0').forEach(el => el.remove());
        });
      }
    }

    // Direct filter
    if (await safeClick(page, page.locator('button').filter({ hasText: /^Direct$/ }).first(), 3000)) {
      await shot(page, 'universe_direct');
    }

    // Back to Regular
    await safeClick(page, page.locator('button').filter({ hasText: /^Regular$/ }).first(), 2000);

    // 3Y timeframe
    if (await safeClick(page, page.locator('button').filter({ hasText: /^3Y$/ }).first(), 3000)) {
      await shot(page, 'universe_3y');
    }

    await shot(page, 'universe_full', { fullPage: true });
    await context.close();
  }

  // ====== 3. FUND 360 — direct URL ======
  console.log('\n=== FUND 360 (Direct URL) ===');
  {
    const { page, context } = await openPage(browser, '/fund/F00000YPMX', 6000);
    await shot(page, 'fund360_hero');
    await page.evaluate(() => window.scrollTo(0, 450));
    await page.waitForTimeout(500);
    await shot(page, 'fund360_lenses_returns');
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(500);
    await shot(page, 'fund360_nav_chart');
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(500);
    await shot(page, 'fund360_sections');
    await page.evaluate(() => window.scrollTo(0, 1900));
    await page.waitForTimeout(500);
    await shot(page, 'fund360_more_sections');
    await shot(page, 'fund360_full', { fullPage: true });

    // Expand all collapsible sections
    const buttons = page.locator('button');
    const btnCount = await buttons.count();
    for (let i = 0; i < btnCount; i++) {
      try {
        const text = await buttons.nth(i).textContent();
        if (/Asset|Sector|Holdings|Risk|Peer|Benchmark|Credit/.test(text)) {
          await buttons.nth(i).click({ timeout: 1000 });
          await page.waitForTimeout(600);
        }
      } catch { /* skip non-clickable */ }
    }
    await page.waitForTimeout(1000);
    await shot(page, 'fund360_all_expanded', { fullPage: true });

    // Try NAV period buttons
    for (const period of ['3Y', '5Y', 'Max']) {
      if (await safeClick(page, page.locator('button').filter({ hasText: new RegExp(`^${period}$`) }).first(), 2000)) {
        await shot(page, `fund360_nav_${period.toLowerCase()}`);
      }
    }
    await context.close();
  }

  // ====== 4. FUND 360 — search flow ======
  console.log('\n=== FUND 360 (Search) ===');
  {
    const { page, context } = await openPage(browser, '/fund360', 3000);
    await shot(page, 'fund360_search_landing');

    const searchInput = page.locator('input').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('HDFC Flexi Cap');
      await page.waitForTimeout(2500);
      await shot(page, 'fund360_search_results');

      // Click first result link
      const resultLink = page.locator('a[href*="/fund/"]').first();
      if (await resultLink.count() > 0) {
        await resultLink.click();
        await page.waitForTimeout(4000);
        await shot(page, 'fund360_hdfc_detail');
        await shot(page, 'fund360_hdfc_full', { fullPage: true });
      }
    }
    await context.close();
  }

  // ====== 5. SECTORS ======
  console.log('\n=== SECTORS ===');
  {
    const { page, context } = await openPage(browser, '/sectors', 5000);
    await shot(page, 'sectors_compass');
    await page.evaluate(() => window.scrollTo(0, 650));
    await page.waitForTimeout(500);
    await shot(page, 'sectors_context_cards');
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(500);
    await shot(page, 'sectors_drilldown');
    await page.evaluate(() => window.scrollTo(0, 1800));
    await page.waitForTimeout(500);
    await shot(page, 'sectors_heatmap');
    await shot(page, 'sectors_full', { fullPage: true });

    // Period switching
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const p of ['1M', '6M', '1Y']) {
      if (await safeClick(page, page.locator('button').filter({ hasText: new RegExp(`^${p}$`) }).first(), 3000)) {
        await shot(page, `sectors_${p.toLowerCase()}`);
      }
    }
    await context.close();
  }

  // ====== 6. STRATEGIES ======
  console.log('\n=== STRATEGIES ===');
  {
    const { page, context } = await openPage(browser, '/strategies', 4000);
    await shot(page, 'strategies_above_fold');
    await shot(page, 'strategies_full', { fullPage: true });

    // New Strategy flow
    if (await safeClick(page, page.getByText('+ New Strategy').first(), 2500)) {
      await shot(page, 'strategies_new_form');
      await shot(page, 'strategies_new_form_full', { fullPage: true });
    }
    await context.close();
  }

  // ====== 7. MOBILE ======
  console.log('\n=== MOBILE ===');
  for (const [name, path] of [['dashboard', '/'], ['universe', '/universe'], ['fund360', '/fund/F00000YPMX'], ['sectors', '/sectors']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const pg = await ctx.newPage();
    try {
      await pg.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle', timeout: 15000 });
    } catch {
      try { await pg.goto(`${BASE_URL}${path}`, { waitUntil: 'load', timeout: 10000 }); } catch { /* skip */ }
    }
    await pg.waitForTimeout(4000);

    if (name === 'dashboard') {
      try { await pg.locator('a').filter({ hasText: 'Dashboard' }).first().click({ timeout: 2000 }); await pg.waitForTimeout(3000); } catch {}
    }

    shotIndex++;
    await pg.screenshot({ path: join(OUT_DIR, `${String(shotIndex).padStart(2, '0')}_mobile_${name}.png`), clip: { x: 0, y: 0, width: 390, height: 844 } });
    console.log(`  [${String(shotIndex).padStart(2, '0')}] mobile_${name}`);

    shotIndex++;
    await pg.screenshot({ path: join(OUT_DIR, `${String(shotIndex).padStart(2, '0')}_mobile_${name}_full.png`), fullPage: true });
    console.log(`  [${String(shotIndex).padStart(2, '0')}] mobile_${name}_full`);

    await ctx.close();
  }

  await browser.close();
  console.log(`\n=== AUDIT COMPLETE: ${shotIndex} screenshots ===`);
}

run().catch((err) => {
  console.error('Visual audit failed:', err);
  process.exit(1);
});
