import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTransformer} from '../src/auto-vision-core.mjs';

test('converts user attachments and MCP image attachments before model input, preserves text',async()=>{
 const calls=[];
 const transform=createTransformer(async source=>{calls.push(source);return 'PROJECT ORBIT';});
 const image={type:'file',id:'f',mime:'image/png',url:'data:image/png;base64,iVBORw=='};
 const messages=[{info:{},parts:[image,{type:'tool',tool:'uibowl_search',state:{status:'completed',output:'Reference',attachments:[image,{type:'file',mime:'application/pdf',url:'file:///x.pdf'}]}}]}];
 await transform(messages);
 assert.equal(messages[0].parts[0].type,'text');
 assert.match(messages[0].parts[0].text,/PROJECT ORBIT/);
 assert.equal(messages[0].parts[1].state.attachments.length,1);
 assert.match(messages[0].parts[1].state.output,/Reference[\s\S]*PROJECT ORBIT/);
 assert.equal(calls.length,1);
});
test('failed analysis removes unsupported image and reports failure instead of fabricating',async()=>{
 const transform=createTransformer(async()=>{throw new Error('unavailable')});
 const messages=[{parts:[{type:'file',mime:'image/png',url:'data:image/png;base64,aA=='}]}];
 await transform(messages);
 assert.equal(messages[0].parts[0].type,'text');
 assert.match(messages[0].parts[0].text,/unavailable/);
});
test('UIBowl screenshot links are analyzed without an explicit vision tool call',async()=>{
 const transform=createTransformer(async source=>`observed ${source}`);
 const messages=[{parts:[{type:'tool',tool:'uibowl_search_ui_patterns',state:{status:'completed',output:'{"screenshot_url":"https://cdn.example.org/screen.png"}'}}]}];
 await transform(messages);
 assert.match(messages[0].parts[0].state.output,/observed https:/);
});
