// Prepared, not wired into local UI until hosted authorization checks pass.
import {createClient} from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL
const key=import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase=url&&key?createClient(url,key):null
export async function authenticatedTransition(id:number,target:string,version:number,reason='',closure:unknown=null){
 if(!supabase)throw new Error('Supabase test project is not configured')
 const{data,error}=await supabase.rpc('transition_order',{order_id:id,target_status:target,expected_version:version,reason_text:reason,closure_data:closure})
 if(error)throw error
 return data
}
export function watchOrders(onChange:()=>void){
 if(!supabase)throw new Error('Supabase test project is not configured')
 return supabase.channel('orders').on('postgres_changes',{event:'*',schema:'public',table:'orders'},onChange).subscribe()
}
