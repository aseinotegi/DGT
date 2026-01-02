import { useState, useEffect, useCallback } from 'react'
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
        severity: string | null
        municipality: string | null
        province: string | null
        direction: string | null
        pk: string | null
        autonomous_community: string | null
        activation_time: string | null
        created_at: string | null
        updated_at: string | null
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

function App() {
    const [data, setData] = useState<GeoJSONData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

    const fetchBeacons = useCallback(async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || ''
            const response = await fetch(`${apiUrl}/api/v1/beacons`)
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

    useEffect(() => {
        fetchBeacons()
        const interval = setInterval(fetchBeacons, 60000)
        return () => clearInterval(interval)
    }, [fetchBeacons])

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return (
        <>
            <header className="header">
                <h1 className="header-title">Balizas V16</h1>

                <div className="header-info">
                    <span className="beacon-count">{data?.metadata.total_count ?? '-'} activas</span>
                    {lastUpdate && (
                        <span className="update-time">Actualizado {formatTime(lastUpdate)}</span>
                    )}
                </div>
            </header>

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

                <BeaconMap data={data} />
            </main>
        </>
    )
}

export default App
