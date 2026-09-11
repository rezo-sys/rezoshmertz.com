import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {buildMedia, renderMain, orderedRecords, validateMedia} from '../scripts/build-media.mjs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const html = read('media/index.html'), css = read('assets/media-archive.css');
const script = read('assets/media-archive.js'), data = JSON.parse(read('data/media.json'));
const hash = text => createHash('sha256').update(text).digest('hex');
const clone = () => structuredClone(data);

test('11 reviewed Media records preserve approved sources, copy and UTC dates', () => {
  assert.equal(data.records.length,11);
  assert.equal(hash(JSON.stringify(data.records)),'f1632d6689c960878a4daad7ff511a5d9e0e71ba94d91025a913bdcbf5dcbc12');
  assert.equal(data.intro,'Alongside his work at BR Labs, Rezo Shmertz participates in industry panels and contributes commentary on crypto markets, investing and financial technology. This page brings together podcast episodes, public appearances and press coverage of that work.');
  assert.equal(data.records.filter(r=>r.summaryUrl).length,6);
  assert.equal(data.records.find(r=>r.id==='ep03').date,'2026-07-13');
});

test('build is deterministic and schema exactly follows the static visible list', () => {
  assert.equal(buildMedia(html,data),html);
  assert.equal((html.match(/<dialog\b/g)||[]).length,1);
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(schema['@type'],'CollectionPage');
  assert.equal(schema.mainEntity.numberOfItems,11);
  assert.deepEqual(schema.mainEntity.itemListElement.map(r=>[r.name,r.url]),orderedRecords(data).map(r=>[r.title,r.url]));
  assert.deepEqual([...html.matchAll(/data-record="([^"]+)"/g)].map(m=>m[1]),orderedRecords(data).map(r=>r.id));
  assert.equal(schema.description,data.description);
});

test('original shell and homepage player are unchanged, with no preview residue', () => {
  assert.equal(hash(html.match(/<header class="site-header">[\s\S]*?<\/header>/)[0]),'36d55ea4c2ee97f5a2cbf65b06191b46b6e8504deb295ecc2107bce4d940dbc4');
  assert.equal(hash(html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0]),'35269686b46e1336e7f36646a8e057769482a6e1d522b0244ba623c9c7332f28');
  assert.equal(hash(read('assets/media.js')),'d46be753b158de3ff6dbeb5ac5d21437a3f744b28a582015518f8f0f718367d1');
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.doesNotMatch(html,/noindex|127\.0\.0\.1|Local preview|—/);
  assert.match(html,/href="https:\/\/rezoshmertz\.com\/media\/" rel="canonical"/);
  assert.match(html,/src="\/assets\/media-archive.js"/);
  assert.doesNotMatch(html,/src="\/assets\/media.js"/);
});

test('all new styles are page scoped and responsive', () => {
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)) {
    if (match[1].trim().startsWith('@media')) continue;
    for (const selector of match[1].split(',')) assert.ok(selector.trim().startsWith('.media-archive'),selector);
  }
  assert.match(css,/min-height:44px/);
  assert.match(css,/max-width:620px/);
  assert.match(css,/max-width:900px/);
});

test('invalid records fail rather than silently shipping broken or unsafe content', () => {
  for (const mutate of [
    d=>d.records.push({...d.records[0]}),
    d=>d.records[0].id=undefined,
    d=>d.records[0].url='javascript:alert(1)',
    d=>d.records[0].date='2026-02-30',
    d=>d.records[0].featuredOrder=7,
    d=>d.records[0].image=undefined,
    d=>d.records[0].alt='',
    d=>d.records[0].summaryUrl='//example.com/',
    d=>d.records[0].duration='23:99',
    d=>d.records.find(r=>r.kind==='photo').duration='01:30',
    d=>d.records[0].player='iframe',
  ]) {
    const changed=clone(); mutate(changed);
    assert.throws(()=>validateMedia(changed));
  }
});

test('future curated entries render once, with dynamic sources and escaped text', () => {
  const changed=clone();
  changed.records.push({...changed.records[0],id:'ep08',episode:8,featuredOrder:4,date:'2026-09-12',url:'https://x.com/brlabsxyz/status/9999999999999999999',title:'<script> & "new"'});
  const output=renderMain(changed);
  assert.equal((output.match(/data-record="ep08"/g)||[]).length,1);
  assert.match(output,/&lt;script&gt; &amp; &quot;new&quot;/);
  assert.match(output,/data-media="x"/);
  assert.match(output,/status\/9999999999999999999/);
  assert.doesNotMatch(output,/<script>/);
});

