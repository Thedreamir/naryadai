import {ErpError, VERSION, ORDER_FIELDS, positiveId, pageOptions, mapClosedOrder, toCsv, validateImport} from './adapter.mjs';
import {MockErpConnector} from './mock-connector.mjs';
export function createErpHandler({loadClosedOrders, connector=new MockErpConnector()}) {
  return async function handleErp(req,res,actor,url) {
    if(!url.pathname.startsWith('/api/erp/'))return false;
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    try {
      if(!actor)throw new ErpError(401,'Authentication required');
      if(!['master','leader','admin'].includes(actor.role))throw new ErpError(403,'ERP access requires master, leader or admin');
      if(req.method==='GET'&&['/api/erp/closed-orders','/api/erp/equipment-history'].includes(url.pathname)) {
        const options=pageOptions(url.searchParams);
        const equipmentId=url.pathname.endsWith('equipment-history')?positiveId(url.searchParams.get('equipment_id'),'equipment_id'):null;
        const raw=await loadClosedOrders(actor,{...options,equipmentId,take:options.limit+1});
        if(!Array.isArray(raw))throw new ErpError(500,'Source unavailable');
        const data=raw.slice(0,options.limit).map(mapClosedOrder);
        if(data.some((row,i)=>row.order_id<=options.cursor||(i>0&&row.order_id<=data[i-1].order_id)||(equipmentId!==null&&row.equipment_id!==equipmentId)))throw new ErpError(500,'Source pagination contract violated');
        const hasMore=raw.length>options.limit;
        const nextCursor=hasMore?String(data.at(-1).order_id):null;
        const meta={schema_version:VERSION,source:'synthetic',mode:'local_adapter',generated_at:new Date().toISOString(),count:data.length,has_more:hasMore,next_cursor:nextCursor,history_scope:'closed_orders_only',omitted:['employee_identity','photos','signed_urls','ai_result']};
        if(options.format==='csv') {
          res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment; filename="tekton-erp-orders.csv"','X-Schema-Version':VERSION,'X-Data-Source':'synthetic','X-Has-More':String(hasMore),'X-Next-Cursor':nextCursor||''});res.end(toCsv(data,ORDER_FIELDS));
        } else json(200,{...meta,records:data});
        return true;
      }
      if(req.method==='POST'&&['/api/erp/imports/preview','/api/erp/imports/mock'].includes(url.pathname)) {
        if(actor.role!=='admin')throw new ErpError(403,'Equipment import requires admin');
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw new ErpError(415,'application/json required');
        let text='';let size=0;
        for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>1_000_000)throw new ErpError(413,'Payload too large');text+=chunk;}
        let payload;try{payload=JSON.parse(text);}catch{throw new ErpError(400,'Invalid JSON');}
        const records=validateImport(payload);
        if(url.pathname.endsWith('/preview'))json(200,{schema_version:VERSION,source:'synthetic',mode:'preview',valid:true,production_writes:0,count:records.length,records});
        else json(200,{schema_version:VERSION,source:'synthetic',...connector.stage(actor.id,req.headers['idempotency-key'],records)});
        return true;
      }
      json(404,{error:'ERP route not found'});
    } catch(e) {json(e instanceof ErpError?e.status:500,{error:e instanceof ErpError?e.message:'ERP source error'});}
    return true;
  };
}
