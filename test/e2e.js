// node test/e2e.js <screenshot dir>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { load } = require('./mock');

const OUT = process.argv[2] || '/tmp/kc-shots';
fs.mkdirSync(OUT, { recursive: true });
const SITE = 'https://karateka.test/';
const API = 'https://script.google.com/macros/s/TEST/exec';
const B = load({ owner: 'owner@example.com', tokens: { 'tok-owner': 'owner@example.com', 'tok-other': 'friend@example.com' } });
const root = path.join(__dirname, '..');

async function phone(browser, token) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
  await ctx.addInitScript(tok => {
    window.google = { accounts: { id: {
      initialize(o) { window.__cb = o.callback; },
      renderButton(el) { el.innerHTML = '<button id="fakeG" style="height:44px;width:300px;border-radius:22px;background:#202124;color:#fff;font-weight:700">Continue with Google</button>'; el.querySelector('button').onclick = () => window.__cb({ credential: tok }); },
      prompt() {}, disableAutoSelect() {},
    } } };
  }, token);
  await ctx.route('https://fonts.googleapis.com/**', r => r.abort());
  await ctx.route('https://fonts.gstatic.com/**', r => r.abort());
  await ctx.route(SITE + '**', r => {
    const p = new URL(r.request().url()).pathname.replace(/^\//, '') || 'index.html';
    const f = path.join(root, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    const type = p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : p.endsWith('.png') ? 'image/png' : 'application/json';
    r.fulfill({ status: 200, contentType: type, body: fs.readFileSync(f) });
  });
  await ctx.route(API, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(B.api(r.request().postData() || '{}')) }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => { if (!/fetching the script/.test(e.message)) errs.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_FAILED|fetching the script/.test(m.text())) errs.push(m.text()); });
  await page.goto(SITE + '#api=' + encodeURIComponent(API) + '&client=test-client.apps.googleusercontent.com');
  return { page, errs, ctx };
}
const shot = async (page, name) => { await page.waitForTimeout(350); return page.screenshot({ path: path.join(OUT, name + '.png') }); };
const settle = page => page.waitForTimeout(700);

