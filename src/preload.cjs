const { contextBridge, ipcRenderer } = require('electron');
const allowed = new Set(['state','tab:new','tab:select','tab:close','tab:pin','tab:reorder','tab:menu','navigate','history:navigate','reload','bookmark','panel','overlay','settings','history:clear','bookmark:remove','window','ai:install','ai:send','ai:cancel','bypass:start','bypass:stop','download:open','download:cancel','external']);
for(const name of ['settings:reset','download:directory','privacy:clear','permissions:reset','home','find','find:close','browser:menu'])allowed.add(name);
for(const name of ['account:create','account:login','account:logout','account:update','account:password','account:avatar','account:copy-id'])allowed.add(name);
for(const name of ['tools','palette:set','connection:apply','connection:proxy','connection:remove-profile','connection:options','connection:rule','connection:diagnose','download:pause','download:resume','download:retry'])allowed.add(name);
const events = new Set(['state','focus-address','ai-status','ai-token','ai-action','ai-done','bypass-status','ask-selection']);
for(const name of ['tools-log','tools-result','tools-command','palette-open','palette-close','page-context-enable'])events.add(name);
events.add('focus-find');events.add('find-result');
contextBridge.exposeInMainWorld('kernel', {
  call: (channel, payload) => { if (!allowed.has(channel)) return Promise.reject(new Error('Unknown action')); return ipcRenderer.invoke(channel, payload); },
  on: (channel, callback) => { if (!events.has(channel)) return; const listener = (_event, payload) => callback(payload); ipcRenderer.on(channel, listener); return () => ipcRenderer.removeListener(channel, listener); }
});
