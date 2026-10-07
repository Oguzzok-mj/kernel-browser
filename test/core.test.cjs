const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeAddress, parseStrategy, clampBounds } = require('../src/core.cjs');
test('addresses distinguish search, remote URLs and local development',()=>{
  assert.equal(normalizeAddress('example.com/a?x=1'),'https://example.com/a?x=1');
  assert.equal(normalizeAddress('localhost:3000/test'),'http://localhost:3000/test');
  assert.equal(normalizeAddress('example.com:8080/test'),'https://example.com:8080/test');
  assert.equal(normalizeAddress('127.0.0.1:8181'),'http://127.0.0.1:8181/');
  assert.equal(normalizeAddress('Как работает браузер?'),'https://www.google.com/search?q='+encodeURIComponent('Как работает браузер?'));
  assert.equal(normalizeAddress(''), 'kernel://newtab');
  assert.equal(normalizeAddress('https://пример.рф/'),'https://xn--e1afmkfd.xn--p1ai/');
  assert.equal(normalizeAddress('пример.рф'),'https://xn--e1afmkfd.xn--p1ai/');
});
test('address bar blocks script, file and external application protocols',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,<script>','file:///C:/Windows','cmd:calc','httpsx://host']) assert.throws(()=>normalizeAddress(url));
});
test('pinned zapret strategies parse as executable arguments without a shell',()=>{
  const root=path.resolve(__dirname,'../vendor/zapret/zapret-discord-youtube-1.10.3');
  const bundled=fs.existsSync(root);
  const profiles=bundled?fs.readdirSync(root).filter(n=>/^general.*\.bat$/.test(n)).map(name=>({name,text:fs.readFileSync(path.join(root,name),'utf8')})):JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/zapret-strategies.json'),'utf8'));
  assert.ok(profiles.length>=10);
  for(const p of profiles){const args=parseStrategy(p.text,root); assert.ok(args.length>20,p.name); assert.ok(args.every(a=>a.startsWith('--')&&!a.includes('%')),p.name); if(bundled)for(const a of args){const name=a.slice(a.indexOf('=')+1);if(name.startsWith(root))assert.ok(fs.existsSync(name)||name.endsWith('-user.txt'),name);}}
});
test('unrecognized upstream shell constructs cannot become process arguments',()=>{
  assert.throws(()=>parseStrategy('start "%BIN%winws.exe" --foo=1 & calc.exe','C:\\zapret'));
  assert.throws(()=>parseStrategy('start "%BIN%winws.exe" --foo=%Unknown%','C:\\zapret'));
});
test('browser content leaves space for sidebar and right panel',()=>{
  assert.deepEqual(clampBounds(1440,920,''),{x:232,y:48,width:1170,height:872});
  assert.deepEqual(clampBounds(1440,920,'ai'),{x:232,y:48,width:810,height:872});
  assert.deepEqual(clampBounds(1440,920,'ai',true),{x:72,y:48,width:970,height:872});
});
