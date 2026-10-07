import fs from 'node:fs';const checks=[];function check(path,name,fn){if(!fs.existsSync(path)){checks.push({name,status:'NOT RUN',reason:'missing '+path});return}checks.push({name,status:fn(fs.readFileSync(path,'utf8'))?'PASS':'FAIL'})}
check('src-legacy/hosted.ts','status uses transition_order RPC',s=>s.includes("rpc('transition_order'")&&s.includes('expected_version: x.version'));
check('supabase/migrations/056_one_active_order.sql','one active partial unique index staged',s=>s.includes('create unique index')&&s.includes("status='in_progress' and not cancelled"));
check('src-legacy/hosted.ts','photo upload boundary sanitizer',s=>s.includes('dataUrlToBytes(await sanitizeDataUrl(dataUrl))'));
check('src/lib/photo-sanitize.ts','decode/reencode and resource finally',s=>s.includes('createImageBitmap')&&s.includes('canvas.toBlob')&&s.includes('finally')&&s.includes('URL.revokeObjectURL'));
console.log(JSON.stringify({checks,limits:'Static presence only: migrations/live parity, concurrency, EXIF corpus and all endpoints require runtime tests, not proven by grep'},null,2));if(checks.some(x=>x.status!=='PASS'))process.exitCode=1;
