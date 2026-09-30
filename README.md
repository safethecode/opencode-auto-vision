# opencode-auto-vision

Automatic image analysis for OpenCode with local Ollama models. Sequentially swaps vision and coding models to reduce simultaneous VRAM usage, handling image attachments and MCP image responses without manual tool calls.

**Experimental, local-first integration.** Tested with OpenCode 1.18.33, Ollama 0.34.4, Node 24, Qwen3.5 9B and Qwen3-Coder 30B on Windows. It uses OpenCode's experimental message transform hook, which may change between releases. This is an independent community project.

## How it works

1. Intercept image attachments immediately before OpenCode sends messages to the coding model.
2. Unload configured coding models from Ollama.
3. Ask the local vision model to describe the images.
4. Unload the vision model and replace the images with textual observations in the outgoing message copy.
5. OpenCode's next coding request reloads the coding model and continues the task.

Original attachments remain in OpenCode's conversation storage. No additional vision tool call is required from the coding model. Skills that return images through ordinary tools benefit from the same conversion; arbitrary skill formats are not guaranteed.

Supported inputs:

- User image attachments and completed tool/MCP image attachments.
- Direct HTTPS PNG/JPEG/WebP links and image/screenshot/thumbnail URL fields in UIBowl tool output.
- PNG, JPEG and WebP, up to 15 MiB per image.

## Requirements

- Node.js 22 or newer on your PATH.
- OpenCode and a running Ollama server.
- A working text coding model configured in OpenCode.
- Enough RAM/VRAM for each model individually. Sequential loading does not make an oversized model fit, and CPU offload may still be necessary.

## Quick start

### 1. Check the prerequisites

