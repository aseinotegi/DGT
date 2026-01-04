// Beacon types
export interface Beacon {
    id: string
    latitude: number
    longitude: number
    road_name: string
    road_type: string
    km_marker: string
    direction: string
    province: string
    autonomous_community: string
    municipality: string
    activation_time: string
    source: string
    incident_type: string
    detailed_cause_type: string
    is_v16: boolean
}

// Alert types
export interface VulnerableBeacon {
    id: string
    latitude: number
    longitude: number
    road_name: string
    km_marker: string
    province: string
    municipality: string
    activation_time: string
    vulnerability_score: number
    risk_factors: {
        isolation: number
        time_active: number
        night_hour: number
        road_type: number
    }
    priority: 'critical' | 'high' | 'medium' | 'low'
}

// Stats types
export interface BeaconStats {
    total_active: number
    v16_active: number
    average_active_minutes: number
    peak_hour: number
    by_road_type: Record<string, number>
    by_province: Record<string, number>
    hourly_distribution: Record<string, number>
}

// API Response types
export interface BeaconsResponse {
    beacons: Beacon[]
    count: number
    last_updated: string
}

export interface VulnerableResponse {
    vulnerable_beacons: VulnerableBeacon[]
    count: number
    critical_count: number
}
