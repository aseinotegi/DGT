import { useState, useEffect } from 'react'
import './StatsPanel.css'

// API base URL - empty for local (uses proxy), full URL for production
const API_BASE = import.meta.env.VITE_API_URL || 'https://dgt-production.up.railway.app'

interface ProvinceStat {
    name: string
    count: number
}

interface TimeStats {
    valid_count: number
    excluded_count: number
    min_minutes: number
    max_minutes: number
}

interface StatsData {
    total_vehicles: number
    avg_minutes_active: number
    median_minutes_active: number
    time_stats: TimeStats
    top_provinces: ProvinceStat[]
    by_road_type: Record<string, number>
}

interface StatsPanelProps {
    isOpen: boolean
    onClose: () => void
}

const ROAD_TYPE_LABELS: Record<string, string> = {
    autopista: 'Autopistas',
    nacional: 'Nacionales',
    autonomica: 'Autonómicas',
    provincial: 'Provinciales',
    local: 'Locales',
    desconocida: 'Sin clasificar',
}

function formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
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

    const roadTypeEntries = stats?.by_road_type
        ? Object.entries(stats.by_road_type).filter(([key]) => key !== 'desconocida')
        : []
    const maxRoadCount = roadTypeEntries.length > 0 ? Math.max(...roadTypeEntries.map(([, v]) => v)) : 1

    return (
        <div className="stats-overlay" onClick={onClose}>
            <div className="stats-modal" onClick={e => e.stopPropagation()}>
                <button className="stats-close" onClick={onClose}>&times;</button>

                <h2 className="stats-title">Estadísticas en tiempo real</h2>
                <div className="stats-subtitle">Balizas V16 activas en España</div>

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

                            <div className="stat-card info">
                                <div className="stat-value">{formatTime(stats.avg_minutes_active)}</div>
                                <div className="stat-label">Tiempo medio</div>
                                <div className="stat-icon">⏱️</div>
                            </div>

                            <div className="stat-card secondary">
                                <div className="stat-value">{formatTime(stats.median_minutes_active)}</div>
                                <div className="stat-label">Mediana</div>
                                <div className="stat-icon">📊</div>
                            </div>
                        </div>

                        {stats.time_stats.excluded_count > 0 && (
                            <div className="stats-note">
                                * Tiempos normalizados: {stats.time_stats.valid_count} válidos, {stats.time_stats.excluded_count} excluidos (outliers)
                            </div>
                        )}

                        <div className="stats-section">
                            <h3>Por tipo de vía</h3>
                            <div className="road-type-list">
                                {roadTypeEntries.map(([type, count]) => (
                                    <div key={type} className="road-type-item">
                                        <span className="road-type-name">{ROAD_TYPE_LABELS[type] || type}</span>
                                        <span className="road-type-count">{count}</span>
                                        <div className="road-type-bar" style={{ width: `${(count / maxRoadCount) * 100}%` }}></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="stats-section">
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
