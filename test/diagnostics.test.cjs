const test=require('node:test');const assert=require('node:assert/strict');
const {Diagnostics}=require('../src/advanced/diagnostics.cjs');
const {DEFAULTS}=require('../src/settings.cjs');
function expired(){return{isDestroyed:()=>true,get id(){throw Error('Destroyed contents id accessed');},getOSProcessId(){throw Error('Destroyed process accessed');},isCurrentlyAudible(){throw Error('Destroyed audio accessed');}};}
test('late network callbacks ignore closed, detached and incomplete views and always release the request',()=>{
  let before,headers;const ses={webRequest:{onBeforeRequest:fn=>before=fn,onHeadersReceived:fn=>headers=fn}};
  const active={id:'active',url:'https://site.test',view:{webContents:{id:8,isDestroyed:()=>false}}};
  const tabs=[undefined,{id:'sleeping'},{id:'detached',view:{}},{id:'destroyed',view:{webContents:expired()}},active];
  const diagnostics=new Diagnostics({tabs,settings:()=>({...DEFAULTS,trackerBlocking:true})});diagnostics.attach(ses);
  for(const webContentsId of [undefined,-1,0,99])for(const hook of [before,headers]){
    let calls=0;hook({webContentsId,url:'https://google-analytics.com/collect',resourceType:'mainFrame'},value=>{calls++;assert.deepEqual(value,{});});assert.equal(calls,1);
  }
  assert.equal(diagnostics.sites.size,0);
  let calls=0;before({webContentsId:8,url:'https://google-analytics.com/collect',resourceType:'script'},value=>{calls++;assert.equal(value.cancel,true);});assert.equal(calls,1);
  headers({webContentsId:8,url:active.url,resourceType:'mainFrame',statusCode:200,responseHeaders:{'Content-Security-Policy':["default-src 'self'"],'Set-Cookie':['private']}},value=>assert.deepEqual(value,{}));
  assert.equal(diagnostics.record('active').requests,1);assert.equal(diagnostics.record('active').blocked,1);assert.equal(diagnostics.record('active').status,200);assert.equal(diagnostics.record('active').headers['Set-Cookie'],undefined);
  active.view={};before({webContentsId:8,url:active.url,resourceType:'mainFrame'},value=>assert.deepEqual(value,{}));headers({webContentsId:8,url:active.url,resourceType:'mainFrame'},value=>assert.deepEqual(value,{}));assert.equal(diagnostics.record('active').requests,1);
});
test('performance sampling tolerates view disposal without reading destroyed contents',()=>{
  const tabs=[undefined,{id:'sleeping',sleeping:true},{id:'detached',view:{}},{id:'destroyed',view:{webContents:expired()}}];
  const diagnostics=new Diagnostics({tabs,settings:()=>DEFAULTS});
  const app={getAppMetrics:()=>[{pid:1,type:'Browser',memory:{workingSetSize:100},cpu:{percentCPUUsage:1}}],getGPUFeatureStatus:()=>({})};
  const metrics=diagnostics.metrics(app,tabs,'sleeping');assert.equal(metrics.tabCount,3);assert.equal(metrics.ramKB,100);assert.equal(metrics.tabs[0].active,true);
  for(const tab of metrics.tabs){assert.equal(tab.pid,null);assert.equal(tab.audible,false);assert.equal(tab.ramKB,0);}
});
