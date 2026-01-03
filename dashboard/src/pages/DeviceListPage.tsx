import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Grid, List, MapPin, Bell, Clock, Smartphone } from 'lucide-react'
import { useApp } from '../App'
import { motion } from 'framer-motion'
import { API_BASE_URL } from '../lib/supabase'

export default function DeviceListPage() {
  const { devices, locations } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filteredDevices = devices.filter(device =>
    (device.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (device.device_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const onlineDevices = filteredDevices.filter(d => d.is_online)
  const offlineDevices = filteredDevices.filter(d => !d.is_online)

  const handleBeep = async (deviceId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/beep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const result = await response.json()
      if (result.success) {
        // Show success feedback
      }
    } catch (error) {
      console.error('Failed to send beep:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="text-gray-400 text-sm mt-1">
            {onlineDevices.length} online · {offlineDevices.length} offline
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 bg-dark-card border border-gray-800 rounded-lg focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-dark-card border border-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Device Grid/List */}
      {filteredDevices.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Smartphone size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-xl font-semibold mb-2">No devices found</h3>
          <p className="text-gray-400">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Install the mobile app to start tracking devices'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device, index) => (
            <DeviceCard
              key={device.device_id}
              device={device}
              location={locations.get(device.device_id)}
              index={index}
              onBeep={handleBeep}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDevices.map((device, index) => (
            <DeviceListItem
              key={device.device_id}
              device={device}
              location={locations.get(device.device_id)}
              index={index}
              onBeep={handleBeep}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface DeviceCardProps {
  device: {
    device_id: string
    username: string
    device_name: string
    is_online: number
    last_seen: string
    location_enabled: number
  }
  location?: {
    latitude: number
    longitude: number
    movement_status?: string
    timestamp: string
  }
  index: number
  onBeep: (deviceId: string, e: React.MouseEvent) => void
}

function DeviceCard({ device, location, index, onBeep }: DeviceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/device/${device.device_id}`}>
        <div className="glass-card p-5 hover:border-primary-500/50 transition-all group">
          <div className="flex items-start justify-between mb-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-xl font-bold">
                {(device.username || '?').charAt(0).toUpperCase()}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-dark-card ${device.is_online ? 'bg-emerald-500' : 'bg-gray-500'}`} />
            </div>

            {/* Beep Button */}
            <button
              onClick={(e) => onBeep(device.device_id, e)}
              className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors opacity-0 group-hover:opacity-100"
              title="Beep Device"
            >
              <Bell size={18} />
            </button>
          </div>

          {/* Info */}
          <h3 className="font-semibold text-lg truncate">{device.username}</h3>
          <p className="text-gray-400 text-sm truncate flex items-center gap-1">
            <Smartphone size={14} />
            {device.device_name}
          </p>

          {/* Status */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${device.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className={`text-sm ${device.is_online ? 'text-emerald-400' : 'text-gray-500'}`}>
                {device.is_online ? 'Online' : 'Offline'}
              </span>
            </div>

            {location && device.location_enabled ? (
              <div className="flex items-center gap-1 text-sm text-primary-400">
                <MapPin size={14} />
                <span>{location.movement_status || 'Located'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Clock size={14} />
                <span>{formatLastSeen(device.last_seen)}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function DeviceListItem({ device, location, index, onBeep }: DeviceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link to={`/device/${device.device_id}`}>
        <div className="glass-card p-4 hover:border-primary-500/50 transition-all group flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-lg font-bold">
              {(device.username || '?').charAt(0).toUpperCase()}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-dark-card ${device.is_online ? 'bg-emerald-500' : 'bg-gray-500'}`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{device.username}</h3>
            <p className="text-gray-400 text-sm truncate">{device.device_name}</p>
          </div>

          {/* Status */}
          <div className="flex items-center gap-4">
            {location && device.location_enabled && (
              <div className="hidden sm:flex items-center gap-1 text-sm text-primary-400">
                <MapPin size={14} />
                <span>{location.movement_status || 'Located'}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${device.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className={`text-sm ${device.is_online ? 'text-emerald-400' : 'text-gray-500'}`}>
                {device.is_online ? 'Online' : formatLastSeen(device.last_seen)}
              </span>
            </div>

            {/* Beep Button */}
            <button
              onClick={(e) => onBeep(device.device_id, e)}
              className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors opacity-0 group-hover:opacity-100"
              title="Beep Device"
            >
              <Bell size={18} />
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function formatLastSeen(dateStr: string): string {
  if (!dateStr) return 'Never'

  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}
