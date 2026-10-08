const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomicWrite,readJSON}=require('../core.cjs');
const clone=value=>JSON.parse(JSON.stringify(value));
const webURL=value=>{try{return /^https?:$/.test(new URL(value).protocol);}catch{return false;}};
const text=(value,max=200000)=>String(value??'').slice(0,max);
function loadStore(file){const value=readJSON(file,null);if(value!==null||!fs.existsSync(file))return value;const backup=readJSON(file+'.bak',null);if(backup){fs.copyFileSync(file,file+'.corrupt-'+Date.now());atomicWrite(file,backup);return backup;}throw Error('Не удалось прочитать '+path.basename(file)+'. Исходный файл сохранён.');}
function saveStore(file,value){if(fs.existsSync(file))fs.copyFileSync(file,file+'.bak');atomicWrite(file,value);}
function navigation(value){if(!Array.isArray(value?.entries))return undefined;const entries=value.entries.slice(-40).filter(e=>webURL(e.url)).map(e=>({url:e.url,title:text(e.title,200),...(typeof e.pageState==='string'&&e.pageState.length<2000000?{pageState:e.pageState}:{})}));return entries.length?{entries,index:Math.max(0,Math.min(entries.length-1,Math.floor(value.index)||0))}:undefined;}
function snapshot(input={}){return{tabs:(input.tabs||[]).filter(t=>webURL(t.url)||t.url==='kernel://newtab').slice(0,80).map(t=>({url:t.url,title:text(t.title,200),pinned:!!t.pinned,favicon:text(t.favicon,160000),group:text(t.group,64),route:t.route,navigation:navigation(t.navigation),scroll:{x:Math.max(0,Math.min(10000000,Number(t.scroll?.x)||0)),y:Math.max(0,Math.min(10000000,Number(t.scroll?.y)||0))}})),activeIndex:Math.max(0,Number(input.activeIndex)||0),bookmarks:clone(input.bookmarks||[]).slice(0,200),history:clone(input.history||[]).slice(0,500),settings:clone(input.settings||{}),groups:clone(input.groups||[]).slice(0,80),route:input.route||null};}
class WorkspaceStore{
  constructor(root,initial={}){this.file=path.join(root,'workspaces.json');this.data=loadStore(this.file);if(!this.data){const first=this.make('Основное',initial);this.data={version:1,activeId:first.id,items:[first]};this.save();}if(this.data.version!==1||!Array.isArray(this.data.items)||!this.data.items.length||!this.data.items.some(w=>w.id===this.data.activeId))throw Error('Не удалось прочитать workspaces. Исходный файл сохранён.');}
  make(name,state={}){return{id:crypto.randomUUID(),name:text(name||'Workspace',48),icon:'◻',accent:/^#[\da-f]{6}$/i.test(state.settings?.accent)?state.settings.accent:'#aeb6c2',...snapshot(state)};}
  save(){saveStore(this.file,this.data);}
  active(){return this.data.items.find(w=>w.id===this.data.activeId);}
  list(){return this.data.items.map(({id,name,icon,accent,tabs})=>({id,name,icon,accent,count:tabs.length}));}
  capture(state){Object.assign(this.active(),snapshot(state));if(/^#[\da-f]{6}$/i.test(state.settings?.accent))this.active().accent=state.settings.accent;this.save();}
  create(input={},state={}){if(this.data.items.length>=30)throw Error('Лимит: 30 workspaces.');const w=this.make(input.name,state);this.data.items.push(w);this.update(w.id,input);return w;}
  update(id,input){const w=this.data.items.find(w=>w.id===id);if(!w)throw Error('Workspace не найден.');if(input.name!==undefined)w.name=text(input.name,48).trim()||'Workspace';if(input.icon!==undefined)w.icon=text(input.icon,4);if(/^#[\da-f]{6}$/i.test(input.accent))w.accent=input.accent;this.save();return w;}
  duplicate(id){const w=this.data.items.find(w=>w.id===id);if(!w)throw Error('Workspace не найден.');return this.create({name:w.name+' · копия',icon:w.icon,accent:w.accent},w);}
  remove(id){if(id===this.data.activeId)throw Error('Сначала переключитесь в другой workspace.');this.data.items=this.data.items.filter(w=>w.id!==id);this.save();}
  select(id){const w=this.data.items.find(w=>w.id===id);if(!w)throw Error('Workspace не найден.');this.data.activeId=id;this.save();return clone(w);}
}
class KnowledgeStore{
  constructor(root,legacyNotes={}){this.root=root;this.file=path.join(root,'knowledge.json');this.data=loadStore(this.file);if(!this.data){this.data={version:1,notes:Object.entries(legacyNotes).filter(([,v])=>v).map(([url,value])=>({id:crypto.randomUUID(),text:text(value),url,selection:'',at:Date.now(),updatedAt:Date.now(),workspace:'',tags:[]})),capsules:[]};this.save();}if(this.data.version!==1||!Array.isArray(this.data.notes)||!Array.isArray(this.data.capsules))throw Error('Не удалось прочитать заметки и Capsule.');}
  save(){saveStore(this.file,this.data);}
  notes(query='',workspace){const q=text(query,300).toLowerCase();return this.data.notes.filter(n=>(!workspace||n.workspace===workspace)&&(n.text+' '+n.url+' '+n.tags.join(' ')).toLowerCase().includes(q)).map(clone);}
  note(input){let n=this.data.notes.find(n=>n.id===input.id);if(!n){if(this.data.notes.length>=3000)throw Error('Лимит: 3000 заметок.');n={id:crypto.randomUUID(),at:Date.now()};this.data.notes.unshift(n);}Object.assign(n,{text:text(input.text),url:webURL(input.url)?input.url:'',selection:text(input.selection,10000),workspace:text(input.workspace,64),tags:(Array.isArray(input.tags)?input.tags:[]).map(t=>text(t,32)).slice(0,20),updatedAt:Date.now()});this.save();return clone(n);}
  removeNote(id){this.data.notes=this.data.notes.filter(n=>n.id!==id);this.save();}
  saveCapsule(input){if(this.data.capsules.length>=1000)throw Error('Лимит: 1000 Capsule.');const c={id:crypto.randomUUID(),at:Date.now(),title:text(input.title,300),url:webURL(input.url)?input.url:'',text:text(input.text,1000000),content:text(input.content,4000000),summary:text(input.summary,20000),notes:text(input.notes,200000),workspace:text(input.workspace,64),metadata:input.metadata||{},images:(input.images||[]).filter(i=>/^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(i.data)&&i.data.length<1500000).slice(0,8)};const directory=path.join(this.root,'capsules');fs.mkdirSync(directory,{recursive:true});atomicWrite(path.join(directory,c.id+'.json'),c);this.data.capsules.unshift({id:c.id,at:c.at,title:c.title,url:c.url,text:c.text.slice(0,80000),workspace:c.workspace});this.save();return c;}
  capsules(query=''){const q=text(query,300).toLowerCase();return this.data.capsules.filter(c=>(c.title+' '+c.url+' '+c.text).toLowerCase().includes(q)).map(({text,...c})=>c);}
  capsule(id){if(!/^[a-f\d-]{36}$/i.test(id)||!this.data.capsules.some(c=>c.id===id))throw Error('Capsule не найдена.');return readJSON(path.join(this.root,'capsules',id+'.json'),null);}
  removeCapsule(id){if(!/^[a-f\d-]{36}$/i.test(id)||!this.data.capsules.some(c=>c.id===id))return;fs.rmSync(path.join(this.root,'capsules',id+'.json'),{force:true});this.data.capsules=this.data.capsules.filter(c=>c.id!==id);this.save();}
}
module.exports={WorkspaceStore,KnowledgeStore,snapshot,webURL};
