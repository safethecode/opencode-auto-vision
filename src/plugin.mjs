import {analyze} from './vision-bridge.mjs';
import {createTransformer} from './auto-vision-core.mjs';
import {loadConfig} from './config.mjs';

export default async function AutoVision({directory}) {
  const config=await loadConfig(new URL('../opencode-auto-vision.json',import.meta.url));
  if(!config.enabled) return {};
  const transform=createTransformer(source=>analyze({source,directory,
    question:'Describe the image for a coding assistant. Transcribe visible text, identify components, layout and colors. Be concise, at most 350 words. Mark uncertainty. Do not generate code or invent pixel dimensions.',
  },{config}),{imageToolPrefixes:config.imageToolPrefixes});
  return {
    'experimental.chat.messages.transform':async(_input,output)=>transform(output.messages),
  };
}
