import fs from 'node:fs';
const pairs=Object.fromEntries(fs.readFileSync('docs/kz/source-pairs.txt','utf8').trim().split('\n').map(s=>s.split('|')));
const seed=JSON.parse(fs.readFileSync('src/lib/kz-ui.json','utf8'));
Object.assign(seed,pairs);
fs.writeFileSync('src/lib/kz-ui.json',JSON.stringify(seed,null,2)+'\n');
const missing=JSON.parse(fs.readFileSync('docs/kz/source-fragments.json')).filter(s=>!(s in seed)&&/[А-Яа-яЁё]/.test(s)&&!/[ҚқӘәҒғӨөҰұҮүІіҢң]/.test(s));
fs.writeFileSync('docs/kz/native-review.json',JSON.stringify(missing,null,2)+'\n');console.log(Object.keys(seed).length,'entries;',missing.length,'untranslated fragments');
