import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const code=fs.readFileSync(path.join(base,'../assets/hero-motion.js'),'utf8');
const html=fs.readFileSync(path.join(base,'../index.html'),'utf8');
const original=fs.readFileSync(path.join(base,'../mockups/bento-site.js'),'utf8');
const actualPhrases=[...code.match(/const phrases = \[(.*?)\]/)[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
const sourcePhrases=[...original.match(/const phrases = \[(.*?)\]/)[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
class Events {
 constructor(){this.listeners=new Map();}
 addEventListener(type,fn){const list=this.listeners.get(type)??[];list.push(fn);this.listeners.set(type,list);}
 emit(type){for(const fn of this.listeners.get(type)??[])fn();}
}
function env({reduce=false,hidden=false,missingPhrase=false,missingToggle=false}={}){
 let clock=0,id=0,maxTimers=0;
 const timers=new Map();
 const phrase={textContent:html.match(/class="switch-phrase">([^<]+)</)[1]};
 const toggle=new Events();toggle.hidden=true;toggle.attributes={};toggle.setAttribute=(k,v)=>toggle.attributes[k]=v;
 const preference=new Events();preference.matches=reduce;
 const document=new Events();document.hidden=hidden;document.querySelector=s=>s==='.switch-phrase'?(missingPhrase?null:phrase):(missingToggle?null:toggle);
 const window=new Events();window.matchMedia=()=>preference;
 window.clearTimeout=key=>timers.delete(key);
 window.setTimeout=(fn,delay)=>{timers.set(++id,{fn,at:clock+delay});maxTimers=Math.max(maxTimers,timers.size);return id;};
 const advance=ms=>{const end=clock+ms;let iterations=0;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;assert.ok(++iterations<1000,'Unbounded timer loop');clock=next[1].at;timers.delete(next[0]);next[1].fn();}clock=end;};
 vm.runInNewContext(code,{document,window});
 return {phrase,toggle,preference,document,window,timers,advance,get maxTimers(){return maxTimers;},setReduce(value){preference.matches=value;preference.emit('change');},setHidden(value){document.hidden=value;document.emit('visibilitychange');}};
}
const tests=[];
function test(name,fn){try{fn();tests.push({name,result:'PASS'});}catch(error){tests.push({name,result:'FAIL',error:error.message});}}
test('Exactly four authentic original strings, rotated to preserve approved opening',()=>{assert.equal(actualPhrases.length,4);assert.deepEqual([...actualPhrases].sort(),[...sourcePhrases].sort());assert.equal(actualPhrases[0],'DISCIPLINE COMPOUNDS.');});
test('Initial static frame remains; four phrases advance every four seconds and wrap',()=>{const e=env();assert.equal(e.phrase.textContent,'Discipline compounds.');assert.equal(e.toggle.hidden,false);assert.equal(e.timers.size,1);e.advance(3999);assert.equal(e.phrase.textContent,'Discipline compounds.');e.advance(1);assert.equal(e.phrase.textContent,'I BUIDL');e.advance(4000);assert.equal(e.phrase.textContent,'I HODL...');e.advance(4000);assert.equal(e.phrase.textContent,'CAPITAL COMPOUNDS.');e.advance(4000);assert.equal(e.phrase.textContent,'DISCIPLINE COMPOUNDS.');assert.equal(e.maxTimers,1);});
test('Pause holds current text without a timer; Play resumes after full interval',()=>{const e=env();e.advance(4000);e.toggle.emit('click');assert.equal(e.toggle.textContent,'Play');assert.equal(e.toggle.attributes['aria-label'],'Play headline rotation');assert.equal(e.timers.size,0);e.advance(20000);assert.equal(e.phrase.textContent,'I BUIDL');e.toggle.emit('click');assert.equal(e.toggle.textContent,'Pause');assert.equal(e.toggle.attributes['aria-label'],'Pause headline rotation');e.advance(3999);assert.equal(e.phrase.textContent,'I BUIDL');e.advance(1);assert.equal(e.phrase.textContent,'I HODL...');});
test('Initial reduced-motion preference leaves static opening and hides irrelevant toggle',()=>{const e=env({reduce:true});assert.equal(e.toggle.hidden,true);assert.equal(e.timers.size,0);e.advance(60000);assert.equal(e.phrase.textContent,'Discipline compounds.');});
test('Reduced-motion change stops immediately, resets opening, then resumes when removed',()=>{const e=env();e.advance(8000);e.setReduce(true);assert.equal(e.phrase.textContent,'DISCIPLINE COMPOUNDS.');assert.equal(e.timers.size,0);assert.equal(e.toggle.hidden,true);e.advance(20000);e.setReduce(false);assert.equal(e.toggle.hidden,false);assert.equal(e.timers.size,1);e.advance(4000);assert.equal(e.phrase.textContent,'I BUIDL');});
test('Explicit user pause survives reduced-motion preference changes',()=>{const e=env();e.toggle.emit('click');e.setReduce(true);e.setReduce(false);assert.equal(e.timers.size,0);assert.equal(e.toggle.textContent,'Play');e.advance(20000);assert.equal(e.phrase.textContent,'DISCIPLINE COMPOUNDS.');});
test('Hidden document stops then resumes with fresh interval, without catch-up burst',()=>{const e=env();e.advance(4000);e.setHidden(true);assert.equal(e.timers.size,0);e.advance(40000);assert.equal(e.phrase.textContent,'I BUIDL');e.setHidden(false);e.advance(3999);assert.equal(e.phrase.textContent,'I BUIDL');e.advance(1);assert.equal(e.phrase.textContent,'I HODL...');});
test('Initially hidden document schedules nothing until visibility returns',()=>{const e=env({hidden:true});assert.equal(e.timers.size,0);e.advance(20000);e.setHidden(false);assert.equal(e.timers.size,1);e.advance(4000);assert.equal(e.phrase.textContent,'I BUIDL');});
test('pagehide stops timer and pageshow resumes, respecting explicit pause',()=>{const e=env();e.advance(4000);e.window.emit('pagehide');assert.equal(e.timers.size,0);e.advance(20000);assert.equal(e.phrase.textContent,'I BUIDL');e.window.emit('pageshow');assert.equal(e.timers.size,1);e.advance(4000);assert.equal(e.phrase.textContent,'I HODL...');e.toggle.emit('click');e.window.emit('pagehide');e.window.emit('pageshow');assert.equal(e.timers.size,0);});
test('Repeated lifecycle/preference events never create overlapping timers',()=>{const e=env();for(let i=0;i<25;i++){e.window.emit('pageshow');e.document.emit('visibilitychange');e.setReduce(false);}assert.equal(e.timers.size,1);assert.equal(e.maxTimers,1);e.advance(4000);assert.equal(e.phrase.textContent,'I BUIDL');});
test('Missing phrase or toggle exits without lifecycle handlers or timers',()=>{for(const options of [{missingPhrase:true},{missingToggle:true},{missingPhrase:true,missingToggle:true}]){const e=env(options);assert.equal(e.timers.size,0);assert.equal(e.window.listeners.size,0);assert.equal(e.document.listeners.size,0);assert.equal(e.toggle.listeners.size,0);}});
test('Static semantics preserve heading text and accessible action; duplicate measure is hidden',()=>{assert.match(html,/<h1 id="hero-heading">/);assert.match(html,/<span aria-hidden="true" class="switch-measure">/);assert.match(html,/<span aria-live="off" class="switch-line">/);assert.match(html,/<button[^>]*aria-label="Pause headline rotation"[^>]*class="motion-toggle"[^>]*hidden=""[^>]*type="button">Pause<\/button>/);});
console.log(JSON.stringify({source:'site/assets/hero-motion.js',source_sha256:'sha256:'+crypto.createHash('sha256').update(code).digest('hex'),scope:'Deterministic Node VM, mocked timers/events/DOM; no browser/network',limitations:['No native zoom, layout measurement, keyboard activation or screen-reader test is implied.','Lifecycle events are explicitly dispatched; this is not a real bfcache restoration test.'],passed:tests.filter(x=>x.result==='PASS').length,total:tests.length,tests},null,2));
if(tests.some(x=>x.result==='FAIL'))process.exitCode=1;
