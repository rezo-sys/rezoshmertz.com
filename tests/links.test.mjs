import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = 'https://rezoshmertz.com/';
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['.git', 'tests'].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [relative(root, path).split(sep).join('/')];
  });
}
const paths = new Set(files(root));
const html = new Map([...paths].filter(p => p.endsWith('.html')).map(p => [p, readFileSync(resolve(root, p), 'utf8')]));
const failures = [];
let checked = 0;
for (const [path, source] of html) {
  const base = new URL(path.replace(/index\.html$/, ''), site);
  for (const match of source.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), base);
    if (url.origin !== new URL(site).origin) continue;
    const pathname = decodeURIComponent(url.pathname).slice(1);
    const target = paths.has(pathname) ? pathname : `${pathname.replace(/\/$/, '')}${pathname ? '/' : ''}index.html`;
    checked++;
    if (!paths.has(target)) {
      failures.push(`${path}: missing ${url.pathname}`);
    } else if (url.hash && html.has(target)) {
      const id = decodeURIComponent(url.hash.slice(1));
      const ids = [...html.get(target).matchAll(/\b(?:id|name)\s*=\s*["']([^"']*)["']/gi)].map(m => m[1]);
      if (!ids.includes(id)) failures.push(`${path}: missing anchor ${url.pathname}${url.hash}`);
    }
  }
  // Keep structured data parseable and avoid reintroducing the retired summit URLs.
  for (const match of source.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    assert.doesNotThrow(() => JSON.parse(match[1]), `Invalid structured data in ${path}`);
  }
  assert.ok(!source.includes('https://tbilisifinancesummit.gftn.co/'), `Retired summit link in ${path}`);
}
assert.deepEqual(failures, [], failures.join('\n'));
const appearance = html.get('writing/appearances/stablecoins-tbilisi-finance-summit/index.html');
assert.match(appearance, /<figure class="appearance-photo">/);
assert.match(appearance, /width="800" height="533"/);
assert.match(appearance, /View GFTN event recap/);
assert.match(appearance, /not a recording or transcript/);
console.log(`PASS: ${checked} internal href/src references across ${html.size} HTML pages; anchors, structured data and event source regressions.`);
console.log('External availability is checked separately; this offline test does not certify third-party uptime.');
