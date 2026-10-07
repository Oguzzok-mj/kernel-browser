const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Accounts}=require('../src/accounts.cjs');const {permissionAllowed}=require('../src/permissions.cjs');const {DEFAULTS}=require('../src/settings.cjs');
function vault(key=crypto.randomBytes(32)){return {isEncryptionAvailable:()=>true,encryptString(text){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);const bytes=Buffer.concat([c.update(text,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),bytes]);},decryptString(bytes){const d=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));d.setAuthTag(bytes.subarray(12,28));return Buffer.concat([d.update(bytes.subarray(28)),d.final()]).toString('utf8');}};}
function setup(){const root=fs.mkdtempSync(path.resolve(__dirname,'../../accounts-test-'));const keys=crypto.generateKeyPairSync('ed25519');const options={root,vault:vault(),publicKey:keys.publicKey};return {store:new Accounts(options),options,keys};}
test('local accounts hash passwords, isolate profiles, remember login only with the correct vault',async()=>{
  const {store,options}=setup();assert.equal(store.info().developer,false);assert.notEqual(store.info().id,'777');
  const alice=await store.create({name:'Alice',password:'A strong password',id:'777',developer:true});assert.equal(alice.developer,false);assert.notEqual(alice.id,'777');const aliceStorage=store.storage();
  const bob=await store.create({name:'Bob',password:'A strong password'});assert.notEqual(alice.id,bob.id);assert.notEqual(store.storage().directory,aliceStorage.directory);assert.notEqual(store.records.find(a=>a.name==='Alice').password.hash,store.records.find(a=>a.name==='Bob').password.hash);
  assert.equal(new Accounts(options).info().name,'Bob');assert.equal(new Accounts({...options,vault:vault()}).info().guest,true);
  store.logout();await assert.rejects(store.login({login:'Alice',password:'Wrong password'}));await store.login({login:alice.id,password:'A strong password'});assert.equal(store.info().name,'Alice');assert.equal(store.storage().webPartition,aliceStorage.webPartition);
  assert.ok(!fs.readFileSync(store.file,'utf8').includes('A strong password'));await assert.rejects(store.create({name:'TripleG',password:'A strong password'}));
});
test('only a signed owner certificate grants DEV and ID 777, and password login restores that identity',async()=>{
  const {store,keys,options}=setup(),uid=crypto.randomUUID();const payload=Buffer.from(JSON.stringify({app:'kernel-browser',version:1,uid,id:'777',role:'developer'}));const certificate={payload:payload.toString('base64'),signature:crypto.sign(null,payload,keys.privateKey).toString('base64')};
  assert.throws(()=>store.importOwner({certificate:{...certificate,signature:crypto.randomBytes(64).toString('base64')}}));
  store.importOwner({certificate});assert.equal(store.info().developer,true);assert.equal(store.info().id,'777');assert.equal(store.info().name,'TripleG');assert.throws(()=>store.logout());
  await store.changePassword({password:'My owner password'});store.logout();assert.equal(store.info().developer,false);await store.login({login:'777',password:'My owner password'});assert.equal(store.info().developer,true);
  const data=JSON.parse(fs.readFileSync(store.file));data.accounts.find(a=>a.uid===uid).certificate.signature=crypto.randomBytes(64).toString('base64');fs.writeFileSync(store.file,JSON.stringify(data));const tampered=new Accounts(options);assert.equal(tampered.info().developer,false);assert.notEqual(tampered.info().id,'777');
});
test('fullscreen and ordinary interactive permissions are silent; sensitive permissions follow explicit settings',()=>{
  assert.equal(permissionAllowed('fullscreen',DEFAULTS,'https://youtube.com',true),true);
  assert.equal(permissionAllowed('fullscreen',DEFAULTS,'https://youtube.com',false),false);
  for(const permission of ['media','geolocation','notifications','unknown'])assert.equal(permissionAllowed(permission,DEFAULTS,'https://example.com',true),false);
  assert.equal(permissionAllowed('media',{...DEFAULTS,mediaPermission:'allow'},'https://example.com',true),true);
  assert.equal(permissionAllowed('media',{...DEFAULTS,mediaPermission:'allow',sitePermissions:{'https://example.com':{media:'block'}}},'https://example.com',true),false);
});

test('an already running guest sees accounts restored on disk and cannot overwrite newer records',async()=>{
  const {store,options}=setup();const other=new Accounts(options);const alice=await other.create({name:'Alice',password:'Alice test password'});
  assert.equal(store.list()[0].id,alice.id);await store.login({login:alice.id,password:'Alice test password'});assert.equal(store.info().name,'Alice');
  const stale=new Accounts(options);await store.create({name:'Bob',password:'Bob test password'});
  assert.throws(()=>stale.save(),/обновлены другим процессом/);assert.equal(new Accounts(options).list().length,2);
});

test('damaged or missing account files recover the latest backup including owner identity and password',async()=>{
  const {store,options,keys}=setup(),uid=crypto.randomUUID();const payload=Buffer.from(JSON.stringify({app:'kernel-browser',version:1,uid,id:'777',role:'developer'}));
  store.importOwner({certificate:{payload:payload.toString('base64'),signature:crypto.sign(null,payload,keys.privateKey).toString('base64')}});await store.changePassword({password:'Owner test password'});
  const expected=fs.readFileSync(store.backupFile,'utf8');fs.writeFileSync(store.file,'{"accounts":');
  const recovered=new Accounts(options);assert.equal(recovered.info().id,'777');assert.equal(recovered.info().developer,true);await recovered.login({login:'777',password:'Owner test password'});
  assert.ok(fs.readdirSync(store.root).some(f=>f.startsWith('accounts.damaged-')));fs.unlinkSync(store.file);
  assert.equal(new Accounts(options).list()[0].id,'777');assert.ok(expected.includes('777'));
});

test('unrecoverable account data is preserved instead of being replaced with an empty guest list',()=>{
  const {store,options}=setup();fs.writeFileSync(store.file,'broken');fs.writeFileSync(store.backupFile,'broken backup');
  assert.throws(()=>new Accounts(options),/Файлы сохранены без изменений/);assert.equal(fs.readFileSync(store.file,'utf8'),'broken');
});
