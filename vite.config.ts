import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({plugins:[react(),tailwindcss(),VitePWA({registerType:'autoUpdate',manifest:{name:'НарядAI',short_name:'НарядAI',lang:'ru',theme_color:'#222320',background_color:'#F7F5F0',display:'standalone',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'},{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'}]},workbox:{navigateFallback:'/index.html',globPatterns:['**/*.{js,css,html,svg}']}})],server:{port:5173,proxy:{'/api':'http://127.0.0.1:3001'}}})
