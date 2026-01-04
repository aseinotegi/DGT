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
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
    const [locatingUser, setLocatingUser] = useState(false)

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

    // Format time ago for "Actualizado hace X"
    const formatTimeAgo = (date: Date): string => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
        if (seconds < 60) return `${seconds} seg`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes} min`
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    }

    // Geolocation handler
    const handleLocateUser = useCallback(() => {
        if (!navigator.geolocation) {
            alert('Tu navegador no soporta geolocalización')
            return
        }
        setLocatingUser(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords
                setUserLocation([latitude, longitude])
                setLocatingUser(false)
            },
            (error) => {
                console.error('Geolocation error:', error)
                setLocatingUser(false)
                if (error.code === error.PERMISSION_DENIED) {
                    alert('Permiso de ubicación denegado. Habilítalo en tu navegador.')
                } else {
                    alert('No se pudo obtener tu ubicación')
                }
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
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
            filtered = filtered.filter((f: GeoJSONFeature) => f.properties.is_v16)
        }

        return {
            ...data,
            features: filtered
        }
    }, [data, filterV16Only])

    const filteredCount = filteredData?.features.length || 0
    // Only count valid alerts (not stale - less than 10 hours = 600 minutes)
    const validAlerts = alerts.filter(a => a.minutes_active < 600)
    const criticalAlerts = validAlerts.filter(a => a.risk_level === 'critical' || a.risk_level === 'high')

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
                        <span className="last-update" title={lastUpdate.toLocaleTimeString()}>
                            Actualizado hace {formatTimeAgo(lastUpdate)}
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

                <BeaconMap
                    data={filteredData}
                    userLocation={userLocation}
                    onLocateUser={handleLocateUser}
                    isLocating={locatingUser}
                />

                {/* Floating Action Buttons - Minimal icons */}
                <div className="fab-container">
                    <button
                        onClick={handleLocateUser}
                        className={`fab-btn fab-location ${locatingUser ? 'fab-loading' : ''}`}
                        title="Cerca de mí"
                        aria-label="Mostrar mi ubicación"
                        disabled={locatingUser}
                    >
                        {locatingUser ? '...' : ''}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                        </svg>
                    </button>

                    <Link
                        to="/stats"
                        className="fab-btn fab-stats"
                        title="Estadísticas"
                        aria-label="Ver estadísticas"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 20V10M12 20V4M6 20v-6" />
                        </svg>
                    </Link>

                    <Link
                        to="/peligro"
                        className={`fab-btn fab-alerts ${criticalAlerts.length > 0 ? 'fab-alerts-critical' : ''}`}
                        title="Alertas de vulnerabilidad"
                        aria-label="Ver personas vulnerables"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        {validAlerts.length > 0 && (
                            <span className="fab-badge">{validAlerts.length}</span>
                        )}
                    </Link>

                    <Link
                        to="/info"
                        className="fab-btn fab-info"
                        title="Información"
                        aria-label="Ver información sobre V16"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                    </Link>
                </div>
            </main>

            <footer className="site-footer">
                <span>© 2026</span>
                <span className="footer-separator">|</span>
                <span>Desarrollado por <a href="https://www.linkedin.com/in/ander-sein-a24097195/" target="_blank" rel="noopener noreferrer">Ander Sein</a></span>
            </footer>
        </div>
    )
}

export default App
