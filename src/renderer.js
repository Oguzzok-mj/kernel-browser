const icons = {
 tools:'<path d="m8 4-6 8 6 8M16 4l6 8-6 8M14 3l-4 18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
  maximize:'<rect x="5" y="5" width="14" height="14" rx="1"/>', sidebar:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  back:'<path d="m14 6-6 6 6 6"/>', forward:'<path d="m10 6 6 6-6 6"/>', 'chevron-right':'<path d="m9 6 6 6-6 6"/>',
  reload:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  star:'<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9Z"/>',
  assistant:'<path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7"/>',
  menu:'<path d="M5 6h14M5 12h14M5 18h14"/>',
  shield:'<path d="m12 3 8 3v5c0 5-3.8 8.5-8 10-4.2-1.5-8-5-8-10V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  bookmark:'<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4Z"/>',
  history:'<path d="M3 10a9 9 0 1 1 1.5 7M3 4v6h6M12 7v5l3 2"/>', download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  settings:'<path d="m9 3-.6 2.2-1.8 1L4.4 6 2.5 9.3 4 11v2l-1.5 1.7L4.4 18l2.2-.2 1.8 1L9 21h6l.6-2.2 1.8-1 2.2.2 1.9-3.3L20 13v-2l1.5-1.7L19.6 6l-2.2.2-1.8-1L15 3Z"/><circle cx="12" cy="12" r="3"/>',
  pin:'<path d="m9 3 6 0-1 6 4 4v2H6v-2l4-4ZM12 15v7"/>', document:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 12h8M8 16h6"/>',
  edit:'<path d="m15 4 5 5M14 5 4 15l-1 6 6-1L19 10a3.5 3.5 0 0 0-5-5Z"/>', bulb:'<path d="M9 18h6M9 21h6M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/>',
  'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>','arrow-up':'<path d="M12 20V4m-6 6 6-6 6 6"/>','arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a19 19 0 0 1 0 18 19 19 0 0 1 0-18"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  home:'<path d="m3 11 9-8 9 8M5 9v12h5v-7h4v7h5V9"/>', youtube:'<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 6 3-6 3Z"/>',
  github:'<path d="M8 20c-4 1-4-2-6-2m12 4v-4c0-1 .1-2-1-3 4-.4 7-2 7-6a5 5 0 0 0-1-3 5 5 0 0 0 0-4s-2 0-4 2a13 13 0 0 0-6 0C7 2 5 2 5 2a5 5 0 0 0 0 4 5 5 0 0 0-1 3c0 4 3 5.6 7 6-1 1-1 2-1 3v4"/>',
  volume:'<path d="m11 5-5 4H3v6h3l5 4ZM15 8a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14"/>'
};
const $ = id => document.getElementById(id);
function icon(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (icons[name] || icons.globe) + '</svg>'; }
function setIcon(el, name) { if (el.dataset.drawn === name) return; el.innerHTML = icon(name); el.dataset.drawn = name; }
function refreshIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => setIcon(el, el.dataset.icon)); }
refreshIcons();
let current = null, toastTimer, generating = false, streamingMessage = null, scheduled = false;
let chatMessages;
try { chatMessages = JSON.parse(localStorage.getItem('kernel-chat') || '[]').filter(m => ['user','assistant','error'].includes(m.role) && typeof m.content === 'string').slice(-60); } catch { chatMessages = []; }
function toast(message) { $('toast').textContent = String(message).replace(/^Error invoking remote method '[^']+': Error: /,''); $('toast').classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 6000); }
async function call(action, payload) { try { return await window.kernel.call(action, payload); } catch (e) { toast(e.message); return undefined; } }
function hostname(url) { try { return new URL(url).hostname.replace(/^www\./,''); } catch { return url; } }
function siteIcon(tab) { if (tab.url === 'kernel://newtab') return icon('home'); if (tab.audible && !tab.muted) return icon('volume');const host=hostname(tab.url);if(host==='youtube.com')return icon('youtube');if(host==='github.com')return icon('github');return icon('globe'); }
function renderTabs() {
  const pinned = $('pinned-tabs'), regular = $('tabs'); pinned.replaceChildren(); regular.replaceChildren();
  for (const tab of current.tabs) {
    const row = document.createElement('div'); row.className = 'tab' + (tab.pinned ? ' pinned' : '') + (tab.id === current.activeId ? ' active' : '') + (tab.loading ? ' loading' : ''); row.draggable = true; row.dataset.tabId = tab.id;
    const button = document.createElement('button'); button.className = 'tab-main'; button.dataset.action = 'select'; button.dataset.id = tab.id; button.title = tab.title + '\n' + tab.url; button.setAttribute('aria-label', tab.title); if (tab.id === current.activeId) button.setAttribute('aria-current','page');
    const badge = document.createElement('span'); badge.className = 'site-icon'; badge.innerHTML = siteIcon(tab);
    if(tab.url!=='kernel://newtab'&&tab.favicon&&!(tab.audible&&!tab.muted)&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(tab.favicon)){const img=document.createElement('img');img.src=tab.favicon;img.alt='';img.draggable=false;img.onerror=()=>{badge.innerHTML=siteIcon(tab);};badge.replaceChildren(img);}
    const title = document.createElement('span'); title.className = 'tab-title'; title.textContent = tab.title;
    button.append(badge, title); row.append(button);
    if (tab.pinned) { const pin = document.createElement('button'); pin.className = 'tab-pin'; pin.dataset.action = 'pin'; pin.dataset.id = tab.id; pin.innerHTML = icon('pin'); pin.title = 'Открепить вкладку'; pin.setAttribute('aria-label','Открепить вкладку'); row.append(pin); }
    const close = document.createElement('button'); close.className = 'tab-close'; close.dataset.action = 'close-tab'; close.dataset.id = tab.id; close.title = 'Закрыть вкладку'; close.setAttribute('aria-label','Закрыть ' + tab.title); close.innerHTML = icon('close'); row.append(close);
    row.addEventListener('contextmenu', event => { event.preventDefault(); call('tab:menu', tab.id); });
    row.addEventListener('auxclick', event => { if (event.button === 1) { event.preventDefault(); call('tab:close', tab.id); } });
    row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/kernel-tab',tab.id); e.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    row.addEventListener('drop', e => { e.preventDefault(); const id = e.dataTransfer.getData('text/kernel-tab'); if (id) call('tab:reorder',{ id, targetId: tab.id }); });
    (tab.pinned ? pinned : regular).append(row);
  }
  $('pin-hint').classList.toggle('hidden', current.tabs.some(t => t.pinned));
  $('tab-count').textContent = current.tabs.filter(t => !t.pinned).length;
}
function renderShortcuts() {
  const base = [{ title:'YouTube', url:'https://www.youtube.com', symbol:'youtube' },{ title:'GitHub', url:'https://github.com', symbol:'github' },{ title:'Wikipedia', url:'https://ru.wikipedia.org', letter:'W' },{ title:'Hugging Face', url:'https://huggingface.co', letter:'H' }];
  const entries = [...current.bookmarks.map(b => ({ ...b, letter:hostname(b.url).slice(0,1).toUpperCase() })),...base].filter((b,i,a) => a.findIndex(x => hostname(x.url) === hostname(b.url)) === i).slice(0,5);
  $('shortcuts').replaceChildren();
  entries.forEach(entry => {
    const b = document.createElement('button'); b.className = 'shortcut'; b.title = entry.url;
    const badge = document.createElement('span'); badge.className = 'shortcut-icon'; if (entry.symbol) badge.innerHTML = icon(entry.symbol); else badge.textContent = entry.letter;
    const label = document.createElement('span'); label.textContent = entry.title; b.append(badge,label); b.onclick = () => call('navigate',entry.url); $('shortcuts').append(b);
  });
}
function render(state) {
  current = state;
  document.body.classList.toggle('content-fullscreen',state.contentFullscreen);
  window.kernelTheme.apply(state);
  const tab = state.tabs.find(t => t.id === state.activeId);
  if (document.activeElement !== $('address')) $('address').value = tab?.url === 'kernel://newtab' ? '' : tab?.url || '';
  $('back').disabled = !tab?.back; $('forward').disabled = !tab?.forward;
  setIcon($('reload'),tab?.loading ? 'close' : 'reload');
  setIcon($('address-icon'),tab?.url.startsWith('https:') ? 'lock' : tab?.url.startsWith('http:') ? 'globe' : 'search');
  $('bookmark').classList.toggle('saved',state.bookmarks.some(b => b.url === tab?.url)); $('bookmark').disabled = !tab?.url.startsWith('http');
  $('home').classList.toggle('hidden',tab?.url !== 'kernel://newtab' || state.overlay);
  $('settings-page').classList.toggle('hidden',!state.overlay);
  $('settings-button').classList.toggle('active',state.overlay);
  $('side-panel').classList.toggle('hidden',!state.panel);
  $('ai-panel').classList.toggle('hidden',state.panel !== 'ai');
  $('bypass-panel').classList.toggle('hidden',state.panel !== 'bypass');
  $('list-panel').classList.toggle('hidden',!['bookmarks','history','downloads'].includes(state.panel));
  document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('active',b.dataset.panel === state.panel));
  $('page-error').classList.toggle('hidden',!tab?.error || state.overlay); $('page-error-text').textContent = tab?.error || '';
  $('findbar').classList.toggle('hidden',!state.findVisible);
  renderSettings();renderAccount();
  renderTabs(); renderShortcuts(); renderLists(); renderAIStatus(state.ai); renderBypass(state.bypass);window.kernelTools?.render(state);
}
function renderLists() {
  if (!['bookmarks','history','downloads'].includes(current.panel)) return;
  const mode = current.panel;$('download-controls').classList.toggle('hidden',mode!=='downloads'); $('list-title').textContent = { bookmarks:'Закладки', history:'История', downloads:'Загрузки' }[mode]; setIcon($('list-icon'),{bookmarks:'bookmark',history:'history',downloads:'download'}[mode]);
  $('clear-history').classList.toggle('hidden',mode !== 'history' || !current.history.length);
  $('list-items').replaceChildren(); const items = current[mode].filter(item=>{if(mode!=='downloads')return true;const q=$('download-search').value.toLowerCase(),group=$('download-group').value;return (item.name||'').toLowerCase().includes(q)&&(group==='all'||group==='active'&&item.status==='progressing'||group==='images'&&/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(item.name)||group==='documents'&&/\.(pdf|docx?|txt|md|csv|xlsx?)$/i.test(item.name)||group==='archives'&&/\.(zip|7z|rar|tar|gz)$/i.test(item.name));});
  if (!items.length) { const empty = document.createElement('p'); empty.className = 'list-empty'; empty.textContent = { bookmarks:'Нет закладок.\nДобавить страницу можно звёздочкой в адресной строке.', history:'Посещённые страницы появятся здесь.', downloads:'Загруженные файлы появятся здесь.' }[mode]; $('list-items').append(empty); return; }
  items.forEach(item => {
    const row = document.createElement('div'); row.className = 'list-item'; const main = document.createElement('button'); main.className = 'list-item-main'; const title = document.createElement('strong'); title.textContent = item.title || item.name || hostname(item.url); const sub = document.createElement('small');
    if (mode === 'downloads') {
      const labels = { completed:'Сохранён · показать в папке', cancelled:'Отменено', interrupted:'Загрузка прервана', progressing: formatBytes(item.received) + (item.total ? ' / ' + formatBytes(item.total) : '') };
      sub.textContent = item.paused?'На паузе':labels[item.status] || item.status; main.onclick = () => call('download:open', item.id); main.disabled = item.status !== 'completed'; main.append(title,sub);
      if (item.status === 'progressing' && item.total) { const progress = document.createElement('progress'); progress.max = item.total; progress.value = item.received; main.append(progress); }
      if(item.status==='progressing'){const pause=document.createElement('button');pause.className='text-link';pause.textContent=item.paused?'Продолжить':'Пауза';pause.onclick=()=>call(item.paused?'download:resume':'download:pause',item.id);row.append(pause);}else if(item.url){const retry=document.createElement('button');retry.className='text-link';retry.textContent='Повторить';retry.onclick=()=>call('download:retry',item.id);row.append(retry);}
      if (item.status === 'progressing') { const cancel = document.createElement('button'); cancel.className = 'icon-button small'; cancel.innerHTML = icon('close'); cancel.title = 'Отменить загрузку'; cancel.onclick = () => call('download:cancel',item.id); row.append(cancel); }
    } else { sub.textContent = hostname(item.url) + (mode === 'history' ? ' · ' + new Date(item.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : ''); main.append(title,sub); main.onclick = () => call('tab:new',item.url); }
    row.prepend(main);
    if (mode === 'bookmarks') { const remove = document.createElement('button'); remove.className='icon-button small'; remove.innerHTML=icon('close'); remove.title='Удалить закладку'; remove.onclick=()=>call('bookmark:remove',item.url); row.append(remove); }
    $('list-items').append(row);
  });
}
function formatBytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.round(n / 1024) + ' КБ'; }
function renderSettings(){
  const s=current.settings, font=$('interface-font');
  if(!Array.from(font.options).some(o=>o.value===s.fontFamily)){const o=document.createElement('option');o.value=o.textContent=s.fontFamily;font.append(o);}
  document.querySelectorAll('[data-setting]').forEach(el=>{const value=s[el.dataset.setting];if(document.activeElement!==el){if(el.type==='checkbox')el.checked=!!value;else el.value=String(value);}});
  document.querySelectorAll('[data-value-for]').forEach(el=>{const key=el.dataset.valueFor;el.textContent=s[key]+(['fontSize','radius','sidebarWidth','panelWidth'].includes(key)?' px':'');});
  if(document.activeElement!==$('custom-font'))$('custom-font').value=s.fontFamily;
  $('download-directory').value=current.downloadDirectory||s.downloadDirectory;
  $('permission-count').textContent='Сохранено сайтов: '+Object.keys(s.sitePermissions).length;
  $('app-version').textContent=current.version;
  const u=current.updates||{}, busy=['checking','downloading'].includes(u.status);
  const labels={idle:'Проверка выполняется при запуске и каждые 6 часов.',checking:'Проверяем обновления...',available:'Доступна версия '+u.version,downloading:'Скачивается версия '+u.version+' - '+u.progress+'%',downloaded:'Версия '+u.version+' скачана.'+(u.automatic?' Установится после закрытия браузера.':' Можно установить сейчас.'),current:'Установлена последняя версия.',error:'Не удалось проверить или скачать обновление. Повторим позже.',unsupported:'Автообновления доступны в установленной версии для Windows.'};
  $('update-status').textContent=labels[u.status]||'';
  $('automatic-updates').checked=u.automatic!==false;$('automatic-updates').disabled=!u.supported;
  $('check-update').disabled=!u.supported||busy||u.status==='downloaded';
  $('install-update').classList.toggle('hidden',u.status!=='downloaded');
  $('update-progress').classList.toggle('hidden',u.status!=='downloading');$('update-progress').value=u.progress||0;
}
function showSettingsSection(name){document.querySelectorAll('[data-section]').forEach(el=>el.classList.toggle('hidden',el.dataset.section!==name));document.querySelectorAll('[data-settings-page]').forEach(el=>el.classList.toggle('selected',el.dataset.settingsPage===name));document.querySelector('.settings-sections').scrollTop=0;}
function accountAvatar(el,a){if(el.dataset.avatar===a.avatar&&el.dataset.name===a.name)return;el.dataset.avatar=a.avatar;el.dataset.name=a.name;el.replaceChildren();if(a.avatar&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.avatar)){const img=document.createElement('img');img.src=a.avatar;img.alt='';el.append(img);}else el.textContent=a.guest?'K':a.name.slice(0,1).toUpperCase();}
function renderAccount(){
  const a=current.account;if(!a)return;
  $('account-name').textContent=a.name;$('account-id').textContent='ID '+a.id;$('account-button').title=a.name+' · ID '+a.id;
  $('account-dev').classList.toggle('hidden',!a.developer);accountAvatar($('account-avatar'),a);accountAvatar($('settings-avatar'),a);
  $('settings-account-name').textContent=a.name+(a.developer?' · DEV':'');$('settings-account-id').textContent='ID '+a.id;
  $('account-guest').classList.toggle('hidden',!a.guest);$('account-signed-in').classList.toggle('hidden',a.guest);
  if(document.activeElement!==$('edit-account-name'))$('edit-account-name').value=a.name;
  $('current-password-label').classList.toggle('hidden',!a.hasPassword);$('owner-password-note').classList.toggle('hidden',!a.developer||a.hasPassword);
  $('account-logout').disabled=a.developer&&!a.hasPassword;
  $('local-accounts').textContent=current.accounts?.length?'На компьютере: '+current.accounts.map(a=>a.name+' · '+a.id).join(', '):'На этом компьютере пока нет зарегистрированных аккаунтов.';
}
async function accountRequest(action,data,message){
  const buttons=document.querySelectorAll('[data-section=account] button');buttons.forEach(b=>b.disabled=true);$('account-feedback').textContent='';let success=false;
  try{await window.kernel.call(action,data);success=true;$('account-feedback').textContent=message;document.querySelectorAll('[data-section=account] input[type=password]').forEach(el=>el.value='');}
  catch(e){$('account-feedback').textContent=e.message.replace(/^Error invoking remote method '[^']+': Error: /,'');}
  finally{if(!success||!['account:create','account:login','account:logout'].includes(action)){buttons.forEach(b=>b.disabled=false);renderAccount();}}
}
$('show-login').onclick=()=>{$('login-form').classList.remove('hidden');$('register-form').classList.add('hidden');$('show-login').classList.add('selected');$('show-register').classList.remove('selected');};
$('show-register').onclick=()=>{$('login-form').classList.add('hidden');$('register-form').classList.remove('hidden');$('show-login').classList.remove('selected');$('show-register').classList.add('selected');};
$('login-form').onsubmit=e=>{e.preventDefault();accountRequest('account:login',{login:$('login-name').value,password:$('login-password').value},'Открытие профиля…');};
$('register-form').onsubmit=e=>{e.preventDefault();accountRequest('account:create',{name:$('register-name').value,password:$('register-password').value},'Открытие профиля…');};
$('account-name-form').onsubmit=e=>{e.preventDefault();accountRequest('account:update',{name:$('edit-account-name').value},'Имя сохранено.');};
$('account-password-form').onsubmit=e=>{e.preventDefault();accountRequest('account:password',{currentPassword:$('current-password').value,password:$('new-password').value},'Пароль сохранён.');};
$('choose-avatar').onclick=()=>accountRequest('account:avatar',undefined,'');
$('copy-account-id').onclick=()=>accountRequest('account:copy-id',undefined,'ID скопирован.');
$('account-logout').onclick=()=>accountRequest('account:logout',undefined,'Открытие гостевого профиля…');
const settingTimers=new Map();
document.querySelectorAll('[data-setting]').forEach(el=>{
  const update=()=>{const key=el.dataset.setting;let value=el.type==='checkbox'?el.checked:el.type==='range'||el.hasAttribute('data-number')?Number(el.value):el.value;
    if(key==='homepage'){value=value.trim()||'kernel://newtab';if(value!=='kernel://newtab'){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol))throw Error();}catch{toast('Введите адрес с https:// или http://.');return;}}}
    clearTimeout(settingTimers.get(key));call('settings',{[key]:value});};
  el.addEventListener('change',update);
  if(el.type==='range'||el.type==='color')el.addEventListener('input',()=>{clearTimeout(settingTimers.get(el.dataset.setting));settingTimers.set(el.dataset.setting,setTimeout(update,70));});
});
document.querySelectorAll('[data-settings-page]').forEach(el=>el.onclick=()=>showSettingsSection(el.dataset.settingsPage));
$('custom-font').onchange=()=>{const value=$('custom-font').value.trim();if(!/^[\p{L}\p{N} .,_-]{1,64}$/u.test(value)){toast('Введите название установленного шрифта.');return;}call('settings',{fontFamily:value});};
$('automatic-updates').onchange=()=>call('updates:automatic',$('automatic-updates').checked);
$('check-update').onclick=()=>call('updates:check');
$('install-update').onclick=()=>call('updates:install');
$('reset-settings').onclick=()=>call('settings:reset');
$('choose-directory').onclick=()=>call('download:directory');
$('reset-permissions').onclick=()=>call('permissions:reset');
$('open-clear-data').onclick=()=>$('clear-data-dialog').showModal();
$('cancel-clear-data').onclick=()=>$('clear-data-dialog').close();
$('confirm-clear-data').onclick=async()=>{const choice={cache:$('clear-cache').checked,siteData:$('clear-sites').checked,history:$('clear-visits').checked};if(!Object.values(choice).some(Boolean))return;const b=$('confirm-clear-data');b.disabled=true;try{await window.kernel.call('privacy:clear',choice);$('clear-data-dialog').close();toast('Выбранные данные удалены.');}catch(e){toast(e.message);}finally{b.disabled=false;}};
let findTimer;
function findNext(forward=true){clearTimeout(findTimer);call('find',{text:$('find-input').value,forward,findNext:true});}
$('find-input').oninput=()=>{clearTimeout(findTimer);findTimer=setTimeout(()=>call('find',{text:$('find-input').value}),100);};
$('find-input').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();findNext(!e.shiftKey);}if(e.key==='Escape')call('find:close');};
$('find-previous').onclick=()=>findNext(false);$('find-next').onclick=()=>findNext();$('find-close').onclick=()=>call('find:close');
window.kernel.on('focus-find',()=>{setTimeout(()=>{$('find-input').focus();$('find-input').select();},30);});
window.kernel.on('find-result',result=>{$('find-count').textContent=result.active+' / '+result.total;});
window.addEventListener('resize',()=>{if(current)window.kernelTheme.apply(current);});
function renderAIStatus(info) {
  if (!info) return;
  if (current) current.ai = info;
  const labels = { idle:'', ready:'', starting:'Загрузка…', generating:'Обработка…', downloading:'Загрузка · ' + info.progress + '%', error:info.detail || 'Не удалось запустить модель' };
  document.querySelector('.ai-status-line').classList.toggle('hidden',['idle','ready'].includes(info.status));
  $('ai-status').textContent = labels[info.status] || labels.idle;
  $('ai-dot').className='status-dot' + (info.status === 'ready' ? ' on' : ['starting','generating','downloading'].includes(info.status) ? ' busy' : '');
  const installing = info.status === 'downloading';
  $('model-install').classList.toggle('hidden',info.installed && !installing);
  $('install-model').disabled = false; $('install-model').textContent = installing ? 'Остановить загрузку · ' + info.progress + '%' : 'Скачать модель · 2,5 ГБ';
  $('model-progress').classList.toggle('hidden',!installing); $('model-progress').value = info.progress || 0;
  $('model-progress-text').textContent = info.status === 'error' ? info.detail || 'Повторите попытку.' : 'Размер загрузки: 2,5 ГБ.';
  $('ai-engine-detail').textContent=(info.status==='idle'?'Не запущен':info.backend||labels[info.status])+(info.metrics?.tokensPerSecond?' · '+info.metrics.tokensPerSecond.toFixed(1)+' токенов/с':'')+(info.fallback?' · '+info.fallback:'');
  $('send-message').disabled = !info.installed || generating;
}
function renderBypass(info) {
  if (!info) return; if (current) current.bypass = info;
  const select = $('bypass-strategy');
  if (select.options.length !== info.profiles.length) { select.replaceChildren(); info.profiles.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = p.replace('general','Основная').replace('.bat',''); select.append(o); }); select.value = info.strategy; }
  const labels = {off:'Выключен',starting:'Запускается…',on:'Запущен',stopping:'Выключается…',error:'Не запущен'};
  $('bypass-state').textContent=labels[info.phase]; $('bypass-dot').className='status-dot' + (info.phase === 'on' ? ' on' : ['starting','stopping'].includes(info.phase) ? ' busy' : '');
  $('bypass-toggle').textContent = ['on','starting'].includes(info.phase) ? 'Выключить обход' : info.phase === 'stopping' ? 'Выключается…' : 'Включить обход';
  $('bypass-toggle').disabled=info.phase === 'stopping'; select.disabled=['on','starting','stopping'].includes(info.phase); $('bypass-detail').textContent=info.detail || '';
  $('connection-bypass').classList.toggle('enabled',info.phase === 'on');
}
function markdown(target, text) {
  target.replaceChildren();
  const pieces = text.split('```');
  pieces.forEach((piece,index) => {
    if (index % 2) { const pre=document.createElement('pre'); const code=document.createElement('code'); code.textContent=piece.replace(/^[a-z0-9_+-]*\n/i,''); pre.append(code); target.append(pre); }
    else { const chunks = piece.split(/(\*\*[^*]+\*\*|`[^`]+`)/g); chunks.forEach(chunk => { if (chunk.startsWith('**') && chunk.endsWith('**')) { const b=document.createElement('strong'); b.textContent=chunk.slice(2,-2); target.append(b); } else if (chunk.startsWith('`') && chunk.endsWith('`')) { const c=document.createElement('code'); c.textContent=chunk.slice(1,-1); target.append(c); } else target.append(document.createTextNode(chunk)); }); }
  });
}
function appendChat(message) {
  $('chat-welcome').classList.add('hidden');
  const div = document.createElement('div'); div.className='chat-message '+message.role;
  const heading=document.createElement('div'); heading.className='message-heading'; heading.textContent=message.role === 'user' ? 'Вы' : message.role === 'error' ? 'Ошибка' : 'Ассистент';
  const content=document.createElement('div'); content.className='message-content'; markdown(content,message.content);
  div.append(heading,content);
  for(const action of message.actions || []) { const button=document.createElement('button'); button.className='message-action'; const label=document.createElement('span'); label.textContent='Открыть ' + action.title; button.append(label); const glyph=document.createElement('span'); glyph.innerHTML=icon('arrow-up-right'); button.append(glyph); button.onclick=()=>call('tab:new',action.url); div.append(button); }
  $('chat').append(div); return { div,content };
}
function renderChat() { $('chat').querySelectorAll('.chat-message').forEach(el=>el.remove()); $('chat-welcome').classList.toggle('hidden',!!chatMessages.length); chatMessages.forEach(appendChat); scrollChat(); }
function scrollChat() { $('chat').scrollTop=$('chat').scrollHeight; }
function saveChat() { try { localStorage.setItem('kernel-chat',JSON.stringify(chatMessages.slice(-60))); } catch {} }
async function sendMessage(text) {
  text = String(text || '').trim(); if (!text || generating) return;
  if (!current?.ai?.installed) { toast('Сначала загрузите модель для чата.'); return; }
  const user={role:'user',content:text}; chatMessages.push(user); appendChat(user); $('chat-input').value='';
  generating=true; $('send-message').classList.add('hidden'); $('stop-message').classList.remove('hidden'); $('composer-hint').textContent='Обработка…';
  streamingMessage={role:'assistant',content:'',actions:[]}; chatMessages.push(streamingMessage); const elements=appendChat(streamingMessage); streamingMessage.element=elements;
  scrollChat();
  try {
    await window.kernel.call('ai:send',{messages:chatMessages.filter(m=>m.role !== 'error' && m !== streamingMessage).map(({role,content})=>({role,content})),context:$('page-context').checked});
    if (!streamingMessage.content && !streamingMessage.actions.length) { streamingMessage.content='Ответ остановлен.'; markdown(elements.content,streamingMessage.content); }
  } catch(e) {
    if (!streamingMessage.content) { streamingMessage.role='error'; streamingMessage.content=e.message.replace(/^Error invoking remote method '[^']+': Error: /,''); }
    else chatMessages.push({role:'error',content:e.message});
  } finally {
    delete streamingMessage.element; streamingMessage=null; generating=false; $('send-message').classList.remove('hidden'); $('stop-message').classList.add('hidden'); $('composer-hint').textContent='Enter — отправить'; renderChat(); saveChat(); renderAIStatus(current.ai);
  }
}
window.kernel.on('state',render);
window.kernel.on('focus-address',()=>{ $('address').focus(); $('address').select(); });
window.kernel.on('ai-status',renderAIStatus); window.kernel.on('bypass-status',renderBypass);
window.kernel.on('ai-token',token=>{
  if(!streamingMessage) return; streamingMessage.content+=token;
  if(!scheduled) { scheduled=true; requestAnimationFrame(()=>{ scheduled=false; if(!streamingMessage?.element) return; markdown(streamingMessage.element.content,streamingMessage.content); scrollChat(); }); }
});
window.kernel.on('ai-action',action=>{ if(!streamingMessage) return; streamingMessage.actions.push(action); });
window.kernel.on('ask-selection',text=>{ $('chat-input').value='Объясни выделенный текст:\n\n'+text; $('chat-input').focus(); });
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]'); if(!button) return; const action=button.dataset.action;
  if(action==='new') { await call('tab:new'); $('address').focus(); }
  else if(action==='select') call('tab:select',button.dataset.id);
  else if(action==='close-tab') call('tab:close',button.dataset.id);
  else if(action==='pin') call('tab:pin',button.dataset.id);
  else if(action==='back'||action==='forward') call('history:navigate',action);
  else if(action==='reload') call('reload');
  else if(action==='home'||action==='browser-menu') call(action==='home'?'home':'browser:menu');
  else if(action==='bookmark') call('bookmark');
  else if(action==='collapse') call('settings',{collapsed:!current.settings.collapsed});
  else if(['ai','bypass','history','bookmarks','downloads','tools','connection'].includes(action)) call('panel',current.panel===action?'':action);
  else if(action==='close-panel') call('panel','');
  else if(action==='settings') call('overlay',!current.overlay);
  else if(action==='account') {await call('overlay',true);showSettingsSection('account');$('content').scrollTop=0;}
  else if(action==='close-settings') call('overlay',false);
  else if(['minimize','maximize'].includes(action)) call('window',action);
  else if(action==='close-window') call('window','close');
  else if(action==='clear-chat') { if(generating) { toast('Сначала остановите текущий ответ.'); return; } chatMessages=[];saveChat();renderChat(); }
});
document.addEventListener('click',event=>{ const button=event.target.closest('[data-source]'); if(button)call('external',button.dataset.source); const prompt=event.target.closest('[data-prompt]'); if(prompt){ if(prompt.dataset.needsPage) $('page-context').checked=true; sendMessage(prompt.dataset.prompt); } });
$('address-form').addEventListener('submit',async e=>{e.preventDefault();const value=$('address').value;$('address').blur();await call('navigate',value);});
$('address').addEventListener('focus',()=>$('address').select());
$('home-search').addEventListener('submit',e=>{e.preventDefault();call('navigate',$('home-query').value);$('home-query').value='';});
$('chat-form').addEventListener('submit',e=>{e.preventDefault();sendMessage($('chat-input').value);});
$('chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendMessage($('chat-input').value);}});
$('stop-message').onclick=()=>call('ai:cancel');
$('install-model').onclick=()=>current.ai.status==='downloading'?call('ai:cancel'):call('ai:install');
$('bypass-toggle').onclick=()=>['on','starting'].includes(current.bypass.phase)?call('bypass:stop'):call('bypass:start',$('bypass-strategy').value);
$('clear-history').onclick=()=>call('history:clear');
document.querySelector('.brand').addEventListener('dblclick',()=>call('settings',{collapsed:!current.settings.collapsed}));
$('today').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',weekday:'short'});
call('state').then(state=>{if(state)render(state);});renderChat();

window.kernelUI={toast,icon,ask:async prompt=>{await call("panel","ai");$("page-context").checked=true;$("chat-input").value=prompt;$("chat-input").focus();}};
window.kernel.on("page-context-enable",()=>$("page-context").checked=true);
$("download-search").oninput=renderLists;$("download-group").onchange=renderLists;
$("settings-open-connection").onclick=()=>call("panel","connection");$("settings-default-route").onchange=()=>call("connection:apply",{mode:$("settings-default-route").value,scope:"all"});$("connection-dns-save").onclick=()=>call("connection:options",{dnsMode:$("connection-dns-mode").value,customDoh:$("connection-custom-doh").value});
