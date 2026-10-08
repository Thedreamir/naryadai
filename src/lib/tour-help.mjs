export const help={master:'Здесь видны загрузка исполнителей и состояние нарядов. Выберите наряд, чтобы открыть его ход работы.',worker:'Принятие и начало работы — разные действия. При паузе или отказе укажите причину: мастер увидит, что мешает выполнить задание.',report:'Укажите работы, шифр неисправности и материалы. Для внеплановой работы добавьте фото после ремонта.',review:'Замечания относятся к этому отчёту. Недостаточно данных — решение остаётся за мастером.',rating:'Откройте формулу, чтобы увидеть, какие показатели влияют на оценку.',assistant:'Задайте вопрос по текущему наряду. Статусы и действия остаются в карточке работы.',equipment:'Здесь хранится история работ по оборудованию. Откройте наряд, чтобы увидеть отчёт и решение мастера.'};
export function helpForRoute(audience,path){
 if(path.includes('equipment'))return help.equipment;
 if(path.includes('assistant'))return help.assistant;
 if(path.includes('issue'))return help.report;
 if(path.includes('review'))return help.review;
 if(path.includes('profile'))return help.rating;
 if(path.includes('report'))return audience==='worker'?help.rating:help.report;
 if(path.includes('orders'))return audience==='worker'?help.worker:help.review;
 return audience==='worker'?help.worker:help.master;
}
