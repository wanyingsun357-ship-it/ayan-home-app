import React from 'react'
import ReactDOM from 'react-dom/client'
import './theme.css'
import './paper-theme.css'
import './paper-release.css'
import './orange-theme.css'
import './orange-polish.css'
import {applyAppearance} from './utils/appearance.js'

applyAppearance()
import App from './App.jsx'

// 主题初始化:记住上次选择,否则跟随系统
const saved = localStorage.getItem('theme')
const sysNight = window.matchMedia('(prefers-color-scheme: dark)').matches
applyAppearance()

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
