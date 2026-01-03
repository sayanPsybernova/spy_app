import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { User, ArrowLeft, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useAppContext } from '../App'
import { motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

type RequestStatus = 'form' | 'pending' | 'approved' | 'rejected'

export default function RequestAccessPage() {
  const { serverUrl } = useAppContext()
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [deviceIdentifier, setDeviceIdentifier] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [status, setStatus] = useState<RequestStatus>('form')

  // Auto-detect device info on mount
  useEffect(() => {
    const detectDevice = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const { Device } = await import('@capacitor/device')
          const info = await Device.getInfo()
          const id = await Device.getId()
          const name = info.manufacturer && info.model
            ? `${info.manufacturer} ${info.model}`
            : info.model || 'Android Phone'
          setDeviceName(name)
          setDeviceIdentifier(id.identifier || '')
        } catch {
          setDeviceName('Android Phone')
        }
      } else {
        setDeviceName('Web Browser')
      }
    }
    detectDevice()
  }, [])

  // Load saved request ID on mount
  useEffect(() => {
    async function loadRequestId() {
      const { value } = await Preferences.get({ key: 'pending_request_id' })
      if (value) {
        setRequestId(value)
        setStatus('pending')
        checkRequestStatus(value)
      }
    }
    loadRequestId()
  }, [])

  // Check request status periodically
  const checkRequestStatus = async (id: string) => {
    try {
      const response = await fetch(`${serverUrl}/api/auth/check-request/${id}`)
      const result = await response.json()

      if (result.success) {
        if (result.data.status === 'approved') {
          setStatus('approved')
          await Preferences.remove({ key: 'pending_request_id' })
        } else if (result.data.status === 'rejected') {
          setStatus('rejected')
          await Preferences.remove({ key: 'pending_request_id' })
        }
      }
    } catch (err) {
      console.error('Error checking request status:', err)
    }
  }

  // Poll for status updates
  useEffect(() => {
    if (status !== 'pending' || !requestId) return

    const interval = setInterval(() => {
      checkRequestStatus(requestId)
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [status, requestId])

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError('Please enter your name')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${serverUrl}/api/auth/request-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username.trim(),
          device_name: deviceName,
          device_identifier: deviceIdentifier
        })
      })

      const result = await response.json()

      if (result.success) {
        setRequestId(result.request_id)
        setStatus('pending')
        await Preferences.set({ key: 'pending_request_id', value: result.request_id })
      } else {
        setError(result.error || 'Failed to submit request')
      }
    } catch (err) {
      console.error('Request error:', err)
      setError('Cannot connect. Please check your internet connection.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = async () => {
    await Preferences.remove({ key: 'pending_request_id' })
    setStatus('form')
    setRequestId(null)
    setUsername('')
  }

  // Pending status screen
  if (status === 'pending') {
    return (
      <div className="h-full flex flex-col bg-dark-bg safe-top safe-bottom">
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-32 h-32 mb-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center"
          >
            <Clock size={64} className="text-white" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold mb-4"
          >
            Request Sent!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-xl mb-8"
          >
            Waiting for approval from your family member
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3 text-yellow-400"
          >
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
            <span>Checking status...</span>
          </motion.div>
        </div>

        <div className="p-8">
          <Link
            to="/login"
            className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white text-lg font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft size={20} />
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  // Approved status screen
  if (status === 'approved') {
    return (
      <div className="h-full flex flex-col bg-dark-bg safe-top safe-bottom">
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-32 h-32 mb-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center"
          >
            <CheckCircle size={64} className="text-white" />
          </motion.div>

          <h1 className="text-3xl font-bold mb-4 text-emerald-400">Request Approved!</h1>
          <p className="text-gray-400 text-xl mb-8">
            Your account is ready. Go back to login with your new credentials.
          </p>
        </div>

        <div className="p-8">
          <Link
            to="/login"
            className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xl font-semibold rounded-2xl flex items-center justify-center gap-2"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  // Rejected status screen
  if (status === 'rejected') {
    return (
      <div className="h-full flex flex-col bg-dark-bg safe-top safe-bottom">
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-32 h-32 mb-8 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center"
          >
            <XCircle size={64} className="text-white" />
          </motion.div>

          <h1 className="text-3xl font-bold mb-4 text-red-400">Request Declined</h1>
          <p className="text-gray-400 text-xl mb-8">
            Your access request was not approved. Please contact your family member.
          </p>
        </div>

        <div className="p-8">
          <button
            onClick={handleRetry}
            className="w-full py-5 bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold rounded-2xl"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Request form
  return (
    <div className="h-full flex flex-col bg-dark-bg safe-top safe-bottom">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 pt-8 px-8"
      >
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft size={20} />
          Back to Login
        </Link>

        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
            <User size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Request Access</h1>
          <p className="text-gray-400">Ask your family member for permission</p>
        </div>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 px-8 py-8"
      >
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Your Name</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="What should we call you?"
            className="w-full text-xl py-5 px-6 bg-dark-card border-2 border-gray-700 focus:border-primary-500 rounded-2xl outline-none transition-colors placeholder:text-gray-600"
            autoFocus
          />
        </div>

        {deviceName && (
          <div className="text-center text-gray-500 text-sm mb-6">
            Device: {deviceName}
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-2xl text-red-400 text-center text-lg"
          >
            {error}
          </motion.div>
        )}
      </motion.div>

      {/* Submit Button */}
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
              <span>Sending Request...</span>
            </>
          ) : (
            <span>Send Request</span>
          )}
        </button>
      </motion.div>
    </div>
  )
}
