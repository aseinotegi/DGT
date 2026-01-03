import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import BeaconMap from './components/BeaconMap'
import './index.css'

interface GeoJSONFeature {
    type: 'Feature'
    geometry: {
        type: 'Point'
        coordinates: [number, number]
    }
    properties: {
        id: string
        external_id: string
        source: string
        incident_type: string
        road_name: string | null
        road_type: string | null
        severity: string | null
        municipality: string | null
        province: string | null
        direction: string | null
        pk: string | null
        autonomous_community: string | null
        activation_time: string | null
        created_at: string | null
        updated_at: string | null
        source_identification: string | null
        detailed_cause_type: string | null
        is_v16: boolean
        minutes_active: number
        is_stale: boolean
    }
}

interface GeoJSONData {
    type: 'FeatureCollection'
    features: GeoJSONFeature[]
    metadata: {
        total_count: number
        sources: {
            nacional: number
            pais_vasco: number
            cataluna: number
        }
    }
}

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

interface AlertsResponse {
    count: number
    threshold: number
    alerts: VulnerableAlert[]
}

// API base URL - empty for local (uses proxy), full URL for production
const API_BASE = import.meta.env.VITE_API_URL || 'https://dgt-production.up.railway.app';


function App() {
    const [data, setData] = useState<GeoJSONData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const [alerts, setAlerts] = useState<VulnerableAlert[]>([])
    const [showAlertPanel, setShowAlertPanel] = useState(false)

    const [filterV16Only] = useState<boolean>(true)

    const fetchBeacons = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/v1/beacons`)
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            const json: GeoJSONData = await response.json()
            setData(json)
            setLastUpdate(new Date())
            setError(null)
        } catch (err) {
            console.error('Error fetching beacons:', err)
            setError('Error al cargar los datos')
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchAlerts = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/v1/alerts/vulnerable?min_score=50`)
            if (!response.ok) return
            const json: AlertsResponse = await response.json()
            setAlerts(json.alerts)
            // Auto-show panel if high-risk alerts found
            if (json.alerts.some(a => a.risk_level === 'critical' || a.risk_level === 'high')) {
                setShowAlertPanel(true)
            }
        } catch (err) {
            console.error('Error fetching alerts:', err)
        }
    }, [])

    useEffect(() => {
        fetchBeacons()
        fetchAlerts()
        const beaconInterval = setInterval(fetchBeacons, 60000)
        const alertInterval = setInterval(fetchAlerts, 30000)
        return () => {
            clearInterval(beaconInterval)
            clearInterval(alertInterval)
        }
    }, [fetchBeacons, fetchAlerts])

    const filteredData = useMemo(() => {
        if (!data) return null

        let filtered = data.features

        if (filterV16Only) {
            filtered = filtered.filter((f: GeoJSONFeature) =>
                f.properties.incident_type === 'vehicleObstruction'
            )
        }

        return {
            ...data,
            features: filtered
        }
    }, [data, filterV16Only])

    const filteredCount = filteredData?.features.length || 0
    const criticalAlerts = alerts.filter(a => a.risk_level === 'critical' || a.risk_level === 'high')

    if (loading && !data) {
        return <div className="loading">Cargando mapa de incidencias...</div>
    }

    return (
        <div className="app-container">
            <header>
                <div className="header-left">
                    <img src="/baliza.jpg" className="v16-icon" alt="V16" />
                    <h1>Vehículos detenidos</h1>
                </div>
                <div className="stats">
                    <span className="count">
                        {filteredCount} balizas activas
                    </span>
                    {lastUpdate && (
                        <span className="last-update">
                            {lastUpdate.toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </header>

            {/* Alert Panel - Enhanced with scores */}
            {showAlertPanel && criticalAlerts.length > 0 && (
                <div className="alert-simple">
                    <div className="alert-simple-header">
                        <span>Posibles personas en apuros</span>
                        <div className="alert-header-actions">
                            <Link to="/peligro" className="see-all-link">Ver todos</Link>
                            <button onClick={() => setShowAlertPanel(false)}>×</button>
                        </div>
                    </div>
                    <ul className="alert-simple-list">
                        {criticalAlerts.slice(0, 5).map((alert) => (
                            <li key={alert.beacon_id}>
                                <Link to={`/peligro?id=${alert.beacon_id}`} className="alert-link">
                                    <span
                                        className="score-badge"
                                        style={{
                                            backgroundColor: alert.risk_level === 'critical' ? '#dc2626' :
                                                alert.risk_level === 'high' ? '#ea580c' : '#ca8a04'
                                        }}
                                    >
                                        {alert.total_score.toFixed(0)}
                                    </span>
                                    <div className="alert-simple-location">
                                        {alert.road_name || 'Carretera'} - {alert.municipality}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <main className="map-container">
                {loading && !data && (
                    <div className="loading-overlay">
                        <div className="loading-spinner"></div>
                        <span className="loading-text">Cargando...</span>
                    </div>
                )}

                {error && (
                    <div className="error-banner">
                        <span>{error}</span>
                    </div>
                )}

                <BeaconMap data={filteredData} />

                {/* Floating Alert Button - always visible */}
                <Link
                    to="/peligro"
                    className="alert-fab"
                    title="Ver personas vulnerables"
                >
                    <span className="alert-fab-icon">⚠</span>
                    {criticalAlerts.length > 0 && (
                        <span className="alert-fab-count">{criticalAlerts.length}</span>
                    )}
                </Link>
            </main>
        </div>
    )
}

export default App
