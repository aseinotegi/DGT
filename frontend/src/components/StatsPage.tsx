import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area, CartesianGrid
} from 'recharts'

const API_BASE = import.meta.env.VITE_API_URL || 'https://dgt-production.up.railway.app'

interface HourlyData {
    hour: number
    count: number
}

interface DailyData {
    date: string
    label: string
    count: number
}

interface TrendData {
    today: number
    yesterday: number
    percentage: number
    direction: 'up' | 'down' | 'stable'
}

interface StatsData {
    total_vehicles: number
    avg_minutes_active: number
    median_minutes_active: number
    time_stats: {
        valid_count: number
        excluded_count: number
    }
    top_provinces: { name: string; count: number }[]
    by_road_type: Record<string, number>
}

interface TrendsData {
    period_days: number
    total_v16_in_period: number
    active_now: number
    hourly_distribution: HourlyData[]
    daily_trend: DailyData[]
    by_source: Record<string, number>
    trend_vs_yesterday: TrendData
}

const ROAD_TYPE_LABELS: Record<string, string> = {
    autopista: 'Autopistas',
    nacional: 'Nacionales',
    autonomica: 'Autonómicas',
    provincial: 'Provinciales',
    local: 'Locales',
}

function formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

const fadeIn = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
}

function StatsPage() {
    const [stats, setStats] = useState<StatsData | null>(null)
    const [trends, setTrends] = useState<TrendsData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, trendsRes] = await Promise.all([
                    fetch(`${API_BASE}/api/v1/stats`),
                    fetch(`${API_BASE}/api/v1/stats/trends?days=7`)
                ])

                if (statsRes.ok) setStats(await statsRes.json())
                if (trendsRes.ok) setTrends(await trendsRes.json())
            } catch (err) {
                console.error('Error fetching stats:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 60000)
        return () => clearInterval(interval)
    }, [])

    if (loading) {
        return (
            <div className="peligro-page">
                <header className="peligro-header">
                    <Link to="/" className="back-button">← Volver al mapa</Link>
                    <h1>Estadísticas</h1>
                </header>
                <div className="peligro-loading">Cargando estadísticas...</div>
            </div>
        )
    }

    const roadTypeEntries = stats?.by_road_type
        ? Object.entries(stats.by_road_type).filter(([key]) => key !== 'desconocida')
        : []
    const maxRoadCount = roadTypeEntries.length > 0
        ? Math.max(...roadTypeEntries.map(([, v]) => v))
        : 1

    return (
        <div className="peligro-page">
            <header className="peligro-header">
                <Link to="/" className="back-button">← Volver al mapa</Link>
                <h1>Estadísticas en tiempo real</h1>
            </header>

            <div className="stats-content">
                {/* KPI Cards */}
                <motion.div
                    className="stats-kpi-grid"
                    initial="hidden"
                    animate="visible"
                    variants={fadeIn}
                    transition={{ duration: 0.3 }}
                >
                    <div className="stats-kpi-card stats-kpi-primary">
                        <div className="stats-kpi-value">{stats?.total_vehicles || 0}</div>
                        <div className="stats-kpi-label">Balizas V16 activas</div>
                    </div>

                    <div className="stats-kpi-card stats-kpi-success">
                        <div className="stats-kpi-value">{formatTime(stats?.avg_minutes_active || 0)}</div>
                        <div className="stats-kpi-label">Tiempo medio</div>
                    </div>

                    <div className="stats-kpi-card stats-kpi-info">
                        <div className="stats-kpi-value">{formatTime(stats?.median_minutes_active || 0)}</div>
                        <div className="stats-kpi-label">Mediana</div>
                    </div>

                    {trends && (
                        <div className={`stats-kpi-card stats-kpi-trend stats-kpi-trend-${trends.trend_vs_yesterday.direction}`}>
                            <div className="stats-kpi-value">
                                {trends.trend_vs_yesterday.direction === 'up' && '↑'}
                                {trends.trend_vs_yesterday.direction === 'down' && '↓'}
                                {trends.trend_vs_yesterday.direction === 'stable' && '→'}
                                {Math.abs(trends.trend_vs_yesterday.percentage)}%
                            </div>
                            <div className="stats-kpi-label">vs ayer</div>
                        </div>
                    )}
                </motion.div>

                {/* Charts */}
                <div className="stats-charts-grid">
                    <motion.div
                        className="stats-chart-card"
                        initial="hidden"
                        animate="visible"
                        variants={fadeIn}
                        transition={{ duration: 0.3, delay: 0.1 }}
                    >
                        <h3>Tendencia diaria</h3>
                        <p className="stats-chart-subtitle">Incidencias V16 últimos 7 días</p>
                        <div className="stats-chart-container">
                            <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={trends?.daily_trend || []}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3498db" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3498db" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 11, fill: '#666' }}
                                        axisLine={{ stroke: '#ddd' }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: '#666' }}
                                        axisLine={{ stroke: '#ddd' }}
                                        width={30}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: '#fff',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        stroke="#3498db"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorCount)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    <motion.div
                        className="stats-chart-card"
                        initial="hidden"
                        animate="visible"
                        variants={fadeIn}
                        transition={{ duration: 0.3, delay: 0.15 }}
                    >
                        <h3>Distribución horaria</h3>
                        <p className="stats-chart-subtitle">Activaciones por hora (hora España)</p>
                        <div className="stats-chart-container">
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={trends?.hourly_distribution || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis
                                        dataKey="hour"
                                        tick={{ fontSize: 9, fill: '#666' }}
                                        axisLine={{ stroke: '#ddd' }}
                                        tickFormatter={(h) => `${h}`}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: '#666' }}
                                        axisLine={{ stroke: '#ddd' }}
                                        width={25}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: '#fff',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            fontSize: '12px'
                                        }}
                                        formatter={(value) => [`${value}`, 'Incidencias']}
                                        labelFormatter={(h) => `${h}:00 - ${h}:59`}
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill="#2ecc71"
                                        radius={[2, 2, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                </div>

                {/* Lists */}
                <div className="stats-lists-grid">
                    <motion.div
                        className="stats-list-card"
                        initial="hidden"
                        animate="visible"
                        variants={fadeIn}
                        transition={{ duration: 0.3, delay: 0.2 }}
                    >
                        <h3>Por tipo de vía</h3>
                        <div className="stats-list">
                            {roadTypeEntries.map(([type, count]) => (
                                <div key={type} className="stats-list-item">
                                    <span className="stats-list-name">{ROAD_TYPE_LABELS[type] || type}</span>
                                    <div className="stats-list-bar-bg">
                                        <motion.div
                                            className="stats-list-bar"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(count / maxRoadCount) * 100}%` }}
                                            transition={{ duration: 0.5, delay: 0.3 }}
                                        />
                                    </div>
                                    <span className="stats-list-count">{count}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div
                        className="stats-list-card"
                        initial="hidden"
                        animate="visible"
                        variants={fadeIn}
                        transition={{ duration: 0.3, delay: 0.25 }}
                    >
                        <h3>Top provincias</h3>
                        <div className="stats-list">
                            {stats?.top_provinces.map((prov, i) => (
                                <div key={prov.name} className="stats-list-item">
                                    <span className="stats-list-rank">{i + 1}</span>
                                    <span className="stats-list-name">{prov.name}</span>
                                    <div className="stats-list-bar-bg">
                                        <motion.div
                                            className="stats-list-bar stats-list-bar-orange"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(prov.count / (stats.top_provinces[0]?.count || 1)) * 100}%` }}
                                            transition={{ duration: 0.5, delay: 0.35 + i * 0.05 }}
                                        />
                                    </div>
                                    <span className="stats-list-count">{prov.count}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* Sources */}
                {trends?.by_source && Object.keys(trends.by_source).length > 0 && (
                    <motion.div
                        className="stats-sources-card"
                        initial="hidden"
                        animate="visible"
                        variants={fadeIn}
                        transition={{ duration: 0.3, delay: 0.3 }}
                    >
                        <h3>Fuentes de datos</h3>
                        <div className="stats-sources">
                            {Object.entries(trends.by_source).map(([source, count]) => (
                                <div key={source} className="stats-source-item">
                                    <span className="stats-source-name">
                                        {source === 'nacional' ? 'DGT Nacional' :
                                            source === 'pais_vasco' ? 'País Vasco' :
                                                source === 'cataluna' ? 'Cataluña' : source}
                                    </span>
                                    <span className="stats-source-count">{count}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                <footer className="site-footer">
                    <span>© 2026</span>
                    <span className="footer-separator">|</span>
                    <span>Desarrollado por <a href="https://mapabalizasv16.info" target="_blank" rel="noopener noreferrer">Ander Sein</a></span>
                </footer>
            </div>
        </div>
    )
}

export default StatsPage
