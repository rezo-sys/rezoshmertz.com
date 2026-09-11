import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { activeSection, initArchive } from '../assets/writing-archive.mjs';

const html = readFileSync(new URL('../writing/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = readFileSync(new URL('../assets/writing-archive.css', import.meta.url), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const decode = text => text.replace(/&(amp|quot|lt|gt|#39);/g, (_, entity) => ({amp:'&',quot:'"',lt:'<',gt:'>', '#39':"'"})[entity]);
const rows = [...html.matchAll(/<article class="entry\b[^>]*>([\s\S]*?)<\/article>/g)].map(match => match[1]);
const records = rows.map(row => ({
  date: row.match(/datetime="([^"]+)"/)[1],
  title: decode(row.match(/<h3><a[^>]*>(.*?)<\/a><\/h3>/)[1]),
  url: decode(row.match(/<h3><a href="([^"]+)"/)[1]),
  excerpt: decode(row.match(/<p class="excerpt">(.*?)<\/p>/)[1]),
}));

test('all 18 approved records retain exact dates, titles, sources and excerpts', () => {
  assert.equal(records.length, 18);
  assert.equal(new Set(records.map(record => record.url)).size, 18);
  // Independently frozen from the approved preview records, not generated from this HTML.
  assert.equal(hash(JSON.stringify(records)), '7b26b8f4035e1961e1bf1dbb8d561f7c16edf537b756cf4ecad5510c62ab736b');
  assert.ok(records.every(record => Array.from(record.excerpt).length <= 400 && record.excerpt.endsWith('…')));
  assert.match(html, /From the essay’s conclusion/);
});

test('approved shell is unchanged; preview scaffolding is absent', () => {
  assert.equal(hash(html.match(/<header class="site-header">[\s\S]*?<\/header>/)[0]), 'e126b3d88611140337c758a66c96c8fa854090fcb47b532d3bd0ac3ca28da7c8');
  assert.equal(hash(html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0]), '35269686b46e1336e7f36646a8e057769482a6e1d522b0244ba623c9c7332f28');
  assert.doesNotMatch(html, /noindex|Local preview|127\.0\.0\.1|archive-refinements|Think in public|—/);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  assert.match(html, /Essays on Bitcoin, crypto markets and AI, exploring how money works, where market advantages come from and what makes financial systems trustworthy\./);
});

test('schema follows visible archive, and indexable canonical metadata is consistent', () => {
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])['@graph'];
  const collection = graph.find(item => item['@type'] === 'CollectionPage');
  assert.deepEqual(collection.mainEntity.itemListElement.map(({name,url}) => ({name,url})), records.map(({title,url}) => ({name:title,url})));
  assert.equal(collection.name, decode(html.match(/<title>(.*?)<\/title>/)[1]));
  assert.equal(collection.description, decode(html.match(/<meta content="([^"]+)" name="description"/)[1]));
  assert.match(html, /href="https:\/\/rezoshmertz\.com\/writing\/" rel="canonical"/);
  assert.match(html, /content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" name="robots"/);
});

test('year groups, source links and legacy anchors remain usable without scripts', () => {
  assert.deepEqual([...html.matchAll(/<section class="year-group" id="([^"]+)"/g)].map(match=>match[1]), ['year-2026','year-2025','year-2024','year-2023']);
  assert.match(html, /2023 &amp; earlier/);
  assert.match(html, /id="year-2020"/);
  assert.match(html, /datetime="2020-01-09"/);
  for (const id of ['conversations','press','appearances']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /href="\/media\/"/);
  assert.equal(rows.length, 18);
});

test('archive CSS is page scoped, supports wrapping and does not conceal excerpts', () => {
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)) {
    if (match[1].trim().startsWith('@media')) continue;
    for (const selector of match[1].split(',')) assert.ok(selector.trim().startsWith('.writing-archive'), selector);
  }
  assert.match(css, /flex-wrap: wrap/);
  assert.doesNotMatch(css, /line-clamp|text-overflow|overflow: hidden/);
});

test('active section follows forward/backward scroll, bottom, and empty input', () => {
  assert.equal(activeSection([0, 600, 1200, 1800], 48), 0);
  assert.equal(activeSection([-650, -50, 550, 1150], 48), 1);
  assert.equal(activeSection([-1300, -700, -100, 500], 48), 2);
  assert.equal(activeSection([-650, -50, 550, 1150], 48), 1);
  assert.equal(activeSection([0, 600, 1200, 1800], 48, true), 3);
  assert.equal(activeSection([], 48), -1);
  assert.equal(activeSection([-600, 81.421875, 700], 81), 1);
  assert.equal(activeSection([-600, 83, 700], 81), 0);
});

test('scroll enhancement coalesces events and supports browsers without ResizeObserver', () => {
  let tops = [0, 600, 1200, 1800];
  const callbacks = new Map();
  const frames = [];
  const links = tops.map((_, i) => ({hash:`#year-${i}`, attributes:{}, setAttribute(key,value){this.attributes[key]=value;}, removeAttribute(key){delete this.attributes[key];}}));
  const nav = {querySelectorAll:()=>links, getBoundingClientRect:()=>({height:101})};
  const properties = {};
  const root = {style:{setProperty:(key,value)=>properties[key]=value}, ownerDocument:{documentElement:{scrollHeight:2500}}, querySelector:selector=>selector==='.year-nav' ? nav : {getBoundingClientRect:()=>({top:tops[Number(selector.slice(-1))]})}};
  const win = {scrollY:0, innerHeight:800, matchMedia:()=>({matches:true}), addEventListener:(event,callback)=>callbacks.set(event,callback), requestAnimationFrame:callback=>frames.push(callback)};
  initArchive(root, win);
  assert.equal(links[0].attributes['aria-current'], 'location');
  assert.equal(properties['--archive-reading-offset'], '125px');
  tops = [-600, 0, 600, 1200];
  callbacks.get('scroll')(); callbacks.get('scroll')(); callbacks.get('resize')();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(links[0].attributes['aria-current'], undefined);
  assert.equal(links[1].attributes['aria-current'], 'location');
  win.scrollY = 1700;
  callbacks.get('scroll')(); frames.shift()();
  assert.equal(links[3].attributes['aria-current'], 'location');
  assert.doesNotThrow(()=>initArchive(null, win));
});
