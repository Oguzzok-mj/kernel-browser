# Corresponding source for binary dependencies

Download `Kernel-third-party-sources.zip` from the same [v0.4.1 release](https://github.com/Oguzzok-mj/kernel-browser/releases/tag/v0.4.1) as the Windows installer. It contains:

| Archive | Version | SHA-256 |
|---|---|---|
| `WinDivert-v2.2.2-source.zip` | WinDivert v2.2.2 | `65ec79c9e6afa99f648a3f4d1f6db794640b40d0b65bd438770ea503ee14ecb7` |
| `cygwin-3.4.10-1-src.tar.xz` | Cygwin 3.4.10-1 | `ac70af0d4e644732f74946f55f7bafe010bab9b9da39a9327c3f0367f1fa43a2` |

WinDivert source, build scripts and licenses come from the [upstream v2.2.2 tag](https://github.com/basil00/WinDivert/tree/v2.2.2). The bundled x64 DLL and driver match the unmodified official `WinDivert-2.2.2-A.zip` distribution byte for byte:

- `WinDivert.dll`: `c1e060ee19444a259b2162f8af0f3fe8c4428a1c6f694dce20de194ac8d7d9a2`
- `WinDivert64.sys`: `8da085332782708d8767bcace5327a6ec7283c17cfb85e40b03cd2323a90ddc2`

The complete Cygwin source package, including its build recipe, was retrieved from the [Cygwin mirror](https://ftp.cvut.cz/mirrors/cygwin.com/x86_64/release/cygwin/cygwin-3.4.10-1-src.tar.xz). The included runtime reports version 3.4.10. Original project: https://cygwin.com/ ; upstream source: https://sourceware.org/git/newlib-cygwin.git .

The source bundle also preserves the WinDivert and Cygwin license texts. The main Kernel source, installer configuration and pinned dependency download script are in this repository. Other upstream sources and licenses are listed in [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md). These components are not modified by Kernel. Preserve this source bundle and notices if redistributing the installer.
