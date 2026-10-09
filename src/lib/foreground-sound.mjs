// Foreground audio only. Never promises background OS sound or push receipt.
export const SOUND_KEY='tekton-foreground-sound';
export function soundEnabled(storage=globalThis.localStorage){try{return storage.getItem(SOUND_KEY)==='1'}catch{return false}}
export function setSoundEnabled(on,storage=globalThis.localStorage){storage.setItem(SOUND_KEY,on?'1':'0')}
let audio;
export async function playForegroundTone({emergency=false,AudioCtor=globalThis.AudioContext||globalThis.webkitAudioContext}={}){if(!AudioCtor)throw Error('Звук не поддерживается браузером');audio=audio||new AudioCtor();await audio.resume();if(audio.state!=='running')throw Error('Браузер не разрешил звук');const times=emergency?[0,.25,.5]:[0];for(const delay of times){const osc=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;osc.frequency.value=emergency?880:660;gain.gain.setValueAtTime(.08,at);gain.gain.exponentialRampToValueAtTime(.001,at+.17);osc.connect(gain);gain.connect(audio.destination);osc.start(at);osc.stop(at+.18)}return {scheduled:true,foregroundOnly:true}}
