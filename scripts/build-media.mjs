import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root = new URL('../', import.meta.url);
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const dateText = date => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));

export function validateMedia(data) {
  const ids = new Set(), urls = new Set(), positions = new Set();
  for (const field of ['title','description','intro']) if (typeof data[field] !== 'string' || !data[field].trim()) throw new Error(`Missing ${field}`);
  if (!Array.isArray(data.records) || !data.records.length) throw new Error('Missing records');
  for (const r of data.records) {
    if (typeof r.id !== 'string' || !/^[a-z0-9-]+$/.test(r.id) || ids.has(r.id)) throw new Error('Invalid or duplicate id');
    ids.add(r.id);
    for (const field of ['title','description','publisher']) if (typeof r[field] !== 'string' || !r[field].trim()) throw new Error(`Missing ${field}: ${r.id}`);
    if (!['podcast','panel','photo','press'].includes(r.kind)) throw new Error(`Invalid kind: ${r.id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10)!==r.date) throw new Error(`Invalid date: ${r.id}`);
    const url = new URL(r.url);
    if (url.protocol !== 'https:' || url.username || url.password || urls.has(url.href)) throw new Error('Invalid or duplicate source URL');
    urls.add(url.href);
    if (r.summaryUrl && !/^\/writing\/[a-z0-9/-]+\/$/.test(r.summaryUrl)) throw new Error('Invalid summary path');
    if (r.image && (!(r.alt?.trim()) || new URL(r.image).protocol !== 'https:')) throw new Error('Image requires HTTPS and alt text');
    if (r.kind === 'podcast' && (!Number.isInteger(r.episode) || r.episode < 1)) throw new Error('Invalid episode number');
    if (r.duration && !/^\d{1,3}:[0-5]\d$/.test(r.duration)) throw new Error('Invalid duration');
    if (r.featuredOrder !== undefined) {
      if (!Number.isInteger(r.featuredOrder) || r.featuredOrder < 1 || r.featuredOrder > 6 || positions.has(r.featuredOrder) || !r.image) throw new Error('Featured positions must be unique, 1–6, with real imagery');
      positions.add(r.featuredOrder);
    }
    if (r.player && !['x','youtube','photo'].includes(r.player)) throw new Error('Invalid player');
    if (r.player === 'x' && !/^https:\/\/x\.com\/[^/]+\/status\/\d+$/.test(r.url)) throw new Error('Invalid X player URL');
    if (r.player === 'youtube' && !(url.hostname === 'www.youtube.com' && url.pathname === '/watch' && /^[\w-]{11}$/.test(url.searchParams.get('v') || ''))) throw new Error('Invalid YouTube player URL');
    if (r.player === 'photo' && (r.kind !== 'photo' || !r.image)) throw new Error('Photo player needs a photo');
    if (r.kind === 'photo' && (r.duration || (r.player && r.player !== 'photo'))) throw new Error('Do not label photos as recordings');
  }
  return data;
}

const summaryLink = r => r.summaryUrl ? `<a class="summary-link" href="${esc(r.summaryUrl)}">Read summary →</a>` : '';
function playerAttrs(r) {
  return r.player ? ` data-media="${r.player}" data-title="${esc(r.title)}" data-credit="${esc(r.publisher + (r.duration ? ' · '+r.duration : ''))}"` : '';
}
function feature(r) {
  const label = r.player === 'photo' ? 'View event photo' : r.player === 'youtube' ? 'Watch panel' : r.player === 'x' ? 'Watch episode' : 'Open original';
  const kind = r.kind === 'podcast' ? `${r.publisher} · Episode ${String(r.episode).padStart(2,'0')}` : r.id === 'event' ? 'GFTN · Tbilisi Finance Summit' : `${r.publisher} · ${r.kind}`;
  const format = r.kind === 'photo' ? 'Event photo' : r.player === 'x' || r.player === 'youtube' ? `Video${r.duration ? ' · '+r.duration : ''}` : r.kind;
  return `<article class="feature" data-record="${r.id}"><a class="visual"${playerAttrs(r)} href="${esc(r.url)}" aria-label="${esc(label+': '+r.title)}"><img src="${esc(r.image)}" alt="${esc(r.alt)}" width="640" height="360" loading="lazy"><span class="format">${esc(format)}</span></a><div class="feature-copy"><p class="kicker">${esc(kind)}</p><h3>${esc(r.title)}</h3><p class="summary">${esc(r.description)}</p><div class="feature-footer"><p class="date">${r.kind==='panel'?'Published ':''}<time datetime="${r.date}">${dateText(r.date)}</time></p><a class="action"${playerAttrs(r)} href="${esc(r.url)}">${label} <span aria-hidden="true">↗</span></a>${summaryLink(r)}</div></div></article>`;
}
function episode(r) {
  return `<article class="episode" data-record="${r.id}"><span class="episode-no" aria-label="Episode ${r.episode}">${String(r.episode).padStart(2,'0')}</span><div><p class="date">${esc(r.publisher)} · <time datetime="${r.date}">${dateText(r.date)}</time></p><h3><a href="${esc(r.url)}">${esc(r.title)}</a></h3><p class="summary">${esc(r.description)}</p></div><a class="action" href="${esc(r.url)}">Open on X <span aria-hidden="true">↗</span></a>${summaryLink(r)}</article>`;
}
function coverage(r) {
  return `<article data-record="${r.id}"><p class="kicker">${esc(r.publisher)} · ${r.kind === 'press' ? 'Quoted commentary' : esc(r.kind)}</p><h3><a href="${esc(r.url)}">${esc(r.title)}</a></h3><p class="summary">${esc(r.description)}</p><p class="date"><time datetime="${r.date}">${dateText(r.date)}</time></p><a class="action" href="${esc(r.url)}">${r.kind==='press'?'Read coverage':'Open original'} ↗</a>${summaryLink(r)}</article>`;
}
export function orderedRecords(data) {
  const featured = data.records.filter(r=>r.featuredOrder).sort((a,b)=>a.featuredOrder-b.featuredOrder);
  const rest = data.records.filter(r=>!r.featuredOrder).sort((a,b)=>b.date.localeCompare(a.date));
  return [...featured,...rest.filter(r=>r.kind==='podcast'),...rest.filter(r=>r.kind!=='podcast'&&r.kind!=='press'),...rest.filter(r=>r.kind==='press')];
}
export function renderMain(data) {
  validateMedia(data);
  const ordered = orderedRecords(data);
  const featured = ordered.filter(r=>r.featuredOrder);
  const podcasts = ordered.filter(r=>!r.featuredOrder&&r.kind==='podcast');
  const appearances = ordered.filter(r=>!r.featuredOrder&&r.kind!=='podcast'&&r.kind!=='press');
  const press = ordered.filter(r=>!r.featuredOrder&&r.kind==='press');
  const section = (id,title,body,extra='') => `<section class="section" id="${id}"><div class="section-head"><h2>${title}</h2>${extra}</div>${body}</section>`;
  return `<main id="main-content" class="media-archive"><section class="preview-intro"><p class="kicker">Podcasts · Panels · Press</p><h1>Media</h1><p>${esc(data.intro)}</p></section>${featured.length?`<section class="section opening" id="media"><div class="section-head"><h2 id="media-title">Featured media</h2><span>Podcasts &amp; appearances</span></div><div class="feature-grid">${featured.map(feature).join('')}</div></section>`:''}${podcasts.length?section('podcasts',featured.some(r=>r.kind==='podcast')?'More BR Labs podcasts':'BR Labs podcasts',podcasts.map(episode).join(''),'<a href="https://x.com/brlabsxyz">BR Labs on X ↗</a>'):''}${appearances.length?section('appearances','More appearances',`<div class="press-grid">${appearances.map(coverage).join('')}</div>`):''}${press.length?section('press','In the press',`<div class="press-grid">${press.map(coverage).join('')}</div>`,'<span>Selected coverage</span>'):''}
<aside class="archive-context" aria-labelledby="context-title"><h2 id="context-title">Media appearances &amp; podcasts</h2><div><p>Explore BR Labs podcasts, panel discussions and selected press coverage featuring Rezo Shmertz, founder, investor and researcher. The collection brings together BR Labs episodes and appearances at industry events, alongside commentary published by other outlets.</p><p>Topics include Bitcoin, stablecoins, decentralized finance and AI, with discussions of how financial infrastructure, institutional adoption and incentives shape crypto markets. Each entry links to the original recording, publisher or event gallery, so you can watch, listen or read in context.</p><p>For a deeper look at these subjects, browse Rezo’s <a href="/writing/">essays on crypto markets and AI</a> and <a href="/research/">research</a>. The <a href="/about/">About page</a> provides background on the company building and investing behind this work.</p></div></aside></main>`;
}
export function buildMedia(html,data) {
  validateMedia(data);
  const dialog = html.match(/<dialog\b[\s\S]*?<\/dialog>/)?.[0];
  if (!dialog || (html.match(/<main\b/g)||[]).length !== 1) throw new Error('Unexpected Media shell; inspect before rebuilding');
  let result = html.replace(/<main\b[\s\S]*?<\/main>/,()=>renderMain(data));
  // Keep the approved shared dialog outside the page layout; do not duplicate it on rebuild.
  if (!result.includes('<dialog')) result = result.replace('</main>',()=>`</main><div class="editorial-additions">${dialog}</div>`);
  result = result.replace(/<title>[\s\S]*?<\/title>/,()=>`<title>${esc(data.title)}</title>`);
  for (const name of ['description','og:description','twitter:description','og:title','twitter:title']) {
    const attr = name.startsWith('og:') ? 'property' : 'name';
    result = result.replace(new RegExp(`<meta content="[^"]*" ${attr}="${name}"\\s*/?>`),()=>`<meta content="${esc(name.endsWith('title')?data.title:data.description)}" ${attr}="${name}"/>`);
  }
  const schema = {'@context':'https://schema.org','@type':'CollectionPage','@id':'https://rezoshmertz.com/media/#webpage',url:'https://rezoshmertz.com/media/',name:data.title,description:data.description,about:{'@id':'https://rezoshmertz.com/about/#rezo-shmertz'},mainEntity:{'@type':'ItemList',numberOfItems:data.records.length,itemListElement:orderedRecords(data).map((r,i)=>({'@type':'ListItem',position:i+1,name:r.title,url:r.url}))}};
  result = result.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,()=>`<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>`);
  if (!result.includes('/assets/media-archive.css')) result = result.replace('</head>','<link rel="stylesheet" href="/assets/media-archive.css"/></head>');
  result = result.replace('src="/assets/media.js"','src="/assets/media-archive.js"');
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const page = new URL('media/index.html',root);
  const data = JSON.parse(readFileSync(new URL('data/media.json',root),'utf8'));
  const original = readFileSync(page,'utf8').replace(/\r\n/g,'\n');
  const html = buildMedia(original,data);
  if (process.argv.includes('--check')) {
    if (html !== original) throw new Error('Media HTML is stale; run node scripts/build-media.mjs');
    console.log('Media content and structured data match the source list.');
  } else {writeFileSync(page,html);console.log(`Rendered ${data.records.length} verified Media entries.`);}
}
