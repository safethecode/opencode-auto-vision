import {readFile} from 'node:fs/promises';

export const defaults = {
  enabled: true,
  ollamaUrl: 'http://127.0.0.1:11434',
  visionModel: 'qwen3.5:9b',
  codingModels: ['qwen3-coder:30b', 'qwen-local-dev'],
  visionContext: 8192,
  visionOutputTokens: 1800,
  remoteImages: true,
  imageToolPrefixes: ['uibowl_'],
};

export async function loadConfig(filename) {
  let data={};
  try {data=JSON.parse(await readFile(filename,'utf8'));}
  catch(error) {if(error.code!=='ENOENT') throw error;}
  const config={...defaults,...data};
  const url=new URL(config.ollamaUrl);
  if(!['http:','https:'].includes(url.protocol)) throw new Error('ollamaUrl must use HTTP or HTTPS');
  for(const key of ['enabled','remoteImages']) if(typeof config[key]!=='boolean') throw new Error(`${key} must be boolean`);
  for(const key of ['codingModels','imageToolPrefixes']) if(!Array.isArray(config[key]) || config[key].some(x=>typeof x!=='string'||!x)) throw new Error(`${key} must contain nonempty strings`);
  if(typeof config.visionModel!=='string'||!config.visionModel) throw new Error('visionModel is required');
  for(const key of ['visionContext','visionOutputTokens']) if(!Number.isInteger(config[key])||config[key]<1) throw new Error(`${key} must be a positive integer`);
  config.ollamaUrl=config.ollamaUrl.replace(/\/$/,'');
  return config;
}
