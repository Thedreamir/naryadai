import {useCallback,useEffect,useRef,useState} from 'react';import * as H from './data'
// Read-only invalidation. Coalesce slow refreshes rather than starving every result.
export function useOrderState(){
 const [st,setSt]=useState<any>(null),[error,setError]=useState('');const active=useRef(false),generation=useRef(0),running=useRef(false),queued=useRef(false)
 const refresh=useCallback(async()=>{if(!active.current)return;if(running.current){queued.current=true;return}running.current=true;const n=generation.current
  try{const data=await H.state();if(active.current&&n===generation.current){setSt(data);setError('')}}catch(e){if(active.current&&n===generation.current)setError((e as Error).message)}finally{running.current=false;if(queued.current&&active.current){queued.current=false;void refresh()}}
 },[])
 useEffect(()=>{active.current=true;generation.current++;running.current=false;queued.current=false;void refresh();let timer:ReturnType<typeof setTimeout>|undefined,poll:ReturnType<typeof setInterval>|undefined
  const debounced=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=undefined;void refresh()},200)}
  const stopPoll=()=>{if(poll){clearInterval(poll);poll=undefined}}
  const onStatus=(live:boolean)=>{if(live){stopPoll();void refresh()}else if(!poll)poll=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},5000)}
  onStatus(false);const stop=H.watch(debounced,onStatus)
  const reconnect=()=>{void refresh()},wake=()=>{if(document.visibilityState==='visible')void refresh()}
  window.addEventListener('online',reconnect);document.addEventListener('visibilitychange',wake)
  return()=>{active.current=false;generation.current++;if(timer)clearTimeout(timer);stopPoll();stop();window.removeEventListener('online',reconnect);document.removeEventListener('visibilitychange',wake)}
 },[refresh]);return {st,error,refresh}
}
