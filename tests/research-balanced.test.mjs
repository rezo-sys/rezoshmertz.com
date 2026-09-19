import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = read('research/index.html');
const css = read('assets/research-balanced.css');
const hash = (value) => createHash('sha256').update(value).digest('hex');

const INTRO =
  'Explore Bitcoin cycle timing, drawdown context and indicator-based phase estimates. Use the dashboard to compare scenarios, not to predict the next market turn.';

const DESK_BASELINE =
  '<section aria-labelledby="bitcoin-cycle-heading" class="live-research-desk">\n' +
  '<header class="live-research-header"><div><span class="eyebrow">External research tool</span><h2 id="bitcoin-cycle-heading">Bitcoin Cycle Tracker</h2></div><span class="live-research-signal">Snapshot data · external dashboard</span><a class="text-action" href="https://btc-dashboard-9307b.web.app/?mode=dark&amp;style=institutional&amp;page=forecast" rel="noopener noreferrer" target="_blank">OPEN DASHBOARD ↗</a></header><p class="dashboard-help">The embedded tool may take a moment to load. If it stays blank or is unavailable here, open the dashboard directly above.</p>\n' +
  '<div class="live-research-viewport">\n' +
  '<iframe class="live-research-frame" loading="eager" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups" src="https://btc-dashboard-9307b.web.app/?mode=dark&amp;style=institutional&amp;page=forecast" title="Bitcoin cycle research dashboard"></iframe>\n' +
  '</div>\n' +
  '<footer class="live-research-footer"><span>Interactive scenario system · Not a forecast</span><a href="https://btc-dashboard-9307b.web.app/?mode=dark&amp;style=institutional&amp;page=forecast" rel="noopener noreferrer" target="_blank">OPEN DASHBOARD ↗</a></footer>\n' +
  '</section>';

const DESK_HASH = 'b87e32f3d24007c35fd13c268d594b21f6f844847d7faa29dd288408b2a43a7e';

function extractDesk(source) {
  const start = source.indexOf('<section aria-labelledby="bitcoin-cycle-heading" class="live-research-desk">');
  assert.notEqual(start, -1);
  const end = source.indexOf('</section>', start) + '</section>'.length;
  return source.slice(start, end);
}

test('live research desk remains byte-identical to the pre-edit baseline', () => {
  const desk = extractDesk(html);
  assert.equal(desk, DESK_BASELINE);
  assert.equal(hash(desk), DESK_HASH);
  assert.match(desk, /sandbox="allow-scripts allow-same-origin allow-popups"/);
  assert.match(desk, /src="https:\/\/btc-dashboard-9307b\.web\.app\/\?mode=dark&amp;style=institutional&amp;page=forecast"/);
  assert.match(desk, /title="Bitcoin cycle research dashboard"/);
  assert.match(desk, /class="live-research-header"/);
  assert.match(desk, /class="dashboard-help"/);
  assert.match(desk, /class="live-research-footer"/);
});

test('shared chrome, btc script and data hooks stay intact', () => {
  assert.equal(
    hash(html.slice(html.indexOf('<header class="site-header">'), html.indexOf('</header>') + '</header>'.length)),
    'da7419577d31124175abeeecda1ba1d0145adfd1288ca0eb61514172c10f62cf',
  );
  assert.equal(
    hash(html.slice(html.indexOf('<footer class="site-footer">'), html.indexOf('</footer>', html.indexOf('<footer class="site-footer">')) + '</footer>'.length)),
    '35269686b46e1336e7f36646a8e057769482a6e1d522b0244ba623c9c7332f28',
  );
  assert.deepEqual(
    [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ['/assets/about-nav.js?v=20260906-final', '/mockups/btc-live.js?v=20260906-snapshot'],
  );
  const fields = [...html.matchAll(/data-btc-field="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(fields, [
    'calendarDate',
    'cycleDay',
    'daysLeft',
    'drawdown',
    'drawdownNote',
    'phase',
    'price',
    'priceNote',
    'sourceNote',
    'status',
    'updatedDate',
  ]);
  assert.match(html, /datetime="2026-08-10T15:11:04\.060Z"/);
  assert.match(html, /<span hidden data-btc-field="daysLeft">/);
  assert.doesNotMatch(html, /class="sr-only"[^>]*data-btc-field="daysLeft"|data-btc-field="daysLeft"[^>]*class="sr-only"/);
  assert.match(html, /<p class="rb-source" data-btc-field="sourceNote" role="status">/);
  const aboutSnapshot = html.match(/<details class="rb-about-snapshot">[\s\S]*?<\/details>/)[0];
  assert.doesNotMatch(aboutSnapshot, /data-btc-field=/);
  assert.ok(html.indexOf('</details>\n</div>\n<p class="rb-source" data-btc-field="sourceNote"') > -1);
  assert.doesNotMatch(html, /\$81,792|-35\.1%|>349</);
});

test('approved flagship copy, disclosure, figure rows and no inline images', () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<h1>Bitcoin Cycle Tracker<\/h1>/);
  assert.ok(html.includes(INTRO));
  assert.match(html, /<details class="rb-about-snapshot">/);
  assert.match(html, /<summary>About this snapshot<\/summary>/);
  assert.match(html, /The phase reflects several indicators, not cycle day alone\./);
  assert.match(html, /Elapsed days are context, not a countdown to a market turn\./);
  assert.match(html, /Market observations can have different dates\./);
  assert.match(html, /<h3>Indicators<\/h3>/);
  assert.match(html, /<h3>Calendar<\/h3>/);
  assert.match(html, /<h3>Dates<\/h3>/);
  assert.match(html, />01</);
  assert.match(html, />02</);
  assert.match(html, />03</);
  assert.doesNotMatch(html, /<img\b/);
  assert.doesNotMatch(html, /src="\/btc-cycle-(?:map|scenarios)-2026-07-15\.jpg"/);
  assert.match(
    html,
    /aria-label="View Bitcoin cycle roadmap figure"[^>]*href="\/btc-cycle-map-2026-07-15\.jpg"/,
  );
  assert.match(
    html,
    /aria-label="View Scenario comparison figure"[^>]*href="\/btc-cycle-scenarios-2026-07-15\.jpg"/,
  );
  assert.match(html, /Bitcoin cycle roadmap/);
  assert.match(html, /Scenario comparison/);
  assert.equal((html.match(/View figure ↗/g) || []).length, 2);
  assert.match(
    html,
    /The Bitcoin Cycle Tracker brings historical timing, drawdown context and indicator-based phase estimates into one research page\. These measures offer different perspectives on market conditions; none should be read as a prediction on its own\./,
  );
  assert.match(
    html,
    /This is part of Rezo Shmertz’s wider research into money, technology and incentives\. Explore the original figures above or continue to the AI Money study\./,
  );
  assert.match(html, /href="\/research\/ai-money\/">Explore AI Money research →<\/a>/);
  assert.doesNotMatch(html, /—|ILLUSTRATIVE VALUES|EXISTING DASHBOARD SECTION|phase badge|rounded-full/);
});

