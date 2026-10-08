// Server-only verification, not login or a role grant. No real bot token in source.
const enc=new TextEncoder();
async function hmac(key,value){const k=await crypto.subtle.importKey('raw',typeof key==='string'?enc.encode(key):key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(value)))}
function equalHex(bytes,hex){if(!/^[a-fA-F0-9]{64}$/.test(hex))return false;let diff=0;for(let i=0;i<32;i++)diff|=bytes[i]^parseInt(hex.slice(i*2,i*2+2),16);return diff===0}
export async function verifyInitData(raw,token,{now=Math.floor(Date.now()/1000),maxAge=300,futureSkew=30}={}){
 if(typeof raw!=='string'||raw.length>16384||!raw||typeof token!=='string'||!token)throw Error('invalid input');
 // URLSearchParams is permissive about invalid escapes; reject those first.
 if(/%(?![0-9a-fA-F]{2})/.test(raw))throw Error('invalid encoding');
 const pairs=new URLSearchParams(raw),seen=new Set();for(const [k,v]of pairs){if(seen.has(k)||!/^[a-z_]+$/.test(k)||/[\r\n]/.test(k))throw Error('invalid fields');seen.add(k)}
 const hash=pairs.get('hash')||'';pairs.delete('hash');
 const date=pairs.get('auth_date')||'';if(!/^\d{1,12}$/.test(date))throw Error('invalid date');const age=now-Number(date);if(age>maxAge||age<-futureSkew)throw Error('stale data');
 const text=[...pairs].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
 const secret=await hmac('WebAppData',token);if(!equalHex(await hmac(secret,text),hash))throw Error('invalid signature');
 let user;try{user=JSON.parse(pairs.get('user')||'')}catch{throw Error('invalid user')};if(!Number.isSafeInteger(user.id)||user.id<=0||user.is_bot)throw Error('invalid user');
 return {telegramId:String(user.id),authDate:Number(date),replayKey:hash.toLowerCase()};
}
export function verifiedBinding(identity,binding,employee){return !!identity&&binding?.telegram_id===identity.telegramId&&!binding.revoked_at&&!!binding.confirmed_at&&binding.employee_id===employee?.id&&employee.is_active===true&&['worker','master','leader','admin'].includes(employee.role)}
