import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadDetailData } from '../scripts/build-detail-pages.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const data = loadDetailData();
const media = JSON.parse(read('data/media.json'));
const sitemap = read('sitemap.xml');
const feed = read('feed.xml');
const llms = read('llms.txt');
const htmlEsc = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const xml = value => htmlEsc(value).replaceAll("'", '&apos;');
const episodeLabel = episode => `Episode ${String(episode).padStart(2, '0')}`;

test('all ten podcast records link to exactly one local podcast page', () => {
  const records = media.records.filter(record => record.kind === 'podcast');
  const pages = data.pages.filter(page => page.kind === 'podcast');
  assert.equal(records.length, 10);
  assert.equal(pages.length, 10);
  assert.equal(media.records.find(record => record.episode === 10 && record.featuredOrder === 1).id, 'podcast');
  const titles = new Set();
  const descriptions = new Set();
  for (const record of records) {
    const matches = pages.filter(page => page.sourceHref === record.url);
    assert.equal(matches.length, 1, record.id);
    const page = matches[0];
    assert.equal(page.h1, record.title);
    assert.equal(page.feedTitle, page.h1);
    assert.equal(page.llmsTitle, page.h1);
    assert.equal(page.feedSummary, page.description);
    assert.equal(page.llmsSummary, page.description);
    assert.equal(page.dateISO, record.date);
    assert.equal(page.episode, episodeLabel(record.episode));
    assert.equal(page.publisher, 'BR Labs');
    assert.equal(page.crumb, 'Podcast');
    assert.equal(page.formatLabel, 'Podcast episode');
    assert.equal(page.nav, 'media');
    assert.equal(page.sourceAction, 'Watch the original on X ↗');
    assert.equal(record.summaryUrl, page.route);
    assert.equal(page.out, `${page.route.slice(1)}index.html`);
    assert.equal(page.contextParas.length, 2);
    assert.equal((page.bodySections || []).length, 1);
    assert.equal(page.bodySections[0].h2, 'Episode topics');
    assert.ok(!titles.has(page.metaTitle), page.metaTitle);
    assert.ok(!descriptions.has(page.description), page.description);
    titles.add(page.metaTitle);
    descriptions.add(page.description);

    const html = read(page.out);
    const canonical = `https://rezoshmertz.com${page.route}`;
    assert.equal((html.match(/<link rel="canonical"/g) || []).length, 1);
    assert.match(html, new RegExp(`<link rel="canonical" href="${canonical}"/>`));
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.ok(html.includes(`<h1 class="record-title">${htmlEsc(page.h1)}</h1>`));
    assert.equal((html.match(/<meta name="description"/g) || []).length, 1);
    assert.ok(html.includes(`<meta name="description" content="${htmlEsc(page.description)}"/>`));
    const cover = page.visual.local ? `https://rezoshmertz.com${page.visual.local}` : page.visual.remote;
    assert.equal((html.match(/property="og:image" /g) || []).length, 1);
    assert.ok(html.includes(`property="og:image" content="${htmlEsc(cover)}"`));
    const context = html.match(/<section class="page-context"[\s\S]*?<\/section>/)[0];
    assert.equal((context.match(/<p>/g) || []).length, 2);
    assert.ok(html.includes(`<p class="source-action"><a href="${record.url}" rel="noopener noreferrer" target="_blank">${htmlEsc(page.sourceAction)}</a></p>`));
    assert.match(html, new RegExp(`<span>${page.episode}</span>`));
    assert.match(html, new RegExp(`<time datetime="${page.dateISO}">`));

    const modified = page.dateModified ?? data.dateModified;
    assert.match(sitemap, new RegExp(`<loc>${canonical}</loc><lastmod>${modified}</lastmod>`));
    assert.equal((sitemap.match(new RegExp(`<loc>${canonical}</loc>`, 'g')) || []).length, 1);
    assert.match(feed, new RegExp(`<id>${canonical}</id>\\s*<link href="${canonical}"/>\\s*<published>${page.dateISO}T00:00:00Z</published>\\s*<updated>${modified}T00:00:00Z</updated>`));
    assert.ok(feed.includes(`<title>${xml(page.h1)}</title>`));
    assert.ok(feed.includes(`<summary>${xml(page.description)}</summary>`));
    assert.ok(llms.includes(`[${page.h1}](${canonical}): ${page.description}`));
  }
  assert.match(feed, /<updated>2026-09-29T00:00:00Z<\/updated>/);
  assert.match(feed, /solana-ousd-retail-conviction\/<\/id>[\s\S]*?<updated>2026-09-23T00:00:00Z<\/updated>/);
});
