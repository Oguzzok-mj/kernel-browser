// Conservative guard used before discarding a page or changing a workspace.
function inspectTabState(){
 const controls=[...document.querySelectorAll('input,textarea,select')];
 const dirty=controls.some(e=>e.type==='checkbox'||e.type==='radio'?e.checked!==e.defaultChecked:e.tagName==='SELECT'?[...e.options].some((o,i)=>o.selected!==(o.defaultSelected||!e.multiple&&!e.querySelector('option[selected]')&&i===0)):e.value!==e.defaultValue);
 return{dirty:dirty||!!document.querySelector('[contenteditable=true],[contenteditable=""]'),media:[...document.querySelectorAll('video,audio')].some(e=>!e.paused),capture:[...document.querySelectorAll('video,audio')].some(e=>e.srcObject?.active),scroll:{x:scrollX,y:scrollY}};
}
const INSPECT_TAB='('+inspectTabState.toString()+')()';
module.exports={INSPECT_TAB};
