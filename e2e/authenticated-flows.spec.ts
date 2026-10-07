import {test,expect} from '@playwright/test'
// Live integration tests are opt-in and require dedicated synthetic credentials via secure env.
// No fake PASS: without credentials, tests skip and verify records NOT RUN.
const email=process.env.E2E_MASTER_EMAIL,password=process.env.E2E_MASTER_PASSWORD
test.beforeEach(async({page})=>{test.skip(!email||!password,'Dedicated synthetic master session not configured');await page.goto('/');await page.getByLabel('Логин',{exact:true}).fill(email!);await page.getByLabel('Пароль',{exact:true}).fill(password!);await page.getByRole('button',{name:/войти/i}).click()})
test('master issue form visible and touchable',async({page})=>{await page.goto('/issue');await expect(page.locator('main')).toContainText('наряд');const buttons=await page.locator('main button').evaluateAll(xs=>xs.filter(x=>x.getBoundingClientRect().height>0).every(x=>x.getBoundingClientRect().height>=44));expect(buttons).toBe(true)})
test('master review queue reachable',async({page})=>{await page.goto('/review');await expect(page.locator('main')).toBeVisible();await expect(page.locator('body')).not.toContainText('TypeError')})
test('worker accept/report-photo flow needs dedicated worker fixture',async()=>{test.skip(true,'Dedicated synthetic order fixture and worker session required; not yet executed')})
test('master final check after report needs dedicated fixture',async()=>{test.skip(true,'Full DB-backed cycle not yet executed; no completion claim')})
