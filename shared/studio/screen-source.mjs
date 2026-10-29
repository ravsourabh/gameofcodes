export function validateScreenSourceUrl(value){
 if(value===undefined)return;
 if(typeof value!=='string'||value.length>2048)throw new Error('Use a bounded direct media link.');
 let url;try{url=new URL(value);}catch{throw new Error('Use an absolute direct media link.');}
 if(url.username||url.password||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Use a direct HTTPS media link without credentials.');
}
