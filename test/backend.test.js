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

// sessions are stored hashed, never as the token itself
assert.ok(!Object.keys(B.props).some(k => k.includes(S1)));
console.log('backend tests passed');
