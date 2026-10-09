import {savedPresentation,setPresentation} from '../../lib/presentation'
import {useState} from 'react'
import TelegramPairing from '../../components/TelegramPairing'
import LanguageToggle from '../../components/LanguageToggle'
import {useLocale} from '../../lib/locale'
import {usePrefs} from '../../ui/prefs'
import PushButton from '../../components/PushButton'
import SoundSetting from '../../components/SoundSetting'
import {Sun, Moon, Hand, Type} from 'lucide-react'
import {cn} from '../../lib/utils'
export default function Settings(){const [pres,setPres]=useState(savedPresentation);
  const {t}=useLocale();const {theme,setTheme,scale,setScale,glove,setGlove}=usePrefs()
  const seg=(active:boolean)=>cn('flex-1 py-2.5 px-1 rounded-lg text-[0.6875rem] font-black uppercase border transition text-center',active?'bg-tk-amber text-black border-amber-600':'settings-inactive')
  return <div className="space-y-3">
    <h2 className="text-sm font-black uppercase tracking-wider px-1">{t('Настройки')}</h2>
    <LanguageToggle/><p className="text-xs">{t("Казахский перевод: черновик, производственные тексты требуют проверки.")}</p><div className="tk-card p-3.5 space-y-2">
      <div className="text-[0.6875rem] font-black uppercase flex items-center gap-1.5" style={{color:'var(--tk-muted)'}}><Sun size={19}/>{t('Тема')}</div>
      <div className="flex gap-2">
        <button className={seg(theme==='system')} onClick={()=>setTheme('system')}>{t('Система')}</button>
        <button className={seg(theme==='dark')} onClick={()=>setTheme('dark')}><Moon size={19} className="inline mr-1"/>{t('Тёмная')}</button>
        <button className={seg(theme==='light')} onClick={()=>setTheme('light')}><Sun size={19} className="inline mr-1"/>{t('Светлая')}</button>
      </div>
    </div>
    <div className="tk-card p-3.5 space-y-2">
      <div className="text-[0.6875rem] font-black uppercase flex items-center gap-1.5" style={{color:'var(--tk-muted)'}}><Type size={19}/>{t('Размер шрифта')}</div>
      <div className="flex gap-2">
        {(['100','130','160'] as const).map(s=><button key={s} className={seg(scale===s)} onClick={()=>setScale(s)}>{t(s==='100'?'Обычный':s==='130'?'Крупный':'Огромный')}</button>)}
      </div>
    </div>
    <div className="tk-card p-3.5 space-y-2">
      <div className="text-[0.6875rem] font-black uppercase flex items-center gap-1.5" style={{color:'var(--tk-muted)'}}><Hand size={19}/>{t('Режим перчаток')}</div>
      <div className="flex gap-2">
        <button className={seg(!glove)} onClick={()=>setGlove(false)}>{t('Выкл')}</button>
        <button className={seg(glove)} onClick={()=>setGlove(true)}>{t('Вкл')}</button>
      </div>
      <div className="text-[0.625rem]" style={{color:'var(--tk-muted)'}}>{t('Кнопки выше и толще - реально меняет размеры интерфейса.')}</div>
    </div>
    <div className="tk-card p-3.5 space-y-2">
      <div className="text-[0.6875rem] font-black uppercase" style={{color:'var(--tk-muted)'}}>{t('Уведомления о новых нарядах')}</div>
      <PushButton/><SoundSetting/>
    </div>
    <TelegramPairing/><label className="presentation-choice"><input type="checkbox" checked={pres} onChange={e=>{setPres(e.target.checked);setPresentation(e.target.checked)}}/>Скрыть технические наряды из списков. Активная работа остаётся видимой.</label>
    <div className="tk-card p-3.5 text-[0.625rem] space-y-1" style={{color:'var(--tk-muted)'}}>
      <div className="font-black uppercase">{t('О приложении')}</div>
      <div>{t('Tekton OS: учебный набор данных. NFC, акустический анализ и автоматическая проверка безопасности не подключены. Подтверждения ставит человек.')}</div>
    </div>
  </div>
}
