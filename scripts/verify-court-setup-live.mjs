import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';

const site=process.env.VERIFY_SITE||'https://gameofcodes.si';
const project=randomUUID();
const browser=await chromium.launch({args:['--use-angle=d3d11','--autoplay-policy=no-user-gesture-required']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const requests=[];page.on('request',request=>{if(request.method()==='POST')requests.push(new URL(request.url()).pathname);});
  await page.goto(`${site}/?project=${project}`);
  await page.waitForFunction(()=>document.body.dataset.appReady==='true');
  assert.match(await page.locator('#session-context').innerText(),/Cloud/);
  await page.locator('#quiet').click(); // Verify the flow without purchasing narration.
  await page.locator('#begin-reign').click();
  await page.locator('#setup-name').fill('Live verification');
  await page.locator('[data-setup="profile-next"]').click();
  await page.locator('[data-setup="cloud"]').click();
  await page.locator('[data-setup="explore"]').click();
  await page.waitForFunction(()=>document.body.dataset.tourStage==='brain');
  await page.locator('#tour-continue').click();
  await page.waitForFunction(()=>document.body.dataset.tourStage==='gesture');
  await page.locator('#tour-continue').click();
  await page.waitForFunction(()=>document.body.dataset.tourStage==='ready');
  const state=await fetch(`${site}/api/court/status?project=${project}`).then(r=>r.json());
  assert.equal(state.mode,'cloud');assert.equal(state.setup.profileName,'Live verification');
  assert.equal(state.setup.activity,'explore');assert.equal(state.onboarded,true);
  assert.equal(state.charter,null);assert.equal(state.artifact,null);
  assert.ok(!requests.some(path=>/\/(plan-idea|build|converse|voice)$/.test(path)));
  assert.deepEqual(errors,[]);
  console.log('PASS public profile, actual cloud selection, persistence and exploration without model/build requests');
  console.log('Verification project: '+project);
}finally{await browser.close();}
