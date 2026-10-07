import {chromium} from 'playwright'
const b=await chromium.launch()
const shot=async(email,pw,paths,tag)=>{
 const pg=await (await b.newContext({viewport:{width:1600,height:1000}})).newPage()
 await pg.goto('http://127.0.0.1:4173/login');await pg.fill('input[type=email]',email);await pg.fill('input[type=password]',pw);await pg.click('button:has-text("Войти")')
 await pg.waitForSelector('aside',{timeout:30000})
 for(const [path,name] of paths){await pg.goto('http://127.0.0.1:4173'+path,{waitUntil:'networkidle'}).catch(()=>{});await pg.waitForTimeout(2500);await pg.screenshot({path:`/tmp/design-${tag}-${name}.png`})}
 await pg.context().close()
}
await shot('master@naryadai.test',process.env.PW_MASTER,[['/','board'],['/report','report']],'master')
await shot('leader@naryadai.test',process.env.PW_LEADER,[['/','overview'],['/report','report']],'leader')
await b.close();console.log('done')