Install [Node.js](https://nodejs.org/), [Ollama](https://ollama.com/) and [OpenCode](https://opencode.ai/) first. Open a terminal and check:

```sh
node --version
ollama --version
opencode --version
ollama list
```

If Ollama is not running, launch its desktop app, or run `ollama serve` in another terminal. Do not start a second server if one is already running.

### 2. Clone and install the plugin

```sh
git clone https://github.com/safethecode/opencode-auto-vision.git
cd opencode-auto-vision
ollama pull qwen3.5:9b
npm run setup
```

There are no npm runtime dependencies; `npm install` is not needed. On Windows PowerShell, use `npm.cmd` and `opencode.cmd` if script execution policy blocks the `.ps1` launchers.

Setup copies a small plugin into your OpenCode configuration directory. It does **not** change `opencode.json`, download coding models, change Ollama settings, or install/authenticate UIBowl. Configure those separately if needed; [examples/opencode.json](examples/opencode.json) is a mergeable example, not a replacement for your existing configuration.

Configuration directory selection: `--config-dir`, then `OPENCODE_CONFIG_DIR`, then `$XDG_CONFIG_HOME/opencode`, otherwise `~/.config/opencode`.

```sh
node bin/setup.mjs install --config-dir /path/to/opencode-config
```

Restart OpenCode after installation. Do not use `--pure`, which disables external plugins.

### 3. Connect your coding model

If OpenCode already uses a local Ollama coding model, keep that configuration and add its exact Ollama name to `codingModels` in the plugin settings below. Find the name with `ollama list`.

For a new setup, one tested coding model is:

```sh
ollama pull qwen3-coder:30b
```

This is a large model: check your machine's memory before downloading it. Merge the provider and model settings from [examples/opencode.json](examples/opencode.json) into your OpenCode configuration. Do not replace an existing configuration wholesale. The example advertises a 32K context; configure the Ollama model/server to match it as explained under **Limitations and privacy**.

The names have different meanings:

| Location | Example | Meaning |
| --- | --- | --- |
| OpenCode `model` | `ollama/qwen3-coder:30b` | Provider ID plus model ID |
| Plugin `codingModels` | `qwen3-coder:30b` | Ollama model allowed to be unloaded |
| Plugin `visionModel` | `qwen3.5:9b` | Model used to analyze images |

### 4. Restart OpenCode and attach an image

Start OpenCode from the project you want to work on, not from this plugin repository:

```sh
cd /path/to/your-project
opencode
```

On Windows, for example:

```powershell
cd "C:\Projects\my-app"
opencode.cmd
```

Attach or paste a screenshot using OpenCode's image attachment UI, then enter:

> Describe the visible text and layout in this screenshot. Do not modify any files.

The image analysis should happen automatically. Once that works, try:

> Implement this screen using the framework and components already in this project.

You should not need to switch agents or ask the coding model to call a vision tool. An ordinary image URL typed into a chat message is **not** automatically fetched by this plugin; use an image attachment or a supported tool result.

## Configure

Edit `opencode-auto-vision.json` in the selected OpenCode config directory:

```json
{
  "enabled": true,
  "ollamaUrl": "http://127.0.0.1:11434",
  "visionModel": "qwen3.5:9b",
  "codingModels": ["qwen3-coder:30b", "qwen-local-dev"],
  "visionContext": 8192,
  "visionOutputTokens": 1800,
  "remoteImages": true,
  "imageToolPrefixes": ["uibowl_"]
}
```

Set `codingModels` to your **Ollama model names**, without the `ollama/` provider prefix. These are the models the plugin is allowed to unload. If another unlisted model is resident, analysis stops with an explanation rather than unloading it. Use a distinct vision and coding model. The Qwen3.5 configuration is the tested default; other vision models require their own compatibility checks.

`imageToolPrefixes` controls extra URL detection in text tool output. Image attachments themselves are detected regardless of tool name. Set `remoteImages` to `false` to disable HTTPS image downloads. Restart OpenCode after editing configuration.

## Use

```sh
opencode
```

Attach a screenshot and ask:

> Implement a page based on this screenshot.

With a separately configured and authenticated UIBowl MCP:

> Find one login-screen reference on UIBowl and implement a page inspired by it.

No special agent, skill invocation, image path copying or `vision_analyze` call is required. UIBowl credentials are handled by OpenCode, not this repository.

### Optional: connect UIBowl

UIBowl is not required for local screenshots. To use it, merge this entry into the `mcp` section of your existing OpenCode configuration:

```json
{
  "mcp": {
    "uibowl": {
      "type": "remote",
      "url": "https://uibowl.io/api/mcp",
      "enabled": true,
      "timeout": 20000
    }
  }
}
```

Authenticate and check the connection:

```sh
opencode mcp auth uibowl
opencode mcp list
```

Complete the UIBowl login/authorization in your browser. On PowerShell, use `opencode.cmd` for these commands if needed. Once the server shows `connected`, restart your OpenCode conversation and ask:

> Use UIBowl to find one login-screen reference. Describe the actual screenshot and include its source link. Do not change files yet.

The plugin analyzes image attachments returned by the MCP automatically. After reviewing the reference, you can ask OpenCode to implement it. UIBowl account access and service availability are separate from this plugin.

### Using existing skills

Invoke your existing design or development skill as usual. If it reads an image or calls an MCP tool that returns an image attachment, the plugin converts that image before the next model request. No special instructions need to be added to the skill. A skill that only returns an arbitrary webpage link may still need to retrieve the actual image first.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Nothing happens after installation | Restart OpenCode, confirm you installed into its active config directory, and remove `--pure` from the launch command. |
| `Another model is running` | Check `ollama ps`. Add your coding model's exact name to `codingModels`, or stop an unrelated model yourself with `ollama stop MODEL_NAME`. |
| Ollama connection or model-not-found error | Check that Ollama is running, `ollamaUrl` is correct, and `ollama list` includes the configured vision model. |
| UIBowl needs authentication | Run `opencode mcp auth uibowl`, complete the browser flow and check `opencode mcp list`. |
| Model says the image was not supplied | Start a new conversation with an actual image attachment; check for an analysis failure notice and for input truncation in Ollama's logs. |
| Response takes a long time | Loading two models sequentially and processing a large prompt can take minutes. Use one session at a time and check `ollama ps`. |
| PowerShell blocks `npm.ps1` or `opencode.ps1` | Use `npm.cmd` and `opencode.cmd`; changing the machine's execution policy is not required. |
| Installer detects the legacy plugin | Move `plugins/auto-vision.js` outside the plugins directory, then run setup again. |

For a simple accuracy check, attach a screenshot containing a unique phrase and ask the model to transcribe it. Recognizing the phrase checks the complete image-to-text path; it does not prove pixel-perfect UI reconstruction.

## Update and uninstall

```sh
git pull
npm run setup
```

Setup preserves the plugin JSON configuration and existing OpenCode configuration. It replaces only its managed code files. To uninstall:

```sh
npm run uninstall-plugin
```

The JSON settings are preserved for later reuse. Ollama models and unrelated files are not deleted. Pass the same `--config-dir` to `node bin/setup.mjs uninstall` if you installed into a custom directory.

If you previously installed the prototype `plugins/auto-vision.js`, move that file outside the plugin directory before setup. The installer refuses to enable both versions simultaneously. Old helper files outside `plugins/` may be retained as backups.

## Limitations and privacy

- Model switching and prompt processing can take tens of seconds or minutes. Run one coding session at a time: requests are queued inside one bridge instance, not locked across OpenCode processes or other Ollama clients.
- The plugin currently transforms images even if the active coding model supports native vision. Set `enabled` to `false` when using native vision.
- Descriptions are lossy. OCR, colors, alignment and dimensions can be wrong. This does not improve the coding model's general instruction following.
- Analysis failures become explicit text notices. SVG, GIF, authenticated image URLs, arbitrary webpage URLs and arbitrary MCP resource formats are not supported.
- Analysis results are cached by source hash in memory (up to 100 entries per transformer). Changed content at the same URL can remain stale until restart. No additional image cache or analysis logs are written by this release; OpenCode has its own conversation storage.
- Ollama inference stays local with the default URL. UIBowl searches and enabled HTTPS image downloads use the network. Changing `ollamaUrl` to a remote server sends image data there.
- A long list of MCP tools or skills can exceed the coding model's context. The prototype needed a 32K context. Match OpenCode's advertised context to the actual Ollama runtime context; editing OpenCode's `limit.context` alone does not allocate it. Consult [Ollama context configuration](https://docs.ollama.com/context-length), and check `ollama ps`. Setup deliberately does not change your model or server configuration.

## Development and validation

```sh
npm test
npm run check
```

Tests mock Ollama and run without models, network access, credentials or a GPU. They cover image replacement, MCP attachments, URL extraction, failures, model unloading, and installation/configuration preservation. The CI matrix targets Windows, Linux and macOS on Node 22/24; non-Windows live model behavior has not been verified locally.

The Windows prototype was also tested against an attached screenshot and a real UIBowl image response. Those private session logs and screenshots are intentionally excluded. To verify your installation, attach an image containing a unique phrase and check that OpenCode reads it without asking you to call a vision tool.

Implementation: [plugin](src/plugin.mjs), [message transformer](src/auto-vision-core.mjs), [Ollama bridge](src/vision-bridge.mjs). Integration reference: [OpenCode plugins](https://opencode.ai/docs/plugins/).

## License

MIT. See [LICENSE](LICENSE).
