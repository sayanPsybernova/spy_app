import { useState, useEffect } from 'react'
import { User, ArrowRight, Loader2 } from 'lucide-react'
import { useAppContext } from '../App'
import { v4 as uuidv4 } from 'uuid'
import { motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'

export default function RegistrationPage() {
  const { setUserData, serverUrl } = useAppContext()
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deviceName, setDeviceName] = useState('')

  // Auto-detect device name on mount
  useEffect(() => {
    const detectDevice = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Try to get device info from Capacitor
          const { Device } = await import('@capacitor/device')
          const info = await Device.getInfo()
          const name = info.manufacturer && info.model
            ? `${info.manufacturer} ${info.model}`
            : info.model || 'Android Phone'
          setDeviceName(name)
        } catch {
          setDeviceName('Android Phone')
        }
      } else {
        // Web fallback
        setDeviceName('Web Browser')
      }
    }
    detectDevice()
  }, [])

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError('Please enter your name')
      return
    }

    setIsLoading(true)
    setError('')

    const device_id = uuidv4()
    const finalDeviceName = deviceName || 'Android Phone'

    try {
      // Register with backend
      const response = await fetch(`${serverUrl}/api/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_id,
          username: username.trim(),
          device_name: finalDeviceName
        })
      })

      const result = await response.json()

      if (result.success) {
        setUserData({
          device_id,
          username: username.trim(),
          device_name: finalDeviceName
        })
      } else {
        setError(result.error || 'Registration failed')
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError('Cannot connect. Please ask your helper for assistance.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg safe-top safe-bottom">
      {/* Header - Simplified */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 pt-16 pb-8 px-8 text-center"
      >
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-xl shadow-primary-500/30">
          <User size={48} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-3">What's Your Name?</h1>
        <p className="text-gray-400 text-lg">So your family knows it's you</p>
      </motion.div>

      {/* Simple Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 px-8"
      >
        {/* Large, simple input */}
        <div className="mb-6">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Type your name here"
            className="w-full text-center text-2xl py-5 px-6 bg-dark-card border-2 border-gray-700 focus:border-primary-500 rounded-2xl outline-none transition-colors placeholder:text-gray-600"
            autoComplete="name"
            autoFocus
          />
        </div>

        {/* Device auto-detected info */}
        {deviceName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-gray-500 text-sm mb-6"
          >
            Device: {deviceName}
          </motion.div>
        )}

        {/* Error message - Simplified */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-5 bg-red-500/10 border-2 border-red-500/30 rounded-2xl text-red-400 text-center text-lg"
          >
            {error}
          </motion.div>
        )}
      </motion.div>

      {/* Large Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex-shrink-0 p-8"
      >
        <button
          onClick={handleSubmit}
          disabled={isLoading || !username.trim()}
          className="w-full py-6 bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white text-xl font-semibold rounded-2xl shadow-lg shadow-primary-500/30 disabled:shadow-none transition-all flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <Loader2 size={28} className="animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <span>Get Started</span>
              <ArrowRight size={28} />
            </>
          )}
        </button>
      </motion.div>
    </div>
  )
}
