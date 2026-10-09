// Conservative policy for a future queue adapter. No network effects.
// Adapter must confirm these are the actual provider response, never a proxy/error page.
export function classifyProviderResult({provider,httpStatus,body,messageId,transportError=false}) {
 if(transportError)return 'uncertain';
 if(provider==='telegram') {
  if(httpStatus>=200&&httpStatus<300&&body?.ok===true&&Number.isSafeInteger(messageId)&&messageId>0)return 'sent';
  // Telegram confirms refusal via ok:false. A plain HTTP 5xx may hide an accepted send.
  if(body?.ok===false&&body.error_code===httpStatus) {
   if(httpStatus===429)return 'transient_rejected';
   if([400,401,403,404].includes(httpStatus))return 'permanent_rejected';
  }
  return 'uncertain';
 }
 // A future push adapter must map library/provider-specific results explicitly.
 return 'uncertain';
}
export function retryDelay(attempt,retryAfter=0) {
 if(!Number.isInteger(attempt)||attempt<1||attempt>5)throw Error('invalid attempt');
 const minimum=Number.isFinite(retryAfter)?Math.max(0,Math.ceil(retryAfter)):0;
 if(minimum>86400)return null; // manual long deferral, never shorten provider minimum
 return Math.max(30*2**(attempt-1),minimum);
}
