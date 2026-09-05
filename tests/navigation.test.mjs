import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(base,'../assets/about-nav.js'),'utf8');
function env({missing=false,observer=true,open=false,height=108.2}={}){
 const listeners={},properties={},writes=[];let observerCallback,observed;
 const trigger={focus(){this.focused=true;}};
 const row={height,getBoundingClientRect(){return {height:this.height};}};
 const header={style:{setProperty(key,value){properties[key]=value;writes.push({key,value});}}};
 const inside={inside:true};
 const disclosure={open,closest(){return header;},querySelector(selector){return selector==='summary'?trigger:row;},contains(t){return !!t?.inside;},addEventListener(type,fn){listeners['disclosure:'+type]=fn;}};
 const document={querySelector(){return missing?null:disclosure;},addEventListener(type,fn){listeners['document:'+type]=fn;}};
 const window={addEventListener(type,fn){listeners['window:'+type]=fn;}};
 class ResizeObserver{constructor(fn){observerCallback=fn;}observe(target){observed=target;}}
 if(observer)window.ResizeObserver=ResizeObserver;
 vm.runInNewContext(source,{document,window,ResizeObserver});
 return {listeners,properties,writes,trigger,row,header,inside,disclosure,get observed(){return observed;},resize(){observerCallback?.();}};
}
const tests=[];
function test(name,fn){try{fn();tests.push({name,result:'PASS'});}catch(error){tests.push({name,result:'FAIL',error:error.message});}}
test('Missing disclosure exits without listeners or observer',()=>{const e=env({missing:true});assert.equal(Object.keys(e.listeners).length,0);assert.equal(e.observed,undefined);});
test('Closed initialization keeps CSS fallback and observes the row',()=>{const e=env();assert.equal(e.writes.length,0);assert.equal(e.observed,e.row);});
test('Initially open row reserves ceiling of actual measured height',()=>{const e=env({open:true,height:108.2});assert.equal(e.properties['--about-row-height'],'109px');});
test('Native opening toggle measures current row height',()=>{const e=env();e.row.height=186.8;e.disclosure.open=true;e.listeners['disclosure:toggle']();assert.equal(e.properties['--about-row-height'],'187px');});
test('ResizeObserver follows growing and shrinking open rows',()=>{const e=env({open:true,height:108});e.row.height=210.1;e.resize();assert.equal(e.properties['--about-row-height'],'211px');e.row.height=68;e.resize();assert.equal(e.properties['--about-row-height'],'68px');});
test('Closing zero-height observer delivery preserves last reservation; reopening remeasures',()=>{const e=env({open:true,height:188});e.disclosure.open=false;e.row.height=0;e.resize();e.listeners['disclosure:toggle']();assert.equal(e.properties['--about-row-height'],'188px');e.row.height=108;e.disclosure.open=true;e.listeners['disclosure:toggle']();assert.equal(e.properties['--about-row-height'],'108px');});
test('Without ResizeObserver, window resize and native toggle still measure',()=>{const e=env({observer:false});assert.equal(typeof e.listeners['window:resize'],'function');e.disclosure.open=true;e.row.height=155.5;e.listeners['disclosure:toggle']();assert.equal(e.properties['--about-row-height'],'156px');e.row.height=212;e.listeners['window:resize']();assert.equal(e.properties['--about-row-height'],'212px');});
test('Escape closes, prevents default and restores trigger focus',()=>{const e=env({open:true});let prevented=false;e.listeners['document:keydown']({key:'Escape',preventDefault(){prevented=true;}});assert.equal(e.disclosure.open,false);assert.equal(e.trigger.focused,true);assert.equal(prevented,true);});
test('Closed disclosure does not consume Escape intended for another control',()=>{const e=env();let prevented=false;e.listeners['document:keydown']({key:'Escape',preventDefault(){prevented=true;}});assert.equal(prevented,false);assert.equal(e.trigger.focused,undefined);});
test('Outside pointer closes; inside pointer preserves disclosure',()=>{const e=env({open:true});e.listeners['document:pointerdown']({target:e.inside});assert.equal(e.disclosure.open,true);e.listeners['document:pointerdown']({target:{}});assert.equal(e.disclosure.open,false);});
test('Internal focus traversal stays open; leaving closes',()=>{const e=env({open:true});e.listeners['disclosure:focusout']({relatedTarget:e.inside});assert.equal(e.disclosure.open,true);e.listeners['disclosure:focusout']({relatedTarget:{}});assert.equal(e.disclosure.open,false);});
test('Link click closes while summary activation remains native',()=>{const e=env({open:true});e.listeners['disclosure:click']({target:{closest(){return null;}}});assert.equal(e.disclosure.open,true);e.listeners['disclosure:click']({target:{closest(){return {};}}});assert.equal(e.disclosure.open,false);});
test('Pagehide closes disclosure',()=>{const e=env({open:true});e.listeners['window:pagehide']();assert.equal(e.disclosure.open,false);});
console.log(JSON.stringify({scope:'Deterministic source/event/measurement mocks; not native browser geometry or keyboard testing',source_sha256:'sha256:'+crypto.createHash('sha256').update(source).digest('hex'),passed:tests.filter(t=>t.result==='PASS').length,total:tests.length,tests},null,2));
if(tests.some(t=>t.result==='FAIL'))process.exitCode=1;
