import { chromium } from '@playwright/test';
const browser = await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('http://localhost:5173/', route => route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'}));
await page.goto('http://localhost:5173/');
await page.evaluate(async()=>{
 const {CourtScene}=await import('/src/scene.ts');
 document.body.innerHTML='<canvas id="asset-review" style="width:100vw;height:100vh;display:block"></canvas>';
 const noop=()=>{};
 window.assetReview=new CourtScene(document.querySelector('canvas'),{click:noop,action:noop,character:noop,session:noop,feedback:noop});
 window.assetReview.showGarden(true);
});
await page.waitForTimeout(1800);
await page.screenshot({path:'test-results/garden-assets.png'});
console.log('Garden:',await page.evaluate(()=>({calls:assetReview.renderer.info.render.calls,triangles:assetReview.renderer.info.render.triangles,textures:assetReview.renderer.info.memory.textures})));
await page.evaluate(()=>{assetReview.showGarden(false);['architect','builder','inspector'].forEach(r=>assetReview.setCharacterVisible(r,true));assetReview.setCharacterVisible('virus',false);assetReview.camera.position.set(0,1.45,2.1);assetReview.camera.lookAt(0,1.08,-1.65);});
await page.waitForTimeout(800);
await page.screenshot({path:'test-results/court-assets.png'});
console.log('Court:',await page.evaluate(()=>({calls:assetReview.renderer.info.render.calls,triangles:assetReview.renderer.info.render.triangles})));
console.log('Errors:',errors);
await browser.close();

