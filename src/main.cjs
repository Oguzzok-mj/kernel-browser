const { app, BrowserWindow, WebContentsView, ipcMain, Menu, dialog, session, shell, nativeTheme, safeStorage, clipboard } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');
const { normalizeAddress, atomicWrite, readJSON, clampBounds } = require('./core.cjs');
const { Assistant } = require('./ai.cjs');
const { Bypass } = require('./bypass.cjs');
const { DEFAULTS, sanitizeSettings, viewBounds, searchAddress } = require('./settings.cjs');
const {loadFavicon,validFavicon}=require('./favicon.cjs');
const {Accounts}=require('./accounts.cjs');
const {permissionAllowed}=require('./permissions.cjs');
const {ConnectionManager}=require('./connection/manager.cjs');
const {ToolService}=require('./tools/service.cjs');
app.commandLine.appendSwitch('dns-prefetch-disable');

const smoke = process.argv.includes('--smoke-test');
const accountSmokeIndex=process.argv.indexOf('--account-smoke-test');
const authSmokeIndex=process.argv.indexOf('--auth-smoke-test');
if (smoke||accountSmokeIndex>=0||authSmokeIndex>=0||process.argv.includes('--tools-smoke-test')) app.disableHardwareAcceleration();
if (smoke) app.setPath('userData', path.resolve(__dirname, '../../smoke-profile-' + Date.now()));
else if(accountSmokeIndex>=0)app.setPath('userData',path.resolve(process.argv[accountSmokeIndex+1]));
else if(authSmokeIndex>=0)app.setPath('userData',path.resolve(process.argv[authSmokeIndex+1]));
else if(process.argv.includes('--tools-smoke-test'))app.setPath('userData',path.resolve(process.argv[process.argv.indexOf('--tools-smoke-test')+1]));
else app.setPath('userData', path.join(app.getPath('appData'), 'Kernel'));
app.setName('Kernel');
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
let win, assistant, bypass, activeId, panel = '', overlay = false, findVisible = false, stateTimer, saveTimer;
const tabs = []; const closedTabs = []; const downloads = []; let attached = null;
const pageWindows=new Set();
const rootData=app.getPath('userData');
let accounts,profileFile,saved,settings,bookmarks,history,webPartition,uiPartition;
let htmlFullscreen='',manualFullscreen=false,tools,connection,utilityOverlay=false;
const toolsSmokeIndex=process.argv.indexOf('--tools-smoke-test');
const getLaunchURL=args=>args.find(a=>typeof a==='string'&&a.length<=8192&&/^https?:\/\//i.test(a))||'';let pendingLaunchURL=getLaunchURL(process.argv.slice(1));
const uiFile = path.join(__dirname, 'index.html');
const uiURL = pathToFileURL(uiFile).href;
const vendor = app.isPackaged ? path.join(process.resourcesPath, 'vendor') : path.resolve(__dirname, '../vendor');
const bundledModels = app.isPackaged ? path.join(process.resourcesPath, 'models') : path.resolve(__dirname, '../../models');

function emit(channel, data) { if (win && !win.isDestroyed()) win.webContents.send(channel, data); }
function metadata(t) {
  const wc = t.view?.webContents;
  return { id: t.id, title: t.title, url: t.url, favicon:t.favicon||'',pinned: t.pinned, loading: t.loading, error: t.error || '',
    back: !!wc && !wc.isDestroyed() && wc.navigationHistory.getActiveIndex() > 0, forward: !!wc && !wc.isDestroyed() && wc.navigationHistory.getActiveIndex() < wc.navigationHistory.length() - 1,
    audible: !!wc && !wc.isDestroyed() && wc.isCurrentlyAudible(), muted: t.muted || false, sleeping:!!t.sleeping, route:connection?.state(t.id,t.url) };
}
function state() { return { tabs: tabs.map(metadata), activeId, panel, overlay, findVisible, bookmarks, history: history.slice(0, 100), downloads, settings, ai: assistant?.info(), bypass: bypass?.info(), maximized: win?.isMaximized() || false, version: app.getVersion(), darkSystem:nativeTheme.shouldUseDarkColors, downloadDirectory:settings.downloadDirectory||app.getPath('downloads'),account:accounts.info(),accounts:accounts.list(),contentFullscreen:!!htmlFullscreen,tools:tools?.info(),connection:connection?.info(activeId,tabs.find(t=>t.id===activeId)?.url),utilityOverlay }; }
function broadcast() { clearTimeout(stateTimer); stateTimer = setTimeout(() => emit('state', state()), 25); }
function persist() {
  clearTimeout(saveTimer); saveTimer = setTimeout(() => atomicWrite(profileFile, {
    tabs: tabs.map(t => ({ url: t.url, title: t.title, favicon:t.favicon||'',pinned: t.pinned,route:connection?.tabs.get(t.id) })), activeIndex: tabs.findIndex(t => t.id === activeId), migrationVersion:3, settings, bookmarks, history, downloads:downloads.map(d=>({...d}))
  }), 250);
}
function layout() {
  if (!win || win.isDestroyed()) return;
  const tab = tabs.find(t => t.id === activeId);
  const desired = !overlay && !utilityOverlay && !tools?.responsive && tab && !tab.error && tab.url !== 'kernel://newtab' ? tab.view : null;
  if (attached && attached !== desired) { win.contentView.removeChildView(attached); attached = null; }
  if (desired && desired !== attached) { win.contentView.addChildView(desired); attached = desired; }
  const [width,height]=win.getContentSize();let bounds=htmlFullscreen||tools?.focus?{x:0,y:0,width,height}:viewBounds(width,height,panel,settings,findVisible);
  if(!htmlFullscreen&&!tools?.focus&&(tools?.responsive||tools?.splitId))bounds={...bounds,y:bounds.y+30,height:Math.max(1,bounds.height-30)};
  if(attached)attached.setBounds(tools?.splitId&&!htmlFullscreen?{...bounds,width:Math.floor(bounds.width/2)-2}:bounds);
  tools?.layout(bounds,overlay||utilityOverlay||!!htmlFullscreen);
}
function exitContentFullscreen(notifyPage=true){
  if(!htmlFullscreen)return;
  const wc=tabs.find(t=>t.id===htmlFullscreen)?.view?.webContents;htmlFullscreen='';
  if(notifyPage&&wc&&!wc.isDestroyed())wc.executeJavaScript('if(document.fullscreenElement)document.exitFullscreen()').catch(()=>{});
  if(win&&!win.isDestroyed())win.setFullScreen(manualFullscreen);layout();broadcast();
}
async function flushSessions(){const sessions=new Set([session.fromPartition(webPartition),session.fromPartition(uiPartition),...Array.from(connection?.contexts.values()||[],c=>c.session)]);for(const t of tabs)if(t.view&&!t.view.webContents.isDestroyed())sessions.add(t.view.webContents.session);for(const child of pageWindows)if(!child.isDestroyed())sessions.add(child.webContents.session);await Promise.all(Array.from(sessions,async ses=>{ses.flushStorageData();await ses.cookies.flushStore();}));}
async function restartProfile(){await flushSessions();if(process.env.PORTABLE_EXECUTABLE_FILE)app.relaunch({execPath:process.env.PORTABLE_EXECUTABLE_FILE,args:process.argv.slice(1).filter(a=>!/^https?:\/\//i.test(a))});else app.relaunch({args:process.argv.slice(1).filter(a=>!/^https?:\/\//i.test(a))});win.close();}
let accountChanging=false;
async function changeAccount(action,data){if(accountChanging)throw new Error('Открывается другой профиль.');accountChanging=true;try{const result=await accounts[action](data);setTimeout(restartProfile,150);return result;}catch(e){accountChanging=false;throw e;}}
function focusAddress() { win.webContents.focus(); emit('focus-address'); }
function onKey(event, input) {
  if (input.type !== 'keyDown') return;
  const ctrl = input.control || input.meta; const key = input.key.toLowerCase(); let handled = true;
  if(htmlFullscreen&&(ctrl||input.alt))exitContentFullscreen();
  if(key==='escape'&&htmlFullscreen){exitContentFullscreen();event.preventDefault();return;}
  if(ctrl&&key==='c')setTimeout(()=>tools?.remember(),100);
  if(key==='escape'&&tools?.focus){tools.focus=false;layout();broadcast();event.preventDefault();return;}
  if(key==='escape'&&utilityOverlay){utilityOverlay=false;emit('palette-close');layout();broadcast();event.preventDefault();return;}
  if(ctrl&&(key==='k'||(key==='p'&&input.shift))){if(tools)tools.focus=false;utilityOverlay=true;layout();broadcast();emit('palette-open');}
  else if (ctrl && key === 'l') focusAddress();
  else if (ctrl && key === 't' && input.shift) restoreClosed();
  else if (ctrl && key === 't') createTab();
  else if (ctrl && key === 'w') closeTab(activeId);
  else if (ctrl && key === 'r' || key === 'f5') tabs.find(t => t.id === activeId)?.view?.webContents.reload();
  else if (ctrl && key === 'tab') { const i = tabs.findIndex(t => t.id === activeId); selectTab(tabs[(i + (input.shift ? tabs.length - 1 : 1)) % tabs.length]?.id); }
  else if (ctrl && key === 'd') bookmarkActive();
  else if (ctrl && key === 'f' && !overlay) { findVisible=true;layout();broadcast();win.webContents.focus();emit('focus-find'); }
  else if (ctrl && key === 'p') tabs.find(t=>t.id===activeId)?.view?.webContents.print({});
  else if (ctrl && key === ',') { overlay=true;panel='';closeFind();layout();broadcast(); }
  else if (ctrl && ['+', '=', '-', '0'].includes(key)) zoom(key);
  else if (ctrl && key === 'j') { panel = panel === 'downloads' ? '' : 'downloads'; overlay=false;layout(); broadcast(); }
  else if (input.alt && key === 'arrowleft') navigateHistory('back');
  else if (input.alt && key === 'arrowright') navigateHistory('forward');
  else if (key === 'f11') {if(htmlFullscreen)exitContentFullscreen();else{manualFullscreen=!manualFullscreen;win.setFullScreen(manualFullscreen);layout();broadcast();}}
  else if (key === 'escape' && findVisible) closeFind();
  else if (key === 'escape' && overlay) { overlay = false; layout(); broadcast(); }
  else handled = false;
  if (handled) event.preventDefault();
}
function allowedNavigation(event, url) { if (!/^https?:\/\//i.test(url)) event.preventDefault(); }
function installPageWindowHandler(wc){
  wc.setWindowOpenHandler(({url})=>{
    if((!/^https?:\/\//i.test(url)&&url!=='about:blank')||pageWindows.size>=20)return {action:'deny'};
    return {action:'allow',overrideBrowserWindowOptions:{parent:win,frame:true,autoHideMenuBar:true,width:600,height:760,minWidth:420,minHeight:400,show:!process.argv.includes('--background-test'),backgroundColor:'#101112',icon:path.join(__dirname,'../assets/kernel.png'),webPreferences:{session:wc.session,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false}}};
  });
  wc.on('did-create-window',child=>{
    pageWindows.add(child);child.setMenu(null);const childWC=child.webContents,childSession=childWC.session;setupSession(childSession);installPageWindowHandler(childWC);
    const updateTitle=()=>{try{child.setTitle(new URL(childWC.getURL()).host+' — Kernel');}catch{child.setTitle('Kernel');}};
    childWC.on('page-title-updated',event=>{event.preventDefault();updateTitle();});childWC.on('did-navigate',updateTitle);
    childWC.on('will-navigate',allowedNavigation);childWC.on('will-redirect',allowedNavigation);
    child.on('closed',()=>{pageWindows.delete(child);childSession.cookies.flushStore().catch(()=>{});});
  });
}
function ensureView(tab) {
  if (tab.view || tab.url === 'kernel://newtab') return;
  tab.view = new WebContentsView({ webPreferences: { partition: connection?.partitionFor(tab.id,tab.url)||webPartition, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, spellcheck: settings.spellcheck } });
  const wc = tab.view.webContents;tab.networkPartition=connection?.partitionFor(tab.id,tab.url)||webPartition;tab.sleeping=false;
  if(connection?.policy(tab.id,tab.url).mode!=='direct')wc.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
  wc.setZoomFactor(settings.defaultZoom/100);
  wc.setAudioMuted(!!tab.muted);
  wc.on('before-input-event', onKey);
  const routeNavigation=(event,url,isInPlace,isMainFrame=true)=>{allowedNavigation(event,url);if(isMainFrame&&/^https?:\/\//i.test(url)&&connection&&connection.partitionFor(tab.id,url)!==tab.networkPartition){event.preventDefault();replaceTabRoute(tab,url);}};
  wc.on('will-navigate',routeNavigation);wc.on('will-redirect',routeNavigation);wc.on('did-start-navigation',(_e,url,inPlace,isMainFrame)=>{if(isMainFrame&&!inPlace)tab.redirects=[];});wc.on('will-redirect',(_e,url,_inPlace,isMainFrame)=>{if(isMainFrame){tab.redirects||=[];tab.redirects.push({url:wc.getURL()||tab.url,to:url,status:'redirect'});}});
  installPageWindowHandler(wc);
  wc.on('did-start-loading', () => { tab.loading = true; tab.error = ''; layout(); broadcast(); });
  wc.on('did-stop-loading', () => { tab.loading = false; broadcast(); });
  wc.on('page-title-updated', (_e, title) => { tab.title = title.slice(0, 200); broadcast(); persist(); });
  wc.on('page-favicon-updated',async(_e,urls)=>{const page=wc.getURL();const candidate=urls.find(url=>/^https?:\/\//i.test(url));if(!candidate||candidate===tab.faviconSource)return;tab.faviconSource=candidate;const image=await loadFavicon(wc.session,candidate);if(!wc.isDestroyed()&&wc.getURL()===page&&image){tab.favicon=image;broadcast();persist();}});
  const navigated = (_e, url) => {
    if (!/^https?:\/\//i.test(url)) return;
    if(new URL(tab.url).origin!==new URL(url).origin){tab.favicon='';tab.faviconSource='';}
    tab.url = url; tab.error = ''; broadcast(); persist();
  };
  wc.on('did-navigate', (_e,_url,code)=>{tab.finalHTTPStatus=Number.isInteger(code)?code:null;});wc.on('did-navigate', navigated); wc.on('did-navigate-in-page', navigated);
  wc.on('did-finish-load', () => {
    if (settings.saveHistory && tab.url.startsWith('http')) { history.unshift({ url: tab.url, title: tab.title, at: Date.now() }); if (history.length > 500) history.length = 500; persist(); }
    broadcast();
  });
  wc.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    tab.error = connection?.policy(tab.id,tab.url).mode!=='direct'?'Не удалось подключиться через выбранный маршрут. Откройте Connection, чтобы повторить или выбрать Direct.':`${description} (${code})`;connection?.requestFailed(tab.id); tab.loading = false; layout(); broadcast();
  });
  wc.on('render-process-gone', () => { tab.error = 'Процесс страницы завершился. Нажмите «Обновить».'; tab.loading = false; layout(); broadcast(); });
  wc.on('enter-html-full-screen',()=>{if(tab.id!==activeId)return;htmlFullscreen=tab.id;overlay=false;closeFind();win.setFullScreen(true);layout();broadcast();});
  wc.on('leave-html-full-screen',()=>{if(htmlFullscreen===tab.id)exitContentFullscreen(false);});
  wc.on('media-started-playing', broadcast); wc.on('media-paused', broadcast);
  wc.on('found-in-page',(_e,result)=>{if(tab.id===activeId)emit('find-result',{active:result.activeMatchOrdinal,total:result.matches});});
  wc.on('context-menu', (_e, params) => {
    const items = [];
    if (params.linkURL && /^https?:/.test(params.linkURL)) items.push({ label: 'Открыть ссылку в новой вкладке', click: () => createTab(params.linkURL) });
    if (params.selectionText) items.push({ label: 'Копировать', role: 'copy' }, { label: 'Объяснить с ИИ', click: () => { panel = 'ai'; layout(); broadcast(); emit('ask-selection', params.selectionText.slice(0, 6000)); } });
    if (params.isEditable) items.push({ role: 'cut', label: 'Вырезать' }, { role: 'paste', label: 'Вставить' });
    items.push({type:'separator'},{label:'Копировать чистую ссылку',click:()=>tools.copy(require('./tools/pure.cjs').cleanURL(params.linkURL||tab.url))},{label:'Сохранить страницу',click:()=>runTool('save',{mode:'snapshot'})},{label:'Скриншот всей страницы',click:()=>runTool('screenshot',{kind:'full'})},{label:'Инспектор элемента / шрифта',click:()=>runTool('inspect')},{label:'Открыть Split View',click:()=>{openUtility('tools');emit('tools-command','split');}},{label:'Спросить ИИ о странице',click:()=>{openUtility('ai');emit('ask-selection','Кратко перескажи текущую страницу.');emit('page-context-enable');}});
    items.push({ type: 'separator' }, { label: 'Назад', enabled: wc.navigationHistory.getActiveIndex() > 0, click: () => navigateHistory('back') }, { label: 'Обновить', click: () => wc.reload() });
    if(/^https:\/\//i.test(wc.getURL()))items.push({label:'Открыть в системном браузере',click:()=>shell.openExternal(wc.getURL())});
    Menu.buildFromTemplate(items).popup({ window: win });
  });
  const loading=tab.url;const prepare=connection?connection.prepare(tab.id,loading):Promise.resolve(wc.session);prepare.then(ses=>{if(wc.isDestroyed()||tab.view?.webContents!==wc)return;if(ses!==wc.session){replaceTabRoute(tab,loading);return;}wc.loadURL(loading).catch(()=>{});}).catch(e=>{if(!wc.isDestroyed()){tab.error=e.message;tab.loading=false;layout();broadcast();}});
}
function openUtility(value){panel=value;overlay=false;utilityOverlay=false;layout();broadcast();}
async function runTool(name,input={}){if(['save','inspect','screenshot','pdf','markdown'].includes(name))openUtility('tools');try{const result=await tools.action(name,input);emit('tools-result',{name,result});broadcast();return result;}catch(e){tools.log('ERROR',e.message);emit('tools-result',{name,error:e.message});throw e;}}
function suspendTab(tab){if(tab.view){const view=tab.view;tab.view=null;if(attached===view){win.contentView.removeChildView(view);attached=null;}if(!view.webContents.isDestroyed())view.webContents.close({waitForBeforeUnload:false});}tab.sleeping=true;}
function replaceTabRoute(tab,url=tab.url){suspendTab(tab);tab.url=url;tab.error='';ensureView(tab);layout();broadcast();persist();}
async function applyRoute(data){const tab=tabs.find(t=>t.id===(data.tabId||activeId));if(!tab)throw Error('Вкладка закрыта.');connection.assign({...data,tabId:tab.id,url:tab.url});for(const t of tabs)if(t.view&&(t.id===tab.id||t.networkPartition!==connection.partitionFor(t.id,t.url)))replaceTabRoute(t);layout();broadcast();persist();}
function createTab(address = settings.newTab==='home'?settings.homepage:'kernel://newtab', opts = {}) {
  const url = normalizeAddress(address); if (tabs.length >= 80) throw new Error('Закройте несколько вкладок: лимит 80.');
  const tab = { id: crypto.randomUUID(), url, title: opts.title || (url === 'kernel://newtab' ? 'Новая вкладка' : new URL(url).hostname), favicon:validFavicon(opts.favicon),pinned: !!opts.pinned, loading: false, view: null };
  if(opts.route&&['direct','smart','tunnel','proxy'].includes(opts.route.mode))connection.tabs.set(tab.id,opts.route);
  if (tab.pinned) tabs.splice(tabs.filter(t => t.pinned).length, 0, tab); else tabs.push(tab);
  if (opts.activate !== false) selectTab(tab.id); else broadcast();
  persist(); return tab.id;
}
function selectTab(id) { if(htmlFullscreen&&htmlFullscreen!==id)exitContentFullscreen();const tab = tabs.find(t => t.id === id); if (!tab) return; if(activeId!==id){closeFind();if(tools?.responsive){tools.detachAux();tools.responsive=null;}if(tools?.splitId===id)tools.split('');}activeId = id;tab.lastAccessed=Date.now(); overlay = false; ensureView(tab); layout(); broadcast(); persist(); }
function closeTab(id) {
  if(htmlFullscreen===id)exitContentFullscreen();
  const i = tabs.findIndex(t => t.id === id); if (i < 0) return;
  const tab = tabs[i]; closedTabs.unshift({ url: tab.url, title: tab.title, favicon:tab.favicon,pinned: tab.pinned }); closedTabs.length = Math.min(20, closedTabs.length);
  if (attached && attached === tab.view) { win.contentView.removeChildView(attached); attached = null; }
  const closingView=tab.view;tab.view=null;if (closingView && !closingView.webContents.isDestroyed()) closingView.webContents.close({ waitForBeforeUnload: false });
  connection?.tabs.delete(id);connection?.tabURLs.delete(id);connection?.prune();tabs.splice(i, 1);
  if (!tabs.length) createTab(); else if (activeId === id) selectTab(tabs[Math.min(i, tabs.length - 1)].id);
  layout(); broadcast(); persist();
}
function pinTab(id) { const t = tabs.find(t => t.id === id); if (!t) return; t.pinned = !t.pinned; tabs.sort((a,b) => Number(b.pinned) - Number(a.pinned)); broadcast(); persist(); }
function restoreClosed() { const tab = closedTabs.shift(); if (tab) createTab(tab.url, tab); }
function navigate(input) {
  const search=/^(tabs|history|bookmarks):\s*(.*)$/i.exec(String(input));if(search){const kind=search[1].toLowerCase(),q=search[2].toLowerCase(),items=(kind==='tabs'?tabs:kind==='history'?history:bookmarks).filter(t=>(t.title+' '+t.url).toLowerCase().includes(q)).map(t=>({id:t.id,title:t.title,url:t.url}));openUtility('tools');emit('tools-result',{name:'search',result:{kind,items}});return;}
  if(htmlFullscreen)exitContentFullscreen();
  let url = normalizeAddress(input);
  url=searchAddress(url,settings.search);
  const tab = tabs.find(t => t.id === activeId); if (!tab) return;
  if(new URL(tab.url).origin!==new URL(url).origin){tab.favicon='';tab.faviconSource='';}
  tab.url = url; tab.error = '';
  if (url === 'kernel://newtab') {
    if (attached && attached === tab.view) { win.contentView.removeChildView(attached); attached = null; }
    tab.view?.webContents.close({ waitForBeforeUnload: false }); tab.view = null; tab.title = 'Новая вкладка';
  } else if(tab.view&&tab.networkPartition!==connection.partitionFor(tab.id,url))replaceTabRoute(tab,url);else if (tab.view) { tab.view.webContents.loadURL(url).catch(() => {}); } else ensureView(tab);
  overlay = false; layout(); broadcast(); persist();
}
function navigateHistory(direction) {
  const wc = tabs.find(t => t.id === activeId)?.view?.webContents; if (!wc) return;
  const index = wc.navigationHistory.getActiveIndex();
  if (direction === 'back' && index > 0) wc.navigationHistory.goToIndex(index - 1);
  if (direction === 'forward' && index < wc.navigationHistory.length() - 1) wc.navigationHistory.goToIndex(index + 1);
}
function bookmarkActive() {
  const tab = tabs.find(t => t.id === activeId); if (!tab || !tab.url.startsWith('http')) return;
  const index = bookmarks.findIndex(b => b.url === tab.url); if (index < 0) bookmarks.push({ title: tab.title, url: tab.url }); else bookmarks.splice(index,1);
  persist(); broadcast();
}
function zoom(key) { const wc = tabs.find(t => t.id === activeId)?.view?.webContents; if (wc) {if(key==='0')wc.setZoomFactor(settings.defaultZoom/100);else wc.setZoomLevel(Math.min(5, Math.max(-3, wc.getZoomLevel() + (key === '-' ? -0.5 : 0.5))));} }
function closeFind(){findVisible=false;tabs.find(t=>t.id===activeId)?.view?.webContents.stopFindInPage('clearSelection');layout();broadcast();}
function applyBrowserSettings(next){
  const old={...settings};Object.assign(settings,sanitizeSettings(next,settings));applyDNS();
  session.fromPartition(webPartition).setSpellCheckerEnabled(settings.spellcheck);
  if(old.defaultZoom!==settings.defaultZoom)for(const t of tabs)if(t.view&&!t.view.webContents.isDestroyed())t.view.webContents.setZoomFactor(settings.defaultZoom/100);
  assistant?.configure(settings);layout();persist();broadcast();return settings;
}
async function pageContext() {
  const tab = tabs.find(t => t.id === activeId); if (!tab?.view || tab.view.webContents.isDestroyed()) return { title: 'Новая вкладка', url: 'kernel://newtab', text: '' };
  const text = await tab.view.webContents.executeJavaScript('({text: (document.body?.innerText || "").slice(0, 10000), selection: window.getSelection()?.toString().slice(0, 4000) || ""})');
  return { title: tab.title, url: tab.url, ...text };
}
function registerIPC() {
  const handle = (name, fn) => ipcMain.handle(name, (event, payload) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== uiURL) throw new Error('Недоверенный источник запроса.');
    return fn(payload);
  });
  handle('state', () => state());
  handle('tools',({name,input})=>runTool(name,input));
  handle('palette:set',value=>{utilityOverlay=!!value;layout();broadcast();});
  handle('connection:apply',applyRoute);
  handle('connection:proxy',data=>{const id=connection.saveProxy(data);for(const t of tabs)if(connection.key(t.id,t.url)===id)replaceTabRoute(t);return id;});
  handle('connection:remove-profile',id=>{connection.removeProfile(id);for(const t of tabs)if(t.view&&t.networkPartition!==connection.partitionFor(t.id,t.url))replaceTabRoute(t);});
  handle('connection:options',data=>{for(const key of ['killSwitch','autoFallback','reconnect'])if(typeof data[key]==='boolean')connection.options[key]=data[key];if(['automatic','tunnel','custom'].includes(data.dnsMode))connection.options.dnsMode=data.dnsMode;if(data.customDoh!==undefined){if(data.customDoh){const url=new URL(data.customDoh);if(url.protocol!=='https:')throw Error('DoH требует HTTPS.');connection.options.customDoh=url.href;}else connection.options.customDoh='';}connection.save();applyDNS();broadcast();});
  handle('connection:rule',({host,action,mode,profileId})=>{const rule=connection.sites[host];if(!rule)return;if(action==='update'){connection.assign({tabId:'rule-editor',url:'https://'+host,mode,profileId,scope:'site',enabled:rule.enabled!==false});}else if(action==='delete')delete connection.sites[host];else rule.enabled=action==='enable';for(const t of tabs)if(t.view&&t.networkPartition!==connection.partitionFor(t.id,t.url))replaceTabRoute(t);connection.save();broadcast();});
  handle('connection:diagnose',()=>connection.diagnose(activeId,tabs.find(t=>t.id===activeId).url));
  handle('download:pause',id=>{const d=downloads.find(d=>d.id===id);if(d?.item){d.item.pause();d.paused=true;broadcast();}});
  handle('download:resume',id=>{const d=downloads.find(d=>d.id===id);if(d?.item?.canResume()){d.item.resume();d.paused=false;broadcast();}});
  handle('download:retry',id=>{const d=downloads.find(d=>d.id===id);if(d?.url&&/^https?:/.test(d.url))tabs.find(t=>t.id===activeId)?.view?.webContents.downloadURL(d.url);});
  handle('account:create',data=>changeAccount('create',data));
  handle('account:login',data=>changeAccount('login',data));
  handle('account:logout',()=>changeAccount('logout'));
  handle('account:update',data=>{const result=accounts.update(data);broadcast();return result;});
  handle('account:password',async data=>{const result=await accounts.changePassword(data);broadcast();return result;});
  handle('account:copy-id',()=>clipboard.writeText(accounts.info().id));
  handle('account:avatar',async()=>{const result=await dialog.showOpenDialog(win,{title:'Аватар',properties:['openFile'],filters:[{name:'Изображения',extensions:['png','jpg','jpeg','webp']}]});if(result.canceled)return;const file=result.filePaths[0],ext=path.extname(file).toLowerCase();if(fs.statSync(file).size>2000000)throw new Error('Выберите изображение размером до 2 МБ.');const mime={'.png':'png','.jpg':'jpeg','.jpeg':'jpeg','.webp':'webp'}[ext];if(!mime)throw new Error('Поддерживаются PNG, JPEG и WebP.');accounts.update({avatar:'data:image/'+mime+';base64,'+fs.readFileSync(file).toString('base64')});broadcast();});
  handle('tab:new', input => createTab(input===undefined&&settings.newTab==='home'?settings.homepage:input)); handle('tab:select', selectTab); handle('tab:close', closeTab); handle('tab:pin', pinTab);
  handle('tab:reorder', ({ id, targetId }) => { const from = tabs.findIndex(t => t.id === id), to = tabs.findIndex(t => t.id === targetId); if (from < 0 || to < 0 || tabs[from].pinned !== tabs[to].pinned) return; const [tab] = tabs.splice(from,1); tabs.splice(to,0,tab); broadcast(); persist(); });
  handle('tab:menu', id => {
    const tab = tabs.find(t => t.id === id); if (!tab) return;
    Menu.buildFromTemplate([{ label: tab.pinned ? 'Открепить' : 'Закрепить', click: () => pinTab(id) }, { label: 'Дублировать', click: () => createTab(tab.url) }, { label: tab.muted ? 'Включить звук' : 'Выключить звук', click: () => { tab.muted = !tab.muted; tab.view?.webContents.setAudioMuted(tab.muted); broadcast(); } }, {type:'separator'},{label:'Route through',submenu:['direct','smart','tunnel','proxy'].map(mode=>({label:{direct:'Direct',smart:'Smart Route',tunnel:'Secure Tunnel · Tor',proxy:'Custom Proxy'}[mode],click:()=>applyRoute({tabId:id,mode,scope:'tab'}).catch(e=>emit('tools-result',{error:e.message}))}))},{label:'Запомнить маршрут для этого сайта',enabled:tab.url.startsWith('http'),click:()=>applyRoute({tabId:id,...connection.policy(id,tab.url),scope:'site'}).catch(()=>{})},{type:'separator'}, { label: 'Закрыть вкладку', click: () => closeTab(id) }]).popup({ window: win });
  });
  handle('navigate', navigate); handle('history:navigate', navigateHistory);
  handle('reload', () => { const t = tabs.find(t => t.id === activeId); if (t?.loading) t.view?.webContents.stop(); else t?.view?.webContents.reload(); });
  handle('bookmark', bookmarkActive);
  handle('panel', value => { if (!['', 'ai', 'bypass', 'downloads', 'history', 'bookmarks','tools','connection'].includes(value)) return; panel = value; overlay = false; layout(); broadcast(); if(value==='ai'&&settings.aiWarmup&&assistant.info().installed&&!assistant.controller)assistant.start().catch(e=>assistant.update('error',e.message)); });
  handle('overlay', value => { overlay = !!value;if(overlay){panel='';closeFind();}layout(); broadcast(); });
  handle('settings',applyBrowserSettings);
  handle('settings:reset',()=>applyBrowserSettings({...DEFAULTS,downloadDirectory:settings.downloadDirectory,sitePermissions:settings.sitePermissions}));
  handle('download:directory',async()=>{const result=await dialog.showOpenDialog(win,{title:'Папка для загрузок',defaultPath:settings.downloadDirectory||app.getPath('downloads'),properties:['openDirectory']});if(!result.canceled&&result.filePaths[0])return applyBrowserSettings({downloadDirectory:result.filePaths[0]});});
  handle('privacy:clear',async options=>{
    const web=session.fromPartition(webPartition);
    if(options?.cache)await web.clearCache();
    if(options?.siteData)await web.clearStorageData({storages:['cookies','localstorage','indexdb','serviceworkers','cachestorage','filesystem']});
    if(options?.history)history.length=0;
    persist();broadcast();return true;
  });
  handle('permissions:reset',()=>applyBrowserSettings({sitePermissions:{}}));
  handle('home',()=>navigate(settings.homepage));
  handle('find',({text,forward=true,findNext=false})=>{const wc=tabs.find(t=>t.id===activeId)?.view?.webContents;if(typeof text!=='string'||!wc)return;if(!text){wc.stopFindInPage('clearSelection');emit('find-result',{active:0,total:0});return;}findVisible=true;layout();broadcast();wc.findInPage(text.slice(0,1000),{forward:!!forward,findNext:!findNext});});
  handle('find:close',closeFind);
  handle('browser:menu',()=>Menu.buildFromTemplate([
    {label:'Новая вкладка',accelerator:'Ctrl+T',click:()=>createTab(settings.newTab==='home'?settings.homepage:undefined)},
    {label:'Чат',click:()=>{panel='ai';overlay=false;layout();broadcast();if(settings.aiWarmup&&assistant.info().installed&&!assistant.controller)assistant.start().catch(e=>assistant.update('error',e.message));}},
    {label:'Загрузки',click:()=>{panel='downloads';overlay=false;layout();broadcast();}},
    {label:'Найти на странице',accelerator:'Ctrl+F',click:()=>{overlay=false;findVisible=true;layout();broadcast();win.webContents.focus();emit('focus-find');}},
    {label:'Печать',accelerator:'Ctrl+P',click:()=>tabs.find(t=>t.id===activeId)?.view?.webContents.print({})},
    {type:'separator'},{label:'Настройки',accelerator:'Ctrl+,',click:()=>{overlay=true;panel='';closeFind();layout();broadcast();}}
  ]).popup({window:win}));
  handle('history:clear', () => { history.length = 0; persist(); broadcast(); });
  handle('bookmark:remove', url => { const i = bookmarks.findIndex(b => b.url === url); if (i >= 0) bookmarks.splice(i,1); persist(); broadcast(); });
  handle('window', action => { if (action === 'close') win.close(); else if (action === 'minimize') win.minimize(); else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize(); });
  handle('ai:install', () => assistant.install()); handle('ai:send', data => assistant.chat(data)); handle('ai:cancel', () => assistant.cancel());
  handle('bypass:start', strategy => bypass.start(strategy)); handle('bypass:stop', () => bypass.stop());
  handle('download:open', id => { const d = downloads.find(d => d.id === id); if (d?.status === 'completed') return shell.showItemInFolder(d.path); });
  handle('download:cancel', id => { downloads.find(d => d.id === id)?.item?.cancel(); });
  handle('external', url => { if (['https://huggingface.co/Qwen/Qwen3-4B-GGUF','https://github.com/Flowseal/zapret-discord-youtube/releases','https://github.com/ggml-org/llama.cpp'].includes(url)) return createTab(url); });
}
function applyDNS() {if(connection?.options.dnsMode==='custom'&&connection.options.customDoh){app.configureHostResolver({secureDnsMode:'secure',secureDnsServers:[connection.options.customDoh]});return;} app.configureHostResolver({ secureDnsMode: settings.secureDns ? 'automatic' : 'off', secureDnsServers: settings.secureDns ? [settings.dnsProvider==='cloudflare'?'https://cloudflare-dns.com/dns-query':'https://dns.google/dns-query'] : [] }); }
const configuredSessions=new WeakSet();
function setupSession(web=session.fromPartition(webPartition)) {
  if(configuredSessions.has(web))return;configuredSessions.add(web);
  web.setSpellCheckerEnabled(settings.spellcheck);
  const active=wc=>!!wc&&(wc===tabs.find(t=>t.id===activeId)?.view?.webContents||Array.from(pageWindows).some(child=>!child.isDestroyed()&&child.webContents===wc&&child.isFocused()));
  const origin=url=>{try{return new URL(url).origin;}catch{return '';}};
  web.setPermissionCheckHandler((wc,permission,securityOrigin)=>permissionAllowed(permission,settings,securityOrigin,active(wc)));
  web.setPermissionRequestHandler((wc,permission,callback,details)=>callback(permissionAllowed(permission,settings,origin(details.requestingUrl||wc.getURL()),active(wc))));
  web.on('will-download', (_event, item) => {
    const d = { id: crypto.randomUUID(), name: item.getFilename(), received: 0, total: item.getTotalBytes(), status: 'progressing', path: '',url:item.getURL(),at:Date.now(),paused:false };
    Object.defineProperty(d, 'item', { value: item, enumerable: false }); downloads.unshift(d); if (downloads.length > 100) downloads.length = 100;
    const directory=settings.downloadDirectory||app.getPath('downloads');
    const filename=path.basename(item.getFilename()).replace(/[<>:"/\\|?*]/g,'_')||'download';
    if(settings.askDownload)item.setSaveDialogOptions({ title: 'Сохранить файл', defaultPath: path.join(directory,filename) });
    else {let target=path.join(directory,filename),i=1;while(fs.existsSync(target)){const ext=path.extname(filename);target=path.join(directory,path.basename(filename,ext)+' ('+(i++)+')'+ext);}item.setSavePath(target);}
    item.on('updated', (_e, status) => { d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.status = status;d.paused=item.isPaused(); broadcast(); });
    item.once('done', (_e, status) => { d.status = status; d.path = item.getSavePath();persist(); broadcast(); });
    panel = 'downloads'; layout(); broadcast();
  });
}
async function boot() {
  accounts=new Accounts({root:rootData,publicKey:fs.readFileSync(path.join(__dirname,'owner-public-key.pem'),'utf8'),vault:safeStorage});
  const provisionIndex=process.argv.indexOf('--import-owner');
  if(provisionIndex>=0){accounts.importOwner(readJSON(process.argv[provisionIndex+1],null));console.log('Owner profile imported.');app.quit();return;}
  if((smoke||toolsSmokeIndex>=0)&&process.env.KERNEL_TEST_OWNER_FILE)accounts.importOwner(readJSON(process.env.KERNEL_TEST_OWNER_FILE,null));
  const storage=accounts.storage();webPartition=storage.webPartition;uiPartition=storage.uiPartition;profileFile=path.join(storage.directory,'browser.json');
  saved=readJSON(profileFile,{});settings=sanitizeSettings(saved.settings);if(saved.migrationVersion!==3)settings.askDownload=false;
  for(const d of (saved.downloads||[]).slice(0,100))downloads.push({...d,status:d.status==='progressing'?'interrupted':d.status,paused:false});
  connection=new ConnectionManager({root:storage.directory,basePartition:webPartition,session,vault:safeStorage,vendor,changed:broadcast,setup:setupSession});
  connection.recovered=id=>{const t=tabs.find(t=>t.id===id);if(t?.view)replaceTabRoute(t);};
  bookmarks=Array.isArray(saved.bookmarks)?saved.bookmarks.slice(0,200):[];history=Array.isArray(saved.history)?saved.history.slice(0,500):[];

  nativeTheme.themeSource = 'system'; Menu.setApplicationMenu(null);nativeTheme.on('updated',broadcast);
  applyDNS(); setupSession();
  win = new BrowserWindow({ width: 1440, height: 920, minWidth: 1040, minHeight: 650, frame: false, show: false, backgroundColor: '#171819', title: 'Kernel', icon: path.join(__dirname, '../assets/kernel.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), partition: uiPartition, contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true } });
  win.webContents.on('will-navigate', e => e.preventDefault()); win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('before-input-event', onKey);
  assistant = new Assistant({ vendor, bundledModels, userData: app.getPath('userData'), emit, pageContext, options:settings });
  bypass = new Bypass({ vendor, userData: app.getPath('userData'), script: app.isPackaged ? path.join(process.resourcesPath, 'bypass-supervisor.ps1') : path.join(__dirname, 'bypass-supervisor.ps1'), emit });
  tools=new ToolService({root:storage.directory,app,win,tabs,connection,activeId:()=>activeId,emit,onKey,changed:()=>{layout();broadcast();},createTab,closeTab,selectTab,ensureView,suspend:suspendTab,closePanel:()=>openUtility(''),openPanel:openUtility});
  registerIPC();
  const restore = Array.isArray(saved.tabs) ? saved.tabs.filter(t=>settings.startup==='restore'||t.pinned).slice(0,80) : [];
  for (const t of restore) { try { createTab(t.url, { title: t.title, favicon:t.favicon,pinned: t.pinned,route:t.route, activate: false }); } catch {} }
  if (!tabs.length) {
    createTab('https://www.youtube.com/', { title:'YouTube', pinned:true, activate:false });
    createTab('https://github.com/', { title:'GitHub', pinned:true, activate:false });
    createTab(settings.startup==='home'?settings.homepage:'kernel://newtab');
  } else if(settings.startup==='restore')selectTab(tabs[Math.min(Math.max(saved.activeIndex || 0,0),tabs.length - 1)].id);
  else createTab(settings.startup==='home'?settings.homepage:'kernel://newtab');
  if(pendingLaunchURL){const url=pendingLaunchURL;pendingLaunchURL='';try{createTab(url);}catch{}}
  win.on('enter-full-screen',layout);win.on('leave-full-screen',()=>{if(htmlFullscreen)exitContentFullscreen();else{manualFullscreen=false;layout();broadcast();}});
  win.on('resize', layout); win.on('maximize', () => { layout(); broadcast(); }); win.on('unmaximize', () => { layout(); broadcast(); });
  let storageFlushed=false,closing=false;
  win.on('close', event => {
    if(!storageFlushed){event.preventDefault();if(!closing){closing=true;flushSessions().catch(error=>console.error('Storage flush failed:',error.message)).finally(()=>{storageFlushed=true;win.close();});}return;}
    for(const child of pageWindows)if(!child.isDestroyed())child.close();tools?.dispose();connection?.dispose();assistant.stop(); bypass.dispose(); clearTimeout(saveTimer);
    atomicWrite(profileFile, { tabs: tabs.map(t => ({ url: t.url, title: t.title, favicon:t.favicon||'',pinned: t.pinned,route:connection?.tabs.get(t.id) })), activeIndex: tabs.findIndex(t => t.id === activeId), migrationVersion:3, bookmarks, history, settings, downloads:downloads.map(d=>({...d})) });
    for (const t of tabs) if (t.view && !t.view.webContents.isDestroyed()) t.view.webContents.close({ waitForBeforeUnload: false });
  });
  win.on('closed', () => { win = null; });
  await win.loadFile(uiFile); layout(); if(!process.argv.includes('--background-test'))win.show();
  if (smoke) require('../test/smoke.cjs').run({ app, win, state, createTab, selectTab, closeTab, pinTab, navigate, layout, assistant, bypass, tabs, pageContext, emit, accounts });
  if(toolsSmokeIndex>=0)require('../test/tools-smoke.cjs').run({app,win,tools,connection,state,createTab,selectTab,tabs,navigate,layout,runTool});
  if(accountSmokeIndex>=0)require('../test/accounts-smoke.cjs').run({app,win,accounts,state,createTab,tabs});
  if(authSmokeIndex>=0)require('../test/auth-smoke.cjs').run({app,win,accounts,state,createTab,selectTab,tabs});
}
app.on('second-instance', (_event,argv) => {const url=getLaunchURL(argv);if(url){if(win&&tools){try{createTab(url);}catch{}}else pendingLaunchURL=url;} if (win) { if (win.isMinimized()) win.restore(); win.show();win.focus(); } });
app.on('window-all-closed', () => app.quit());
if (gotLock) app.whenReady().then(boot).catch(error => { console.error(error); dialog.showErrorBox('Kernel', error.message); app.quit(); });


