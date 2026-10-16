import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  ShieldAlert,
  Briefcase,
  Cpu,
  Clock,
  ArrowRight,
  Filter,
  Check,
  ExternalLink,
} from 'lucide-react'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/notifications.js'
import { formatRelativeTime, formatDateTime } from '../../utils/format.js'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import toast from 'react-hot-toast'

/**
 * Screen S25: Notification Center & Security Dispatch
 * Follows DATA RULE #1: Server-side pagination / listing via notifications.js.
 * Follows DATA RULE #4: ErrorState with retry on error.
 * Zero imports from src/mock.
 */
export function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filterType, setFilterType] = useState('ALL') // 'ALL' | 'UNREAD' | 'READ'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getNotifications({ page, pageSize })
      let list = data.results || (Array.isArray(data) ? data : [])
      if (filterType === 'UNREAD') {
        list = list.filter((n) => !n.read)
      } else if (filterType === 'READ') {
        list = list.filter((n) => n.read)
      }
      setNotifications(list)
      setTotalCount(data.count || list.length)
    } catch (err) {
      setError(err.message || 'Failed to retrieve notification records')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filterType])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const handleMarkOneRead = async (id, e) => {
    e.stopPropagation()
    try {
      await markNotificationRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      toast.success('Notification marked as read')
    } catch (err) {
      toast.error('Failed to update notification')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      toast.success('All notifications marked as read')
    } catch (err) {
      toast.error('Failed to mark all as read')
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case 'alert':
        return <ShieldAlert className="w-4 h-4 text-risk-500" />
      case 'case':
        return <Briefcase className="w-4 h-4 text-primary-500" />
      case 'system':
      default:
        return <Cpu className="w-4 h-4 text-review-500" />
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Security Notifications & Dispatch
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
              <Bell className="w-3.5 h-3.5" />
              S25 Desk
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Real-time security telemetry, model state checkpoints, and assigned dispute queues.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 shadow-sm transition"
          >
            <CheckCheck className="w-4 h-4 text-primary-600" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="inline-flex p-1 bg-neutral-100 rounded-xl border border-neutral-200">
          {['ALL', 'UNREAD', 'READ'].map((t) => (
            <button
              key={t}
              onClick={() => {
                setFilterType(t)
                setPage(1)
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterType === t
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {t === 'ALL' ? 'All Alerts' : t === 'UNREAD' ? 'Unread Only' : 'Archived'}
            </button>
          ))}
        </div>

        <span className="text-xs text-neutral-500 font-medium">
          {unreadCount} unread of {totalCount} total
        </span>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {error ? (
          <div className="p-8">
            <ErrorState
              title="Failed to load notifications"
              message={error}
              onRetry={loadNotifications}
            />
          </div>
        ) : loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex items-start gap-3 p-3 bg-neutral-50 rounded-xl">
                <div className="w-8 h-8 bg-neutral-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="w-1/3 h-3 bg-neutral-200 rounded"></div>
                  <div className="w-2/3 h-2 bg-neutral-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-400">
            No notifications found under the current filter.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.link) navigate(item.link)
                }}
                className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition cursor-pointer hover:bg-neutral-50 ${
                  !item.read ? 'bg-primary-50/20' : ''
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-neutral-100 border border-neutral-200 mt-0.5 shrink-0">
                    {getIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-neutral-900">{item.title}</h4>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-primary-600 ring-2 ring-primary-100"></span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-600 mt-1 max-w-2xl leading-relaxed">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(item.timestamp)}
                      </span>
                      <span>•</span>
                      <span>{formatDateTime(item.timestamp)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!item.read && (
                    <button
                      onClick={(e) => handleMarkOneRead(item.id, e)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-primary-600 hover:bg-neutral-100 transition"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {item.link && (
                    <span className="text-neutral-400 hover:text-neutral-600">
                      <ExternalLink className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationsPage
