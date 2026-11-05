import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const MAILTO = 'mailto:rezoassistant@gmail.com?subject=Request%20supporting%20documentation';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const legal = read('legal-context/index.html');
const contact = read('contact/index.html');
const sitemap = read('sitemap.xml');
const hash = value => createHash('sha256').update(value).digest('hex');

const LEGAL_TITLE = 'Rezo Shmertz | Legal context and supporting records';
const LEGAL_DESC = "Court records and legal context concerning Rezo (Revaz) Shmertz, including an ECHR judgment, defense counsel's assessment and supporting documentation.";
const CONTACT_TITLE = 'Request supporting documentation | Rezo Shmertz';
const CONTACT_DESC = 'Please briefly describe your request and the context in which the information will be used. If you already have my contact details, you are welcome to reach out to me directly.';

test('legal page keeps approved metadata, robots, and exact article markup', () => {
  assert.ok(legal.includes(`<title>${LEGAL_TITLE}</title>`));
  assert.ok(legal.includes('href="https://rezoshmertz.com/legal-context/" rel="canonical"'));
  assert.ok(legal.includes(`content="${LEGAL_DESC}" name="description"`));
  assert.ok(legal.includes('content="index,follow" name="robots"'));
  assert.ok(legal.includes(`content="${LEGAL_TITLE}" property="og:title"`));
  assert.ok(legal.includes('content="https://rezoshmertz.com/legal-context/" property="og:url"'));
  assert.doesNotMatch(legal, /application\/ld\+json|noindex|preview|127\.0\.0\.1|file:|<!--/);
  const article = legal.match(/<article class="legal-article"[\s\S]*?<\/article>/)[0];
  assert.equal(hash(article), 'f857a6bd3678938966b778d54ffb24e4ead69f477b336a4232231a9b4dc333e7');
  assert.equal((article.match(/<h1\b/g) || []).length, 1);
  assert.equal((article.match(/<h2\b/g) || []).length, 7);
  assert.equal((article.match(/<h3\b/g) || []).length, 5);
  assert.equal((article.match(/<li>/g) || []).length, 4);
  assert.match(article, /<blockquote>[\s\S]*?<\/blockquote>\s*<figcaption><strong>— Anatoly Kleymenov/);
  assert.ok(article.includes(`href="${MAILTO}" class="request-button"`));
  assert.match(sitemap, /<loc>https:\/\/rezoshmertz.com\/legal-context\/<\/loc><lastmod>2026-11-05<\/lastmod>/);
});

test('contact page offers direct email with a visible fallback and no submission service', () => {
  assert.ok(contact.includes(`<title>${CONTACT_TITLE}</title>`));
  assert.ok(contact.includes('href="https://rezoshmertz.com/contact/" rel="canonical"'));
  assert.ok(contact.includes(`content="${CONTACT_DESC}" name="description"`));
  assert.ok(contact.includes('content="index,follow" name="robots"'));
  assert.doesNotMatch(contact, /noindex|http-equiv="refresh"|application\/ld\+json|<!--/);
  assert.doesNotMatch(contact, /<form\b|<input\b|<textarea\b|document-request\.js|formspree|formsubmit|received|role="status"/i);
  assert.ok(contact.includes('<p class="email-fallback">Email: '));
  assert.ok(contact.includes('>rezoassistant@gmail.com</a>'));
  assert.match(contact, /href="\/legal-context\/"/);
  assert.match(sitemap, /<loc>https:\/\/rezoshmertz.com\/contact\/<\/loc><lastmod>2026-11-05<\/lastmod>/);
  assert.equal(existsSync(new URL('../assets/document-request.js', import.meta.url)), false);
  for (const page of [legal, contact]) {
    const mailtos = [...page.matchAll(/href="(mailto:[^"]+)"/g)].map(match => new URL(match[1]));
    assert.ok(mailtos.length > 0);
    for (const url of mailtos) {
      assert.equal(decodeURIComponent(url.pathname), 'rezoassistant@gmail.com');
      assert.deepEqual([...url.searchParams], [['subject', 'Request supporting documentation']]);
      assert.equal(url.hash, '');
    }
  }
});
