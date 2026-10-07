import {usePrefs} from '../../ui/prefs'
import PushButton from '../../components/PushButton'
import {Sun, Moon, Hand, Type} from 'lucide-react'
import {cn} from '../../lib/utils'
export default function Settings(){
  const {theme,setTheme,scale,setScale,glove,setGlove}=usePrefs()
  const seg=(active:boolean)=>cn('flex-1 py-2.5 px-1 rounded-lg text-[0.6875rem] font-black uppercase border transition text-center',active?'bg-tk-amber text-black border-amber-600':'tk-sub')
  return <div className="space-y-3">
    <h2 className="text-sm font-black uppercase tracking-wider px-1">Настройки</h2>
    <div className="tk-card p-3.5 space-y-2">
      <div className="text-[0.6875rem] font-black uppercase flex items-center gap-1.5" style={{color:'var(--tk-muted)'}}><Sun size={19}/>Тема</div>
      <div className="flex gap-2">
        <button className={seg(theme==='dark')} onClick={()=>setTheme('dark')}><Moon size={19} className="inline mr-1"/>Тёмная</button>
        <button className={seg(theme==='light')} onClick={()=>setTheme('light')}><Sun size={19} className="inline mr-1"/>Светлая</button>
      </div>
    </div>
    <div className="tk-card p-3.5 space-y-2">
      <div className="text-[0.6875rem] font-black uppercase flex items-center gap-1.5" style={{color:'var(--tk-muted)'}}><Type size={19}/>Размер шрифта</div>
      <div className="flex gap-2">
        {(['100','130','160'] as const).map(s=><button key={s} className={seg(scale===s)} onClick={()=>setScale(s)}>{s==='100'?'Обычный':s==='130'?'Крупный':'Огромный'}</button>)}
      </div>
    </div>
    <div className="tk-card p-3.5 space-y-2">
      <div className="text-[0.6875rem] font-black uppercase flex items-center gap-1.5" style={{color:'var(--tk-muted)'}}><Hand size={19}/>Режим перчаток</div>
      <div className="flex gap-2">
        <button className={seg(!glove)} onClick={()=>setGlove(false)}>Выкл</button>
        <button className={seg(glove)} onClick={()=>setGlove(true)}>Вкл</button>
      </div>
      <div className="text-[0.625rem]" style={{color:'var(--tk-muted)'}}>Кнопки выше и толще — реально меняет размеры интерфейса.</div>
    </div>
    <div className="tk-card p-3.5 space-y-2">
      <div className="text-[0.6875rem] font-black uppercase" style={{color:'var(--tk-muted)'}}>Уведомления о новых нарядах</div>
      <PushButton/>
    </div>
    <div className="tk-card p-3.5 text-[0.625rem] space-y-1" style={{color:'var(--tk-muted)'}}>
      <div className="font-black uppercase">О демо</div>
      <div>НарядAI — тестовый проект на синтетических данных. NFC-метки, акустический анализ и автоматическая проверка безопасности в демо отсутствуют — подтверждения ставит человек вручную.</div>
    </div>
  </div>
}
