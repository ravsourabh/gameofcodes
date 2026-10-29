import {test,expect} from '@playwright/test';
test('the hosted studio boots without a development socket or document reload',async({page})=>{
 test.skip(!process.env.GOC_HOSTED_VERIFY_URL,'An explicit deployed verification URL is required.');test.setTimeout(60000);
 // This checks the real hosted shell without loading a desktop 3D scene.
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:any,...args:any[]){return String(type).startsWith('webgl')?null:(get as any).call(this,type,...args);} as any;});
 let navigations=0,sockets=0;const errors:string[]=[];page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});page.on('websocket',()=>sockets++);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.GOC_HOSTED_VERIFY_URL!);await expect(page.locator('body')).toHaveAttribute('data-studio-ready','true');await expect(page.locator('#boot-screen')).toBeHidden();expect(await page.locator('script[src*="/@vite/client"]').count()).toBe(0);
 const token=await page.evaluate(()=>{const marker=crypto.randomUUID();(window as any).__stabilityMarker=marker;return marker;});await page.waitForTimeout(35000);expect(await page.evaluate(()=>(window as any).__stabilityMarker)).toBe(token);expect(navigations).toBe(1);expect(sockets).toBe(0);expect(errors).toEqual([]);
});
