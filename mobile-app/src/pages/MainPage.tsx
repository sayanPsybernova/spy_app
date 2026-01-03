import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Settings, Wifi, WifiOff, CheckCircle, XCircle, Pause, Play, X, LogOut, ChevronDown } from 'lucide-react'
import { useAppContext } from '../App'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelemetry } from '../hooks/useTelemetry'

export default function MainPage() {
  const {
    userData,
    isTracking,
    setIsTracking,
    locationEnabled,
    wsUrl,
    serverUrl
  } = useAppContext()

  const [wsConnected, setWsConnected] = useState(false)
  const [showPauseConfirm, setShowPauseConfirm] = useState(false)
  const [currentApp, setCurrentApp] = useState<{ packageName: string; appLabel: string } | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  // Initialize telemetry tracking (location + app usage)
  const { triggerBeep: nativeBeep, isNative } = useTelemetry({
    deviceId: userData?.device_id || '',
    wsUrl,
    serverUrl,
    isTracking,
    locationEnabled,
    onLocationUpdate: (location) => {
      console.log('Location update:', location.latitude, location.longitude)
    },
    onAppUpdate: (app) => {
      setCurrentApp(app)
    }
  })

  // WebSocket connection
  useEffect(() => {
    if (!userData) return
    const deviceId = userData.device_id

    function connect() {
      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          setWsConnected(true)
          ws.send(JSON.stringify({
            type: 'REGISTER',
            client_type: 'DEVICE',
            device_id: deviceId
          }))
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            handleServerMessage(message)
          } catch (e) {
            console.error('Error parsing message:', e)
          }
        }

        ws.onclose = () => {
          setWsConnected(false)
          reconnectTimeoutRef.current = setTimeout(connect, 5000)
        }

        ws.onerror = () => {
          setWsConnected(false)
        }
      } catch (error) {
        console.error('WebSocket connection error:', error)
        reconnectTimeoutRef.current = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [userData, wsUrl])

  function handleServerMessage(message: any) {
    switch (message.type) {
      case 'BEEP_DEVICE':
        triggerBeep()
        break
      case 'REQUEST_LOCATION_ON':
        alert(message.message || 'Your family is asking for your location')
        break
      case 'HEARTBEAT_ACK':
        break
    }
  }

  function triggerBeep() {
    // Use native beep if available (Android)
    if (isNative) {
      nativeBeep(5000)
    } else {
      // Web fallback
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = context.createOscillator()
        const gain = context.createGain()

        oscillator.connect(gain)
        gain.connect(context.destination)

        oscillator.frequency.value = 880
        oscillator.type = 'sine'
        gain.gain.value = 0.5

        oscillator.start()
        setTimeout(() => {
          oscillator.stop()
          context.close()
        }, 3000)
      } catch (e) {
        console.error('Audio not available:', e)
      }

      if ('vibrate' in navigator) {
        navigator.vibrate([500, 200, 500, 200, 500])
      }
    }

    alert('Your family is looking for you!')
  }

  // Send heartbeat
  useEffect(() => {
    if (!wsConnected || !userData) return
    const deviceId = userData.device_id

    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'HEARTBEAT',
          device_id: deviceId
        }))
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [wsConnected, userData])

  // Handle pause button click
  const handlePauseClick = () => {
    if (isTracking) {
      setShowPauseConfirm(true)
    } else {
      setIsTracking(true)
    }
  }

  // Confirm pause
  const confirmPause = () => {
    setIsTracking(false)
    setShowPauseConfirm(false)
  }

  // Get status info
  const isConnectedAndTracking = wsConnected && isTracking && locationEnabled
  const statusMessage = isConnectedAndTracking
    ? "Your family can see you're safe"
    : !wsConnected
    ? "Trying to connect..."
    : !isTracking
    ? "Location sharing is paused"
    : "Location is disabled"

  return (
    <div className="h-full flex flex-col bg-dark-bg safe-top safe-bottom">
      {/* Simple Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-xl font-bold">
            {userData?.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{userData?.username}</h1>
            <div className="flex items-center gap-2 text-sm">
              {wsConnected ? (
                <>
                  <Wifi size={16} className="text-emerald-400" />
                  <span className="text-emerald-400">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff size={16} className="text-red-400" />
                  <span className="text-red-400">Reconnecting...</span>
                </>
              )}
            </div>
          </div>
        </div>

        <Link to="/settings" className="p-4 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-colors">
          <Settings size={26} />
        </Link>
      </div>

      {/* Main Status - Large and Simple */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`w-40 h-40 rounded-full flex items-center justify-center mb-8 ${
            isConnectedAndTracking
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/30'
              : isTracking
              ? 'bg-gradient-to-br from-yellow-500 to-orange-600 shadow-2xl shadow-yellow-500/30'
              : 'bg-gradient-to-br from-gray-600 to-gray-700'
          }`}
        >
          {isConnectedAndTracking ? (
            <CheckCircle size={80} className="text-white" />
          ) : isTracking ? (
            <Wifi size={80} className="text-white animate-pulse" />
          ) : (
            <XCircle size={80} className="text-white" />
          )}
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`text-3xl font-bold mb-4 text-center ${
            isConnectedAndTracking
              ? 'text-emerald-400'
              : isTracking
              ? 'text-yellow-400'
              : 'text-gray-400'
          }`}
        >
          {isConnectedAndTracking
            ? "You're Connected"
            : isTracking
            ? "Connecting..."
            : "Sharing Paused"}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-gray-400 text-xl text-center mb-8"
        >
          {statusMessage}
        </motion.p>

        {/* Large Toggle Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={handlePauseClick}
          className={`w-24 h-24 rounded-3xl flex items-center justify-center transition-all active:scale-95 ${
            isTracking
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30'
          }`}
        >
          {isTracking ? (
            <Pause size={48} className="text-white" />
          ) : (
            <Play size={48} className="text-white ml-1" />
          )}
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-500 text-sm mt-4"
        >
          {isTracking ? "Tap to pause sharing" : "Tap to resume sharing"}
        </motion.p>
      </div>

      {/* Pause Confirmation Modal */}
      <AnimatePresence>
        {showPauseConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
            onClick={() => setShowPauseConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-card rounded-3xl p-8 max-w-sm w-full"
            >
              <button
                onClick={() => setShowPauseConfirm(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>

              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Pause size={40} className="text-yellow-400" />
                </div>

                <h3 className="text-2xl font-bold mb-4">Stop Sharing?</h3>

                <p className="text-gray-400 text-lg mb-8">
                  Your family won't be able to see where you are.
                </p>

                <div className="space-y-4">
                  <button
                    onClick={() => setShowPauseConfirm(false)}
                    className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xl font-semibold rounded-2xl"
                  >
                    Keep Sharing
                  </button>

                  <button
                    onClick={confirmPause}
                    className="w-full py-4 text-gray-400 hover:text-white text-lg transition-colors"
                  >
                    Stop Sharing
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
