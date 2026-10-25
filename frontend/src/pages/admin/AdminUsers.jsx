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
  CreditCard,
  Plus,
  Layers,
  ChevronRight,
} from 'lucide-react'
import { getUsers, updateUserRole, updateUserStatus, inviteUser } from '../../services/users.js'
import { getCards, issueCard } from '../../services/cards.js'
import { exportToCSV } from '../../utils/csv.js'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { StatusBadge } from '../../components/ui/StatusBadge.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { Drawer } from '../../components/ui/Drawer.jsx'
import { Avatar } from '../../components/ui/Avatar.jsx'
import toast from 'react-hot-toast'

/**
 * Screen S7: User Management & RBAC
 * Follows DATA RULE #1: DataTable in SERVER-SIDE mode.
 * Drawer S7 with 'Cards' tab and 'Issue card' form (brand, spending limit).
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
    role: 'customer',
    department: 'Customer Accounts',
  })
  const [inviting, setInviting] = useState(false)

  // User Drawer State (Task 15)
  const [selectedUser, setSelectedUser] = useState(null)
  const [drawerTab, setDrawerTab] = useState('cards') // 'cards' | 'overview'
  const [userCards, setUserCards] = useState([])
  const [cardsLoading, setCardsLoading] = useState(false)

  // Issue card form state
  const [issueBrand, setIssueBrand] = useState('Visa')
  const [issueLimit, setIssueLimit] = useState(100000)
  const [issuing, setIssuing] = useState(false)

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

  // Fetch selected user's cards
  const fetchSelectedUserCards = useCallback(async (userId) => {
    setCardsLoading(true)
    try {
      const res = await getCards({ userId, pageSize: 50 })
      setUserCards(res.results || [])
    } catch (err) {
      console.warn('Failed to load user cards:', err)
    } finally {
      setCardsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedUser?.id) {
      fetchSelectedUserCards(selectedUser.id)
    }
  }, [selectedUser, fetchSelectedUserCards])

  // Export CSV
  const handleExportCSV = async () => {
    try {
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
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )
      toast.success(`Role updated to ${newRole}`)
    } catch (err) {
      toast.error(err.message || 'Failed to update user role')
    }
  }

  // Inline status toggle
  const handleStatusToggle = async (userObj) => {
    const nextStatus = userObj.status === 'active' ? 'inactive' : 'active'
    try {
      await updateUserStatus(userObj.id, nextStatus)
      setUsers((prev) =>
        prev.map((u) => (u.id === userObj.id ? { ...u, status: nextStatus } : u))
      )
      toast.success(`User marked as ${nextStatus}`)
    } catch (err) {
      toast.error(err.message || 'Failed to change user status')
    }
  }

  // Invite user submission
  const handleInviteSubmit = async (e) => {
    e.preventDefault()
    setInviting(true)
    try {
      await inviteUser(inviteForm)
      toast.success(`Invitation dispatched to ${inviteForm.email}`)
      setIsInviteOpen(false)
      setInviteForm({ name: '', email: '', role: 'customer', department: 'Customer Accounts' })
      fetchUsers()
    } catch (err) {
      toast.error(err.message || 'Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  // Issue card submission (Task 15)
  const handleIssueCardSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser) return

    setIssuing(true)
    try {
      const created = await issueCard({
        userId: selectedUser.id,
        brand: issueBrand,
        spendingLimit: parseFloat(issueLimit) || 100000,
      })
      toast.success(`Card issued! Brand: ${issueBrand}, Last 4: ${created.last4 || '••••'}`)
      fetchSelectedUserCards(selectedUser.id)
    } catch (err) {
      toast.error(err.message || 'Failed to issue card')
    } finally {
      setIssuing(false)
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'User Name & Email',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div>
            <span className="font-bold text-neutral-900 text-xs block">{row.name}</span>
            <span className="text-[11px] text-neutral-500 font-mono">{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Platform Role',
      sortable: true,
      render: (row) => (
        <select
          value={row.role}
          onClick={(e) => e.stopPropagation()}
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
      label: 'Department / Organization',
      render: (row) => (
        <span className="text-xs text-neutral-600">{row.department || 'Standard Account'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Access Status',
      render: (row) => <StatusBadge status={row.status || 'active'} size="sm" />,
    },
    {
      key: 'actions',
      label: 'Action',
      render: (row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleStatusToggle(row)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${
              row.status === 'active'
                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
            }`}
          >
            {row.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedUser(row)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-primary-600 hover:bg-primary-50 transition"
            title="Inspect Cards & Details"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
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
            Provision team privileges, inspect user cards, and issue authorized payment credentials.
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
            Invite User
          </button>
        </div>
      </div>

      {/* User Table Card */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-4 h-4 text-neutral-400" />
            <span className="font-semibold text-neutral-700">Filter Role:</span>
            {['ALL', 'admin', 'analyst', 'customer', 'merchant'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRoleFilter(r)
                  setPage(1)
                }}
                className={`px-2.5 py-1 rounded-lg capitalize font-bold text-xs transition ${
                  roleFilter === r
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-semibold">
              Total: {totalCount} users
            </span>
            <button
              type="button"
              onClick={fetchUsers}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition"
              title="Refresh users"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={users}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          loading={loading}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => {
            setPageSize(s)
            setPage(1)
          }}
          onSortChange={(s) => setOrdering(s)}
          onSearchChange={(q) => {
            setSearch(q)
            setPage(1)
          }}
          onRowClick={(row) => setSelectedUser(row)}
          searchPlaceholder="Search user name or email..."
          emptyMessage="No users found matching your criteria."
        />
      </div>

      {/* S15: User Detail & Cards Drawer */}
      <Drawer
        isOpen={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title={`User Account — ${selectedUser?.name}`}
        description="User profile details, issued payment cards, and new card issuance"
        size="md"
        footer={
          <div className="flex justify-end w-full">
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 transition"
            >
              Close Drawer
            </button>
          </div>
        }
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* User Profile Header */}
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center gap-3">
              <Avatar name={selectedUser.name} size="md" />
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-neutral-900 truncate">
                  {selectedUser.name}
                </h3>
                <p className="text-xs text-neutral-500 font-mono truncate">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary-100 text-primary-700">
                    {selectedUser.role}
                  </span>
                  <StatusBadge status={selectedUser.status || 'active'} size="sm" />
                </div>
              </div>
            </div>

            {/* Drawer Tabs */}
            <div className="flex items-center p-1 bg-neutral-100 rounded-xl border border-neutral-200">
              <button
                type="button"
                onClick={() => setDrawerTab('cards')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  drawerTab === 'cards'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-primary-600" />
                <span>Cards ({userCards.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('overview')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  drawerTab === 'overview'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <User className="w-3.5 h-3.5 text-primary-600" />
                <span>Account Overview</span>
              </button>
            </div>

            {/* TAB: CARDS & ISSUE CARD FORM */}
            {drawerTab === 'cards' && (
              <div className="space-y-6">
                {/* Issued Cards List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                    Existing Issued Cards
                  </h4>

                  {cardsLoading ? (
                    <div className="p-4 text-center text-xs text-neutral-400">Loading cards...</div>
                  ) : userCards.length === 0 ? (
                    <div className="p-4 rounded-xl bg-neutral-50 text-center text-xs text-neutral-400 border border-dashed border-neutral-200">
                      No cards issued yet to this user. Use the form below to issue one.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userCards.map((c) => (
                        <div
                          key={c.id}
                          className="p-3.5 rounded-xl bg-white border border-neutral-200 shadow-2xs flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-neutral-900">
                                {c.brand || c.cardType || 'Visa'}
                              </span>
                              <span className="font-mono text-neutral-600">
                                •••• {c.last4 || (c.cardNumber && c.cardNumber.slice(-4)) || '4242'}
                              </span>
                            </div>
                            <span className="text-[11px] text-neutral-400">
                              Limit: ₹{Number(c.spendingLimit || 50000).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              c.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {c.status || 'Active'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Issue Card Form (Task 15) */}
                <form
                  onSubmit={handleIssueCardSubmit}
                  className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3.5"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-primary-600" />
                    <span>Issue New Payment Card</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="block font-bold text-neutral-700">Card Brand</label>
                      <select
                        value={issueBrand}
                        onChange={(e) => setIssueBrand(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg border border-neutral-300 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      >
                        <option value="Visa">Visa</option>
                        <option value="Mastercard">Mastercard</option>
                        <option value="RuPay">RuPay</option>
                        <option value="American Express">American Express</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-neutral-700">Spending Limit (INR)</label>
                      <input
                        type="number"
                        min="1000"
                        step="1000"
                        value={issueLimit}
                        onChange={(e) => setIssueLimit(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg border border-neutral-300 font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={issuing}
                      className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{issuing ? 'Issuing Card...' : 'Issue Card'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB: ACCOUNT OVERVIEW */}
            {drawerTab === 'overview' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-500">Account ID</span>
                  <span className="font-mono font-bold text-neutral-900">#{selectedUser.id}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-500">Department</span>
                  <span className="font-semibold text-neutral-800">{selectedUser.department || 'General'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-500">City / Location</span>
                  <span className="font-semibold text-neutral-800">{selectedUser.city || 'Mumbai, India'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-500">Phone Contact</span>
                  <span className="font-mono text-neutral-800">{selectedUser.phone || '+91 98000 00000'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-neutral-500">Last Authentication</span>
                  <span className="font-mono text-neutral-700">
                    {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString('en-IN') : 'Never'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

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
              Corporate / Customer Email
            </label>
            <input
              type="email"
              required
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="e.g. user@fraudshield.io"
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
                <option value="customer">Customer</option>
                <option value="merchant">Merchant</option>
                <option value="analyst">Analyst</option>
                <option value="admin">Admin</option>
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
