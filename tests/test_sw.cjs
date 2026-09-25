const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const page = 'https://freshfield-ai.github.io/magnesium-reality-check/';
const listeners = {};
const stores = new Map();
function store(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  const values = stores.get(name);
  return {add: async url => values.set(url, {body:'NEW',clone(){return this;}}),
          match: async url => values.get(url),
          put: async (url,response) => values.set(url,response)};
}
const context = {
  URL, AbortController, setTimeout, clearTimeout,
  caches: {open:async name=>store(name),keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)},
  self: {registration:{scope:page},clients:{claim:async()=>{context.claimed=true;}},skipWaiting(){},addEventListener:(name,fn)=>{listeners[name]=fn;}},
  fetch: async()=>{throw new Error('offline');}
};
(async()=>{
  await store('freshfield-magnesium-chfa-v3').put(page,{body:'OLD'});
  await store('freshfield-magnesium-chfa-v4').put(page,{body:'PREVIOUS'});
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8'),context);
  let installed;
  listeners.install({waitUntil:p=>installed=p}); await installed;
  let activated;
  listeners.activate({waitUntil:p=>activated=p}); await activated;
  assert.deepEqual([...stores.keys()],['freshfield-magnesium-chfa-v5']);
  assert.equal(context.claimed,true);
  let responsePromise;
  listeners.fetch({request:{url:page+'?offline=1',mode:'navigate'},respondWith:p=>responsePromise=p,waitUntil:()=>{}});
  const response=await responsePromise;
  assert.equal(response.body,'NEW');
  let indexedResponse;
  listeners.fetch({request:{url:page+'index.html',mode:'navigate'},respondWith:p=>indexedResponse=p,waitUntil:()=>{}});
  assert.equal((await indexedResponse).body,'NEW');
  let intercepted=false;
  listeners.fetch({request:{url:page+'sw.js',mode:'navigate'},respondWith:()=>intercepted=true});
  assert.equal(intercepted,false);
  console.log('SW PASS: v3/v4 deleted, v5 claimed, offline page served, sw.js not intercepted');
})().catch(e=>{console.error(e);process.exitCode=1;});
