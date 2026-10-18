// A small in-memory stand-in for Apps Script so Code.gs can run in Node for testing.
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

function chain() { const p = new Proxy(function () {}, { get: (t, k) => (k === 'build' ? () => ({}) : () => p), apply: () => p }); return p; }

class Sheet {
  constructor(name) { this.name = name; this.grid = []; this.maxRows = 1000; }
  getName() { return this.name; }
  getLastRow() { for (let r = this.grid.length - 1; r >= 0; r--) if ((this.grid[r] || []).some(v => v !== '' && v != null)) return r + 1; return 0; }
  getLastColumn() { let m = 0; this.grid.forEach(r => { for (let c = (r || []).length - 1; c >= 0; c--) if (r[c] !== '' && r[c] != null) { m = Math.max(m, c + 1); break; } }); return m; }
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(a, n) { this.maxRows += n; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); }
  getDataRange() { return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  deleteRow(r) { this.grid.splice(r - 1, 1); }
  setFrozenRows() {} setColumnWidth() {} hideColumns() {} setConditionalFormatRules() {}
}
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.grid[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v == null ? '' : v); } out.push(row); } return out; }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.set(this.r + i, this.c + j, x))); return this; }
  setValue(x) { this.set(this.r, this.c, x); return this; }
  set(r, c, x) { const g = this.sh.grid; while (g.length < r) g.push([]); const row = g[r - 1]; while (row.length < c) row.push(''); if (typeof x === 'string' && x[0] === "'") x = x.slice(1); row[c - 1] = x; }
  insertCheckboxes() { return this; }
}
['setFontWeight', 'setBackground', 'setFontColor', 'setVerticalAlignment', 'setDataValidation', 'setNumberFormat', 'setWrap'].forEach(m => { Range.prototype[m] = function () { return this; }; });

class SS {
  constructor(id) { this.id = id; this.sheets = [new Sheet('Sheet1')]; }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
  getSheets() { return this.sheets; }
  setActiveSheet() {}
}

function load(opts) {
  const main = new SS('MAIN');
  const tracker = new SS('1QYVdiW5kZ5j-EvSQzZJ-GE12ZqwY2OUgTsSIzIloiHk');
  const kt = tracker.insertSheet('Kata');
  kt.grid = [['Order', 'Kata', 'English Translation ', 'Category'],
    [1, 'Tai Kyoku Shodan', 'Great overview the first', 'Solo'], [9, 'Heian Shodan', 'Peace/Tranquility the first', 'Solo'],
    [12, 'Heian Yondan', 'Peace/Tranquility the fourth', 'Solo'], [28, 'Bassai Dai', 'Great fortress scene', 'Solo']];
  const props = {}; const cache = {}; const mail = [];
  const tokens = opts.tokens; // token -> email
  const ctx = {
    console, JSON, Date, Math, Object, String, Number, Array, Error, encodeURIComponent,
    SpreadsheetApp: {
      getActive: () => main, openById: id => (id === main.id ? main : id === tracker.id ? tracker : (() => { throw new Error('no sheet'); })()),
      flush() {}, getUi() { throw new Error('no ui'); }, newDataValidation: chain, newConditionalFormatRule: chain,
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props) }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeDigest: (alg, s) => [...crypto.createHash('sha256').update(s).digest()],
      base64EncodeWebSafe: b => Buffer.from(b.map(x => x & 255)).toString('base64url'),
      DigestAlgorithm: { SHA_256: 'sha256' },
    },
    UrlFetchApp: {
      fetch(url) {
        const tok = decodeURIComponent(url.split('id_token=')[1]);
        const email = tokens[tok];
        return { getResponseCode: () => (email ? 200 : 400), getContentText: () => JSON.stringify({ aud: 'test-client.apps.googleusercontent.com', email, email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) }) };
      },
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => opts.owner }) },
    MailApp: { sendEmail: m => mail.push(m) },
    HtmlService: {}, ContentService: {},
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/../Code.gs', 'utf8') + '\n;this.__api=api;this.__setup=setup;', ctx);
  ctx.__setup();
  props.CLIENT_ID = 'test-client.apps.googleusercontent.com';
  return { api: b => JSON.parse(JSON.stringify(ctx.__api(b))), main, props, mail };
}
module.exports = { load };
