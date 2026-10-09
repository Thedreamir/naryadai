// Decode then re-encode pixels: original EXIF/GPS/device metadata is not copied.
export const PHOTO_INPUT_MAX_BYTES=12*1024*1024
// Fits below the SQL 400000-character data URI cap (base64 overhead + margin). Matches the client byte cap in src-legacy/hosted.ts (uploadOne / recordIntakePhoto: bytes.length > 290000).
export const PHOTO_OUTPUT_MAX_BYTES=290000
// Encode ladder, tried in order; the first result within PHOTO_OUTPUT_MAX_BYTES wins.
// First rung preserves the original 1600px/0.72 output for photos that already fit.
export function encodeAttempts():{max:number,quality:number}[]{
 return [
  {max:1600,quality:0.72},
  {max:1600,quality:0.6},
  {max:1280,quality:0.6},
  {max:1280,quality:0.5},
  {max:1024,quality:0.5},
  {max:1024,quality:0.42},
 ]
}
export async function sanitizePhoto(file:File):Promise<File>{
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Поддерживается JPEG, PNG, WebP');
 if(file.size>PHOTO_INPUT_MAX_BYTES)throw Error('Исходное фото больше 12 МБ');
 const url=URL.createObjectURL(file);let bitmap:ImageBitmap|null=null;
 try{
  bitmap=await createImageBitmap(file);
  for(const attempt of encodeAttempts()){
   const scale=Math.min(1,attempt.max/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Очистка фото недоступна');
   ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Фото не обработано')),'image/jpeg',attempt.quality));
   if(blob.size<=PHOTO_OUTPUT_MAX_BYTES)return new File([blob],'sanitized.jpg',{type:'image/jpeg',lastModified:file.lastModified});
  }
  throw Error('После обработки фото больше 290 КБ: снимите проще или ближе');
 }finally{bitmap?.close();URL.revokeObjectURL(url)}
}
export async function sanitizeDataUrl(dataUrl:string):Promise<string>{const r=await fetch(dataUrl);const blob=await r.blob();const clean=await sanitizePhoto(new File([blob],'upload',{type:blob.type}));return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Фото не прочиталось'));reader.readAsDataURL(clean)})}
