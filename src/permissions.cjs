function permissionAllowed(permission,settings,origin,active){
  if(!active)return false;
  if(['fullscreen','pointerLock','clipboard-sanitized-write'].includes(permission))return true;
  const policy={media:settings.mediaPermission,geolocation:settings.locationPermission,notifications:settings.notificationPermission,'clipboard-read':settings.clipboardPermission}[permission];
  if(!policy)return false;
  const remembered=settings.sitePermissions?.[origin]?.[permission];
  return remembered?remembered==='allow':policy==='allow';
}
module.exports={permissionAllowed};
