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

interface BeaconMapProps {
    data: GeoJSONData | null
}

const CENTER: LatLngTuple = [40.4168, -3.7038]
const ZOOM = 6

const getIcon = (url: string) => L.icon({
    iconUrl: url,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
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
    const v16Icon = getIcon('/baliza.jpg')

    const openGoogleMaps = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')
    }

    const shareLocation = async (lat: number, lng: number, road: string | null) => {
        const text = `Baliza V16 activa${road ? ` en ${road}` : ''}: https://www.google.com/maps?q=${lat},${lng}`
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
                        road_name, municipality, province,
                        direction, pk, autonomous_community, activation_time,
                        is_stale, minutes_active
                    } = feature.properties

                    return (
                        <Marker
                            key={feature.properties.id}
                            position={[lat, lng]}
                            icon={v16Icon}
                            opacity={is_stale ? 0.4 : 1}
                        >
                            <Popup className="popup-minimal">
                                <div className="pm">
                                    <div className="pm-header">
                                        <img src="/baliza.jpg" alt="" />
                                        <span>
                                            Baliza activa
                                            {is_stale && <span className="stale-badge">posible error</span>}
                                        </span>
                                    </div>
                                    <div className="pm-body">
                                        <p><b>Causa:</b> Vehículo detenido</p>
                                        {road_name && <p><b>Carretera (ppkk):</b> <span className="hl">{road_name}{pk ? ` (PK ${pk})` : ''}</span></p>}
                                        {direction && <p><b>Sentido:</b> {direction}</p>}
                                        {activation_time && <p><b>Desde:</b> <span className="hl">{formatDateTime(activation_time)}</span></p>}
                                        {minutes_active > 0 && <p><b>Tiempo activo:</b> {Math.floor(minutes_active / 60)}h {minutes_active % 60}m</p>}
                                        {(province || autonomous_community) && <p><b>Provincia:</b> {province || autonomous_community}</p>}
                                        {municipality && <p><b>Municipio:</b> {municipality}</p>}
                                    </div>
                                    <div className="pm-actions">
                                        <button onClick={() => openGoogleMaps(lat, lng)}>Mapas</button>
                                        <button onClick={() => shareLocation(lat, lng, road_name)}>Compartir</button>
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
