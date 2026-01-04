import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import PeligroPage from './pages/PeligroPage/PeligroPage'
import StatsPage from './pages/StatsPage/StatsPage'
import InfoPage from './pages/InfoPage/InfoPage'
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
