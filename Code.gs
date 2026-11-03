/**
 * Karate-Ka Companion — Google Sheets backend
 *
 * The Sheet is the database:
 *   Notes    — one row per note (dated), typed Kata / Kihon / Kumite / Sensei says / General. The Note column holds
 *              points, one per line. Kata can list several, separated by commas. Pinned = on Now (practice),
 *              Follow up = on Now as a question, Keep in mind = a long-term lesson, Goal = a long-term goal.
 *              Rows with "Month review" set (e.g. 2026-10) hold that month's takeaway.
 *   Assignments — tasks Sensei gave you: due date, steps (one per line, "[x] " = done), linked note
 *   My kata  — your own view of each kata: how it feels, how many kiais it has, key reminders
 *   Devices, Sent — notifications: the phones that turned them on, and what was sent (see "Notifications")
 *   Access   — other Google accounts that asked to see your notes. Set Status to Approved to let one in
 *              (view only). Leave it Requested or set Denied to keep them out.
 *
 * The kata list itself is read (never written) from the dojo's Kata Tracker sheet.
 *
 * Privacy: every request must come from someone signed in with Google. The script checks the
 * Google sign-in token itself, so only the owner of this script (you) can read or change notes.
 */

const APP_NAME = 'Karate-Ka Companion';
// Where the app lives. Shown on the web app page and in emails.
const APP_SITE = 'https://karate-ka-companion.pages.dev/';
// The dojo's Kata Tracker sheet: its "Kata" tab supplies the kata names, order and translations.
const KATA_TRACKER_SHEET_ID = '1QYVdiW5kZ5j-EvSQzZJ-GE12ZqwY2OUgTsSIzIloiHk';
const KATA_TAB = 'Kata';

const TYPES = ['Kata', 'Kihon', 'Kumite', 'Sensei says', 'General']; // Goals is a flag (Goal column), not a type
const SOURCES = ['Me', 'Sensei', 'Seminar'];
const STATUSES = ['Learning', 'Polishing', 'Solid'];
const ASKS = ['Sensei', 'Senpai', 'Myself']; // Follow up: who to ask
const ACCESS = ['Requested', 'Approved', 'Denied'];
const SESSION_DAYS = 60;

