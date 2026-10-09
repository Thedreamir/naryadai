const active=['issued','accepted','queued','in_progress','paused','completed','ai_review','rework'];
async function pages(query,pageSize=500,max=Infinity){const data=[];let start=0;while(start<max){const r=await query().range(start,Math.min(start+pageSize,max)-1);if(r.error)throw Error(r.error.message||'Данные недоступны');const rows=r.data||[];if(!rows.length)return data;data.push(...rows);start+=rows.length;if(Number.isFinite(r.count)&&start>=r.count)return data}return data}

export async function readOrdersAndEvents(s){
 const [current,history]=await Promise.all([pages(()=>s.from('orders').select('*',{count:'exact'}).eq('cancelled',false).in('status',active).order('id',{ascending:false})),pages(()=>s.from('orders').select('*',{count:'exact'}).eq('cancelled',false).in('status',['closed','rejected']).order('id',{ascending:false}),500,600)]);
 const orders=[...current,...history].sort((a,b)=>b.id-a.id),events=[];
 for(let i=0;i<orders.length;i+=100){const ids=orders.slice(i,i+100).map(o=>o.id);events.push(...await pages(()=>s.from('order_events').select('*',{count:'exact'}).in('order_id',ids).order('id',{ascending:false})))}
 return {orders,events:events.sort((a,b)=>b.id-a.id)};
}
