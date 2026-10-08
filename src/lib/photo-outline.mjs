export function edgeOverlay(rgba,width,height) {
 const out=new Uint8ClampedArray(width*height*4);
 const gray=(x,y)=>{const i=(y*width+x)*4;return .299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2]};
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const dx=gray(x+1,y)-gray(x-1,y),dy=gray(x,y+1)-gray(x,y-1);
  if(Math.hypot(dx,dy)>42){const i=(y*width+x)*4;out[i]=239;out[i+1]=191;out[i+2]=101;out[i+3]=255}
 }
 return out;
}
