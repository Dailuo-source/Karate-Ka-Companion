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
const root = path.join(__dirname, '..', 'web');

async function phone(browser, token, vp) {
  const ctx = await browser.newContext({ viewport: vp || { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
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
  assert.equal((await page.textContent('.top h1')).trim(), 'Now', 'the app opens on Now');
  assert.ok((await page.textContent('.actbar')).includes("Write today's notes"));

  const today = new Date(); const d = n => { const x = new Date(today); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
  async function addNote(o) {
    await page.click('.actbar [data-act=new]');
    await page.waitForSelector('#noteForm');
    await page.click(`.tile:has-text("${o.type}")`);
    for (const k of (o.kata || [])) await page.selectOption('#kataAdd', k);
    if (o.date) await page.fill('input[name=date]', o.date);
    if (o.from) await page.click(`.pillr:has-text("${o.from}")`);
    await page.fill('input[name=title]', o.title);
    const pts = o.points || [];
    for (let i = 0; i < pts.length; i++) {
      if (i) await page.keyboard.press('Enter'); else await page.click('#pts textarea');
      await page.keyboard.type(pts[i]);
    }
    if (o.dest) await page.click(`.dopt:has(input[value=${o.dest}]) > label`);
    if (o.ask) { await page.click('.dsub .pillr:has-text("A question to ask")'); await page.click(`.who .pillr:has-text("${o.ask}")`); }
    if (o.goal) await page.click('.dsub .pillr:has-text("A goal")');
    if (o.shot) await shot(page, o.shot);
    await page.click('#noteForm button[type=submit]');
    await page.waitForSelector('#sheetWrap', { state: 'hidden' });
    await settle(page);
  }
  await addNote({ type: 'Kumite', title: 'Keep guard up after kicking', points: ['Left hand drops when I pull the kick back'], date: d(3) });
  await addNote({ type: 'Kihon', title: 'Front stance depth', points: ['Back leg straighter', 'Heel down'], date: d(5), dest: 'now' });
  await addNote({ type: 'Sensei', kata: ['Heian Yondan'], from: 'Sensei', title: 'Hips first, then hands', points: ['Drive the turn from the hips'], date: d(0), dest: 'keep' });
  await addNote({ type: 'Kata', kata: ['Bassai Dai', 'Heian Yondan'], title: 'Opening feels rushed', points: ['Breathe before the first block', 'Count the pause after the double block'], dest: 'now', date: d(0), shot: '04-new-note' });
  await addNote({ type: 'General', title: 'Bassai Dai ready for grading', points: ['Clean run three times in a row'], date: d(1), dest: 'keep', goal: true });
  await addNote({ type: 'General', title: 'Kiai on the last move?', points: [], date: d(1), dest: 'now', ask: 'Ask Senpai' });
  await addNote({ type: 'General', title: 'Bring a spare belt', points: [], date: d(40) });
  await page.waitForFunction(() => !document.querySelector('#sync') || !/Saving/.test(document.querySelector('#sync').textContent));
  await settle(page);

  // Now: practice items and the question, with the box on the right
  assert.equal(await page.locator('.xl .xr').count(), 3);
  assert.equal(await page.locator('.xr:has-text("Kiai on the last move") .tg-ask').count(), 1);
  await page.click('.xr-main:has-text("Opening feels rushed")');
  assert.equal(await page.locator('.xr-b .pts li').count(), 2, 'expanded row shows its points');
  await shot(page, '02-now');
  const boxX = (await page.locator('.xr:has-text("Front stance") .xr-box').boundingBox()).x;
  assert.ok(boxX > 300, 'box is on the right: ' + boxX);
  await page.click('.xr:has-text("Front stance") .xr-box');
  await settle(page);
  assert.equal(await page.locator('.xl .xr').count(), 2);
  await page.click('#toast [data-act=toast]'); // undo
  await settle(page);
  assert.equal(await page.locator('.xl .xr').count(), 3);
  await page.click('.xr:has-text("Kiai on the last move") .xr-box');
  await settle(page);
  assert.equal(await page.locator('.xl .xr').count(), 2, 'answered question leaves Now');

  // Notes: one card per day, calendar, filter
  await page.click('.tab[data-v=notes]');
  await settle(page);
  assert.ok(await page.locator('.dcard').count() >= 4);
  assert.equal(await page.locator('.nrow').count(), 7);
  await shot(page, '03-notes-list');
  await page.click('[data-act=datef]');
  await page.click('[data-act=settype][data-v=Kumite]');
  assert.equal(await page.locator('.nrow').count(), 1);
  await page.click('[data-act=datef]'); await page.click('[data-act=settype][data-v=All]');
  await page.click('[data-act=search]');
  await page.fill('#q', 'spare');
  assert.equal(await page.locator('.nrow').count(), 1);
  await page.fill('#q', '');
  await page.click('[data-act=nview][data-v=cal]');
  assert.ok(await page.locator('.cday.has').count() >= 2);
  await shot(page, '03b-notes-calendar');
  await page.click('[data-act=nview][data-v=list]');

  // a note shows its points and both kata
  await page.click('.nrow:has-text("Opening feels rushed")');
  assert.equal(await page.locator('#sheet .view-body li').count(), 2);
  assert.equal(await page.locator('#sheet [data-act=open-kata]').count(), 2);
  await shot(page, '08-note-view');
  await page.click('#sheet .shead [data-act=close]');

  // month review: wins + takeaway
  await page.click('.revbtn >> nth=0');
  await page.waitForSelector('#reviewForm');
  await page.fill('textarea[name=takeaway]', 'Slow down the Bassai Dai opening.');
  await page.click('#reviewForm .savebar .save');
  await settle(page);
  await shot(page, '07-month-review');
  await page.click('#reviewForm [data-act=close]');
  assert.equal(await page.locator('.nrow:has-text("takeaway")').count(), 0, 'takeaways are not listed as notes');

  // Kata: a note on two kata shows on both pages
  await page.click('.tab[data-v=kata]');
  await settle(page);
  const names = await page.$$eval('.krow .kname', els => els.map(e => e.textContent));
  assert.equal(names[0], 'Bassai Dai', 'Solo starts with the most advanced: ' + names.join(','));
  await page.click('[data-act=ksort]');
  assert.ok(['Tai Kyoku Shodan', 'San Chin'].includes((await page.$$eval('.krow .kname', els => els.map(e => e.textContent)))[0]));
  await page.click('[data-act=ksort]');
  await shot(page, '05-kata-list');
  await page.click('.krow:has-text("Heian Yondan")');
  assert.equal(await page.locator('.tl:has-text("Opening feels rushed")').count(), 1);
  await page.click('[data-act=kata-back]');
  await page.click('.krow:has-text("Bassai Dai")');
  assert.equal(await page.locator('.tl:has-text("Opening feels rushed")').count(), 1);
  await page.click('[data-act=kiai][data-v="1"]');
  await page.click('[data-act=kiai][data-v="1"]');
  await page.click('[data-act=kstatus][data-v=Polishing]');
  await settle(page);
  assert.equal((await page.textContent('.kiai .n')).trim(), '2');
  await shot(page, '06-kata-page');
  // Back: kata page → kata list → Now
  await page.goBack(); await settle(page);
  assert.ok(await page.locator('.krow').count() > 0);
  await page.goBack(); await settle(page);
  assert.equal((await page.textContent('.top h1')).trim(), 'Now');

  // Keep in mind: goal + lesson; lesson grouped under its kata
  await page.click('.tab[data-v=keep]');
  await settle(page);
  assert.equal(await page.locator('.xr.goalr').count(), 1);
  assert.equal(await page.locator('.xr:has-text("Hips first")').count(), 1);
  await shot(page, '10-keep');
  await page.click('.xr.goalr .xr-box');
  await settle(page);
  assert.equal(await page.locator('.xr.goalr').count(), 0);
  await page.click('[data-act=reached]');
  assert.equal(await page.locator('.xr.goalr.done').count(), 1);

  // assignments: from a note, and a new one due soon that also shows on Now
  await page.click('.tab[data-v=notes]');
  await page.click('.nrow:has-text("Keep guard up")');
  await page.click('[data-act=to-assign]');
  await page.waitForSelector('#assignForm');
  await page.fill('input[name=due]', d(-3));
  await page.fill('textarea[name=steps]', 'Moves 1 to 4\nMoves 5 to 8');
  await page.click('.savebar .save');
  await page.waitForSelector('#sheetWrap', { state: 'hidden' });
  await page.click('.tab[data-v=assignments]');
  await page.click('.actbar [data-act=new]');
  await page.fill('input[name=title]', 'Film Heian Godan and send it in');
  await page.fill('input[name=due]', d(2));
  await page.click('.savebar .save');
  await page.waitForSelector('#sheetWrap', { state: 'hidden' });
  await settle(page);
  assert.ok((await page.textContent('.tab[data-v=assignments] .dotn')).includes('1'));
  await page.click('.xr-main:has-text("Keep guard up")');
  await page.click('.xr-b [data-act=step][data-v="0"]');
  await settle(page);
  assert.equal(await page.locator('.stp[aria-pressed=true]').count(), 1);
  await shot(page, '09-assignments');
  await page.click('.xr:has-text("Keep guard up") .xr-box');
  await settle(page);
  await page.click('[data-act=asview][data-v=done]');
  assert.equal(await page.locator('.xr.done').count(), 1);
  await page.click('[data-act=asview][data-v=todo]');
  await page.click('.tab[data-v=now]');
  await settle(page);
  assert.equal(await page.locator('.xr:has-text("Film Heian Godan") .tg-as').count(), 1, 'assignment due soon shows on Now');
  await shot(page, '02b-now-with-assignment');

  // light theme
  await page.click('[data-act=account]');
  await page.click('[data-act=theme][data-v=light]');
  await page.click('[data-act=close]');
  await shot(page, '11-light');
  await page.click('[data-act=account]');
  await page.click('[data-act=theme][data-v=dark]');
  await page.click('[data-act=close]');

  // notifications: bell on Now opens the settings; changes are saved in the script
  B.turnOn();
  await page.click('.tab[data-v=now]');
  await page.click('[data-act=bell]');
  await page.waitForSelector('.ndays');
  await page.click('[data-act=nday][data-v="2"]');
  await page.fill('input[data-n=start]', '18:30');
  await page.selectOption('select[data-n="before.m"]', '30');
  await page.click('.tgl:has(input[data-n="stale.on"])');
  await page.waitForTimeout(1500); await settle(page);
  await shot(page, '12-notifications');
  const NF = JSON.parse(B.props.NOTIFY);
  assert.deepEqual(NF.days, [2]); assert.equal(NF.start, '18:30'); assert.equal(NF.before.m, 30); assert.equal(NF.stale.on, true);
  await page.click('#sheet .shead [data-act=close]');

  // the sheet really holds the data
  const st = B.api({ session: await page.evaluate(() => localStorage.getItem('kc.session')) });
  const N = t => st.state.notes.find(n => n.title === t);
  assert.equal(st.state.notes.length, 8);
  assert.equal(N('Opening feels rushed').kata, 'Bassai Dai, Heian Yondan');
  assert.equal(N('Opening feels rushed').note, 'Breathe before the first block\nCount the pause after the double block');
  assert.equal(N('Opening feels rushed').pinned, true);
  assert.equal(N('Hips first, then hands').keep, true);
  assert.equal(N('Bassai Dai ready for grading').goal, true);
  assert.equal(N('Bassai Dai ready for grading').done, true);
  assert.equal(N('Kiai on the last move?').followUp, true);
  assert.equal(N('Kiai on the last move?').answered, true);
  assert.equal(N('Kiai on the last move?').ask, 'Senpai');
  assert.ok(st.state.notes.some(n => n.review && n.note === 'Slow down the Bassai Dai opening.'));
  assert.equal(st.state.kata[0].kiais, 2);
  assert.equal(st.state.assignments.length, 2);
  const a1 = st.state.assignments.find(a => a.noteId === N('Keep guard up after kicking').id);
  assert.equal(a1.steps, '[x] Moves 1 to 4\n[ ] Moves 5 to 8');
  assert.equal(a1.done, true);
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
  assert.equal(await o.page.locator('.actbar').count(), 0);
  assert.ok((await o.page.textContent('#sync')).startsWith('View only'));
  await shot(o.page, '12-viewer');
  assert.deepEqual(o.errs, [], o.errs.join('\n'));

  /* ---------- desktop ---------- */
  const w = await phone(browser, 'tok-owner', { width: 1440, height: 900 });
  await w.page.waitForSelector('#fakeG');
  await w.page.click('#fakeG');
  await w.page.waitForSelector('.nbrand');
  await settle(w.page);
  await shot(w.page, '13-desktop-now');
  assert.equal(await w.page.locator('#sheet .pane-empty').count(), 1);
  const box = await w.page.locator('.xr').first().boundingBox();
  assert.ok(box.x + box.width > 1440 * 0.6, 'list spans the width: ' + JSON.stringify(box));
  assert.equal(await w.page.locator('.nside .ntype').count(), 6);
  await w.page.click('.ntype:has-text("Kumite")');
  assert.equal(await w.page.locator('#list .nrow').count(), 1);
  await w.page.click('.ntype:has-text("All notes")');
  await w.page.click('.nrow:has-text("Hips first")');
  await w.page.click('.nrow:has-text("Front stance")', { timeout: 3000 });
  assert.ok((await w.page.textContent('#sheet .shead h2')).includes('Front stance'));
  assert.equal(await w.page.locator('.nrow.active').count(), 1);
  await shot(w.page, '14-desktop-notes');
  await w.page.click('[data-act=edit-note]');
  await w.page.fill('#pts textarea >> nth=0', 'Back leg straighter, changed');
  await w.page.click('.nrow:has-text("Hips first")');
  assert.ok(await w.page.locator('#noteForm').count() === 1, 'unsaved edit kept');
  await shot(w.page, '15-desktop-edit');
  await w.page.keyboard.press('Escape');
  await w.page.keyboard.press('/');
  assert.equal(await w.page.evaluate(() => document.activeElement.id), 'q');
  await w.page.click('.tab[data-v=kata]');
  await w.page.click('.krow:has-text("Bassai Dai")');
  assert.ok((await w.page.textContent('#sheet .khero h1')).includes('Bassai Dai'));
  await shot(w.page, '16-desktop-kata');
  await w.page.click('.tab[data-v=keep]');
  await shot(w.page, '17-desktop-keep');
  await w.page.click('.tab[data-v=assignments]');
  await shot(w.page, '18-desktop-assignments');
  assert.deepEqual(w.errs, [], w.errs.join('\n'));

  await browser.close();
  console.log('e2e passed; screenshots in ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