// [field, header label, type, column width]. `key` is the field a row must have to count.
const SCHEMA = {
  notes: {
    sheet: 'Notes', key: 'type',
    cols: [
      ['id', 'ID', 'id', 80],
      ['date', 'Date', 'date', 110],
      ['type', 'Type', 'type', 100],
      ['kata', 'Kata', 'text', 150],
      ['title', 'Title', 'text', 200],
      ['note', 'Note', 'text', 340],
      ['from', 'Who said it', 'from', 95],
      ['video', 'Video link', 'text', 160],
      ['pinned', 'Pinned', 'bool', 65],
      ['goal', 'Goal', 'bool', 65],
      ['done', 'Done (goals)', 'bool', 90],
      ['followUp', 'Follow up', 'bool', 85],
      ['ask', 'Ask who', 'ask', 90],
      ['answered', 'Answered', 'bool', 85],
      ['keep', 'Keep in mind', 'bool', 95],
      ['review', 'Month review (YYYY-MM)', 'text', 110],
      ['added', 'Added', 'datetime', 150],
      ['updated', 'Updated', 'datetime', 150],
    ],
  },
  assignments: {
    sheet: 'Assignments', key: 'title',
    cols: [
      ['id', 'ID', 'id', 80],
      ['title', 'Assignment', 'text', 240],
      ['kata', 'Kata', 'text', 140],
      ['given', 'Given', 'date', 110],
      ['due', 'Due', 'date', 110],
      ['steps', 'Steps (one per line, [x] = done)', 'text', 260],
      ['note', 'Notes', 'text', 260],
      ['noteId', 'From note (ID)', 'text', 100],
      ['done', 'Done', 'bool', 60],
      ['doneOn', 'Done on', 'datetime', 150],
      ['added', 'Added', 'datetime', 150],
      ['updated', 'Updated', 'datetime', 150],
    ],
  },
  kata: {
    sheet: 'My kata', key: 'kata',
    cols: [
      ['id', 'ID', 'id', 80],
      ['kata', 'Kata', 'text', 170],
      ['status', 'How it feels', 'status', 110],
      ['kiais', 'Kiais', 'num', 60],
      ['reminders', 'Key reminders (one per line)', 'text', 320],
      ['kiaiNotes', 'Kiai notes (one per line, in order)', 'text', 260],
      ['updated', 'Updated', 'datetime', 150],
    ],
  },
  // Notifications: one row per phone that turned them on (owner only), and a log of what was sent
  // (its Tag column stops the same reminder going out twice).
  devices: {
    sheet: 'Devices', key: 'endpoint',
    cols: [
      ['id', 'ID', 'id', 80],
      ['label', 'Phone', 'text', 160],
      ['endpoint', 'Push address', 'text', 300],
      ['p256dh', 'Key', 'text', 120],
      ['auth', 'Auth', 'text', 90],
      ['added', 'Added', 'datetime', 150],
    ],
  },
  sent: {
    sheet: 'Sent', key: 'tag',
    cols: [
      ['id', 'ID', 'id', 80],
      ['sent', 'Sent', 'text', 140],
      ['title', 'Notification', 'text', 260],
      ['body', 'Text', 'text', 320],
      ['tag', 'Tag', 'text', 200],
    ],
  },
  access: {
    sheet: 'Access', key: 'email',
    cols: [
      ['id', 'ID', 'id', 80],
      ['email', 'Google account', 'text', 240],
      ['status', 'Status', 'access', 100],
      ['requested', 'Asked on', 'datetime', 150],
      ['updated', 'Updated', 'datetime', 150],
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Web app entry points                                                */
/* ------------------------------------------------------------------ */

function doGet() {
  return HtmlService.createHtmlOutput(
    '<div style="font:16px/1.5 system-ui,sans-serif;padding:24px;max-width:420px">' +
    '<h2 style="margin:0 0 8px">' + APP_NAME + '</h2>' +
    '<p>This link is where the app saves its notes. Open the app here:</p>' +
    '<p><a href="' + APP_SITE + '" target="_top" style="font-weight:700">' + APP_SITE + '</a></p></div>')
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  const res = api(e && e.postData ? e.postData.contents : '{}');
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Request:  { idToken } to sign in, or { session, ops?, requestAccess? }
 *           ops: [{op: 'add'|'update'|'del', coll: 'notes'|'assignments'|'kata'|'access', id, data}]
 * Response: { ok: true, role, email, state, session?, sheetUrl? } or { ok: false, error, message, email? }
 */
function api(body) {
  let req;
  try {
    req = typeof body === 'string' ? JSON.parse(body || '{}') : (body || {});
  } catch (err) {
    return { ok: false, error: 'bad_request', message: 'The request could not be read.' };
  }
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('CLIENT_ID')) {
    return { ok: false, error: 'not_setup', message: 'Google sign-in isn\'t set up yet. In the sheet: ' + APP_NAME + ' menu → Set Google sign-in client ID…' };
  }

  let email, session;
  if (req.idToken) {
    const v = verifyIdToken_(req.idToken);
    if (!v.ok) return v;
    email = v.email;
    session = newSession_(email);
  } else {
    email = sessionEmail_(req.session);
    if (!email) return { ok: false, error: 'signed_out', message: 'Please sign in again.' };
  }

  const role = roleOf_(email);
  if (!role) {
    let requested = accessStatus_(email) === 'Requested';
    if (req.requestAccess && !requested) { requestAccess_(email); requested = true; }
    return { ok: false, error: 'no_access', email: email, requested: requested, session: session,
      message: 'These notes are private.' };
  }

  const ops = req.ops || [];
  if ((ops.length || req.notify || req.test) && role !== 'owner') {
    return { ok: false, error: 'read_only', message: 'You can look, but only the owner can change notes.' };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy', message: 'The sheet is busy. Try again in a moment.' };
  try {
    ops.forEach(applyOp_);
    if (req.notify && typeof req.notify === 'object') props.setProperty('NOTIFY', JSON.stringify(cleanNotify_(req.notify)));
    const test = role === 'owner' && req.test ? sendTest_() : null;
    SpreadsheetApp.flush();
    const out = { ok: true, role: role, email: email, state: readAll_(role) };
    if (session) out.session = session;
    if (role === 'owner') {
      out.sheetUrl = ss_().getUrl();
      out.push = { vapid: props.getProperty('VAPID_PUBLIC') || '', on: props.getProperty('PUSH_ON') === '1' };
      out.notify = notifySettings_();
      if (test) out.test = test;
    }
    return out;
  } catch (err) {
    return { ok: false, error: 'server', message: String((err && err.message) || err) };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Who is asking                                                       */
/* ------------------------------------------------------------------ */

function ownerEmail_() {
  const props = PropertiesService.getScriptProperties();
  let e = props.getProperty('OWNER_EMAIL');
  if (!e) {
    e = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
    if (e) props.setProperty('OWNER_EMAIL', e);
  }
  return e;
}

/** Google's own check of the sign-in token: right app, verified email, not expired. */
function verifyIdToken_(tok) {
  const cid = PropertiesService.getScriptProperties().getProperty('CLIENT_ID');
  let info;
  try {
    const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tok), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return { ok: false, error: 'signed_out', message: 'Google sign-in didn\'t go through. Please try again.' };
    info = JSON.parse(r.getContentText());
  } catch (err) {
    return { ok: false, error: 'server', message: 'Couldn\'t check the sign-in with Google. Try again in a moment.' };
  }
  const verified = info.email_verified === true || info.email_verified === 'true';
  if (info.aud !== cid || !verified || !info.email || Number(info.exp) * 1000 < Date.now()) {
    return { ok: false, error: 'signed_out', message: 'That sign-in isn\'t valid for this app. Please try again.' };
  }
  return { ok: true, email: String(info.email).toLowerCase() };
}

/** Sessions let a phone stay signed in without asking Google every hour. */
function newSession_(email) {
  const props = PropertiesService.getScriptProperties();
  const tok = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const now = Date.now();
  // tidy expired sessions
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('sess_') !== 0) return;
    try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
  props.setProperty('sess_' + hash_(tok), JSON.stringify({ email: email, exp: now + SESSION_DAYS * 864e5 }));
  return tok;
}

function sessionEmail_(tok) {
  if (!tok || typeof tok !== 'string' || tok.length < 32) return '';
  const raw = PropertiesService.getScriptProperties().getProperty('sess_' + hash_(tok));
  if (!raw) return '';
  try {
    const s = JSON.parse(raw);
    return s.exp > Date.now() ? s.email : '';
  } catch (e) { return ''; }
}

function hash_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)).replace(/=+$/, '');
}

/** 'owner' (full access), 'viewer' (approved, view only) or '' (no access). */
function roleOf_(email) {
  if (!email) return '';
  if (email === ownerEmail_()) return 'owner';
  return accessStatus_(email) === 'Approved' ? 'viewer' : '';
}

function accessStatus_(email) {
  const sh = ss_().getSheetByName(SCHEMA.access.sheet);
  if (!sh || sh.getLastRow() < 2) return '';
  const vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const cols = headerMap_(vals[0], SCHEMA.access);
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][cols.email]).trim().toLowerCase() === email) return String(vals[r][cols.status]).trim();
  }
  return '';
}

