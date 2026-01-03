import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, Crosshair, Bell, MapPin, Navigation, Gauge, Clock, Layers } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useApp, Device, LocationData } from '../App'
import { motion } from 'framer-motion'
import { API_BASE_URL } from '../lib/supabase'

// Custom marker icon
const deviceIcon = L.divIcon({
  className: 'device-marker-container',
  html: `
    <div class="relative">
      <div class="device-marker w-8 h-8 device-marker-moving"></div>
      <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-transparent border-t-primary-500"></div>
    </div>
  `,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
})

// Map controller for auto-centering
function MapController({ center, autoFollow }: { center: [number, number] | null; autoFollow: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (center && autoFollow) {
      map.setView(center, map.getZoom(), { animate: true })
    }
  }, [center, autoFollow, map])

  return null
}

export default function LiveTracePage() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const { devices, locations } = useApp()

  const [device, setDevice] = useState<Device | null>(null)
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null)
  const [trail, setTrail] = useState<[number, number][]>([])
  const [autoFollow, setAutoFollow] = useState(true)
  const [mapLayer, setMapLayer] = useState<'street' | 'satellite'>('street')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Find device
  useEffect(() => {
    const found = devices.find(d => d.device_id === deviceId)
    if (found) setDevice(found)
  }, [deviceId, devices])

  // Get location updates
  useEffect(() => {
    const loc = locations.get(deviceId || '')
    if (loc) {
      setCurrentLocation(loc)
      setLastUpdate(new Date())

      // Add to trail
      setTrail(prev => {
        const newPoint: [number, number] = [loc.latitude, loc.longitude]
        // Keep last 100 points (30 minutes at 3 sec intervals)
        const updated = [...prev, newPoint].slice(-100)
        return updated
      })
    }
  }, [locations, deviceId])

  // Fetch initial trail
  useEffect(() => {
    if (!deviceId) return

    fetch(`${API_BASE_URL}/api/devices/${deviceId}/location/trail`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data.length > 0) {
          const points: [number, number][] = result.data.map((l: any) => [l.latitude, l.longitude])
          setTrail(points)

          const latest = result.data[result.data.length - 1]
          setCurrentLocation({
            latitude: latest.latitude,
            longitude: latest.longitude,
            accuracy: latest.accuracy,
            speed: latest.speed,
            bearing: latest.bearing,
            timestamp: latest.timestamp
          })
        }
      })
      .catch(console.error)
  }, [deviceId])

  const handleBeep = async () => {
    if (!deviceId) return

    try {
      await fetch(`${API_BASE_URL}/api/devices/${deviceId}/beep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Failed to send beep:', error)
    }
  }

  const handleRequestLocation = async () => {
    if (!deviceId) return

    try {
      await fetch(`${API_BASE_URL}/api/devices/${deviceId}/request-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Failed to request location:', error)
    }
  }

  // Calculate time since last update
  const [timeSinceUpdate, setTimeSinceUpdate] = useState('--')
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((new Date().getTime() - lastUpdate.getTime()) / 1000)
      if (diff < 60) {
        setTimeSinceUpdate(`${diff}s ago`)
      } else {
        setTimeSinceUpdate(`${Math.floor(diff / 60)}m ago`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lastUpdate])

  const mapCenter: [number, number] = currentLocation
    ? [currentLocation.latitude, currentLocation.longitude]
    : [0, 0]

  const speedKmh = currentLocation?.speed ? (currentLocation.speed * 3.6).toFixed(1) : '0'

  return (
    <div className="fixed inset-0 z-50 bg-dark-bg flex flex-col">
      {/* Header */}
      <div className="glass-card border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-semibold">LIVE TRACKING</h1>
            <p className="text-gray-400 text-sm">{device?.username || 'Loading...'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-follow toggle */}
          <button
            onClick={() => setAutoFollow(!autoFollow)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${autoFollow ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            <Crosshair size={18} />
            <span className="hidden sm:inline">Auto-follow</span>
          </button>

          {/* Map layer toggle */}
          <button
            onClick={() => setMapLayer(l => l === 'street' ? 'satellite' : 'street')}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <Layers size={18} />
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {currentLocation ? (
          <MapContainer
            center={mapCenter}
            zoom={16}
            className="h-full w-full"
            zoomControl={false}
          >
            <MapController center={mapCenter} autoFollow={autoFollow} />

            {/* Map tiles */}
            {mapLayer === 'street' ? (
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            ) : (
              <TileLayer
                attribution='&copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            )}

            {/* Trail line */}
            {trail.length > 1 && (
              <Polyline
                positions={trail}
                pathOptions={{
                  color: '#6366f1',
                  weight: 4,
                  opacity: 0.8,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
            )}

            {/* Accuracy circle */}
            {currentLocation.accuracy && (
              <Circle
                center={mapCenter}
                radius={currentLocation.accuracy}
                pathOptions={{
                  color: '#6366f1',
                  fillColor: '#6366f1',
                  fillOpacity: 0.1,
                  weight: 2
                }}
              />
            )}

            {/* Device marker */}
            <Marker position={mapCenter} icon={deviceIcon}>
              <Popup>
                <div className="text-dark-bg">
                  <p className="font-semibold">{device?.username}</p>
                  <p className="text-sm text-gray-600">{device?.device_name}</p>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Waiting for location...</p>
              {device && !device.location_enabled && (
                <button
                  onClick={handleRequestLocation}
                  className="btn-primary mt-4"
                >
                  Request Location Access
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="glass-card border-t border-gray-800 p-4"
      >
        {/* Device Info */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-lg font-bold">
            {device?.username?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{device?.username || 'Unknown'}</h3>
            <div className="flex items-center gap-2 text-sm">
              <span className={`capitalize ${getMovementColor(currentLocation?.movement_status)}`}>
                {currentLocation?.movement_status || 'stationary'}
              </span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-400">{speedKmh} km/h</span>
            </div>
          </div>

          {/* Time since update */}
          <div className="text-right">
            <p className="text-gray-400 text-sm">Updated</p>
            <p className="font-mono text-primary-400">{timeSinceUpdate}</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
              <Gauge size={14} />
              <span className="text-xs">Speed</span>
            </div>
            <p className="font-semibold">{speedKmh} km/h</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
              <Navigation size={14} />
              <span className="text-xs">Bearing</span>
            </div>
            <p className="font-semibold">{currentLocation?.bearing?.toFixed(0) || '--'}°</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
              <MapPin size={14} />
              <span className="text-xs">Accuracy</span>
            </div>
            <p className="font-semibold">{currentLocation?.accuracy?.toFixed(0) || '--'} m</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
              <Clock size={14} />
              <span className="text-xs">Trail</span>
            </div>
            <p className="font-semibold">{trail.length} pts</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleBeep}
            disabled={!device?.is_online}
            className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Bell size={18} />
            <span>Beep Device</span>
          </button>

          {!device?.location_enabled && (
            <button
              onClick={handleRequestLocation}
              disabled={!device?.is_online}
              className="flex-1 btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MapPin size={18} />
              <span>Request Location</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function getMovementColor(status?: string): string {
  switch (status) {
    case 'walking':
      return 'text-emerald-400'
    case 'driving':
      return 'text-amber-400'
    default:
      return 'text-gray-400'
  }
}
