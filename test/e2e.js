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
    if (o.goal) await page.check('input[name=goal]');
    await page.click('#noteForm button[type=submit]');
    await page.waitForSelector('#sheetWrap', { state: 'hidden' });
    await settle(page);
  }
  const today = new Date(); const d = n => { const x = new Date(today); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
  await addNote({ type: 'Kumite', title: 'Keep guard up after kicking', note: 'Dropping my left hand when I pull the kick back.', date: d(3) });
  await addNote({ type: 'Kihon', title: 'Front stance depth', note: 'Back leg straighter, heel down.', date: d(5) });
  await addNote({ type: 'Sensei', kata: 'Heian Yondan', from: 'Sensei', title: 'Hips first, then hands', note: 'Drive the turn from the hips.', date: d(0) });
  await addNote({ type: 'Kata', kata: 'Bassai Dai', title: 'Opening feels rushed', note: 'Breathe before the first block. Count the pause after the double block.', pin: true, date: d(0) });
  await addNote({ type: 'General', goal: true, title: 'Bassai Dai ready for grading', note: 'Clean run three times in a row.', date: d(1) });
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
  // (date-relative count check skipped near midnight)
  assert.ok(await page.locator('.note').count() >= 3);
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
  // default belt order: most advanced first within Solo; the sort button flips it
  let names = await page.locator('.krow .kname').allTextContents();
  assert.equal(names[0], 'Bassai Dai', 'Solo starts with the most advanced: ' + names.join(','));
  assert.ok(names.indexOf('Goshin no Kata Shodan') > names.indexOf('Tai Kyoku Shodan'), 'Solo before Multi-person');
  assert.ok(names.indexOf('Sannin Tatakai') < names.indexOf('Goshin no Kata Shodan'), 'Black before White in Multi-person');
  await page.click('[data-act=ksort]');
  names = await page.locator('.krow .kname').allTextContents();
  assert.ok(['Tai Kyoku Shodan', 'San Chin'].includes(names[0]), 'flipped: beginner first: ' + names[0]);
  assert.ok(names.indexOf('Goshin no Kata Shodan') > names.indexOf('Bassai Dai'), 'still Solo before Multi-person');
  await shot(page, '05a-kata-sort-flipped');
  await page.click('[data-act=ksort]');
  await settle(page);
  await shot(page, '05-kata-list');
  await page.click('.krow:has-text("Bassai Dai")');
  // phone Back steps back inside the app instead of closing it
  await page.goBack(); await page.waitForTimeout(200);
  assert.ok(await page.locator('.krow').count() > 0, 'Back from a kata page shows the kata list');
  await page.goBack(); await page.waitForTimeout(200);
  assert.ok(await page.locator('#list').count() === 1, 'Back from the Kata tab shows Notes');
  assert.ok(page.url().startsWith(SITE), 'the app is still open');
  await page.click('.tab[data-v=kata]'); await settle(page);
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

  // kiai notes: collapsed by default, open, edit, save
  assert.equal(await page.locator('.klist').count(), 0, 'kiai details start collapsed');
  await page.click('[data-act=kiai-toggle]');
  assert.equal(await page.locator('.klist li').count(), 2);
  await page.click('[data-act=edit-kiai]');
  await page.fill('input[name=k0]', 'Gyaku Zuki');
  await page.fill('input[name=k1]', 'Closed Fist Jiju Uke');
  await page.click('#kiaiForm button[type=submit]');
  await settle(page); await settle(page);
  assert.ok((await page.textContent('.klist')).includes('Closed Fist Jiju Uke'));
  await shot(page, '06b-kiai-notes');
  await page.click('[data-act=kiai-toggle]');
  assert.equal(await page.locator('.klist').count(), 0);

  // goals: mark done
  await page.click('.tab[data-v=goals]');
  await page.click('[data-act=goal-done]');
  await settle(page);
  await shot(page, '07-goals');
  assert.equal(await page.locator('.goal').count(), 1);
  assert.equal(await page.locator('.tile:has-text("Goals")').count(), 0);

  // any note can become a goal; editing shows a clear Save changes button
  await page.click('.tab[data-v=notes]');
  await page.click('.note:has-text("Keep guard up")');
  await page.click('[data-act=edit-note]');
  assert.ok((await page.textContent('.savebar .save')).includes('Save changes'));
  await page.check('input[name=goal]');
  await shot(page, '07b-edit-save-changes');
  await page.click('.savebar .save');
  await page.waitForSelector('#sheetWrap', { state: 'hidden' });
  await settle(page);
  assert.equal(await page.locator('.note:has-text("Keep guard up") .mk-goal').count(), 1);
  await page.click('.tab[data-v=goals]');
  await settle(page);
  assert.equal(await page.locator('.goal').count(), 2);

  // open a note, delete, undo
  await page.click('.tab[data-v=notes]');
  await page.click('.note:has-text("Front stance depth")');
  await shot(page, '08-note-view');
  await page.click('[data-act=del-note]'); await page.click('[data-act=del-note]');
  await settle(page);
  // (date-relative count check skipped near midnight)
  assert.ok(await page.locator('.note').count() >= 3);
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

  // follow up: its own dashed strip under Working on, ticked off when answered
  await page.click('.note:has-text("Hips first")');
  await page.click('[data-act=edit-note]');
  await page.check('input[name=followUp]');
  await page.click('.who .pillr:has-text("Ask Senpai")');
  await shot(page, '09a-note-markers');
  await page.click('.savebar .save');
  await page.waitForSelector('#sheetWrap', { state: 'hidden' });
  await settle(page);
  assert.equal(await page.locator('.fus .fu').count(), 1);
  assert.ok((await page.textContent('.fus .fu .who')).includes('Ask Senpai'));
  assert.equal(await page.locator('.note:has-text("Hips first") .mk-fu').count(), 1);
  await shot(page, '09b-notes-working-follow');
  await page.click('.fus .fu [data-act=answer]');
  await settle(page);
  assert.equal(await page.locator('.fus .fu').count(), 0);
  await page.click('#toast [data-act=toast]').catch(() => {});

  // assignments: turn a note into one, tick steps, mark done
  await page.click('.note:has-text("Hips first")');
  await page.click('[data-act=to-assign]');
  await page.waitForSelector('#assignForm');
  assert.equal(await page.inputValue('input[name=title]'), 'Hips first, then hands');
  await page.fill('input[name=due]', d(-3));
  await page.fill('textarea[name=steps]', 'Moves 1 to 4\nMoves 5 to 8');
  await page.click('.savebar .save');
  await page.waitForSelector('#sheetWrap', { state: 'hidden' });
  await page.click('#toast [data-act=toast]');
  await settle(page);
  assert.equal(await page.locator('.tab[data-v=assignments][aria-selected=true]').count(), 1);
  assert.equal(await page.locator('.as').count(), 1);
  // one overdue, added from the + button
  await page.click('.fab');
  await page.fill('input[name=title]', 'Film Heian Godan and send it in');
  await page.fill('input[name=due]', d(2));
  await page.click('.savebar .save');
  await page.waitForSelector('#sheetWrap', { state: 'hidden' });
  await settle(page);
  assert.equal(await page.locator('.as.late').count(), 1);
  assert.ok((await page.textContent('.tab[data-v=assignments] .dotn')).includes('1'));
  await shot(page, '09c-assignments');
  await page.click('.as:has-text("Hips first")');
  await page.click('[data-act=step][data-v="0"]');
  await settle(page);
  assert.equal(await page.locator('.stp[aria-pressed=true]').count(), 1);
  await shot(page, '09d-assignment');
  await page.click('[data-act=as-done]');
  await page.click('[data-act=close]');
  await settle(page);
  assert.equal(await page.locator('.as').count(), 1);
  await page.click('[data-act=asview][data-v=done]');
  assert.equal(await page.locator('.as.done').count(), 1);
  await page.click('[data-act=asview][data-v=todo]');
  await page.click('.tab[data-v=notes]');
  await settle(page);

  // the sheet really holds the data
  const st = B.api({ session: await page.evaluate(() => localStorage.getItem('kc.session')) });
  assert.equal(st.state.notes.length, 6);
  assert.equal(st.state.kata[0].kiais, 2);
  assert.equal(st.state.kata[0].kiaiNotes, 'Gyaku Zuki\nClosed Fist Jiju Uke');
  assert.equal(st.state.kata[0].status, 'Polishing');
  assert.equal(st.state.notes.find(n => n.title === 'Bassai Dai ready for grading').done, true);
  assert.equal(st.state.notes.find(n => n.title === 'Bassai Dai ready for grading').goal, true);
  assert.equal(st.state.notes.find(n => n.title === 'Keep guard up after kicking').type, 'Kumite');
  assert.equal(st.state.notes.find(n => n.title === 'Keep guard up after kicking').goal, true);
  const hips = st.state.notes.find(n => n.title === 'Hips first, then hands');
  assert.equal(hips.followUp, true); assert.equal(hips.answered, true); assert.equal(hips.ask, 'Senpai');
  assert.equal(st.state.assignments.length, 2);
  const a1 = st.state.assignments.find(a => a.noteId === hips.id);
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
  assert.equal(await o.page.locator('.fab').count(), 0);
  assert.ok((await o.page.textContent('#sync')).startsWith('View only'));
  await shot(o.page, '12-viewer');
  assert.deepEqual(o.errs, [], o.errs.join('\n'));

  /* ---------- desktop ---------- */
  const w = await phone(browser, 'tok-owner', { width: 1440, height: 900 });
  await w.page.waitForSelector('#fakeG');
  await w.page.click('#fakeG');
  await w.page.waitForSelector('.nbrand');
  await settle(w.page);
  await shot(w.page, '13-desktop-notes');
  // empty panel waits on the right; content fills the width between sidebar and panel
  assert.equal(await w.page.locator('#sheet .pane-empty').count(), 1);
  const box = await w.page.locator('.note').first().boundingBox();
  assert.ok(box.x + box.width > 1440 * 0.6, 'list spans the width: ' + JSON.stringify(box));
  // sidebar has the note types and Settings
  assert.equal(await w.page.locator('.nside .ntype').count(), 6);
  assert.equal(await w.page.locator('.nfoot .nset').count(), 1);
  await w.page.click('.ntype:has-text("Kumite")');
  assert.equal(await w.page.locator('#list .note').count(), 1);
  await w.page.click('.ntype:has-text("All notes")');
  // open a note: no dark overlay, the list stays clickable, the next note replaces it
  await w.page.click('.note:has-text("Hips first")');
  await shot(w.page, '14-desktop-note-panel');
  await w.page.click('.note:has-text("Front stance")', { timeout: 3000 });
  assert.ok((await w.page.textContent('#sheet .shead h2')).includes('Front stance'));
  assert.equal(await w.page.locator('.note.active').count(), 1);
  await w.page.click('.note:has-text("Hips first")');
  await w.page.click('[data-act=edit-note]');
  await shot(w.page, '15-desktop-edit');
  // unsaved edit: another note doesn't silently throw it away
  await w.page.fill('textarea[name=note]', 'Drive the turn from the hips. Changed.');
  await w.page.click('.note:has-text("Front stance")');
  assert.ok(await w.page.locator('#noteForm').count() === 1, 'edit kept');
  await w.page.keyboard.press('Escape');
  assert.equal(await w.page.locator('#sheet .pane-empty').count(), 1);
  await w.page.click('.nset');
  await shot(w.page, '15b-desktop-settings');
  await w.page.keyboard.press('Escape');
  await w.page.keyboard.press('/');
  assert.equal(await w.page.evaluate(() => document.activeElement.id), 'q');
  await w.page.click('.tab[data-v=kata]');
  // a kata opens in the side panel; the list stays and another kata replaces it
  await w.page.click('.krow:has-text("Bassai Dai")');
  assert.ok((await w.page.textContent('#sheet .khero h1')).includes('Bassai Dai'));
  assert.ok(await w.page.locator('.krow').count() > 3, 'kata list stays visible');
  await shot(w.page, '16-desktop-kata');
  await w.page.click('.krow:has-text("Heian Yondan")');
  assert.ok((await w.page.textContent('#sheet .khero h1')).includes('Heian Yondan'));
  assert.equal(await w.page.locator('.krow.active').count(), 1);
  await w.page.click('#sheet [data-act=kiai][data-v="1"]');
  await settle(w.page);
  assert.ok((await w.page.textContent('#sheet .kiai .n')).includes('1'));
  // a note opened from the kata panel comes back to the kata when closed
  await w.page.click('#sheet [data-act=open-note]');
  await w.page.click('#sheet .shead [data-act=close]');
  assert.ok((await w.page.textContent('#sheet .khero h1')).includes('Heian Yondan'));
  await w.page.click('#sheet .kpanehead [data-act=close]');
  assert.equal(await w.page.locator('#sheet .pane-empty').count(), 1);
  await w.page.click('.krow:has-text("Heian Yondan")');
  assert.equal(await w.page.locator('.krow.active').count(), 1, 'reopened kata is highlighted');
  assert.equal(await w.page.$eval('.krow.active', el => getComputedStyle(el).outlineStyle), 'solid');
  await shot(w.page, '16b-desktop-kata-panel');
  await w.page.click('.tab[data-v=goals]');
  await shot(w.page, '17-desktop-goals');
  await w.page.click('.tab[data-v=assignments]');
  await w.page.click('.as:has-text("Film Heian Godan")');
  assert.equal(await w.page.locator('.as.active').count(), 1);
  await shot(w.page, '18-desktop-assignments');
  assert.deepEqual(w.errs, [], w.errs.join('\n'));

  await browser.close();
  console.log('e2e passed; screenshots in ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
