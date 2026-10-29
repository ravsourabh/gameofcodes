// Update controls and captions without disconnecting the live stage or media.
const key=(node:Node)=>{
 if(!(node instanceof Element))return '';
 if(node.id)return 'id:'+node.id;
 const action=node.getAttribute('data-action');if(action)return 'action:'+action;
 for(const name of ['studio-shell','studio-header','studio-dock','watch-bar','graphics-fallback','xr-exit'])if(node.classList.contains(name))return 'class:'+name;
 return '';
};
const compatible=(a:Node,b:Node)=>a.nodeType===b.nodeType&&(!(a instanceof Element)||b instanceof Element&&a.tagName===b.tagName);
function patch(node:Node,next:Node){
 if(node instanceof HTMLCanvasElement&&node.id==='studio-world')return;
 if(!(node instanceof Element)||!(next instanceof Element)){if(node.nodeValue!==next.nodeValue)node.nodeValue=next.nodeValue;return;}
 for(const attribute of [...node.attributes])if(!next.hasAttribute(attribute.name)&&!(node instanceof HTMLDetailsElement&&attribute.name==='open'))node.removeAttribute(attribute.name);
 for(const attribute of [...next.attributes])if(node.getAttribute(attribute.name)!==attribute.value)node.setAttribute(attribute.name,attribute.value);
 children(node,next);
 if(node instanceof HTMLInputElement&&next instanceof HTMLInputElement){if(node.type!=='file'&&node.value!==next.value)node.value=next.value;if(node.checked!==next.checked)node.checked=next.checked;}
 if(node instanceof HTMLTextAreaElement&&next instanceof HTMLTextAreaElement&&node.value!==next.value)node.value=next.value;
 if(node instanceof HTMLSelectElement&&next instanceof HTMLSelectElement&&node.value!==next.value)node.value=next.value;
}
function children(parent:Node,next:Node){
 const old:Node[]=[...parent.childNodes],used=new Set<Node>();let cursor=parent.firstChild;
 for(const desired of [...next.childNodes]){
  const id=key(desired);let node=old.find(candidate=>!used.has(candidate)&&key(candidate)===id&&compatible(candidate,desired));
  if(!node)node=desired.cloneNode(true);
  if(node!==cursor)parent.insertBefore(node,cursor);
  patch(node,desired);used.add(node);cursor=node.nextSibling;
 }
 for(const node of [...parent.childNodes])if(!used.has(node))parent.removeChild(node);
}
export function patchStudioMarkup(root:HTMLElement,markup:string){const template=document.createElement('template');template.innerHTML=markup;children(root,template.content);}
