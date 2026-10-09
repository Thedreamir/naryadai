import{spawnSync}from'node:child_process';
for(const [command,args]of [['node',['scripts/check-seed.mjs']],['npm',['test']],['npm',['run','test:db']],['npm',['run','build']]]){const r=spawnSync(command,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
