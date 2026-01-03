import { useState, useEffect } from 'react'
import { UserPlus, Users, Trash2, Shield, AlertCircle, Clock, Smartphone, RefreshCw } from 'lucide-react'
import { API_BASE_URL, getAdminAuthHeader } from '../lib/supabase'
import CreateUserModal from '../components/CreateUserModal'
import AccessRequestsPanel from '../components/AccessRequestsPanel'
import { motion, AnimatePresence } from 'framer-motion'

interface User {
  id: string
  user_id: string
  username: string
  profile_image_url: string | null
  status: 'active' | 'suspended'
  created_at: string
  last_login: string | null
  device_count: number
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRequests, setShowRequests] = useState(false)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          'Authorization': getAdminAuthHeader()
        }
      })
      const result = await response.json()
      if (result.success) {
        setUsers(result.data)
      } else {
        setError(result.error || 'Failed to fetch users')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/access-requests?status=pending`, {
        headers: {
          'Authorization': getAdminAuthHeader()
        }
      })
      const result = await response.json()
      if (result.success) {
        setPendingRequestsCount(result.data.length)
      }
    } catch (err) {
      console.error('Failed to fetch pending requests:', err)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This will also delete all their devices.')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': getAdminAuthHeader()
        }
      })
      const result = await response.json()
      if (result.success) {
        setUsers(prev => prev.filter(u => u.id !== userId))
      } else {
        alert(result.error || 'Failed to delete user')
      }
    } catch (err) {
      alert('Failed to delete user')
    }
  }

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active'
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': getAdminAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })
      const result = await response.json()
      if (result.success) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u))
      }
    } catch (err) {
      alert('Failed to update user status')
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchPendingRequests()
  }, [])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-gray-400 text-sm">{users.length} users registered</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRequests(!showRequests)}
            className="relative px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Clock size={18} />
            <span>Access Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                {pendingRequestsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 rounded-lg flex items-center gap-2 transition-all"
          >
            <UserPlus size={18} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Access Requests Panel */}
      <AnimatePresence>
        {showRequests && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <AccessRequestsPanel
              onRequestHandled={() => {
                fetchPendingRequests()
                fetchUsers()
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchUsers} className="ml-auto flex items-center gap-2 hover:text-white">
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        /* Users Grid */
        <div className="grid gap-4">
          {users.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>No users yet. Create your first user to get started.</p>
            </div>
          ) : (
            users.map(user => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 flex items-center gap-4"
              >
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-xl font-bold overflow-hidden">
                  {user.profile_image_url ? (
                    <img src={user.profile_image_url} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    user.username.charAt(0).toUpperCase()
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{user.username}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      user.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {user.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm">ID: {user.user_id}</p>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <Smartphone size={16} />
                    <span>{user.device_count} devices</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>Last login: {formatDate(user.last_login)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(user)}
                    className={`p-2 rounded-lg transition-colors ${
                      user.status === 'active'
                        ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                    title={user.status === 'active' ? 'Suspend user' : 'Activate user'}
                  >
                    <Shield size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Delete user"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onUserCreated={() => {
          fetchUsers()
          setShowCreateModal(false)
        }}
      />
    </div>
  )
}