test('SEO names stay consistent while canonical URLs and dates are preserved', () => {
  const title = 'Bitcoin Cycle Tracker: Timing, Drawdowns &amp; Scenarios | Rezo Shmertz';
  assert.ok(html.includes(`<title>${title}</title>`));
  assert.ok(html.includes(`content="${title}" property="og:title"`));
  assert.ok(html.includes(`content="${title}" name="twitter:title"`));
  assert.ok(html.includes(`content="${title}" property="og:image:alt"`));
  assert.ok(html.includes(`content="${title}" name="twitter:image:alt"`));
  assert.ok(html.includes(`content="${INTRO}" name="description"`));
  assert.ok(html.includes(`content="${INTRO}" property="og:description"`));
  assert.ok(html.includes(`content="${INTRO}" name="twitter:description"`));
  assert.ok(html.includes('href="https://rezoshmertz.com/research/" rel="canonical"'));
  assert.ok(html.includes('content="https://rezoshmertz.com/og/research.png" property="og:image"'));
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  const page = graph.find((node) => node['@type'] === 'WebPage');
  const article = graph.find((node) => node['@type'] === 'Article');
  assert.equal(page.url, 'https://rezoshmertz.com/research/');
  assert.equal(page.name, 'Bitcoin Cycle Tracker: Timing, Drawdowns & Scenarios | Rezo Shmertz');
  assert.equal(article.headline, 'Bitcoin Cycle Tracker: Timing, Drawdowns & Scenarios');
  assert.equal(page.description, INTRO);
  assert.equal(article.description, INTRO);
  assert.equal(page.datePublished, '2026-07-15');
  assert.equal(page.dateModified, '2026-08-10');
  assert.equal(article.datePublished, '2026-07-15');
  assert.equal(article.dateModified, '2026-08-10');
  assert.equal(page.primaryImageOfPage.url, 'https://rezoshmertz.com/og/research.png');
});

test('stylesheet is page-scoped and never targets the live desk or shared chrome', () => {
  assert.ok(html.indexOf('/assets/research-balanced.css') < html.indexOf('</head>'));
  assert.match(html, /class="page-shell research-balanced"/);
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of withoutComments.matchAll(/([^{}]+)\{/g)) {
    const block = match[1].trim();
    if (block.startsWith('@media')) continue;
    for (const selector of block.split(',')) {
      const part = selector.trim();
      assert.ok(part.startsWith('.research-balanced'), part);
      assert.doesNotMatch(part, /live-research|site-header|site-footer|page-shell\b|primary-nav/);
    }
  }
  assert.doesNotMatch(css, /live-research|\.site-header|\.site-footer|iframe/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 3fr\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /clamp\(1\.75rem, 3\.2vw, 48px\)/);
  assert.match(css, /max-width: 75ch/);
  assert.match(css, /\.rb-phase/);
  assert.match(css, /\.rb-figure-row/);
  assert.doesNotMatch(css, /\.rb-figure img|border-radius:\s*999|pill/);
});
