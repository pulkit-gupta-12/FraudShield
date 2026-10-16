import React, { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getTransactions } from '../../services/transactions.js'
import { getOverviewStats } from '../../services/stats.js'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { RiskMeter } from '../../components/charts/RiskMeter.jsx'
import { FactorsChart } from '../../components/charts/FactorsChart.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import toast from 'react-hot-toast'

/**
 * Screen S17: My Transactions
 * Follows DATA RULE #1: Uses DataTable in SERVER-SIDE mode.
 * Follows DATA RULE #2: KPI cards call src/services/stats.js.
 * Shows only the logged-in customer's transactions.
 * Row click opens read-only Transaction Detail modal.
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

  // KPI stats from stats service (DATA RULE #2)
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Selected transaction for read-only detail modal
  const [selectedTxn, setSelectedTxn] = useState(null)

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

  // Fetch paginated transactions from backend/service (DATA RULE #1)
  const fetchTransactions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const res = await getTransactions({
        page,
        pageSize,
        search,
        ordering,
        riskTier,
        status: statusFilter,
        userId: user.id, // Only logged-in customer's data
      })
      setTransactions(res.results || [])
      setTotalCount(res.count || 0)
    } catch (err) {
      setError(err.message || 'Failed to load transaction history')
    } finally {
      setLoading(false)
    }
  }, [user, page, pageSize, search, ordering, riskTier, statusFilter])

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Table columns definition
  const columns = [
    {
      key: 'timestamp',
      header: 'Date & Time',
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
      header: 'Merchant & Category',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-neutral-900 text-xs block">{row.merchant}</span>
          <span className="text-[11px] text-neutral-500">{row.merchantCategory || 'Retail'}</span>
        </div>
      ),
    },
    {
      key: 'cardNumber',
      header: 'Card Used',
      render: (row) => (
        <span className="font-mono text-xs text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
          {row.cardNumber ? `•••• ${row.cardNumber.slice(-4)}` : '•••• 4242'}
        </span>
      ),
    },
    {
      key: 'amountINR',
      header: 'Amount',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-neutral-900 text-xs font-mono">
          ₹{(row.amountINR || row.amount || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'riskScore',
      header: 'Risk Assessment',
      sortable: true,
      render: (row) => <RiskBadge score={row.riskScore ?? 0} size="sm" />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const isBlocked = row.status?.toLowerCase() === 'blocked'
        const isFlagged = row.status?.toLowerCase().includes('review') || row.status?.toLowerCase() === 'flagged'
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isBlocked
                ? 'bg-red-100 text-red-700'
                : isFlagged
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {row.status || 'Approved'}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              My Cards & Transactions
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 uppercase tracking-wider">
              Audit Record
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Real-time ledger of your card charges scored with millisecond AI risk evaluation
          </p>
        </div>
      </div>

      {/* Summary KPI Cards (DATA RULE #2: calls src/services/stats.js) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsLoading ? (
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </>
        ) : (
          <>
            <StatCard
              title="Total Transactions"
              value={totalCount}
              subtitle="Logged in your card history"
              icon={Receipt}
              color="primary"
            />
            <StatCard
              title="Flagged Anomalies"
              value={stats?.suspiciousCount ?? 0}
              subtitle="Under algorithmic review"
              icon={AlertTriangle}
              color="review"
            />
            <StatCard
              title="Disputes Open"
              value={stats?.openCases ?? 0}
              subtitle="Active customer inquiries"
              icon={CreditCard}
              color="safe"
            />
          </>
        )}
      </div>

      {/* Main Server-side DataTable Section */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 space-y-4">
        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b border-neutral-100">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-neutral-600 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-neutral-400" /> Filter:
            </span>
            <select
              value={riskTier}
              onChange={(e) => {
                setRiskTier(e.target.value)
                setPage(1)
              }}
              className="text-xs rounded-lg border border-neutral-300 py-1.5 px-2.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="ALL">All Risk Tiers</option>
              <option value="LEGIT">Safe / Legit</option>
              <option value="SUSPICIOUS">Suspicious</option>
              <option value="FRAUD">High Risk / Fraud</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="text-xs rounded-lg border border-neutral-300 py-1.5 px-2.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Under Review">Under Review</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <span className="text-xs text-neutral-400 font-mono self-end sm:self-auto">
            Showing {transactions.length} of {totalCount} records
          </span>
        </div>

        {/* Error State with Retry (DATA RULE #4) */}
        {error ? (
          <ErrorState
            title="Could not load transactions"
            message={error}
            onRetry={fetchTransactions}
          />
        ) : (
          <DataTable
            columns={columns}
            data={transactions}
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
            searchPlaceholder="Search merchant, card, or reference..."
            onRowClick={(row) => setSelectedTxn(row)}
            emptyMessage="No transactions matching your criteria."
          />
        )}
      </div>

      {/* Transaction Detail Modal (Read-Only) */}
      <Modal
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
        title="Transaction Security Profile"
        size="lg"
      >
        {selectedTxn && (
          <div className="space-y-6">
            {/* Top Overview */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
              <div>
                <span className="text-[11px] font-mono text-neutral-400 uppercase">
                  Reference: {selectedTxn.id}
                </span>
                <h3 className="text-xl font-extrabold text-neutral-900 mt-0.5">
                  ₹{(selectedTxn.amountINR || selectedTxn.amount || 0).toLocaleString('en-IN')}
                </h3>
                <div className="text-xs text-neutral-600 mt-1 flex items-center gap-2">
                  <span className="font-semibold">{selectedTxn.merchant}</span>
                  <span>·</span>
                  <span>{selectedTxn.merchantCategory || 'Retail'}</span>
                </div>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                <RiskBadge score={selectedTxn.riskScore ?? 0} size="md" />
                <span className="text-xs text-neutral-500 font-mono">
                  {new Date(selectedTxn.timestamp).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Risk Gauge & Explainable AI attribution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="bg-white p-4 rounded-xl border border-neutral-200 flex flex-col items-center text-center">
                <h4 className="text-xs font-bold uppercase text-neutral-500 mb-2">
                  AI Model Risk Gauge
                </h4>
                <RiskMeter score={selectedTxn.riskScore ?? 0} size={150} />
              </div>

              <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2 text-xs">
                <h4 className="text-xs font-bold uppercase text-neutral-500 mb-2">
                  Transaction Metadata
                </h4>
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-500">Location City</span>
                  <span className="font-semibold text-neutral-800">{selectedTxn.city || 'Mumbai'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-500">Payment Channel</span>
                  <span className="font-semibold text-neutral-800">{selectedTxn.channel || 'Online / POS'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-500">Card Number</span>
                  <span className="font-mono font-semibold text-neutral-800">{selectedTxn.cardNumber || '•••• 4242'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">Authorization Status</span>
                  <span className="font-bold text-emerald-600">{selectedTxn.status || 'Approved'}</span>
                </div>
              </div>
            </div>

            {/* Explainable AI Top Factors Chart */}
            {selectedTxn.explanationFactors?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-neutral-500">
                  Explainable AI (Top Scoring Drivers)
                </h4>
                <FactorsChart factors={selectedTxn.explanationFactors} />
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="px-5 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default MyTransactionsPage
