import React from 'react'
import { ShieldAlert, CheckCircle2, XCircle, Clock, CreditCard, AlertTriangle } from 'lucide-react'
import { RiskBadge } from './RiskBadge.jsx'
import clsx from 'clsx'

/**
 * Reusable AlertCard component for customer fraud advisories.
 *
 * CRITICAL BEHAVIOR:
 * When the user clicks "No, not me", triggers the fraud confirmation workflow:
 * updates the alert, creates a notification, and prompts the user to block their card.
 */
export function AlertCard({
  alert,
  onConfirmLegit,
  onReportFraud,
  loading = false,
  className = '',
}) {
  if (!alert) return null

  const isResolved = alert.status === 'resolved' || alert.status === 'safe_confirmed'
  const isFraudConfirmed = alert.status === 'fraud_confirmed' || alert.status === 'blocked'

  return (
    <div
      className={clsx(
        'bg-white rounded-2xl border p-5 shadow-xs transition-all duration-200 flex flex-col justify-between gap-4',
        isFraudConfirmed
          ? 'border-red-300 bg-red-50/20'
          : isResolved
          ? 'border-emerald-200 bg-emerald-50/10'
          : 'border-neutral-200 hover:border-primary-300 hover:shadow-md',
        className,
      )}
    >
      {/* Alert Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs',
              isFraudConfirmed
                ? 'bg-red-100 text-red-600'
                : isResolved
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-amber-100 text-amber-700',
            )}
          >
            {isFraudConfirmed ? (
              <XCircle className="w-5 h-5" />
            ) : isResolved ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-neutral-500">
                {alert.id || alert.alertId}
              </span>
              <RiskBadge score={alert.riskScore ?? 0.89} size="sm" />
            </div>
            <h4 className="font-bold text-sm text-neutral-900 mt-0.5">
              {alert.merchant || alert.merchantName || alert.transaction?.merchantName || alert.transaction?.merchant || 'FabIndia Lifestyle'}
            </h4>
          </div>
        </div>

        {/* Amount */}
        <div className="text-right">
          <div className="text-base font-extrabold text-neutral-900">
            ₹{Number(alert.amountINR || alert.amount || alert.transaction?.amountInr || alert.transaction?.amountINR || alert.transaction?.amount || 2450).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-neutral-400 flex items-center justify-end gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {alert.timestamp ? new Date(alert.timestamp).toLocaleDateString('en-IN') : 'Recent'}
          </div>
        </div>
      </div>

      {/* Trigger Rule Description */}
      <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 text-xs text-neutral-700 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-neutral-900">Trigger: </span>
          {alert.ruleTriggered || 'Anomalous velocity threshold exceeded'}
          {alert.transactionId && (
            <span className="block text-[11px] font-mono text-neutral-400 mt-0.5">
              Ref: {alert.transactionId}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons or Resolution Banner */}
      {isFraudConfirmed ? (
        <div className="px-3 py-2 rounded-xl bg-red-100/70 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between">
          <span>Reported as Fraud · Action Taken</span>
          <span className="text-[11px] bg-red-600 text-white px-2 py-0.5 rounded-full uppercase">
            Escalated
          </span>
        </div>
      ) : isResolved ? (
        <div className="px-3 py-2 rounded-xl bg-emerald-100/70 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <span>Confirmed Safe by You</span>
          <span className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">
            Resolved
          </span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-neutral-100">
          <span className="text-xs font-semibold text-neutral-600 w-full sm:w-auto">
            Did you authorize this?
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <button
              type="button"
              disabled={loading}
              onClick={() => onConfirmLegit?.(alert)}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Yes, that was me
            </button>
            <button
              type="button"
              id={`alert-report-fraud-${alert.id}`}
              disabled={loading}
              onClick={() => onReportFraud?.(alert)}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition flex items-center justify-center gap-1.5 shadow-sm shadow-red-600/30 disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              No, not me
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AlertCard
