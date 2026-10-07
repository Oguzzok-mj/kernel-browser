const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const dir=path.resolve(__dirname,'../../electron-download');fs.mkdirSync(dir,{recursive:true});
const size=158256863,step=8*1024*1024,count=Math.ceil(size/step);let next=0;
async function worker(){while(next<count){const i=next++,start=i*step,end=Math.min(size,start+step)-1;const dest=path.join(dir,'part-'+i);if(fs.existsSync(dest)&&fs.statSync(dest).size===end-start+1)continue;for(let a=0;a<5;a++){try{const r=await fetch('https://github.com/electron/electron/releases/download/v44.6.0/electron-v44.6.0-win32-x64.zip?chunk='+i+'&attempt='+a,{headers:{Range:`bytes=${start}-${end}`},signal:AbortSignal.timeout(60000)});if(r.status!==206)throw new Error('HTTP '+r.status);await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(dest));if(fs.statSync(dest).size!==end-start+1)throw new Error('Size mismatch');console.log('Electron '+(i+1)+'/'+count);break;}catch(e){if(a===4)throw e;}}}}
(async()=>{await Promise.all(Array.from({length:6},worker));const data=Buffer.concat(Array.from({length:count},(_,i)=>fs.readFileSync(path.join(dir,'part-'+i))));const expected=require('../node_modules/electron/checksums.json')['electron-v44.6.0-win32-x64.zip'];if(crypto.createHash('sha256').update(data).digest('hex')!==expected)throw new Error('Electron checksum mismatch');fs.writeFileSync(path.join(dir,'electron.zip'),data);console.log('Electron verified');})().catch(e=>{console.error(e);process.exitCode=1;});
