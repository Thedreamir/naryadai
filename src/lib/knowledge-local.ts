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
export async function semanticKnowledge(_query:string,_docs:any[]):Promise<any[]>{throw Error('Семантическая модель отключена. Используйте поиск по утверждённым источникам.')}
