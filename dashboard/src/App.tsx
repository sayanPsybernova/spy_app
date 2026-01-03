import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import DeviceListPage from './pages/DeviceListPage'
import DeviceDetailPage from './pages/DeviceDetailPage'
import LiveTracePage from './pages/LiveTracePage'
import TelemetryPage from './pages/TelemetryPage'
import UserManagementPage from './pages/UserManagementPage'
import Header from './components/Header'
import NotificationToast from './components/NotificationToast'
import { useWebSocket } from './hooks/useWebSocket'
import { API_BASE_URL, WS_URL } from './lib/supabase'

// Types
export interface Device {
  device_id: string
  username: string
  device_name: string
  first_seen: string
  last_seen: string
  is_online: number
  location_enabled: number
}

export interface LocationData {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  speed?: number
  bearing?: number
  movement_status?: string
  timestamp: string
}

export interface TelemetryEvent {
  id: number
  device_id: string
  event_type: string
  app_package?: string
  app_label?: string
  duration_ms?: number
  screen_state?: string
  network_type?: string
  timestamp: string
}

export interface Notification {
  id: string
  type: 'new_user' | 'location' | 'alert'
  title: string
  message: string
  device_id?: string
  username?: string
  device_name?: string
  timestamp: Date
  read: boolean
}

// Context
interface AppContextType {
  devices: Device[]
  setDevices: (devices: Device[]) => void
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  locations: Map<string, LocationData>
  wsConnected: boolean
}

const AppContext = createContext<AppContextType | null>(null)

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}

function App() {
  const [devices, setDevices] = useState<Device[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [locations, setLocations] = useState<Map<string, LocationData>>(new Map())

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false
    }
    setNotifications(prev => [newNotification, ...prev])

    // Play notification sound
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRgAcbT48Nh9IwBLsMn0x3UrAkSvx/K9eCQDS7XQ7rFnFgFOtdXqolEHBmi6xO2nWwwCYbDA7KdTCgNmsMz/oU0CBWixwf+gUQUEY7C+/6JTBAVlsMH/oFEEBGWwwP+hUgQEZbDA/6FRBARlsMD/oVIEBGWwwP+hUQQEZbDA/6FSBARlsMD/oVEEBGWwwP+hUgQEZbDA/6FRBARlsMD/oVIEBGWwwP+hUQ==')
      audio.volume = 0.3
      audio.play().catch(() => {})
    } catch {}

    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/vite.svg'
      })
    }
  }

  const markNotificationRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // WebSocket connection
  const { connected, lastMessage } = useWebSocket(WS_URL)

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return

    const { type, device_id, data } = lastMessage

    switch (type) {
      case 'DEVICE_LIST':
        setDevices(data)
        break

      case 'NEW_USER_REGISTERED':
        // Add new device to list
        if (device_id) {
          setDevices(prev => {
            const exists = prev.find(d => d.device_id === device_id)
            if (exists) return prev
            return [...prev, {
              device_id,
              username: data.username,
              device_name: data.device_name,
              first_seen: data.registered_at,
              last_seen: data.registered_at,
              is_online: 1,
              location_enabled: 0
            }]
          })
        }

        // Show notification
        addNotification({
          type: 'new_user',
          title: 'New Device Registered!',
          message: `${data.username} - ${data.device_name}`,
          device_id,
          username: data.username,
          device_name: data.device_name
        })
        break

      case 'DEVICE_UPDATE':
        setDevices(prev =>
          prev.map(d => d.device_id === device_id ? { ...d, ...data } : d)
        )
        break

      case 'LOCATION_UPDATE':
        if (device_id) {
          setLocations(prev => {
            const newMap = new Map(prev)
            newMap.set(device_id, data)
            return newMap
          })
        }
        break
    }
  }, [lastMessage])

  // Fetch initial devices
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/devices`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setDevices(result.data)
        }
      })
      .catch(console.error)
  }, [])

  return (
    <AppContext.Provider value={{
      devices,
      setDevices,
      notifications,
      addNotification,
      markNotificationRead,
      clearNotifications,
      locations,
      wsConnected: connected
    }}>
      <BrowserRouter>
        <div className="min-h-screen bg-dark-bg">
          <Header />
          <main className="container mx-auto px-4 py-6 max-w-7xl">
            <Routes>
              <Route path="/" element={<DeviceListPage />} />
              <Route path="/users" element={<UserManagementPage />} />
              <Route path="/device/:deviceId" element={<DeviceDetailPage />} />
              <Route path="/device/:deviceId/trace" element={<LiveTracePage />} />
              <Route path="/device/:deviceId/telemetry" element={<TelemetryPage />} />
            </Routes>
          </main>
          <NotificationToast />
        </div>
      </BrowserRouter>
    </AppContext.Provider>
  )
}

export default App
