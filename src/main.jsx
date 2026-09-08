import React from 'react'
import ReactDOM from 'react-dom/client'
import './theme.css'
import App from './App.jsx'

// 主题初始化:记住上次选择,否则跟随系统
const saved = localStorage.getItem('theme')
const sysNight = window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.dataset.theme = saved || (sysNight ? 'night' : 'day')

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
