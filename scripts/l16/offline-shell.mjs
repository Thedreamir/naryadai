import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5187'],{stdio:'ignore'});await new Promise(r=>setTimeout(r,1500));
const browser=await chromium.launch();
try{const context=await browser.newContext({viewport:{width:320,height:568}});const page=await context.newPage();
await page.goto('http://127.0.0.1:5187');await page.getByLabel('Логин',{exact:true}).waitFor();
await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
const keys=await page.evaluate(async()=>{const names=await caches.keys();return (await Promise.all(names.map(async n=>(await(await caches.open(n)).keys()).map(r=>r.url)))).flat()});
await context.setOffline(true);await page.reload();await page.getByLabel('Логин',{exact:true}).waitFor();
await page.screenshot({path:'/tmp/l16-evidence/offline-login.png',fullPage:true});
const result={warmOfflineLoginShell:true,precacheFonts:keys.filter(x=>/woff|ttf/.test(x)),cachedRequests:keys.length,limits:'Unauthenticated warm shell only. Not worker auth, drafts, transitions, cold install, or physical iPhone.'};console.log(result);writeFileSync('/tmp/l16-evidence/offline-results.json',JSON.stringify(result,null,2));
}finally{await browser.close();server.kill()}
