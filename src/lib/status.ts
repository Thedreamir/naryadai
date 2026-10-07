export const STATUS: Record<string,{tone:string,label:string}> = {
  issued:{tone:'teal',label:'Выдан'},queued:{tone:'amber',label:'В очереди'},accepted:{tone:'primary',label:'Принят'},
  in_progress:{tone:'primary',label:'В работе'},paused:{tone:'amber',label:'Пауза'},completed:{tone:'teal',label:'На проверке'},
  ai_review:{tone:'teal',label:'Проверен ИИ'},closed:{tone:'gray',label:'Закрыт'},rejected:{tone:'red',label:'Отклонён'},rework:{tone:'red',label:'Доработка'},
}
export const statusOf=(s:string)=>STATUS[s]||{tone:'gray',label:s}

export const ACTIVE_STATUSES=['issued','queued','accepted','in_progress','paused','rework']