(async () => {
  const browser = await chromium.launch();

  /* ---------- owner ---------- */
  const { page, errs } = await phone(browser, 'tok-owner');
  await page.waitForSelector('#fakeG');
  await shot(page, '01-sign-in');
  await page.click('#fakeG');
  await page.waitForSelector('.top h1');
  assert.ok((await page.textContent('.empty')).includes('No notes yet'));

  async function addNote(o) {
    await page.click('.fab');
    await page.waitForSelector('#noteForm');
    await page.click(`.tile:has-text("${o.type}")`);
    if (o.kata) await page.selectOption('select[name=kata]', o.kata);
    if (o.date) await page.fill('input[name=date]', o.date);
    if (o.from) await page.click(`.pillr:has-text("${o.from}")`);
    await page.fill('input[name=title]', o.title);
    await page.fill('textarea[name=note]', o.note);
    if (o.pin) await page.check('input[name=pinned]');
    await page.click('#noteForm button[type=submit]');
    await page.waitForSelector('#sheetWrap', { state: 'hidden' });
    await settle(page);
  }
  const today = new Date(); const d = n => { const x = new Date(today); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
  await addNote({ type: 'Kumite', title: 'Keep guard up after kicking', note: 'Dropping my left hand when I pull the kick back.', date: d(3) });
  await addNote({ type: 'Kihon', title: 'Front stance depth', note: 'Back leg straighter, heel down.', date: d(5) });
  await addNote({ type: 'Sensei', kata: 'Heian Yondan', from: 'Sensei', title: 'Hips first, then hands', note: 'Drive the turn from the hips.', date: d(0) });
  await addNote({ type: 'Kata', kata: 'Bassai Dai', title: 'Opening feels rushed', note: 'Breathe before the first block. Count the pause after the double block.', pin: true, date: d(0) });
  await addNote({ type: 'Goals', title: 'Bassai Dai ready for grading', note: 'Clean run three times in a row.', date: d(1) });
  await addNote({ type: 'General', title: 'Bring a spare belt', note: '', date: d(40) });
  await page.waitForFunction(() => !document.querySelector('#sync') || !/Saving/.test(document.querySelector('#sync').textContent));
  await settle(page);
  assert.equal(await page.locator('.note').count(), 6);
  await shot(page, '02-notes-home');

  // sort oldest first
  await page.click('[data-act=sort]');
  const firstOld = await page.textContent('.note .ntitle');
  assert.equal(firstOld, 'Bring a spare belt');
  await page.click('[data-act=sort]');
  // date filter: last 7 days hides the 40-day-old note
  await page.click('[data-act=datef]');
  await shot(page, '03-date-filter');
  await page.click('[data-act=setdate][data-v=week]');
  assert.equal(await page.locator('.note').count(), 5);
  await page.click('[data-act=datef]'); await page.click('[data-act=setdate][data-v=all]');
  // type filter
  await page.click('.chip[data-v="Kumite"]');
  assert.equal(await page.locator('.note').count(), 1);
  await page.click('.chip[data-v="All"]');
  // search
  await page.fill('#q', 'hips');
  assert.equal(await page.locator('.note').count(), 1);
  await page.fill('#q', '');

  // new-note form
  await page.click('.fab');
  await page.waitForSelector('#noteForm');
  await shot(page, '04-new-note');
  await page.click('#noteForm .shead [data-act=close]');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#toast').isVisible(), false, 'closing the form must not try to save');

  // kata page + kiai counter
  await page.click('.tab[data-v=kata]');
  await settle(page);
  await shot(page, '05-kata-list');
  await page.click('.krow:has-text("Bassai Dai")');
  await page.click('[data-act=kiai][data-v="1"]');
  await page.click('[data-act=kiai][data-v="1"]');
  await page.click('[data-act=kstatus][data-v=Polishing]');
  await page.click('[data-act=edit-rem]');
  await page.fill('textarea[name=rem]', 'Breathe before the first block\nTurns come from the hips');
  await page.click('#remForm button[type=submit]');
  await settle(page); await settle(page);
  assert.equal((await page.textContent('.kiai .n')).trim(), '2');
  await shot(page, '06-kata-page');
  await page.click('[data-act=kiai][data-v="-1"]');
  await settle(page);
  assert.equal((await page.textContent('.kiai .n')).trim(), '1');
  await page.click('[data-act=kiai][data-v="1"]');
  await settle(page);

  // goals: mark done
  await page.click('.tab[data-v=goals]');
  await page.click('[data-act=goal-done]');
  await settle(page);
  await shot(page, '07-goals');

  // open a note, delete, undo
  await page.click('.tab[data-v=notes]');
  await page.click('.note:has-text("Front stance depth")');
  await shot(page, '08-note-view');
  await page.click('[data-act=del-note]'); await page.click('[data-act=del-note]');
  await settle(page);
  assert.equal(await page.locator('.note').count(), 5);
  await page.click('#toast [data-act=toast]');
  await settle(page); await settle(page);
  assert.equal(await page.locator('.note').count(), 6);

  // light theme
  await page.click('[data-act=account]');
  await page.click('[data-act=theme][data-v=light]');
  await page.click('[data-act=close]');
  await shot(page, '09-light');
  await page.click('[data-act=account]');
  await page.click('[data-act=theme][data-v=dark]');
  await page.click('[data-act=close]');

  // the sheet really holds the data
  const st = B.api({ session: await page.evaluate(() => localStorage.getItem('kc.session')) });
  assert.equal(st.state.notes.length, 6);
  assert.equal(st.state.kata[0].kiais, 2);
  assert.equal(st.state.kata[0].status, 'Polishing');
  assert.equal(st.state.notes.find(n => n.type === 'Goals').done, true);
  assert.deepEqual(errs, [], errs.join('\n'));

  /* ---------- someone else ---------- */
  const o = await phone(browser, 'tok-other');
  await o.page.waitForSelector('#fakeG');
  await o.page.click('#fakeG');
  await o.page.waitForSelector('[data-act=ask]');
  await shot(o.page, '10-no-access');
  await o.page.click('[data-act=ask]');
  await o.page.waitForSelector('[data-act=recheck]');
  assert.equal(B.mail.length, 1);
  assert.equal(await o.page.evaluate(() => localStorage.getItem('kc.state')), null);

  // owner allows from the app
  await page.reload(); await page.waitForSelector('.top h1');
  await page.click('[data-act=account]');
  await shot(page, '11-account-access');
  await page.click('[data-act=access][data-v=Approved]');
  await settle(page); await settle(page);
  await o.page.click('[data-act=recheck]');
  await o.page.waitForSelector('.top h1');
  assert.equal(await o.page.locator('.fab').count(), 0);
  assert.ok((await o.page.textContent('#sync')).startsWith('View only'));
  await shot(o.page, '12-viewer');
  assert.deepEqual(o.errs, [], o.errs.join('\n'));

  await browser.close();
  console.log('e2e passed; screenshots in ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
