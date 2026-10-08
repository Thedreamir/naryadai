export function awaitingWorkOverdue(order,now=Date.now()) {
 if(order?.cancelled||['completed','ai_review','closed','rejected'].includes(order?.status))return false;
 const deadline=new Date(order?.deadline).getTime();return Number.isFinite(deadline)&&deadline<now;
}
