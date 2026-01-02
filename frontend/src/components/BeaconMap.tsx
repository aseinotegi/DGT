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

interface BeaconMapProps {
    data: GeoJSONData | null
}

const CENTER: LatLngTuple = [40.4168, -3.7038]
const ZOOM = 6

const beaconIcon = L.icon({
    iconUrl: '/baliza.jpg',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
})

const createClusterCustomIcon = (cluster: any) => {
    const count = cluster.getChildCount()
    let size = 'small'
    let dimension = 36

    if (count > 50) {
        size = 'large'
        dimension = 48
    } else if (count > 20) {
        size = 'medium'
        dimension = 42
    }

    return L.divIcon({
        html: `<div class="cluster-icon cluster-${size}">${count}</div>`,
        className: 'custom-cluster',
        iconSize: L.point(dimension, dimension, true),
    })
}

const INCIDENT_LABELS: Record<string, string> = {
    roadMaintenance: 'Obras',
    vehicleBreakdown: 'Vehiculo averiado',
    accident: 'Accidente',
    weatherCondition: 'Meteorologia',
    infrastructureDamageObstruction: 'Obstruccion',
    ConstructionWorks: 'Construccion',
    MaintenanceWorks: 'Mantenimiento',
    unknown: 'Baliza activa',
}

function formatDateTime(isoString: string | null): string {
    if (!isoString) return ''
    try {
        const date = new Date(isoString)
        return date.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    } catch {
        return ''
    }
}

function BeaconMap({ data }: BeaconMapProps) {
    const getLabel = (type: string) => INCIDENT_LABELS[type] || 'Baliza activa'

    const openNavigation = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
    }

    const openGoogleMaps = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')
    }

    const openWaze = (lat: number, lng: number) => {
        window.open(`https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank')
    }

    const shareLocation = async (lat: number, lng: number, road: string | null) => {
        const text = `Baliza V16${road ? ` en ${road}` : ''}: https://www.google.com/maps?q=${lat},${lng}`
        if (navigator.share) {
            await navigator.share({ text })
        } else {
            navigator.clipboard.writeText(text)
            alert('Enlace copiado')
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
                attribution='OpenStreetMap'
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
                    const {
                        incident_type, road_name, municipality, province,
                        direction, pk, autonomous_community, activation_time
                    } = feature.properties

                    return (
                        <Marker
                            key={feature.properties.id}
                            position={[lat, lng]}
                            icon={beaconIcon}
                        >
                            <Popup>
                                <div className="popup-content">
                                    <div className="popup-header">
                                        {getLabel(incident_type)}
                                    </div>

                                    <div className="popup-body">
                                        {road_name && (
                                            <div className="popup-row">
                                                <span className="label">Carretera</span>
                                                <span className="value">{road_name}</span>
                                            </div>
                                        )}

                                        {pk && (
                                            <div className="popup-row">
                                                <span className="label">PK</span>
                                                <span className="value">{pk}</span>
                                            </div>
                                        )}

                                        {direction && (
                                            <div className="popup-row">
                                                <span className="label">Sentido</span>
                                                <span className="value">{direction}</span>
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

                                        {autonomous_community && (
                                            <div className="popup-row">
                                                <span className="label">Comunidad</span>
                                                <span className="value">{autonomous_community}</span>
                                            </div>
                                        )}

                                        {activation_time && (
                                            <div className="popup-row">
                                                <span className="label">Desde</span>
                                                <span className="value">{formatDateTime(activation_time)}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="popup-actions">
                                        <button
                                            className="popup-btn"
                                            onClick={() => openGoogleMaps(lat, lng)}
                                        >
                                            Mapas
                                        </button>
                                        <button
                                            className="popup-btn"
                                            onClick={() => openNavigation(lat, lng)}
                                        >
                                            Google
                                        </button>
                                        <button
                                            className="popup-btn"
                                            onClick={() => openWaze(lat, lng)}
                                        >
                                            Waze
                                        </button>
                                    </div>
                                    <div className="popup-actions">
                                        <button
                                            className="popup-btn popup-btn-primary"
                                            onClick={() => shareLocation(lat, lng, road_name)}
                                        >
                                            Compartir
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
