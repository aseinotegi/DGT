import { useState, useEffect, useCallback, useMemo } from 'react'
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

// Translations for display
const INCIDENT_TYPES: Record<string, string> = {
    'roadMaintenance': 'Obras',
    'accident': 'Accidente',
    'environmentalObstruction': 'Obstáculo',
    'roadOrCarriagewayOrLaneManagement': 'Gestión vía',
}

const ROAD_TYPES: Record<string, string> = {
    'autopista': 'Autopista',
    'nacional': 'Nacional',
    'autonomica': 'Autonómica',
    'provincial': 'Provincial',
    'local': 'Local',
}

function App() {
    const [data, setData] = useState<GeoJSONData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

    // Filter state
    const [filterIncidentType, setFilterIncidentType] = useState<string>('')
    const [filterRoadType, setFilterRoadType] = useState<string>('')

    const fetchBeacons = useCallback(async () => {
        try {
            const response = await fetch('/api/v1/beacons')
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

    // Filter data
    const filteredData = useMemo(() => {
        if (!data) return null

        let filtered = data.features

        if (filterIncidentType) {
            filtered = filtered.filter(f => f.properties.incident_type === filterIncidentType)
        }
        if (filterRoadType) {
            filtered = filtered.filter(f => f.properties.road_type === filterRoadType)
        }

        return {
            ...data,
            features: filtered,
            metadata: {
                ...data.metadata,
                total_count: filtered.length,
            }
        }
    }, [data, filterIncidentType, filterRoadType])

    // Get unique values for filters
    const incidentTypes = useMemo(() => {
        if (!data) return []
        const types = new Set(data.features.map(f => f.properties.incident_type))
        return Array.from(types).sort()
    }, [data])

    const roadTypes = useMemo(() => {
        if (!data) return []
        const types = new Set(data.features.map(f => f.properties.road_type).filter(Boolean))
        return Array.from(types).sort()
    }, [data])

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const hasFilters = filterIncidentType || filterRoadType

    return (
        <>
            <header className="header">
                <h1 className="header-title">Balizas V16</h1>

                <div className="header-info">
                    <span className="beacon-count">
                        {filteredData?.metadata.total_count ?? '-'}
                        {hasFilters ? ` / ${data?.metadata.total_count ?? '-'}` : ''} activas
                    </span>
                    {lastUpdate && (
                        <span className="update-time">Actualizado {formatTime(lastUpdate)}</span>
                    )}
                </div>
            </header>

            <div className="filter-bar">
                <select
                    value={filterIncidentType}
                    onChange={(e) => setFilterIncidentType(e.target.value)}
                    className="filter-select"
                >
                    <option value="">Todos los tipos</option>
                    {incidentTypes.map(type => (
                        <option key={type} value={type}>
                            {INCIDENT_TYPES[type] || type}
                        </option>
                    ))}
                </select>

                <select
                    value={filterRoadType}
                    onChange={(e) => setFilterRoadType(e.target.value)}
                    className="filter-select"
                >
                    <option value="">Todas las vías</option>
                    {roadTypes.map(type => (
                        <option key={type} value={type as string}>
                            {ROAD_TYPES[type as string] || type}
                        </option>
                    ))}
                </select>

                {hasFilters && (
                    <button
                        onClick={() => { setFilterIncidentType(''); setFilterRoadType(''); }}
                        className="filter-clear"
                    >
                        Limpiar
                    </button>
                )}
            </div>

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
            </main>
        </>
    )
}

export default App

