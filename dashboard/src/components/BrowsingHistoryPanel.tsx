import { useState, useEffect } from 'react'
import { Globe, Search, Clock, ExternalLink, Trash2, BarChart3, RefreshCw } from 'lucide-react'
import { API_BASE_URL } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

interface BrowserHistoryItem {
  id: string
  device_id: string
  url: string
  domain: string
  browser_package: string | null
  timestamp: string
}

interface BrowsingStats {
  total_urls: number
  unique_domains: number
  top_domains: { domain: string; count: number }[]
}

interface BrowsingHistoryPanelProps {
  deviceId: string
}

export default function BrowsingHistoryPanel({ deviceId }: BrowsingHistoryPanelProps) {
  const [history, setHistory] = useState<BrowserHistoryItem[]>([])
  const [stats, setStats] = useState<BrowsingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showStats, setShowStats] = useState(false)

  const fetchHistory = async (query?: string) => {
    try {
      setLoading(true)
      const endpoint = query
        ? `${API_BASE_URL}/api/browser/${deviceId}/search?q=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/api/browser/${deviceId}?limit=100`

      const response = await fetch(endpoint)
      const result = await response.json()
      if (result.success) {
        setHistory(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch browser history:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/browser/${deviceId}/stats`)
      const result = await response.json()
      if (result.success) {
        setStats(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch browser stats:', err)
    }
  }

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all browsing history for this device?')) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/browser/${deviceId}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (result.success) {
        setHistory([])
        setStats(null)
      }
    } catch (err) {
      console.error('Failed to clear history:', err)
      alert('Failed to clear history')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchHistory(searchQuery || undefined)
  }

  useEffect(() => {
    fetchHistory()
    fetchStats()
  }, [deviceId])

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getBrowserIcon = (pkg: string | null) => {
    if (!pkg) return 'globe'
    if (pkg.includes('chrome')) return 'chrome'
    if (pkg.includes('firefox')) return 'firefox'
    if (pkg.includes('edge') || pkg.includes('emmx')) return 'edge'
    if (pkg.includes('samsung') || pkg.includes('sbrowser')) return 'samsung'
    if (pkg.includes('opera')) return 'opera'
    if (pkg.includes('brave')) return 'brave'
    return 'globe'
  }

  const truncateUrl = (url: string, maxLength: number = 60) => {
    if (url.length <= maxLength) return url
    return url.substring(0, maxLength) + '...'
  }

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Globe size={20} className="text-blue-400" />
          <h3 className="font-semibold">Browsing History</h3>
          <span className="text-sm text-gray-400">({history.length})</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className={`p-2 rounded-lg transition-colors ${
              showStats ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
            title="Toggle Stats"
          >
            <BarChart3 size={18} />
          </button>
          <button
            onClick={() => fetchHistory()}
            className="p-2 bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleClearHistory}
            className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
            title="Clear History"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Stats Panel */}
      <AnimatePresence>
        {showStats && stats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-gray-800/50 rounded-xl">
              <div>
                <p className="text-sm text-gray-400">Total URLs</p>
                <p className="text-xl font-bold text-blue-400">{stats.total_urls}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Unique Domains</p>
                <p className="text-xl font-bold text-purple-400">{stats.unique_domains}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-sm text-gray-400 mb-1">Top Domains</p>
                <div className="space-y-1">
                  {stats.top_domains.slice(0, 3).map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300 truncate max-w-[120px]">{d.domain}</span>
                      <span className="text-gray-500">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search URLs or domains..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl focus:border-blue-500 outline-none text-sm"
          />
        </div>
      </form>

      {/* History List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Globe size={40} className="mx-auto mb-3 opacity-50" />
          <p>No browsing history</p>
          <p className="text-sm mt-1">URLs will appear here when the user browses</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {history.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className="flex items-start gap-3 p-3 bg-gray-800/30 hover:bg-gray-800/50 rounded-xl transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Globe size={16} className="text-blue-400" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-300 truncate">
                  {item.domain}
                </p>
                <p className="text-xs text-gray-400 truncate" title={item.url}>
                  {truncateUrl(item.url)}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock size={12} />
                  {formatTime(item.timestamp)}
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                  title="Open URL"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
