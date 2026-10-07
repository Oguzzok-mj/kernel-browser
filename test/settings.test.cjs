const test=require('node:test');
const assert=require('node:assert/strict');
const {DEFAULTS,sanitizeSettings,viewBounds,searchAddress}=require('../src/settings.cjs');
test('old profiles migrate and malformed settings cannot introduce unsafe URLs or styles',()=>{
  const s=sanitizeSettings({collapsed:true,search:'duckduckgo',homepage:'javascript:alert(1)',fontFamily:'Arial";color:red',accent:'red',showRail:'false',sidebarWidth:999,aiContext:Infinity,unknown:'value'});
  assert.equal(s.collapsed,true);assert.equal(s.search,'duckduckgo');assert.equal(s.homepage,'kernel://newtab');assert.equal(s.fontFamily,'Segoe UI');assert.equal(s.accent,DEFAULTS.accent);assert.equal(s.showRail,true);assert.equal(s.sidebarWidth,320);assert.equal(s.aiContext,4096);assert.equal(s.unknown,undefined);
  assert.equal(sanitizeSettings({homepage:'file:///C:/test'}).homepage,DEFAULTS.homepage);
  assert.equal(sanitizeSettings({homepage:'https://example.com/',fontFamily:'Segoe UI',fontSize:15}).homepage,'https://example.com/');
});
test('saved site decisions are limited to allowed permissions and web origins',()=>{
  const s=sanitizeSettings({sitePermissions:{'https://example.com/path':{media:'block',geolocation:'allow',notifications:'other',dangerous:'allow'},'file:///a':{media:'allow'}}});
  assert.deepEqual(s.sitePermissions,{'https://example.com':{media:'block',geolocation:'allow'}});
});
test('custom geometry keeps native content clear of both panels and find bar',()=>{
  const s=sanitizeSettings({sidebarWidth:300,panelWidth:500,showRail:false});
  assert.deepEqual(viewBounds(1440,920,'ai',s,true),{x:300,y:84,width:640,height:836});
  assert.equal(viewBounds(1040,650,'ai',s).width,320);
  assert.deepEqual(viewBounds(1440,920,'',{...s,collapsed:true}),{x:72,y:48,width:1368,height:872});
});
test('selected search provider is applied to encoded queries',()=>{
  const q=encodeURIComponent('браузер и ИИ');
  assert.equal(searchAddress('https://www.google.com/search?q='+q,'yandex'),'https://yandex.ru/search/?text='+q);
  assert.equal(searchAddress('https://example.com/a?q=b','bing'),'https://example.com/a?q=b');
});
