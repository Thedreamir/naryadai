export const statuses={issued:'Выдан',accepted:'Принят в работу',queued:'В очереди',rejected:'Отклонён',in_progress:'В работе',paused:'Приостановлен',completed:'Исполнено',ai_review:'Проверка ИИ',rework:'На доработку',closed:'Закрыт'};
export const transitions={issued:['accepted','queued','rejected'],queued:['accepted','rejected'],accepted:['in_progress'],in_progress:['paused','completed'],paused:['in_progress'],completed:['ai_review'],ai_review:['rework','closed'],rework:['in_progress'],rejected:['issued'],closed:[]};
export function checkClosure({works='',fault_code='',materials=[],photos=[],kind='unplanned'}){
 const reasons=[];if(works.trim().length<12)reasons.push('Описание работ слишком короткое');if(!fault_code)reasons.push('Не выбран шифр неисправности');
 if(!Array.isArray(materials))reasons.push('Неверный формат материалов');
 else if(materials.some(m=>!m.name||!Number.isFinite(Number(m.quantity))||Number(m.quantity)<=0))reasons.push('Количество материалов должно быть положительным');
 if(kind==='unplanned'&&photos.length===0)reasons.push('Для внепланового ремонта обязательно фото после');
 return {mode:'rules',verdict:reasons.length?'rework':'needs_master',score:null,confidence:null,reasons:reasons.length?reasons:['Обязательные поля заполнены. Соответствие работ и видимое качество фото правилами не проверены.'],limitations:['Модель ИИ не подключена','Правила не подтверждают качество физического ремонта'],checked_at:new Date().toISOString()};
}
