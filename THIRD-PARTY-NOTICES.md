# Third-party software and model notices

Kernel's own code is MIT licensed. The attached reference image belongs to its respective owner; the application uses a separately drawn SVG based on the supplied design.

## Browser runtime

Electron 44.6.0 is MIT licensed: https://github.com/electron/electron/tree/v44.6.0 .
The packaged distribution includes Electron's `LICENSE.electron.txt` and Chromium's `LICENSES.chromium.html` in the application directory. Those notices cover Chromium and the runtime's bundled libraries. Preserve them when redistributing the application.

## Local chat

Kernel's local chat uses the unmodified Qwen3-4B Q4_K_M GGUF weights from Qwen, licensed under Apache 2.0.

- Model: https://huggingface.co/Qwen/Qwen3-4B-GGUF
- Pinned model repository revision: `bc640142c66e1fdd12af0bd68f40445458f3869b`
- Original developers: Qwen / Alibaba Cloud
- License: `vendor/QWEN-LICENSE.txt`
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

The release includes `Kernel-third-party-sources.zip` alongside the installer. It contains the complete upstream WinDivert v2.2.2 source archive (including build scripts) and the Cygwin 3.4.10-1 source package (including its packaging/build recipe). Kernel selects the LGPL-3.0 option for WinDivert, links the unmodified library dynamically and permits replacement with a compatible modified library and debugging of such modifications. No Kernel restriction prevents this; driver signing requirements are imposed by Windows. Cygwin retains its upstream GPL terms and linking exception. Preserve all notices and redistribute the corresponding source bundle whenever mirroring the binaries. Details and SHA-256 digests: `docs/THIRD-PARTY-SOURCES.md`. Kernel does not claim ownership of these components. SHA-256 provenance for retrieved release archives and weights is in `vendor/provenance.json`.

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
