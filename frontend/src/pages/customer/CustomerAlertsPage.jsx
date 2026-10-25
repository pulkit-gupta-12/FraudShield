import React, { useState, useEffect, useCallback } from 'react'
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Lock,
  Filter,
  RefreshCw,
  Bell,
  Clock,
  ArrowRight,
  FileCheck2,
  Layers,
  Flag,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getAlerts, updateAlert } from '../../services/alerts.js'
import { getCards, updateCardStatus } from '../../services/cards.js'
import { createNotification } from '../../services/notifications.js'
import { getMyReports } from '../../services/transactions.js'
import { AlertCard } from '../../components/ui/AlertCard.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { Stepper } from '../../components/ui/Stepper.jsx'
import toast from 'react-hot-toast'

const DISPUTE_STEPS = [
  { label: 'Evidence Collection', description: 'Merchant gathering proof' },
  { label: 'Under Review', description: 'Analyst inspecting dispute' },
  { label: 'Arbitration', description: 'Network ruling' },
  { label: 'Resolved', description: 'Final decision settled' },
]

function getDisputeStepIndex(stage, status) {
  const s = (stage || status || '').toLowerCase()
  if (s === 'resolved' || s === 'closed' || s === 'won' || s === 'lost') return 3
  if (s === 'arbitration') return 2
  if (s === 'under_review' || s === 'review') return 1
  return 0 // evidence_collection or open
}

/**
 * Screen S18: Security & Alerts Desk
 * Tabs:
 *  1. Security Alerts: Real-time fraud warnings
 *  2. My Reports: Customer reported transactions with live case status and merchant dispute Stepper
 */
