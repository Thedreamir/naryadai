import React from 'react'
import {createRoot} from 'react-dom/client'
import App from './App'
import './style.css'
import './v7.css'
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(reg=>{reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller&&!document.querySelector('.update-toast')){const d=document.createElement('div');d.className='push-toast update-toast';d.textContent='Доступна новая версия приложения — нажмите, чтобы обновить';d.style.cursor='pointer';d.onclick=()=>window.location.reload();document.body.appendChild(d)}})})}).catch(()=>{})}
