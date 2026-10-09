import {kazakhUi} from './build/ui-plugin'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({plugins:[kazakhUi(),react(),tailwindcss(),VitePWA({registerType:'autoUpdate',manifest:{name:'Tekton OS',short_name:'Tekton',lang:'ru',theme_color:'#222320',background_color:'#FBFBFB',display:'standalone',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'},{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'}]},workbox:{skipWaiting:true,clientsClaim:true,navigateFallback:'/index.html',globPatterns:['**/*.{js,css,html,svg,png,webp,woff,woff2,ttf}'],importScripts:['push-sw.js']}})],optimizeDeps:{include:['cookie']},server:{port:5173}})
