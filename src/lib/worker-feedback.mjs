import {humanScore} from './human-score.mjs';
// Rules over recorded facts, never a repair instruction or LLM quality claim.
export function workerFeedback(order,events=[],norms=[]){
 const score=humanScore(order?.ai_result?.human_score);const rated=score!==null;
 const closed=Date.parse(order?.closed_at),start=Date.parse(order?.started_at);
 const completions=events.filter(e=>String(e.order_id)===String(order?.id)&&e.new_status==='completed').map(e=>Date.parse(e.created_at)).filter(t=>Number.isFinite(t)&&(!Number.isFinite(closed)||t<=closed));
 const end=completions.length?Math.max(...completions):NaN;
 const duration=Number.isFinite(start)&&Number.isFinite(end)&&end>=start?Math.round((end-start)/60000):null;
 const snapshot=order?.closure?.norm_snapshot;const norm=snapshot?.source==='server_catalog_snapshot'&&snapshot.work_type===order?.closure?.norm_work_type&&Number.isFinite(snapshot.norm_minutes)&&snapshot.norm_minutes>0?snapshot:null;
 const good=[];const improve=[];
 if(rated){if(score>=4)good.push('Мастер оценил качество на '+score+'/5.');else improve.push('Оценка мастера '+score+'/5. Уточните замечания у мастера.');}
 if(order?.closure?.works)good.push('Описание выполненных работ сохранено. Это не доказательство результата.');
 const deadline=Date.parse(order?.deadline);if(Number.isFinite(end)&&Number.isFinite(deadline)){(end<=deadline?good:improve).push(end<=deadline?'Последняя сдача исполнителя была в срок.':'Последняя сдача исполнителя была после срока.');}
 if(events.some(e=>String(e.order_id)===String(order?.id)&&e.new_status==='rework'))improve.push('В журнале есть доработка. Причины указаны в журнале наряда.');
 if(order?.ai_result?.reason)improve.push('Пояснение проверки: '+String(order.ai_result.reason).slice(0,2000));
 return {score:rated?score:null,good:good.length?good:['Нет подтверждённых данных для положительной оценки.'],improve:improve.length?improve:['Дополнительные замечания не записаны. Это не подтверждение отсутствия дефектов.'],durationMinutes:duration,normMinutes:norm?Number(norm.norm_minutes):null,timeText:duration===null?'Время сдачи или начала не подтверждено.':`От начала до последней сдачи: ${duration} мин (включает паузы; не трудоёмкость и не простой).`,normText:norm?`Сохранённый при сдаче учебный норматив: ${norm.norm_minutes} мин. ${duration===null?'Сравнение недоступно.':duration<=Number(norm.norm_minutes)?'Интервал не превышает норматив.':'Интервал превышает норматив.'}`:'Подтверждённого снимка выбранного норматива нет. Сравнение недоступно.',modelParticipated:false};
}
