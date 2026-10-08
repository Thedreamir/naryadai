// Disabled until server-owned numeric aggregate schema and privacy controls exist.
const cors={'Access-Control-Allow-Origin':Deno.env.get('PWA_ORIGIN')||'','Access-Control-Allow-Headers':'authorization, apikey, content-type','Vary':'Origin'};
Deno.serve(req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 return new Response(JSON.stringify({error:'summary temporarily unavailable',code:'SUMMARY_DISABLED'}),{status:503,headers:{...cors,'Content-Type':'application/json'}});
});
