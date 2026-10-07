const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const {atomicWrite,readJSON}=require('./core.cjs');
const scrypt=promisify(crypto.scrypt);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function ownerClaim(certificate,publicKey){
  try{const payload=Buffer.from(certificate.payload,'base64');if(!crypto.verify(null,payload,publicKey,Buffer.from(certificate.signature,'base64')))return null;const c=JSON.parse(payload);return c.app==='kernel-browser'&&c.version===1&&c.id==='777'&&c.role==='developer'&&uuid.test(c.uid)?c:null;}catch{return null;}
}
function validAvatar(value){return typeof value==='string'&&value.length<3000000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';}
function validName(value){const name=String(value||'').normalize('NFKC').trim();if(!/^[\p{L}\p{N} _.\-]{2,32}$/u.test(name))throw new Error('Имя: от 2 до 32 букв, цифр, пробелов или символов _ . -');return name;}
function validatePassword(value){if(typeof value!=='string'||value.length<8||value.length>128)throw new Error('Пароль должен содержать от 8 до 128 символов.');}
async function passwordHash(value,salt=crypto.randomBytes(16).toString('hex')){validatePassword(value);return {salt,hash:(await scrypt(value,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex')};}
async function passwordMatches(value,record){try{const check=await passwordHash(value,record.salt);const a=Buffer.from(check.hash,'hex'),b=Buffer.from(record.hash,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b);}catch{return false;}}
class Accounts{
  constructor({root,publicKey,vault}){
    Object.assign(this,{root,publicKey,vault});this.file=path.join(root,'accounts.json');this.sessionFile=path.join(root,'account-session.json');
    this.backupFile=path.join(root,'accounts.backup.json');this.load();
    this.active=this.restoreSession()||this.records.find(a=>a.guest);this.save();this.attempts=[];
  }
  fingerprint(){try{return crypto.createHash('sha256').update(fs.readFileSync(this.file)).digest('hex');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
  load(){
    const valid=data=>data?.version===1&&Array.isArray(data.accounts)&&data.accounts.length<=50&&data.accounts.every(a=>a&&uuid.test(a.uid)&&uuid.test(a.storageKey)&&typeof a.name==='string'&&typeof a.id==='string')&&new Set(data.accounts.map(a=>a.uid)).size===data.accounts.length;
    this.diskHash=this.fingerprint();let data=readJSON(this.file,null);
    if(!valid(data)){
      const backup=readJSON(this.backupFile,null);
      if(valid(backup)){if(this.diskHash)fs.copyFileSync(this.file,path.join(this.root,'accounts.damaged-'+Date.now()+'.json'));data=backup;atomicWrite(this.file,data);this.diskHash=this.fingerprint();}
      else if(this.diskHash!==null||fs.existsSync(this.backupFile))throw new Error('Не удалось прочитать аккаунты. Файлы сохранены без изменений: '+this.root);
      else data={version:1,accounts:[]};
    }
    this.records=data.accounts;
    for(const a of this.records){if(a.id==='777'&&!this.isOwner(a)){a.id=this.newId();a.certificate=null;}a.avatar=validAvatar(a.avatar);}
    if(!this.records.some(a=>a.guest))this.records.push({uid:crypto.randomUUID(),storageKey:crypto.randomUUID(),id:this.newId(),name:'Гость',guest:true,legacy:!this.records.length,avatar:''});
  }
  refresh(){if(this.fingerprint()===this.diskHash)return;const uid=this.active?.uid;this.load();this.active=this.records.find(a=>a.uid===uid)||this.records.find(a=>a.guest);}
  newId(){let id;do{id=String(crypto.randomInt(100000000000,999999999999));}while(this.records?.some(a=>a.id===id));return id;}
  isOwner(a){const c=ownerClaim(a?.certificate,this.publicKey);return !!c&&c.uid===a.uid&&a.id==='777'&&!a.guest;}
  save(){
    if(this.fingerprint()!==this.diskHash)throw new Error('Аккаунты обновлены другим процессом. Повторите действие.');
    const data={version:1,accounts:this.records};atomicWrite(this.file,data);this.diskHash=this.fingerprint();atomicWrite(this.backupFile,data);
  }
  restoreSession(){try{const session=readJSON(this.sessionFile,null),a=this.records.find(r=>r.uid===session?.uid&&!r.guest);if(!a||!this.vault.isEncryptionAvailable())return null;const token=this.vault.decryptString(Buffer.from(session.token,'base64'));const hash=crypto.createHash('sha256').update(token).digest('hex');return hash===a.sessionHash?a:null;}catch{return null;}}
  activate(a){if(!this.vault.isEncryptionAvailable())throw new Error('Windows не предоставила защищённое хранилище аккаунта.');const token=crypto.randomBytes(32).toString('hex');a.sessionHash=crypto.createHash('sha256').update(token).digest('hex');this.active=a;this.save();atomicWrite(this.sessionFile,{uid:a.uid,token:this.vault.encryptString(token).toString('base64')});return this.info();}
  info(a=this.active){return {name:a.name,id:this.isOwner(a)?'777':a.id,avatar:validAvatar(a.avatar),guest:!!a.guest,developer:this.isOwner(a),hasPassword:!!a.password};}
  list(){this.refresh();return this.records.filter(a=>!a.guest).map(a=>({name:a.name,id:this.info(a).id,developer:this.isOwner(a)}));}
  storage(){const a=this.active,key=a.storageKey;return {directory:a.legacy?this.root:path.join(this.root,'profiles',key),webPartition:a.legacy?'persist:kernel-web':'persist:kernel-web-'+key,uiPartition:a.legacy?'persist:kernel-ui':'persist:kernel-ui-'+key};}
  async create({name,password}){
    this.refresh();
    name=validName(name);if(name.toLowerCase()==='tripleg'||this.records.some(a=>!a.guest&&a.name.toLowerCase()===name.toLowerCase()))throw new Error('Это имя уже занято.');
    if(this.records.length>=50)throw new Error('Достигнут лимит локальных аккаунтов.');
    const record={uid:crypto.randomUUID(),storageKey:crypto.randomUUID(),id:this.newId(),name,password:await passwordHash(password),guest:false,legacy:false,avatar:''};
    if(this.active.guest){record.storageKey=this.active.storageKey;record.legacy=this.active.legacy;this.active.storageKey=crypto.randomUUID();this.active.legacy=false;}
    this.records.push(record);return this.activate(record);
  }
  async login({login,password}){
    this.refresh();
    const now=Date.now();this.attempts=this.attempts.filter(t=>now-t<30000);if(this.attempts.length>=5)throw new Error('Слишком много попыток. Повторите через 30 секунд.');this.attempts.push(now);
    const name=String(login||'').trim().normalize('NFKC').toLowerCase();const a=this.records.find(r=>!r.guest&&(r.name.toLowerCase()===name||r.id===name));
    if(!a||!await passwordMatches(password,a.password))throw new Error('Неверное имя, ID или пароль.');
    this.attempts=[];return this.activate(a);
  }
  logout(){this.refresh();if(this.isOwner(this.active)&&!this.active.password)throw new Error('Сначала задайте пароль в настройках аккаунта, чтобы сохранить возможность входа.');delete this.active.sessionHash;this.active=this.records.find(a=>a.guest);this.save();atomicWrite(this.sessionFile,null);return this.info();}
  update({name,avatar}){this.refresh();if(this.active.guest)throw new Error('Сначала создайте аккаунт.');if(name!==undefined){name=validName(name);if((name.toLowerCase()==='tripleg'&&!this.isOwner(this.active))||this.records.some(a=>a.uid!==this.active.uid&&!a.guest&&a.name.toLowerCase()===name.toLowerCase()))throw new Error('Это имя уже занято.');this.active.name=name;}if(avatar!==undefined)this.active.avatar=validAvatar(avatar);this.save();return this.info();}
  async changePassword({currentPassword,password}){this.refresh();if(this.active.guest)throw new Error('Сначала создайте аккаунт.');if(this.active.password&&!await passwordMatches(currentPassword,this.active.password))throw new Error('Текущий пароль указан неверно.');this.active.password=await passwordHash(password);this.save();return this.info();}
  importOwner({certificate,avatar}){
    this.refresh();
    const claim=ownerClaim(certificate,this.publicKey);if(!claim)throw new Error('Подпись владельца недействительна.');
    let a=this.records.find(r=>r.uid===claim.uid);if(!a){const legacy=!this.records.some(r=>!r.guest&&r.legacy);if(legacy)for(const r of this.records)if(r.guest)r.legacy=false;a={uid:claim.uid,storageKey:crypto.randomUUID(),id:'777',name:'TripleG',avatar:validAvatar(avatar),guest:false,legacy,certificate};this.records.push(a);}else{a.certificate=certificate;a.avatar=validAvatar(avatar)||a.avatar;}
    return this.activate(a);
  }
}
module.exports={Accounts,ownerClaim,passwordMatches};
