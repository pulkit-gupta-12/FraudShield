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
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getAlerts, updateAlert } from '../../services/alerts.js'
import { getCards, updateCardStatus } from '../../services/cards.js'
import { createNotification } from '../../services/notifications.js'
import { AlertCard } from '../../components/ui/AlertCard.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import toast from 'react-hot-toast'

/**
 * Screen S18: Security & Alerts Desk
 * Follows DATA RULE #1: Server-side pagination & filter querying.
 * When the customer answers 'No, not me' on an alert:
 * 1. Updates alert to 'fraud_confirmed'
 * 2. Creates a notification
 * 3. Prompts user to block the card (which marks card as 'blocked')
 */
export function CustomerAlertsPage() {
  const { user } = useAuth()

  const [alerts, setAlerts] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Card block confirmation modal state
  const [blockModalCard, setBlockModalCard] = useState(null)
  const [reportedAlert, setReportedAlert] = useState(null)

  const fetchAlerts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const res = await getAlerts({
        page,
        pageSize,
        status: statusFilter,
        userId: user.id, // Only logged-in customer's own alerts
      })
      setAlerts(res.results || [])
      setTotalCount(res.count || 0)
    } catch (err) {
      setError(err.message || 'Failed to load security alerts')
    } finally {
      setLoading(false)
    }
  }, [user, page, pageSize, statusFilter])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // "Yes, that was me"
  const handleConfirmLegit = async (alert) => {
    setActionLoading(true)
    try {
      await updateAlert(alert.id, { status: 'safe_confirmed' })
      toast.success('Thank you! Alert resolved as authorized by you.')
      fetchAlerts()
    } catch (err) {
      toast.error(err.message || 'Failed to update alert')
    } finally {
      setActionLoading(false)
    }
  }

  // "No, not me" -> CRITICAL REQUIREMENT
  const handleReportFraud = async (alert) => {
    setActionLoading(true)
    try {
      // 1. Update alert
      await updateAlert(alert.id, { status: 'fraud_confirmed' })

      // 2. Create notification
      await createNotification({
        title: 'Unauthorized Transaction Flagged',
        message: `Alert ${alert.id} for ₹${alert.amountINR || alert.amount} at ${alert.merchant} flagged as unauthorized.`,
        type: 'danger',
        userId: user?.id,
      })

      setReportedAlert(alert)

      // 3. Find card to offer blocking
      const cardsRes = await getCards({ userId: user?.id })
      const activeCard = (cardsRes.results || []).find((c) => c.status !== 'blocked') || cardsRes.results?.[0]

      if (activeCard) {
        setBlockModalCard(activeCard)
      } else {
        toast.success('Alert marked as fraud and escalated to our security team.')
      }

      fetchAlerts()
    } catch (err) {
      toast.error(err.message || 'Failed to process fraud report')
    } finally {
      setActionLoading(false)
    }
  }

  // Confirm card block in modal
  const handleConfirmCardBlock = async () => {
    if (!blockModalCard) return
    try {
      await updateCardStatus(blockModalCard.id, 'blocked')
      toast.success(
        `Card ending in ${blockModalCard.cardNumber.slice(-4)} has been BLOCKED. It now displays the red BLOCKED badge across your account.`,
        { icon: '🛡️', duration: 4500 },
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Security & Fraud Alerts Center
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              Real-Time Defense
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Review anomalous charges detected by our AI engine and take protective action immediately
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAlerts}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold shadow-xs transition w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Alerts
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
        {[
          { id: 'ALL', label: 'All Alerts' },
          { id: 'new', label: 'Action Required' },
          { id: 'safe_confirmed', label: 'Verified Safe' },
          { id: 'fraud_confirmed', label: 'Reported Fraud' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setStatusFilter(tab.id)
              setPage(1)
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === tab.id
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alert Cards Grid / Error State (DATA RULE #4) */}
      {error ? (
        <ErrorState
          title="Security Center Offline"
          message={error}
          onRetry={fetchAlerts}
        />
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          title="No security advisories"
          description="Your cards have no pending fraud alerts matching this filter."
          action={
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL')
                setPage(1)
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-semibold"
            >
              Reset Filter
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                loading={actionLoading}
                onConfirmLegit={handleConfirmLegit}
                onReportFraud={handleReportFraud}
              />
            ))}
          </div>

          {/* Simple pagination footer for server-side alerts */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between pt-4 border-t border-neutral-200 text-xs">
              <span className="text-neutral-500">
                Page {page} of {Math.ceil(totalCount / pageSize)} ({totalCount} total)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-50 font-semibold"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= Math.ceil(totalCount / pageSize)}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-50 font-semibold"
                >
                  Next
                </button>
              </div>
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
            ? A blocked card cannot be used for any further POS, ATM, or online payments.
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
              id="confirm-card-block-action"
              onClick={handleConfirmCardBlock}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-sm shadow-red-600/30 flex items-center gap-1.5"
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
