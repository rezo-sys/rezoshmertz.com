import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAll, loadDetailData, validateDetailData } from '../scripts/build-detail-pages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const data = loadDetailData();
validateDetailData(data);
assert.equal(data.pages.length, 10);

const articles = data.pages.filter((p) => p.kind === 'article');
const media = data.pages.filter((p) => p.kind !== 'article');
assert.equal(articles.length, 4);
assert.equal(media.length, 6);

for (const page of data.pages) {
  const html = read(page.out);
  assert.match(html, /body class="detail-page"/);
  assert.match(html, /index,follow/);
  assert.doesNotMatch(html, /noindex/);
  assert.match(html, /detail-pages\.css\?v=20260923-detail-a/);
  assert.match(html, /detail-image-fallback\.js\?v=20260923-detail-a/);
  const h1Html = page.h1.replaceAll('&', '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(html, new RegExp(`<h1 class="record-title">${h1Html}</h1>`));
  assert.match(html, new RegExp(page.contextHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const para of page.contextParas) {
    assert.ok(html.includes(`<p>${para}</p>`), `Missing complete context on ${page.id}`);
  }
  assert.doesNotMatch(html, /[—–]/);
  assert.doesNotMatch(html, /\/og\/writing-/);
  const cover = page.visual.local
    ? `https://rezoshmertz.com${page.visual.local}`
    : page.visual.remote;
  assert.ok(html.includes(`property="og:image" content="${cover}"`) || html.includes(`property="og:image" content="${cover.replaceAll('&', '&amp;')}"`));
  assert.match(html, new RegExp(`og:image:width" content="${page.visual.width}"`));
  assert.match(html, new RegExp(`og:image:height" content="${page.visual.height}"`));
  assert.match(html, new RegExp(`og:image:type" content="${page.visual.mime}"`));
  if (page.nav === 'writings') {
    assert.match(html, /aria-current="page">Writings</);
    assert.match(html, /Article summary/);
    assert.match(html, /"@type":"Article"/);
  } else {
    assert.match(html, /aria-current="page">Media</);
    assert.doesNotMatch(html, /"@type":"Article"/);
  }
  assert.ok(!/href="[^"]*-a\.html"/.test(html), `Prototype link on ${page.id}`);
}

const quantumHtml = read('writing/quantum-threat-to-bitcoin/index.html');
assert.match(quantumHtml, /\/assets\/detail-pages\/quantum\.webp/);
assert.ok(existsSync(join(root, 'assets/detail-pages/quantum.webp')));

const tbilisi = read('writing/appearances/stablecoins-tbilisi-finance-summit/index.html');
assert.match(tbilisi, /<figure class="appearance-photo" data-visual-fallback>/);
assert.match(tbilisi, /width="800" height="533"/);
assert.match(tbilisi, /View GFTN event gallery/);
assert.match(tbilisi, /not a recording or transcript/);
assert.match(tbilisi, /class="visual-fallback"/);

const cryptoslate = data.pages.find((p) => p.id === 'cryptoslate');
assert.equal(cryptoslate.h1, 'Corporate L1s and regulatory arbitrage');
assert.equal(cryptoslate.visual.width, 1200);
assert.equal(cryptoslate.visual.height, 630);

const solana = data.pages.find((p) => p.id === 'solana');
assert.equal(solana.dateISO, '2026-07-13');

const css = read('assets/detail-pages.css');
assert.match(css, /body\.detail-page \.page-shell[\s\S]*min\(1320px/);
assert.match(css, /body\.detail-page \.breadcrumbs/);
assert.match(css, /body\.detail-page \.page-footer/);
assert.match(css, /body\.detail-page \.source-action a/);
assert.doesNotMatch(css, /overflow-x:\s*clip/);

const feed = read('feed.xml');
assert.match(feed, /solana-ousd-retail-conviction\/[\s\S]*?<published>2026-07-13T00:00:00Z<\/published>/);
assert.match(feed, /Corporate L1s and regulatory arbitrage/);
assert.match(feed, /Stablecoins at the Tbilisi Finance Summit/);

const llms = read('llms.txt');
assert.match(llms, /Corporate L1s and regulatory arbitrage/);
assert.match(llms, /Stablecoins at the Tbilisi Finance Summit/);

const built = buildAll(data);
assert.equal(built.length, 10);
for (const { html, page } of built) {
  assert.match(html, /body class="detail-page"/);
  const h1Html = page.h1.replaceAll('&', '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(html, new RegExp(`<h1 class="record-title">${h1Html}</h1>`));
  assert.match(html, /BreadcrumbList/);
}

console.log('PASS: ten detail pages, labels, nav, metadata, covers, Tbilisi fallback, CSS scope, feed/llms sync, builder render.');
