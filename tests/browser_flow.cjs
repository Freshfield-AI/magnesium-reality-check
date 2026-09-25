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
    const first = await evalJS(`(() => {let b=document.querySelector('#reveal-start').getBoundingClientRect();return {width:innerWidth,height:innerHeight,buttonBottom:b.bottom,buttonWidth:b.width,hidden:document.querySelector('#reveal').hidden,overflow:document.documentElement.scrollWidth>innerWidth,defaultDose:document.querySelector('#elemental').value,verdict:document.querySelector('#verdict').textContent}})()`);
    assert(first.buttonBottom <= height, `CTA above fold at ${width}x${height}: ${JSON.stringify(first)}`);
    assert(first.buttonWidth >= 220 && !first.overflow && first.hidden);
    assert.equal(first.defaultDose, '200');
    assert.equal(first.verdict, 'Check the full label');
    if (width === 1024) await screenshot('hero-landscape');
    const buttons = ['reveal-start','reveal-turn','reveal-next','reveal-freshfield-next'];
    const expected = ['reveal-front','reveal-label','reveal-albion','reveal-freshfield'];
    for (let i=0;i<buttons.length;i++) {
      const state=await evalJS(`(() => {document.getElementById('${buttons[i]}').click();return {visible:[...document.querySelectorAll('.reveal-stage')].filter(e=>!e.hidden).map(e=>e.id),progress:document.querySelector('#reveal-progress').textContent,focus:document.activeElement.id,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
      assert.deepEqual(state.visible,[expected[i]], `${width} stage ${i}`);
      assert.match(state.progress,new RegExp(`${i+1} of 4`));
      assert(!state.overflow, `no horizontal overflow at ${width}, stage ${i}`);
      if (width === 768 && i === 1) await screenshot('label-portrait');
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
  assert(worker.keys.includes('freshfield-magnesium-chfa-v4'));
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
