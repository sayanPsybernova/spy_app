import { useEffect, useState } from 'react'
import { X, User, Smartphone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp, Notification } from '../App'
import { motion, AnimatePresence } from 'framer-motion'

export default function NotificationToast() {
  const { notifications, markNotificationRead } = useApp()
  const [visibleToasts, setVisibleToasts] = useState<Notification[]>([])
  const navigate = useNavigate()

  // Show new notifications as toasts
  useEffect(() => {
    const unread = notifications.filter(n => !n.read)
    const newToasts = unread.filter(n =>
      !visibleToasts.find(t => t.id === n.id)
    ).slice(0, 3) // Max 3 toasts

    if (newToasts.length > 0) {
      setVisibleToasts(prev => [...newToasts, ...prev].slice(0, 3))
    }
  }, [notifications])

  // Auto-dismiss toasts after 5 seconds
  useEffect(() => {
    if (visibleToasts.length === 0) return

    const timer = setTimeout(() => {
      setVisibleToasts(prev => prev.slice(0, -1))
    }, 5000)

    return () => clearTimeout(timer)
  }, [visibleToasts])

  const dismissToast = (id: string) => {
    setVisibleToasts(prev => prev.filter(t => t.id !== id))
  }

  const handleClick = (toast: Notification) => {
    markNotificationRead(toast.id)
    dismissToast(toast.id)
    if (toast.device_id) {
      navigate(`/device/${toast.device_id}`)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {visibleToasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            className="pointer-events-auto"
          >
            <div
              onClick={() => handleClick(toast)}
              className="glass-card border border-primary-500/30 shadow-2xl shadow-primary-500/20 p-4 cursor-pointer hover:border-primary-500/50 transition-all"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  toast.type === 'new_user'
                    ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                    : 'bg-gradient-to-br from-primary-500 to-purple-600'
                }`}>
                  {toast.type === 'new_user' ? (
                    <span className="text-2xl">🆕</span>
                  ) : (
                    <span className="text-2xl">📍</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-white">{toast.title}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        dismissToast(toast.id)
                      }}
                      className="p-1 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <X size={16} className="text-gray-400" />
                    </button>
                  </div>

                  {toast.type === 'new_user' && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <User size={14} />
                        <span>{toast.username}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Smartphone size={14} />
                        <span>{toast.device_name}</span>
                      </div>
                    </div>
                  )}

                  {toast.type !== 'new_user' && (
                    <p className="text-gray-400 text-sm mt-1">{toast.message}</p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-500">Just now</span>
                    <span className="text-xs text-primary-400 font-medium">
                      Click to view →
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
