const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {session}=require('electron');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.run=async({app,win,accounts,state,createTab,tabs})=>{
  const file=path.join(app.getPath('userData'),'account-flow.json');let flow={phase:0,checks:[]};try{flow=JSON.parse(fs.readFileSync(file));}catch{}
  const save=()=>fs.writeFileSync(file,JSON.stringify(flow,null,2));
  const js=code=>win.webContents.executeJavaScript(code,true);
  const cookie=()=>session.fromPartition(accounts.storage().webPartition).cookies;
  const log=s=>{flow.checks.push(s);save();console.log('PASS '+s);};
  try{
    await delay(300);assert.equal(state().account.developer,false);assert.notEqual(state().account.id,'777');
    if(flow.phase===0){
      await js('document.getElementById("account-button").click()');await delay(100);
      assert.equal(await js('document.querySelector("[data-section=account]").classList.contains("hidden")'),false);
      flow.phase=1;save();await js('document.getElementById("show-register").click();document.getElementById("register-name").value="Alice";document.getElementById("register-password").value="Alice test password";document.getElementById("register-form").requestSubmit()');
    }else if(flow.phase===1){
      assert.equal(accounts.info().name,'Alice');flow.aliceId=accounts.info().id;
      await cookie().set({url:'https://example.com',name:'account-test',value:'Alice',expirationDate:Date.now()/1000+3600});await js('localStorage.setItem("account-test","Alice")');log('Registration form creates Alice and restarts into her protected local profile');
      flow.phase=2;save();await js('window.kernel.call("account:logout")');
    }else if(flow.phase===2){
      assert.equal(accounts.info().guest,true);assert.equal((await cookie().get({name:'account-test'})).length,0);assert.equal(await js('localStorage.getItem("account-test")'),null);log('Guest cannot see Alice cookies or chat storage');
      flow.phase=3;save();await js('window.kernel.call("account:create",{name:"Bob",password:"Bob test password",id:"777",developer:true})');
    }else if(flow.phase===3){
      assert.equal(accounts.info().name,'Bob');assert.notEqual(accounts.info().id,flow.aliceId);assert.equal((await cookie().get({name:'account-test'})).length,0);assert.equal(await js('localStorage.getItem("account-test")'),null);
      await cookie().set({url:'https://example.com',name:'account-test',value:'Bob',expirationDate:Date.now()/1000+3600});await js('localStorage.setItem("account-test","Bob")');log('Bob has a different ID and isolated storage; requesting ID 777 and DEV has no effect');
      flow.phase=4;save();await js('window.kernel.call("account:logout")');
    }else if(flow.phase===4){
      flow.phase=5;save();await js('document.getElementById("account-button").click()');await delay(100);await js('document.getElementById("login-name").value="'+flow.aliceId+'";document.getElementById("login-password").value="Alice test password";document.getElementById("login-form").requestSubmit()');
    }else if(flow.phase===5){
      assert.equal(accounts.info().name,'Alice');assert.equal((await cookie().get({name:'account-test'}))[0].value,'Alice');assert.equal(await js('localStorage.getItem("account-test")'),'Alice');assert.equal(await js('document.getElementById("account-dev").classList.contains("hidden")'),true);log('Password login by ID restores Alice data after multiple real process restarts');flow.ok=true;save();app.quit();
    }
  }catch(e){flow.ok=false;flow.error=e.stack;save();console.error(e);app.exit(1);}
};
