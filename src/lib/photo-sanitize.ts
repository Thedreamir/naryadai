// Decode then re-encode pixels: original EXIF/GPS/device metadata is not copied.
export async function sanitizePhoto(file:File):Promise<File>{
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Поддерживается JPEG, PNG, WebP');
 if(file.size>12*1024*1024)throw Error('Исходное фото больше 12 МБ');
 const url=URL.createObjectURL(file);let bitmap:ImageBitmap|null=null;
 try{bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw Error('Очистка фото недоступна');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Фото не обработано')),'image/jpeg',0.72));if(blob.size>400000)throw Error('После обработки фото больше 400 КБ: снимите проще или ближе');return new File([blob],'sanitized.jpg',{type:'image/jpeg'})}finally{bitmap?.close();URL.revokeObjectURL(url)}
}
export async function sanitizeDataUrl(dataUrl:string):Promise<string>{const r=await fetch(dataUrl);const blob=await r.blob();const clean=await sanitizePhoto(new File([blob],'upload',{type:blob.type}));return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Фото не прочиталось'));reader.readAsDataURL(clean)})}