function requestAccess_(email) {
  const ss = ss_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    if (accessStatus_(email)) {
      // Asked before (or denied): mark as asking again, but only email the owner once a day
      const sh = ss.getSheetByName(SCHEMA.access.sheet);
      const t = table_(sh, SCHEMA.access);
      const vals = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), t.width).getValues();
      for (let i = 0; i < vals.length; i++) {
        if (String(vals[i][t.cols.email]).trim().toLowerCase() !== email) continue;
        const last = vals[i][t.cols.requested];
        if (last instanceof Date && Date.now() - last.getTime() < 864e5) return;
        sh.getRange(i + 2, t.cols.status + 1).setValue('Requested');
        sh.getRange(i + 2, t.cols.requested + 1).setValue(new Date());
        break;
      }
    } else {
      applyOp_({ op: 'add', coll: 'access', id: newId_(), data: { email: email, status: 'Requested', requested: Date.now() } });
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  try {
    MailApp.sendEmail({
      to: ownerEmail_(),
      subject: APP_NAME + ': ' + email + ' is asking to see your notes',
      body: email + ' signed in to ' + APP_NAME + ' and asked to see your karate notes.\n\n' +
        'Nothing is shown to them unless you say yes. To let them look (view only), open the app → ' +
        'your account button → Access, or set their Status to Approved on the Access tab of your sheet:\n' +
        ss.getUrl() + '\n\nTo say no, set it to Denied or just leave it.',
    });
  } catch (e) { /* the request is still on the Access tab */ }
}

/* ------------------------------------------------------------------ */
/* Reading and writing                                                 */
/* ------------------------------------------------------------------ */

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}

function label_(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/\(.*?\)/g, '').trim();
}

/** Map field → 0-based column index, matched by header text so columns can be moved. */
function headerMap_(head, sch) {
  const byLabel = {};
  sch.cols.forEach(function (c) { byLabel[label_(c[1])] = c[0]; });
  const cols = {};
  head.forEach(function (h, i) {
    const k = byLabel[label_(h)];
    if (k && cols[k] == null) cols[k] = i;
  });
  return cols;
}

function table_(sh, sch) {
  const width = Math.max(sh.getLastColumn(), 1);
  const lastRow = sh.getLastRow();
  const cols = headerMap_(sh.getRange(1, 1, 1, width).getValues()[0], sch);
  const rowOf = {};
  let last = 1;
  if (lastRow >= 2) {
    const vals = sh.getRange(2, 1, lastRow - 1, width).getValues();
    vals.forEach(function (r, i) {
      const id = cols.id != null ? String(r[cols.id]).trim() : '';
      const k = cols[sch.key] != null ? String(r[cols[sch.key]]).trim() : '';
      if (id || k) last = i + 2;
      if (id && !rowOf[id]) rowOf[id] = i + 2;
    });
  }
  return { cols: cols, rowOf: rowOf, lastRow: last, width: width };
}

function fromCell_(v, type) {
  switch (type) {
    case 'num': {
      if (v === '' || v == null) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    }
    case 'bool':
      return v === true || /^(true|yes|y|1|x|✓)$/i.test(String(v == null ? '' : v).trim());
    case 'date':
    case 'datetime':
      if (v instanceof Date) return v.getTime();
      if (v === '' || v == null) return null;
      return new Date(v).getTime() || null;
    default:
      return String(v == null ? '' : v).trim();
  }
}

function toCell_(v, type) {
  switch (type) {
    case 'num': return v == null || v === '' ? '' : Number(v);
    case 'bool': return !!v;
    case 'date':
    case 'datetime': return v ? new Date(v) : '';
    default: {
      const s = v == null ? '' : String(v);
      // Keep things that look like formulas as plain text
      return /^[=+\-@]/.test(s) ? "'" + s : s;
    }
  }
}

