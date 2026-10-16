import test from 'node:test';
import assert from 'node:assert/strict';
import AutoVision from '../src/plugin.mjs';

test('plugin uses the latest user model and resolved image capability for each outgoing request',async()=>{
 let lookups=0;
 const client={config:{providers:async()=>{lookups++;return {data:{providers:[{id:'local',models:{vision:{capabilities:{input:{image:true}}},text:{capabilities:{input:{image:false}}}}}]}};}}};
 const hook=(await AutoVision({client,directory:process.cwd()}))['experimental.chat.messages.transform'];
 const image=()=>({type:'file',mime:'image/png',url:'data:image/png;base64,aA=='});
 const messages=[{info:{role:'user',model:{providerID:'local',modelID:'text'}},parts:[]},{info:{role:'user',model:{providerID:'local',modelID:'vision'}},parts:[image()]}];
 await hook({}, {messages});
 assert.equal(messages[1].parts[0].type,'file');
 messages.push({info:{role:'user',model:{providerID:'local',modelID:'text'}},parts:[]});
 await hook({}, {messages});
 assert.equal(messages[1].parts[0].type,'text');
 assert.equal(lookups,2);
});

test('missing and unknown current models do not inherit an earlier native capability',async()=>{
 const client={config:{providers:async()=>({data:{providers:[{id:'local',models:{vision:{capabilities:{input:{image:true}}}}}]}})}};
 const hook=(await AutoVision({client,directory:process.cwd()}))['experimental.chat.messages.transform'];
 for(const model of [undefined,{providerID:'local',modelID:'unknown'}]) {
  const messages=[{info:{role:'user',model:{providerID:'local',modelID:'vision'}},parts:[]},{info:{role:'user',model},parts:[{type:'file',mime:'image/gif',url:'data:image/gif;base64,aA=='}]}];
  await hook({}, {messages});
  assert.equal(messages[1].parts[0].type,'text');
  assert.match(messages[1].parts[0].text,/failed/);
 }
});
