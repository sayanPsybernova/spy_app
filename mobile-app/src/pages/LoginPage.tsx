import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { User, Key, ArrowRight, Loader2, Eye, EyeOff, UserPlus } from 'lucide-react'
import { useAppContext } from '../App'
import { v4 as uuidv4 } from 'uuid'
import { motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'

export default function LoginPage() {
  const { setUserData, setIsAuthenticated, serverUrl } = useAppContext()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [deviceId] = useState(() => uuidv4())

  // Auto-detect device name on mount
  useEffect(() => {
    const detectDevice = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
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
        setDeviceName('Web Browser')
      }
    }
    detectDevice()
  }, [])

  const handleLogin = async () => {
    if (!userId.trim() || !password.trim()) {
      setError('Please enter your ID and password')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId.trim(),
          password: password,
          device_id: deviceId,
          device_name: deviceName
        })
      })

      const result = await response.json()

      if (result.success) {
        setUserData({
          device_id: deviceId,
          username: result.data.username,
          device_name: deviceName,
          user_id: result.data.user_id,
          profile_image_url: result.data.profile_image_url
        })
        setIsAuthenticated(true)
      } else {
        setError(result.error || 'Login failed. Please check your credentials.')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Cannot connect. Please check your internet connection.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg safe-top safe-bottom">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 pt-16 pb-8 px-8 text-center"
      >
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-xl shadow-primary-500/30">
          <User size={48} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-3">Welcome Back</h1>
        <p className="text-gray-400 text-lg">Sign in to continue</p>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 px-8"
      >
        {/* User ID Input */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Your ID</label>
          <div className="relative">
            <User size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your ID"
              className="w-full text-lg py-4 pl-12 pr-4 bg-dark-card border-2 border-gray-700 focus:border-primary-500 rounded-2xl outline-none transition-colors placeholder:text-gray-600"
              autoComplete="username"
              autoFocus
            />
          </div>
        </div>

        {/* Password Input */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Password</label>
          <div className="relative">
            <Key size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full text-lg py-4 pl-12 pr-14 bg-dark-card border-2 border-gray-700 focus:border-primary-500 rounded-2xl outline-none transition-colors placeholder:text-gray-600"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-white"
            >
              {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-2xl text-red-400 text-center text-lg"
          >
            {error}
          </motion.div>
        )}

        {/* Request Access Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-4"
        >
          <p className="text-gray-500 mb-2">Don't have an account?</p>
          <Link
            to="/request-access"
            className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 text-lg"
          >
            <UserPlus size={20} />
            Request Access
          </Link>
        </motion.div>
      </motion.div>

      {/* Login Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex-shrink-0 p-8"
      >
        <button
          onClick={handleLogin}
          disabled={isLoading || !userId.trim() || !password.trim()}
          className="w-full py-6 bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white text-xl font-semibold rounded-2xl shadow-lg shadow-primary-500/30 disabled:shadow-none transition-all flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <Loader2 size={28} className="animate-spin" />
              <span>Signing In...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight size={28} />
            </>
          )}
        </button>
      </motion.div>
    </div>
  )
}
