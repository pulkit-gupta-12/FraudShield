import React, { useState, useRef, useEffect } from 'react'
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
} from 'lucide-react'
import { useAuth, getRoleDashboardPath } from '../../context/AuthContext.jsx'
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notifications.js'
import { formatRelativeTime } from '../../utils/format.js'
import toast from 'react-hot-toast'

export function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const notifRef = useRef(null)
  const userRef = useRef(null)

  useEffect(() => {
    let isMounted = true
    getNotifications().then((data) => {
      if (isMounted) setNotifications(data)
    })
    return () => {
      isMounted = false
    }
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setShowUserMenu(false)
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

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Generate breadcrumb items from URL
  const pathSegments = location.pathname.split('/').filter(Boolean)
  const breadcrumbs = pathSegments.map((segment, idx) => {
    const path = `/${pathSegments.slice(0, idx + 1).join('/')}`
    const label = segment.charAt(0).toUpperCase() + segment.slice(1)
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

      {/* Center: Search input */}
      <div className="flex-1 max-w-md mx-2 sm:mx-6">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search transactions, cards, cases, rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-neutral-100 border border-transparent focus:bg-white focus:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition"
          />
        </div>
      </div>

      {/* Right: Notifications & User profile menu */}
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
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-risk-500 ring-2 ring-white"></span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden z-50">
              <div className="p-3.5 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">Notifications</h4>
                  <p className="text-[11px] text-neutral-500">{unreadCount} unread alerts</p>
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
                  notifications.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`p-3 text-xs hover:bg-neutral-50 cursor-pointer transition ${
                        !item.read ? 'bg-primary-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-neutral-900">{item.title}</span>
                        <span className="text-[10px] text-neutral-400 shrink-0">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-neutral-600 text-[11px] mt-0.5 line-clamp-2">{item.message}</p>
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

              <Link
                to="/ui-kit"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-100 transition"
              >
                <Layers className="w-3.5 h-3.5 text-primary-500" />
                Component UI Kit
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
