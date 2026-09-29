import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = readFileSync(new URL('../assets/home-editorial.css', import.meta.url), 'utf8');
const stylesheet = '<link href="/assets/home-editorial.css?v=20260911" rel="stylesheet"/>';
const hash = value => createHash('sha256').update(value).digest('hex');

test('hero, navigation, research, metadata and media player remain unchanged', () => {
  // Fingerprints of the approved pre-change production HTML at be83728.
  // Update deliberately only when a later task intentionally changes these regions.
  assert.equal(hash(html.split('<div class="editorial-additions">')[0].replace(stylesheet, '')),
    '49f1d9d822caf7f7ca751db9ac805bc6d8aaf49695a918923de26d445b1a802b');
  // Reviewed media.js cache query; dialog markup and hero script are unchanged.
  assert.equal(hash(html.slice(html.indexOf('<dialog aria-labelledby="dialog-title"'))),
    '72ca22f56d382a404d752e8390d6816ea9da70efbecc356eba6ddc0d617e8c63');
  const originalDestinations = Array.from(html.replace(stylesheet, '').matchAll(/\b(?:href|src)="([^"]+)"/g), m => m[1]);
  // Reviewed Episode 10 links/thumbnail and media.js cache query.
  assert.equal(hash(JSON.stringify(originalDestinations)),
    '209767f9f8a1f010c02109b34cec823a39bcb09194962a286f0e2e6d5d7f264d');
  assert.match(html, /content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"/);
  assert.doesNotMatch(html, /noindex|localhost|127\.0\.0\.1|preview\.css|balanced-writing\.css/);
});

test('new stylesheet is loaded once and all selectors are homepage scoped', () => {
  assert.equal(html.split(stylesheet).length - 1, 1);
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of withoutComments.matchAll(/([^{}]+)\{/g)) {
    const selector = match[1].trim();
    if (selector.startsWith('@media')) continue;
    for (const part of selector.split(',')) {
      assert.ok(part.trim().startsWith('.home-page .editorial-additions'), part);
    }
  }
  assert.match(css, /@media \(max-width: 840px\)/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.site-description \{[^}]*font-size: 12px;/);
});

test('featured columns grow with the section while paragraph measure and mobile layout stay bounded', () => {
  assert.match(css, /\.lead \.summary \{\s*max-width: none;/);
  assert.match(css, /\.featured-excerpt blockquote p \{ max-width: 75ch;/);
  assert.match(css, /\.lead \.summary \{ max-width: 54ch; \}/);
  assert.match(css, /\.featured-excerpt blockquote \{ display: block; \}/);
});

test('approved original openings are present without generated replacements', () => {
  const excerpts = Array.from(html.matchAll(/<p class="card-excerpt">(.*?)<\/p>/g), m => m[1]);
  assert.deepEqual(excerpts, [
    "I've held Bitcoin for around ten years, and I've learned the biggest risks aren't the ones we can quantify precisely, but the ones where the timeline is fundamentally uncertain. Quantum is exactly that kind of risk. I recently reviewed materials from both @CoinShares and @nic__carter on Bitcoin's quantum vulnerability…",
    'What do Warren Buffett, an AI agent named "Warren," and insider bets on the Super Bowl have in common? More than you\'d think. And it\'s not about AI, it\'s about the nature of alpha... where it lived, where it moved, and why most people are looking for it in the wrong place…',
    'A chain is only as fast as its slowest link. In RWA credit, that link is not the token. It is the borrower, the documents, the collateral, the servicer and the court. Goldfinch is what happens when crypto capital buys private credit and expects it to behave like a crypto product…',
  ]);
  assert.ok(excerpts.every(text => text.length <= 400 && text.endsWith('…')));
});

test('featured passage is identified as a conclusion excerpt with its source', () => {
  assert.match(html, /<p class="excerpt-origin">From the essay's conclusion<\/p>/);
  const quote = html.match(/<blockquote cite="https:\/\/x\.com\/rezosh\/status\/2015867583610945999">(.*?)<\/blockquote>/);
  assert.ok(quote);
  assert.deepEqual(Array.from(quote[1].matchAll(/<p>(.*?)<\/p>/g), m => m[1]), [
    'The real perpetuals war is not Hyperliquid vs Lighter, but transparency + composability vs opacity + isolation. Short term: UX and performance win. Long term: transparency and liquidity access win.',
    "The lesson from FTX is that opacity catches up. You can't audit what you can't see. Perpetuals are infrastructure now, not experiments, and the infrastructure that wins will be the infrastructure we can verify.",
  ]);
  assert.doesNotMatch(quote[1], /176%|…/);
});

test('media descriptions preserve all player hooks and footer remains three paragraphs', () => {
  assert.equal(Array.from(html.matchAll(/class="media-description"/g)).length, 3);
  for (const type of ['podcast', 'panel', 'event']) {
    assert.equal(html.split(`data-media="${type}"`).length - 1, 2);
  }
  const description = html.match(/<div class="site-description">(.*?)<\/div>/)[1];
  assert.equal(Array.from(description.matchAll(/<p>/g)).length, 3);
  assert.doesNotMatch(description, /\b(?:his|he)\b|—/i);
  assert.match(description, /Rezo Shmertz, founder, investor and researcher/);
});

test('homepage Episode 10 card and player constants match the featured record', () => {
  const media = JSON.parse(readFileSync(new URL('../data/media.json', import.meta.url), 'utf8'));
  const player = readFileSync(new URL('../assets/media.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const featured = media.records.find(record => record.id === 'podcast');
  assert.equal(featured.episode, 10);
  assert.equal(featured.player, 'x');
  assert.equal(featured.featuredOrder, 1);
  assert.equal(featured.date, '2026-09-28');
  assert.equal(featured.duration, '11:46');
  assert.equal(featured.title, 'VC After AI Concentration, the Desk Map & One Unified Book');
  assert.equal(featured.alt, 'BR Labs Episode 10 video thumbnail');
  assert.equal(featured.url, 'https://x.com/brlabsxyz/status/2104586824328888451');
  assert.equal(featured.image, 'https://pbs.twimg.com/amplify_video_thumb/2104582925639634944/img/JjgEPVQsT3E3o1Nl.jpg');
  const card = html.match(/<article class="media-item">[\s\S]*?<\/article>/)[0];
  assert.equal((card.match(/href="https:\/\/x\.com\/brlabsxyz\/status\/2104586824328888451"/g) || []).length, 2);
  assert.match(card, /aria-label="Watch BR Labs Episode 10"/);
  assert.ok(card.includes(`src="${featured.image}"`));
  assert.ok(card.includes(`alt="${featured.alt}"`));
  assert.ok(card.includes(`▶ ${featured.duration}`));
  assert.ok(card.includes('VC After AI Concentration, the Desk Map &amp; One Unified Book'));
  assert.ok(card.includes('Episode 10 · Sep 28, 2026'));
  assert.ok(card.includes(`<p class="media-description">${featured.description}</p>`));
  const statusId = featured.url.match(/\/status\/(\d+)$/)[1];
  const constants = player.match(/podcast: \{title:'([^']+)', credit:'([^']+)'\}/);
  assert.equal(constants[1], `BR Labs Ep. 10: ${featured.title}`);
  assert.ok(constants[2].endsWith(featured.duration));
  assert.match(player, new RegExp(`createTweet\\('${statusId}'`));
  assert.equal((html.match(/src="\/assets\/media\.js\?v=20260929"/g) || []).length, 1);
  assert.match(html, /src="\/assets\/hero-motion\.js\?v=20260906-typewriter"/);
});

test('homepage and Media sitemap modification dates are 2026-09-29', () => {
  const sitemap = readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const entries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map(match => [match[1], match[2]]);
  assert.deepEqual(entries.filter(([, date]) => date === '2026-09-29').map(([loc]) => loc), [
    'https://rezoshmertz.com/',
    'https://rezoshmertz.com/media/',
  ]);
});
