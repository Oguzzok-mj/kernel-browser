const fs=require('node:fs'),assert=require('node:assert/strict');const {session}=require('electron');
exports.run=async({app,win,state,rootData,webPartition,uiPartition})=>{
 const report={root:rootData,ok:false};try{
  assert.equal(state().advanced.ghost,true);assert.equal(state().settings.saveHistory,false);assert.equal(state().history.length,0);assert.equal(state().account.guest,true);assert.ok(!webPartition.startsWith('persist:'));assert.ok(!uiPartition.startsWith('persist:'));
  const ses=session.fromPartition(webPartition),url=process.env.KERNEL_GHOST_FIXTURE;assert.deepEqual(await ses.cookies.get({url}),[]);await ses.cookies.set({url,name:'ghost-only',value:'temporary'});assert.equal((await ses.cookies.get({url}))[0].name,'ghost-only');
  assert.equal(await win.webContents.executeJavaScript('localStorage.getItem("normal-only")'),null);await win.webContents.executeJavaScript('localStorage.setItem("ghost-only","temporary")');report.ok=true;
 }catch(e){report.error=e.stack;}finally{fs.writeFileSync(process.env.KERNEL_GHOST_REPORT,JSON.stringify(report,null,2));app.quit();}
};
