import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Activity, Shield, Trash2, Info, ChevronRight, LogOut, Globe } from 'lucide-react'
import { useAppContext } from '../App'
import { motion } from 'framer-motion'
import { Accessibility } from '../plugins/definitions'
import { Capacitor } from '@capacitor/core'

export default function SettingsPage() {
  const {
    userData,
    isTracking,
    setIsTracking,
    locationEnabled,
    setLocationEnabled,
    serverUrl,
    clearUserData,
    logout
  } = useAppContext()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [browserTrackingEnabled, setBrowserTrackingEnabled] = useState(false)
  const [checkingAccessibility, setCheckingAccessibility] = useState(false)

  const isNative = Capacitor.isNativePlatform()

  // Check accessibility permission status
  useEffect(() => {
    if (!isNative) return
    checkAccessibilityPermission()
  }, [isNative])

  const checkAccessibilityPermission = async () => {
    try {
      const result = await Accessibility.hasPermission()
      setBrowserTrackingEnabled(result.granted)
    } catch (err) {
      console.error('Error checking accessibility permission:', err)
    }
  }

  const handleBrowserTrackingToggle = async () => {
    if (!isNative) {
      alert('Browser tracking is only available on Android devices')
      return
    }

    if (browserTrackingEnabled) {
      // To disable, user needs to go to settings
      await Accessibility.requestPermission()
      // Check again after returning from settings
      setTimeout(checkAccessibilityPermission, 1000)
    } else {
      setCheckingAccessibility(true)
      try {
        await Accessibility.requestPermission()
        // Check again after a delay (user needs to enable in settings)
        setTimeout(() => {
          checkAccessibilityPermission()
          setCheckingAccessibility(false)
        }, 1000)
      } catch (err) {
        console.error('Error requesting accessibility:', err)
        setCheckingAccessibility(false)
      }
    }
  }

  const handleDeleteData = async () => {
    setDeleting(true)
    try {
      // Call backend to delete user data
      await fetch(`${serverUrl}/api/devices/${userData?.device_id}`, {
        method: 'DELETE'
      })
      // Clear local data
      clearUserData()
    } catch (error) {
      console.error('Error deleting data:', error)
      alert('Failed to delete data. Please try again.')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg safe-top">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-800">
        <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-gray-800 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Tracking Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-800/50">
            <h2 className="font-semibold flex items-center gap-2">
              <Activity size={18} className="text-primary-400" />
              Tracking Settings
            </h2>
          </div>

          {/* App Usage Tracking */}
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium">App Usage Tracking</p>
              <p className="text-sm text-gray-400 mt-1">
                Track which apps you use and for how long
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isTracking}
                onChange={(e) => setIsTracking(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-8 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          {/* Location Tracking */}
          <div className="px-5 py-4 flex items-center justify-between border-t border-gray-800/50">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">Location Tracking</p>
                {locationEnabled && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {locationEnabled
                  ? 'Sending location every 3 seconds'
                  : 'Location is not being shared'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={locationEnabled}
                onChange={(e) => setLocationEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-8 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Location Info */}
          {locationEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="px-5 py-3 bg-emerald-500/10 border-t border-emerald-500/20"
            >
              <div className="flex items-start gap-3">
                <MapPin size={18} className="text-emerald-400 mt-0.5" />
                <div className="text-sm">
                  <p className="text-emerald-400 font-medium">Location sharing is ON</p>
                  <p className="text-gray-400 mt-1">
                    Your location is being shared with the admin dashboard in real-time.
                    Turn off to stop sharing.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Browser URL Tracking - Android only */}
          {isNative && (
            <>
              <div className="px-5 py-4 flex items-center justify-between border-t border-gray-800/50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Browser URL Tracking</p>
                    {browserTrackingEnabled && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    Track visited URLs (requires accessibility permission)
                  </p>
                </div>
                <button
                  onClick={handleBrowserTrackingToggle}
                  disabled={checkingAccessibility}
                  className={`w-14 h-8 rounded-full transition-colors relative ${
                    browserTrackingEnabled ? 'bg-blue-500' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-[4px] left-[4px] w-6 h-6 bg-white rounded-full transition-transform ${
                    browserTrackingEnabled ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>

              {/* Browser Tracking Info */}
              {browserTrackingEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="px-5 py-3 bg-blue-500/10 border-t border-blue-500/20"
                >
                  <div className="flex items-start gap-3">
                    <Globe size={18} className="text-blue-400 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-blue-400 font-medium">Browser tracking is ON</p>
                      <p className="text-gray-400 mt-1">
                        URLs you visit in Chrome, Firefox, and other browsers are being shared.
                        Tap toggle to manage in Accessibility settings.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </motion.div>

        {/* Privacy Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-800/50">
            <h2 className="font-semibold flex items-center gap-2">
              <Shield size={18} className="text-primary-400" />
              Privacy
            </h2>
          </div>

          {/* View Collected Data */}
          <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                <Activity size={20} className="text-primary-400" />
              </div>
              <div className="text-left">
                <p className="font-medium">View Collected Data</p>
                <p className="text-sm text-gray-400">See what data has been collected</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-500" />
          </button>

          {/* Delete My Data */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors border-t border-gray-800/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash2 size={20} className="text-red-400" />
              </div>
              <div className="text-left">
                <p className="font-medium text-red-400">Delete My Data</p>
                <p className="text-sm text-gray-400">Remove all collected data</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-500" />
          </button>

          {/* Logout */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors border-t border-gray-800/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <LogOut size={20} className="text-yellow-400" />
              </div>
              <div className="text-left">
                <p className="font-medium text-yellow-400">Sign Out</p>
                <p className="text-sm text-gray-400">Log out of your account</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-500" />
          </button>
        </motion.div>

        {/* About Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-800/50">
            <h2 className="font-semibold flex items-center gap-2">
              <Info size={18} className="text-primary-400" />
              About
            </h2>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-400">Version</span>
              <span>1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Device ID</span>
              <span className="font-mono text-xs">{userData?.device_id.slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Server</span>
              <span className="text-xs text-gray-500 truncate max-w-[150px]">{serverUrl}</span>
            </div>
          </div>
        </motion.div>

        {/* What We Collect Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <h3 className="font-semibold mb-4">What We Collect</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs">✓</span>
              </div>
              <span className="text-gray-300">App usage (which apps, duration)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs">✓</span>
              </div>
              <span className="text-gray-300">Location (only when enabled)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs">✓</span>
              </div>
              <span className="text-gray-300">Screen on/off events</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs">✓</span>
              </div>
              <span className="text-gray-300">Browser URLs (only when enabled)</span>
            </li>
          </ul>

          <h3 className="font-semibold mt-6 mb-4">What We DON'T Collect</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-red-400 text-xs">✕</span>
              </div>
              <span className="text-gray-400">Personal messages or content</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-red-400 text-xs">✕</span>
              </div>
              <span className="text-gray-400">Passwords or sensitive data</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-red-400 text-xs">✕</span>
              </div>
              <span className="text-gray-400">Photos, videos, or files</span>
            </li>
          </ul>
        </motion.div>

        {/* Spacer for bottom padding */}
        <div className="h-6"></div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6 max-w-sm w-full"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} className="text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2">Delete All Data?</h3>
            <p className="text-gray-400 text-center text-sm mb-6">
              This will permanently delete all your collected data from our servers. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-700 hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteData}
                disabled={deleting}
                className="flex-1 py-3 px-4 rounded-xl bg-red-500 hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6 max-w-sm w-full"
          >
            <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
              <LogOut size={32} className="text-yellow-400" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2">Sign Out?</h3>
            <p className="text-gray-400 text-center text-sm mb-6">
              You'll need to sign in again to continue using the app.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-700 hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => { logout(); setShowLogoutConfirm(false); }}
                className="flex-1 py-3 px-4 rounded-xl bg-yellow-500 hover:bg-yellow-600 transition-colors font-medium text-black"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
