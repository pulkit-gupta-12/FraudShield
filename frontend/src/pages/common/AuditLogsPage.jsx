import React, { useState, useEffect, useCallback } from 'react'
import {
  Shield,
  Download,
  Filter,
  Search,
  Clock,
  Terminal,
  CheckCircle2,
  XCircle,
  FileText,
  User,
} from 'lucide-react'
import { getAuditLogs } from '../../services/auditLogs.js'
import { exportToCSV } from '../../utils/csv.js'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { formatDateTime } from '../../utils/format.js'
import toast from 'react-hot-toast'

/**
 * Screen S26: System Audit Logs & Forensic History
 * Follows DATA RULE #1: DataTable in SERVER-SIDE mode.
 * Follows DATA RULE #4: ErrorState with retry on error.
 * Exports downloadable CSV via src/utils/csv.js.
 * Zero imports from src/mock.
 */
export function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [search, setSearch] = useState('')
  const [ordering, setOrdering] = useState('-timestamp')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAuditLogs({
        page,
        pageSize,
        search,
        ordering,
        action: actionFilter,
        status: statusFilter,
      })
      setLogs(data.results || [])
      setTotalCount(data.count || 0)
    } catch (err) {
      setError(err.message || 'Failed to retrieve system audit logs')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, ordering, actionFilter, statusFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleExportCSV = async () => {
    try {
      const allData = await getAuditLogs({ page: 1, pageSize: 200, search, ordering })
      const exportList = (allData.results || []).map((l) => ({
        'Log ID': l.id,
        Timestamp: l.timestamp,
        Actor: l.actor,
        Role: l.actorRole,
        Action: l.action,
        Target: l.target,
        'IP Address': l.ipAddress,
        Status: l.status,
        Details: l.details,
      }))
      exportToCSV(exportList, `fraudshield_audit_logs_${Date.now()}.csv`)
      toast.success('Audit logs CSV exported successfully')
    } catch (err) {
      toast.error('Failed to export CSV: ' + err.message)
    }
  }

  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      sortable: true,
      render: (val) => <span className="font-mono text-xs text-neutral-500">{formatDateTime(val)}</span>,
    },
    {
      key: 'id',
      label: 'Log ID',
      sortable: true,
      render: (row) => {
        const idVal = typeof row === 'object' && row !== null ? row.id : row
        return <span className="font-mono text-xs font-semibold text-neutral-900">{idVal}</span>
      },
    },
    {
      key: 'actor',
      label: 'Operator / Actor',
      sortable: true,
      render: (row, fullRow) => {
        const r = (fullRow && typeof fullRow === 'object') ? fullRow : (row && typeof row === 'object' ? row : {})
        const actorName = r.actor || r.actorName || (typeof row === 'string' ? row : 'System')
        const role = r.actorRole || 'system'
        return (
          <div>
            <span className="text-xs font-semibold text-neutral-900">{actorName}</span>
            <span className="block text-[10px] text-neutral-400 capitalize">{role}</span>
          </div>
        )
      },
    },
    {
      key: 'action',
      label: 'Operation Action',
      sortable: true,
      render: (row) => {
        const actionVal = typeof row === 'object' && row !== null ? row.action : row
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
            {actionVal}
          </span>
        )
      },
    },
    {
      key: 'target',
      label: 'Subsystem Target',
      render: (row) => {
        const targetVal = typeof row === 'object' && row !== null ? row.target : row
        return <span className="text-xs text-neutral-600 font-medium">{targetVal}</span>
      },
    },
    {
      key: 'ipAddress',
      label: 'Origin IP',
      render: (row) => {
        const ipVal = typeof row === 'object' && row !== null ? row.ipAddress : row
        return <span className="font-mono text-xs text-neutral-500">{ipVal}</span>
      },
    },
    {
      key: 'status',
      label: 'Execution Status',
      sortable: true,
      render: (row) => {
        const statusVal = typeof row === 'object' && row !== null ? row.status : row
        const isSuccess = statusVal === 'SUCCESS'
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              isSuccess
                ? 'bg-safe-50 text-safe-700 border-safe-200'
                : 'bg-risk-50 text-risk-700 border-risk-200'
            }`}
          >
            {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {statusVal}
          </span>
        )
      },
    },
    {
      key: 'details',
      label: 'Forensic Details',
      render: (row) => {
        const det = typeof row === 'object' && row !== null ? row.details : row
        return (
          <span className="text-xs text-neutral-500 truncate max-w-xs block" title={det}>
            {det}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              System Audit Logs & Compliance Trail
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
              <Terminal className="w-3.5 h-3.5" />
              S26 Registry
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Immutable forensic log of administrative overrides, authentication events, and model policy updates.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 shadow-sm transition"
        >
          <Download className="w-3.5 h-3.5 text-neutral-500" />
          Export Audit Trail (CSV)
        </button>
      </div>

      {/* Filter and Table Container */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value)
                setPage(1)
              }}
              className="text-xs font-medium rounded-xl border border-neutral-200 px-3 py-1.5 bg-neutral-50 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="ALL">All Actions</option>
              <option value="USER_LOGIN">USER_LOGIN</option>
              <option value="CARD_BLOCKED">CARD_BLOCKED</option>
              <option value="RULE_UPDATED">RULE_UPDATED</option>
              <option value="TRANSACTION_OVERRIDE">TRANSACTION_OVERRIDE</option>
              <option value="DISPUTE_FILED">DISPUTE_FILED</option>
              <option value="MODEL_RETRAIN_TRIGGERED">MODEL_RETRAIN_TRIGGERED</option>
              <option value="USER_ROLE_CHANGED">USER_ROLE_CHANGED</option>
              <option value="EXPORT_CSV_DOWNLOADED">EXPORT_CSV_DOWNLOADED</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="text-xs font-medium rounded-xl border border-neutral-200 px-3 py-1.5 bg-neutral-50 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILURE">FAILURE</option>
            </select>
          </div>

          <div className="text-xs text-neutral-500 font-medium">
            Total records recorded: <span className="font-bold text-neutral-900">{totalCount}</span>
          </div>
        </div>

        {error ? (
          <ErrorState
            title="Unable to load audit logs"
            message={error}
            onRetry={fetchLogs}
          />
        ) : (
          <DataTable
            data={logs}
            columns={columns}
            loading={loading}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onSortChange={setOrdering}
            onSearchChange={(q) => {
              setSearch(q)
              setPage(1)
            }}
            emptyMessage="No audit logs found matching criteria."
          />
        )}
      </div>
    </div>
  )
}

export default AuditLogsPage
