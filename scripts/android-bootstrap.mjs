// Reproducible scaffold; no Firebase, keys, signing or public deployment.
import {existsSync} from 'node:fs';import {spawnSync} from 'node:child_process';
for(const args of [['run','build'],...(existsSync('android')?[]:[['exec','cap','add','android']]),['exec','cap','sync','android']]){const r=spawnSync('npm',args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
console.log('Android scaffold synced. APK requires a current JDK and Android SDK. No physical-device test or Firebase push is included.');
