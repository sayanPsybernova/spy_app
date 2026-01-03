import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Smartphone, MapPin, Users, Bell, LogOut,
  Wifi, WifiOff, Volume2, Loader2, RefreshCw,
  Trash2, Check, X, Clock
} from 'lucide-react'
import { useAppContext } from '../App'
import { motion } from 'framer-motion'

interface Device {
  id: string
  device_id: string
  device_name: string
  username: string
  user_id: string
  is_online: boolean
  last_seen: string
  location_enabled: boolean
  last_location?: {
    latitude: number
    longitude: number
    timestamp: string
  }
}

interface UserData {
  id: string
  user_id: string
  username: string
  profile_image_url: string | null
  status: string
  created_at: string
  device_count: number
}

interface AccessRequest {
  id: string
  username: string
  device_name: string
  status: string
  created_at: string
}

type TabType = 'devices' | 'map' | 'users' | 'requests'

export default function MobileAdminDashboard() {
  const { logout, wsUrl, serverUrl } = useAppContext()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('devices')
  const [devices, setDevices] = useState<Device[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [beepingDevice, setBeepingDevice] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Admin auth header
  const getAdminAuthHeader = () => {
    const credentials = btoa('pradhansayan2@gmail.com:Sayan@0306')
    return `Basic ${credentials}`
  }

  // Fetch devices
  const fetchDevices = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/devices`, {
        headers: { 'Authorization': getAdminAuthHeader() }
      })
      const result = await response.json()
      if (result.success) {
        setDevices(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching devices:', error)
    }
  }

  // Fetch users
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/admin/users`, {
        headers: { 'Authorization': getAdminAuthHeader() }
      })
      const result = await response.json()
      if (result.success) {
        setUsers(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  // Fetch access requests
  const fetchRequests = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/admin/access-requests?status=pending`, {
        headers: { 'Authorization': getAdminAuthHeader() }
      })
      const result = await response.json()
      if (result.success) {
        setRequests(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    }
  }

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchDevices(), fetchUsers(), fetchRequests()])
      setLoading(false)
    }
    loadData()
  }, [])

  // WebSocket connection
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'REGISTER',
            client_type: 'DASHBOARD'
          }))
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            handleWsMessage(message)
          } catch (e) {
            console.error('WS parse error:', e)
          }
        }

        ws.onclose = () => {
          setTimeout(connect, 5000)
        }
      } catch (error) {
        console.error('WebSocket error:', error)
        setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      wsRef.current?.close()
    }
  }, [wsUrl])

  const handleWsMessage = (message: any) => {
    switch (message.type) {
      case 'DEVICE_ONLINE':
      case 'DEVICE_OFFLINE':
      case 'LOCATION_UPDATE':
        fetchDevices()
        break
      case 'USER_CREATED':
      case 'USER_DELETED':
        fetchUsers()
        break
      case 'NEW_ACCESS_REQUEST':
      case 'ACCESS_REQUEST_APPROVED':
      case 'ACCESS_REQUEST_REJECTED':
        fetchRequests()
        break
    }
  }

  // Beep device
  const handleBeep = async (deviceId: string) => {
    setBeepingDevice(deviceId)
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'BEEP_DEVICE',
          device_id: deviceId
        }))
      }
    } catch (error) {
      console.error('Beep error:', error)
    }
    setTimeout(() => setBeepingDevice(null), 2000)
  }

  // Delete user
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Delete this user?')) return
    try {
      const response = await fetch(`${serverUrl}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': getAdminAuthHeader() }
      })
      if (response.ok) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  // Approve request
  const handleApprove = async (request: AccessRequest) => {
    const userId = prompt('Enter User ID for this user:')
    if (!userId) return
    const password = prompt('Enter password:')
    if (!password) return

    try {
      const response = await fetch(`${serverUrl}/api/admin/access-requests/${request.id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': getAdminAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          username: request.username,
          password
        })
      })
      if (response.ok) {
        fetchRequests()
        fetchUsers()
      }
    } catch (error) {
      console.error('Approve error:', error)
    }
  }

  // Reject request
  const handleReject = async (requestId: string) => {
    try {
      const response = await fetch(`${serverUrl}/api/admin/access-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': getAdminAuthHeader() }
      })
      if (response.ok) {
        fetchRequests()
      }
    } catch (error) {
      console.error('Reject error:', error)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const tabs = [
    { id: 'devices', label: 'Devices', icon: Smartphone, count: devices.length },
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'users', label: 'Users', icon: Users, count: users.length },
    { id: 'requests', label: 'Requests', icon: Bell, count: requests.length }
  ]

  return (
    <div className="h-full flex flex-col bg-dark-bg safe-top safe-bottom">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchDevices(); fetchUsers(); fetchRequests() }}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700"
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={40} className="animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Devices Tab */}
            {activeTab === 'devices' && (
              <div className="space-y-3">
                {devices.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    No devices connected
                  </div>
                ) : (
                  devices.map(device => (
                    <motion.div
                      key={device.device_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-dark-card rounded-2xl p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            device.is_online
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-gray-700 text-gray-500'
                          }`}>
                            {device.is_online ? <Wifi size={24} /> : <WifiOff size={24} />}
                          </div>
                          <div>
                            <h3 className="font-semibold">{device.username || 'Unknown'}</h3>
                            <p className="text-sm text-gray-500">{device.device_name}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleBeep(device.device_id)}
                          disabled={!device.is_online || beepingDevice === device.device_id}
                          className={`p-3 rounded-xl transition-all ${
                            device.is_online
                              ? 'bg-primary-500 hover:bg-primary-600 text-white'
                              : 'bg-gray-700 text-gray-500'
                          }`}
                        >
                          {beepingDevice === device.device_id ? (
                            <Loader2 size={20} className="animate-spin" />
                          ) : (
                            <Volume2 size={20} />
                          )}
                        </button>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between text-sm">
                        <span className={device.is_online ? 'text-emerald-400' : 'text-gray-500'}>
                          {device.is_online ? 'Online' : `Last seen ${formatTime(device.last_seen)}`}
                        </span>
                        {device.last_location && (
                          <span className="text-gray-500">
                            {device.last_location.latitude.toFixed(4)}, {device.last_location.longitude.toFixed(4)}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {/* Map Tab */}
            {activeTab === 'map' && (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <MapPin size={48} className="mb-4 opacity-50" />
                <p>Map view available in web dashboard</p>
                <a
                  href="https://spyapp0306.netlify.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-xl"
                >
                  Open Web Dashboard
                </a>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-3">
                {users.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    No users created yet
                  </div>
                ) : (
                  users.map(user => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-dark-card rounded-2xl p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {user.profile_image_url ? (
                            <img
                              src={user.profile_image_url}
                              alt={user.username}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-lg font-bold">
                              {(user.username || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold">{user.username}</h3>
                            <p className="text-sm text-gray-500">ID: {user.user_id}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between text-sm text-gray-500">
                        <span>{user.device_count} device(s)</span>
                        <span className={user.status === 'active' ? 'text-emerald-400' : 'text-yellow-400'}>
                          {user.status}
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div className="space-y-3">
                {requests.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    No pending requests
                  </div>
                ) : (
                  requests.map(request => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-dark-card rounded-2xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <Clock size={24} className="text-yellow-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{request.username}</h3>
                            <p className="text-sm text-gray-500">{request.device_name}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(request)}
                          className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center gap-2"
                        >
                          <Check size={18} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl flex items-center justify-center gap-2"
                        >
                          <X size={18} />
                          Reject
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="flex-shrink-0 border-t border-gray-800 bg-dark-card">
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors relative ${
                activeTab === tab.id
                  ? 'text-primary-400'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              <tab.icon size={22} />
              <span className="text-xs">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="absolute top-2 right-1/4 w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
