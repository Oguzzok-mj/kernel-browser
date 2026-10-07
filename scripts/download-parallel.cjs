const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const crypto = require('node:crypto');
const model = require('../src/model.cjs');
const dir = path.resolve(__dirname, '../../models'); fs.mkdirSync(dir, { recursive: true });
const chunksDir = path.join(dir, 'chunks-8mb'); fs.mkdirSync(chunksDir, { recursive: true });
const chunkSize = 8 * 1024 * 1024, count = Math.ceil(model.bytes / chunkSize);
const oldDir=path.join(dir,'chunks');
if(fs.existsSync(oldDir))for(const name of fs.readdirSync(oldDir).filter(n=>/^\d{3}$/.test(n))){const i=Number(name),data=fs.readFileSync(path.join(oldDir,name));for(let part=0;part<Math.ceil(data.length/chunkSize);part++){const target=path.join(chunksDir,String(i*4+part).padStart(3,'0'));if(!fs.existsSync(target))fs.writeFileSync(target,data.subarray(part*chunkSize,(part+1)*chunkSize));}}
let next = 0, completed = 0, received = 0, last = Date.now();
async function worker() {
  while (next < count) {
    const i = next++, start = i * chunkSize, end = Math.min(model.bytes, start + chunkSize) - 1;
    const file = path.join(chunksDir, String(i).padStart(3, '0'));
    if (fs.existsSync(file) && fs.statSync(file).size === end - start + 1) { completed++; received += end - start + 1; continue; }
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch(model.url + '?download=true&segment=' + i + '&attempt=' + attempt, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(45000) });
        if (res.status !== 206 || res.headers.get('content-range') !== `bytes ${start}-${end}/${model.bytes}`) throw new Error('Unexpected range response');
        const source = Readable.fromWeb(res.body);
        await pipeline(source, fs.createWriteStream(file + '.part'));
        if (fs.statSync(file + '.part').size !== end - start + 1) throw new Error('Incomplete range');
        fs.renameSync(file + '.part', file); completed++; received += end - start + 1;
        if (Date.now() - last > 5000) { last = Date.now(); console.log(`${Math.round(received/model.bytes*100)}% (${completed}/${count})`); }
        break;
      } catch (e) { if (attempt === 4) throw e; await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); }
    }
  }
}
(async () => {
  await Promise.all(Array.from({ length: 8 }, worker));
  const dest = path.join(dir, model.file); const out = fs.createWriteStream(dest + '.assembling'); const hash = crypto.createHash('sha256');
  for (let i=0;i<count;i++) {
    for await (const chunk of fs.createReadStream(path.join(chunksDir, String(i).padStart(3,'0')))) {
      hash.update(chunk); if (!out.write(chunk)) await new Promise(r => out.once('drain', r));
    }
  }
  await new Promise(r => out.end(r));
  if (hash.digest('hex') !== model.sha256) throw new Error('Model SHA256 mismatch');
  fs.renameSync(dest + '.assembling', dest); console.log('Model verified: ' + model.sha256);
})().catch(e => { console.error(e); process.exitCode = 1; });
