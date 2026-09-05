import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../mockups/btc-live.js', import.meta.url), 'utf8');
const { deriveBitcoinReadout, formatBitcoinReadout, decodeFirestoreValue, createBitcoinUpdater, POLL_INTERVAL_MS } =
  await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const now = new Date('2026-09-05T22:00:00Z');
const metric = (value, extra = {}) => ({ value, asOf: '2026-09-05T21:00:00Z', stale: false, ...extra });
const sample = () => ({ updatedAt: '2026-09-05T21:30:00Z', price: metric(78669.6), drawdownPct: metric(-37.56),
  mvrv: metric(1.48), lthSupply: metric(80.23), valuationIndicators: [{ name: 'Bitcoin Ahr999 Index', value: .52 }, { name: 'NUPL', value: 32.18 }] });

test('Firestore typed values decode without inventing missing fields', () => {
  assert.deepEqual(decodeFirestoreValue({ mapValue: { fields: { price: { doubleValue: 42 }, absent: { nullValue: null } } } }), { price: 42, absent: null });
  assert.equal(decodeFirestoreValue(undefined), undefined);
});
test('tracker classification and rounded elapsed-day clock match the dashboard', () => {
  const value = deriveBitcoinReadout(sample(), now);
  assert.equal(value.phase, 'early-bull');
  assert.equal(value.cycleDay, 335);
  assert.equal(value.daysLeft, 48);
});
test('dashboard day-rounding boundary is UTC-noon and timezone independent', () => {
  for (const [instant, day] of [['2026-09-05T11:59:59.999Z',334],['2026-09-05T12:00:00Z',335],['2026-09-06T00:00:00Z',335],['2026-09-05T05:00:00-07:00',335],['2026-09-05T20:00:00+08:00',335]]) {
    const data = sample(); data.updatedAt = '2026-09-04T12:00:00Z'; data.price.asOf = '2026-09-04'; data.drawdownPct.asOf = '2026-09-04';
    const value = deriveBitcoinReadout(data,new Date(instant));
    assert.equal(value.cycleDay,day); assert.equal(value.daysLeft,383-day);
  }
});
test('visitor status is always Snapshot data, with real observation dates separate from refresh', () => {
  const data = sample(); data.price = metric(78669.6, { asOf: '2026-08-30', stale: true });
  const value = formatBitcoinReadout(deriveBitcoinReadout(data, now));
  assert.equal(value.status, 'Snapshot data');
  assert.match(value.priceNote, /30 AUG 2026/);
  assert.match(value.priceNote, /Retained observation/);
  assert.match(value.updatedDate, /5 SEPT? 2026/);
  assert.doesNotMatch(JSON.stringify(value), /LIVE|DELAYED|—/);
});
test('different metric observation dates remain distinct', () => {
  const data = sample(); data.drawdownPct.asOf = '2026-09-04';
  const value = formatBitcoinReadout(deriveBitcoinReadout(data, now));
  assert.match(value.priceNote, /5 SEPT? 2026/); assert.match(value.drawdownNote, /4 SEPT? 2026/);
});
test('invalid values do not become formatted prices or percentages', () => {
  for (const value of [NaN, Infinity, '78000', -1, 0, null]) {
    const data = sample(); data.price.value = value;
    assert.equal(formatBitcoinReadout(deriveBitcoinReadout(data, now)).price, 'Unavailable');
  }
});
test('missing, invalid, or future observation dates withhold a value', () => {
  for (const asOf of [undefined, 'bad date', '2027-01-01', '2026-02-30', '2026-02-30T12:00:00Z']) {
    const data = sample(); data.price.asOf = asOf;
    assert.equal(formatBitcoinReadout(deriveBitcoinReadout(data, now)).price, 'Unavailable');
  }
});
test('invalid envelopes and payloads do not overwrite the dated fallback', () => {
  for (const data of [{}, null, { fields: {} }, { ...sample(), updatedAt: 'bad' }]) {
    assert.throws(() => deriveBitcoinReadout(data, now));
  }
});
test('null indicators and unknown phase are safe, with no em dash placeholder', () => {
  const data = sample(); data.valuationIndicators = [null]; data.mvrv = null; data.lthSupply = null;
  assert.equal(formatBitcoinReadout(deriveBitcoinReadout(data, now)).phase, 'Unavailable');
});
test('malformed freshness flags are not treated as assurance of freshness', () => {
  const data = sample(); data.price.stale = 'false';
  assert.match(formatBitcoinReadout(deriveBitcoinReadout(data, now)).priceNote, /Retained observation/);
});

function harness(fetchImpl) {
  const pending = new Map(); let id = 0; let visible = true;
  const updates = []; const errors = [];
  const timers = { setTimeout(fn, ms) { pending.set(++id, { fn, ms }); return id; }, clearTimeout(key) { pending.delete(key); } };
  const updater = createBitcoinUpdater({ fetchImpl, now: () => now, timers, isVisible: () => visible,
    onUpdate: value => updates.push(value), onError: error => errors.push(error) });
  return { updater, pending, updates, errors, setVisible(value) { visible = value; } };
}
const response = () => ({ ok: true, json: async () => sample() });
test('refresh uses the unchanged public endpoint, no-store, and a single five-minute schedule', async () => {
  let calls = 0;
  const h = harness(async (url, options) => { calls++; assert.match(url, /documents\/live\/latest\?key=/); assert.equal(options.cache, 'no-store'); return response(); });
  await h.updater.refresh(); assert.equal(calls, 1); assert.equal(h.updates.length, 1);
  assert.equal([...h.pending.values()].filter(x => x.ms === POLL_INTERVAL_MS).length, 1);
  h.updater.stop(); assert.equal(h.pending.size, 0);
});
test('overlapping refresh requests are deduplicated', async () => {
  let release; let calls = 0;
  const h = harness(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  const first = h.updater.refresh(); await h.updater.refresh(); assert.equal(calls, 1);
  release(response()); await first; assert.equal(h.updates.length, 1); h.updater.stop();
});
test('HTTP failure keeps prior render and still schedules recovery', async () => {
  let fail = false;
  const h = harness(async () => fail ? { ok: false, status: 503 } : response());
  await h.updater.refresh(); fail = true; await h.updater.refresh();
  assert.equal(h.updates.length, 1); assert.equal(h.errors.length, 1);
  assert.equal([...h.pending.values()].filter(x => x.ms === POLL_INTERVAL_MS).length, 1); h.updater.stop();
});
test('hidden pages do not poll and resume refreshes once', async () => {
  let calls = 0; const h = harness(async () => { calls++; return response(); });
  h.setVisible(false); await h.updater.refresh(); assert.equal(calls, 0);
  h.setVisible(true); await h.updater.refresh(); assert.equal(calls, 1); h.updater.stop();
});
test('stopped requests cannot render a late response', async () => {
  let release; const h = harness(() => new Promise(resolve => { release = resolve; }));
  const task = h.updater.refresh(); h.updater.stop(); release(response()); await task;
  assert.equal(h.updates.length, 0); assert.equal(h.pending.size, 0);
});
test('request timeout aborts the request and reports failure', async () => {
  const h = harness((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));
  const task = h.updater.refresh(); const timeout = [...h.pending.values()].find(x => x.ms === 10000);
  assert.ok(timeout); timeout.fn(); await task; assert.equal(h.errors.length, 1); h.updater.stop();
});
