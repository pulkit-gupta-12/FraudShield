import React, { useState } from 'react'
import {
  User,
  Mail,
  Shield,
  Key,
  Bell,
  Smartphone,
  Laptop,
  CheckCircle2,
  Save,
  Camera,
  MapPin,
  Phone,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { Avatar } from '../../components/ui/Avatar.jsx'
import { Toggle } from '../../components/ui/Toggle.jsx'
import toast from 'react-hot-toast'

export function ProfilePage() {
  const { user } = useAuth()

  // Profile form state
  const [displayName, setDisplayName] = useState(user?.name || 'Authorized User')
  const [phone, setPhone] = useState(user?.phone || '+91 99887 76655')
  const [city, setCity] = useState(user?.city || 'Delhi')

  // Password state
  const [passwords, setPasswords] = useState({
    current: '',
    newPass: '',
    confirm: '',
  })
  const [savingPassword, setSavingPassword] = useState(false)

  // Notification preferences
  const [notifs, setNotifs] = useState({
    emailAlerts: true,
    smsAlerts: true,
    pushHighRisk: true,
    weeklyReport: false,
  })

  // Session state simulation
  const [sessions, setSessions] = useState([
    {
      id: 'sess_1',
      device: 'Chrome on Windows 11',
      location: 'New Delhi, India',
      ip: '103.21.244.18',
      current: true,
      lastActive: 'Just now',
    },
    {
      id: 'sess_2',
      device: 'Mobile Safari on iPhone 15',
      location: 'New Delhi, India',
      ip: '103.21.244.22',
      current: false,
      lastActive: 'Yesterday at 4:15 PM',
    },
  ])

  const handleSaveProfile = (e) => {
    e.preventDefault()
    toast.success('Profile details updated successfully')
  }

  const handleChangePassword = (e) => {
    e.preventDefault()
    if (!passwords.current) {
      toast.error('Please enter your current password')
      return
    }
    if (passwords.newPass.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (passwords.newPass !== passwords.confirm) {
      toast.error('New passwords do not match')
      return
    }

    setSavingPassword(true)
    setTimeout(() => {
      setSavingPassword(false)
      setPasswords({ current: '', newPass: '', confirm: '' })
      toast.success('Security password successfully updated')
    }, 600)
  }

  const handleRevokeSession = (sessionId) => {
    setSessions(sessions.filter((s) => s.id !== sessionId))
    toast.success('Session terminated successfully')
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Account & Security Profile
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage your credentials, notification channels, and active security sessions
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-primary-50 text-primary-700 border border-primary-200 w-fit uppercase">
          <Shield className="w-3.5 h-3.5" />
          Role: {user?.role || 'User'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: User Card & Sessions */}
        <div className="space-y-6">
          {/* User Bio Card */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs text-center flex flex-col items-center">
            <div className="relative group">
              <Avatar
                src={user?.avatar}
                name={displayName}
                size="xl"
                className="ring-4 ring-primary-50"
              />
              <button
                type="button"
                onClick={() => toast.success('Avatar selection simulated')}
                className="absolute bottom-0 right-0 p-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-md transition"
                title="Change Avatar"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <h3 className="font-bold text-base text-neutral-900 mt-4">{displayName}</h3>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">{user?.email}</p>

            <div className="mt-4 pt-4 border-t border-neutral-100 w-full text-left space-y-2 text-xs">
              <div className="flex items-center justify-between text-neutral-600">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" /> City
                </span>
                <span className="font-semibold text-neutral-800">{city}</span>
              </div>
              <div className="flex items-center justify-between text-neutral-600">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-neutral-400" /> Phone
                </span>
                <span className="font-semibold text-neutral-800">{phone}</span>
              </div>
              <div className="flex items-center justify-between text-neutral-600">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-neutral-400" /> Status
                </span>
                <span className="font-semibold text-emerald-600">Verified Active</span>
              </div>
            </div>
          </div>

          {/* Active Sessions Telemetry */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-primary-600" />
              Active Sessions
            </h4>
            <div className="space-y-3">
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  className="p-3 rounded-xl border border-neutral-100 bg-neutral-50/50 text-xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                      {sess.device.includes('iPhone') ? (
                        <Smartphone className="w-3.5 h-3.5 text-neutral-500" />
                      ) : (
                        <Laptop className="w-3.5 h-3.5 text-neutral-500" />
                      )}
                      {sess.device}
                    </span>
                    {sess.current ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        THIS DEVICE
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(sess.id)}
                        className="text-[11px] text-red-600 hover:underline font-semibold"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 flex justify-between mt-1">
                    <span>{sess.location} · {sess.ip}</span>
                    <span className="text-neutral-400">{sess.lastActive}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Personal Info, Password, & Notifications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit Details */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs">
            <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary-600" />
              Personal Information
            </h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                    Email Address (Read-only)
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                    City Location
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-xs transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs">
            <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <Key className="w-4 h-4 text-primary-600" />
              Change Password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwords.newPass}
                    onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Key className="w-3.5 h-3.5" />
                  {savingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Notification Preferences */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary-600" />
              Notification & Alert Preferences
            </h3>
            <div className="space-y-3 divide-y divide-neutral-100">
              <div className="pt-2 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-neutral-900">Email Fraud Alerts</div>
                  <div className="text-[11px] text-neutral-500">
                    Receive immediate email when high-risk transactions are detected
                  </div>
                </div>
                <Toggle
                  checked={notifs.emailAlerts}
                  onChange={(c) => {
                    setNotifs({ ...notifs, emailAlerts: c })
                    toast.success(`Email alerts ${c ? 'enabled' : 'disabled'}`)
                  }}
                />
              </div>

              <div className="pt-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-neutral-900">SMS Verification Codes</div>
                  <div className="text-[11px] text-neutral-500">
                    Receive SMS alerts for suspicious authorization requests
                  </div>
                </div>
                <Toggle
                  checked={notifs.smsAlerts}
                  onChange={(c) => {
                    setNotifs({ ...notifs, smsAlerts: c })
                    toast.success(`SMS alerts ${c ? 'enabled' : 'disabled'}`)
                  }}
                />
              </div>

              <div className="pt-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-neutral-900">In-App Push Alerts</div>
                  <div className="text-[11px] text-neutral-500">
                    Show instant banner when anomalous transactions trigger risk rules
                  </div>
                </div>
                <Toggle
                  checked={notifs.pushHighRisk}
                  onChange={(c) => {
                    setNotifs({ ...notifs, pushHighRisk: c })
                    toast.success(`Push alerts ${c ? 'enabled' : 'disabled'}`)
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
