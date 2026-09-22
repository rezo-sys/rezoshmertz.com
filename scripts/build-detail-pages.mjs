/**
 * Bounded detail-page builder for the ten approved option-A summaries.
 * Source of truth: data/detail-pages.json
 * Usage:
 *   node scripts/build-detail-pages.mjs
 *   node scripts/build-detail-pages.mjs --check
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const SITE = 'https://rezoshmertz.com';
const { version: CSS_V, dateModified } = loadDetailData();
const approvedRoutes = new Map([
  ['monetary', '/writing/bitcoin-ethereum-solana-monetary-systems/'],
  ['perp', '/writing/non-custodial-perp-dex-transparency/'],
  ['quantum', '/writing/quantum-threat-to-bitcoin/'],
  ['buffett', '/writing/warren-buffett-ai-agents-edge/'],
  ['ai-trust', '/writing/conversations/ai-trust-conviction/'],
  ['ethereum', '/writing/conversations/ethereum-conviction-next-generation/'],
  ['solana', '/writing/conversations/solana-ousd-retail-conviction/'],
  ['cryptoslate', '/writing/press/public-blockchains-regulatory-standard/'],
  ['cryptobriefing', '/writing/press/strategy-bitcoin-cost-of-conviction/'],
  ['tbilisi', '/writing/appearances/stablecoins-tbilisi-finance-summit/'],
]);

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function validLink(value, internal = false) {
  if (typeof value !== 'string' || /[\s<>"\\]/.test(value)) return false;
  if (internal && /^\/(?!\/)/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

const esc = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const abs = (pathOrUrl) =>
  pathOrUrl.startsWith('http') ? pathOrUrl : `${SITE}${pathOrUrl}`;

function relatedList(items) {
  return items
    .map((r) => {
      const external = r.external || /^https?:\/\//.test(r.href);
      return `<li><a href="${esc(r.href)}"${external ? ' rel="noopener noreferrer" target="_blank"' : ''}>${esc(r.label)}</a></li>`;
    })
    .join('\n');
}

function sectionHtml(sec) {
  const paras = (sec.paras || []).map((p) => `<p>${esc(p)}</p>`).join('');
  const list = sec.list
    ? `<ul>${sec.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`
    : '';
  return `<section><h2>${esc(sec.h2)}</h2>${paras}${list}</section>`;
}

function visualFigure(page) {
  const v = page.visual;
  if (v.appearance) {
    return `<figure class="appearance-photo" data-visual-fallback><img alt="${esc(v.alt)}" src="${esc(v.remote)}" width="${v.width}" height="${v.height}" loading="lazy" decoding="async" data-visual-img/><figcaption>Tbilisi Finance Summit · October 2025. Photo: <a href="${esc(page.sourceHref)}" rel="noopener noreferrer" target="_blank">Global Finance &amp; Technology Network (GFTN) ↗</a></figcaption><p class="visual-fallback" hidden><a href="${esc(page.sourceHref)}" rel="noopener noreferrer" target="_blank">${esc(page.sourceAction)}</a></p></figure>`;
  }
  const src = v.local || v.remote;
  return `<figure class="source-visual visual-a" data-visual-fallback>
<a class="visual-link" href="${esc(page.sourceHref)}" rel="noopener noreferrer" target="_blank">
<img src="${esc(src)}" alt="${esc(v.alt)}" width="${v.width}" height="${v.height}" loading="lazy" decoding="async" style="aspect-ratio: ${v.width} / ${v.height}" data-visual-img/>
</a>
<figcaption>
<span class="visual-credit">${esc(v.credit)}</span>
<span class="visual-sep" aria-hidden="true"> · </span>
<a href="${esc(page.sourceHref)}" rel="noopener noreferrer" target="_blank">${esc(v.action)}</a>
</figcaption>
<p class="visual-fallback" hidden><a href="${esc(page.sourceHref)}" rel="noopener noreferrer" target="_blank">${esc(v.action)}</a></p>
</figure>`;
}

function siteHeader(nav) {
  const writings = nav === 'writings' ? ' aria-current="page"' : '';
  const media = nav === 'media' ? ' aria-current="page"' : '';
  return `<header class="site-header">
<a aria-label="Rezo Shmertz home" class="wordmark" href="/">
<span class="wordmark-mark">RS</span>
<span>Rezo Shmertz</span>
</a>
<nav aria-label="Primary navigation" class="primary-nav">
<a href="/">Home</a>
<details class="about-nav"><summary>About<span aria-hidden="true" class="about-chevron"></span></summary><div class="about-links"><a href="/about/">About Rezo</a><a href="/what-i-build/">What I Build</a><a href="/what-i-believe/">What I Believe</a><a href="/what-i-back/">What I Back</a></div></details>
<a href="/writing/"${writings}>Writings</a>
<a href="/media/"${media}>Media</a>
</nav>
</header>`;
}

function coverMeta(page) {
  const v = page.visual;
  const url = abs(v.local || v.remote);
  return {
    url,
    width: v.width,
    height: v.height,
    alt: v.alt,
    type: v.mime,
  };
}

function schemaGraph(page) {
  const cover = coverMeta(page);
  const webpageId = `${SITE}${page.route}#webpage`;
  const crumbs =
    page.nav === 'writings'
      ? [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Writings', item: `${SITE}/writing/` },
          { '@type': 'ListItem', position: 3, name: page.crumb },
        ]
      : [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Media', item: `${SITE}/media/` },
          { '@type': 'ListItem', position: 3, name: page.crumb },
        ];

  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      url: `${SITE}/`,
      name: 'Rezo Shmertz',
      inLanguage: 'en',
      publisher: { '@id': `${SITE}/about/#rezo-shmertz` },
    },
    {
      '@type': 'Person',
      '@id': `${SITE}/about/#rezo-shmertz`,
      name: 'Rezo Shmertz',
      alternateName: 'Revaz (Rezo) Shmertz',
      url: `${SITE}/about/`,
      image: `${SITE}/rezo-speaking-cutout-v4-hero.png`,
      jobTitle: ['Founder', 'Investor', 'Researcher'],
      sameAs: ['https://x.com/rezosh', 'https://www.linkedin.com/in/rsbit'],
    },
    {
      '@type': 'WebPage',
      '@id': webpageId,
      url: `${SITE}${page.route}`,
      name: page.metaTitle,
      description: page.description,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE}/#website` },
      datePublished: page.dateISO,
      dateModified,
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: cover.url,
        width: cover.width,
        height: cover.height,
        contentUrl: cover.url,
        encodingFormat: cover.type,
        name: cover.alt,
      },
      ...(page.kind === 'article'
        ? {}
        : {
            citation: page.sourceHref,
            about: { '@id': `${SITE}/about/#rezo-shmertz` },
          }),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE}${page.route}#breadcrumb`,
      itemListElement: crumbs,
    },
  ];

  if (page.kind === 'article') {
    graph.push({
      '@type': 'Article',
      '@id': `${SITE}${page.route}#article`,
      headline: page.h1,
      description: page.description,
      image: cover.url,
      mainEntityOfPage: { '@id': webpageId },
      author: { '@id': `${SITE}/about/#rezo-shmertz` },
      datePublished: page.dateISO,
      dateModified,
      inLanguage: 'en',
      isBasedOn: page.sourceHref,
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

function head(page) {
  const cover = coverMeta(page);
  const schema = JSON.stringify(schemaGraph(page)).replaceAll('<', '\\u003c');
  const ogType = page.kind === 'article' ? 'article' : 'website';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(page.metaTitle)}</title>
<link rel="canonical" href="${SITE}${page.route}"/>
<link rel="alternate" href="/feed.xml" title="Rezo Shmertz · Writing and Research" type="application/atom+xml"/>
<meta name="description" content="${esc(page.description)}"/>
${page.kind === 'article' ? '<meta name="author" content="Rezo Shmertz"/>\n' : ''}<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"/>
<meta property="og:type" content="${ogType}"/>
<meta property="og:site_name" content="Rezo Shmertz"/>
<meta property="og:locale" content="en_US"/>
<meta property="og:title" content="${esc(page.metaTitle)}"/>
<meta property="og:description" content="${esc(page.description)}"/>
<meta property="og:url" content="${SITE}${page.route}"/>
<meta property="og:image" content="${esc(cover.url)}"/>
<meta property="og:image:width" content="${cover.width}"/>
<meta property="og:image:height" content="${cover.height}"/>
<meta property="og:image:type" content="${esc(cover.type)}"/>
<meta property="og:image:alt" content="${esc(cover.alt)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(page.metaTitle)}"/>
<meta name="twitter:description" content="${esc(page.description)}"/>
<meta name="twitter:image" content="${esc(cover.url)}"/>
<meta name="twitter:image:alt" content="${esc(cover.alt)}"/>
<script type="application/ld+json">${schema}</script>
<link rel="icon" href="/favicon.ico?v=rs-rounded-20260906" sizes="16x16 32x32 48x48"/>
<link rel="icon" href="/favicon.svg?v=rs-rounded-20260906" type="image/svg+xml" sizes="any"/>
<link rel="stylesheet" href="/assets/inner.css"/>
<link rel="stylesheet" href="/assets/refinements.css"/>
<link rel="stylesheet" href="/assets/finishing.css?v=20260906-final"/>
<link rel="stylesheet" href="/assets/about-nav.css?v=20260906-final"/>
<link rel="stylesheet" href="/assets/detail-pages.css?v=${CSS_V}"/>
<script src="/assets/about-nav.js?v=20260906-final" defer></script>
<script src="/assets/detail-image-fallback.js?v=${CSS_V}" defer></script>
</head>`;
}

function contextBlock(page) {
  return `<section class="page-context" aria-labelledby="context-heading">
<h2 id="context-heading">${esc(page.contextHeading)}</h2>
<div>
${page.contextParas.map((p) => `<p>${p}</p>`).join('\n')}
</div>
</section>`;
}

function renderArticle(page) {
  return `${head(page)}
<body class="detail-page">
<a class="skip-link" href="#main-content">Skip to content</a>
${siteHeader(page.nav)}
<main class="page-shell" id="main-content">
<nav aria-label="Breadcrumb" class="breadcrumbs"><a href="/">Home</a><span>/</span><a href="/writing/">Writings</a><span>/</span><span aria-current="page">${esc(page.crumb)}</span></nav>
<div class="essay-shell">
<div class="essay-layout">
<article class="essay-main">
<span class="format-label">Article summary</span>
<h1 class="record-title">${esc(page.h1)}</h1>
<p class="essay-lead">${esc(page.lead)}</p>
<p class="essay-byline">By <a href="/about/">Rezo Shmertz</a> · <time datetime="${page.dateISO}">${esc(page.dateLabel)}</time> · ${esc(page.sourceLabel)}</p>
<p class="source-action"><a href="${esc(page.sourceHref)}" rel="noopener noreferrer" target="_blank">${esc(page.sourceAction)}</a></p>
${visualFigure(page)}
<div class="essay-body">${page.sections.map(sectionHtml).join('\n')}</div>
</article>
<aside class="essay-rail" aria-label="Record details">
<h2>Record</h2>
<dl>
<dt>Format</dt><dd>Article summary</dd>
<dt>Published</dt><dd><time datetime="${page.dateISO}">${esc(page.dateLabel)}</time></dd>
<dt>Source</dt><dd>${esc(page.sourceLabel)}</dd>
</dl>
<h2>Related reading</h2>
<ul>${relatedList(page.related)}</ul>
</aside>
</div>
${contextBlock(page)}
</div>
<footer class="page-footer"><a href="${esc(page.footerLeft.href)}">${esc(page.footerLeft.label)}</a><a href="${esc(page.footerRight.href)}">${esc(page.footerRight.label)}</a></footer>
</main>
<footer class="site-footer"><div class="brand"><span class="rs">RS</span>Rezo Shmertz</div><div class="footer-links"><a href="https://x.com/rezosh">X @rezosh ↗</a><a href="https://www.linkedin.com/in/rsbit">LinkedIn ↗</a><a href="https://grokipedia.com/page/rezo-shmertz">Grokipedia ↗</a></div></footer>
</body>
</html>
`;
}

function renderMedia(page) {
  const episode =
    page.episode != null
      ? `<span>${esc(page.episode)}</span>`
      : `<span>${esc(page.formatLabel)}</span>`;
  const eventLine = page.eventTitle
    ? `<p class="essay-lead">${esc(page.eventTitle)}</p>\n`
    : '';
  const body =
    page.bodySections && page.bodySections.length
      ? page.bodySections.map(sectionHtml).join('\n')
      : '';
  return `${head(page)}
<body class="detail-page">
<a class="skip-link" href="#main-content">Skip to content</a>
${siteHeader(page.nav)}
<main class="page-shell" id="main-content">
<nav aria-label="Breadcrumb" class="breadcrumbs"><a href="/">Home</a><span>/</span><a href="/media/">Media</a><span>/</span><span aria-current="page">${esc(page.crumb)}</span></nav>
<div class="media-shell">
<article class="record-hero">
<span class="format-label">${esc(page.formatLabel)}</span>
<h1 class="record-title">${esc(page.h1)}</h1>
${eventLine}<p class="lead">${esc(page.lead)}</p>
<div class="fact-band"><span>${esc(page.publisher)}</span>${episode}<span><time datetime="${page.dateISO}">${esc(page.dateLabel)}</time></span></div>
<p class="source-action"><a href="${esc(page.sourceHref)}" rel="noopener noreferrer" target="_blank">${esc(page.sourceAction)}</a></p>
${visualFigure(page)}
<div class="record-body">
<p>${esc(page.summaryNote)}</p>
${body}
<h2>Explore further</h2>
<ul>${relatedList(page.related)}</ul>
</div>
</article>
${contextBlock(page)}
</div>
<footer class="page-footer"><a href="${esc(page.footerLeft.href)}">${esc(page.footerLeft.label)}</a><a href="${esc(page.footerRight.href)}">${esc(page.footerRight.label)}</a></footer>
</main>
<footer class="site-footer"><div class="brand"><span class="rs">RS</span>Rezo Shmertz</div><div class="footer-links"><a href="https://x.com/rezosh">X @rezosh ↗</a><a href="https://www.linkedin.com/in/rsbit">LinkedIn ↗</a><a href="https://grokipedia.com/page/rezo-shmertz">Grokipedia ↗</a></div></footer>
</body>
</html>
`;
}

export function renderPage(page) {
  return page.kind === 'article' ? renderArticle(page) : renderMedia(page);
}

export function loadDetailData() {
  return JSON.parse(readFileSync(new URL('data/detail-pages.json', root), 'utf8'));
}

export function validateDetailData(data) {
  if (!/^[a-z0-9-]+$/.test(data.version) || !validDate(data.dateModified)) {
    throw new Error('Invalid detail build version or date');
  }
  if (!Array.isArray(data.pages) || data.pages.length !== 10) {
    throw new Error('Expected exactly ten detail pages');
  }
  const ids = new Set();
  const routes = new Set();
  for (const page of data.pages) {
    if (!page.id || ids.has(page.id)) throw new Error(`Invalid or duplicate id: ${page.id}`);
    ids.add(page.id);
    if (!page.route || routes.has(page.route)) throw new Error(`Invalid or duplicate route: ${page.route}`);
    routes.add(page.route);
    if (approvedRoutes.get(page.id) !== page.route || page.out !== `${page.route.slice(1)}index.html`) {
      throw new Error(`Unexpected detail output path: ${page.id}`);
    }
    for (const key of ['metaTitle', 'description', 'h1', 'lead', 'sourceAction', 'contextHeading']) {
      if (typeof page[key] !== 'string' || !page[key].trim()) throw new Error(`Missing ${key}: ${page.id}`);
    }
    if (!validDate(page.dateISO) || !validLink(page.sourceHref)) throw new Error(`Invalid date or source: ${page.id}`);
    if (page.nav !== (page.kind === 'article' ? 'writings' : 'media')) throw new Error(`Invalid navigation: ${page.id}`);
    if (!Array.isArray(page.contextParas) || page.contextParas.length !== 2) throw new Error(`Missing context: ${page.id}`);
    for (const paragraph of page.contextParas) {
      if (typeof paragraph !== 'string') throw new Error(`Invalid context: ${page.id}`);
      const plain = paragraph.replace(/<a href="([^"]+)">([^<>]*)<\/a>/g, (_, href, label) => {
        if (!validLink(href, true)) throw new Error(`Unsafe context link: ${page.id}`);
        return label;
      });
      if (/[<>]/.test(plain)) throw new Error(`Only simple source links allowed in context: ${page.id}`);
    }
    for (const link of [...page.related, page.footerLeft, page.footerRight]) {
      if (!validLink(link.href, true)) throw new Error(`Invalid related link: ${page.id}`);
    }
    if (!['article', 'podcast', 'press', 'event'].includes(page.kind)) {
      throw new Error(`Invalid kind: ${page.id}`);
    }
    if (!page.visual || !(page.visual.local || page.visual.remote)) {
      throw new Error(`Missing visual: ${page.id}`);
    }
    if (!page.visual.alt?.trim() || !Number.isInteger(page.visual.width) || page.visual.width <= 0
      || !Number.isInteger(page.visual.height) || page.visual.height <= 0
      || !['image/jpeg', 'image/png', 'image/webp'].includes(page.visual.mime)) {
      throw new Error(`Invalid image metadata: ${page.id}`);
    }
    if (page.visual.remote && !validLink(page.visual.remote)) throw new Error(`Invalid remote image: ${page.id}`);
    if (page.visual.local) {
      if (!/^\/assets\/detail-pages\/[a-z0-9-]+\.(?:jpg|png|webp)$/.test(page.visual.local)) throw new Error(`Invalid image path: ${page.id}`);
      const file = page.visual.local.replace(/^\/assets\//, 'assets/');
      if (!existsSync(new URL(file, root))) throw new Error(`Missing local asset: ${file}`);
    }
    if (/[—–]/.test(JSON.stringify(page))) throw new Error(`Em/en dash found in ${page.id}`);
  }
  return data;
}

export function buildAll(data = loadDetailData()) {
  validateDetailData(data);
  const results = [];
  for (const page of data.pages) {
    const html = renderPage(page).replace(/\r\n/g, '\n');
    results.push({ page, html, out: page.out });
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = loadDetailData();
  const built = buildAll(data);
  let changed = 0;
  for (const { html, out } of built) {
    const path = new URL(out, root);
    const previous = existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null;
    if (process.argv.includes('--check')) {
      if (previous !== html) throw new Error(`Stale detail page: ${out}`);
    } else if (previous !== html) {
      writeFileSync(path, html);
      changed += 1;
    }
  }
  if (process.argv.includes('--check')) {
    console.log(`Detail pages match data/detail-pages.json (${built.length} pages).`);
  } else {
    console.log(`Rendered ${built.length} detail pages (${changed} written).`);
  }
}
