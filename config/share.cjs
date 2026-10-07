const base=require('../package.json').build;
module.exports={...base,
  directories:{...base.directories,output:'../share-build'},
  extraResources:base.extraResources.filter(resource=>resource.to!=='models'),
  win:{...base.win,target:['portable']},
  // In pinned electron-builder 26.15.3, true leaves UNPACK_DIR_NAME unset,
  // so NSIS uses a separate $PLUGINSDIR for each launch. false generates a fixed name.
  portable:{artifactName:'Kernel-${version}.exe',requestExecutionLevel:'user',unpackDirName:true,useZip:true}
};
