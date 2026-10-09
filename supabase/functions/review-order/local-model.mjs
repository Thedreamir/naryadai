// Free local-only model. No external endpoint, key, photo or personal identifiers.
import {scrubText} from './review-core.mjs';
import {compareWorkToProblem} from './llm-compare.mjs';
export async function compareWithLocalModel(input,{env={},staffNames=[],fetchImpl}={}){
 try{
  const url=new URL(env.AI_COMPARE_ENDPOINT||'');if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.protocol!=='http:'||url.username||url.password)return null;
  if(env.AI_LLM_COMPARE_ENABLED!=='true'||!env.AI_COMPARE_MODEL)return null;
  if(/ignore|игнорир|верни\s+match|system\s*:/i.test(String(input?.problem)+' '+String(input?.works)))return null;
  const raw=await compareWorkToProblem(input,{env,staffNames,fetchImpl});if(!raw)return null;
  // Small model's own confidence is not calibration. Advisory-only until validated on plant labels.
  return {...raw,confidence:Math.min(raw.confidence,0.49),model_confidence:raw.confidence,model:env.AI_COMPARE_MODEL,advisory_only:true,calibration:'not calibrated on plant data'};
 }catch{return null}
}
