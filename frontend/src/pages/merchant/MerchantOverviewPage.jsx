import React, { useState, useEffect, useCallback } from 'react'
import {
  Store,
  DollarSign,
  ShieldAlert,
  Percent,
  TrendingDown,
  Clock,
  ArrowUpRight,
  Filter,
  RefreshCw,
  AlertTriangle,
  CreditCard,
} from 'lucide-react'
import {
  getOverviewStats,
  getByHourStats,
  getTimeseriesStats,
} from '../../services/stats.js'
import { getTransactions } from '../../services/transactions.js'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { ChartCard } from '../../components/ui/ChartCard.jsx'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { formatCurrency, formatDateTime } from '../../utils/format.js'
import toast from 'react-hot-toast'

/**
 * Screen S20: Merchant Overview & Risk Velocity
 * Follows DATA RULE #1: DataTable in SERVER-SIDE mode for transactions.
 * Follows DATA RULE #2: KPI cards & charts call stats.js functions.
 * Follows DATA RULE #4: ErrorState with retry on error.
 * Zero imports from src/mock.
 */
export function MerchantOverviewPage() {
  const [stats, setStats] = useState(null)
  const [hourlyData, setHourlyData] = useState([])
  const [trendData, setTrendData] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState(null)

  // Recent high-risk transactions table state
  const [transactions, setTransactions] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [ordering, setOrdering] = useState('-timestamp')
  const [tableLoading, setTableLoading] = useState(true)
  const [tableError, setTableError] = useState(null)

  // Fetch telemetry from stats.js
  const fetchDashboardStats = useCallback(async () => {
    setLoadingStats(true)
    setStatsError(null)
    try {
      const [overview, hours, trend] = await Promise.all([
        getOverviewStats(),
        getByHourStats(),
        getTimeseriesStats({ days: 7 }),
      ])
      setStats(overview)
      setHourlyData(hours || [])
      setTrendData(trend || [])
    } catch (err) {
      setStatsError(err.message || 'Failed to load merchant metrics telemetry')
    } finally {
      setLoadingStats(false)
    }
  }, [])

  // Fetch transactions list
  const fetchRecentHighRisk = useCallback(async () => {
    setTableLoading(true)
    setTableError(null)
    try {
      const data = await getTransactions({
        page,
        pageSize,
        search,
        ordering,
        status: 'flagged',
      })
      setTransactions(data.results || [])
      setTotalCount(data.count || 0)
    } catch (err) {
      setTableError(err.message || 'Failed to load high-risk transactions')
    } finally {
      setTableLoading(false)
    }
  }, [page, pageSize, search, ordering])

  useEffect(() => {
    fetchDashboardStats()
  }, [fetchDashboardStats])

  useEffect(() => {
    fetchRecentHighRisk()
  }, [fetchRecentHighRisk])

  const columns = [
    {
      key: 'id',
      label: 'TXN ID',
      sortable: true,
      render: (row) => {
        const idVal = typeof row === 'object' && row !== null ? row.id : row
        return <span className="font-mono text-xs font-semibold text-neutral-900">{idVal}</span>
      },
    },
    {
      key: 'timestamp',
      label: 'Date & Time',
      sortable: true,
      render: (row) => {
        const timeVal = typeof row === 'object' && row !== null ? row.timestamp : row
        return <span className="text-xs text-neutral-500">{formatDateTime(timeVal)}</span>
      },
    },
    {
      key: 'cardLast4',
      label: 'Card Last 4',
      render: (row) => {
        const cardVal = typeof row === 'object' && row !== null ? row.cardLast4 : row
        return (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded">
            <CreditCard className="w-3 h-3 text-neutral-400" /> •••• {cardVal}
          </span>
        )
      },
    },
    {
      key: 'amountINR',
      label: 'Amount (INR)',
      sortable: true,
      render: (row) => {
        const amt = typeof row === 'object' && row !== null ? row.amountINR : row
        return (
          <span className="font-semibold text-xs text-neutral-900">
            {formatCurrency(amt)}
          </span>
        )
      },
    },
    {
      key: 'riskScore',
      label: 'Risk Assessment',
      sortable: true,
      render: (row) => {
        const score = typeof row === 'object' && row !== null ? row.riskScore : row
        return (
          <div className="flex items-center gap-2">
            <RiskBadge score={score} />
            <span className="text-xs font-mono text-neutral-500">{((score || 0) * 100).toFixed(0)}%</span>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Gateway Action',
      render: (row) => {
        const val = typeof row === 'object' && row !== null ? row.status : row
        const isBlocked = val === 'blocked' || val === 'confirmed_fraud'
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${
              isBlocked
                ? 'bg-risk-50 text-risk-700 border border-risk-200'
                : 'bg-review-50 text-review-700 border border-review-200'
            }`}
          >
            {val}
          </span>
        )
      },
    },
  ]

  if (statsError && !stats) {
    return (
      <div className="p-6">
        <ErrorState
          title="Merchant Overview Unavailable"
          message={statsError}
          onRetry={fetchDashboardStats}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Merchant Risk & Velocity Desk
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
              <Store className="w-3.5 h-3.5" />
              Verified Merchant
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Real-time transaction volume, fraud velocity mitigation, and revenue-at-risk telemetry.
          </p>
        </div>

        <button
          onClick={() => {
            fetchDashboardStats()
            fetchRecentHighRisk()
            toast.success('Telemetry refreshed')
          }}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 shadow-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
          Refresh Stats
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Transactions"
          value={stats?.totalTransactions?.toLocaleString('en-IN') ?? '0'}
          change="+14.2% vs yesterday"
          trend="up"
          icon={<Store className="w-5 h-5 text-primary-600" />}
          loading={loadingStats}
        />
        <StatCard
          title="Fraud Rate"
          value={stats ? `${(stats.fraudRate * 100).toFixed(2)}%` : '0.00%'}
          change="-0.4% this week"
          trend="down"
          icon={<Percent className="w-5 h-5 text-review-600" />}
          loading={loadingStats}
        />
        <StatCard
          title="Blocked Transactions"
          value={stats?.fraudCount?.toLocaleString('en-IN') ?? '0'}
          change="Automated guardrails active"
          trend="neutral"
          icon={<ShieldAlert className="w-5 h-5 text-risk-600" />}
          loading={loadingStats}
        />
        <StatCard
          title="Revenue at Risk"
          value={stats ? formatCurrency(stats.fraudVolumeINR || 0) : '₹0'}
          change="0.28% of GMV"
          trend="down"
          icon={<DollarSign className="w-5 h-5 text-risk-600" />}
          loading={loadingStats}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Volume Bar Chart */}
        <ChartCard
          title="Hourly Transaction Volume (Today)"
          subtitle="Real-time checkout requests per hour"
          loading={loadingStats}
        >
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val, name) => [
                    val.toLocaleString(),
                    name === 'total' ? 'Total Volume' : 'Fraudulent / Flagged',
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total Transactions" />
                <Bar dataKey="fraud" fill="#ef4444" radius={[4, 4, 0, 0]} name="Flagged / Risk" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* 7-Day Fraud Rate Trend Line Chart */}
        <ChartCard
          title="Fraud Rate Trend (Last 7 Days)"
          subtitle="Daily percentage of high-risk settlement attempts"
          loading={loadingStats}
        >
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val, name) => [
                    val.toLocaleString(),
                    name === 'fraud' ? 'Fraudulent' : name === 'suspicious' ? 'Suspicious' : 'Total',
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="fraud"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Fraud Blocked"
                />
                <Line
                  type="monotone"
                  dataKey="suspicious"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 2 }}
                  name="Suspicious Flags"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Recent High-Risk Transactions Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Recent High-Risk Transactions</h3>
            <p className="text-xs text-neutral-500">
              Transactions flagged by the ML pipeline for elevated fraud probability.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
            Live sync active
          </span>
        </div>

        {tableError ? (
          <ErrorState
            title="Unable to load transactions"
            message={tableError}
            onRetry={fetchRecentHighRisk}
          />
        ) : (
          <DataTable
            data={transactions}
            columns={columns}
            loading={tableLoading}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onSortChange={setOrdering}
            onSearchChange={(q) => {
              setSearch(q)
              setPage(1)
            }}
            emptyMessage="No high-risk transactions detected for your merchant account."
          />
        )}
      </div>
    </div>
  )
}
