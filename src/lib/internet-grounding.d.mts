export function publicTopic(topic:unknown):string|null;
export function internetAnswer(options:{enabled?:boolean;topic?:unknown;search?:(query:string)=>Promise<unknown>}):Promise<Record<string,unknown>>;
