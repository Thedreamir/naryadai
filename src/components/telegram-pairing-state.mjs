export const BOT='TektonOSdreamlabs_bot';
export function validToken(t){return typeof t==='string'&&/^[A-Za-z0-9_-]{43}$/.test(t)}
export function pairingLink(token){if(!validToken(token))throw Error('invalid token');return `https://t.me/${BOT}?start=${token}`}
export function alive(expiresAt,now=Date.now()){const at=Date.parse(expiresAt||'');return Number.isFinite(at)&&at>now}
export function pendingReady(p,now=Date.now()){return !!(p&&typeof p.id==='string'&&/^[0-9a-f-]{36}$/i.test(p.id)&&typeof p.pending_chat==='string'&&/^[1-9][0-9]{0,15}$/.test(p.pending_chat)&&p.confirmed===false&&alive(p.expires_at,now))}
export function createResult(r){if(!r||typeof r.id!=='string'||!alive(r.expires_at))throw Error('Не удалось создать действующую ссылку');return r.expires_at}
