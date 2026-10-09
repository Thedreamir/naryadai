import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('qa/l7-security/proposed-rls.sql','utf8');
test('all proposed policies explicitly gate role; no unconditional read',()=>{assert.doesNotMatch(sql,/using\s*\(true\)/i);for(const name of ['read_orders','update_orders','read_notifications','declarations_read','declarations_insert','employee_permits_read']){const body=sql.split('create policy '+name+' ')[1]?.split(';')[0];assert.ok(body,name);assert.match(body,/current_actor_role\(\)/,name)}});
test('declarations follow visible parent order and own-author insertion',()=>{assert.match(sql,/exists\(select 1 from public.orders o where o.id=order_id\)/);assert.match(sql,/declared_by=\(select current_actor\(\)\)/)});
test('baseline inactive role helper and policy assumptions have not drifted',()=>{assert.match(readFileSync('supabase/migrations/039_review_security_semantics.sql','utf8'),/select role from employees where id=current_actor\(\) and is_active/);assert.match(readFileSync('supabase/migrations/032_declarations.sql','utf8'),/create policy declarations_read[\s\S]*?using \(true\)/)});
test('safe columns staging revokes inherited broad grants too',()=>{assert.match(readFileSync('supabase/migrations/064_employee_safe_columns.sql','utf8'),/revoke select on public.employees from public, anon, authenticated, naryad_app/)});
