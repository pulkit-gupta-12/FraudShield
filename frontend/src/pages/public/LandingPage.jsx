import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  Zap,
  Activity,
  Users,
  ArrowRight,
  Lock,
  BarChart3,
  CheckCircle2,
  Cpu,
  Layers,
  CreditCard,
  ShieldAlert,
  Server,
  RefreshCw,
} from 'lucide-react'
import { getLiveTransactions, resetLiveFeed } from '../../services/transactions.js'
import { getPublicSummary } from '../../services/stats.js'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'

export function LandingPage() {
  const [liveTxns, setLiveTxns] = useState([])
  const [activePersona, setActivePersona] = useState('customer')
  const [summary, setSummary] = useState(null)

  // Load public metrics from /api/public/summary/
  useEffect(() => {
    let isMounted = true
    getPublicSummary()
      .then((data) => {
        if (isMounted && data) setSummary(data)
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [])

  // Live feed poller from services/transactions.js (DATA RULE #3)
  useEffect(() => {
    let isMounted = true
    let lastSince = null

    const pollFeed = async () => {
      try {
        const data = await getLiveTransactions(lastSince)
        if (isMounted && data?.results?.length) {
          lastSince = data.results[0].timestamp
          setLiveTxns((prev) => {
            const fresh = data.results.filter((tx) => !prev.some((p) => p.id === tx.id))
            return [...fresh, ...prev].slice(0, 4)
          })
        }
      } catch (err) {
        // quiet fallback for landing page demo
      }
    }

    pollFeed()
    const timer = setInterval(pollFeed, 3500)

    return () => {
      isMounted = false
      clearInterval(timer)
      resetLiveFeed() // Rule 3 cleanup
    }
  }, [])

  return (
    <div className="space-y-20 pb-16 overflow-hidden">
      {/* ─── Hero Section ──────────────────────────────────────────────────────── */}
      <section className="relative text-center pt-8 sm:pt-16 max-w-5xl mx-auto px-4">
        {/* Animated Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-primary-400/20 via-indigo-500/10 to-teal-400/15 blur-3xl rounded-full pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-6 shadow-xs animate-bounce">
          <Zap className="w-3.5 h-3.5 text-primary-600" />
          Sub-20ms Millisecond AI Fraud Defense
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-neutral-900 leading-[1.15]">
          Autonomous AI Defense Against{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-indigo-600 to-primary-700">
            Credit Card Fraud
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-neutral-600 max-w-3xl mx-auto leading-relaxed">
          FraudShield powers modern banking with high-precision XGBoost machine learning,
          explainable risk attribution, role-based investigator consoles, and instant cardholder protection.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            Launch Interactive Demo
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* ─── Stats Bar with CSS Animations ─────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 sm:p-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center divide-y sm:divide-y-0 sm:divide-x divide-neutral-100">
          <div className="pt-4 sm:pt-0">
            <p className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight font-mono">
              {summary?.transactionsScanned ? summary.transactionsScanned.toLocaleString() : '6,000+'}
            </p>
            <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mt-1">
              Transactions Scanned
            </p>
          </div>
          <div className="pt-4 sm:pt-0">
            <p className="text-3xl sm:text-4xl font-extrabold text-emerald-600 tracking-tight font-mono">
              {summary?.moneyProtected ? `₹${Math.round(summary.moneyProtected).toLocaleString()}` : '₹4.9 Lakh+'}
            </p>
            <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mt-1">
              Money Protected
            </p>
          </div>
          <div className="pt-4 sm:pt-0">
            <p className="text-3xl sm:text-4xl font-extrabold text-primary-600 tracking-tight font-mono">
              {summary?.precision != null ? `${(summary.precision * 100).toFixed(1)}%` : '100%'}
            </p>
            <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mt-1">
              Model Precision
            </p>
          </div>
          <div className="pt-4 sm:pt-0">
            <p className="text-3xl sm:text-4xl font-extrabold text-indigo-600 tracking-tight font-mono">
              {summary?.avgDetectionTimeMs ? `${Math.round(summary.avgDetectionTimeMs)} ms` : '18 ms'}
            </p>
            <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mt-1">
              Inference Latency
            </p>
          </div>
        </div>
      </section>

      {/* ─── Live Transaction Intelligence Ticker (Poller Feature) ─────────────── */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Live Model Stream & Ingestion Ticker
                </h3>
                <p className="text-xs text-neutral-400">
                  Continuous transactions processed through real-time ML scoring pipeline
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 w-fit">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span>Polling every 3.5s</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {liveTxns.length === 0 ? (
              <div className="col-span-full py-8 text-center text-xs text-neutral-500">
                Listening to real-time transaction pipe...
              </div>
            ) : (
              liveTxns.map((txn) => (
                <div
                  key={txn.id}
                  className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/80 flex flex-col justify-between hover:border-slate-600 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] text-neutral-400 truncate max-w-[100px]">
                      {txn.id}
                    </span>
                    <RiskBadge score={txn.riskScore} size="sm" />
                  </div>
                  <div className="my-2">
                    <div className="font-bold text-sm text-neutral-100 truncate">{txn.merchant}</div>
                    <div className="text-xs text-neutral-400 font-mono">
                      ₹{txn.amountINR?.toLocaleString('en-IN') || txn.amount}
                    </div>
                  </div>
                  <div className="text-[10px] text-neutral-500 flex items-center justify-between pt-1 border-t border-slate-700/50">
                    <span>{txn.city || 'Mumbai'}</span>
                    <span className="font-mono">{new Date(txn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ─── 4 Personas Showcase Tabs ─────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
            Tailored Experiences for Every Stakeholder
          </h2>
          <p className="text-sm text-neutral-500 mt-1 max-w-xl mx-auto">
            Role-Based Access Control (RBAC) ensuring precise workflows for financial security.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {[
            { id: 'customer', label: 'Customer (Cardholder)', icon: CreditCard },
            { id: 'analyst', label: 'Fraud Analyst', icon: Activity },
            { id: 'admin', label: 'System Admin', icon: Server },
            { id: 'merchant', label: 'Merchant Partner', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon
            const isSel = activePersona === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePersona(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                  isSel
                    ? 'bg-primary-600 text-white shadow-primary-600/20'
                    : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Persona Feature Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 shadow-sm">
          {activePersona === 'customer' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Role: Retail Cardholder
                </span>
                <h3 className="text-xl font-bold text-neutral-900 mt-3">
                  Empower Customers with Instant Card Lock & Disputes
                </h3>
                <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                  Cardholders receive instant security notifications on anomalous charges.
                  A single tap on "No, not me" immediately locks the card, prevents unauthorized debit, and opens a formal dispute case.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-neutral-700 font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Interactive virtual card view with prominent red BLOCKED status
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Real-time category spending breakdowns
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    End-to-end charge inquiry tracking through review stages
                  </li>
                </ul>
                <div className="mt-6">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs transition"
                  >
                    Try Customer Demo Account
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
              <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200">
                <div className="bg-white rounded-xl p-4 border border-neutral-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-neutral-100">
                    <span className="font-bold text-neutral-800">Security Advisory</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                      ACTION REQUIRED
                    </span>
                  </div>
                  <div className="text-xs text-neutral-700">
                    Unusual charge of <span className="font-bold text-neutral-900">₹84,200</span> detected at Croma Electronics.
                  </div>
                  <div className="flex gap-2 pt-1">
                    <span className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-red-600 text-white">
                      No, not me (Lock Card)
                    </span>
                    <span className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-neutral-100 text-neutral-700">
                      Yes, that was me
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePersona === 'analyst' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Role: Fraud Operations
                </span>
                <h3 className="text-xl font-bold text-neutral-900 mt-3">
                  Deep Investigation with Explainable AI
                </h3>
                <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                  Fraud analysts inspect millisecond predictions accompanied by top SHAP-style attribution factors,
                  batch upload thousands of transactions via CSV, and inspect model precision-recall curves.
                </p>
                <div className="mt-6">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs transition"
                  >
                    Try Analyst Demo Account
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
              <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200 font-mono text-xs space-y-2">
                <div className="text-neutral-500">// Inference Attribution</div>
                <div className="flex justify-between bg-white p-2 rounded border border-neutral-200">
                  <span>V14 Leaping Distance</span>
                  <span className="text-red-600 font-bold">+0.482 (Risk ↑)</span>
                </div>
                <div className="flex justify-between bg-white p-2 rounded border border-neutral-200">
                  <span>Amount Outlier (₹84k)</span>
                  <span className="text-red-600 font-bold">+0.310 (Risk ↑)</span>
                </div>
                <div className="flex justify-between bg-white p-2 rounded border border-neutral-200">
                  <span>Merchant Velocity</span>
                  <span className="text-emerald-600 font-bold">-0.120 (Safe ↓)</span>
                </div>
              </div>
            </div>
          )}

          {activePersona === 'admin' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  Role: System Administrator
                </span>
                <h3 className="text-xl font-bold text-neutral-900 mt-3">
                  Full Governance & Threshold Control
                </h3>
                <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                  Adjust cutoff thresholds, configure automated email alerting, manage user permissions across teams,
                  and monitor global API telemetry in real time.
                </p>
                <div className="mt-6">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs transition"
                  >
                    Try Admin Demo Account
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
              <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200 space-y-3">
                <div className="bg-white p-3 rounded-lg border border-neutral-200">
                  <div className="flex justify-between text-xs font-semibold text-neutral-800">
                    <span>Threshold Cutoff</span>
                    <span className="font-mono text-primary-600">0.89</span>
                  </div>
                  <div className="w-full bg-neutral-200 h-2 rounded-full mt-2 overflow-hidden">
                    <div className="bg-primary-600 h-2 rounded-full w-[89%]" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePersona === 'merchant' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Role: Partner Merchant
                </span>
                <h3 className="text-xl font-bold text-neutral-900 mt-3">
                  Chargeback Desk & Commerce Protection
                </h3>
                <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                  Monitor revenue at risk, track chargeback win rates, submit evidence packets, and protect payment gateway credentials.
                </p>
                <div className="mt-6">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs transition"
                  >
                    Try Merchant Demo Account
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
              <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200 space-y-2">
                <div className="bg-white p-3 rounded-lg border border-neutral-200 flex justify-between text-xs">
                  <span className="text-neutral-500 font-medium">Revenue at Risk</span>
                  <span className="font-bold text-neutral-900">₹1,42,800</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-neutral-200 flex justify-between text-xs">
                  <span className="text-neutral-500 font-medium">Chargeback Win Rate</span>
                  <span className="font-bold text-emerald-600">84.2%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── Security & Standards Footer Banner ────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 text-center">
        <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-8 flex flex-wrap items-center justify-around gap-6 text-neutral-500 text-xs font-semibold uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-neutral-700" />
            PCI-DSS Level 1 Ready
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-neutral-700" />
            End-to-End JWT Auth
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-neutral-700" />
            Explainable AI Inference
          </div>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-neutral-700" />
            Dual Mock & REST Ready
          </div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
