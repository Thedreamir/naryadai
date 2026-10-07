import {defineConfig,devices} from '@playwright/test'
export default defineConfig({testDir:'./e2e',timeout:30000,retries:0,workers:1,reporter:[['list'],['html',{open:'never'}]],use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'phone-chromium',use:{...devices['Pixel 7']}}]})
