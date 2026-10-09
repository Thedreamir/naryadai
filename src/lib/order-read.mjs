const active=['issued','accepted','queued','in_progress','paused','completed','ai_review','rework'];
async function pages(query,pageSize=500,max=Infinity){const data=[];let start=0;while(start<max){const r=await query().range(start,Math.min(start+pageSize,max)-1);if(r.error)throw Error(r.error.message||'Данные недоступны');const rows=r.data||[];if(!rows.length)return data;data.push(...rows);start+=rows.length;if(Number.isFinite(r.count)&&start>=r.count)return data}return data}

export async function readOrdersAndEvents(s){
 const [current,history]=await Promise.all([pages(()=>s.from('orders').select('*',{count:'exact'}).eq('cancelled',false).in('status',active).order('id',{ascending:false})),pages(()=>s.from('orders').select('*',{count:'exact'}).eq('cancelled',false).in('status',['closed','rejected']).order('id',{ascending:false}),500,600)]);
 const orders=[...current,...history].sort((a,b)=>b.id-a.id),events=[];
 // Three independent ID chunks at a time; pagination inside each chunk stays serial.
 for(let i=0;i<orders.length;i+=300){const chunks=[];for(let j=i;j<Math.min(i+300,orders.length);j+=100){const ids=orders.slice(j,j+100).map(o=>o.id);chunks.push(pages(()=>s.from('order_events').select('*',{count:'exact'}).in('order_id',ids).order('id',{ascending:false})))}for(const rows of await Promise.all(chunks))events.push(...rows)}
 return {orders,events:events.sort((a,b)=>b.id-a.id)};
}

// The sidebar needs only pending-review rows, not the full order/photo graph.
export async function readReviewQueue(s){return pages(()=>s.from('orders').select('id,title').eq('cancelled',false).in('status',['completed','ai_review']).order('id',{ascending:false}))}
