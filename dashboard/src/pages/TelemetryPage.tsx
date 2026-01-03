import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, Smartphone, Clock, Activity, BarChart3, PieChart } from 'lucide-react'
import { useApp, Device, TelemetryEvent } from '../App'
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { motion } from 'framer-motion'
import { API_BASE_URL } from '../lib/supabase'

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6']

export default function TelemetryPage() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const { devices } = useApp()

  const [device, setDevice] = useState<Device | null>(null)
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const found = devices.find(d => d.device_id === deviceId)
    if (found) setDevice(found)
  }, [deviceId, devices])

  useEffect(() => {
    if (!deviceId) return

    // Fetch telemetry
    fetch(`${API_BASE_URL}/api/devices/${deviceId}/telemetry?limit=100`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setTelemetry(result.data)
        }
      })
      .catch(console.error)

    // Fetch stats
    fetch(`${API_BASE_URL}/api/telemetry/stats/${deviceId}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setStats(result.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [deviceId])

  // Current app from recent telemetry
  const currentApp = telemetry.find(t => t.event_type === 'APP_FOREGROUND')

  // Pie chart data
  const pieData = stats?.top_apps?.slice(0, 5).map((app: any, index: number) => ({
    name: app.app,
    value: app.duration,
    color: COLORS[index]
  })) || []

  // Bar chart data (last 24 hours by hour)
  const barData = generateHourlyData(telemetry)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Telemetry Data</h1>
          <p className="text-gray-400">{device?.username} - {device?.device_name}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Clock size={18} />
                <span className="text-sm">Total Time</span>
              </div>
              <p className="text-2xl font-bold">
                {formatDuration(stats?.total_duration_ms || 0)}
              </p>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Activity size={18} />
                <span className="text-sm">App Switches</span>
              </div>
              <p className="text-2xl font-bold">
                {stats?.app_switches || 0}
              </p>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Smartphone size={18} />
                <span className="text-sm">Apps Used</span>
              </div>
              <p className="text-2xl font-bold">
                {stats?.top_apps?.length || 0}
              </p>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <BarChart3 size={18} />
                <span className="text-sm">Events</span>
              </div>
              <p className="text-2xl font-bold">
                {stats?.event_count || 0}
              </p>
            </div>
          </motion.div>

          {/* Current App */}
          {currentApp && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <h3 className="font-semibold text-lg mb-4">Current App</h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-2xl">
                  📱
                </div>
                <div>
                  <p className="text-xl font-semibold">{currentApp.app_label || 'Unknown'}</p>
                  <p className="text-gray-400 text-sm">{currentApp.app_package}</p>
                  {currentApp.duration_ms && (
                    <p className="text-primary-400 text-sm mt-1">
                      Active for {formatDuration(currentApp.duration_ms)}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* App Usage Pie Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6"
            >
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <PieChart size={20} className="text-primary-400" />
                App Usage Breakdown
              </h3>

              {pieData.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-48 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie data={pieData}>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex-1 space-y-2">
                    {pieData.map((app: any, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: app.color }} />
                          <span className="text-sm truncate max-w-32">{app.name}</span>
                        </div>
                        <span className="text-sm text-gray-400">{formatDuration(app.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">
                  No app usage data
                </div>
              )}
            </motion.div>

            {/* Activity Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6"
            >
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-emerald-400" />
                Activity Timeline
              </h3>

              {barData.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <XAxis
                        dataKey="hour"
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                        axisLine={{ stroke: '#374151' }}
                      />
                      <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                        axisLine={{ stroke: '#374151' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a2e',
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="events" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">
                  No activity data
                </div>
              )}
            </motion.div>
          </div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-6"
          >
            <h3 className="font-semibold text-lg mb-4">Recent Activity</h3>

            {telemetry.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {telemetry.slice(0, 50).map((event, index) => (
                  <div
                    key={event.id || index}
                    className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getEventColor(event.event_type)}`}>
                      {getEventIcon(event.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {event.app_label || event.event_type}
                      </p>
                      <p className="text-gray-400 text-sm truncate">
                        {event.app_package || 'System event'}
                      </p>
                    </div>
                    <div className="text-right">
                      {event.duration_ms && (
                        <p className="text-primary-400 text-sm">
                          {formatDuration(event.duration_ms)}
                        </p>
                      )}
                      <p className="text-gray-500 text-xs">
                        {formatTime(event.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Activity size={48} className="mx-auto mb-4 opacity-50" />
                <p>No telemetry data yet</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getEventColor(eventType: string): string {
  switch (eventType) {
    case 'APP_FOREGROUND':
      return 'bg-primary-500/20 text-primary-400'
    case 'APP_BACKGROUND':
      return 'bg-gray-500/20 text-gray-400'
    case 'SESSION_START':
      return 'bg-emerald-500/20 text-emerald-400'
    case 'SESSION_END':
      return 'bg-amber-500/20 text-amber-400'
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
}

function getEventIcon(eventType: string): string {
  switch (eventType) {
    case 'APP_FOREGROUND':
      return '📱'
    case 'APP_BACKGROUND':
      return '🔙'
    case 'SESSION_START':
      return '▶️'
    case 'SESSION_END':
      return '⏹️'
    default:
      return '📊'
  }
}

function generateHourlyData(telemetry: TelemetryEvent[]): { hour: string; events: number }[] {
  const hourCounts: { [key: string]: number } = {}

  // Initialize last 24 hours
  for (let i = 23; i >= 0; i--) {
    const hour = new Date()
    hour.setHours(hour.getHours() - i)
    const key = hour.getHours().toString().padStart(2, '0')
    hourCounts[key] = 0
  }

  // Count events per hour
  telemetry.forEach(event => {
    if (!event.timestamp) return
    const date = new Date(event.timestamp)
    const key = date.getHours().toString().padStart(2, '0')
    if (hourCounts[key] !== undefined) {
      hourCounts[key]++
    }
  })

  return Object.entries(hourCounts).map(([hour, events]) => ({
    hour: `${hour}:00`,
    events
  }))
}
