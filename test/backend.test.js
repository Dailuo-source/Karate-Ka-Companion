// node test/backend.test.js
const assert = require('assert');
const { load } = require('./mock');
const B = load({ owner: 'owner@example.com', tokens: { 'tok-owner': 'owner@example.com', 'tok-other': 'friend@example.com' } });

// no session, bad token
assert.equal(B.api({}).error, 'signed_out');
assert.equal(B.api({ idToken: 'nope' }).error, 'signed_out');

// owner signs in and gets the kata list
let r = B.api({ idToken: 'tok-owner' });
assert.ok(r.ok, JSON.stringify(r));
assert.equal(r.role, 'owner');
assert.equal(r.state.kataList.length, 8);
assert.equal(r.state.kataList[6].cat, 'Multi-person');
assert.equal(r.state.kataList[6].belt, 'Black');
assert.equal(r.state.kataList[3].en, 'Great fortress scene');
const S1 = r.session;

// add a note and a kata record
const day = new Date(2026, 9, 17, 12).getTime();
r = B.api({ session: S1, ops: [
  { op: 'add', coll: 'notes', id: 'n1', data: { type: 'Kata', kata: 'Bassai Dai', date: day, title: 'Opening feels rushed', note: 'Breathe first', from: 'Me', pinned: true, done: false } },
  { op: 'add', coll: 'kata', id: 'k1', data: { kata: 'Bassai Dai', kiais: 2, status: 'Polishing' } },
] });
assert.ok(r.ok);
assert.equal(r.state.notes.length, 1);
assert.equal(r.state.notes[0].pinned, true);
assert.equal(r.state.notes[0].date, day);
assert.equal(r.state.kata[0].kiais, 2);
r = B.api({ session: S1, ops: [{ op: 'update', coll: 'kata', id: 'k1', data: { kiais: 3 } }] });
assert.equal(r.state.kata[0].kiais, 3);

// someone else: no access, can ask, owner gets one email
r = B.api({ idToken: 'tok-other' });
assert.equal(r.error, 'no_access');
assert.equal(r.requested, false);
assert.ok(!r.state, 'no data leaks to strangers');
const S2 = r.session;
r = B.api({ session: S2, requestAccess: true });
assert.equal(r.requested, true);
r = B.api({ session: S2, requestAccess: true });
assert.equal(B.mail.length, 1, 'only one email per day');
assert.equal(B.mail[0].to, 'owner@example.com');
assert.equal(B.api({ session: S2, ops: [{ op: 'del', coll: 'notes', id: 'n1' }] }).error, 'no_access');

// owner sees the request and approves it
r = B.api({ session: S1 });
assert.equal(r.state.access.length, 1);
assert.equal(r.state.access[0].status, 'Requested');
B.api({ session: S1, ops: [{ op: 'update', coll: 'access', id: r.state.access[0].id, data: { status: 'Approved' } }] });

// now the friend can view but not change, and never sees the access list
r = B.api({ session: S2 });
assert.ok(r.ok);
assert.equal(r.role, 'viewer');
assert.equal(r.state.notes.length, 1);
assert.equal(r.state.access, undefined);
assert.ok(!r.sheetUrl);
assert.equal(B.api({ session: S2, ops: [{ op: 'del', coll: 'notes', id: 'n1' }] }).error, 'read_only');

// owner removes access again
r = B.api({ session: S1 });
B.api({ session: S1, ops: [{ op: 'update', coll: 'access', id: r.state.access[0].id, data: { status: 'Denied' } }] });
assert.equal(B.api({ session: S2 }).error, 'no_access');

// delete
r = B.api({ session: S1, ops: [{ op: 'del', coll: 'notes', id: 'n1' }] });
assert.equal(r.state.notes.length, 0);

