import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Ban,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Info,
} from 'lucide-react'
import { RiskMeter } from '../charts/RiskMeter.jsx'
import { FactorsChart } from '../charts/FactorsChart.jsx'
import { useModelConfig } from '../../context/ModelConfigContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

/**
 * Reusable ResultPanel component.
 *
 * @param {Object} result - Result returned by submitTransaction or predict endpoint:
 *   {
 *     decision: 'approved' | 'review' | 'blocked' | 'declined',
 *     reason?: string,
 *     reasons?: string[],
 *     riskScore?: number | null,
 *     band?: string,
 *     factors?: Array<{ feature: string, impact: number, description?: string }>,
 *     alertId?: number | null,
 *     caseId?: number | null,
 *     transaction?: Object,
 *   }
 * @param {Function} onReset - Called when clicking 'Make another'
 */
export function ResultPanel({ result, onReset, className = '' }) {
  const { threshold, reviewFloor } = useModelConfig()
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!result) return null

  const isStaff = user?.role === 'admin' || user?.role === 'analyst'
  const isCustomer = user?.role === 'customer'
  const isMerchant = user?.role === 'merchant'

  const decision = (result.decision || 'approved').toLowerCase()
  const riskScore = result.riskScore !== undefined && result.riskScore !== null ? Number(result.riskScore) : null

  // Banner styling & configuration
  const bannerConfig = {
    approved: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
      title: 'APPROVED',
      subtitle: 'Transaction verified and safely authorized by fraud detection pipeline.',
    },
    review: {
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      title: 'NEEDS REVIEW',
      subtitle: 'Elevated risk detected. Transaction held for operational review or step-up verification.',
    },
    blocked: {
      bg: 'bg-risk-50 border-risk-200 text-risk-900',
      icon: XCircle,
      iconColor: 'text-risk-600',
      title: 'BLOCKED',
      subtitle: 'High confidence fraud detected. Payment blocked to protect account assets.',
    },
    declined: {
      bg: 'bg-neutral-100 border-neutral-300 text-neutral-800',
      icon: Ban,
      iconColor: 'text-neutral-600',
      title: 'DECLINED',
      subtitle:
        result.reason === 'card_blocked'
          ? 'Card is inactive or blocked. Transaction cannot be processed.'
          : result.reason === 'limit_exceeded'
          ? 'Transaction amount exceeds card spending limit.'
          : 'Payment declined due to card authorization rules.',
    },
  }[decision] || {
    bg: 'bg-neutral-50 border-neutral-200 text-neutral-800',
    icon: CheckCircle2,
    iconColor: 'text-neutral-500',
    title: decision.toUpperCase(),
    subtitle: 'Transaction evaluated.',
  }

  const BannerIcon = bannerConfig.icon

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Large Decision Banner */}
      <div className={`p-5 rounded-2xl border ${bannerConfig.bg} shadow-xs flex items-start gap-4 transition-all duration-300`}>
        <div className="p-2.5 rounded-xl bg-white shadow-xs shrink-0">
          <BannerIcon className={`w-7 h-7 ${bannerConfig.iconColor}`} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-extrabold tracking-tight">{bannerConfig.title}</h2>
            {result.reason && decision === 'declined' && (
              <span className="px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-800 text-[11px] font-bold uppercase font-mono">
                {result.reason.replace('_', ' ')}
              </span>
            )}
            {riskScore !== null && (
              <span className="text-xs font-mono font-bold opacity-75">
                Score: {riskScore.toFixed(3)}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed opacity-90">{bannerConfig.subtitle}</p>
        </div>
      </div>

      {/* Customer Alert prompt if review or blocked */}
      {isCustomer && (decision === 'review' || decision === 'blocked') && (
        <div className="p-4 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-primary-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-primary-900">We sent you a security alert</p>
              <p className="text-[11px] text-primary-700">
                You can review the activity or confirm this payment in your Alerts page.
              </p>
            </div>
          </div>
          <Link
            to="/customer/alerts"
            className="px-3.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shrink-0 transition"
          >
            Go to Alerts
          </Link>
        </div>
      )}

      {/* 2. Visualizations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* RiskMeter Card */}
        <div className="p-6 bg-white border border-neutral-200/90 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-600 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                Risk Evaluation Gauge
              </h3>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
              Floor: {(reviewFloor * 100).toFixed(0)} · Cutoff: {(threshold * 100).toFixed(0)}
            </span>
          </div>

          <div className="flex justify-center items-center py-2">
            <RiskMeter
              score={riskScore ?? 0}
              threshold={Math.round(threshold * 100)}
              warningThreshold={Math.round(reviewFloor * 100)}
              size={220}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-neutral-600 pt-3 border-t border-neutral-100">
            <div className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-emerald-50/80 text-emerald-700 border border-emerald-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Safe (&lt;{(reviewFloor * 100).toFixed(0)})</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-amber-50/80 text-amber-700 border border-amber-200/60">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Review ({(reviewFloor * 100).toFixed(0)}-{(threshold * 100).toFixed(0)})</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-rose-50/80 text-rose-700 border border-rose-200/60">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Fraud (&ge;{(threshold * 100).toFixed(0)})</span>
            </div>
          </div>
        </div>

        {/* Plain Language Reasons & Details */}
        <div className="p-5 bg-white border border-neutral-200/80 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Plain-Language Reasons
            </h3>
            <span className="text-[11px] text-neutral-400 font-medium">Explainability</span>
          </div>

          {result.reasons && result.reasons.length > 0 ? (
            <div className="space-y-2.5">
              {result.reasons.map((r, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/60 flex items-start gap-2.5"
                >
                  <Info className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-neutral-800 leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-neutral-50 text-center text-xs text-neutral-500">
              No specific risk factors flagged. Standard purchase pattern matches normal cardholder profile.
            </div>
          )}

          {/* Transaction Metadata Preview */}
          {result.transaction && (
            <div className="pt-2 border-t border-neutral-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-neutral-400 block text-[10px] font-semibold uppercase">ID</span>
                <span className="font-mono font-bold text-neutral-800">
                  {result.transaction.publicId || result.transaction.id}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] font-semibold uppercase">Amount</span>
                <span className="font-bold text-neutral-900">
                  ₹{Number(result.transaction.amountInr || result.transaction.amountINR || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Staff Only: FactorsChart */}
      {isStaff && result.factors && result.factors.length > 0 && (
        <div className="p-5 bg-white border border-neutral-200/80 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Model Feature Importances (SHAP / XAI Factors)
            </h3>
            <span className="text-[11px] font-mono text-primary-600 font-bold">Staff Diagnostic</span>
          </div>
          <FactorsChart factors={result.factors} />
        </div>
      )}

      {/* 4. Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-200">
        <button
          type="button"
          id="result-make-another-btn"
          onClick={onReset}
          className="h-11 px-5 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-bold flex items-center gap-2 transition"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Make Another Payment</span>
        </button>

        <div className="flex items-center gap-2.5">
          {/* Customer View Alert Button */}
          {isCustomer && (
            <Link
              to="/customer/alerts"
              id="result-view-alert-customer-btn"
              className="h-11 px-5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center gap-2 transition shadow-xs"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>View Alerts</span>
            </Link>
          )}

          {/* Staff View Case Button */}
          {isStaff && result.caseId && (
            <Link
              to={`/analyst/investigate/${result.caseId}`}
              id="result-view-case-btn"
              className="h-11 px-5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center gap-2 transition shadow-xs"
            >
              <span>View Case #{result.caseId}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          {/* Staff View Alerts Button */}
          {isStaff && result.alertId && !result.caseId && (
            <Link
              to="/analyst/investigate"
              id="result-view-alert-staff-btn"
              className="h-11 px-5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center gap-2 transition shadow-xs"
            >
              <span>View Alert #{result.alertId}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          {/* Merchant View Chargebacks / Terminal Button */}
          {isMerchant && (
            <Link
              to="/merchant/chargebacks"
              id="result-view-chargebacks-btn"
              className="h-11 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-2 transition shadow-xs"
            >
              <span>View Chargeback Desk</span>
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
