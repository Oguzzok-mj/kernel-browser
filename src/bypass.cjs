const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { parseStrategy, readJSON, atomicWrite } = require('./core.cjs');

class Bypass {
  constructor({ vendor, userData, script, emit }) {
    Object.assign(this, { vendor, userData, script, emit });
    this.root = path.join(vendor, 'zapret', 'zapret-discord-youtube-1.10.3');
    this.status = { phase: 'off', version: '1.10.3', strategy: 'general.bat', detail: '' };
    this.timer = setInterval(() => this.poll(), 1500); this.timer.unref();
  }
  info() { return { ...this.status, profiles: fs.readdirSync(this.root).filter(n => /^general.*\.bat$/.test(n)).sort((a,b) => a === 'general.bat' ? -1 : b === 'general.bat' ? 1 : a.localeCompare(b)) }; }
  notify() { this.emit('bypass-status', this.info()); }
  async start(strategy) {
    if (this.status.phase !== 'off' && this.status.phase !== 'error') throw new Error('Сначала выключите текущую стратегию.');
    if (!this.info().profiles.includes(strategy)) throw new Error('Неизвестная стратегия.');
    const runtime = path.join(this.userData, 'bypass', 'zapret-1.10.3');
    fs.cpSync(this.root, runtime, { recursive: true });
    for (const name of ['list-general-user.txt', 'list-exclude-user.txt', 'ipset-exclude-user.txt']) {
      const target = path.join(runtime, 'lists', name); if (!fs.existsSync(target)) fs.writeFileSync(target, '');
    }
    const args = parseStrategy(fs.readFileSync(path.join(runtime, strategy), 'utf8'), runtime);
    const binary = path.join(runtime, 'bin', 'winws.exe');
    const digest = crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
    // Compare the copied executable to the bundled, verified upstream release.
    if (digest !== crypto.createHash('sha256').update(fs.readFileSync(path.join(this.root, 'bin', 'winws.exe'))).digest('hex')) throw new Error('Повреждены файлы обхода.');
    this.runDir = path.join(this.userData, 'bypass', 'run-' + crypto.randomUUID());
    fs.mkdirSync(this.runDir, { recursive: true });
    atomicWrite(path.join(this.runDir, 'config.json'), { exe: binary, args, digest, parentPid: process.pid });
    fs.writeFileSync(path.join(this.runDir, 'heartbeat'), String(Date.now()));
    this.status = { ...this.status, phase: 'starting', strategy, detail: 'Подтвердите запрос Windows на запуск WinDivert.' };
    this.startedAt = Date.now(); this.notify();
    const quotePS = s => "'" + s.replaceAll("'", "''") + "'";
    const childArgs = '-NoProfile -ExecutionPolicy Bypass -File "' + this.script + '" -RunDir "' + this.runDir + '"';
    const command = 'try { Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList ' + quotePS(childArgs) + ' -ErrorAction Stop | Out-Null } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }';
    const launcher = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, stdio: ['ignore','ignore','pipe'] });
    let error = ''; launcher.stderr.on('data', d => error += d.toString());
    launcher.on('error', e => { this.status.phase = 'error'; this.status.detail = e.message; this.notify(); });
    launcher.on('exit', code => { if (code && this.status.phase === 'starting') { this.status.phase = 'error'; this.status.detail = 'Запуск отменён или не удался. ' + error.trim(); this.notify(); } });
    return this.info();
  }
  poll() {
    if (!this.runDir) return;
    if (['starting','on','stopping'].includes(this.status.phase)) {
      try { fs.writeFileSync(path.join(this.runDir, 'heartbeat'), String(Date.now())); } catch {}
      const result = readJSON(path.join(this.runDir, 'status.json'), null);
      if (result && result.phase !== this.status.phase && !(this.status.phase === 'stopping' && result.phase === 'on')) {
        this.status.phase = result.phase; this.status.detail = result.detail || ''; this.notify();
      }
      if (this.status.phase === 'starting' && Date.now() - this.startedAt > 120000) {
        fs.writeFileSync(path.join(this.runDir, 'stop'), 'stop');
        this.status.phase = 'error'; this.status.detail = 'Запуск не подтверждён. Повторите попытку.'; this.notify();
      }
    }
  }
  stop() {
    if (this.runDir) { try { fs.writeFileSync(path.join(this.runDir, 'stop'), 'stop'); } catch {} }
    if (['starting','on'].includes(this.status.phase)) { this.status.phase = 'stopping'; this.notify(); }
    else if (this.status.phase === 'error') { this.status.phase = 'off'; this.notify(); }
    return this.info();
  }
  dispose() { this.stop(); clearInterval(this.timer); }
}
module.exports = { Bypass };
