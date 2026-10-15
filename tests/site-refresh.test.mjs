import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('company updates retain four cards and distinguish current Axis Eight work', () => {
  const build=read('what-i-build/index.html'), about=read('about/index.html');
  assert.equal((build.match(/class="bento-card company-card"/g)||[]).length,4);
  assert.match(build,/Founder · Research and engineering/);
  assert.match(build,/Co-founder · Quantitative trading/);
  assert.doesNotMatch(build,/Financial software|Research platform/);
  for(const html of [build,about]){
    assert.match(html,/building Axis Eight, a planned digital-asset management business/);
    assert.match(html,/spkr12835-rezo-shmertz/);
    assert.match(html,/BRRRolver, a solver for CoW Protocol auctions/);
  }
  for(const url of ['https://brlabsxyz.substack.com/','https://solv.brlabs.xyz/']) assert.ok(build.includes(url));
});

test('local essay overviews supplement rather than replace original sources', () => {
  const archive=read('writing/index.html'), home=read('index.html');
  const pages=JSON.parse(read('data/detail-pages.json')).pages.filter(p=>p.kind==='article');
  assert.equal(pages.length,4);
  for(const page of pages)assert.ok(archive.includes('href="'+page.route+'">Read overview →'));
  assert.equal((archive.match(/>Read overview →/g)||[]).length,4);
  assert.equal((home.match(/>Read overview →/g)||[]).length,3);
  assert.equal((archive.match(/class="excerpt"/g)||[]).length,18);
});

test('Media has its own correctly dimensioned sharing image', () => {
  const html=read('media/index.html');
  assert.match(html,/content="https:\/\/rezoshmertz.com\/og\/media.png" property="og:image"/);
  assert.match(html,/content="https:\/\/rezoshmertz.com\/og\/media.png" name="twitter:image"/);
  const image=readFileSync(new URL('../og/media.png',import.meta.url));
  assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.deepEqual([image.readUInt32BE(16),image.readUInt32BE(20)],[1600,900]);
});

test('static recovery aliases are noindex with canonical and visible destination links', () => {
  for(const [file,path] of [['writings/index.html','/writing/'],['research/btc-cycle/index.html','/research/']]){
    const html=read(file);
    assert.match(html,/noindex/);
    assert.match(html,/http-equiv="refresh"/i);
    assert.ok(html.includes('https://rezoshmertz.com'+path));
    assert.ok(html.includes('href="'+path+'"'));
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
  }
});

test('page maintenance dates do not redate the dataset or misattribute new feed sources', () => {
  const html=read('research/ai-money/index.html');
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  assert.equal(graph.find(n=>n['@type']==='WebPage').dateModified,'2026-09-11');
  assert.equal(graph.find(n=>n['@type']==='Dataset').dateModified,'2026-08-10');
  const entries=read('feed.xml').match(/<entry>[\s\S]*?<\/entry>/g);
  for(const [route,author] of [
    ['desk-building-partners-capital-discipline','BR Labs'],
    ['solvers-intents-alex-vinyas','BR Labs'],
    ['tokenized-securities-ownership','Bridgit Murphy'],
    ['confidential-computing-enterprise-ai','Carl Williams'],
  ]){
    const entry=entries.find(e=>e.includes('/'+route+'/</id>'));
    assert.ok(entry,route);assert.ok(entry.includes('<author><name>'+author+'</name>'));
  }
});
