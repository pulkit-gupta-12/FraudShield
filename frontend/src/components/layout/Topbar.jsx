import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
  CheckCheck,
  Shield,
  Layers,
  ArrowRight,
  Loader2,
  Receipt,
  CreditCard,
  Building2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notifications.js'
import { getTransactions } from '../../services/transactions.js'
import { formatRelativeTime } from '../../utils/format.js'
import toast from 'react-hot-toast'

export function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Notifications
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const notifRef = useRef(null)
  const userRef = useRef(null)
  const lastKnownNotifIds = useRef(new Set())
  const isInitialNotifLoad = useRef(true)

  // Top-bar search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchContainerRef = useRef(null)

  // ── 1. Fetch & Poll Notifications every 10s ──
  const fetchNotifications = useCallback(async (isPolling = false) => {
    try {
      const data = await getNotifications({ pageSize: 50 })
      const list = Array.isArray(data) ? data : data.results || []

      if (isPolling && !isInitialNotifLoad.current) {
        // Detect brand-new notifications
        list.forEach((item) => {
          if (!lastKnownNotifIds.current.has(item.id) && !item.read) {
            toast(`Alert: ${item.title || item.message}`, {
              icon: '🔔',
              duration: 4000,
            })
          }
        })
      }

      const idSet = new Set(list.map((n) => n.id))
      lastKnownNotifIds.current = idSet
      isInitialNotifLoad.current = false
      setNotifications(list)
    } catch {
      // Non-critical background failure
    }
  }, [])

  useEffect(() => {
    fetchNotifications(false)
    const interval = setInterval(() => {
      fetchNotifications(true)
    }, 10000)

    const handleFocus = () => fetchNotifications(true)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleFocus()
    })

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchNotifications])

  // ── 2. Real Role-Scoped Top-Bar Search ──
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await getTransactions({
          search: searchQuery.trim(),
          pageSize: 6,
        })
        setSearchResults(res.results || [])
        setShowSearchDropdown(true)
      } catch (err) {
        console.warn('Search lookup failed:', err)
      } finally {
        setSearchLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    toast.success('All notifications marked as read')
  }

  const handleNotificationClick = async (item) => {
    await markNotificationRead(item.id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    )
    setShowNotifications(false)
    if (item.link) navigate(item.link)
  }

  const handleSearchResultClick = (item) => {
    setShowSearchDropdown(false)
    setSearchQuery('')

    const role = user?.role
    const id = item.id || item.publicId

    if (role === 'customer') {
      navigate(`/customer/transactions?search=${id}`)
    } else if (role === 'merchant') {
      navigate(`/merchant/chargebacks?search=${id}`)
    } else {
      // Staff (admin / analyst)
      if (item.caseId) {
        navigate(`/analyst/investigate/${item.caseId}`)
      } else {
        navigate(`/analyst/investigate?search=${id}`)
      }
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Generate breadcrumbs from URL
  const pathSegments = location.pathname.split('/').filter(Boolean)
  const breadcrumbs = pathSegments.map((segment, idx) => {
    const path = `/${pathSegments.slice(0, idx + 1).join('/')}`
    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ')
    return { path, label }
  })

  return (
    <header className="h-16 bg-white border-b border-neutral-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Left: Mobile Toggle + Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 md:hidden"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav className="hidden sm:flex items-center gap-2 text-xs font-medium text-neutral-500">
          <Link to="/" className="hover:text-neutral-900 transition flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-primary-600" />
            FraudShield
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              <span className="text-neutral-300">/</span>
              {idx === breadcrumbs.length - 1 ? (
                <span className="text-neutral-900 font-semibold">{crumb.label}</span>
              ) : (
                <Link to={crumb.path} className="hover:text-neutral-900 transition">
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Center: Real Role-Scoped Search */}
      <div className="flex-1 max-w-md mx-2 sm:mx-6 relative" ref={searchContainerRef}>
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            id="topbar-search-input"
            placeholder="Search txn ID, card last 4, cardholder, merchant..."
            value={searchQuery}
            onFocus={() => {
              if (searchResults.length > 0) setShowSearchDropdown(true)
            }}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-neutral-100 border border-transparent focus:bg-white focus:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition"
          />
          {searchLoading && (
            <Loader2 className="w-3.5 h-3.5 text-neutral-400 animate-spin absolute right-3 top-2.5" />
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchDropdown && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden z-50">
            <div className="p-2.5 border-b border-neutral-100 flex items-center justify-between text-[11px] font-bold text-neutral-500 uppercase">
              <span>Matching Transactions</span>
              <span>{searchResults.length} results</span>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-400">
                  No records matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                searchResults.map((item) => (
                  <div
                    key={item.id || item.publicId}
                    onClick={() => handleSearchResultClick(item)}
                    className="p-3 text-xs hover:bg-neutral-50 cursor-pointer transition flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-neutral-900 truncate">
                          {item.publicId || item.id}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          •••• {item.cardNumber ? item.cardNumber.slice(-4) : item.last4 || '••••'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-600 truncate">
                        <span className="font-medium text-neutral-800">
                          {item.customerName || item.holderName || 'Cardholder'}
                        </span>
                        <span>·</span>
                        <span className="truncate">{item.merchant || item.merchantName}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-bold text-neutral-900 text-xs">
                        ₹{Number(item.amountINR || item.amountInr || 0).toLocaleString('en-IN')}
                      </p>
                      <span
                        className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                          item.status === 'blocked'
                            ? 'text-rose-600'
                            : item.status === 'flagged' || item.status === 'review'
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {item.status || 'approved'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Notification Bell & User profile */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden z-50">
              <div className="p-3.5 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">Live Notifications</h4>
                  <p className="text-[11px] text-neutral-500">{unreadCount} unread items</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-400">
                    No new notifications
                  </div>
                ) : (
                  notifications.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`p-3 text-xs hover:bg-neutral-50 cursor-pointer transition ${
                        !item.read ? 'bg-primary-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-neutral-900">{item.title}</span>
                        <span className="text-[10px] text-neutral-400 shrink-0 font-mono">
                          {formatRelativeTime(item.timestamp || item.createdAt)}
                        </span>
                      </div>
                      <p className="text-neutral-600 text-[11px] mt-0.5 line-clamp-2">
                        {item.message || item.body}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 pl-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition"
          >
            <img
              src={user?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=FraudShield'}
              alt={user?.name || 'User'}
              className="w-7 h-7 rounded-full object-cover border border-neutral-200"
            />
            <span className="hidden md:block text-xs font-semibold text-neutral-900 max-w-[100px] truncate">
              {user?.name || 'Account'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-neutral-200 py-1.5 z-50">
              <div className="px-3 py-2 border-b border-neutral-100">
                <p className="text-xs font-bold text-neutral-900">{user?.name}</p>
                <p className="text-[11px] text-neutral-500 capitalize">{user?.role} Portal</p>
              </div>

              <Link
                to="/profile"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-100 transition"
              >
                <User className="w-3.5 h-3.5 text-neutral-400" />
                Profile & Security
              </Link>

              <div className="border-t border-neutral-100 my-1"></div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-risk-600 hover:bg-risk-50 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
