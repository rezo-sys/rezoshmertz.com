import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = read('about/index.html');
const css = read('assets/about-profile.css');
const hash = value => createHash('sha256').update(value).digest('hex');

test('About preserves the original photograph and shared header/footer', () => {
  assert.equal(hash(readFileSync(new URL('../rezo-speaking-cutout-v4-hero.png', import.meta.url))), '36e6f73fd3eb98f8c338a6a21eee27c88666eaa95e4e31a1e47fc61ec5ae4aa9');
  assert.match(html, /src="\/rezo-speaking-cutout-v4-hero.png" width="1055" height="945"/);
  assert.equal(hash(html.match(/<header class="site-header">[\s\S]*?<\/header>/)[0]), 'a102954204559db5f59ff814e78d95dc6091f390585516c2216ad3f3b4fe5bc7');
  assert.equal(hash(html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0]), '35269686b46e1336e7f36646a8e057769482a6e1d522b0244ba623c9c7332f28');
  assert.deepEqual([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]), ['/assets/about-nav.js?v=20260906-final']);
});

test('About exposes approved biography, social routes and equal work paths without scripts', () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<h1 id="about-heading">About Rezo Shmertz<\/h1>/);
  const body = html.match(/<div class="about-body">([\s\S]*?)<\/div>/)[1];
  assert.equal((body.match(/<p>/g) || []).length, 3);
  assert.match(body, /co-founder and Managing Partner of BR Capital/);
  assert.match(body, /co-founding Super Protocol and T-Digital/);
  assert.match(body, /including discussions of stablecoin adoption and institutional DeFi/);
  const socials = html.match(/<nav class="about-socials"[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...socials.matchAll(/href="([^"]+)"/g)].map(m => m[1]), ['https://x.com/rezosh', 'https://www.linkedin.com/in/rsbit', 'https://grokipedia.com/page/rezo-shmertz']);
  const paths = html.match(/<nav class="about-paths"[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...paths.matchAll(/<strong>(.*?)<\/strong>/g)].map(m => m[1]), ['What I Build', 'What I Believe', 'What I Back']);
  assert.deepEqual([...paths.matchAll(/href="([^"]+)"/g)].map(m => m[1]), ['/what-i-build/', '/what-i-believe/', '/what-i-back/']);
});

test('About keeps concise source records and useful linked bottom context', () => {
  const records = html.match(/<div class="about-record-grid">([\s\S]*?)<\/div>/)[1];
  assert.equal((records.match(/<article>/g) || []).length, 3);
  assert.match(records, /https:\/\/www.youtube.com\/watch\?v=OH33Er6q3KA/);
  assert.match(records, /href="\/writing\/appearances\/stablecoins-tbilisi-finance-summit\/"/);
  assert.match(records, /https:\/\/developer.nvidia.com\/blog\/exploring-the-case-of-super-protocol-with-self-sovereign-ai-and-nvidia-confidential-computing\//);
  assert.ok([...records.matchAll(/<p>(.*?)<\/p>/g)].every(m => m[1].length < 100));
  const context = html.match(/<section class="about-context"[\s\S]*?<\/section>/)[0];
  assert.equal((context.match(/<p>/g) || []).length, 2);
  assert.equal((context.match(/<a /g) || []).length, 6);
  assert.doesNotMatch(html, /noindex|127\.0\.0\.1|—|icoholder/);
});

test('About retains canonical profile metadata and scoped, wrapping styles', () => {
  assert.match(html, /href="https:\/\/rezoshmertz.com\/about\/" rel="canonical"/);
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
  const profile = graph.find(node => node['@type'] === 'ProfilePage');
  assert.equal(profile.dateModified, '2026-09-15');
  assert.match(read('sitemap.xml'), /<loc>https:\/\/rezoshmertz.com\/about\/<\/loc><lastmod>2026-09-15<\/lastmod>/);
  assert.equal(profile.mainEntity['@id'], graph.find(node => node['@type'] === 'Person')['@id']);
  assert.ok(html.indexOf('/assets/about-profile.css') < html.indexOf('</head>'));
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)) {
    if (match[1].trim().startsWith('@media')) continue;
    for (const selector of match[1].split(',')) assert.ok(selector.trim().startsWith('.about-profile'), selector);
  }
  assert.match(css, /height: auto/);
  assert.match(css, /align-items: start/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /max-width:620px/);
  assert.match(css, /max-width:900px/);
  assert.doesNotMatch(css, /line-clamp|text-overflow|overflow:\s*hidden/);
});
