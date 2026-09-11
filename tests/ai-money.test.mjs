import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = read('research/ai-money/index.html');
const css = read('assets/ai-money.css');
const script = read('assets/ai-money.js');

// CSV records contain quoted commas, escaped quotes and multiline response fields.
function parseCSV(text) {
  const records = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if (c === '\n' && !quoted) { row.push(field); records.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); records.push(row); }
  const [headers, ...rows] = records;
  return rows.map(values => Object.fromEntries(headers.map((key, i) => [key, values[i]])));
}
const data = parseCSV(read('data/ai-money/judgments.csv'));
const category = label => ({ stablecoin:'Stablecoin', bitcoin:'Bitcoin', fiat:'Fiat' })[label] || 'Remaining';
const roles = ['Medium of exchange', 'Settlement', 'Store of value', 'Unit of account'];
const categories = ['Stablecoin', 'Bitcoin', 'Fiat', 'Remaining'];
const pct = (n, total) => (n / total * 100).toFixed(2);
const forRole = name => data.filter(row => row.role.toLowerCase() === name.toLowerCase());

test('all 1,260 public classifications match the four static chart count vectors', () => {
  assert.equal(data.length, 1260);
  const rows = [...html.matchAll(/data-role="([^"]+)" data-counts="([^"]+)"/g)];
  assert.equal(rows.length, 4);
  for (const [, name, counts] of rows) {
    const source = forRole(name);
    assert.equal(source.length, 315);
    assert.deepEqual(counts.split(',').map(Number), categories.map(cat => source.filter(row => category(row.judge_label) === cat).length));
  }
});

test('all 20 static model cells agree with the public source classifications', () => {
  const body = html.match(/<tbody id="model-rows">([\s\S]*?)<\/tbody>/)[1];
  const modelRows = [...body.matchAll(/<tr><th[^>]+>([^<]+)<\/th>([\s\S]*?)<\/tr>/g)];
  assert.equal(modelRows.length, 5);
  for (const [, model, cellsHTML] of modelRows) {
    const cells = [...cellsHTML.matchAll(/<td>([^<]+)<small>([\d.]+)%(?: each)?<\/small><\/td>/g)];
    assert.equal(cells.length, 4);
    roles.forEach((role, i) => {
      const source = forRole(role).filter(row => row.model_name === model);
      assert.equal(source.length, 63);
      const counts = {};
      for (const row of source) counts[row.judge_label] = (counts[row.judge_label] || 0) + 1;
      const count = Math.max(...Object.values(counts));
      const leaders = Object.entries(counts).filter(([, n]) => n === count).map(([label]) => category(label)).sort();
      assert.deepEqual(cells[i][1].split(' / ').sort(), leaders);
      assert.equal(cells[i][2], pct(count, 63));
    });
  }
});

test('no-JavaScript visitors get a named chart, complete table and native methodology', () => {
  assert.match(html, /class="static-ranking">Ranked by Stablecoin share/);
  assert.match(html, /id="comparison-controls" hidden/);
  assert.equal((html.match(/class="chart-row"/g) || []).length, 4);
  assert.equal((html.match(/<td>/g) || []).length, 20);
  assert.match(html, /<details class="method-details"><summary>Read the methodology/);
  assert.match(css, /\[data-enhanced\] \.table-scroll\s*\{\s*display:\s*none/);
  assert.match(script, /page.dataset.enhanced = 'true'/);
});

test('production metadata, navigation and dataset provenance are preserved', () => {
  assert.doesNotMatch(html, /noindex|localhost|127\.0\.0\.1|Local design preview|Open original figure|repeatable were|96\.44|3\.56|—/);
  assert.match(html, /rel="canonical"/);
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.ok(graph['@graph'].some(node => node['@type'] === 'Dataset'));
  const header = html.match(/<header[\s\S]*?<\/header>/)[0];
  assert.equal(createHash('sha256').update(header).digest('hex'), 'da7419577d31124175abeeecda1ba1d0145adfd1288ca0eb61514172c10f62cf');
  for (const asset of ['responses.csv', 'judgments.csv', 'full-results.xlsx']) assert.ok(html.includes('/data/ai-money/' + asset));
});

test('interactive implementation uses source DOM, reduced motion and native controls', () => {
  assert.match(script, /querySelectorAll\('\[data-role\]'\)/);
  assert.match(script, /querySelectorAll\('#model-rows tr'\)/);
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /reducedMotion.addEventListener\('change'/);
  assert.doesNotMatch(script, /innerHTML|fetch\(|setInterval|eval\(/);
  assert.match(script, /if \(category !== active\) render\(category, true\)/);
});
