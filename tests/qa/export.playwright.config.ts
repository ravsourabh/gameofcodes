import {defineConfig} from '@playwright/test';
import path from 'node:path';

if(!process.env.GOC_QA_ARTIFACTS||!process.env.GOC_QA_DIST)throw Error('Run scripts/qa/run-studio-export.mjs for an isolated production acceptance run.');
const baseURL=`http://127.0.0.1:${process.env.GOC_QA_PORT||5571}`;
process.env.GOC_QA_PROXY='1';process.env.GOC_QA_URL=baseURL;
export default defineConfig({
  testDir:'..',testMatch:'studio.spec.ts',grep:new RegExp(process.env.GOC_QA_GREP||'an export downloads automatically'),
  workers:1,fullyParallel:false,timeout:1200000,expect:{timeout:30000},
  outputDir:path.join(process.env.GOC_QA_ARTIFACTS,'playwright'),
  reporter:[['list'],['json',{outputFile:path.join(process.env.GOC_QA_ARTIFACTS,'playwright.json')}]],
  use:{baseURL,viewport:{width:1280,height:800},deviceScaleFactor:1,acceptDownloads:true,screenshot:'only-on-failure',trace:'retain-on-failure',
    launchOptions:{args:process.platform==='win32'?['--use-angle=d3d11','--enable-unsafe-swiftshader']:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}},
  webServer:{command:`"${process.execPath}" scripts/qa/studio-export-gateway.mjs`,cwd:path.resolve(import.meta.dirname,'../..'),url:baseURL+'/__qa/health',reuseExistingServer:false,timeout:30000},
});
