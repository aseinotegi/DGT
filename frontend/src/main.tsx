import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import PeligroPage from './components/PeligroPage'
import StatsPage from './components/StatsPage'
import InfoPage from './components/InfoPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/peligro" element={<PeligroPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/info" element={<InfoPage />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>,
)
