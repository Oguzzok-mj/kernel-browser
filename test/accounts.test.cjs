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
