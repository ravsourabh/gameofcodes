import type {Page} from '@playwright/test';
export async function leaveGuide(page:Page){if(!await page.locator('[data-guide="free"]').isVisible())await page.locator('#court-tools').click();await page.locator('[data-guide="free"]').click();}
export async function discussionAction(page:Page,action:string){const button=page.locator(`[data-discuss="${action}"]`);for(let i=0;i<4&&!await button.isVisible();i++)await page.locator('[data-discuss="more"]').click();await button.click();}
export async function clickActor(page:Page,id:string){
 await page.waitForFunction(id=>!!JSON.parse(document.body.dataset.courtActors||'[]').find((a:any)=>a.id===id)?.joints?.Head&&!!document.body.dataset.courtCamera,id);
 const point=await page.evaluate(id=>{const actor=JSON.parse(document.body.dataset.courtActors||'[]').find((a:any)=>a.id===id),head=actor?.joints?.Head,camera=JSON.parse(document.body.dataset.courtCamera||'null');if(!head||!camera)throw new Error('Wait for the loaded actor and rendered camera.');const m=camera.viewProjection,[x,y,z]=head,w=m[3]*x+m[7]*y+m[11]*z+m[15],canvas=document.querySelector('canvas')!.getBoundingClientRect();return {x:((m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5)*canvas.width,y:(.5-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5)*canvas.height};},id);await page.locator('#session-world').click({position:point});
}
