import { useState, useEffect } from 'react'
import './StatsPanel.css'

// API base URL - empty for local (uses proxy), full URL for production
const API_BASE = import.meta.env.VITE_API_URL || 'https://dgt-production.up.railway.app'

interface ProvinceStat {
    name: string
    count: number
}

interface StatsData {
    total_vehicles: number
    vulnerable_count: number
    avg_minutes_active: number
    top_provinces: ProvinceStat[]
}

interface StatsPanelProps {
    isOpen: boolean
    onClose: () => void
}

export function StatsPanel({ isOpen, onClose }: StatsPanelProps) {
    const [stats, setStats] = useState<StatsData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isOpen) return

        const fetchStats = async () => {
            setLoading(true)
            try {
                const response = await fetch(`${API_BASE}/api/v1/stats`)
                if (response.ok) {
                    const data = await response.json()
                    setStats(data)
                }
            } catch (err) {
                console.error('Error loading stats:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
        // Refresh every minute while open
        const interval = setInterval(fetchStats, 60000)
        return () => clearInterval(interval)
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className="stats-overlay" onClick={onClose}>
            <div className="stats-modal" onClick={e => e.stopPropagation()}>
                <button className="stats-close" onClick={onClose}>&times;</button>

                <h2 className="stats-title">Estadísticas en tiempo real</h2>
                <div className="stats-subtitle">Estado de la red viaria</div>

                {loading && !stats ? (
                    <div className="stats-loading">Calculando métricas...</div>
                ) : stats ? (
                    <div className="stats-content">
                        <div className="stats-grid">
                            <div className="stat-card primary">
                                <div className="stat-value">{stats.total_vehicles}</div>
                                <div className="stat-label">Vehículos detenidos</div>
                                <div className="stat-icon">🚗</div>
                            </div>

                            <div className="stat-card warning">
                                <div className="stat-value">{stats.vulnerable_count}</div>
                                <div className="stat-label">Personas en riesgo</div>
                                <div className="stat-icon">⚠️</div>
                            </div>

                            <div className="stat-card info">
                                <div className="stat-value">{stats.avg_minutes_active}<span className="unit">min</span></div>
                                <div className="stat-label">Tiempo medio activo</div>
                                <div className="stat-icon">⏱️</div>
                            </div>
                        </div>

                        <div className="stats-provinces">
                            <h3>Provincias con más incidencias</h3>
                            <div className="province-list">
                                {stats.top_provinces.map((prov, i) => (
                                    <div key={prov.name} className="province-item">
                                        <span className="province-rank">{i + 1}</span>
                                        <span className="province-name">{prov.name}</span>
                                        <span className="province-count">{prov.count}</span>
                                        <div className="province-bar" style={{ width: `${(prov.count / stats.top_provinces[0].count) * 100}%` }}></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="stats-error">No se pudieron cargar los datos</div>
                )}
            </div>
        </div>
    )
}
