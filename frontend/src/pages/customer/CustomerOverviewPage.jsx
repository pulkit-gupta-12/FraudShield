import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Lock,
  ArrowRight,
  TrendingUp,
  Receipt,
  ShieldAlert,
  PlusCircle,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getCards, updateCardStatus } from '../../services/cards.js'
import { getAlerts, updateAlert } from '../../services/alerts.js'
import { createNotification } from '../../services/notifications.js'
import { getOverviewStats } from '../../services/stats.js'
import { CardVisual } from '../../components/ui/CardVisual.jsx'
import { SpendingChart } from '../../components/charts/SpendingChart.jsx'
import { AlertCard } from '../../components/ui/AlertCard.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import toast from 'react-hot-toast'

/**
 * Screen S16: Customer Cards & Overview
 * Displays the logged-in customer's own cards, spending breakdown,
 * quick stats from stats service, and active alerts.
 * Blocked cards display a prominent red BLOCKED chip.
 */
export function CustomerOverviewPage() {
  const { user } = useAuth()

  const [cards, setCards] = useState([])
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Card blocking confirmation modal
  const [blockModalCard, setBlockModalCard] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [cardsRes, alertsRes, statsRes] = await Promise.all([
        getCards({ userId: user?.id, pageSize: 10 }),
        getAlerts({ userId: user?.id, status: 'new', pageSize: 3 }),
        getOverviewStats(), // DATA RULE #2
      ])
      setCards(cardsRes.results || [])
      setAlerts(alertsRes.results || [])
      setStats(statsRes)
    } catch (err) {
      setError(err.message || 'Failed to load customer overview data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  // Toggle card block status
  const handleToggleCardStatus = async (card) => {
    const newStatus = card.status === 'blocked' ? 'active' : 'blocked'
    setActionLoading(true)
    try {
      await updateCardStatus(card.id, newStatus)
      toast.success(
        newStatus === 'blocked'
          ? `Card ${card.cardNumber.slice(-4)} has been BLOCKED.`
          : `Card ${card.cardNumber.slice(-4)} has been reactivated.`,
      )
      // Reload customer cards
      const res = await getCards({ userId: user?.id, pageSize: 10 })
      setCards(res.results || [])
    } catch (err) {
      toast.error(err.message || 'Failed to update card status')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle "Yes that was me" on alert
  const handleConfirmLegit = async (alert) => {
    try {
      await updateAlert(alert.id, { status: 'safe_confirmed' })
      toast.success('Transaction confirmed as authorized.')
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
    } catch (err) {
      toast.error(err.message || 'Failed to update alert')
    }
  }

  // Handle "No, not me" on alert
  const handleReportFraud = async (alert) => {
    try {
      await updateAlert(alert.id, { status: 'fraud_confirmed' })
      await createNotification({
        title: 'Fraud Alert Reported',
        message: `You reported unauthorized transaction ${alert.transactionId} at ${alert.merchant}.`,
        type: 'danger',
        userId: user?.id,
      })

      // Find the card to offer blocking
      const targetCard = cards.find((c) => c.status !== 'blocked') || cards[0]
      if (targetCard) {
        setBlockModalCard(targetCard)
      } else {
        toast.error('Alert recorded as unauthorized fraud!')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to report fraud')
    }
  }

  const confirmBlockCardFromModal = async () => {
    if (!blockModalCard) return
    try {
      await updateCardStatus(blockModalCard.id, 'blocked')
      toast.success(`Card ending in ${blockModalCard.cardNumber.slice(-4)} successfully BLOCKED.`, {
        icon: '🔒',
      })
      setBlockModalCard(null)
      const res = await getCards({ userId: user?.id, pageSize: 10 })
      setCards(res.results || [])
    } catch (err) {
      toast.error(err.message || 'Failed to block card')
    }
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <ErrorState
          title="Overview Unavailable"
          message={error}
          onRetry={loadData}
        />
      </div>
    )
  }

  const activeCount = cards.filter((c) => c.status === 'active').length
  const blockedCount = cards.filter((c) => c.status === 'blocked').length

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Welcome back, {user?.name || 'Customer'}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
              Customer Hub
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Monitor your credit cards, monthly expenditures, and real-time fraud alerts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 shadow-xs transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/customer/transactions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-xs transition"
          >
            <Receipt className="w-4 h-4" />
            View All Transactions
          </Link>
        </div>
      </div>

      {/* KPI Stats Bar (DATA RULE #2 - calls src/services/stats.js) */}
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
              title="Active Cards"
              value={activeCount}
              subtitle="Registered Payment Cards"
              icon={CreditCard}
              color="primary"
            />
            <StatCard
              title="Blocked Cards"
              value={blockedCount}
              subtitle={blockedCount > 0 ? 'Protected from unauthorized charges' : 'All cards healthy'}
              icon={Lock}
              color={blockedCount > 0 ? 'risk' : 'safe'}
            />
            <StatCard
              title="Fraud Alerts"
              value={alerts.length}
              subtitle={alerts.length > 0 ? 'Pending your review' : 'No suspicious alerts'}
              icon={ShieldAlert}
              color={alerts.length > 0 ? 'review' : 'safe'}
            />
            <StatCard
              title="Active Disputes"
              value={stats?.openCases ?? 0}
              subtitle="Under review by ops"
              icon={AlertTriangle}
              color="primary"
            />
          </>
        )}
      </div>

      {/* Urgent Fraud Advisories (if any) */}
      {alerts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Urgent Security Alerts Requiring Attention
            </h3>
            <Link
              to="/customer/alerts"
              className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1"
            >
              Alerts Center ({alerts.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onConfirmLegit={handleConfirmLegit}
                onReportFraud={handleReportFraud}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cards Showcase & Spending Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Cols: My Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary-600" />
                My Payment Cards
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Manage your physical & virtual credit lines
              </p>
            </div>
            <button
              type="button"
              onClick={() => toast.success('New card request initiated with your bank')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700 shadow-xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Request Card
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-56 rounded-2xl" />
              <Skeleton className="h-56 rounded-2xl" />
            </div>
          ) : cards.length === 0 ? (
            <EmptyState
              title="No cards on file"
              description="You do not have any registered cards in your customer profile."
              action={
                <button
                  type="button"
                  onClick={loadData}
                  className="px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-semibold"
                >
                  Reload
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {cards.map((c) => (
                <CardVisual
                  key={c.id}
                  card={c}
                  onToggleStatus={handleToggleCardStatus}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Spending Chart */}
        <div className="space-y-6">
          <SpendingChart />
        </div>
      </div>

      {/* Modal Offering to Block Card when Fraud is reported */}
      <Modal
        isOpen={Boolean(blockModalCard)}
        onClose={() => setBlockModalCard(null)}
        title="Immediate Card Protection"
        size="md"
      >
        <div className="space-y-4 text-sm">
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Fraud reported! </span>
              Would you like to instantly freeze and block your card ending in{' '}
              <span className="font-mono font-bold">
                {blockModalCard?.cardNumber?.slice(-4) || 'your card'}
              </span>{' '}
              to prevent any further unauthorized charges?
            </div>
          </div>

          <p className="text-xs text-neutral-600 leading-relaxed">
            Blocking this card will suspend all online, POS, and contactless transactions immediately.
            A new replacement card will be scheduled automatically.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setBlockModalCard(null)}
              className="px-4 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Keep Active For Now
            </button>
            <button
              type="button"
              id="confirm-block-card-button"
              onClick={confirmBlockCardFromModal}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-sm shadow-red-600/30 flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              Yes, Block Card Now
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CustomerOverviewPage
