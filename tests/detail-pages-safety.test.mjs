import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { buildAll, loadDetailData, validateDetailData } from '../scripts/build-detail-pages.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const data = loadDetailData();

test('detail source records preserve approved copy, source URLs, dates and image identity', () => {
  // Change this fingerprint only after checking deliberate edits against their sources.
  assert.equal(createHash('sha256').update(JSON.stringify(data.pages)).digest('hex'), 'b6aeae6c33acbfe3108de942c94f5973a5879eef5cfa26f7f30a4cc9646c7df2');
});

test('every checked-in detail page exactly matches the deterministic builder', () => {
  for (const { html, out } of buildAll(data)) assert.equal(read(out).replaceAll('\r\n', '\n'), html, out);
});

test('invalid paths, unsafe source links and missing image metadata fail before writing', () => {
  for (const mutate of [p => { p.out = '../index.html'; }, p => { p.route = '/'; }, p => { p.visual.alt = ''; }, p => { p.sourceHref = 'javascript:alert(1)'; }, p => { p.visual.width = 0; }, p => { p.contextParas[0] = '<script>alert(1)</script>'; }, p => { p.contextParas[0] = '<a href="javascript:alert(1)">Unsafe</a>'; }, p => { p.visual.local = '/assets/../../index.html'; }, p => { p.dateISO = '2026-02-30'; }]) {
    const invalid = structuredClone(data);
    mutate(invalid.pages[0]);
    assert.throws(() => validateDetailData(invalid));
  }
});

test('local image files have MIME-appropriate signatures and match the source manifest', () => {
  const sources = JSON.parse(read('assets/detail-pages/SOURCES.json'));
  assert.equal(sources.assets.length, 7);
  assert.equal(sources.remoteOnly.length, 3);
  for (const item of sources.assets) {
    const page = data.pages.find(p => p.id === item.id);
    assert.equal(page.visual.local, `/assets/detail-pages/${item.file}`);
    assert.equal(page.visual.mime, item.mime);
    const bytes = readFileSync(new URL(`assets/detail-pages/${item.file}`, root));
    if (item.mime === 'image/jpeg') assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff');
    else {
      assert.equal(item.mime, 'image/webp');
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    }
  }
  for (const item of sources.remoteOnly) assert.equal(data.pages.find(p => p.id === item.id).visual.remote, item.imageUrl);
});

test('detail CSS is scoped and preserves existing link hit areas without concealing overflow', () => {
  const css = read('assets/detail-pages.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/([^{}]+)\{/g)) {
    if (match[1].trim().startsWith('@media')) continue;
    for (const selector of match[1].split(',')) assert.match(selector.trim(), /^body\.detail-page\b/);
  }
  assert.doesNotMatch(css, /overflow-x:\s*(?:hidden|clip)|min-height:\s*0/);
  for (const file of ['index.html', 'about/index.html', 'writing/index.html', 'media/index.html', 'research/index.html', 'research/ai-money/index.html', 'what-i-build/index.html', 'what-i-believe/index.html', 'what-i-back/index.html']) {
    assert.doesNotMatch(read(file), /detail-pages\.css|detail-image-fallback\.js/);
  }
});

test('cached failures and later image errors reveal the original-source fallback', () => {
  for (const state of [{ complete: true, naturalWidth: 0 }, { complete: false, naturalWidth: 0 }, { complete: true, naturalWidth: 800 }]) {
    const listeners = {};
    const classes = [];
    const image = { ...state, addEventListener: (name, callback) => { listeners[name] = callback; } };
    const fallback = { hidden: true };
    const figure = { querySelector: selector => selector === '[data-visual-img]' ? image : fallback, classList: { add: name => classes.push(name) } };
    vm.runInNewContext(read('assets/detail-image-fallback.js'), { document: { querySelectorAll: () => [figure] } });
    assert.equal(fallback.hidden, !(state.complete && state.naturalWidth === 0));
    if (!state.complete) listeners.error();
    if (state.naturalWidth === 0) assert.ok(classes.includes('is-broken'));
  }
});

test('visible sources, structured data and canonical identity stay aligned', () => {
  for (const page of data.pages) {
    const html = read(page.out);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
    const webpage = graph.find(n => n['@type'] === 'WebPage');
    assert.equal(webpage.url, `https://rezoshmertz.com${page.route}`);
    assert.equal(webpage.datePublished, page.dateISO);
    assert.equal(webpage.dateModified, data.dateModified);
    assert.equal(webpage.primaryImageOfPage.url, page.visual.local ? `https://rezoshmertz.com${page.visual.local}` : page.visual.remote);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.equal(graph.filter(n => n['@type'] === 'BreadcrumbList').length, 1);
    const article = graph.find(n => n['@type'] === 'Article');
    if (page.kind === 'article') assert.equal(article.isBasedOn, page.sourceHref);
    else { assert.equal(article, undefined); assert.equal(webpage.citation, page.sourceHref); }
    assert.doesNotMatch(html, /<iframe\b|<video\b|<a\b(?=[^>]*href="\/)(?=[^>]*target="_blank")[^>]*>/);
  }
});
