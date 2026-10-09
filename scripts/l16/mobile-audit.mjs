import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5186'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(1800);
const browser=await chromium.launch({headless:true});
const results=[];const check=(name,ok,detail)=>results.push({name,ok,detail});
try{
 const page=await browser.newPage({viewport:{width:320,height:568},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:5186');await page.getByLabel('Логин',{exact:true}).waitFor();
 check('320px login has no horizontal scroll',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByLabel('Логин',{exact:true}).focus();
 const outline=await page.getByLabel('Логин',{exact:true}).evaluate(e=>getComputedStyle(e).outlineWidth);
 check('keyboard focus has explicit 3px ring',parseFloat(outline)>=3,outline);
 await page.addStyleTag({content:':root{--test-top:30px} .tekton-login{--mobile-safe-top:var(--test-top)}'});
 check('login respects top inset',await page.locator('.tekton-login').evaluate(e=>parseFloat(getComputedStyle(e).paddingTop)>=30));
 // CSS fixture only, not a real authenticated worker or plant workflow.
 await page.evaluate(()=>{document.body.className='theme-light';document.querySelector('#root').innerHTML='<div class="worker-workspace h-dvh flex flex-col"><header class="worker-topbar">Tekton OS</header><main class="flex-1 overflow-y-auto"><textarea class="tk-input text-xs">Отчёт</textarea><button>Сохранить черновик</button></main><nav class="worker-floating-nav"><a class="worker-tab-active"><span style="color:#f59e0b">В работе</span></a></nav></div>'});
 const textarea=page.locator('textarea');await textarea.focus();
 check('worker field cannot trigger iOS small-font zoom',await textarea.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
 check('worker field keyboard ring',await textarea.evaluate(e=>parseFloat(getComputedStyle(e).outlineWidth)>=3));
 const color=await page.locator('.worker-tab-active span').evaluate(e=>getComputedStyle(e).color);
 const channels=color.match(/\d+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});
 const ratio=1.05/(channels[0]*.2126+channels[1]*.7152+channels[2]*.0722+.05);
 check('light active tab contrast >=4.5:1',ratio>=4.5,{color,ratio});
 mkdirSync('/tmp/l16-evidence',{recursive:true});
 await page.screenshot({path:'/tmp/l16-evidence/light-worker-fixture.png',fullPage:true});
 writeFileSync('/tmp/l16-evidence/mobile-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));if(results.some(x=>!x.ok))process.exitCode=1;
}finally{await browser.close();server.kill()}
