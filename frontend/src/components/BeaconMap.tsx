import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L, { LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

interface BeaconMapProps {
    data: GeoJSONData | null
}

// Map center (Spain)
const CENTER: LatLngTuple = [40.4168, -3.7038]
const ZOOM = 6

// Custom V16 beacon icon
const beaconIcon = L.icon({
    iconUrl: '/baliza.jpg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
})

// Cluster icon creator - using any to avoid type issues
const createClusterCustomIcon = (cluster: any) => {
    const count = cluster.getChildCount()
    let size = 'small'
    let dimension = 40

    if (count > 50) {
        size = 'large'
        dimension = 60
    } else if (count > 20) {
        size = 'medium'
        dimension = 50
    }

    return L.divIcon({
        html: `<div class="cluster-icon cluster-${size}"><span>${count}</span></div>`,
        className: 'custom-cluster',
        iconSize: L.point(dimension, dimension, true),
    })
}

// Human-readable incident types
const INCIDENT_LABELS: Record<string, string> = {
    roadMaintenance: 'Obras en carretera',
    vehicleBreakdown: 'Vehículo averiado',
    accident: 'Accidente',
    weatherCondition: 'Meteorología adversa',
    infrastructureDamageObstruction: 'Daño en infraestructura',
    ConstructionWorks: 'Construcción',
    MaintenanceWorks: 'Mantenimiento',
    unknown: 'Baliza V16 activa',
}

function BeaconMap({ data }: BeaconMapProps) {
    const getLabel = (type: string) => INCIDENT_LABELS[type] || 'Baliza V16 activa'

    const openNavigation = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
    }

    const openGoogleMaps = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')
    }

    const shareLocation = async (lat: number, lng: number, road: string | null) => {
        const text = `Baliza V16 activa${road ? ` en ${road}` : ''}: https://www.google.com/maps?q=${lat},${lng}`
        if (navigator.share) {
            await navigator.share({ text })
        } else {
            navigator.clipboard.writeText(text)
            alert('Enlace copiado al portapapeles')
        }
    }

    return (
        <MapContainer
            center={CENTER}
            zoom={ZOOM}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MarkerClusterGroup
                chunkedLoading
                iconCreateFunction={createClusterCustomIcon}
                maxClusterRadius={60}
                spiderfyOnMaxZoom={true}
                showCoverageOnHover={false}
                zoomToBoundsOnClick={true}
            >
                {data?.features.map((feature) => {
                    const [lng, lat] = feature.geometry.coordinates
                    const { incident_type, road_name, municipality, province, severity } = feature.properties

                    return (
                        <Marker
                            key={feature.properties.id}
                            position={[lat, lng]}
                            icon={beaconIcon}
                        >
                            <Popup>
                                <div className="popup-content">
                                    <div className="popup-header">
                                        <img src="/baliza.jpg" alt="V16" className="popup-icon" />
                                        <span className="type">{getLabel(incident_type)}</span>
                                    </div>

                                    <div className="popup-body">
                                        {road_name && (
                                            <div className="popup-row">
                                                <span className="label">Carretera</span>
                                                <span className="value">{road_name}</span>
                                            </div>
                                        )}

                                        {municipality && (
                                            <div className="popup-row">
                                                <span className="label">Municipio</span>
                                                <span className="value">{municipality}</span>
                                            </div>
                                        )}

                                        {province && (
                                            <div className="popup-row">
                                                <span className="label">Provincia</span>
                                                <span className="value">{province}</span>
                                            </div>
                                        )}

                                        {severity && (
                                            <div className="popup-row">
                                                <span className="label">Severidad</span>
                                                <span className="value">{severity}</span>
                                            </div>
                                        )}

                                        <div className="popup-row">
                                            <span className="label">Coordenadas</span>
                                            <span className="value">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                                        </div>
                                    </div>

                                    <div className="popup-actions">
                                        <button
                                            className="popup-btn popup-btn-primary"
                                            onClick={() => openNavigation(lat, lng)}
                                        >
                                            🧭 Navegar
                                        </button>
                                        <button
                                            className="popup-btn popup-btn-secondary"
                                            onClick={() => openGoogleMaps(lat, lng)}
                                        >
                                            📍 Ver
                                        </button>
                                        <button
                                            className="popup-btn popup-btn-secondary"
                                            onClick={() => shareLocation(lat, lng, road_name)}
                                        >
                                            📤 Compartir
                                        </button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    )
                })}
            </MarkerClusterGroup>
        </MapContainer>
    )
}

export default BeaconMap
