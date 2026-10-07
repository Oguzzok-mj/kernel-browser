const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(check,message){for(let i=0;i<150;i++){if(await check())return;await delay(100);}throw Error(message);}
exports.run=async({app,win,accounts,createTab,tabs})=>{
  const file=path.join(app.getPath('userData'),'auth-flow.json');let flow={phase:0,checks:[]};try{flow=JSON.parse(fs.readFileSync(file));}catch{}
  const save=()=>fs.writeFileSync(file,JSON.stringify(flow,null,2));const log=s=>{flow.checks.push(s);save();console.log('PASS '+s);};let server;
  try{
    if(flow.phase===0){flow.phase=1;save();await win.webContents.executeJavaScript('window.kernel.call("account:create",{name:"Auth Test",password:"Auth test password"})',true);return;}
    assert.equal(accounts.info().name,'Auth Test');flow.accountId??=accounts.info().id;assert.equal(accounts.info().id,flow.accountId);
    server=http.createServer((req,res)=>{let body='';req.on('data',b=>body+=b);req.on('end',()=>{res.setHeader('Content-Type','text/html');if(req.url==='/callback'){res.setHeader('Set-Cookie','signed-in=verified; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax');res.end(`<script>window.opener.postMessage({type:'signed-in',body:${JSON.stringify(body)}},'*');window.close()</script>`);}else res.end('<!doctype html><title>Auth test</title><script>window.messages=[];addEventListener("message",e=>messages.push({data:e.data,origin:e.origin}));</script><body>Local sign-in fixture</body>');});});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(flow.port||0,'0.0.0.0',resolve);});flow.port=server.address().port;save();
    const base='http://127.0.0.1:'+flow.port;const id=createTab(base);const opener=tabs.find(t=>t.id===id);await waitFor(()=>opener.view&&opener.view.webContents.getURL()===base+'/'&&!opener.view.webContents.isLoading(),'Fixture did not load');const wc=opener.view.webContents;
    if(flow.phase===1){
      await wc.executeJavaScript(`window.open(${JSON.stringify(base+'/callback')},'auth-popup','popup,width=500,height=600');void 0`,true);
      await waitFor(async()=>await wc.executeJavaScript('messages.length')===1,'Popup did not report back');assert.equal(await wc.executeJavaScript('messages[0].data.type'),'signed-in');log('A sign-in popup retains window.opener, postMessage and window.close');
      await waitFor(()=>!tabs.some(t=>t.id!==id&&t.url.endsWith('/callback')),'Closed popup remained in tabs');
      await wc.executeJavaScript(`const f=document.createElement('form');f.method='POST';f.action=${JSON.stringify('http://localhost:'+flow.port+'/callback')};f.target='post-auth';f.innerHTML='<input name="state" value="test-state">';document.body.append(f);f.submit();`,true);
      await waitFor(async()=>await wc.executeJavaScript('messages.length')===2,'POST popup did not report back');assert.equal(await wc.executeJavaScript('messages[1].data.body'),'state=test-state');assert.equal(await wc.executeJavaScript('messages[1].origin'),'http://localhost:'+flow.port);log('Cross-origin sign-in preserves POST bodies and returns to the original page');
      await wc.executeJavaScript(`const p=window.open('about:blank','blank-auth');p.document.write('<script>window.opener.postMessage({type:"blank-ready"},"*");window.close()<'+ '/script>');`,true);
      await waitFor(async()=>await wc.executeJavaScript('messages.length')===3,'Blank popup did not retain opener');log('about:blank windows used by sign-in scripts work');
      assert.equal((await wc.session.cookies.get({url:base,name:'signed-in'}))[0].value,'verified');await wc.executeJavaScript('localStorage.setItem("signed-in","verified")');log('Authorization popup shares the current account cookie store');
      flow.phase=2;save();server.close();app.relaunch({args:process.argv.slice(1)});win.close();
    }else{
      assert.equal((await wc.session.cookies.get({url:base,name:'signed-in'}))[0].value,'verified');assert.equal(await wc.executeJavaScript('localStorage.getItem("signed-in")'),'verified');log('Account, website cookie and localStorage survive a complete browser restart');flow.ok=true;save();server.close();win.close();
    }
  }catch(e){flow.ok=false;flow.error=e.stack;save();console.error(e);server?.close();app.exit(1);}
};
