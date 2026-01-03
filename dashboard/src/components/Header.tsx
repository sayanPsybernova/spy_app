import { Link, useLocation } from 'react-router-dom'
import { Bell, Wifi, WifiOff, X, Users, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../App'
import { useNavigate } from 'react-router-dom'

export default function Header() {
  const { notifications, markNotificationRead, clearNotifications, wsConnected, devices } = useApp()
  const [showNotifications, setShowNotifications] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const unreadCount = notifications.filter(n => !n.read).length
  const onlineCount = devices.filter(d => d.is_online).length

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    markNotificationRead(notification.id)
    if (notification.device_id) {
      navigate(`/device/${notification.device_id}`)
      setShowNotifications(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 glass-card border-b border-gray-800/50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
              <span className="text-xl">📡</span>
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
                Telemetry
              </h1>
              <p className="text-xs text-gray-500">Dashboard</p>
            </div>
          </Link>

          {/* Navigation */}
          <div className="hidden sm:flex items-center gap-2">
            <Link
              to="/"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                location.pathname === '/' || location.pathname.startsWith('/device')
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'hover:bg-gray-800 text-gray-400'
              }`}
            >
              <Smartphone size={18} />
              <span>Devices</span>
              <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full">{devices.length}</span>
            </Link>
            <Link
              to="/users"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                location.pathname === '/users'
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'hover:bg-gray-800 text-gray-400'
              }`}
            >
              <Users size={18} />
              <span>Users</span>
            </Link>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${onlineCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm text-gray-400">
                <span className="font-semibold text-white">{onlineCount}</span> online
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${wsConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {wsConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span className="text-xs font-medium hidden sm:inline">
                {wsConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 glass-card shadow-2xl border border-gray-700 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="font-semibold">Notifications</h3>
                    {notifications.length > 0 && (
                      <button
                        onClick={clearNotifications}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <Bell size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No notifications</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map(notification => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800/50 transition-colors ${!notification.read ? 'bg-primary-500/5' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${notification.type === 'new_user' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary-500/20 text-primary-400'}`}>
                              {notification.type === 'new_user' ? '🆕' : '📍'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{notification.title}</p>
                              <p className="text-gray-400 text-sm truncate">{notification.message}</p>
                              <p className="text-gray-500 text-xs mt-1">
                                {formatTime(notification.timestamp)}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-primary-500 mt-2" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}
