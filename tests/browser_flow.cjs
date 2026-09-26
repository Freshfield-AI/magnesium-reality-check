const assert = require('node:assert/strict');
const fs = require('node:fs');

const BASE = 'http://127.0.0.1:8766/';
const CDP = 'http://127.0.0.1:9224';

async function main() {
  const pages = await (await fetch(`${CDP}/json/list`)).json();
  const tab = pages.find(p => p.type === 'page');
  assert(tab?.webSocketDebuggerUrl, 'Chrome tab with CDP endpoint');
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.addEventListener('open', ok, {once:true}); socket.addEventListener('error', fail, {once:true}); });
  let next = 1;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.text);
    if (pending.has(m.id)) {
      const {resolve,reject} = pending.get(m.id); pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
  });
  const send = (method, params={}) => new Promise((resolve,reject) => {
    const id=next++; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params}));
  });
  const evalJS = async expression => {
    const r = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };
  const screenshot = async name => {
    await new Promise(r => setTimeout(r, 550));
    const r = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(`/home/mike/.hermes/cache/scratch/chfa-${name}.png`,Buffer.from(r.data,'base64'));
  };
  await send('Page.enable'); await send('Runtime.enable');
  for (const [width,height] of [[1024,768],[768,1024],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});
    await send('Page.navigate',{url:`${BASE}?qa=${width}x${height}`});
    await new Promise(r => setTimeout(r, 1000));
    const first = await evalJS(`(() => {let b=document.querySelector('#reveal-start').getBoundingClientRect();let o=document.querySelector('.hero-order-link').getBoundingClientRect();let f=document.querySelector('.hero-facts').getBoundingClientRect();return {width:innerWidth,height:innerHeight,buttonBottom:b.bottom,buttonWidth:b.width,orderBottom:o.bottom,factsBottom:f.bottom,hidden:document.querySelector('#reveal').hidden,overflow:document.documentElement.scrollWidth>innerWidth,defaultDose:document.querySelector('#elemental').value,verdict:document.querySelector('#verdict').textContent}})()`);
    assert(first.buttonBottom <= height, `CTA above fold at ${width}x${height}: ${JSON.stringify(first)}`);
    assert(first.orderBottom <= height, `Opening-order link above fold at ${width}x${height}: ${JSON.stringify(first)}`);
    if (width >= 768) assert(first.factsBottom <= height, `Product facts above fold at ${width}x${height}: ${JSON.stringify(first)}`);
    assert(first.buttonWidth >= 220 && !first.overflow && first.hidden);
    assert.equal(first.defaultDose, '200');
    assert.equal(first.verdict, 'Bisglycinate alone does not fit this example');
    const firstResult = await evalJS(`(() => ({assumption:document.querySelector('#result-assumption').textContent,explanation:document.querySelector('#explanation').textContent,claimLabel:document.querySelector('#result-claim-label').textContent,claim:document.querySelector('#result-claim').textContent,maximum:document.querySelector('#result-maximum').textContent,gap:document.querySelector('#result-gap').textContent,ceiling:document.querySelector('#row-ceiling').textContent,choice:document.querySelector('#result-choice').textContent,detailsOpen:document.querySelector('#calc-details').open}))()`);
    assert.match(firstResult.assumption,/Generic size-00 example.*not based on any named bottle/i);
    assert.match(firstResult.explanation,/1,418 mg.*900 mg/i);
    assert.match(firstResult.explanation,/not an oxide estimate for any named product/i);
    assert.equal(firstResult.claimLabel,'Elemental per capsule');
    assert.equal(firstResult.claim,'200 mg');
    assert.equal(firstResult.maximum,'127 mg');
    assert.match(firstResult.gap,/at least 73 mg.*another magnesium source/i);
    assert.match(firstResult.ceiling,/127 mg/);
    assert.match(firstResult.choice,/Freshfield.*121 mg.*two capsules/i);
    assert.match(firstResult.choice,/Separate Freshfield product fact, not this estimate/i);
    assert.match(firstResult.choice,/Want one stated magnesium source\?/i);
    assert.equal(firstResult.detailsOpen,false);
    if (width === 1024) {
      await screenshot('hero-landscape');
      await evalJS(`document.querySelector('#result').scrollIntoView({block:'start',behavior:'instant'})`);
      const choiceBottom=await evalJS(`document.querySelector('#result-choice a').getBoundingClientRect().bottom`);
      assert(choiceBottom <= height, `Freshfield answer/action visible in iPad result: ${choiceBottom}`);
      await screenshot('calculator-landscape');
      const oxide=await evalJS(`(() => {let f=document.querySelector('#calc-form');f.querySelector('input[name="form"][value="oxide"]').checked=true;f.dispatchEvent(new Event('change',{bubbles:true}));return {status:document.querySelector('#result').dataset.status,choiceHidden:document.querySelector('#result-choice').hidden,gapColor:getComputedStyle(document.querySelector('#result-gap')).color,verdictColor:getComputedStyle(document.querySelector('#verdict')).color}})()`);
      assert.equal(oxide.status,'possible');
      assert.equal(oxide.choiceHidden,true);
      assert.notEqual(oxide.gapColor,'rgb(163, 57, 43)');
      assert.notEqual(oxide.verdictColor,'rgb(35, 107, 72)');
      const fractionalGap=await evalJS(`(() => {let f=document.querySelector('#calc-form'),e=document.querySelector('#elemental');f.querySelector('input[name="form"][value="bisglycinate"]').checked=true;e.value='200.5';e.dispatchEvent(new Event('input',{bubbles:true}));return document.querySelector('#result-gap').textContent})()`);
      assert.match(fractionalGap,/At least 73 mg elemental/);
      assert.doesNotMatch(fractionalGap,/At least 74 mg elemental/);
      const invalid=await evalJS(`(() => {let f=document.querySelector('#calc-form'),e=document.querySelector('#elemental');f.querySelector('input[name="form"][value="bisglycinate"]').checked=true;e.value='1,000';e.dispatchEvent(new Event('input',{bubbles:true}));return {verdict:document.querySelector('#verdict').textContent,claim:document.querySelector('#result-claim').textContent,maximum:document.querySelector('#result-maximum').textContent,choiceHidden:document.querySelector('#result-choice').hidden}})()`);
      assert.equal(invalid.verdict,'Enter a label amount');
      assert.equal(invalid.claim,'—');
      assert.equal(invalid.maximum,'—');
      assert.equal(invalid.choiceHidden,true);
      const boundary=await evalJS(`(() => {let e=document.querySelector('#elemental');e.value='127';e.dispatchEvent(new Event('input',{bubbles:true}));return {status:document.querySelector('#result').dataset.status,verdict:document.querySelector('#verdict').textContent,gap:document.querySelector('#result-gap').textContent}})()`);
      assert.equal(boundary.status,'uncertain');
      assert(!/0 mg.*another magnesium source/i.test(boundary.gap));
      const largeCapsule=await evalJS(`(() => {let f=document.querySelector('#calc-form'),e=document.querySelector('#elemental');e.value='200';f.querySelector('input[name="capsule"][value="000"]').checked=true;f.dispatchEvent(new Event('change',{bubbles:true}));return {status:document.querySelector('#result').dataset.status,verdict:document.querySelector('#verdict').textContent}})()`);
      assert.equal(largeCapsule.status,'uncertain');
      const serving=await evalJS(`(() => {let f=document.querySelector('#calc-form'),e=document.querySelector('#elemental');e.value='121';f.querySelector('input[name="capsule"][value="00"]').checked=true;f.querySelector('input[name="basis"][value="serving"]').checked=true;f.dispatchEvent(new Event('change',{bubbles:true}));return {label:document.querySelector('#result-claim-label').textContent,claim:document.querySelector('#result-claim').textContent}})()`);
      assert.match(serving.label,/per capsule.*converted from serving/i);
      assert.equal(serving.claim,'60.5 mg');
      await evalJS(`document.querySelector('#reset-example').click()`);
    }
    const buttons = ['reveal-start','reveal-turn','reveal-next','reveal-freshfield-next'];
    const expected = ['reveal-front','reveal-label','reveal-absorption','reveal-freshfield'];
    for (let i=0;i<buttons.length;i++) {
      await evalJS(`document.getElementById('${buttons[i]}').click()`);
      await new Promise(r => setTimeout(r, 900));
      const state=await evalJS(`(() => {let stage=[...document.querySelectorAll('.reveal-stage')].find(e=>!e.hidden);return {visible:[stage.id],progress:document.querySelector('#reveal-progress').textContent,focus:document.activeElement.id,overflow:document.documentElement.scrollWidth>innerWidth,nextBottom:stage.querySelector('.btn').getBoundingClientRect().bottom}})()`);
      assert.deepEqual(state.visible,[expected[i]], `${width} stage ${i}`);
      assert.match(state.progress,new RegExp(`${i+1} of 4`));
      assert(!state.overflow, `no horizontal overflow at ${width}, stage ${i}`);
      if (width >= 768) assert(state.nextBottom <= height, `Next action visible at ${width}x${height}, stage ${i}: ${JSON.stringify(state)}`);
      if (width === 768 && i === 1) await screenshot('label-portrait');
      if (width === 1024 && i === 2) await screenshot('absorption-landscape');
      if (width === 768 && i === 2) await screenshot('absorption-portrait');
      if (width === 1024 && i === 3) await screenshot('freshfield-landscape');
    }
    const returnState=await evalJS(`(() => {document.querySelector('#reveal-restart').click();return [...document.querySelectorAll('.reveal-stage')].filter(e=>!e.hidden).map(e=>e.id)})()`);
    assert.deepEqual(returnState,['reveal-front']);
    const calculator=await evalJS(`(() => {const e=document.querySelector('#elemental');e.value='121';document.querySelector('input[name="basis"][value="serving"]').checked=true;e.dispatchEvent(new Event('input',{bubbles:true}));return {verdict:document.querySelector('#verdict').textContent,perCap:document.querySelector('#row-elemental').textContent}})()`);
    assert.equal(calculator.perCap,'60.5 mg');
    assert.notEqual(calculator.verdict,'It depends on the fill');
    console.log(`PASS ${width}x${height}`,JSON.stringify({first,calculator}));
  }
  await send('Network.enable');
  const worker = await evalJS(`(async () => {await navigator.serviceWorker.ready;return {controller:!!navigator.serviceWorker.controller,keys:await caches.keys()}})()`);
  assert(worker.controller,'service worker controls the opened page');
  assert(worker.keys.includes('freshfield-magnesium-chfa-v7'));
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await send('Page.navigate',{url:`${BASE}?offline=1`});
  await new Promise(r => setTimeout(r,1000));
  const offline = await evalJS(`(() => {document.querySelector('#reveal-start').click();return {title:document.title,visible:!document.querySelector('#reveal-front').hidden,button:document.querySelector('#reveal-turn').textContent}})()`);
  assert(offline.visible && offline.title.includes('Freshfield Magnesium'));
  await send('Page.navigate',{url:`${BASE}index.html?offline=2`});
  await new Promise(r => setTimeout(r,1000));
  const offlineIndex = await evalJS(`(() => ({title:document.title,hasCTA:!!document.querySelector('#reveal-start')}))()`);
  assert(offlineIndex.hasCTA && offlineIndex.title.includes('Freshfield Magnesium'));
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  console.log('PASS offline reload at / and /index.html, first reveal',JSON.stringify({worker,offline,offlineIndex}));
  assert.deepEqual(exceptions,[],`JS exceptions: ${JSON.stringify(exceptions)}`);
  socket.close();
}
main().catch(e => {console.error(e);process.exitCode=1;});
