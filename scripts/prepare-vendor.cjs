// Downloads pinned upstream releases and verifies published SHA-256 digests.
// It does not execute any downloaded binary or batch file.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const project = path.resolve(__dirname, '..');
const cache = path.join(project, '.vendor-cache'); fs.mkdirSync(cache, { recursive: true });
const releases = [
  { name:'llama-vulkan.zip', url:'https://github.com/ggml-org/llama.cpp/releases/download/b11429/llama-b11429-bin-win-vulkan-x64.zip', sha256:'1bfe78ad9168b79fa02bf67f6af9f5e17a966d824d77238517f7bef12ac73b36', dir:'llama-vulkan' },
  { name:'llama.zip', url:'https://github.com/ggml-org/llama.cpp/releases/download/b11429/llama-b11429-bin-win-cpu-x64.zip', sha256:'1283323272b04cd07905816a597a0da810918102de958f4ff6f7bbaa70ed2efe', dir:'llama' },
  { name:'tor-expert-bundle.tar.gz', url:'https://dist.torproject.org/torbrowser/15.0.24/tor-expert-bundle-windows-x86_64-15.0.24.tar.gz', sha256:'e9dc6ccc93cd6afa507193f4de284d6424233ff5102155cd2c94b259e8a22b65', dir:'tor' },
  { name:'zapret.zip', url:'https://github.com/Flowseal/zapret-discord-youtube/releases/download/1.10.3/zapret-discord-youtube-1.10.3.zip', sha256:'244314ae1c24538a0d751601da8e0c925c843371eec4456eb15f14c4fd6b7058', dir:'zapret' }
];
(async()=>{
  if(process.platform !== 'win32')throw new Error('Эта сборка предназначена для Windows x64.');
  for(const asset of releases){
    const dest=path.join(cache,asset.name);
    if(!fs.existsSync(dest)){const res=await fetch(asset.url);if(!res.ok)throw new Error('HTTP '+res.status);await pipeline(Readable.fromWeb(res.body),fs.createWriteStream(dest));}
    if(crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex')!==asset.sha256)throw new Error(asset.name+': checksum mismatch');
    const target=path.join(project,'vendor',asset.dir);fs.mkdirSync(target,{recursive:true});
    if(asset.name.endsWith('.tar.gz'))execFileSync('tar.exe',['-xzf',dest,'-C',target],{windowsHide:true,stdio:'inherit'});else execFileSync('powershell.exe',['-NoProfile','-Command',"Expand-Archive -LiteralPath '"+dest.replaceAll("'","''")+"' -DestinationPath '"+target.replaceAll("'","''")+"' -Force"],{windowsHide:true,stdio:'inherit'});
    console.log(asset.name+' verified');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