function newId_() {
  return 'r' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function readAll_(role) {
  const ss = ss_();
  const out = {};
  Object.keys(SCHEMA).forEach(function (coll) {
    if ((coll === 'access' || coll === 'devices') && role !== 'owner' && role !== 'internal') return;
    if (coll === 'sent' && role !== 'internal') return;
    const sch = SCHEMA[coll];
    out[coll] = [];
    const sh = ss.getSheetByName(sch.sheet);
    if (!sh || sh.getLastRow() < 2) return;
    const width = sh.getLastColumn();
    const vals = sh.getRange(1, 1, sh.getLastRow(), width).getValues();
    const cols = headerMap_(vals[0], sch);
    const seen = {};
    const fixes = [];
    for (let r = 1; r < vals.length; r++) {
      const obj = {};
      sch.cols.forEach(function (c) {
        const i = cols[c[0]];
        if (i != null) obj[c[0]] = fromCell_(vals[r][i], c[2]);
      });
      if (!obj[sch.key]) continue;
      // Rows typed straight into the sheet (or copied) get their own ID
      if (!obj.id || seen[obj.id]) {
        obj.id = newId_();
        if (cols.id != null && role === 'owner') fixes.push([r + 1, cols.id + 1, obj.id]);
      }
      seen[obj.id] = true;
      out[coll].push(obj);
    }
    fixes.forEach(function (f) { sh.getRange(f[0], f[1]).setValue(f[2]); });
  });
  out.kataList = kataList_();
  return out;
}

/** The dojo's kata list, read-only, cached for 6 hours. */
function kataList_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('kataList2');
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* fall through */ } }
  let list = [];
  try {
    const sh = SpreadsheetApp.openById(KATA_TRACKER_SHEET_ID).getSheetByName(KATA_TAB);
    const vals = sh.getDataRange().getValues();
    const head = vals[0].map(function (h) { return String(h).trim().toLowerCase(); });
    const iName = head.indexOf('kata');
    const iOrder = head.indexOf('order');
    const iEn = head.findIndex(function (h) { return /translation|english/.test(h); });
    const iCat = head.indexOf('category');
    const iBelt = head.indexOf('belt');
    for (let r = 1; r < vals.length; r++) {
      const name = String(vals[r][iName] || '').trim();
      if (!name) continue;
      list.push({
        name: name,
        order: iOrder >= 0 ? Number(vals[r][iOrder]) || r : r,
        en: iEn >= 0 ? String(vals[r][iEn] || '').trim() : '',
        cat: iCat >= 0 ? String(vals[r][iCat] || '').trim() : '',
        belt: iBelt >= 0 ? String(vals[r][iBelt] || '').trim() : '',
      });
    }
    list.sort(function (a, b) { return a.order - b.order; });
    cache.put('kataList2', JSON.stringify(list), 21600);
  } catch (e) {
    list = [];
  }
  return list;
}

function applyOp_(op) {
  const sch = SCHEMA[op.coll];
  if (!sch) throw new Error('Unknown list "' + op.coll + '".');
  const ss = ss_();
  const sh = ss.getSheetByName(sch.sheet) || buildTab_(ss, sch);
  let t = table_(sh, sch);
  // A new column (e.g. Follow up) that isn't in the sheet yet: add it now instead of dropping the value
  if (op.data && sch.cols.some(function (c) { return c[0] in op.data && t.cols[c[0]] == null; })) {
    buildTab_(ss, sch);
    t = table_(sh, sch);
  }
  let row = op.id ? t.rowOf[op.id] : null;
  if (!row && op.coll === 'devices' && op.op === 'add' && op.data && op.data.endpoint && t.cols.endpoint != null && sh.getLastRow() >= 2) {
    const eps = sh.getRange(2, t.cols.endpoint + 1, sh.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < eps.length; i++) if (String(eps[i][0]) === op.data.endpoint) { row = i + 2; break; }
    if (row) op = Object.assign({}, op, { op: 'update' });
  }

  if (op.op === 'del') {
    if (row) sh.deleteRow(row);
    return;
  }

  const data = Object.assign({}, op.data || {});
  if (t.cols.updated != null) data.updated = Date.now();

  if (op.op === 'add' && !row) {
    data.id = op.id || newId_();
    if (t.cols.added != null && !data.added) data.added = Date.now();
    const vals = [];
    for (let i = 0; i < t.width; i++) vals.push('');
    sch.cols.forEach(function (c) {
      const i = t.cols[c[0]];
      if (i != null && c[0] in data) vals[i] = toCell_(data[c[0]], c[2]);
    });
    sh.getRange(t.lastRow + 1, 1, 1, t.width).setValues([vals]);
    return;
  }

  if (!row) return; // the row was removed in the sheet; nothing to update
  sch.cols.forEach(function (c) {
    if (c[0] === 'id' || c[0] === 'added' || !(c[0] in data)) return;
    const i = t.cols[c[0]];
    if (i != null) sh.getRange(row, i + 1).setValue(toCell_(data[c[0]], c[2]));
  });
}

