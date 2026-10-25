import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  CreditCard,
  Search,
  Filter,
  Receipt,
  Calendar,
  AlertTriangle,
  ArrowUpDown,
  ExternalLink,
  ShieldAlert,
  Clock,
  Layers,
  MapPin,
  CheckCircle2,
  X,
  Flag,
  RotateCcw,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getTransactions, reportTransaction } from '../../services/transactions.js'
import { getOverviewStats } from '../../services/stats.js'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { Drawer } from '../../components/ui/Drawer.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { RiskMeter } from '../../components/charts/RiskMeter.jsx'
import { FactorsChart } from '../../components/charts/FactorsChart.jsx'
import toast from 'react-hot-toast'

/**
 * Screen S17: My Transactions
 * Follows DATA RULE #1: Uses DataTable in SERVER-SIDE mode.
 * Polling every 10 seconds + focus listener.
 * Drawer S17 with 'Report this transaction' workflow and 'Reported' chip.
 */
export function MyTransactionsPage() {
  const { user } = useAuth()

  // Transactions list state (Server-side controlled)
  const [transactions, setTransactions] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [ordering, setOrdering] = useState('-timestamp')
  const [riskTier, setRiskTier] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newRowIds, setNewRowIds] = useState(new Set())
  const [reportedIds, setReportedIds] = useState(new Set())

  // KPI stats from stats service (DATA RULE #2)
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Selected transaction for Drawer (S17)
  const [selectedTxn, setSelectedTxn] = useState(null)

  // Report Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [reportReason, setReportReason] = useState('unauthorized')
  const [reportNote, setReportNote] = useState('')
  const [reporting, setReporting] = useState(false)

  // Fetch KPI stats from src/services/stats.js
  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const data = await getOverviewStats()
      setStats(data)
    } catch {
      // quiet fail for secondary stats
    } finally {
      setStatsLoading(false)
    }
  }

  // Fetch paginated transactions from backend/service
  const fetchTransactions = useCallback(async (isPolling = false) => {
    if (!user) return
    if (!isPolling) setLoading(true)
    setError(null)
    try {
      const res = await getTransactions({
        page,
        pageSize,
        search,
        ordering,
        riskTier,
        status: statusFilter,
        userId: user.id,
      })
      const list = res.results || []

      if (isPolling) {
        setTransactions((prev) => {
          const prevIds = new Set(prev.map((t) => t.id || t.publicId))
          const fresh = new Set()
          list.forEach((t) => {
            const tid = t.id || t.publicId
            if (!prevIds.has(tid)) fresh.add(tid)
          })
          if (fresh.size > 0) {
            setNewRowIds(fresh)
            setTimeout(() => setNewRowIds(new Set()), 3500)
          }
          return list
        })
      } else {
        setTransactions(list)
      }
      setTotalCount(res.count || 0)
    } catch (err) {
      setError(err.message || 'Failed to load transaction history')
    } finally {
      setLoading(false)
    }
  }, [user, page, pageSize, search, ordering, riskTier, statusFilter])

  // Initial fetch and 10s polling + focus listener
  useEffect(() => {
    loadStats()
    fetchTransactions(false)

    const interval = setInterval(() => {
      fetchTransactions(true)
    }, 10000)

    const handleFocus = () => fetchTransactions(true)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleFocus()
    })

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchTransactions])

  // Report submission handler
  const handleReportSubmit = async (e) => {
    e.preventDefault()
    if (!selectedTxn) return
    if (!reportNote.trim()) {
      toast.error('Please enter an explanatory note describing the issue.')
      return
    }

    setReporting(true)
    const tid = selectedTxn.id || selectedTxn.publicId
    try {
      await reportTransaction(tid, {
        reason: reportReason,
        note: reportNote.trim().slice(0, 500),
      })
      toast.success('Dispute reported successfully! Case and Alert opened with Fraud Ops.')
      setReportedIds((prev) => new Set([...prev, tid]))
      setIsReportModalOpen(false)
      setReportNote('')
      // Refresh transactions
      fetchTransactions(true)
    } catch (err) {
      toast.error(err.message || 'Failed to submit report')
    } finally {
      setReporting(false)
    }
  }

  // Table columns definition
  const columns = [
    {
      key: 'timestamp',
      label: 'Date & Time',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-neutral-900 text-xs">
            {new Date(row.timestamp).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          <span className="text-[11px] text-neutral-400 font-mono">
            {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      key: 'merchant',
      label: 'Merchant & Category',
      sortable: true,
      render: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900 text-xs block">{row.merchant || row.merchantName}</span>
            {(reportedIds.has(row.id || row.publicId) || row.hasReported || row.reported) && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Reported
              </span>
            )}
          </div>
          <span className="text-[11px] text-neutral-500">{row.merchantCategory || 'Retail'}</span>
        </div>
      ),
    },
    {
      key: 'cardNumber',
      label: 'Card Used',
      render: (row) => (
        <span className="font-mono text-xs text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
          •••• {row.cardNumber ? row.cardNumber.slice(-4) : row.last4 || '••••'}
        </span>
      ),
    },
    {
      key: 'amountINR',
      label: 'Amount',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-neutral-900 text-xs font-mono">
          ₹{Number(row.amountINR || row.amountInr || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'riskScore',
      label: 'Risk Assessment',
      sortable: true,
      render: (row) => <RiskBadge score={row.riskScore ?? 0} size="sm" />,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const s = (row.status || 'approved').toLowerCase()
        const isReported = reportedIds.has(row.id || row.publicId) || row.hasReported || row.reported
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold capitalize border ${
                s === 'approved'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : s === 'flagged' || s === 'under_review'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : s === 'declined'
                  ? 'bg-neutral-100 text-neutral-600 border-neutral-300'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {s.replace('_', ' ')}
            </span>
            {isReported && (
              <span className="w-2 h-2 rounded-full bg-amber-500" title="Reported by you" />
            )}
          </div>
        )
      },
    },
  ]

  if (error && transactions.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <ErrorState
          title="Could Not Load Transactions"
          message={error}
          onRetry={() => fetchTransactions(false)}
        />
      </div>
    )
  }

  const isCurrentTxnReported =
    selectedTxn &&
    (reportedIds.has(selectedTxn.id || selectedTxn.publicId) ||
      selectedTxn.hasReported ||
      selectedTxn.reported)

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Cardholder Transactions
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Real-time activity ledger for all cards assigned to your profile.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Activity"
          label="Total Activity"
          value={totalCount}
          subtitle="Processed charges"
          subtext="Processed charges"
          icon={Receipt}
          loading={loading && transactions.length === 0}
        />
        <StatCard
          title="Confirmed Legit"
          label="Confirmed Legit"
          value={stats?.legitCount !== undefined ? stats.legitCount : totalCount}
          subtitle="Safe authorisations"
          subtext="Safe authorisations"
          icon={CheckCircle2}
          color="safe"
          loading={statsLoading}
        />
        <StatCard
          title="Flagged for Review"
          label="Flagged for Review"
          value={stats?.suspiciousCount !== undefined ? stats.suspiciousCount : 0}
          subtitle="Step-up / Held alerts"
          subtext="Step-up / Held alerts"
          icon={AlertTriangle}
          color="review"
          loading={statsLoading}
        />
        <StatCard
          title="Blocked by Shield"
          label="Blocked by Shield"
          value={stats?.fraudCount !== undefined ? stats.fraudCount : 0}
          subtitle="High-risk intercepts"
          subtext="High-risk intercepts"
          icon={ShieldAlert}
          color="risk"
          loading={statsLoading}
        />
      </div>

      {/* Table Section */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-neutral-100">
          <h2 className="text-sm font-bold text-neutral-900">Live Transaction Feed</h2>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={riskTier}
              onChange={(e) => {
                setRiskTier(e.target.value)
                setPage(1)
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="LEGIT">Low Risk</option>
              <option value="SUSPICIOUS">Medium Risk</option>
              <option value="FRAUD">High Fraud Risk</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50"
            >
              <option value="ALL">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="flagged">Flagged</option>
              <option value="blocked">Blocked</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={transactions}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          loading={loading && transactions.length === 0}
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
          searchPlaceholder="Search merchant, card, or reference..."
          onRowClick={(row) => setSelectedTxn(row)}
          emptyMessage="No transactions matching your criteria."
          rowClassName={(row) => {
            const id = row.id || row.publicId
            return newRowIds.has(id) ? 'bg-primary-50/60 transition-colors duration-1000' : ''
          }}
        />
      </div>

      {/* S17: Transaction Drawer */}
      <Drawer
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
        title="Transaction Security Profile"
        description="Detailed fraud inspection, location signals, and dispute options"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            {selectedTxn && selectedTxn.status !== 'declined' ? (
              isCurrentTxnReported ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                  <Flag className="w-3.5 h-3.5 text-amber-600" />
                  <span>Reported as Disputed</span>
                </span>
              ) : (
                <button
                  type="button"
                  id="report-transaction-drawer-btn"
                  onClick={() => setIsReportModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report this transaction</span>
                </button>
              )
            ) : (
              <span className="text-[11px] text-neutral-400 font-medium">
                Declined transactions cannot be disputed.
              </span>
            )}

            <button
              type="button"
              onClick={() => setSelectedTxn(null)}
              className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 transition"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedTxn && (
          <div className="space-y-6">
            {/* Top Overview */}
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">
                    Ref: {selectedTxn.id || selectedTxn.publicId}
                  </span>
                  <h3 className="text-xl font-extrabold text-neutral-900 mt-0.5">
                    ₹{Number(selectedTxn.amountINR || selectedTxn.amountInr || 0).toLocaleString('en-IN')}
                  </h3>
                  <div className="text-xs text-neutral-600 mt-1 flex items-center gap-2">
                    <span className="font-semibold">{selectedTxn.merchant || selectedTxn.merchantName}</span>
                    <span>·</span>
                    <span>{selectedTxn.merchantCategory || 'Retail'}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <RiskBadge score={selectedTxn.riskScore ?? 0} size="md" />
                  {isCurrentTxnReported && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      Reported
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-200/60 text-xs text-neutral-500 font-mono">
                {new Date(selectedTxn.timestamp).toLocaleString('en-IN')}
              </div>
            </div>

            {/* Risk Gauge */}
            <div className="bg-white p-4 rounded-xl border border-neutral-200 flex flex-col items-center text-center">
              <h4 className="text-xs font-bold uppercase text-neutral-500 mb-2">
                Real-Time Risk Gauge
              </h4>
              <RiskMeter score={selectedTxn.riskScore ?? 0} size={160} />
            </div>

            {/* Metadata */}
            <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2.5 text-xs">
              <h4 className="text-xs font-bold uppercase text-neutral-500 mb-2">
                Transaction Signals
              </h4>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Location City</span>
                <span className="font-semibold text-neutral-800">{selectedTxn.city || 'Mumbai'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Card Used</span>
                <span className="font-mono font-semibold text-neutral-800">
                  •••• {selectedTxn.cardNumber ? selectedTxn.cardNumber.slice(-4) : selectedTxn.last4 || '••••'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Authorization Status</span>
                <span className="font-bold text-neutral-900 capitalize">
                  {selectedTxn.status || 'Approved'}
                </span>
              </div>
            </div>

            {/* Factors */}
            {selectedTxn.factors?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-neutral-500">
                  Risk Factors
                </h4>
                <FactorsChart factors={selectedTxn.factors} />
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Report Transaction Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => !reporting && setIsReportModalOpen(false)}
        title="Report Suspicious Transaction"
      >
        <form onSubmit={handleReportSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
            <p className="font-bold">Filing Customer Dispute</p>
            <p className="text-[11px] leading-relaxed">
              Reporting this transaction will open a formal security case with Fraud Operations and initiate merchant inquiry.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-neutral-700 uppercase">Reason for Report</label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="unauthorized">Unauthorized / Fraudulent Charge</option>
              <option value="incorrect_amount">Incorrect Amount Charged</option>
              <option value="duplicate">Duplicate Transaction</option>
              <option value="goods_not_received">Goods / Services Not Received</option>
              <option value="cancelled_recurring">Cancelled Subscription Recurring</option>
              <option value="other">Other Unrecognized Activity</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-neutral-700 uppercase">
                Explanation Note (Required)
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">
                {reportNote.length} / 500 chars
              </span>
            </div>
            <textarea
              required
              rows={4}
              maxLength={500}
              placeholder="Please explain why you are disputing this transaction (e.g. Card was in my possession, but charge occurred in Chennai while I was in Delhi)..."
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              className="w-full p-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-100">
            <button
              type="button"
              disabled={reporting}
              onClick={() => setIsReportModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reporting || !reportNote.trim()}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
            >
              {reporting ? 'Submitting Report...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default MyTransactionsPage
