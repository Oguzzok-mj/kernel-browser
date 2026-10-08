const crypto=require('node:crypto');const {intent,suggestions}=require('./commands.cjs');
const SETTINGS=[['general','Основные','General startup search homepage'],['appearance','Оформление','Appearance theme font accent'],['tabs','Вкладки','Tabs sleep groups'],['ai','ИИ','AI model context temperature GPU CPU API'],['privacy','Конфиденциальность','Privacy trackers cookies permissions'],['connection','Connection','Network DNS proxy'],['ghost','Ghost Mode','private'],['tor','Tor','network'],['performance','Производительность','Performance RAM CPU'],['shortcuts','Сочетания клавиш','Shortcuts'],['workspaces','Workspaces','рабочие пространства'],['downloads','Загрузки','Downloads'],['security','Безопасность','Security TLS CSP'],['advanced','Дополнительно','Advanced defaults cache']].map(([section,title,hint])=>({section,title,hint}));
class AdvancedController{
  constructor(api){Object.assign(this,api);}
  info(){return{ghost:this.ghost,workspaceId:this.workspaces.data.activeId,workspaces:this.workspaces.list().map(w=>w.id===this.workspaces.data.activeId?{...w,count:this.tabs.length}:w),groups:this.workspaces.active().groups||[]};}
  suggest(value){const s=this.state();return suggestions(value,{tabs:s.tabs,history:s.history,bookmarks:s.bookmarks,settings:SETTINGS,commands:require('../tools/catalog.js'),workspaces:this.workspaces.list()});}
  command(input){const parsed=typeof input==='string'?intent(input):input;if(parsed.kind==='navigate'||parsed.type==='navigate')return this.navigate(parsed.value);if(parsed.kind==='calculator'||parsed.type==='calculator')return this.tools.copy(String(parsed.value));const command=parsed.command||parsed.type;
    if(command==='tabs'&&parsed.id)return this.selectTab(parsed.id);
    if(['history','bookmarks'].includes(command)&&parsed.url)return this.navigate(parsed.url);
    if(command==='workspace'&&parsed.id)return this.switchWorkspace(parsed.id);
    if(command==='settings'){this.openSettings(parsed.section||'general');return;}
    if(parsed.type==='tool'){this.openUtility('tools');this.emit('tools-command',parsed.id);return;}
    if(['ai','translate','summarize'].includes(command)){this.openUtility('ai');this.emit('ask-selection',command==='ai'?parsed.query||'Задай вопрос о странице.':command==='translate'?'Переведи текущую страницу на '+(parsed.query||'русский язык')+'.':'Кратко перескажи текущую страницу.');this.emit('page-context-enable');return;}
    if(command==='ghost')return this.newGhost();
    const section={tabs:'tabs',history:'search-history',bookmarks:'search-bookmarks',workspace:'workspaces',privacy:'privacy',performance:'performance',notes:'notes',capsules:'capsules',security:'security'}[command];if(section){this.open(section,parsed.query||'');return;}throw Error('Команда не найдена.');
  }
  open(section,query=''){this.openUtility('advanced');this.emit('advanced-open',{section,query});}
  async contentSearch(query){const q=String(query||'').toLowerCase().slice(0,300),results=[];for(const t of this.tabs){let excerpt='',searched=false;if(t.view&&!t.view.webContents.isDestroyed()){try{const content=await t.view.webContents.executeJavaScript('(document.body?.innerText||"").slice(0,200000)');searched=true;const i=content.toLowerCase().indexOf(q);if(i>=0)excerpt=content.slice(Math.max(0,i-70),i+200);}catch{}}if(excerpt||(t.title+' '+t.url).toLowerCase().includes(q))results.push({id:t.id,title:t.title,url:t.url,group:t.group||'',sleeping:!!t.sleeping,excerpt,searched});}return{items:results,note:'Содержимое ищется только в уже загруженных вкладках. Спящие страницы не загружаются в фоне.'};}
  async action({name,input={}}){const s=this.state(),tab=this.tabs.find(t=>t.id===s.activeId);switch(name){
    case'ai:execute':{const a=require('../ai-actions.cjs').action(input.kind,input.args);if(!a)throw Error('Недопустимое действие ИИ.');if(a.kind==='save_note')return this.knowledge.note({...a.args,url:tab?.url,workspace:this.workspaces.data.activeId});if(a.kind==='search_tabs')return this.open('tabs',a.args.query);if(a.kind==='switch_workspace'){const w=this.workspaces.list().find(w=>w.name===a.args.name);if(!w)throw Error('Workspace с таким названием не найден.');return this.switchWorkspace(w.id);}const target=this.tabs.find(t=>t.url===a.args.url&&t.id!==s.activeId);const result=await this.safeSleep(target);if(!result.slept)throw Error(result.reason);return result;}
    case'info':return this.info();case'tabs:search':return this.contentSearch(input.query);
    case'tabs:sort':{const keys={title:t=>t.title.toLowerCase(),domain:t=>{try{return new URL(t.url).hostname;}catch{return'';}},recent:t=>-(t.lastAccessed||0),group:t=>t.group||''};if(!keys[input.by])throw Error('Неверная сортировка.');this.tabs.sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(keys[input.by](a)>keys[input.by](b)?1:keys[input.by](a)<keys[input.by](b)?-1:0));this.changed();return;}
    case'tabs:group-auto':{const groups=[];for(const t of this.tabs){if(t.pinned)continue;const host=t.url.startsWith('http')?new URL(t.url).hostname:'Новые вкладки';let group=groups.find(g=>g.name===host);if(!group){group={id:crypto.randomUUID(),name:host,color:'#aeb6c2'};groups.push(group);}t.group=group.id;}this.workspaces.active().groups=groups;this.changed();return groups;}
    case'tab:group':{const t=this.tabs.find(t=>t.id===input.id);if(!t)throw Error('Вкладка закрыта.');const groups=this.workspaces.active().groups;let group=groups.find(g=>g.id===input.group);if(!group&&input.name){group={id:crypto.randomUUID(),name:String(input.name).slice(0,48),color:/^#[\da-f]{6}$/i.test(input.color)?input.color:'#aeb6c2'};groups.push(group);}t.group=group?.id||'';this.changed();return;}
    case'group:update':{const group=this.workspaces.active().groups.find(g=>g.id===input.id);if(!group)throw Error('Группа не найдена.');if(input.name!==undefined)group.name=String(input.name).trim().slice(0,48)||'Группа';if(/^#[\da-f]{6}$/i.test(input.color))group.color=input.color;this.changed();return;}
    case'group:delete':this.workspaces.active().groups=this.workspaces.active().groups.filter(g=>g.id!==input.id);for(const t of this.tabs)if(t.group===input.id)t.group='';this.changed();return;
    case'tab:sleep':return this.safeSleep(this.tabs.find(t=>t.id===input.id));
    case'tab:restore':{const t=this.tabs.find(t=>t.id===input.id);if(t){this.ensureView(t);this.changed();}return;}
    case'tabs:optimize':{const result=[];for(const t of this.tabs)if(t.id!==s.activeId&&t.view)result.push({id:t.id,...await this.safeSleep(t)});return result;}
    case'workspace:create':{const w=this.workspaces.create(input,{settings:s.settings});this.provider?.duplicate(this.workspaces.data.activeId,w.id);await this.switchWorkspace(w.id);return w;}
    case'workspace:switch':return this.switchWorkspace(input.id);
    case'workspace:rename':{const result=this.workspaces.update(input.id,input);if(input.id===this.workspaces.data.activeId&&/^#[\da-f]{6}$/i.test(input.accent))this.settings({accent:input.accent});return result;}
    case'workspace:duplicate':{this.workspaces.capture(this.capture());const copy=this.workspaces.duplicate(input.id);this.provider?.duplicate(input.id,copy.id);return copy;}
    case'workspace:delete':this.workspaces.remove(input.id);this.provider?.remove(input.id);this.changed();return;
    case'notes:list':return this.knowledge.notes(input.query,input.all?undefined:this.workspaces.data.activeId);
    case'notes:save':return this.knowledge.note({...input,workspace:this.workspaces.data.activeId,url:input.url||tab?.url});
    case'notes:delete':this.knowledge.removeNote(input.id);return;
    case'capsules:list':return this.knowledge.capsules(input.query);
    case'capsules:open':return this.knowledge.capsule(input.id);
    case'capsules:delete':this.knowledge.removeCapsule(input.id);return;
    case'capsules:images':{const assets=await this.tools.snapshot();return assets.assets.filter(a=>['img','image'].includes(a.type)).slice(0,40);}
    case'capsules:save':{const article=await this.tools.article(),images=[];if(input.images?.length){const inventory=await this.tools.snapshot(),allowed=new Set(inventory.assets.filter(a=>['img','image'].includes(a.type)).map(a=>a.url));for(const url of input.images.slice(0,8)){if(!allowed.has(url)||!/^https?:\/\//i.test(url))continue;try{const response=await this.tools.wc().session.fetch(url,{signal:AbortSignal.timeout(10000)}),mime=response.headers.get('content-type')?.split(';')[0];if(!response.ok||!/^image\/(png|jpeg|webp|gif)$/.test(mime)||Number(response.headers.get('content-length'))>1048576)continue;const reader=response.body.getReader(),chunks=[];let length=0;for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>1048576){await reader.cancel();break;}chunks.push(Buffer.from(r.value));}if(length<=1048576)images.push({url,data:'data:'+mime+';base64,'+Buffer.concat(chunks).toString('base64')});}catch{}}}return this.knowledge.saveCapsule({...article,workspace:this.workspaces.data.activeId,notes:input.notes,summary:input.summary,images,metadata:{capturedAt:new Date().toISOString(),imageCount:images.length}});}
    case'privacy:get':case'security:get':return this.diagnostics.site(tab,s.settings,this.connection,this.tools);
    case'security:record':await this.tools.startNetwork();return{message:'TLS будет записан после обновления страницы. Сетевые ответы не отправляются наружу.'};
    case'privacy:block':{const origin=new URL(tab.url).origin;return this.settings({siteTrackerBlocking:{...s.settings.siteTrackerBlocking,[origin]:!!input.enabled}});}
    case'privacy:reset':{const permissions={...s.settings.sitePermissions};delete permissions[new URL(tab.url).origin];return this.settings({sitePermissions:permissions});}
    case'privacy:clear':{if(!tab?.view)throw Error('Сначала откройте сайт.');const ses=tab.view.webContents.session,url=tab.view.webContents.getURL(),origin=new URL(url).origin;if(!/^https?:/.test(url))throw Error('Только данные текущего сайта.');if(input.cookiesOnly){for(const c of await ses.cookies.get({url})){const cookieURL=(c.secure?'https://':'http://')+c.domain.replace(/^\./,'')+c.path;await ses.cookies.remove(cookieURL,c.name);}}else await ses.clearStorageData({origin,storages:['cookies','localstorage','indexdb','serviceworkers','cachestorage','filesystem']});return{message:'Данные текущего сайта очищены.'};}
    case'performance:get':return this.diagnostics.metrics(this.app,this.tabs,s.activeId);
    case'ghost:new':return this.newGhost();
    case'search':return{items:(input.kind==='history'?s.history:s.bookmarks).filter(x=>(x.title+' '+x.url).toLowerCase().includes(String(input.query||'').toLowerCase()))};
    default:throw Error('Неизвестное действие.');
  }}
}
module.exports={AdvancedController,SETTINGS};