/* ------------------------------------------------------------------ */
/* Setup and menu                                                      */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(APP_NAME)
    .addItem('Open the app', 'openApp')
    .addItem('Set Google sign-in client ID…', 'setClientId')
    .addItem('Set up / repair sheets', 'setup')
    .addSeparator()
    .addItem('Turn on notifications', 'turnOnNotifications')
    .addItem('Turn off notifications', 'turnOffNotifications')
    .addSeparator()
    .addItem('Sign out every phone', 'signOutAll')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', ss.getId());
  ownerEmail_();

  Object.keys(SCHEMA).forEach(function (coll) { buildTab_(ss, SCHEMA[coll]); });
  const moved = migrateGoals_(ss);

  ['Sheet1', 'Sheet 1'].forEach(function (n) {
    const blank = ss.getSheetByName(n);
    if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  });
  ss.setActiveSheet(ss.getSheetByName(SCHEMA.notes.sheet));
  CacheService.getScriptCache().remove('kataList');
  const n = kataList_().length;

  const msg = APP_NAME + ' is set up.\n\nKata read from the Kata Tracker: ' + n + '.' +
    (moved ? '\n\nOld "Goals" notes changed to General notes ticked as a Goal: ' + moved + '.' : '') +
    (props.getProperty('CLIENT_ID') ? '' : '\n\nNext: ' + APP_NAME + ' → Set Google sign-in client ID…');
  console.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* run from the editor: see the log */ }
}

function setClientId() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Google sign-in client ID',
    'Paste the OAuth client ID (it ends in .apps.googleusercontent.com).', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const id = String(r.getResponseText() || '').trim();
  if (!/\.apps\.googleusercontent\.com$/.test(id)) { ui.alert('That doesn\'t look like a client ID.'); return; }
  PropertiesService.getScriptProperties().setProperty('CLIENT_ID', id);
  ui.alert('Saved. The app can now sign you in with Google.');
}

/** For setting things up from the editor or another script. */
function setClientIdTo_(id) { PropertiesService.getScriptProperties().setProperty('CLIENT_ID', id); }

function openApp() {
  const html = HtmlService.createHtmlOutput('<p style="font:14px Arial"><a href="' + APP_SITE + '" target="_blank">Open ' + APP_NAME + ' ↗</a></p>')
    .setWidth(300).setHeight(80);
  SpreadsheetApp.getUi().showModalDialog(html, APP_NAME);
}

function signOutAll() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(function (k) { if (k.indexOf('sess_') === 0) props.deleteProperty(k); });
  try { SpreadsheetApp.getUi().alert('Every phone is signed out. Sign in again with Google to keep going.'); } catch (e) {}
}

function colLetter_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Goals used to be a note type. Turn those rows into General notes with the Goal box ticked.
function migrateGoals_(ss) {
  const sh = ss.getSheetByName(SCHEMA.notes.sheet);
  if (!sh || sh.getLastRow() < 2) return 0;
  const width = sh.getLastColumn();
  const cols = headerMap_(sh.getRange(1, 1, 1, width).getValues()[0], SCHEMA.notes);
  if (cols.type == null || cols.goal == null) return 0;
  const n = sh.getLastRow() - 1;
  const types = sh.getRange(2, cols.type + 1, n, 1).getValues();
  const goals = sh.getRange(2, cols.goal + 1, n, 1).getValues();
  let moved = 0;
  types.forEach(function (r, i) {
    if (String(r[0]).trim().toLowerCase() === 'goals') { r[0] = 'General'; goals[i][0] = true; moved++; }
  });
  if (moved) {
    sh.getRange(2, cols.type + 1, n, 1).setValues(types);
    sh.getRange(2, cols.goal + 1, n, 1).setValues(goals);
  }
  return moved;
}

function buildTab_(ss, sch) {
  const sh = ss.getSheetByName(sch.sheet) || ss.insertSheet(sch.sheet);
  const existing = sh.getLastColumn() > 0 ? headerMap_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], sch) : {};
  if (Object.keys(existing).length === 0) {
    sh.getRange(1, 1, 1, sch.cols.length).setValues([sch.cols.map(function (c) { return c[1]; })]);
  } else {
    sch.cols.forEach(function (c) {
      if (existing[c[0]] == null) sh.getRange(1, sh.getLastColumn() + 1).setValue(c[1]);
    });
  }
  if (sh.getMaxRows() < 500) sh.insertRowsAfter(sh.getMaxRows(), 500 - sh.getMaxRows());

  const width = sh.getLastColumn();
  const cols = headerMap_(sh.getRange(1, 1, 1, width).getValues()[0], sch);
  const body = sh.getMaxRows() - 1;

  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#262E63').setFontColor('#FFFFFF');
  sh.getRange(2, 1, body, width).setVerticalAlignment('top');

  const pick = function (vals) { return SpreadsheetApp.newDataValidation().requireValueInList(vals, true).setAllowInvalid(true).build(); };
  sch.cols.forEach(function (c) {
    const field = c[0], type = c[2], w = c[3];
    const col = cols[field] + 1;
    const rng = sh.getRange(2, col, body, 1);
    if (type === 'type') rng.setDataValidation(pick(TYPES));
    if (type === 'from') rng.setDataValidation(pick(SOURCES));
    if (type === 'status') rng.setDataValidation(pick(STATUSES));
    if (type === 'access') rng.setDataValidation(pick(ACCESS));
    if (type === 'ask') rng.setDataValidation(pick(ASKS));
    if (type === 'bool') rng.insertCheckboxes();
    if (type === 'date') rng.setNumberFormat('ddd mmm d, yyyy');
    if (type === 'datetime') rng.setNumberFormat('mmm d, yyyy h:mm am/pm');
    if (field === 'note' || field === 'reminders' || field === 'kiaiNotes' || field === 'steps') rng.setWrap(true);
    if (w) sh.setColumnWidth(col, w);
    if (field === 'id') sh.hideColumns(col);
  });

  const L = function (f) { return colLetter_(cols[f] + 1); };
  const rules = [];
  if (sch === SCHEMA.access) {
    const r = sh.getRange(2, cols.status + 1, body, 1);
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Approved').setBackground('#D7F2E4').setFontColor('#1F6B48').setRanges([r]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Requested').setBackground('#FFF0D9').setFontColor('#7A4A00').setRanges([r]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Denied').setFontColor('#8A8FA6').setRanges([r]).build());
  }
  if (sch === SCHEMA.notes) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L('done') + '2=TRUE')
      .setFontColor('#8A8FA6').setRanges([sh.getRange(2, 1, body, width)]).build());
  }
  if (sch === SCHEMA.assignments) {
    const all = sh.getRange(2, 1, body, width);
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L('done') + '2=TRUE')
      .setFontColor('#8A8FA6').setRanges([all]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($' + L('done') + '2<>TRUE,ISNUMBER($' + L('due') + '2),$' + L('due') + '2<TODAY())')
      .setBackground('#FDE4EA').setFontColor('#9A2645').setRanges([sh.getRange(2, cols.due + 1, body, 1)]).build());
  }
  sh.setConditionalFormatRules(rules);
  return sh;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */
