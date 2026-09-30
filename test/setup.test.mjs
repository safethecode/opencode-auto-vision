import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {install,uninstall} from '../bin/setup.mjs';

test('install, update and uninstall preserve user configuration and unrelated files',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'auto-vision-test-'));
 try {
  await writeFile(path.join(dir,'opencode.json'),'{"model":"keep-me"}');
  await install(dir);
  await writeFile(path.join(dir,'opencode-auto-vision.json'),'{"visionModel":"custom:9b"}');
  await install(dir);
  assert.match(await readFile(path.join(dir,'opencode-auto-vision.json'),'utf8'),/custom:9b/);
  await access(path.join(dir,'plugins','opencode-auto-vision.js'));
  await writeFile(path.join(dir,'opencode-auto-vision.json'),'{"enabled":false,"visionModel":"custom:9b"}');
  const {default:plugin}=await import(pathToFileURL(path.join(dir,'plugins','opencode-auto-vision.js')));
  assert.deepEqual(await plugin({directory:dir}),{});
  await uninstall(dir);
  await assert.rejects(access(path.join(dir,'plugins','opencode-auto-vision.js')));
  assert.equal(await readFile(path.join(dir,'opencode.json'),'utf8'),'{"model":"keep-me"}');
  await access(path.join(dir,'opencode-auto-vision.json'));
 } finally {await rm(dir,{recursive:true,force:true});}
});
