// Shared helpers for the end-to-end flows. They drive the real, deployed system in a browser.
//   E2E_BASE_URL  the site to test (default https://vtcsystem.app)
//   E2E_CREDS     path to a JSON file (kept out of the repository): [{ "role": "...", "email": "...", "pw": "..." }, ...]
const { chromium } = require('playwright');
const fs = require('fs');

if (!process.env.E2E_CREDS) throw new Error('Set E2E_CREDS to the path of the test-account JSON file');
const creds = Object.fromEntries(JSON.parse(fs.readFileSync(process.env.E2E_CREDS)).map((r) => [r.role, r]));
const BASE = process.env.E2E_BASE_URL || 'https://vtcsystem.app';

async function session(role) {
  const b = await chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/auth', { waitUntil: 'networkidle', timeout: 60000 });
  await p.fill('#signin-email', creds[role].email);
  await p.fill('#signin-password', creds[role].pw);
  await p.click('button:has-text("Sign In")');
  await p.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 30000 }).catch(() => {});
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(2500);
  return { b, p };
}

module.exports = { session, creds, BASE };
