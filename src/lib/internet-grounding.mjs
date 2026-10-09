// Inert local preparation. No provider, fetch, key or user text is sent here.
// A future search adapter may receive only a selected public vocabulary query.
const topics=Object.freeze({bearing:'rolling bearing general explanation',pump:'centrifugal pump general explanation',seal:'mechanical seal general explanation'});
const safety=/напряж|электр|питан|обесточ|зазем|допуск|loto|energiz|power\s+on|voltage|lockout|кернеу|токқа/iu;
export function publicTopic(topic){return typeof topic==='string'&&Object.hasOwn(topics,topic)?topics[topic]:null}
export async function internetAnswer({enabled=false,topic,search}){
 const base={label:'Из интернета',plant_knowledge_used:false,master_confirmation_required:true,items:[],answer:'Общая справка из интернета, не утверждённая инструкция предприятия и не допуск к работе.'};
 if(enabled!==true)return {...base,mode:'internet_off',answer:'Поиск в интернете выключен.'};
 const query=publicTopic(topic);if(!query)return {...base,mode:'internet_denied',answer:'Доступны только общие справочные темы. Безопасность, подача напряжения и допуск: утверждённая база и подтверждение мастера.'};
 if(typeof search!=='function')return {...base,mode:'internet_unconfigured',answer:'Бесплатный поиск не подключён.'};
 const rows=await search(query);const items=[];
 for(const row of Array.isArray(rows)?rows.slice(0,5):[]){if(!row||safety.test(String(row.title)+' '+String(row.snippet)))continue;let url;try{url=new URL(row.url);if(url.protocol!=='https:'||url.username||url.password)continue}catch{continue}
 items.push({title:String(row.title||'Источник').slice(0,150),snippet:String(row.snippet||'').slice(0,500),url:url.href})}
 return {...base,mode:'internet',items};
}
