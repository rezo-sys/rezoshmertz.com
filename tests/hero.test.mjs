import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code = fs.readFileSync(new URL('../assets/hero-motion.js', import.meta.url), 'utf8');
const original = fs.readFileSync(new URL('../mockups/bento-site.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/finishing.css', import.meta.url), 'utf8');
class Events {
  listeners = new Map();
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
  emit(type) { for (const fn of this.listeners.get(type) ?? []) fn(); }
}
function env({source = code, reduce = false, hidden = false, missing = false} = {}) {
  let clock = 0, id = 0, maxTimers = 0;
  let text = html.match(/class="switch-phrase">([^<]+)</)[1];
  const timers = new Map(), trace = [];
  const phrase = {
    get textContent() { return text; },
    set textContent(value) { if (text !== value) trace.push({at: clock, text: value}); text = value; },
  };
  const preference = new Events(); preference.matches = reduce;
  const document = new Events(); document.hidden = hidden;
  document.querySelector = selector => ['.switch-phrase', '#typed-text'].includes(selector) && !missing ? phrase : null;
  const window = new Events(); window.matchMedia = () => preference;
  window.clearTimeout = key => timers.delete(key);
  window.setTimeout = (fn, delay) => {
    timers.set(++id, {fn, at: clock + delay});
    maxTimers = Math.max(maxTimers, timers.size);
    return id;
  };
  async function advance(ms) {
    const end = clock + ms;
    let iterations = 0;
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      assert.ok(++iterations < 10000, 'Unbounded timer loop');
      clock = next[1].at; timers.delete(next[0]); next[1].fn();
      // Original implementation resumes an async function after each wait.
      await Promise.resolve();
      await Promise.resolve();
    }
    clock = end;
  }
  vm.runInNewContext(source, {document, window, setTimeout: window.setTimeout, matchMedia: () => ({matches: false})});
  return {phrase, trace, timers, document, window, preference, advance,
    get maxTimers() { return maxTimers; },
    reduce(value) { preference.matches = value; preference.emit('change'); },
    hide(value) { document.hidden = value; document.emit('visibilitychange'); },
  };
}
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({name, result: 'PASS'}); }
  catch (error) { results.push({name, result: 'FAIL', error: error.stack}); }
}
await test('Exact character-by-character trace and timestamps match original over two full cycles', async () => {
  const actual = env(), reference = env({source: original});
  await actual.advance(30000); await reference.advance(30000);
  assert.deepEqual(actual.trace, reference.trace);
  assert.ok(actual.trace.length > 100);
  for (const phrase of ['CAPITAL COMPOUNDS.', 'DISCIPLINE COMPOUNDS.', 'I BUIDL', 'I HODL...']) {
    assert.ok(actual.trace.filter(frame => frame.text === phrase).length >= 2, phrase);
  }
});
await test('Initial hold is 1450ms, deletion is individual characters every 46ms', async () => {
  const e = env(); await e.advance(1449); assert.equal(e.phrase.textContent, 'CAPITAL COMPOUNDS.');
  await e.advance(1); assert.equal(e.phrase.textContent, 'CAPITAL COMPOUNDS');
  await e.advance(45); assert.equal(e.phrase.textContent, 'CAPITAL COMPOUNDS');
  await e.advance(1); assert.equal(e.phrase.textContent, 'CAPITAL COMPOUND');
});
await test('Empty transition holds 46+150ms and types characters every 68ms', async () => {
  const e = env(); await e.advance(4000);
  const blank = e.trace.findIndex(frame => frame.text === '');
  assert.equal(e.trace[blank + 1].at - e.trace[blank].at, 196);
  assert.equal(e.trace[blank + 1].text, 'D');
  assert.equal(e.trace[blank + 2].at - e.trace[blank + 1].at, 68);
  assert.equal(e.trace[blank + 2].text, 'DI');
});
await test('I BUIDL to I HODL retains the common I-space prefix', async () => {
  const e = env(); await e.advance(16000);
  const start = e.trace.findIndex(frame => frame.text === 'I BUIDL');
  const end = e.trace.findIndex((frame, i) => i > start && frame.text === 'I HODL...');
  assert.ok(start >= 0 && end > start);
  assert.ok(e.trace.slice(start, end + 1).every(frame => frame.text.startsWith('I ')));
  assert.ok(e.trace.slice(start, end).some(frame => frame.text === 'I '));
});
await test('Reduced motion on load has static full text and no timers', async () => {
  const e = env({reduce: true}); await e.advance(60000);
  assert.equal(e.phrase.textContent, 'CAPITAL COMPOUNDS.'); assert.equal(e.timers.size, 0);
});
await test('Enabling reduced motion mid-word resets complete text; disabling restarts cleanly', async () => {
  const e = env(); await e.advance(1600); e.reduce(true);
  assert.equal(e.phrase.textContent, 'CAPITAL COMPOUNDS.'); assert.equal(e.timers.size, 0);
  await e.advance(10000); e.reduce(false); await e.advance(1450);
  assert.equal(e.phrase.textContent, 'CAPITAL COMPOUNDS');
});
await test('Hidden page suspends mid-character and resumes without skipping', async () => {
  const e = env(); await e.advance(1496); const before = e.phrase.textContent;
  e.hide(true); await e.advance(30000); assert.equal(e.phrase.textContent, before); assert.equal(e.timers.size, 0);
  e.hide(false); await e.advance(46); assert.equal(e.phrase.textContent, before.slice(0, -1));
});
await test('Initially hidden page starts only when visible', async () => {
  const e = env({hidden: true}); await e.advance(30000); assert.equal(e.timers.size, 0);
  e.hide(false); await e.advance(1450); assert.equal(e.phrase.textContent, 'CAPITAL COMPOUNDS');
});
await test('pagehide suspends through visibility events; pageshow resumes a single timer', async () => {
  const e = env(); await e.advance(1496); const before = e.phrase.textContent;
  e.window.emit('pagehide'); e.hide(false); e.reduce(false); await e.advance(30000);
  assert.equal(e.timers.size, 0); assert.equal(e.phrase.textContent, before);
  e.window.emit('pageshow'); await e.advance(46); assert.equal(e.phrase.textContent, before.slice(0, -1));
});
await test('Repeated lifecycle events never create overlapping timers', async () => {
  const e = env(); for (let i = 0; i < 25; i++) { e.window.emit('pageshow'); e.hide(false); e.reduce(false); }
  await e.advance(30000); assert.equal(e.maxTimers, 1); assert.equal(e.timers.size, 1);
});
await test('Missing headline safely exits without handlers or timers', () => {
  const e = env({missing: true}); assert.equal(e.timers.size, 0); assert.equal(e.document.listeners.size, 0); assert.equal(e.window.listeners.size, 0);
});
await test('No Play/Pause UI; real caret and hidden width measure retain heading semantics', () => {
  assert.doesNotMatch(html + code + css, /motion-toggle|Play headline|Pause headline/);
  assert.match(html, /<h1 id="hero-heading">/);
  assert.match(html, /<span aria-hidden="true" class="switch-measure">/);
  assert.match(html, /<i aria-hidden="true" class="type-caret"><\/i>/);
  assert.match(css, /49%, 100% \{ opacity: .15; \}/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?\.type-caret \{ animation: none; \}/);
});
console.log(JSON.stringify({scope: 'Deterministic source comparison and lifecycle mocks; browser layout checked separately', passed: results.filter(t => t.result === 'PASS').length, total: results.length, results}, null, 2));
if (results.some(t => t.result === 'FAIL')) process.exitCode = 1;
