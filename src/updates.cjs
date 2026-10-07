const path = require('node:path');
const { atomicWrite, readJSON } = require('./core.cjs');

// One installation-wide preference, independent of the active local account.
class Updates {
  constructor({ updater, root, enabled = true, changed = () => {}, supported = true }) {
    Object.assign(this, { updater, root, changed, supported });
    this.preferenceFile = path.join(root, 'update-settings.json');
    this.automatic = readJSON(this.preferenceFile, {})?.automatic !== false;
    this.status = supported ? 'idle' : 'unsupported';
    this.version = ''; this.progress = 0; this.lastChecked = null; this.busy = null;
    this.listeners = [];
    if (!supported) return;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.autoRunAppAfterInstall = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    // Full installer downloads avoid depending on old releases having blockmaps.
    updater.disableDifferentialDownload = true;
    updater.disableWebInstaller = true;
    for (const [event, listener] of Object.entries({
      'checking-for-update': () => this.update('checking'),
      'update-available': info => { this.version = info.version; this.update('available'); },
      'update-not-available': () => { this.version = ''; this.update('current'); },
      'download-progress': p => { this.progress = Math.max(0, Math.min(100, Number(p.percent) || 0)); this.update('downloading'); },
      'update-downloaded': info => { this.version = info.version; this.progress = 100; this.update('downloaded'); },
      'error': () => this.update('error'),
      'update-cancelled': () => this.update('idle')
    })) { updater.on(event, listener); this.listeners.push([event, listener]); }
    if (enabled) this.start();
  }
  info() { return { automatic: this.automatic, supported: this.supported, status: this.status, version: this.version, progress: Math.round(this.progress), lastChecked: this.lastChecked }; }
  update(status) {
    this.status = status;
    try { atomicWrite(path.join(this.root, 'update-status.json'), this.info()); } catch {}
    this.changed();
  }
  start() {
    if (!this.supported || this.timer) return;
    this.first = setTimeout(() => { if (this.automatic) void this.check(); }, 15000);
    this.timer = setInterval(() => { if (this.automatic) void this.check(); }, 6 * 60 * 60 * 1000);
    this.first.unref?.(); this.timer.unref?.();
  }
  configure(automatic) {
    if (typeof automatic !== 'boolean') throw new Error('Некорректная настройка обновлений.');
    this.automatic = automatic;
    atomicWrite(this.preferenceFile, { automatic });
    // Installation is triggered by main only after storage and windows have closed.
    this.changed();
    if (automatic && this.status !== 'downloaded') void this.check();
    return this.info();
  }
  check(manual = false) {
    if (!this.supported || (!manual && !this.automatic)) return Promise.resolve(this.info());
    if (this.busy) return this.busy;
    if (this.status === 'downloaded') return Promise.resolve(this.info());
    this.busy = this.runCheck(manual).finally(() => { this.busy = null; });
    return this.busy;
  }
  async runCheck(manual) {
    this.lastChecked = Date.now();
    try {
      const result = await this.updater.checkForUpdates();
      if (result && this.status === 'available' && (manual || this.automatic)) {
        this.progress = 0; this.update('downloading');
        await this.updater.downloadUpdate();
      }
    } catch { this.update('error'); }
    return this.info();
  }
  shouldInstallOnQuit() { return this.supported && this.automatic && !this.endingSession && this.status === 'downloaded'; }
  install(relaunch = true) {
    if (this.status !== 'downloaded') throw new Error('Обновление ещё не скачано.');
    // Main calls this only after all windows close and profile/storage flush completes.
    this.updater.quitAndInstall(true, relaunch);
  }
  sessionEnding() { this.endingSession = true; }
  dispose() {
    clearTimeout(this.first); clearInterval(this.timer);
    for (const [event, listener] of this.listeners) this.updater.removeListener(event, listener);
  }
}
module.exports = { Updates };