// goal flag on any note; old "Goals"-type rows become General + Goal on setup
r = B.api({ session: S1, ops: [
  { op: 'add', coll: 'notes', id: 'g1', data: { type: 'Kumite', title: 'Keep guard up', goal: true, date: day } },
  { op: 'add', coll: 'notes', id: 'g2', data: { type: 'Goals', title: 'Old style goal', date: day } },
] });
assert.equal(r.state.notes.find(n => n.id === 'g1').goal, true);
assert.equal(r.state.notes.find(n => n.id === 'g1').type, 'Kumite');
B.setup();
r = B.api({ session: S1 });
const g2 = r.state.notes.find(n => n.id === 'g2');
assert.equal(g2.type, 'General');
assert.equal(g2.goal, true);
assert.equal(r.state.notes.find(n => n.id === 'g1').type, 'Kumite');

// follow up on a sheet that doesn't have the new columns yet: they get added, nothing is lost
const notesSh = B.main.getSheetByName('Notes');
notesSh.grid[0] = notesSh.grid[0].map(h => (['Follow up', 'Ask who', 'Answered'].includes(h) ? '' : h));
r = B.api({ session: S1, ops: [{ op: 'update', coll: 'notes', id: 'g1', data: { followUp: true, ask: 'Senpai', answered: false } }] });
let g1 = r.state.notes.find(n => n.id === 'g1');
assert.equal(g1.followUp, true);
assert.equal(g1.ask, 'Senpai');
r = B.api({ session: S1, ops: [{ op: 'update', coll: 'notes', id: 'g1', data: { answered: true } }] });
assert.equal(r.state.notes.find(n => n.id === 'g1').answered, true);

// assignments: own tab, created on first use if missing
B.main.deleteSheet(B.main.getSheetByName('Assignments'));
const due = new Date(2026, 9, 24, 12).getTime();
r = B.api({ session: S1, ops: [{ op: 'add', coll: 'assignments', id: 'a1', data: {
  title: 'Write out bunkai', kata: 'Bassai Dai', given: day, due, steps: '[x] Moves 1 to 4\n[ ] Moves 5 to 8', noteId: 'g1', done: false } }] });
assert.ok(r.ok, JSON.stringify(r));
assert.equal(r.state.assignments.length, 1);
assert.equal(r.state.assignments[0].due, due);
assert.equal(r.state.assignments[0].steps, '[x] Moves 1 to 4\n[ ] Moves 5 to 8');
assert.equal(r.state.assignments[0].noteId, 'g1');
r = B.api({ session: S1, ops: [{ op: 'update', coll: 'assignments', id: 'a1', data: { done: true, doneOn: due } }] });
assert.equal(r.state.assignments[0].done, true);
r = B.api({ session: S1, ops: [{ op: 'del', coll: 'assignments', id: 'a1' }] });
assert.equal(r.state.assignments.length, 0);

// sessions are stored hashed, never as the token itself
assert.ok(!Object.keys(B.props).some(k => k.includes(S1)));

