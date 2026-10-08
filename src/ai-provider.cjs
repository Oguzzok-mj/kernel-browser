const fs=require('node:fs'),path=require('node:path');const {atomicWrite,readJSON}=require('./core.cjs');
function endpoint(value){const url=new URL(value);if(url.username||url.password||url.search||url.hash)throw Error('В адресе API не должно быть пароля, query или fragment.');const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))throw Error('Для удалённого API требуется HTTPS.');return{url:url.href.replace(/\/$/,''),local};}
class ProviderConfig{
  constructor(root,vault,workspace='default'){this.file=path.join(root,'ai-provider.json');this.vault=vault;const stored=readJSON(this.file,null);this.document=stored?.version===2&&stored.configs?stored:{version:2,configs:{[workspace]:stored||this.defaults()}};this.select(workspace,false);}
  defaults(){return{endpoint:'http://127.0.0.1:11434/v1',model:'',secret:''};}
  save(){atomicWrite(this.file,this.document);}
  select(workspace,persist=true){if(!/^[a-z\d_-]{1,64}$/i.test(workspace)||['__proto__','constructor','prototype'].includes(workspace))throw Error('Недопустимый workspace.');this.workspace=workspace;this.data=Object.hasOwn(this.document.configs,workspace)?this.document.configs[workspace]:this.defaults();this.document.configs[workspace]=this.data;if(persist)this.save();}
  duplicate(from,to){this.document.configs[to]={...(this.document.configs[from]||this.defaults())};this.save();}
  remove(id){if(id!==this.workspace){delete this.document.configs[id];this.save();}}
  info(){return{endpoint:this.data.endpoint,model:this.data.model,hasKey:!!this.data.secret};}
  configure(input){const next={...this.data};if(input.endpoint!==undefined)next.endpoint=endpoint(input.endpoint).url;if(input.model!==undefined)next.model=String(input.model).trim().slice(0,200);if(input.key!==undefined){if(input.key){if(!this.vault.isEncryptionAvailable())throw Error('Защищённое хранилище недоступно.');next.secret=this.vault.encryptString(String(input.key).slice(0,4096)).toString('base64');}else next.secret='';}this.data=next;this.document.configs[this.workspace]=next;this.save();return this.info();}
  connection(consent){const target=endpoint(this.data.endpoint);if(!target.local&&!consent)throw Error('Подтвердите отправку сообщения и выбранного контекста удалённому провайдеру.');if(!this.data.model)throw Error('Укажите имя модели в настройках API.');let key='';if(this.data.secret){try{key=this.vault.decryptString(Buffer.from(this.data.secret,'base64'));}catch{throw Error('Не удалось прочитать ключ API. Введите его заново.');}}return{url:target.url+'/chat/completions',model:this.data.model,headers:{'Content-Type':'application/json',...(key?{Authorization:'Bearer '+key}:{})},remote:!target.local};}
}
module.exports={ProviderConfig,endpoint};
