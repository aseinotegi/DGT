import { useSearchParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

interface VulnerableAlert {
    beacon_id: string
    external_id: string
    lat: number
    lng: number
    road_name: string | null
    municipality: string | null
    province: string | null
    total_score: number
    risk_level: string
    risk_factors: string[]
    minutes_active: number
    scores: {
        isolation: number
        exposure: number
        nighttime: number
        road_type: number
    }
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://dgt-production.up.railway.app';

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
}

function getRiskColor(level: string): string {
    switch (level) {
        case 'critical': return '#dc2626'
        case 'high': return '#ea580c'
        case 'medium': return '#ca8a04'
        default: return '#65a30d'
    }
}

function PeligroPage() {
    const [searchParams] = useSearchParams()
    const beaconId = searchParams.get('id')
    const [alert, setAlert] = useState<VulnerableAlert | null>(null)
    const [allAlerts, setAllAlerts] = useState<VulnerableAlert[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/v1/alerts/vulnerable?min_score=40`)
                if (!response.ok) return
                const json = await response.json()
                setAllAlerts(json.alerts)

                if (beaconId) {
                    const found = json.alerts.find((a: VulnerableAlert) => a.beacon_id === beaconId)
                    setAlert(found || null)
                }
            } catch (err) {
                console.error('Error:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchAlerts()
    }, [beaconId])

    if (loading) {
        return <div className="peligro-loading">Cargando datos de vulnerabilidad...</div>
    }

    return (
        <div className="peligro-page">
            <header className="peligro-header">
                <Link to="/" className="back-button">← Volver al mapa</Link>
                <h1>⚠️ Personas en situación de riesgo</h1>
            </header>

            {beaconId && alert ? (
                <div className="peligro-detail">
                    <div className="peligro-card">
                        <div className="peligro-card-header">
                            <span
                                className="risk-badge"
                                style={{ backgroundColor: getRiskColor(alert.risk_level) }}
                            >
                                {alert.risk_level.toUpperCase()}
                            </span>
                            <span className="score-display">{alert.total_score.toFixed(0)}/100</span>
                        </div>

                        <h2>{alert.road_name || 'Ubicación desconocida'}</h2>
                        <p className="location-info">
                            {alert.municipality}{alert.province ? `, ${alert.province}` : ''}
                        </p>

                        <div className="time-active">
                            <span className="label">Tiempo activo:</span>
                            <span className="value">{formatDuration(alert.minutes_active)}</span>
                        </div>

                        <div className="score-breakdown">
                            <h3>Desglose de puntuación</h3>
                            <div className="score-bar">
                                <span>Aislamiento</span>
                                <div className="bar"><div style={{ width: `${alert.scores.isolation}%` }}></div></div>
                                <span>{alert.scores.isolation.toFixed(0)}%</span>
                            </div>
                            <div className="score-bar">
                                <span>Exposición</span>
                                <div className="bar"><div style={{ width: `${alert.scores.exposure}%` }}></div></div>
                                <span>{alert.scores.exposure.toFixed(0)}%</span>
                            </div>
                            <div className="score-bar">
                                <span>Horario nocturno</span>
                                <div className="bar"><div style={{ width: `${alert.scores.nighttime}%` }}></div></div>
                                <span>{alert.scores.nighttime.toFixed(0)}%</span>
                            </div>
                            <div className="score-bar">
                                <span>Tipo de vía</span>
                                <div className="bar"><div style={{ width: `${alert.scores.road_type}%` }}></div></div>
                                <span>{alert.scores.road_type.toFixed(0)}%</span>
                            </div>
                        </div>

                        {alert.risk_factors.length > 0 && (
                            <div className="risk-factors">
                                <h3>Factores de riesgo</h3>
                                <ul>
                                    {alert.risk_factors.map((factor, i) => (
                                        <li key={i}>{factor}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="peligro-actions">
                            <a
                                href={`https://www.google.com/maps?q=${alert.lat},${alert.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="maps-button"
                            >
                                📍 Abrir en Google Maps
                            </a>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="peligro-list">
                    <p className="peligro-intro">
                        Listado de balizas V16 con puntuación de vulnerabilidad elevada.
                        Estas personas podrían necesitar asistencia.
                    </p>

                    {allAlerts.length === 0 ? (
                        <div className="no-alerts">
                            ✅ No hay alertas de vulnerabilidad en este momento
                        </div>
                    ) : (
                        <div className="alerts-grid">
                            {allAlerts.map((a) => (
                                <Link
                                    to={`/peligro?id=${a.beacon_id}`}
                                    key={a.beacon_id}
                                    className="alert-card"
                                >
                                    <div className="alert-card-header">
                                        <span
                                            className="risk-badge-small"
                                            style={{ backgroundColor: getRiskColor(a.risk_level) }}
                                        >
                                            {a.total_score.toFixed(0)}
                                        </span>
                                        <span className="alert-road">{a.road_name || 'Desconocido'}</span>
                                    </div>
                                    <div className="alert-card-body">
                                        <span>{a.municipality}</span>
                                        <span className="time">{formatDuration(a.minutes_active)}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default PeligroPage
