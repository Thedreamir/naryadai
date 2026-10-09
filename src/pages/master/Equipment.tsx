import VoiceButton from '../worker/VoiceButton'
import OrderForecastPanel from '../../components/OrderForecastPanel'
import {useLocale} from '../../lib/locale'
import {useEffect,useState} from 'react'
import {useParams,Link} from 'react-router-dom'
import QRCode from 'qrcode'
import CheckPriorityPanel from '../../components/CheckPriorityPanel'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {useDemoOrders} from '../../components/VisualBlocks'
import {statusOf} from '../../lib/status'
import type {Actor} from '../../App'
export default function Equipment({actor}:{actor:Actor}){
  const {t,locale}=useLocale()

 const [stateReason,setStateReason]=useState(''),[stateBusy,setStateBusy]=useState(false);
 const {id}=useParams();const [st,setSt]=useState<any>(null);const [qr,setQr]=useState('');const [error,setError]=useState('');
 useEffect(()=>{H.state().then(setSt).catch(e=>setError(e.message));QRCode.toDataURL(location.origin+'/equipment/'+id,{width:256,margin:3,errorCorrectionLevel:'M'}).then(setQr).catch(e=>setError(e.message))},[id]);
 const orders=(st?.orders||[]).filter((o:any)=>String(o.equipment_id)===id);
 const {visible,control}=useDemoOrders(orders,true);
 const eq=st?.equipment.find((x:any)=>String(x.id)===id);
 if(error)return <p role="alert">{t("Не удалось открыть оборудование:")} {error}</p>;if(!st)return <p>{t("Загрузка…")}</p>;if(!eq)return <p>{t("Оборудование не найдено. Проверьте номер наклейки.")}</p>;
 const recordState=async(state:string)=>{setStateBusy(true);try{await H.recordEquipmentState(Number(id),state,stateReason);setSt(await H.state());setStateReason('')}catch(e){setError((e as Error).message)}finally{setStateBusy(false)}};
 return <div className="space-y-4"><h1 className="text-[26px] font-bold">{eq.name}</h1><p className="text-muted">{eq.section} {t("· оборудование #")}{id} {t("· учебный набор данных")}</p>{['master','admin'].includes(actor.role)&&<Link to={'/issue?equipment='+id} className="inline-flex items-center justify-center h-12 px-4 rounded-xl bg-primary text-white">{t("Выдать наряд на этот узел")}</Link>}<details className="visual-explain"><summary>{t("QR-наклейка и печать")}</summary><div><p className="text-[13px] text-muted">{t("Открывает эту карточку. Вход и права роли обязательны; QR не даёт доступ к данным.")}</p>{qr&&<img src={qr} width={256} height={256} alt={t('QR карточки {name}').replace('{name}',()=>String(eq.name))}/>}<p className="text-[12px] break-all">{location.origin}/equipment/{id}</p><button onClick={()=>print()} className="h-12 px-4 border rounded-xl mt-2">{t("Печать наклейки")}</button></div></details>{['master','admin','leader'].includes(actor.role)&&<CheckPriorityPanel orders={orders} equipment={[eq]} canOpenOrders={actor.role!=='leader'}/>}{['master','admin','leader'].includes(actor.role)&&<OrderForecastPanel orders={orders} equipment={[eq]} offline={st.offline}/>}{import.meta.env.VITE_EQUIPMENT_STATE_LIVE==='1'&&['master','admin'].includes(actor.role)&&<Card><h2 className="font-bold">{t("Состояние оборудования")}</h2><p className="text-xs text-muted">{t("Личное наблюдение, не статус наряда. Время ставит сервер.")}</p><textarea aria-label={t("Причина состояния оборудования")} className="tk-input w-full p-3" placeholder={t("Что наблюдали?")} value={stateReason} onChange={e=>setStateReason(e.target.value)}/><VoiceButton onText={text=>setStateReason(previous=>previous?previous+' '+text:text)}/><div className="flex gap-2"><button className="tk-touch tk-sub" disabled={stateBusy||stateReason.trim().length<3} onClick={()=>recordState('down')}>{t("Остановлено")}</button><button className="tk-touch tk-sub" disabled={stateBusy||stateReason.trim().length<3} onClick={()=>recordState('running')}>{t("Работает")}</button></div></Card>}<h2 className="font-bold">{t("История оборудования")}</h2>{control}{visible.map((o:any)=><Card key={o.id}><div className="text-[13px]">#{o.id} · {t(statusOf(o.status).label)}</div><b>{o.title}</b><p className="text-[12px] text-muted">{o.created_at&&Number.isFinite(new Date(o.created_at).getTime())?new Date(o.created_at).toLocaleDateString(locale==='kz'?'kk-KZ':'ru-RU',{timeZone:'Asia/Almaty'}):t("Дата не указана")}</p>{actor.role!=='leader'&&<Link className="inline-flex items-center h-11 underline" to={'/orders/'+o.id}>{t("Открыть наряд")}</Link>}</Card>)}<p className="text-[12px] text-muted">{t("История в пределах прав вашей роли. Ссылка формируется для текущего адреса приложения; localhost-наклейка не подходит для телефона.")}</p></div>
}
