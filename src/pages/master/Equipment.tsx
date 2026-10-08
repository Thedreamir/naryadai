import {useEffect,useState} from 'react'
import {useParams,Link} from 'react-router-dom'
import QRCode from 'qrcode'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {useDemoOrders} from '../../components/VisualBlocks'
import {statusOf} from '../../lib/status'
import type {Actor} from '../../App'
export default function Equipment({actor}:{actor:Actor}){
 const {id}=useParams();const [st,setSt]=useState<any>(null);const [qr,setQr]=useState('');const [error,setError]=useState('');
 useEffect(()=>{H.state().then(setSt).catch(e=>setError(e.message));QRCode.toDataURL(location.origin+'/equipment/'+id,{width:256,margin:3,errorCorrectionLevel:'M'}).then(setQr).catch(e=>setError(e.message))},[id]);
 const {visible,control}=useDemoOrders(st?.orders||[]);
 const eq=st?.equipment.find((x:any)=>String(x.id)===id);
 if(error)return <p role="alert">Не удалось открыть оборудование: {error}</p>;if(!st)return <p>Загрузка…</p>;if(!eq)return <p>Оборудование не найдено. Проверьте номер наклейки.</p>;
 const orders=st.orders.filter((o:any)=>String(o.equipment_id)===id);
 return <div className="space-y-4"><h1 className="text-[26px] font-bold">{eq.name}</h1><p className="text-muted">{eq.section} · оборудование #{id} · синтетическое демо</p>{['master','admin'].includes(actor.role)&&<Link to={'/issue?equipment='+id} className="inline-flex items-center justify-center h-12 px-4 rounded-xl bg-primary text-white">Выдать наряд на этот узел</Link>}<details className="visual-explain"><summary>QR-наклейка и печать</summary><div><p className="text-[13px] text-muted">Открывает эту карточку. Вход и права роли обязательны; QR не даёт доступ к данным.</p>{qr&&<img src={qr} width={256} height={256} alt={'QR карточки '+eq.name}/>}<p className="text-[12px] break-all">{location.origin}/equipment/{id}</p><button onClick={()=>print()} className="h-12 px-4 border rounded-xl mt-2">Печать наклейки</button></div></details><h2 className="font-bold">История оборудования</h2>{control}{orders.filter((o:any)=>visible.includes(o)||['in_progress','paused','rework'].includes(o.status)).map((o:any)=><Card key={o.id}><div className="text-[13px]">#{o.id} · {statusOf(o.status).label}</div><b>{o.title}</b><p className="text-[12px] text-muted">{o.created_at&&Number.isFinite(new Date(o.created_at).getTime())?new Date(o.created_at).toLocaleDateString('ru',{timeZone:'Asia/Almaty'}):'Дата не указана'}</p>{actor.role!=='leader'&&<Link className="inline-flex items-center h-11 underline" to={'/orders/'+o.id}>Открыть наряд</Link>}</Card>)}<p className="text-[12px] text-muted">История в пределах прав вашей роли. Ссылка формируется для текущего адреса приложения; localhost-наклейка не подходит для телефона.</p></div>
}
