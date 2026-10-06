declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(req:Request)=>Promise<Response>):void};
declare module 'npm:@supabase/supabase-js@2.117.2' {export function createClient(...args:any[]):any;}
