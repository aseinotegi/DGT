import { useState, useEffect, useCallback, useMemo } from 'react'

// Types
export interface GeoJSONFeature {
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

export interface GeoJSONData {
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

export interface VulnerableAlert {
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

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'https://dgt-production.up.railway.app'

export function useBeacons(filterV16Only: boolean = true) {
    const [data, setData] = useState<GeoJSONData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const [alerts, setAlerts] = useState<VulnerableAlert[]>([])

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
        if (!filterV16Only) return data
        return {
            ...data,
            features: data.features.filter(f => f.properties.is_v16)
        }
    }, [data, filterV16Only])

    const validAlerts = useMemo(() => {
        return alerts.filter(alert =>
            (alert.risk_level === 'critical' || alert.risk_level === 'high' || alert.risk_level === 'medium')
            && alert.minutes_active < 600
        )
    }, [alerts])

    const criticalAlerts = useMemo(() => {
        return validAlerts.filter(alert => alert.risk_level === 'critical')
    }, [validAlerts])

    return {
        data: filteredData,
        rawData: data,
        loading,
        error,
        lastUpdate,
        alerts,
        validAlerts,
        criticalAlerts,
        refetch: fetchBeacons
    }
}

// Utility function for time formatting
export function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return `${seconds} seg`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} min`
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
