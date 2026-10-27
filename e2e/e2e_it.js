// IT Systems Administrator flows: a centre staff member raises tickets, the Organization Admin works and escalates them, the requester follows them.
const { session, BASE } = require('./lib.js');
const log = (...a) => console.log(...a);
const tag = Date.now().toString().slice(-6);

async function raise(p, subject, description) {
  await p.goto(BASE + '/support-tickets', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await p.click('button:has-text("New Ticket")');
  await p.fill('#subject', subject); await p.fill('#description', description);
  await p.locator('[role=dialog] button[type=submit]').click(); await p.waitForTimeout(2500);
}

(async () => {
  const t = await session('registration_officer'); const a = await session('organization_admin');
  for (const [who, pg] of [['requester', t.p], ['admin', a.p]]) {
    pg.on('pageerror', (e) => log('PAGEERROR', who, e.message));
    pg.on('response', async (r) => { if (r.status() >= 400 && r.url().includes('supabase.co') && !r.url().includes('active_package')) log('HTTP', who, r.status(), r.url().split('/').slice(-2).join('/'), (await r.text().catch(() => '')).slice(0, 140)); });
  }
  const s1 = `Cannot open my results page ${tag}`, s2 = `Password reset email not arriving ${tag}`;
  await raise(t.p, s1, 'The results page shows a blank screen after I sign in.');
  await raise(t.p, s2, 'I asked for a reset link twice and nothing came.');

  // administrator: dashboard shows real counts, opens the first ticket
  await a.p.goto(BASE + '/organization-admin-dashboard', { waitUntil: 'networkidle' }); await a.p.waitForTimeout(2500);
  log('dashboard stats:', (await a.p.locator('main').innerText()).replace(/\s+/g, ' ').match(/Open tickets\s*\d+/)?.[0]);
  await a.p.screenshot({ path: 'it_live_dash.png', fullPage: true });
  await a.p.locator(`button:has-text("${s1}")`).first().click(); await a.p.waitForTimeout(2500);
  let dlg = a.p.locator('[role=dialog]');
  await dlg.locator('#ticket-msg').fill('Thanks, I can see the problem on your account and I am looking into it.');
  await dlg.locator('button:has-text("Reply to requester")').click(); await a.p.waitForTimeout(2000);
  await dlg.locator('#ticket-msg').fill('Cache cleared, no fault found. Suspect a data problem on the server side.');
  await dlg.locator('button:has-text("Add internal note")').click(); await a.p.waitForTimeout(2000);
  await dlg.locator('button:has-text("Escalate to Super Admin")').click();
  await dlg.locator('textarea').last().fill('Cleared the cache and checked the account; the blank page persists, which points to a server fault.');
  await dlg.locator('button:has-text("Escalate")').last().click(); await a.p.waitForTimeout(3000);
  log('escalated dialog closed:', (await a.p.locator('[role=dialog]').count()) === 0);

  // second ticket: resolve it
  await a.p.goto(BASE + '/support-tickets', { waitUntil: 'networkidle' }); await a.p.waitForTimeout(1500);
  await a.p.locator(`tr:has-text("${s2}")`).first().click(); await a.p.waitForTimeout(2000);
  dlg = a.p.locator('[role=dialog]');
  await dlg.locator('button:has-text("Resolve")').first().click();
  await dlg.locator('textarea').last().fill('Mail filter was blocking the sender; whitelisted it and re-sent the link.');
  await dlg.locator('button:has-text("Resolve ticket")').click(); await a.p.waitForTimeout(3000);

  // administrator sees the escalated tab and the tickets' states
  await a.p.goto(BASE + '/support-tickets?tab=escalated', { waitUntil: 'networkidle' }); await a.p.waitForTimeout(1800);
  log('escalated tab:', (await a.p.locator('[role=tabpanel]:visible').innerText()).replace(/\s+/g, ' ').slice(0, 160));
  await a.p.screenshot({ path: 'it_live_escalated.png', fullPage: true });

  // requester: sees the public reply and the resolution, never the internal note or the escalation reason
  await t.p.goto(BASE + '/support-tickets', { waitUntil: 'networkidle' }); await t.p.waitForTimeout(1500);
  await t.p.locator(`tr:has-text("${s1}")`).first().click(); await t.p.waitForTimeout(2000);
  const thread = (await t.p.locator('[role=dialog]').innerText()).replace(/\s+/g, ' ');
  log('requester sees reply:', thread.includes('I can see the problem'), '| sees internal note:', thread.includes('server side'), '| sees escalation reason:', thread.includes('points to a server fault'), '| sees "escalated" status line:', thread.includes('escalated to the Super Admin'));
  await t.p.screenshot({ path: 'it_live_trainee.png' });
  await t.p.keyboard.press('Escape');
  await t.p.click('[role=tab]:has-text("Resolved")'); await t.p.waitForTimeout(800);
  log('requester resolved tab has second ticket:', (await t.p.locator('[role=tabpanel]:visible').innerText()).includes(s2));

  // blocked pages and diagnostics
  for (const path of ['/transcripts', '/bank-reconciliation', '/graduation']) { await a.p.goto(BASE + path, { waitUntil: 'networkidle' }); await a.p.waitForTimeout(1200); log('admin', path, '->', a.p.url().replace(BASE, '')); }
  await a.p.goto(BASE + '/system-status', { waitUntil: 'networkidle' }); await a.p.waitForTimeout(2500);
  log('diagnostics:', (await a.p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 220));
  await a.p.screenshot({ path: 'it_live_status.png', fullPage: true });
  await t.b.close(); await a.b.close();
})();
