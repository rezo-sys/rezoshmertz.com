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
  assert.equal(hash(html.slice(html.indexOf('<dialog aria-labelledby="dialog-title"'))),
    'b1e6310cf99e7b389e8e1799a5cdd03c3f803af6b0b11c490b80da4f9687a9a9');
  const originalDestinations = Array.from(html.replace(stylesheet, '').matchAll(/\b(?:href|src)="([^"]+)"/g), m => m[1]);
  assert.equal(hash(JSON.stringify(originalDestinations)),
    'c8d0ce99e6412851fc3d73e7b56862e70cb5a7f7881dce50a0c39a8ba6a59a1a');
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