export function CustomerAlertsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('alerts') // 'alerts' | 'reports'

  // Alerts State
  const [alerts, setAlerts] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [newAlertIds, setNewAlertIds] = useState(new Set())

  // My Reports State
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState(null)

  // Card block confirmation modal state
  const [blockModalCard, setBlockModalCard] = useState(null)
  const [reportedAlert, setReportedAlert] = useState(null)

  // Fetch Alerts
  const fetchAlerts = useCallback(
    async (isPolling = false) => {
      if (!user) return
      if (!isPolling) setLoading(true)
      setError(null)
      try {
        const res = await getAlerts({
          page,
          pageSize,
          status: statusFilter,
          userId: user.id,
        })
        const list = res.results || []

        if (isPolling) {
          setAlerts((prev) => {
            const prevIds = new Set(prev.map((a) => a.id))
            const fresh = new Set()
            list.forEach((a) => {
              if (!prevIds.has(a.id)) fresh.add(a.id)
            })
            if (fresh.size > 0) {
              setNewAlertIds(fresh)
              setTimeout(() => setNewAlertIds(new Set()), 3500)
            }
            return list
          })
        } else {
          setAlerts(list)
        }
        setTotalCount(res.count || 0)
      } catch (err) {
        setError(err.message || 'Failed to load security alerts')
      } finally {
        setLoading(false)
      }
    },
    [user, page, pageSize, statusFilter]
  )

  // Fetch Reports
  const fetchReports = useCallback(
    async (isPolling = false) => {
      if (!user) return
      if (!isPolling) setReportsLoading(true)
      setReportsError(null)
      try {
        const res = await getMyReports()
        setReports(res.results || [])
      } catch (err) {
        setReportsError(err.message || 'Failed to load customer reports')
      } finally {
        setReportsLoading(false)
      }
    },
    [user]
  )

  // Initial and 10s polling
  useEffect(() => {
    fetchAlerts(false)
    fetchReports(false)

    const interval = setInterval(() => {
      fetchAlerts(true)
      fetchReports(true)
    }, 10000)

    const handleFocus = () => {
      fetchAlerts(true)
      fetchReports(true)
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleFocus()
    })

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchAlerts, fetchReports])

  // "Yes, that was me"
  const handleConfirmLegit = async (alert) => {
    setActionLoading(true)
    try {
      await updateAlert(alert.id, { status: 'safe_confirmed' })
      toast.success('Thank you! Alert resolved as authorized by you.')
      fetchAlerts(true)
    } catch (err) {
      toast.error(err.message || 'Failed to update alert')
    } finally {
      setActionLoading(false)
    }
  }

  // "No, not me"
  const handleReportFraud = async (alert) => {
    setActionLoading(true)
    try {
      await updateAlert(alert.id, { status: 'fraud_confirmed' })
      await createNotification({
        title: 'Unauthorized Transaction Flagged',
        message: `Alert ${alert.id} for ₹${alert.amountINR || alert.amount} at ${alert.merchant} flagged as unauthorized.`,
        type: 'danger',
        userId: user?.id,
      })

      const cardsRes = await getCards({ userId: user?.id })
      const matchingCard = cardsRes.results?.find(
        (c) =>
          c.cardNumber?.slice(-4) === alert.cardNumber?.slice(-4) ||
          c.last4 === alert.cardNumber?.slice(-4)
      )

      if (matchingCard && matchingCard.status !== 'blocked') {
        setReportedAlert(alert)
        setBlockModalCard(matchingCard)
      } else {
        toast.error('Alert confirmed as fraud. Operations team dispatched.')
      }

      fetchAlerts(true)
    } catch (err) {
      toast.error(err.message || 'Failed to report fraud')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmCardBlock = async () => {
    if (!blockModalCard) return
    try {
      await updateCardStatus(blockModalCard.id, 'blocked')
      toast.success(
        `Card ending in ${blockModalCard.cardNumber?.slice(-4)} has been blocked successfully.`
      )
      setBlockModalCard(null)
      setReportedAlert(null)
    } catch (err) {
      toast.error(err.message || 'Failed to block card')
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Security & Alerts Desk
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Real-time step-up verifications and tracking for your reported disputes.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-neutral-100 rounded-xl border border-neutral-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'alerts'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-primary-600" />
            <span>Security Alerts</span>
            {totalCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary-100 text-primary-700 font-mono">
                {totalCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'reports'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Flag className="w-4 h-4 text-amber-600" />
            <span>My Reports</span>
            {reports.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono">
                {reports.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ──────────────── TAB 1: ALERTS ──────────────── */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Quick Filter Bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              Filter by Status
            </span>
            <div className="flex items-center gap-2">
              {['ALL', 'new', 'fraud_confirmed', 'safe_confirmed'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status)
                    setPage(1)
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    statusFilter === status
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {status === 'ALL'
                    ? 'All'
                    : status === 'new'
                    ? 'Pending Action'
                    : status.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {loading && alerts.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState
              title="No security advisories"
              description="Your cards have no pending fraud alerts matching this filter."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={newAlertIds.has(alert.id) ? 'ring-2 ring-primary-500/50 rounded-2xl' : ''}
                >
                  <AlertCard
                    alert={alert}
                    loading={actionLoading}
                    onConfirmLegit={handleConfirmLegit}
                    onReportFraud={handleReportFraud}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──────────────── TAB 2: MY REPORTS ──────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {reportsLoading && reports.length === 0 ? (
            <div className="space-y-4">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              title="No disputes or reports filed"
              description="You haven't reported any suspicious transactions. Any reported charges will appear here with live case and merchant dispute status."
            />
          ) : (
            <div className="space-y-5">
              {reports.map((rep) => {
                const tx = rep.transaction || {}
                const c = rep.case || {}
                const d = rep.dispute || {}
                const stepIdx = getDisputeStepIndex(d.stage, d.status)

                return (
                  <div
                    key={rep.id}
                    className="p-6 bg-white border border-neutral-200/80 rounded-2xl shadow-xs space-y-5"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-neutral-400">
                            REF: {tx.publicId || tx.id || `TXN-${rep.id}`}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                            {rep.reason?.replace('_', ' ') || 'Disputed'}
                          </span>
                        </div>
                        <h3 className="text-lg font-extrabold text-neutral-900 mt-1">
                          ₹{Number(tx.amountInr || tx.amountINR || 0).toLocaleString('en-IN')}{' '}
                          <span className="text-xs font-normal text-neutral-500">
                            at {tx.merchantName || tx.merchant || 'Merchant'}
                          </span>
                        </h3>
                      </div>

                      {/* Case Status Pill */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-xs text-neutral-500 font-semibold">Case Status:</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary-50 text-primary-700 border border-primary-200 uppercase">
                          {c.status?.replace('_', ' ') || 'In Investigation'}
                        </span>
                      </div>
                    </div>

                    {/* Customer Report Note */}
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/60 text-xs space-y-1">
                      <span className="font-bold text-neutral-700 uppercase text-[10px]">
                        Your Dispute Statement
                      </span>
                      <p className="text-neutral-800 leading-relaxed font-medium">
                        &quot;{rep.note || 'No statement provided'}&quot;
                      </p>
                      <span className="text-[10px] text-neutral-400 block pt-1 font-mono">
                        Reported on {new Date(rep.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Merchant Dispute Stepper */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                          Merchant Dispute Defense Progress
                        </h4>
                        <span className="text-[11px] font-mono text-neutral-400 font-bold">
                          Stage: {d.stage || 'evidence_collection'}
                        </span>
                      </div>
                      <Stepper steps={DISPUTE_STEPS} currentStep={stepIdx} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Prompting Card Block upon Fraud Confirmation */}
      <Modal
        isOpen={Boolean(blockModalCard)}
        onClose={() => setBlockModalCard(null)}
        title="Immediate Card Protection Advisory"
        size="md"
      >
        <div className="space-y-4 text-sm">
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Fraud Confirmed! </span>
              You have verified that the charge of{' '}
              <span className="font-bold">
                ₹{reportedAlert?.amountINR || reportedAlert?.amount || 0}
              </span>{' '}
              was unauthorized.
            </div>
          </div>

          <p className="text-xs text-neutral-600 leading-relaxed">
            Would you like to instantly freeze and block your card ending in{' '}
            <span className="font-mono font-bold text-neutral-900">
              {blockModalCard?.cardNumber?.slice(-4)}
            </span>
            ? A blocked card cannot be used for any further payments.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setBlockModalCard(null)}
              className="px-4 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Keep Card Active
            </button>
            <button
              type="button"
              onClick={handleConfirmCardBlock}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-sm flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              Yes, Block This Card
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CustomerAlertsPage
