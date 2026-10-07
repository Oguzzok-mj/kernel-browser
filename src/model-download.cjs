const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const model = require('./model.cjs');

async function downloadModel(dest, signal, onProgress) {
  const directory = dest + '.chunks'; await fsp.mkdir(directory, { recursive: true });
  const size = 8 * 1024 * 1024, count = Math.ceil(model.bytes / size);
  let next = 0, received = 0;
  const report = () => onProgress(Math.min(99, Math.floor(received / model.bytes * 100)));
  async function worker() {
    while (next < count) {
      signal.throwIfAborted(); const i = next++, start = i * size, end = Math.min(model.bytes,start + size)-1;
      const file = path.join(directory,String(i).padStart(3,'0'));
      try { if ((await fsp.stat(file)).size === end-start+1) { received += end-start+1; report(); continue; } } catch {}
      for (let attempt = 0; attempt < 5; attempt++) {
        signal.throwIfAborted();
        try {
          const combined = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
          const res = await fetch(model.url + '?download=true&segment=' + i + '&retry=' + attempt, { headers: { Range: `bytes=${start}-${end}` }, signal: combined });
          if (res.status !== 206 || res.headers.get('content-range') !== `bytes ${start}-${end}/${model.bytes}`) { await res.body?.cancel(); throw new Error('Не удалось загрузить часть модели: ' + res.status); }
          await pipeline(Readable.fromWeb(res.body),fs.createWriteStream(file+'.part'),{signal:combined});
          if ((await fsp.stat(file+'.part')).size !== end-start+1) throw new Error('Неполная часть модели.');
          await fsp.rename(file+'.part',file); received += end-start+1; report(); break;
        } catch (error) { if(signal.aborted || attempt===4) throw error; }
      }
    }
  }
  const results = await Promise.allSettled(Array.from({length:6},worker));
  const failure = results.find(r=>r.status==='rejected'); if(failure)throw failure.reason;
  signal.throwIfAborted();
  const hash = crypto.createHash('sha256');
  const parts = async function* () {
    for(let i=0;i<count;i++)for await(const data of fs.createReadStream(path.join(directory,String(i).padStart(3,'0')))) { signal.throwIfAborted(); hash.update(data); yield data; }
  };
  await pipeline(Readable.from(parts()),fs.createWriteStream(dest+'.part'),{signal});
  if(hash.digest('hex')!==model.sha256){
    for(let i=0;i<count;i++)await fsp.unlink(path.join(directory,String(i).padStart(3,'0'))).catch(()=>{});
    await fsp.unlink(dest+'.part').catch(()=>{});
    throw new Error('Контрольная сумма модели не совпала. Повторите загрузку.');
  }
  await fsp.rename(dest+'.part',dest);
  // Remove only the exact, verified chunk files owned by this downloader.
  for(let i=0;i<count;i++)await fsp.unlink(path.join(directory,String(i).padStart(3,'0'))).catch(()=>{});
  await fsp.rmdir(directory).catch(()=>{}); onProgress(100);
}
module.exports = { downloadModel };
