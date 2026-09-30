import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/vision-bridge.mjs';
import { defaults } from '../src/config.mjs';

test('uses configured model names and endpoint, refuses unlisted resident models',async()=>{
 const calls=[];
 const config={...defaults,ollamaUrl:'http://localhost:12345',visionModel:'custom-vision:small',codingModels:['custom-code']};
 const fetcher=async(url,opts)=>{
  const body=opts?.body?JSON.parse(opts.body):null;
  calls.push({url,body});
  if(url.endsWith('/api/ps'))return Response.json({models:[{name:'custom-code:latest'}]});
  if(url.endsWith('/api/chat'))return Response.json({message:{content:'observed'}});
  return Response.json({});
 };
 const readImage=async()=>Buffer.from([137,80,78,71,13,10,26,10]);
 await analyze({source:'fixture.png'},{config,fetcher,readImage});
 assert.equal(calls[1].body.model,'custom-code:latest');
 assert.equal(calls[2].body.model,'custom-vision:small');
 assert.ok(calls.every(c=>c.url.startsWith(config.ollamaUrl)));
 await assert.rejects(analyze({source:'fixture.png'},{config,readImage,fetcher:async()=>Response.json({models:[{name:'unrelated:latest'}]})}),/Another model is running/);
});

test('unloads coder before vision and unloads vision after response', async () => {
  const calls = [];
  const fetcher = async (url, opts) => {
    const body = opts?.body ? JSON.parse(opts.body) : null;
    calls.push({url, body});
    if (url.endsWith('/api/ps')) return Response.json({models:[{name:'qwen-local-dev'}]});
    if (url.endsWith('/api/chat')) return Response.json({message:{content:'Blue button'}});
    return Response.json({});
  };
  const result = await analyze({source:'fixture.png', question:'Describe'}, {fetcher, readImage: async()=>Buffer.from([137,80,78,71,13,10,26,10])});
  assert.equal(result, 'Blue button');
  assert.equal(calls[1].body.model, 'qwen-local-dev');
  assert.equal(calls[1].body.keep_alive, 0);
  assert.equal(calls[2].body.model, 'qwen3.5:9b');
  assert.ok(calls[2].body.messages[1].images[0]);
  assert.equal(calls[3].body.keep_alive, 0);
});

test('unloads vision even if inference fails', async () => {
  const calls=[];
  const fetcher=async(url,opts)=>{
    calls.push(url);
    if(url.endsWith('/api/ps')) return Response.json({models:[]});
    if(url.endsWith('/api/chat')) return new Response('failure',{status:500});
    return Response.json({});
  };
  await assert.rejects(analyze({source:'x.png'}, {fetcher,readImage:async()=>Buffer.from([137,80,78,71,13,10,26,10])}), /500/);
  assert.ok(calls.at(-1).endsWith('/api/generate'));
});
