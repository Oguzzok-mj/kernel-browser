const fs = require('node:fs');
const path = require('node:path');

function normalizeAddress(input) {
  const value = String(input || '').trim().slice(0, 8192);
  if (!value || value === 'kernel://newtab') return 'kernel://newtab';
  if (/^https?:\/\//i.test(value)) return new URL(value).href;
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^(localhost|[^\s/:]+\.[^\s/:]+):\d+([/?#]|$)/i.test(value)) throw new Error('Поддерживаются адреса http и https.');
  if (/^(localhost|\[[\da-f:]+\]|[\d.]+)(:\d+)?([/?#]|$)/i.test(value)) return new URL('http://' + value).href;
  if (/^[^\s/:]+\.[\p{L}\d-]{2,}(:\d+)?([/?#]|$)/iu.test(value)) return new URL('https://' + value).href;
  return 'https://www.google.com/search?q=' + encodeURIComponent(value);
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2));
  fs.renameSync(file + '.tmp', file);
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return fallback; }
}

function parseStrategy(text, root) {
  const start = text.indexOf('"%BIN%winws.exe"');
  if (start < 0) throw new Error('Не найден winws в стратегии.');
  const command = text.slice(start + '"%BIN%winws.exe"'.length)
    .replace(/\^\r?\n/g, ' ').trim()
    .replaceAll('%BIN%', path.join(root, 'bin') + path.sep)
    .replaceAll('%LISTS%', path.join(root, 'lists') + path.sep)
    .replaceAll('%GameFilterTCP%', '12').replaceAll('%GameFilterUDP%', '12');
  if (command.includes('%') || /[\r\n&|<>]/.test(command)) throw new Error('Неизвестный формат стратегии.');
  const args = (command.match(/(?:[^\s"]+|"[^"]*")+/g) || []).map(s => s.replaceAll('"', ''));
  if (!args.length || args.some(a => !a.startsWith('--'))) throw new Error('Некорректные аргументы стратегии.');
  return args;
}

function clampBounds(width, height, panel, collapsed = false) {
  const left = collapsed ? 72 : 232;
  const right = panel ? 398 : 38;
  return { x: left, y: 48, width: Math.max(1, width - left - right), height: Math.max(1, height - 48) };
}

module.exports = { normalizeAddress, atomicWrite, readJSON, parseStrategy, clampBounds };
