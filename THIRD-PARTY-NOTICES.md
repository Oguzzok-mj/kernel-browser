# Third-party software and model notices

Kernel's own code is MIT licensed. The attached reference image belongs to its respective owner; the application uses a separately drawn SVG based on the supplied design.

## Browser runtime

Electron 44.6.0 is MIT licensed: https://github.com/electron/electron/tree/v44.6.0 .
The packaged distribution includes Electron's `LICENSE.electron.txt` and Chromium's `LICENSES.chromium.html` in the application directory. Those notices cover Chromium and the runtime's bundled libraries. Preserve them when redistributing the application.

## Local chat

Kernel's local chat uses Mistral NeMo Instruct 2407 (12B), quantized to Q4_K_M GGUF by bartowski, licensed under Apache 2.0.

- Original model: https://huggingface.co/mistralai/Mistral-Nemo-Instruct-2407
- Quantized weights: https://huggingface.co/bartowski/Mistral-Nemo-Instruct-2407-GGUF
- Pinned model repository revision: `a2dd64a0a76ea1bdb2bb6ab6fa5496b003c7c908`
- Original developers: Mistral AI / NVIDIA
- License: `vendor/MISTRAL-LICENSE.txt`
- Inference runtime: llama.cpp b11429, commit d81235049, MIT
- Runtime source: https://github.com/ggml-org/llama.cpp/tree/b11429
- Backends: Windows CPU x64 and Vulkan x64
- Runtime license: `vendor/LLAMA-LICENSE.txt`

## DPI bypass

Unmodified upstream distribution: Flowseal/zapret-discord-youtube 1.10.3, published September 20, 2026. Kernel parses its general*.bat strategy arguments and launches winws directly; it does not execute the service installer or updater. GameFilter uses the upstream disabled sentinel port 12. No VPN service is included.

- Distribution/source: https://github.com/Flowseal/zapret-discord-youtube/tree/1.10.3
- Original zapret developer: bol-van
- MIT notices: `vendor/FLOWSEAL-LICENSE.txt` and the bundled upstream LICENSE.txt
- Binary origins: https://github.com/bol-van/zapret-win-bundle and https://github.com/bol-van/zapret
- WinDivert: https://github.com/basil00/WinDivert ; dual LGPL 3.0 / GPL 2.0; full upstream license in `vendor/WINDIVERT-LICENSE.txt`
- Cygwin 3.4.10: https://cygwin.com/ ; GPL, with upstream linking exception; GNU GPL text in `vendor/CYGWIN-COPYING.txt`
- Corresponding Cygwin source: https://cygwin.com/git/?p=newlib-cygwin.git;a=shortlog;h=refs/tags/cygwin-3_4_10-release

This is a personal development build. Before public redistribution of the complete binary bundle, preserve all upstream notices and provide the corresponding source/build material required by WinDivert and Cygwin licenses. Kernel does not claim ownership of these components. SHA-256 provenance for retrieved release archives and weights is in `vendor/provenance.json`.

## Connection / Tor

Unmodified official Tor Expert Bundle 15.0.24 for Windows x86_64 (Tor 0.4.9.13).
Source/download: https://download.torproject.org/tor/ .
Tor uses the 3-clause BSD license. Complete bundled notices (Tor, lyrebird including Snowflake, libevent, OpenSSL, zlib and Conjure) are preserved in vendor/tor/docs/. SHA-256 is recorded in provenance.json. Kernel is a Chromium browser with Tor routing; it does not reproduce Tor Browser's fingerprinting protections.

## Page utilities

- Mozilla Readability 0.6.0: Apache-2.0, https://github.com/mozilla/readability ; license in node_modules/@mozilla/readability/LICENSE.md.
- DOMPurify 3.4.16: Apache-2.0 OR MPL-2.0, https://github.com/cure53/DOMPurify ; notices in node_modules/dompurify/LICENSE.
- Turndown 7.2.4: MIT, https://github.com/mixmark-io/turndown ; node_modules/turndown/LICENSE.
- node-qrcode 1.5.4: MIT, https://github.com/soldair/node-qrcode ; node_modules/qrcode/license.
- Transitive dependency licenses are retained with their packages inside resources/app.asar; exact versions and integrity hashes are pinned in package-lock.json.
- Currency conversion uses ExchangeRate-API Open Access, https://www.exchangerate-api.com/docs/free . Rates update daily; the result includes its timestamp and required provider attribution.

## Automatic updates

- electron-updater 6.8.9: MIT, https://github.com/electron-userland/electron-builder/tree/master/packages/electron-updater . License retained in assets/licenses/electron-updater.txt inside resources/app.asar. Transitive notices and pinned integrity hashes are retained with their packages and package-lock.json.