function runtime(kind='youtube', options={}) {
  const node = () => ({children:[],events:{},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(key,value){this[key]=value;},addEventListener(name,fn){this.events[name]=fn;},remove(){this.removed=true;},focus(){this.focused=true;}});
  const selectors=Object.fromEntries(['#media-dialog','#player-area','#dialog-title','#media-source-link','#media-credit','#player-help','.close-media'].map(s=>[s,node()]));
  const dialog=selectors['#media-dialog'];
  dialog.querySelector=s=>selectors[s];
  dialog.showModal=options.noModal?undefined:()=>{dialog.open=true;};
  dialog.close=()=>{dialog.open=false;dialog.events.close();};
  const thumb={src:'https://example.com/verified-photo.jpg',alt:'Event photograph'};
  const link=Object.assign(node(),{dataset:{media:kind,title:'Verified title',credit:'Publisher'},href:kind==='x'?'https://x.com/brlabsxyz/status/9999999999999999999':kind==='photo'?'https://www.linkedin.com/posts/example':'https://www.youtube.com/watch?v=OH33Er6q3KA',closest:()=>({querySelector:()=>thumb})});
  const classes=new Set(), timers=new Map(); let timerId=0;
  const head=node();
  const document={head,querySelector:s=>selectors[s],querySelectorAll:()=>[link],createElement:tag=>Object.assign(node(),{tag}),body:{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}}};
  const window=options.window||{};
  runInNewContext(script,{document,window,URL,Promise,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
  const click=async (extra={})=>{const event={button:0,preventDefault(){this.prevented=true;},...extra};await link.events.click(event);return event;};
  return {selectors,dialog,link,click,classes,timers,head};
}

test('YouTube uses the approved source; closing removes player and restores focus', async () => {
  const r=runtime(); const event=await r.click();
  assert.equal(event.prevented,true);
  assert.equal(r.selectors['#player-area'].children[0].src,'https://www.youtube-nocookie.com/embed/OH33Er6q3KA?playsinline=1&rel=0');
  assert.equal(r.selectors['#media-source-link'].href,r.link.href);
  r.dialog.close();
  assert.equal(r.selectors['#player-area'].children.length,0);
  assert.equal(r.link.focused,true);
  assert.equal(r.classes.size,0);
});

test('photos remain photos; modified clicks and unsupported dialogs retain navigation', async () => {
  const photo=runtime('photo'); await photo.click();
  assert.equal(photo.selectors['#player-area'].children[0].tag,'img');
  assert.equal(photo.selectors['#player-help'].hidden,true);
  for (const key of ['ctrlKey','metaKey','shiftKey','altKey']) {
    const r=runtime(); assert.equal((await r.click({[key]:true})).prevented,undefined); assert.equal(r.dialog.open,undefined);
  }
  assert.equal((await runtime('youtube',{noModal:true}).click()).prevented,undefined);
});

test('X embeds use the selected record ID; unavailable players keep original-source fallback', async () => {
  let actualId;
  const r=runtime('x',{window:{twttr:{widgets:{createTweet:async id=>{actualId=id;return {};}}}}});
  await r.click(); assert.equal(actualId,'9999999999999999999'); assert.equal(r.timers.size,0);
  const failed=runtime('x',{window:{twttr:{widgets:{createTweet:async()=>{throw new Error('blocked');}}}}});
  await failed.click();
  assert.match(failed.selectors['#player-area'].children[0].textContent,/original source/);
  assert.equal(failed.selectors['#media-source-link'].href,failed.link.href);
  assert.equal(failed.timers.size,0);
});

test('late X completion cannot repopulate a closed modal', async () => {
  let resolveTweet, started;
  const hasStarted=new Promise(resolve=>{started=resolve;});
  const r=runtime('x',{window:{twttr:{widgets:{createTweet:()=>new Promise(resolve=>{resolveTweet=resolve;started();})}}}});
  const pending=r.click(); await hasStarted;
  r.dialog.close(); resolveTweet({}); await pending;
  assert.equal(r.selectors['#player-area'].children.length,0);
  assert.equal(r.timers.size,0);
});

test('literal dollar tokens in source text never act as replacement instructions', () => {
  const changed=clone();
  const literal="Literal $& $` $' $$ <value>";
  changed.title=literal; changed.description=literal; changed.intro=literal;
  changed.records[0].title=literal; changed.records[0].description=literal;
  const output=buildMedia(html,changed);
  assert.equal((output.match(/<main\b/g)||[]).length,1);
  assert.equal((output.match(/<dialog\b/g)||[]).length,1);
  assert.match(output,/Literal \$&amp; \$` \$' \$\$ &lt;value&gt;/);
  const schema=JSON.parse(output.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(schema.name,literal);
  assert.equal(schema.description,literal);
  assert.equal(schema.mainEntity.itemListElement[0].name,literal);
  assert.equal(buildMedia(output,changed),output);
});
