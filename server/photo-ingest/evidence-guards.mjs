// Local-only bounded server decoder + advisory photo lane. Original EXIF is data,
// not trusted capture proof. Input <=8MiB, Pillow bomb warning rejects, 5sec limit.
import{spawnSync}from'node:child_process';import{advisoryGuards}from'../../supabase/functions/review-order/evidence-lane/advisory-guards.mjs';
function rgb(bytes){if(!Buffer.isBuffer(bytes)||bytes.length>8*1024*1024)throw Error('bounded image required');const out=spawnSync('python3',['-c',`import sys,io,warnings
from PIL import Image
warnings.simplefilter('error',Image.DecompressionBombWarning)
Image.MAX_IMAGE_PIXELS=16000000
im=Image.open(io.BytesIO(sys.stdin.buffer.read()))
if getattr(im,'n_frames',1)!=1: raise ValueError('animated image')
im.load()
sys.stdout.buffer.write(im.convert('RGB').resize((64,64)).tobytes())`],{input:bytes,timeout:5000,maxBuffer:20000});if(out.status!==0||out.stdout.length!==64*64*3)throw Error('decode failed');return new Uint8Array(out.stdout)}
export function assessServerPhotoEvidence({problem,work,materials=[],afterBytes,beforeBytes=null,ctx,history=[]}){try{return advisoryGuards({problem,work,materials,photoInput:{afterRgb:rgb(afterBytes),beforeRgb:beforeBytes?rgb(beforeBytes):null,afterJpeg:afterBytes,ctx,history}})}catch{return advisoryGuards({problem,work,materials,photoInput:null})}}
