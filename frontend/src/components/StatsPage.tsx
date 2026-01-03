import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area, CartesianGrid
} from 'recharts'
import './StatsPage.css'

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
    hidden: { opacity: 0, y: 20 },
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
            <div className="stats-page">
                <div className="stats-loading-full">Cargando estadísticas...</div>
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
        <div className="stats-page">
            <header className="stats-header">
                <Link to="/" className="back-button">← Volver al mapa</Link>
                <h1>Estadísticas en tiempo real</h1>
            </header>

            <main className="stats-main">
                {/* KPI Cards */}
                <motion.section
                    className="kpi-section"
                    initial="hidden"
                    animate="visible"
                    variants={fadeIn}
                    transition={{ duration: 0.4 }}
                >
                    <div className="kpi-grid">
                        <div className="kpi-card primary">
                            <div className="kpi-value">{stats?.total_vehicles || 0}</div>
                            <div className="kpi-label">Balizas V16 activas</div>
                        </div>

                        <div className="kpi-card success">
                            <div className="kpi-value">{formatTime(stats?.avg_minutes_active || 0)}</div>
                            <div className="kpi-label">Tiempo medio</div>
                        </div>

                        <div className="kpi-card purple">
                            <div className="kpi-value">{formatTime(stats?.median_minutes_active || 0)}</div>
                            <div className="kpi-label">Mediana</div>
                        </div>

                        {trends && (
                            <div className={`kpi-card trend ${trends.trend_vs_yesterday.direction}`}>
                                <div className="kpi-value">
                                    {trends.trend_vs_yesterday.direction === 'up' && '↑'}
                                    {trends.trend_vs_yesterday.direction === 'down' && '↓'}
                                    {trends.trend_vs_yesterday.direction === 'stable' && '→'}
                                    {Math.abs(trends.trend_vs_yesterday.percentage)}%
                                </div>
                                <div className="kpi-label">vs ayer</div>
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* Charts Section */}
                <div className="charts-grid">
                    {/* Daily Trend Chart */}
                    <motion.section
                        className="chart-card"
                        initial="hidden"
                        animate="visible"
                        variants={fadeIn}
                        transition={{ duration: 0.4, delay: 0.1 }}
                    >
                        <h2>Tendencia diaria</h2>
                        <p className="chart-subtitle">Incidencias V16 últimos 7 días</p>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={trends?.daily_trend || []}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: '#fff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorCount)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.section>

                    {/* Hourly Distribution Chart */}
                    <motion.section
                        className="chart-card"
                        initial="hidden"
                        animate="visible"
                        variants={fadeIn}
                        transition={{ duration: 0.4, delay: 0.2 }}
                    >
                        <h2>Distribución horaria</h2>
                        <p className="chart-subtitle">Activaciones por hora del día (hora España)</p>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={trends?.hourly_distribution || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="hour"
                                        tick={{ fontSize: 10, fill: '#64748b' }}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                        tickFormatter={(h) => `${h}h`}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: '#fff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        formatter={(value: number) => [`${value} incidencias`, 'Cantidad']}
                                        labelFormatter={(h) => `${h}:00 - ${h}:59`}
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill="#10b981"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.section>
                </div>

                {/* Bottom Grid: Road Types + Provinces */}
                <div className="bottom-grid">
                    {/* Road Types */}
                    <motion.section
                        className="list-card"
                        initial="hidden"
                        animate="visible"
                        variants={fadeIn}
                        transition={{ duration: 0.4, delay: 0.3 }}
                    >
                        <h2>Por tipo de vía</h2>
                        <div className="list-items">
                            {roadTypeEntries.map(([type, count]) => (
                                <div key={type} className="list-item">
                                    <span className="list-item-name">
                                        {ROAD_TYPE_LABELS[type] || type}
                                    </span>
                                    <div className="list-item-bar-container">
                                        <motion.div
                                            className="list-item-bar"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(count / maxRoadCount) * 100}%` }}
                                            transition={{ duration: 0.6, delay: 0.4 }}
                                        />
                                    </div>
                                    <span className="list-item-count">{count}</span>
                                </div>
                            ))}
                        </div>
                    </motion.section>

                    {/* Top Provinces */}
                    <motion.section
                        className="list-card"
                        initial="hidden"
                        animate="visible"
                        variants={fadeIn}
                        transition={{ duration: 0.4, delay: 0.4 }}
                    >
                        <h2>Top provincias</h2>
                        <div className="list-items">
                            {stats?.top_provinces.map((prov, i) => (
                                <div key={prov.name} className="list-item">
                                    <span className="list-item-rank">{i + 1}</span>
                                    <span className="list-item-name">{prov.name}</span>
                                    <div className="list-item-bar-container">
                                        <motion.div
                                            className="list-item-bar province"
                                            initial={{ width: 0 }}
                                            animate={{
                                                width: `${(prov.count / (stats.top_provinces[0]?.count || 1)) * 100}%`
                                            }}
                                            transition={{ duration: 0.6, delay: 0.5 + i * 0.1 }}
                                        />
                                    </div>
                                    <span className="list-item-count">{prov.count}</span>
                                </div>
                            ))}
                        </div>
                    </motion.section>
                </div>

                {/* Data Sources */}
                {trends?.by_source && Object.keys(trends.by_source).length > 0 && (
                    <motion.section
                        className="sources-card"
                        initial="hidden"
                        animate="visible"
                        variants={fadeIn}
                        transition={{ duration: 0.4, delay: 0.5 }}
                    >
                        <h2>Fuentes de datos</h2>
                        <div className="sources-grid">
                            {Object.entries(trends.by_source).map(([source, count]) => (
                                <div key={source} className="source-item">
                                    <span className="source-name">
                                        {source === 'nacional' ? 'DGT Nacional' :
                                            source === 'pais_vasco' ? 'País Vasco' :
                                                source === 'cataluna' ? 'Cataluña' : source}
                                    </span>
                                    <span className="source-count">{count}</span>
                                </div>
                            ))}
                        </div>
                    </motion.section>
                )}
            </main>
        </div>
    )
}

export default StatsPage
