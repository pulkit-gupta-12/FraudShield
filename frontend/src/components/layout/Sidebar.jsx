import React from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import {
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Sliders,
  Layers,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { NAVIGATION_ITEMS } from '../../config/navigation.js'

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const navItems = user?.role ? NAVIGATION_ITEMS[user.role] || [] : []

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const content = (
    <div className="h-full flex flex-col justify-between bg-white border-r border-neutral-200">
      {/* Top Header / Logo */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-100">
          <Link
            to="/"
            className={`flex items-center gap-2.5 overflow-hidden transition-all duration-300 ${
              collapsed ? 'justify-center w-full' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight text-neutral-900 leading-none">
                  Fraud<span className="text-primary-600">Shield</span>
                </span>
                <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mt-1">
                  Ops Center
                </span>
              </div>
            )}
          </Link>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex items-center justify-center w-6 h-6 rounded-md hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Current Role Banner */}
        {!collapsed && user && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200/60 flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-medium">Role Portal</span>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
              {user.role}
            </span>
          </div>
        )}

        {/* Nav Links */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen && setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  } ${collapsed ? 'justify-center px-0' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0`} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-3 border-t border-neutral-100 space-y-1">
        {/* Link to UI Kit */}
        <Link
          to="/ui-kit"
          onClick={() => setMobileOpen && setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title={collapsed ? 'Component UI Kit' : undefined}
        >
          <Layers className="w-4 h-4 text-primary-500 shrink-0" />
          {!collapsed && <span>Component UI Kit</span>}
        </Link>

        {/* User Card & Logout */}
        {!collapsed && user && (
          <div className="pt-2 mt-2 border-t border-neutral-100 flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-neutral-200 shrink-0 object-cover"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-900 truncate">{user.name}</p>
                <p className="text-[10px] text-neutral-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-risk-600 hover:bg-risk-50 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {collapsed && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center p-2 rounded-lg text-neutral-400 hover:text-risk-600 hover:bg-risk-50 transition"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className={`fixed top-0 bottom-0 z-30 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
          {content}
        </div>
      </aside>

      {/* Mobile Slide-in Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full z-10 shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  )
}
