import { useState, useCallback } from 'react'

export function useGeolocation() {
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
    const [locating, setLocating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const locate = useCallback(() => {
        if (!navigator.geolocation) {
            setError('Tu navegador no soporta geolocalización')
            return
        }

        setLocating(true)
        setError(null)

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords
                setUserLocation([latitude, longitude])
                setLocating(false)
            },
            (err) => {
                console.error('Geolocation error:', err)
                setLocating(false)
                if (err.code === err.PERMISSION_DENIED) {
                    setError('Permiso de ubicación denegado')
                } else {
                    setError('No se pudo obtener tu ubicación')
                }
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }, [])

    return {
        userLocation,
        locating,
        error,
        locate
    }
}
