import {useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/data'
import {useLocale} from '../lib/locale'
import {makeBindingToken,hashToken} from '../lib/telegram-core.mjs'
import {pairingLink,alive,pendingReady,createResult} from './telegram-pairing-state.mjs'
type Pending={id:string;pending_chat?:string;expires_at:string;confirmed:boolean}
export default function TelegramPairing(){
 const {t}=useLocale();const [link,setLink]=useState(''),[expires,setExpires]=useState(''),[pending,setPending]=useState<Pending|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false),[own,setOwn]=useState(false),[now,setNow]=useState(Date.now());const lock=useRef(false)
 const pendingIdentity=useRef('');
 const configured=import.meta.env.VITE_TELEGRAM_PAIRING==='true'
 useEffect(()=>{if(!expires)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[expires])
 async function rpc(name:string,args:Record<string,unknown>={}){if(!supabase)throw Error('Авторизация недоступна');const r=await supabase.rpc(name,args);if(r.error)throw Error('Не удалось выполнить действие. Попробуйте позже.');return r.data}
 async function action(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await fn()}catch(e){setError((e as Error).message)}finally{lock.current=false;setBusy(false)}}
 useEffect(()=>{
  if(!configured)return;let cancelled=false;let running=false;
  async function check(){if(cancelled||running||lock.current||document.visibilityState==='hidden')return;running=true;try{const p=await rpc('telegram_pair_status');if(cancelled||lock.current)return;const identity=p?.pending_chat?String(p.id)+':'+String(p.pending_chat):'';if(identity!==pendingIdentity.current){pendingIdentity.current=identity;setOwn(false)}setPending(p?.id?p:null);setConfirmed(p?.connected===true);if(p?.pending_chat||p?.confirmed)setLink('');if(p?.expires_at)setExpires(p.expires_at);setNow(Date.now());setError('')}catch(e){if(!cancelled)setError((e as Error).message)}finally{running=false}}
  check();const timer=setInterval(check,60000);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
  return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)}
 },[configured]);
 const expired=!!expires&&!alive(expires,now);const button='min-h-14 w-full border rounded-lg px-3 py-3';
 return <section className="tk-card p-3.5 space-y-3" aria-label="Telegram"><h3>Telegram</h3>{!configured?<p>{t('Telegram: подключение пока не включено.')}</p>:<>
 <p>{t('Привяжите свой Telegram к текущему профилю. Обычная команда /start не создаёт привязку.')}</p>
 <button className={button} disabled={busy} onClick={()=>action(async()=>{setLink('');setPending(null);setOwn(false);setConfirmed(false);setExpires('');const token=makeBindingToken();const r=await rpc('telegram_pair_create',{p_hash:await hashToken(token)});setExpires(createResult(r));setNow(Date.now());setLink(pairingLink(token))})}>{t('Привязать Telegram')}</button>
 {link&&!expired&&<><p>{t('Ссылка действует 10 минут и используется один раз. Не пересылайте её.')}</p><a className={'block text-center '+button} href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{t('Открыть бота')}</a><p>{t('Нажмите Start в боте, затем вернитесь сюда.')}</p></>}
 {expired&&<p role="status">{t('Ссылка истекла. Нажмите «Привязать Telegram» ещё раз.')}</p>}
 {confirmed&&<p role="status">{t('Telegram привязан. Доставка уведомлений проверяется отдельно.')}</p>}{pendingReady(pending,now)&&<p role="status">{t('Подтвердить мой аккаунт')}</p>}<details open={pendingReady(pending,now)||undefined} className="telegram-extra-settings"><summary>{t('Статус и настройки подключения')}</summary><button className={button} disabled={busy} onClick={()=>action(async()=>{setOwn(false);const p=await rpc('telegram_pair_status');setPending(p?.id?p:null);setConfirmed(p?.connected===true);if(p?.pending_chat)setLink('');if(p?.expires_at)setExpires(p.expires_at);setNow(Date.now());if(p?.connected){setConfirmed(true);setLink('')} })}>{t('Проверить подключение')}</button>
 {pendingReady(pending,now)&&<div className="space-y-3"><p>Telegram ID: {pending!.pending_chat}</p><label className="flex items-center gap-3 min-h-14"><input type="checkbox" checked={own} onChange={e=>setOwn(e.target.checked)} disabled={busy}/>{t('Я открыл эту ссылку в своём Telegram. Это мой аккаунт.')}</label><button className={button} disabled={busy||!own} onClick={()=>action(async()=>{if(!own||!pendingReady(pending))throw Error('Подтверждение недоступно');const ok=await rpc('telegram_pair_confirm',{p_id:pending!.id,p_expected_chat:pending!.pending_chat});if(ok!==true)throw Error('Привязка не подтверждена. Создайте новую ссылку.');setConfirmed(true);setLink('');setPending(null);setOwn(false)})}>{t('Подтвердить мой аккаунт')}</button></div>}
 {confirmed&&<p role="status">{t('Telegram привязан. Доставка уведомлений проверяется отдельно.')}</p>}
 <button className={button} disabled={busy} onClick={()=>action(async()=>{await rpc('telegram_disconnect');setLink('');setExpires('');setPending(null);setConfirmed(false);setOwn(false)})}>{t('Отключить Telegram')}</button></details>
 </>}{error&&<p role="alert">{t(error)}</p>}</section>
}
