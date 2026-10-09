import {parse} from '@babel/parser'
import type {Plugin} from 'vite'
/** Translate source-owned interface copy, never fetched repair text or payload values. */
export function kazakhUi():Plugin{return {name:'tekton-source-ui-language',enforce:'pre',transform(code,id){
 const path=id.split('?')[0];if(!path.endsWith('.tsx')||!path.includes('/src/')||path.endsWith('/LanguageToggle.tsx'))return null
 const file=parse(code,{sourceType:'module',plugins:['typescript','jsx']});const edits:{start:number,end:number,text:string}[]=[];let uses=false
 const wrap=(n:any,text:string)=>{edits.push({start:n.start,end:n.end,text});uses=true}
 const q=(s:string)=>JSON.stringify(s)
 const children=(n:any,visit:(n:any)=>void)=>{for(const [key,value] of Object.entries(n)){if(['loc','extra','comments','tokens'].includes(key))continue;if(Array.isArray(value))value.forEach(v=>{if(v&&typeof v==='object'&&'type' in v)visit(v)});else if(value&&typeof value==='object'&&'type' in value)visit(value)}}
 const displayAttributes=new Set(['aria-label','placeholder','title','alt']);
 const visit=(n:any,sourceList:string|null=null)=>{
  if(n.type==='JSXAttribute'&&!displayAttributes.has(n.name.name))return
  if(n.type==='CallExpression'&&n.callee?.type==='MemberExpression'&&n.callee.property?.name==='map'&&['DECLS','steps'].includes(n.callee.object?.name))sourceList=n.callee.object.name
  if(n.type==='CallExpression'&&n.callee?.type==='MemberExpression'&&/^toLocale(?:Date|Time)?String$/.test(n.callee.property?.name)){for(const arg of n.arguments){if(arg.type==='ObjectExpression')for(const prop of arg.properties){if(prop.key?.name==='month'&&prop.value?.type==='StringLiteral'&&['short','long'].includes(prop.value.value))wrap(prop.value,`(__dateLocale()==='kk-KZ'?'2-digit':${q(prop.value.value)})`)}}}
  if(n.type==='JSXText'&&/[А-Яа-яЁё]/.test(n.value)){const text=n.value.replace(/\s+/g,' ');if(text)wrap(n,`{__ui(${q(text)})}`);return}
  if(n.type==='JSXAttribute'&&n.value&&n.value.type==='StringLiteral'&&['aria-label','placeholder','title','alt'].includes(n.name.name)&&/[А-Яа-яЁё]/.test(n.value.value)){wrap(n.value,`{__ui(${q(n.value.value)})}`);return}
  if(n.type==='JSXExpressionContainer'&&n.expression){const expression=n.expression
   if(path.endsWith('/master/Board.tsx')&&code.slice(expression.start,expression.end)==='FILTERS.find(x=>x[0]===f)?.[1]'){wrap(expression,`__ui(${code.slice(expression.start,expression.end)})`);return}
   if(path.endsWith('/worker/OrderDetail.tsx')&&((sourceList==='DECLS'&&code.slice(expression.start,expression.end)==='d')||(sourceList==='steps'&&code.slice(expression.start,expression.end)==='s'))){wrap(expression,`__ui(${code.slice(expression.start,expression.end)})`);return}
   // Known label properties are display metadata; names, titles, bodies and report content are excluded.
   if((path.endsWith('/DemoTour.tsx')&&/^(?:info\?|step===8)/.test(code.slice(expression.start,expression.end))&&!code.slice(expression.start,expression.end).includes('<'))||/^(?:reviewDisplay|reviewArchiveDisplay|reviewPresentation)\(.+\)\.(?:label|detail|verdictLabel)$/.test(code.slice(expression.start,expression.end))||(path.endsWith('/Report.tsx')&&code.slice(expression.start,expression.end)==='s.name')){wrap(expression,`__ui(${code.slice(expression.start,expression.end)})`);return}
   if(/^(?:statusOf\(.+\)\.label|(?:st|stt|w\.stt)\.label|statuses\[.+\]|i\.label|l|label|m\.t|stLabel\[o\.status\]\|\|o\.status|eventLabel\(.+\)|tourSteps\[step\]\.(?:title|body)|presentation\.(?:label|detail|archiveLabel|verdictLabel|scoreLabel))$/.test(code.slice(expression.start,expression.end))){wrap(expression,`__ui(${code.slice(expression.start,expression.end)})`);return}
   if(path.endsWith('/DemoTour.tsx')&&/^(body|line)$/.test(code.slice(expression.start,expression.end))){wrap(expression,`__ui(${code.slice(expression.start,expression.end)})`);return}
   if(expression.type!=='ArrowFunctionExpression'){const literals=(x:any)=>{if(x.type==='ArrowFunctionExpression'||x.type==='FunctionExpression'||x.type.startsWith('JSX'))return;if(x.type==='TemplateLiteral'){const parts=x.quasis.map((part:any,i:number)=>`__ui(${q(part.value.cooked||'')})`+(x.expressions[i]?`+(${code.slice(x.expressions[i].start,x.expressions[i].end)})`:''));if(x.quasis.some((part:any)=>/[А-Яа-яЁё]/.test(part.value.cooked||''))){wrap(x,'('+parts.join('+')+')');return}}if(x.type==='StringLiteral'&&/[А-Яа-яЁё]/.test(x.value)){wrap(x,`__ui(${q(x.value)})`);return}children(x,literals)};literals(expression)}
  }
  children(n,child=>visit(child,sourceList))
 };visit(file)
 // Dates change display locale only. No numeric or period boundaries are changed.
 for(const match of code.matchAll(/(\.toLocale(?:Date|Time)?String\()'ru(?:-RU)?'/g)){const start=match.index!+match[1].length;edits.push({start,end:start+match[0].length-match[1].length,text:'__dateLocale()'});uses=true}
 if(!uses)return null;const unique=[...new Map(edits.map(e=>[e.start+':'+e.end,e])).values()];unique.sort((a,b)=>b.start-a.start);let last=Infinity;for(const e of unique){if(e.end>last)continue;code=code.slice(0,e.start)+e.text+code.slice(e.end);last=e.start}
 return {code:`import {translateUi as __ui,dateLocale as __dateLocale} from '/src/lib/ui-language';\n`+code,map:null}
}}}
