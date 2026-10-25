import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Briefcase,
  AlertTriangle,
  TrendingUp,
  Search,
  UploadCloud,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Cpu,
  Radio,
} from 'lucide-react'
import {
  getOverviewStats,
  getTimeseriesStats,
  getMerchantStats,
} from '../../services/stats.js'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { ChartCard } from '../../components/ui/ChartCard.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import toast from 'react-hot-toast'

/**
 * Screen S15: Fraud Analyst Operations Dashboard
 * Follows DATA RULE #2: All KPI numbers and charts call src/services/stats.js.
 * Wraps Recharts in ChartCard with tooltips, legends and loading skeleton.
 */
export function AnalystDashboard() {
  const [stats, setStats] = useState(null)
  const [timeseries, setTimeseries] = useState([])
  const [riskyMerchants, setRiskyMerchants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [overview, dailyTrends, merchants] = await Promise.all([
        getOverviewStats(),
        getTimeseriesStats({ days: 14 }),
        getMerchantStats({ limit: 5 }),
      ])
      setStats(overview)
      setTimeseries(dailyTrends || [])
      setRiskyMerchants(merchants || [])
    } catch (err) {
      setError(err.message || 'Failed to aggregate analyst operations telemetry')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <ErrorState
          title="Analyst Operations Center Offline"
          message={error}
          onRetry={loadData}
        />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Analyst Operations Command
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 uppercase tracking-wider">
              Fraud Ops
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Active investigation queue velocity, merchant risk clusters, and triage workload
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 shadow-xs transition"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/analyst/investigate"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-xs transition"
          >
            <Search className="w-4 h-4" />
            Investigate Queue
          </Link>
          <Link
            to="/analyst/live"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Live Stream
          </Link>
        </div>
      </div>

      {/* Zero State for Fresh Database (Task 13) */}
      {!loading && (stats?.totalTransactions === 0 || (stats?.openCases === 0 && stats?.activeAlerts === 0 && (stats?.totalTransactions ?? 0) === 0)) && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-primary-50 to-indigo-50 border border-primary-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white rounded-xl shadow-xs text-primary-600 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                No activity yet. Make a payment as a customer to see alerts here.
              </h3>
              <p className="text-xs text-neutral-600 mt-0.5">
                Use the Transaction Checker or customer entry points to process real transactions through the XGBoost model.
              </p>
            </div>
          </div>
          <Link
            to="/checker"
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shrink-0 transition shadow-xs flex items-center gap-1.5"
          >
            <span>Launch Checker</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* KPI Cards (DATA RULE #2 - calls src/services/stats.js) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </>
        ) : (
          <>
            <StatCard
              title="Cases Open"
              value={stats?.openCases ?? 0}
              subtitle="Pending analyst triage"
              icon={Briefcase}
              color="review"
            />
            <StatCard
              title="Active Alerts"
              value={stats?.activeAlerts ?? 0}
              subtitle="New anomalous events"
              icon={AlertTriangle}
              color="risk"
            />
            <StatCard
              title="Average Risk Score"
              value={stats?.scoringAvg !== undefined ? `${(stats.scoringAvg).toFixed(2)} ms` : '0.12'}
              subtitle="Model inference metric"
              icon={Activity}
              color="safe"
            />
            <StatCard
              title="Risky Merchants"
              value={riskyMerchants.length}
              subtitle="Flagged threshold breach"
              icon={TrendingUp}
              color="primary"
            />
          </>
        )}
      </div>

      {/* Charts Row using ChartCard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Area Chart: Daily Flagged Transactions (14 Days) */}
        <ChartCard
          title="Daily Flagged Volume (Last 14 Days)"
          subtitle="Anomalous charges intercepted per day"
        >
          {loading ? (
            <div className="h-64 flex flex-col justify-center space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries}>
                  <defs>
                    <linearGradient id="flaggedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="suspicious"
                    name="Flagged Charges"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#flaggedGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Bar Chart: Top 5 Risky Merchants */}
        <ChartCard
          title="Top 5 High-Risk Merchants"
          subtitle="Merchants with highest anomalous charge count"
        >
          {loading ? (
            <div className="h-64 flex flex-col justify-center space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskyMerchants} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="merchant" type="category" width={110} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => [v, 'Flags']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="fraud" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Quick Actions Surface */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-neutral-900">Analyst Operational Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/analyst/investigate"
            className="p-4 rounded-xl border border-neutral-200 hover:border-primary-400 hover:bg-primary-50/20 transition flex flex-col justify-between group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center mb-3">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-neutral-900 group-hover:text-primary-700">
                Open Triage Queue
              </h4>
              <p className="text-[11px] text-neutral-500 mt-1">
                Triage flagged P1 and P2 customer charges
              </p>
            </div>
          </Link>

          <Link
            to="/analyst/batch"
            className="p-4 rounded-xl border border-neutral-200 hover:border-primary-400 hover:bg-primary-50/20 transition flex flex-col justify-between group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-neutral-900 group-hover:text-indigo-700">
                Batch CSV Scoring
              </h4>
              <p className="text-[11px] text-neutral-500 mt-1">
                Score bulk transaction datasets offline
              </p>
            </div>
          </Link>

          <Link
            to="/analyst/model"
            className="p-4 rounded-xl border border-neutral-200 hover:border-primary-400 hover:bg-primary-50/20 transition flex flex-col justify-between group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-neutral-900 group-hover:text-amber-700">
                Tune Decision Threshold
              </h4>
              <p className="text-[11px] text-neutral-500 mt-1">
                Simulate precision vs recall live
              </p>
            </div>
          </Link>

          <Link
            to="/analyst/live"
            className="p-4 rounded-xl border border-neutral-200 hover:border-primary-400 hover:bg-primary-50/20 transition flex flex-col justify-between group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-neutral-900 group-hover:text-emerald-700">
                Live Real-Time Feed
              </h4>
              <p className="text-[11px] text-neutral-500 mt-1">
                Observe live ingestion stream
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AnalystDashboard
