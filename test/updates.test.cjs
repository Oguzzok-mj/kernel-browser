const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const {Updates}=require('../src/updates.cjs');
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'kernel-updates-'));
  const updater=new EventEmitter();let downloads=0,checks=0,installs=0;
  updater.checkForUpdates=async()=>{checks++;updater.emit('checking-for-update');updater.emit('update-available',{version:'0.4.4'});return {updateInfo:{version:'0.4.4'}};};
  updater.downloadUpdate=async()=>{downloads++;updater.emit('download-progress',{percent:42});updater.emit('update-downloaded',{version:'0.4.4'});};
  updater.quitAndInstall=(silent,relaunch)=>{assert.equal(silent,true);assert.equal(relaunch,true);installs++;};
  const updates=new Updates({updater,root,enabled:false});
  t.after(()=>{updates.dispose();fs.rmSync(root,{recursive:true,force:true});});
  return {root,updater,updates,counts:()=>({checks,downloads,installs})};
}
test('automatic update downloads once, stages it and installs only on explicit restart/quit',async t=>{
  const f=fixture(t);assert.equal(f.updater.allowDowngrade,false);assert.equal(f.updater.allowPrerelease,false);
  await Promise.all([f.updates.check(),f.updates.check()]);
  assert.deepEqual(f.counts(),{checks:1,downloads:1,installs:0});
  assert.equal(f.updates.info().status,'downloaded');assert.equal(f.updates.info().progress,100);
  await f.updates.check();assert.equal(f.counts().checks,1);
  f.updates.install();assert.equal(f.counts().installs,1);
});
test('disabled automatic updates persist across accounts/restarts; manual check still downloads',async t=>{
  const f=fixture(t);f.updates.configure(false);await f.updates.check();
  assert.equal(f.counts().checks,0);assert.equal(f.updater.autoInstallOnAppQuit,false);
  const reloaded=new Updates({root:f.root,updater:new EventEmitter(),enabled:false});t.after(()=>reloaded.dispose());
  assert.equal(reloaded.info().automatic,false);
  await f.updates.check(true);assert.equal(f.counts().downloads,1);assert.equal(f.updater.autoInstallOnAppQuit,false);
});
test('offline or corrupt-download errors never install and a later retry recovers',async t=>{
  const f=fixture(t);const download=f.updater.downloadUpdate;
  f.updater.downloadUpdate=async()=>{throw new Error('checksum mismatch');};
  await f.updates.check();assert.equal(f.updates.info().status,'error');assert.throws(()=>f.updates.install());
  assert.equal(f.counts().installs,0);f.updater.downloadUpdate=download;
  await f.updates.check();assert.equal(f.updates.info().status,'downloaded');
});
test('disable while a check is in flight prevents its automatic download',async t=>{
  const f=fixture(t);let resolve;
  f.updater.checkForUpdates=()=>new Promise(r=>resolve=r);
  const pending=f.updates.check();f.updates.configure(false);
  f.updater.emit('update-available',{version:'0.4.4'});resolve({});await pending;
  assert.equal(f.counts().downloads,0);assert.equal(f.updater.autoInstallOnAppQuit,false);
});
test('Windows session end defers installation; development/portable builds make no network requests',async t=>{
  const f=fixture(t);f.updates.sessionEnding();assert.equal(f.updater.autoInstallOnAppQuit,false);
  const unsupported=new Updates({root:f.root,supported:false,updater:null});t.after(()=>unsupported.dispose());
  assert.equal((await unsupported.check(true)).status,'unsupported');assert.equal(f.counts().checks,0);
});
