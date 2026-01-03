import { useState, useEffect } from 'react'
import { Check, X, Clock, User, Smartphone, Loader2, Key, AtSign } from 'lucide-react'
import { API_BASE_URL, getAdminAuthHeader } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

interface AccessRequest {
  id: string
  username: string
  device_name: string | null
  device_identifier: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

interface AccessRequestsPanelProps {
  onRequestHandled: () => void
}

export default function AccessRequestsPanel({ onRequestHandled }: AccessRequestsPanelProps) {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [showApproveModal, setShowApproveModal] = useState<AccessRequest | null>(null)
  const [newUserId, setNewUserId] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/admin/access-requests?status=pending`, {
        headers: {
          'Authorization': getAdminAuthHeader()
        }
      })
      const result = await response.json()
      if (result.success) {
        setRequests(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!showApproveModal || !newUserId.trim() || !newPassword.trim()) return

    setApproving(showApproveModal.id)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/access-requests/${showApproveModal.id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': getAdminAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: newUserId.trim(),
          username: showApproveModal.username,
          password: newPassword
        })
      })
      const result = await response.json()
      if (result.success) {
        setRequests(prev => prev.filter(r => r.id !== showApproveModal.id))
        setShowApproveModal(null)
        setNewUserId('')
        setNewPassword('')
        onRequestHandled()
      } else {
        alert(result.error || 'Failed to approve request')
      }
    } catch (err) {
      alert('Failed to approve request')
    } finally {
      setApproving(null)
    }
  }

  const handleReject = async (id: string) => {
    if (!confirm('Reject this access request?')) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/access-requests/${id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': getAdminAuthHeader()
        }
      })
      const result = await response.json()
      if (result.success) {
        setRequests(prev => prev.filter(r => r.id !== id))
        onRequestHandled()
      }
    } catch (err) {
      alert('Failed to reject request')
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3 mb-4">
        <Clock size={20} className="text-yellow-400" />
        <h3 className="font-semibold">Pending Access Requests</h3>
        <span className="text-sm text-gray-400">({requests.length})</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Clock size={32} className="mx-auto mb-2 opacity-50" />
          <p>No pending requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-xl"
            >
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <User size={20} className="text-yellow-400" />
              </div>

              <div className="flex-1">
                <p className="font-medium">{request.username}</p>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  {request.device_name && (
                    <span className="flex items-center gap-1">
                      <Smartphone size={14} />
                      {request.device_name}
                    </span>
                  )}
                  <span>{formatDate(request.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowApproveModal(request)
                    setNewUserId('')
                    setNewPassword('')
                  }}
                  className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors"
                  title="Approve"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => handleReject(request.id)}
                  className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                  title="Reject"
                >
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      <AnimatePresence>
        {showApproveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowApproveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass-card w-full max-w-md p-6 rounded-2xl"
            >
              <h3 className="text-lg font-semibold mb-4">Approve Access Request</h3>
              <p className="text-gray-400 mb-4">
                Create credentials for <span className="text-white font-medium">{showApproveModal.username}</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">User ID</label>
                  <div className="relative">
                    <AtSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={newUserId}
                      onChange={e => setNewUserId(e.target.value)}
                      placeholder="unique_user_id"
                      className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-primary-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Password</label>
                  <div className="relative">
                    <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Create a password"
                      className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-primary-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowApproveModal(null)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={!newUserId.trim() || !newPassword.trim() || approving !== null}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {approving ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Check size={18} />
                    )}
                    Approve
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
