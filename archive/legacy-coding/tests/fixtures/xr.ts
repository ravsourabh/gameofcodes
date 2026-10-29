import {expect,type Page} from '@playwright/test';

export async function pinchWorld(page:Page,x:number,y:number,z:number){
  await page.evaluate(async({x,y,z})=>{
    const frame=()=>new Promise<void>((resolve,reject)=>{const before=document.body.dataset.courtFrame,observer=new MutationObserver(()=>{if(document.body.dataset.courtFrame!==before){observer.disconnect();clearTimeout(timer);resolve();}}),timer=setTimeout(()=>{observer.disconnect();reject(new Error('Court did not render a hand frame.'));},12000);observer.observe(document.body,{attributes:true,attributeFilter:['data-court-frame']});});
    const hand=(window as any).xrDevice.hands.right;hand.position.set(.25,1.3,-.4);const dx=x-.25,dy=y-1.3,dz=z-2.1,l=Math.hypot(dx,dy,dz),vx=dx/l,vy=dy/l,vz=dz/l,w=1-vz,q=Math.hypot(vy,-vx,w);hand.quaternion.set(vy/q,-vx/q,0,w/q);
    await frame();hand.updatePinchValue(1);await frame();await frame();hand.updatePinchValue(0);await frame();await frame();
  },{x,y,z});
}
export async function pinchAction(page:Page,action:string){
  const find=()=>page.evaluate(action=>{const surfaces=JSON.parse(document.body.dataset.nativeSurfaces||'[]');for(const s of surfaces){const b=s.buttons.find((b:any)=>b.action===action);if(!b)continue;const x=((b.x+b.width/2)/s.canvas[0]-.5)*s.size[0],y=(.5-(b.y+b.height/2)/s.canvas[1])*s.size[1];return{x:s.position[0]+x*Math.cos(s.yaw),y:s.position[1]+y,z:s.position[2]-x*Math.sin(s.yaw)};}return null;},action);
  let target=await find();if(!target&&action!=='court:menu'){await pinchAction(page,'court:menu');target=await find();}
  expect(target,`Visible native target ${action}`).not.toBeNull();await pinchWorld(page,target!.x,target!.y,target!.z);
  if(process.env.GOC_XR_DEBUG)console.log(JSON.stringify({target:action,last:await page.locator('body').getAttribute('data-court-action'),frame:await page.locator('body').getAttribute('data-court-frame'),keyboard:await page.locator('body').getAttribute('data-keyboard-open')}));
}
