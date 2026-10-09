// Display only: actual work outranks shift metadata and other assigned statuses.
export function crewWork(mine) {
 return mine.find(o=>o.status==='in_progress')||mine.find(o=>o.status==='paused')||mine.find(o=>o.status==='rework')||null
}
