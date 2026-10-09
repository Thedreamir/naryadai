export function issueValidation({title,equipmentId,assigneeId,hours,kind,priority},equipment,workers){
 if(typeof title!=='string'||title.trim().length<3)return 'Опишите проблему: минимум 3 символа';
 if(!equipment.some(e=>String(e.id)===String(equipmentId)))return 'Выберите оборудование';
 if(!workers.some(w=>String(w.id)===String(assigneeId)&&w.role==='worker'&&w.is_active!==false))return 'Выберите активного исполнителя';
 if(!Number.isFinite(hours)||hours<=0||hours>720)return 'Срок: от 0,1 до 720 часов';
 if(!['planned','unplanned'].includes(kind)||!['emergency','high','normal','planned'].includes(priority))return 'Проверьте тип и приоритет';
 return '';
}