//
// Same setup as Home and Hobby: every 5 minutes pushTick() works out what's due, logs it to the
// Sent tab (its Tag stops repeats) and hands it to the app's own push sender on Cloudflare
// (APP_SITE + 'push/send', functions/push in the repo), which signs, encrypts and delivers it.
// Menu "Turn on notifications" makes the keys and starts the 5-minute check.
//
// Settings live in the Script property NOTIFY (the app's Notifications panel saves them):
//   days    class days, 0 = Sunday            start / end   class time, 'HH:mm'
//   before  {on, m}   minutes before class: your Now list and questions to ask
//   after   {on, m}   minutes after class: "Write today's notes" (skipped if you already wrote one that day)
//   due     {on, d, t} assignments: d days before the due date, at t
//   stale   {on, dow, t} weekly: Now items untouched for 5 weeks
//   month   {on, t}   on the 1st: last month's review is ready
//   quiet   {on, from, to} nothing goes out in between; it waits until quiet hours end

const PUSH_LOOKBACK_MIN = 6 * 60;  // catch up on anything missed in the last 6 hours
const SENT_KEEP = 300;             // rows kept in the Sent tab
const STALE_DAYS = 35;
const DEFAULT_NOTIFY = {
  days: [], start: '19:00', end: '20:30',
  before: { on: true, m: 60 }, after: { on: true, m: 60 }, due: { on: true, d: 1, t: '08:00' },
  stale: { on: false, dow: 0, t: '19:00' }, month: { on: true, t: '09:00' }, quiet: { on: true, from: '22:00', to: '07:00' },
};

function notifySettings_() {
  let saved = {};
  try { saved = JSON.parse(PropertiesService.getScriptProperties().getProperty('NOTIFY') || '{}') || {}; } catch (e) { saved = {}; }
  return cleanNotify_(saved);
}
/** Keeps only known settings, with sane values. */
function cleanNotify_(n) {
  const D = DEFAULT_NOTIFY, t = function (v, d) { return mins_(v) == null ? d : String(v); };
  const num = function (v, d, lo, hi) { v = Number(v); return isNaN(v) ? d : Math.max(lo, Math.min(hi, Math.round(v))); };
  const part = function (k, f) { const x = (n && n[k]) || {}; return Object.assign({ on: x.on == null ? D[k].on : !!x.on }, f(x)); };
  return {
    days: ((n && n.days) || []).map(Number).filter(function (d) { return d >= 0 && d <= 6; }),
    start: t(n && n.start, D.start), end: t(n && n.end, D.end),
    before: part('before', function (x) { return { m: num(x.m, D.before.m, 0, 1440) }; }),
    after: part('after', function (x) { return { m: num(x.m, D.after.m, 0, 1440) }; }),
    due: part('due', function (x) { return { d: num(x.d, D.due.d, 0, 14), t: t(x.t, D.due.t) }; }),
    stale: part('stale', function (x) { return { dow: num(x.dow, D.stale.dow, 0, 6), t: t(x.t, D.stale.t) }; }),
    month: part('month', function (x) { return { t: t(x.t, D.month.t) }; }),
    quiet: part('quiet', function (x) { return { from: t(x.from, D.quiet.from), to: t(x.to, D.quiet.to) }; }),
  };
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function keyAdd_(k, n) {
  const p = String(k).split('-');
  const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate());
}
function keyDow_(k) { const p = String(k).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); }
/** "18:30", "6:30 PM", "6 pm" → minutes after midnight, or null. */
function mins_(t) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?$/i.exec(String(t || '').trim());
  if (!m) return null;
  let h = +m[1]; const mi = +(m[2] || 0);
  if (m[3]) { const pm = /p/i.test(m[3]); if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}
