const base=require('./installer.cjs');
module.exports={...base,directories:{...base.directories,output:'../distribution-build'},win:{...base.win,target:['nsis','portable']},portable:{artifactName:'Kernel-${version}.exe',requestExecutionLevel:'user',unpackDirName:true,useZip:true}};
