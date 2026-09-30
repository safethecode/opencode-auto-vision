import {mkdir,readFile,writeFile,copyFile,unlink,rmdir,lstat} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defaults} from '../src/config.mjs';

const files=['plugin.mjs','config.mjs','auto-vision-core.mjs','vision-bridge.mjs'];
const signature="'opencode-auto-vision:managed';";
const repo=fileURLToPath(new URL('../',import.meta.url));
async function exists(p) {try{await lstat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function assertOwned(entry) {
 if(await exists(entry) && !(await readFile(entry,'utf8')).startsWith(signature)) throw new Error(`Refusing to replace an unowned plugin: ${entry}`);
}
async function paths(dir) {
 const root=path.resolve(dir);
 const plugins=path.join(root,'plugins');
 const managed=path.join(root,'opencode-auto-vision');
 for(const p of [root,plugins,managed]) if(await exists(p) && (await lstat(p)).isSymbolicLink()) throw new Error(`Refusing symlink directory: ${p}`);
 return {root,plugins,managed,entry:path.join(plugins,'opencode-auto-vision.js')};
}
export async function install(dir) {
 const {root,plugins,managed,entry}=await paths(dir);
 await assertOwned(entry);
 if(await exists(path.join(plugins,'auto-vision.js'))) throw new Error('Legacy auto-vision.js detected. Back it up outside plugins/ before installing to avoid duplicate processing.');
 if(await exists(managed) && !(await exists(path.join(managed,'.managed')))) throw new Error(`Refusing to overwrite existing directory: ${managed}`);
 await mkdir(plugins,{recursive:true});
 await mkdir(managed,{recursive:true});
 await writeFile(path.join(managed,'.managed'),'opencode-auto-vision\n');
 for(const file of files) await copyFile(path.join(repo,'src',file),path.join(managed,file));
 const config=path.join(root,'opencode-auto-vision.json');
 if(!(await exists(config))) await writeFile(config,JSON.stringify(defaults,null,2)+'\n',{flag:'wx'});
 await writeFile(entry,`${signature}\nexport {default} from '../opencode-auto-vision/plugin.mjs';\n`);
 return root;
}
export async function uninstall(dir) {
 const {managed,entry}=await paths(dir);
 await assertOwned(entry);
 if(await exists(managed) && !(await exists(path.join(managed,'.managed')))) throw new Error('Managed marker missing; refusing removal');
 if(await exists(entry)) await unlink(entry);
 if(await exists(managed)) {
  for(const file of [...files,'.managed']) if(await exists(path.join(managed,file))) await unlink(path.join(managed,file));
  await rmdir(managed).catch(e=>{if(e.code!=='ENOTEMPTY')throw e;});
 }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {
  const [command,...args]=process.argv.slice(2);
  if(!['install','uninstall'].includes(command)|| (args.length && (args[0]!=='--config-dir'||args.length!==2))) throw new Error('Usage: node bin/setup.mjs install|uninstall [--config-dir DIRECTORY]');
  const dir=args[1] || process.env.OPENCODE_CONFIG_DIR || path.join(process.env.XDG_CONFIG_HOME||path.join(homedir(),'.config'),'opencode');
  await (command==='install'?install:uninstall)(dir);
  console.log(`${command} complete: ${path.resolve(dir)}. Restart OpenCode. User configuration was preserved.`);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