/* ---------- notifications ---------- */
const keyOf = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const at = (k, hm) => new Date(k + 'T' + hm + ':00').getTime();
// Tue 2026-11-03 class 19:00–20:30 on Tue/Thu
const cfg = B.clean({ days: [2, 4], start: '19:00', end: '20:30', before: { on: true, m: 60 }, after: { on: true, m: 60 }, due: { on: true, d: 1, t: '08:00' }, stale: { on: true, dow: 2, t: '19:30' } });
assert.equal(cfg.month.on, true); assert.equal(cfg.quiet.from, '22:00');
const all = {
  notes: [
    { id: 'n1', title: 'Opening feels rushed', pinned: true, date: at('2026-11-02', '12:00'), updated: at('2026-11-02', '12:00') },
    { id: 'n2', title: 'Kiai on the last move?', followUp: true, answered: false, ask: 'Senpai', date: at('2026-11-01', '12:00') },
    { id: 'n3', title: 'Relax shoulders', pinned: true, date: at('2026-09-01', '12:00'), updated: at('2026-09-01', '12:00') },
    { id: 'rv', review: '2026-10', note: 'x', date: at('2026-10-01', '12:00') },
  ],
  assignments: [{ id: 'a9', title: 'Heian Godan bunkai', due: at('2026-11-04', '12:00'), steps: '[x] One\n[ ] Two', done: false }],
};
let out = B.due(all, cfg, '2026-11-03 18:00', '2026-11-03 17:55', {}, keyOf, at('2026-11-03', '18:00'));
assert.equal(out.length, 1, JSON.stringify(out));
assert.equal(out[0].title, 'Karate in 1 hour');
assert.ok(out[0].body.includes('From Sensei: Heian Godan bunkai') && out[0].body.includes('Practice: Opening feels rushed') && out[0].body.includes('Ask Senpai: Kiai'), out[0].body);
// after class (no note today), stale list on Tuesday, assignment due tomorrow at 8
out = B.due(all, cfg, '2026-11-03 21:30', '2026-11-03 18:00', { 'before:2026-11-03': true }, keyOf, at('2026-11-03', '21:30'));
assert.deepEqual(out.map(o => o.tag).sort(), ['after:2026-11-03', 'stale:2026-11-03']);
assert.equal(out.find(o => o.tag.startsWith('stale')).body, 'Relax shoulders');
const withNote = Object.assign({}, all, { notes: all.notes.concat([{ id: 'n4', title: 'Today', date: at('2026-11-03', '12:00') }]) });
assert.equal(B.due(withNote, cfg, '2026-11-03 21:30', '2026-11-03 21:25', {}, keyOf, 0).filter(o => o.tag.startsWith('after')).length, 0, 'no reminder once a note is written');
out = B.due(all, cfg, '2026-11-03 08:00', '2026-11-03 07:55', {}, keyOf, 0);
assert.equal(out[0].title, 'Assignment due tomorrow'); assert.equal(out[0].body, 'Heian Godan bunkai · 1 of 2 steps done'); assert.equal(out[0].link, 'a:a9');
// quiet hours push a late reminder to 7:00 next morning; the 1st brings last month's review
const late = B.clean(Object.assign({}, cfg, { after: { on: true, m: 120 } }));
assert.equal(B.due(all, late, '2026-11-03 22:35', '2026-11-03 22:25', {}, keyOf, 0).length, 0);
assert.equal(B.due(all, late, '2026-11-04 07:00', '2026-11-04 06:55', {}, keyOf, 0).filter(o => o.tag === 'after:2026-11-03').length, 1);
out = B.due(all, cfg, '2026-12-01 09:00', '2026-12-01 08:55', {}, keyOf, 0);
assert.equal(out[0].title, 'Your November review is ready'); assert.equal(out[0].link, 'review:2026-11');

// settings, phones and the test message through the API
B.turnOn();
assert.equal(B.triggers.length, 1);
r = B.api({ session: S1, notify: { days: [1, 3], start: '18:30', before: { on: false } } });
assert.equal(r.push.vapid, 'PUB'); assert.equal(r.push.on, true);
assert.deepEqual(r.notify.days, [1, 3]); assert.equal(r.notify.before.on, false); assert.equal(r.notify.start, '18:30');
r = B.api({ session: S1, ops: [{ op: 'add', coll: 'devices', id: 'd1', data: { endpoint: 'https://push.example/1', p256dh: 'k', auth: 'a', label: 'Phone' } },
  { op: 'add', coll: 'devices', id: 'd2', data: { endpoint: 'https://push.example/1', p256dh: 'k2', auth: 'a2', label: 'Phone' } }], test: true });
assert.equal(r.state.devices.length, 1, 'same phone twice is one row');
assert.equal(r.test.sent, 1);
assert.equal(B.pushes[0].payload.title, 'Notifications are working');
assert.equal(r.state.sent, undefined, 'the Sent log stays in the sheet');
// a phone that unsubscribed is removed when a send comes back 410
B.api({ session: S1, ops: [{ op: 'add', coll: 'devices', id: 'd3', data: { endpoint: 'https://push.example/gone', p256dh: 'k', auth: 'a' } }] });
r = B.api({ session: S1, test: true });
assert.equal(r.state.devices.length, 1);
// viewers can't change settings
console.log('backend tests passed');

