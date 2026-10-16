import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Shield,
  RefreshCw,
  Mail,
  User,
  Briefcase,
} from 'lucide-react'
import { getUsers, updateUserRole, updateUserStatus, inviteUser } from '../../services/users.js'
import { exportToCSV } from '../../utils/csv.js'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { Avatar } from '../../components/ui/Avatar.jsx'
import toast from 'react-hot-toast'

/**
 * Screen S7: User Management & RBAC
 * Follows DATA RULE #1: DataTable in SERVER-SIDE mode.
 * Real CSV download via src/utils/csv.js.
 * Inline role modification and status toggles.
 */
export function AdminUsers() {
  const [users, setUsers] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [ordering, setOrdering] = useState('name')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Invite User Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'analyst',
    department: 'Fraud Investigation',
  })
  const [inviting, setInviting] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getUsers({
        page,
        pageSize,
        search,
        ordering,
        role: roleFilter,
      })
      setUsers(res.results || [])
      setTotalCount(res.count || 0)
    } catch (err) {
      setError(err.message || 'Failed to fetch user directory')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, ordering, roleFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Real CSV export
  const handleExportCSV = async () => {
    try {
      // fetch all users or current filtered list
      const res = await getUsers({ pageSize: 100, role: roleFilter })
      const exportData = (res.results || users).map((u) => ({
        ID: u.id,
        Name: u.name,
        Email: u.email,
        Role: u.role,
        Status: u.status,
        Department: u.department || '',
        City: u.city || '',
        LastLogin: u.lastLogin || '',
      }))
      exportToCSV(exportData, `fraudshield_users_${Date.now()}.csv`)
      toast.success('User directory CSV downloaded successfully!')
    } catch (err) {
      toast.error('Failed to export CSV: ' + err.message)
    }
  }

  // Inline role update
  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole)
      toast.success(`Role updated to ${newRole.toUpperCase()}`)
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      )
    } catch (err) {
      toast.error(err.message || 'Failed to update user role')
    }
  }

  // Inline status toggle
  const handleStatusToggle = async (user) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active'
    try {
      await updateUserStatus(user.id, newStatus)
      toast.success(`User ${user.name} is now ${newStatus.toUpperCase()}`)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)),
      )
    } catch (err) {
      toast.error(err.message || 'Failed to update user status')
    }
  }

  // Invite user submission
  const handleInviteSubmit = async (e) => {
    e.preventDefault()
    setInviting(true)
    try {
      await inviteUser(inviteForm)
      toast.success(`Invitation email dispatched to ${inviteForm.email}`)
      setIsInviteOpen(false)
      setInviteForm({ name: '', email: '', role: 'analyst', department: 'Fraud Investigation' })
      fetchUsers()
    } catch (err) {
      toast.error(err.message || 'Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'User Identity',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.avatar} name={row.name} size="sm" />
          <div>
            <span className="font-bold text-neutral-900 text-xs block">{row.name}</span>
            <span className="text-[11px] text-neutral-500 font-mono">{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Platform Role',
      sortable: true,
      render: (row) => (
        <select
          value={row.role}
          onChange={(e) => handleRoleChange(row.id, e.target.value)}
          className="text-xs font-semibold py-1 px-2 rounded-lg border border-neutral-300 bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 capitalize"
        >
          <option value="admin">Admin</option>
          <option value="analyst">Analyst</option>
          <option value="customer">Customer</option>
          <option value="merchant">Merchant</option>
        </select>
      ),
    },
    {
      key: 'department',
      header: 'Department / Organization',
      render: (row) => (
        <span className="text-xs text-neutral-600">{row.department || 'Standard Account'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Access Status',
      render: (row) => <StatusBadge status={row.status || 'active'} size="sm" />,
    },
    {
      key: 'lastLogin',
      header: 'Last Authentication',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-neutral-500 font-mono">
          {row.lastLogin ? new Date(row.lastLogin).toLocaleDateString('en-IN') : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleStatusToggle(row)}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${
            row.status === 'active'
              ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
          }`}
        >
          {row.status === 'active' ? 'Deactivate' : 'Activate'}
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              User Directory & RBAC Permissions
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 uppercase tracking-wider">
              Access Control
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Provision team privileges, invite security analysts, and inspect account statuses
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            id="export-users-csv-btn"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-semibold text-xs shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            type="button"
            id="invite-user-btn"
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition"
          >
            <UserPlus className="w-4 h-4" />
            Invite New User
          </button>
        </div>
      </div>

      {/* Main Server-side Table Section */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b border-neutral-100">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-neutral-600 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-neutral-400" /> Role:
            </span>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setPage(1)
              }}
              className="text-xs rounded-lg border border-neutral-300 py-1.5 px-2.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 capitalize"
            >
              <option value="ALL">All Roles</option>
              <option value="admin">Admin</option>
              <option value="analyst">Analyst</option>
              <option value="customer">Customer</option>
              <option value="merchant">Merchant</option>
            </select>
          </div>

          <span className="text-xs text-neutral-400 font-mono">
            Total {totalCount} Registered Users
          </span>
        </div>

        {error ? (
          <ErrorState
            title="User Directory Offline"
            message={error}
            onRetry={fetchUsers}
          />
        ) : (
          <DataTable
            columns={columns}
            data={users}
            loading={loading}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onSortChange={(s) => setOrdering(s)}
            onSearchChange={(q) => {
              setSearch(q)
              setPage(1)
            }}
            searchPlaceholder="Search user name or email..."
            emptyMessage="No users found matching your criteria."
          />
        )}
      </div>

      {/* Invite User Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite New Platform User"
        size="md"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-neutral-700 uppercase mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              placeholder="e.g. Alok Singhania"
              className="w-full p-2.5 rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div>
            <label className="block font-bold text-neutral-700 uppercase mb-1">
              Corporate Email Address
            </label>
            <input
              type="email"
              required
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="e.g. alok.singhania@fraudshield.io"
              className="w-full p-2.5 rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-neutral-700 uppercase mb-1">
                Role Clearance
              </label>
              <select
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-neutral-300 bg-white text-xs focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="analyst">Analyst</option>
                <option value="admin">Admin</option>
                <option value="customer">Customer</option>
                <option value="merchant">Merchant</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-neutral-700 uppercase mb-1">
                Department
              </label>
              <input
                type="text"
                value={inviteForm.department}
                onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setIsInviteOpen(false)}
              className="px-4 py-2 rounded-xl border border-neutral-300 bg-white font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 font-bold text-white shadow-xs disabled:opacity-50"
            >
              {inviting ? 'Dispatching...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default AdminUsers
