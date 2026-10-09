export const SOUND_KEY:string;
export function soundEnabled(storage?:Storage):boolean;
export function setSoundEnabled(on:boolean,storage?:Storage):void;
export function playForegroundTone(options?:{emergency?:boolean,AudioCtor?:any}):Promise<{scheduled:boolean,foregroundOnly:boolean}>;
