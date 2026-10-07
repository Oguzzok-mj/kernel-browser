const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const model = require('../src/model.cjs');
(async () => {
  const dir = path.resolve(__dirname, '../../models'); fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, model.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size === model.bytes) { console.log('Model exists'); return; }
  const res = await fetch(model.url); if (!res.ok) throw new Error('HTTP ' + res.status);
  const hash = crypto.createHash('sha256'); let bytes = 0; let last = 0;
  const stream = Readable.fromWeb(res.body);
  stream.on('data', d => { bytes += d.length; hash.update(d); if (Date.now() - last > 10000) { last = Date.now(); console.log(Math.round(bytes / model.bytes * 100) + '%'); } });
  await pipeline(stream, fs.createWriteStream(dest + '.part'));
  if (bytes !== model.bytes || hash.digest('hex') !== model.sha256) throw new Error('SHA256 mismatch');
  fs.renameSync(dest + '.part', dest); console.log('Model verified: ' + model.sha256);
})().catch(e => { console.error(e); process.exitCode = 1; });
