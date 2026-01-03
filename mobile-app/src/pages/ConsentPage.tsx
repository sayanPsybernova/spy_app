import { Heart, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { useAppContext } from '../App'
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function ConsentPage() {
  const { setHasConsented } = useAppContext()
  const [showDetails, setShowDetails] = useState(false)

  const handleAccept = () => {
    setHasConsented(true)
  }

  const handleDecline = () => {
    alert('This app requires your consent to function. You can uninstall if you do not agree.')
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-primary-900 via-dark-bg to-purple-900 safe-top safe-bottom">
      {/* Main Content - Simplified */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-32 h-32 mb-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30"
        >
          <Heart size={64} className="text-white" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-bold mb-6"
        >
          Stay Connected
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 mb-6 max-w-sm"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <MapPin size={28} className="text-primary-400" />
            <span className="text-xl font-medium">Location Sharing</span>
          </div>
          <p className="text-gray-300 text-lg leading-relaxed">
            This app shares your location with your family so they can make sure you're safe.
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-400 text-lg mb-4"
        >
          You can stop sharing anytime
        </motion.p>

        {/* Collapsible Details */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
        >
          <span>{showDetails ? 'Hide' : 'Show'} Details</span>
          {showDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </motion.button>

        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 glass-card p-4 max-w-sm text-left text-sm"
          >
            <p className="text-gray-400 mb-3">
              <strong className="text-gray-200">What we share:</strong>
            </p>
            <ul className="space-y-1 text-gray-300 mb-4">
              <li>• Your location</li>
              <li>• Which apps you use</li>
              <li>• How long you use each app</li>
            </ul>
            <p className="text-gray-400 mb-3">
              <strong className="text-gray-200">What we DON'T see:</strong>
            </p>
            <ul className="space-y-1 text-gray-300">
              <li>• Your messages</li>
              <li>• Your passwords</li>
              <li>• Your photos</li>
              <li>• What you type</li>
            </ul>
          </motion.div>
        )}
      </div>

      {/* Large, Easy-to-Tap Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex-shrink-0 p-6 space-y-4"
      >
        <button
          onClick={handleAccept}
          className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xl font-semibold rounded-2xl shadow-lg shadow-emerald-500/30 transition-all active:scale-98"
        >
          Yes, I'm Ready
        </button>
        <button
          onClick={handleDecline}
          className="w-full py-4 text-gray-400 hover:text-white text-lg transition-colors"
        >
          No, Thanks
        </button>
      </motion.div>
    </div>
  )
}
