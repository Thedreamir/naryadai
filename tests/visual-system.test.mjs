import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/styles/visual-system.css',import.meta.url),'utf8');
const luma=hex=>hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luma(a),y=luma(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const tokens=block=>Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[A-Fa-f\d]{6})/g)].map(m=>[m[1],m[2]]));
for(const theme of ['light','dark']) {
 const t=tokens(css.match(new RegExp(`body\\.theme-${theme} \\{([^}]+)`))[1]);
 test(`${theme}: normal text and all priority/status text contrast >= 4.5`,()=>{
  for(const fg of ['ink','muted','amber','green','red','blue'])for(const bg of ['bg','card','sub'])assert.ok(contrast(t[`--tk-${fg}`],t[`--tk-${bg}`])>=4.5,`${fg} on ${bg}: ${contrast(t[`--tk-${fg}`],t[`--tk-${bg}`])}`);
 });
 test(`${theme}: focus and input border contrast >= 3`,()=>{
  for(const bg of ['card','sub'])for(const fg of ['border','focus'])assert.ok(contrast(t[`--tk-${fg}`],t[`--tk-${bg}`])>=3,`${fg}/${bg}`);
 });
}
test('PriorChip custom properties are defined, and fill signals are not repainted',()=>{
 for(const name of ['red','amber','muted'])assert.match(css,new RegExp(`--tk-${name}:`));
 assert.doesNotMatch(css,/\.bg-tk-(?:red|green|amber|blue)\s*\{/);
});
test('shared badges pass normal text contrast with translucent backgrounds',()=>{
 const t=tokens(css.match(/:root \{([^}]+)/)[1]);
 const mix=(hex,alpha)=>'#'+hex.match(/[a-f\d]{2}/gi).map(x=>Math.round(parseInt(x,16)*alpha+255*(1-alpha)).toString(16).padStart(2,'0')).join('');
 for(const key of ['accent','danger','warn','info','muted'])assert.ok(contrast(t[`--color-${key}`],mix(t[`--color-${key}`],.12))>=4.5,key);
});
test('visual layer is imported after the existing stylesheet',()=>{
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.ok(main.indexOf("'./styles/visual-system.css'")>main.indexOf("'./index.css'"));
});
