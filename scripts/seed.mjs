// LOCAL fixture generation only. This command never connects to a database.
import{generate}from'./seed-history.mjs';import{writeKnowledgeSeeds}from'./seed-knowledge.mjs';import{writeFileSync,mkdirSync}from'node:fs';
const history=generate();mkdirSync('demo',{recursive:true});writeFileSync('demo/history-polished.json',JSON.stringify(history,null,2));console.log('Local учебный набор данных:',history.orders.length,'orders. No live database touched.');

writeKnowledgeSeeds();
