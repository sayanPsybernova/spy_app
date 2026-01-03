import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, MapPin, BarChart3, Bell, Wifi, WifiOff, Clock, Smartphone, User, Navigation } from 'lucide-react'
import { useApp, Device, LocationData } from '../App'
import { motion } from 'framer-motion'
import { API_BASE_URL } from '../lib/supabase'
import BrowsingHistoryPanel from '../components/BrowsingHistoryPanel'

export default function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const { devices, locations } = useApp()
  const [device, setDevice] = useState<Device | null>(null)
  const [latestLocation, setLatestLocation] = useState<LocationData | null>(null)
  const [isBeeping, setIsBeeping] = useState(false)

  useEffect(() => {
    const found = devices.find(d => d.device_id === deviceId)
    if (found) {
      setDevice(found)
    } else {
      // Fetch from API
      fetch(`${API_BASE_URL}/api/devices/${deviceId}`)
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setDevice(result.data)
            if (result.data.latest_location) {
              setLatestLocation(result.data.latest_location)
            }
          }
        })
        .catch(console.error)
    }
  }, [deviceId, devices])

  useEffect(() => {
    const loc = locations.get(deviceId || '')
    if (loc) {
      setLatestLocation(loc)
    }
  }, [locations, deviceId])

  const handleBeep = async () => {
    if (!deviceId || isBeeping) return

    setIsBeeping(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/beep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const result = await response.json()
      if (!result.success) {
        alert(result.error || 'Failed to send beep')
      }
    } catch (error) {
      console.error('Failed to send beep:', error)
      alert('Failed to connect to server')
    } finally {
      setTimeout(() => setIsBeeping(false), 2000)
    }
  }

  const handleRequestLocation = async () => {
    if (!deviceId) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/request-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const result = await response.json()
      if (result.success) {
        alert('Location request sent to device')
      } else {
        alert(result.error || 'Failed to request location')
      }
    } catch (error) {
      console.error('Failed to request location:', error)
    }
  }

  if (!device) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={20} />
        <span>Back to devices</span>
      </button>

      {/* Device Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-3xl font-bold">
              {device.username.charAt(0).toUpperCase()}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-3 border-dark-card ${device.is_online ? 'bg-emerald-500' : 'bg-gray-500'}`} />
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{device.username}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-gray-400">
              <div className="flex items-center gap-1">
                <Smartphone size={16} />
                <span>{device.device_name}</span>
              </div>
              <div className="flex items-center gap-1">
                {device.is_online ? (
                  <>
                    <Wifi size={16} className="text-emerald-400" />
                    <span className="text-emerald-400">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={16} />
                    <span>Offline</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span>Last seen {formatTime(device.last_seen)}</span>
              </div>
            </div>
          </div>

          {/* Location Status */}
          {latestLocation && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-500/10 rounded-lg text-primary-400">
              <MapPin size={18} />
              <span className="capitalize">{latestLocation.movement_status || 'Located'}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {/* Live Trace Button */}
        <Link
          to={`/device/${deviceId}/trace`}
          className="action-btn group"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <MapPin size={32} className="text-white" />
          </div>
          <h3 className="font-semibold text-lg">Live Trace</h3>
          <p className="text-gray-400 text-sm text-center mt-1">
            Track real-time location on map
          </p>
          {!device.location_enabled && (
            <span className="mt-2 px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">
              Location OFF
            </span>
          )}
        </Link>

        {/* Telemetry Data Button */}
        <Link
          to={`/device/${deviceId}/telemetry`}
          className="action-btn group"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <BarChart3 size={32} className="text-white" />
          </div>
          <h3 className="font-semibold text-lg">Telemetry Data</h3>
          <p className="text-gray-400 text-sm text-center mt-1">
            View app usage & activity
          </p>
        </Link>

        {/* Beep Sound Button */}
        <button
          onClick={handleBeep}
          disabled={isBeeping || !device.is_online}
          className="action-btn group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4 transition-transform ${isBeeping ? 'animate-bounce' : 'group-hover:scale-110'}`}>
            <Bell size={32} className="text-white" />
          </div>
          <h3 className="font-semibold text-lg">Beep Sound</h3>
          <p className="text-gray-400 text-sm text-center mt-1">
            {isBeeping ? 'Beeping...' : 'Make device ring loudly'}
          </p>
          {!device.is_online && (
            <span className="mt-2 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
              Device offline
            </span>
          )}
        </button>
      </motion.div>

      {/* Quick Location Info */}
      {latestLocation ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Navigation size={20} className="text-primary-400" />
            Current Location
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Latitude</p>
              <p className="font-mono">{latestLocation.latitude.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Longitude</p>
              <p className="font-mono">{latestLocation.longitude.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Accuracy</p>
              <p className="font-mono">{latestLocation.accuracy?.toFixed(0) || '-'} m</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Speed</p>
              <p className="font-mono">{latestLocation.speed ? `${(latestLocation.speed * 3.6).toFixed(1)} km/h` : '-'}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              Updated {formatTime(latestLocation.timestamp)}
            </p>
            <Link
              to={`/device/${deviceId}/trace`}
              className="text-primary-400 text-sm hover:underline"
            >
              View on map →
            </Link>
          </div>
        </motion.div>
      ) : device.location_enabled === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 text-center"
        >
          <MapPin size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="font-semibold text-lg mb-2">Location Tracking Off</h3>
          <p className="text-gray-400 mb-4">
            The user has disabled location tracking on their device.
          </p>
          <button
            onClick={handleRequestLocation}
            disabled={!device.is_online}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Request Location Access
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 text-center"
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Waiting for location data...</p>
        </motion.div>
      )}

      {/* Browsing History */}
      {deviceId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <BrowsingHistoryPanel deviceId={deviceId} />
        </motion.div>
      )}
    </div>
  )
}

function formatTime(dateStr: string): string {
  if (!dateStr) return 'Never'

  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}
