import React, { useState, useEffect, useCallback } from 'react'
import {
  Building2,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Tag,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { getMerchants, createMerchant, updateMerchant } from '../../services/merchants.js'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { INDIAN_CITIES, MERCHANT_CATEGORIES } from '../../components/payment/PaymentForm.jsx'
import toast from 'react-hot-toast'

export function AdminMerchants() {
  const [merchants, setMerchants] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingMerchant, setEditingMerchant] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('Electronics')
  const [formCity, setFormCity] = useState('Mumbai')
  const [formActive, setFormActive] = useState(true)

  const fetchMerchantsList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMerchants({ search })
      const list = Array.isArray(res) ? res : res.results || []
      setMerchants(list)
      setTotalCount(res.count !== undefined ? res.count : list.length)
    } catch (err) {
      console.error('Failed to load merchants:', err)
      toast.error('Failed to load merchants catalog')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchMerchantsList()
  }, [fetchMerchantsList])

  const openAddModal = () => {
    setFormName('')
    setFormCategory('Electronics')
    setFormCity('Mumbai')
    setFormActive(true)
    setIsAddModalOpen(true)
  }

  const openEditModal = (m) => {
    setEditingMerchant(m)
    setFormName(m.name)
    setFormCategory(m.category || 'General')
    setFormCity(m.city || 'Mumbai')
    setFormActive(m.active !== undefined ? m.active : true)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast.error('Merchant name is required')
      return
    }

    setSubmitting(true)
    try {
      await createMerchant({
        name: formName.trim(),
        category: formCategory,
        city: formCity.trim(),
        active: formActive,
      })
      toast.success(`Merchant "${formName}" created successfully!`)
      setIsAddModalOpen(false)
      fetchMerchantsList()
    } catch (err) {
      toast.error(err.message || 'Failed to create merchant')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editingMerchant) return
    if (!formName.trim()) {
      toast.error('Merchant name is required')
      return
    }

    setSubmitting(true)
    try {
      await updateMerchant(editingMerchant.id, {
        name: formName.trim(),
        category: formCategory,
        city: formCity.trim(),
        active: formActive,
      })
      toast.success(`Merchant "${formName}" updated successfully!`)
      setEditingMerchant(null)
      fetchMerchantsList()
    } catch (err) {
      toast.error(err.message || 'Failed to update merchant')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (m) => {
    try {
      const nextActive = !m.active
      await updateMerchant(m.id, { active: nextActive })
      toast.success(`Merchant "${m.name}" ${nextActive ? 'activated' : 'deactivated'}.`)
      setMerchants((prev) =>
        prev.map((item) => (item.id === m.id ? { ...item, active: nextActive } : item))
      )
    } catch (err) {
      toast.error(err.message || 'Failed to toggle merchant status')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Merchant Name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-xs">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-neutral-900 text-xs block">{row.name}</span>
            <span className="text-[10px] text-neutral-400 font-mono">ID: #{row.id}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Industry Category',
      render: (row) => (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
          {row.category || 'General'}
        </span>
      ),
    },
    {
      key: 'city',
      label: 'Operating City',
      render: (row) => (
        <span className="text-xs text-neutral-600 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-neutral-400" />
          {row.city || 'Pan India'}
        </span>
      ),
    },
    {
      key: 'active',
      label: 'Status',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleToggleActive(row)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
            row.active
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200'
          }`}
          title="Click to toggle status"
        >
          {row.active ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Active</span>
            </>
          ) : (
            <>
              <XCircle className="w-3.5 h-3.5 text-neutral-400" />
              <span>Deactivated</span>
            </>
          )}
        </button>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-primary-600 hover:bg-primary-50 transition"
            title="Edit Merchant"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-600 mb-1">
            <Building2 className="w-4 h-4" />
            <span>Admin Ecosystem Directory</span>
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Merchants Registry
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Manage authorized merchant entities, industry category classification, and activation state.
          </p>
        </div>

        <button
          type="button"
          id="admin-add-merchant-btn"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Merchant</span>
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search merchant name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-semibold">
              Total: {totalCount} merchants
            </span>
            <button
              type="button"
              onClick={fetchMerchantsList}
              className="p-2 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition"
              title="Refresh table"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={merchants}
          loading={loading}
          emptyMessage="No merchants registered yet."
        />
      </div>

      {/* Add Merchant Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Merchant Entity"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-neutral-700">Merchant Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Swiggy Instamart"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-700">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                {MERCHANT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-700">Operating City</label>
              <input
                list="admin-cities-list"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="City"
                className="w-full h-10 px-3 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <datalist id="admin-cities-list">
                {INDIAN_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="add-merchant-active"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="w-4 h-4 rounded text-primary-600 border-neutral-300 focus:ring-primary-500"
            />
            <label htmlFor="add-merchant-active" className="text-xs font-semibold text-neutral-700">
              Active status (accepts transactions)
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Merchant'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Merchant Modal */}
      <Modal
        isOpen={Boolean(editingMerchant)}
        onClose={() => setEditingMerchant(null)}
        title={`Edit Merchant — ${editingMerchant?.name}`}
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-neutral-700">Merchant Name</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-700">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                {MERCHANT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-700">Operating City</label>
              <input
                list="admin-cities-list-edit"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <datalist id="admin-cities-list-edit">
                {INDIAN_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="edit-merchant-active"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="w-4 h-4 rounded text-primary-600 border-neutral-300 focus:ring-primary-500"
            />
            <label htmlFor="edit-merchant-active" className="text-xs font-semibold text-neutral-700">
              Active status
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setEditingMerchant(null)}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default AdminMerchants
