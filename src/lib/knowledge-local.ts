import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
GlobalWorkerOptions.workerSrc=pdfWorker
export async function extractKnowledge(file:File){
 if(file.size>2*1024*1024)throw Error('Файл больше 2 МБ');
 if(file.name.toLowerCase().endsWith('.txt')){const text=await file.text();if(text.length>12000)throw Error('Текст длиннее 12 000 символов');return text}
 if(!file.name.toLowerCase().endsWith('.pdf'))throw Error('Поддерживается TXT или PDF');
 const task=getDocument({data:new Uint8Array(await file.arrayBuffer())});const pdf=await task.promise;
 try{if(pdf.numPages>10)throw Error('PDF больше 10 страниц');let text='';for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const content=await page.getTextContent();text+=`\n[Страница ${n}]\n`+content.items.map(i=>'str' in i?i.str:'').join(' ');if(text.length>12000)throw Error('Извлечённый текст длиннее 12 000 символов')}if(text.trim().length<30)throw Error('В PDF нет текста: скан без OCR не поддерживается');return text.trim()}finally{await task.destroy()}
}
let extractor:any=null;
export async function semanticKnowledge(query:string,docs:any[]){
 const {pipeline}=await import('@huggingface/transformers');
 if(!extractor)extractor=await pipeline('feature-extraction','Xenova/multilingual-e5-small',{dtype:'q8',device:'wasm'});
 const approved=docs.filter(d=>d.status==='approved');
 const q=Array.from((await extractor('query: '+query,{pooling:'mean',normalize:true})).data) as number[];
 const ranked=[];for(const d of approved){const v=Array.from((await extractor('passage: '+d.title+' '+d.body.slice(0,3500),{pooling:'mean',normalize:true})).data) as number[];ranked.push({doc:d,score:q.reduce((s,x,i)=>s+x*v[i],0)})}
 return ranked.sort((a,b)=>b.score-a.score).slice(0,3)
}
