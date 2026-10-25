import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Layers,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
} from 'lucide-react'
import { getCases } from '../../services/cases.js'
import { getTransactions } from '../../services/transactions.js'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { CaseDetailPage } from './CaseDetailPage.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import toast from 'react-hot-toast'

/**
 * Screen S13: Investigation Queue & Triage Desk
 * Follows DATA RULE #1: DataTable in SERVER-SIDE mode.
 * Clicking a row opens the S14 Case Detail console with full actions.
 */
export function InvestigatePage() {
  const [cases, setCases] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [ordering, setOrdering] = useState('-id')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // S14 Inspector Modal State
  const [selectedCaseId, setSelectedCaseId] = useState(null)
  const [newlyAddedIds, setNewlyAddedIds] = useState(new Set())
  const prevCaseIdsRef = useRef(new Set())

  const fetchCases = useCallback(async (isPoll = false) => {
    if (!isPoll) setLoading(true)
    setError(null)
    try {
      const res = await getCases({
        page,
        pageSize,
        search,
        ordering,
        status: statusFilter,
        priority: priorityFilter,
      })
      const items = res.results || []
      setCases(items)
      setTotalCount(res.count || 0)

      if (prevCaseIdsRef.current.size > 0) {
        const fresh = items.filter((c) => !prevCaseIdsRef.current.has(c.id)).map((c) => c.id)
        if (fresh.length > 0) {
          setNewlyAddedIds((prev) => new Set([...prev, ...fresh]))
          setTimeout(() => {
            setNewlyAddedIds((prev) => {
              const next = new Set(prev)
              fresh.forEach((id) => next.delete(id))
              return next
            })
          }, 4000)
        }
      }
      prevCaseIdsRef.current = new Set(items.map((c) => c.id))
    } catch (err) {
      if (!isPoll) setError(err.message || 'Failed to fetch investigation cases')
    } finally {
      if (!isPoll) setLoading(false)
    }
  }, [page, pageSize, search, ordering, statusFilter, priorityFilter])

  useEffect(() => {
    fetchCases(false)
    const interval = setInterval(() => fetchCases(true), 10000)
    const onFocus = () => fetchCases(true)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [fetchCases])

  const columns = [
    {
      key: 'id',
      header: 'Case ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-bold text-neutral-900">{row.id || row.caseId}</span>
      ),
    },
    {
      key: 'transactionId',
      header: 'Txn Reference',
      render: (row) => (
        <span className="font-mono text-xs text-neutral-500">{row.transactionId}</span>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-neutral-900 text-xs block">{row.customerName}</span>
          <span className="text-[11px] text-neutral-500 font-mono">{row.customerEmail || 'Verified'}</span>
        </div>
      ),
    },
    {
      key: 'amountINR',
      header: 'Amount',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-neutral-900 text-xs font-mono">
          ₹{(row.amountINR || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'riskScore',
      header: 'Risk Score',
      sortable: true,
      render: (row) => <RiskBadge score={row.riskScore ?? 0.89} size="sm" />,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
            row.priority === 'P1'
              ? 'bg-red-100 text-red-700'
              : row.priority === 'P2'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-neutral-100 text-neutral-700'
          }`}
        >
          {row.priority || 'P2'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            row.status?.toLowerCase().includes('fraud')
              ? 'bg-red-100 text-red-800'
              : row.status?.toLowerCase().includes('escalated')
              ? 'bg-amber-100 text-amber-800'
              : row.status?.toLowerCase().includes('resolved')
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {row.status}
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
          onClick={() => setSelectedCaseId(row.id)}
          className="px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 hover:bg-primary-100 font-bold text-xs transition flex items-center gap-1 shadow-xs"
        >
          Investigate
          <ArrowRight className="w-3 h-3" />
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
              Investigation Queues & Case Triage
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 uppercase tracking-wider">
              Analyst Console
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Triage anomalous charges, inspect explainable AI factor breakdowns, and resolve investigations
          </p>
        </div>
      </div>

      {/* Main Server-side DataTable Section */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b border-neutral-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-neutral-600 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-neutral-400" /> Filter:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="text-xs rounded-lg border border-neutral-300 py-1.5 px-2.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Review">In Review</option>
              <option value="Escalated">Escalated</option>
              <option value="Confirmed Fraud">Confirmed Fraud</option>
              <option value="Resolved">Resolved Safe</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value)
                setPage(1)
              }}
              className="text-xs rounded-lg border border-neutral-300 py-1.5 px-2.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="ALL">All Priorities</option>
              <option value="P1">P1 (Critical)</option>
              <option value="P2">P2 (High)</option>
              <option value="P3">P3 (Medium)</option>
            </select>
          </div>

          <span className="text-xs text-neutral-400 font-mono">
            {totalCount} Total Open Case Records
          </span>
        </div>

        {error ? (
          <ErrorState
            title="Investigation Queue Offline"
            message={error}
            onRetry={fetchCases}
          />
        ) : (
          <DataTable
            columns={columns}
            data={cases}
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
            searchPlaceholder="Search case ID, customer, or transaction ref..."
            onRowClick={(row) => setSelectedCaseId(row.id)}
            rowClassName={(row) =>
              newlyAddedIds.has(row.id)
                ? 'bg-amber-50/80 ring-1 ring-inset ring-amber-300 font-medium transition-all duration-700'
                : 'hover:bg-primary-50/40 cursor-pointer'
            }
            emptyMessage="No investigation cases matching criteria."
          />
        )}
      </div>

      {/* S14 Case Detail Modal Inspector */}
      <Modal
        isOpen={Boolean(selectedCaseId)}
        onClose={() => {
          setSelectedCaseId(null)
          fetchCases()
        }}
        title="Case Detail & Forensic Investigation Console"
        size="xl"
      >
        {selectedCaseId && (
          <CaseDetailPage
            caseId={selectedCaseId}
            onClose={() => {
              setSelectedCaseId(null)
              fetchCases()
            }}
          />
        )}
      </Modal>
    </div>
  )
}

export default InvestigatePage
