const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(fn,timeout=15000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await delay(80);}throw Error('Timed out');};
exports.run=async api=>{
  const {app,win,rootData}=api,report={checks:[]};let server;
  try{
    await delay(500);
    const benchmark=await win.webContents.executeJavaScript(`(()=>{const original=current,sample={...current,tabs:Array.from({length:60},(_,i)=>({id:'bench-'+i,title:'Page '+i,url:'https://example.com/'+i,pinned:i<6,loading:false,group:''})),activeId:'bench-10'};render(sample);const observer=new MutationObserver(()=>{});observer.observe(document.getElementById('tabs'),{childList:true,subtree:true});const start=performance.now();for(let i=0;i<120;i++)render(sample);const result={iterations:120,tabs:60,elapsedMs:performance.now()-start,tabMutations:observer.takeRecords().length};observer.disconnect();render(original);return result;})()`);
    report.benchmark=benchmark;fs.writeFileSync(path.join(rootData,'benchmark-'+(process.env.KERNEL_BENCHMARK_LABEL||'after')+'.json'),JSON.stringify(benchmark,null,2));
    if(process.env.KERNEL_BENCHMARK_ONLY){console.log(JSON.stringify(benchmark));app.quit();return;}
    const log=value=>{report.checks.push(value);console.log('PASS '+value);},checks=require('./advanced-checks.cjs');
    if(process.env.KERNEL_ADVANCED_RESTART)await checks.restart(api,log);else{server=checks.fixture();await new Promise(r=>server.listen(0,'127.0.0.1',r));await checks.run(api,report,log,'http://127.0.0.1:'+server.address().port);}
    report.ok=true;server?.closeAllConnections();server?.close();fs.writeFileSync(path.join(rootData,process.env.KERNEL_ADVANCED_RESTART?'advanced-restart-report.json':'advanced-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));app.quit();
  }catch(error){report.ok=false;report.error=error.stack;fs.writeFileSync(path.join(rootData,'advanced-report.json'),JSON.stringify(report,null,2));console.error(error);server?.closeAllConnections();server?.close();app.exit(1);}
};