function stamp_(k, m) {
  while (m < 0) { k = keyAdd_(k, -1); m += 1440; }
  while (m >= 1440) { k = keyAdd_(k, 1); m -= 1440; }
  return k + ' ' + pad2_(Math.floor(m / 60)) + ':' + pad2_(m % 60);
}
function unquiet_(q, st) {
  if (!q || !q.on) return st;
  const from = mins_(q.from), to = mins_(q.to);
  if (from == null || to == null || from === to) return st;
  const k = st.slice(0, 10), m = mins_(st.slice(11));
  if (from < to) return m >= from && m < to ? stamp_(k, to) : st;
  if (m >= from) return stamp_(keyAdd_(k, 1), to);
  if (m < to) return stamp_(k, to);
  return st;
}
function inWords_(m) {
  if (m === 0) return 'starting now';
  if (m % 60 === 0) return 'in ' + (m / 60) + (m === 60 ? ' hour' : ' hours');
  if (m > 60) return 'in ' + Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  return 'in ' + m + ' min';
}
const ASK_WORDS_ = { Sensei: 'Ask Sensei', Senpai: 'Ask Senpai', Myself: 'Check' };
const MONTHS_ = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Everything that should go out between fromStamp (exclusive) and nowStamp (inclusive),
 * as 'yyyy-MM-dd HH:mm' in the sheet's time zone. keyOf(ms) turns a date into 'yyyy-MM-dd' there.
 * Pure (no Apps Script services) so it can be tested on its own.
 */
function dueList_(all, cfg, nowStamp, fromStamp, sent, keyOf, nowMs) {
  const out = [];
  const today = nowStamp.slice(0, 10), yday = keyAdd_(today, -1);
  function add(base, msg) {
    const eff = unquiet_(cfg.quiet, base);
    if (eff > fromStamp && eff <= nowStamp && !sent[msg.tag]) {
      sent[msg.tag] = true;
      out.push({ title: msg.title, body: msg.body || '', link: msg.link || '', tag: msg.tag });
    }
  }
  const notes = (all.notes || []).filter(function (n) { return !n.review; });
  const ask = function (n) { return n.followUp && !n.answered; };
  const titleOf = function (n) { return n.title || String(n.note || '').split('\n')[0].slice(0, 60) || 'Untitled note'; };
  const start = mins_(cfg.start), end = mins_(cfg.end);

  [yday, today].forEach(function (k) {
    const classDay = (cfg.days || []).indexOf(keyDow_(k)) >= 0;
    // 1. Before class: what's on Now
    if (classDay && cfg.before.on && start != null) {
      const bits = [];
      (all.assignments || []).filter(function (a) { return !a.done && a.due && keyOf(a.due) >= k && keyOf(a.due) <= keyAdd_(k, 14); })
        .sort(function (a, b) { return a.due - b.due; })
        .forEach(function (a) { bits.push((keyOf(a.due) === k ? 'Due today: ' : 'From Sensei: ') + a.title); });
      notes.filter(function (n) { return n.pinned; }).forEach(function (n) { bits.push('Practice: ' + titleOf(n)); });
      notes.filter(ask).forEach(function (n) { bits.push((ASK_WORDS_[n.ask] || 'Ask Sensei') + ': ' + titleOf(n)); });
      add(stamp_(k, start - cfg.before.m), { tag: 'before:' + k, title: 'Karate ' + inWords_(cfg.before.m),
        body: bits.length ? bits.slice(0, 5).join(' · ') + (bits.length > 5 ? ' · +' + (bits.length - 5) + ' more' : '') : 'Nothing on Now yet. Have a good class!', link: 'now' });
    }
    // 2. After class: write today's notes, unless there's already a note for that day
    if (classDay && cfg.after.on && end != null && !notes.some(function (n) { return n.date && keyOf(n.date) === k; })) {
      add(stamp_(k, end + cfg.after.m), { tag: 'after:' + k, title: 'Write today\'s notes', body: 'What did you work on in class?', link: 'new' });
    }
    // 4. Weekly: Now items nobody has touched for 5 weeks
    if (cfg.stale.on && keyDow_(k) === cfg.stale.dow && mins_(cfg.stale.t) != null) {
      const old = notes.filter(function (n) { return n.pinned && nowMs - Math.max(n.updated || 0, n.date || 0, n.added || 0) > STALE_DAYS * 864e5; });
      if (old.length) add(stamp_(k, mins_(cfg.stale.t)), { tag: 'stale:' + k, title: 'Still working on ' + (old.length === 1 ? 'this?' : 'these?'),
        body: old.slice(0, 4).map(titleOf).join(' · ') + (old.length > 4 ? ' · +' + (old.length - 4) + ' more' : ''), link: 'now' });
    }
    // 5. On the 1st: last month's review
    if (cfg.month.on && k.slice(8) === '01' && mins_(cfg.month.t) != null) {
      const prev = keyAdd_(k, -1).slice(0, 7);
      add(stamp_(k, mins_(cfg.month.t)), { tag: 'month:' + prev, title: 'Your ' + MONTHS_[+prev.slice(5) - 1] + ' review is ready',
        body: 'Wins, Sensei\'s points and your takeaway', link: 'review:' + prev });
    }
  });
  // 3. Assignments: d days before the due date
  if (cfg.due.on && mins_(cfg.due.t) != null) {
    (all.assignments || []).forEach(function (a) {
      if (a.done || !a.due) return;
      const dk = keyOf(a.due), d = cfg.due.d;
      const steps = String(a.steps || '').split('\n').filter(function (l) { return l.trim(); });
      const done = steps.filter(function (l) { return /^\s*\[[xX]\]/.test(l); }).length;
      add(stamp_(keyAdd_(dk, -d), mins_(cfg.due.t)), { tag: 'due:' + a.id + ':' + dk + ':' + d,
        title: 'Assignment due ' + (d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' days'),
        body: a.title + (steps.length ? ' · ' + done + ' of ' + steps.length + ' steps done' : ''), link: 'a:' + a.id });
    });
  }
  return out;
}

