const base=require('../package.json').build;
module.exports={...base,
 directories:{...base.directories,output:'../installer-build'},
 extraResources:base.extraResources.filter(resource=>resource.to!=='models'),
 win:{...base.win,target:['nsis']},
 nsis:{artifactName:'Kernel-Setup-${version}.exe',oneClick:false,perMachine:false,allowElevation:false,allowToChangeInstallationDirectory:true,installerLanguages:['ru_RU'],language:'1049',displayLanguageSelector:false,include:'config/installer.nsh',installerHeader:'assets/installer-header.bmp',installerSidebar:'assets/installer-sidebar.bmp',uninstallerSidebar:'assets/installer-sidebar.bmp',createDesktopShortcut:'always',createStartMenuShortcut:true,shortcutName:'Kernel',deleteAppDataOnUninstall:false,runAfterFinish:false,uninstallDisplayName:'Kernel',differentialPackage:false,useZip:true}
};