/** Runs every 5 minutes once notifications are turned on. */
function pushTick() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return;
  try {
    const all = readAll_('internal');
    const tz = Session.getScriptTimeZone();
    const now = new Date();
    const nowStamp = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm');
    const fromStamp = Utilities.formatDate(new Date(now.getTime() - PUSH_LOOKBACK_MIN * 60000), tz, 'yyyy-MM-dd HH:mm');
    const sent = {};
    all.sent.forEach(function (r) { if (r.tag) sent[r.tag] = true; });
    const keyOf = function (ms) { return Utilities.formatDate(new Date(ms), tz, 'yyyy-MM-dd'); };
    const items = dueList_(all, notifySettings_(), nowStamp, fromStamp, sent, keyOf, now.getTime());
    if (items.length) deliver_(items, all.devices, nowStamp);
    pruneSent_();
  } finally {
    lock.releaseLock();
  }
}

/** Logs each item to the Sent tab, then sends it to every phone that turned notifications on. */
function deliver_(items, devices, nowStamp) {
  items.forEach(function (it) {
    applyOp_({ op: 'add', coll: 'sent', id: newId_(), data: { sent: nowStamp, title: it.title, body: it.body, tag: it.tag } });
  });
  const props = PropertiesService.getScriptProperties();
  const pub = props.getProperty('VAPID_PUBLIC'), priv = props.getProperty('VAPID_PRIVATE');
  const phones = (devices || []).filter(function (d) { return d.endpoint; });
  if (!pub || !priv || !phones.length) return { sent: 0, phones: phones.length };
  const messages = [];
  items.forEach(function (it) {
    phones.forEach(function (d) {
      messages.push({ endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth, payload: { title: it.title, body: it.body, tag: it.tag, link: it.link } });
    });
  });
  let res;
  try {
    const r = UrlFetchApp.fetch(APP_SITE + 'push/send', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ vapid: { publicKey: pub, privateJwk: JSON.parse(priv) }, subject: APP_SITE, messages: messages }),
    });
    res = JSON.parse(r.getContentText());
  } catch (err) {
    console.log('Push send failed: ' + err);
    return { sent: 0, phones: phones.length, error: String(err) };
  }
  let ok = 0;
  ((res && res.results) || []).forEach(function (x) {
    if (x.status >= 200 && x.status < 300) ok++;
    if (x.status === 404 || x.status === 410) {
      // That phone turned notifications off or the app was removed
      phones.filter(function (d) { return d.endpoint === x.endpoint; }).forEach(function (d) { applyOp_({ op: 'del', coll: 'devices', id: d.id }); });
    }
  });
  return { sent: ok, phones: phones.length };
}

function sendTest_() {
  const all = readAll_('owner');
  const tz = Session.getScriptTimeZone();
  const nowStamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
  return deliver_([{ title: 'Notifications are working', body: 'This is a test from ' + APP_NAME, tag: 'test:' + Date.now(), link: 'now' }], all.devices, nowStamp);
}

function pruneSent_() {
  const sh = ss_().getSheetByName(SCHEMA.sent.sheet);
  if (!sh) return;
  const extra = sh.getLastRow() - 1 - SENT_KEEP;
  if (extra > 20) sh.deleteRows(2, extra);
}

/** Menu: makes the push keys, adds the Devices and Sent tabs, and starts the 5-minute check. */
function turnOnNotifications() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('VAPID_PUBLIC') || !props.getProperty('VAPID_PRIVATE')) {
    const r = UrlFetchApp.fetch(APP_SITE + 'push/keys', { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('Could not reach ' + APP_SITE + 'push/keys (' + r.getResponseCode() + ')');
    const k = JSON.parse(r.getContentText());
    props.setProperty('VAPID_PUBLIC', k.publicKey);
    props.setProperty('VAPID_PRIVATE', JSON.stringify(k.privateJwk));
  }
  const ss = ss_();
  ['devices', 'sent'].forEach(function (c) { buildTab_(ss, SCHEMA[c]); });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pushTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('pushTick').timeBased().everyMinutes(5).create();
  props.setProperty('PUSH_ON', '1');
  const msg = 'Notifications are on. On your phone: open ' + APP_NAME + ', tap the bell on Now and turn them on for that phone.';
  console.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* run from the editor */ }
}

function turnOffNotifications() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pushTick') ScriptApp.deleteTrigger(t); });
  PropertiesService.getScriptProperties().deleteProperty('PUSH_ON');
  try { SpreadsheetApp.getUi().alert('Notifications are off. Nothing will be sent until you turn them on again.'); } catch (e) { /* editor */ }
}
