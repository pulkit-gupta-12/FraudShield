import React, { useState, useEffect, useRef } from 'react'
import {
  Activity,
  Play,
  Pause,
  RefreshCw,
  ShieldAlert,
  Zap,
  Filter,
  Trash2,
  Clock,
  Radio,
  CheckCircle2,
} from 'lucide-react'
import { getLiveTransactions, resetLiveFeed } from '../../services/transactions.js'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'
import { RiskMeter } from '../../components/charts/RiskMeter.jsx'
import { THRESHOLD, REVIEW_FLOOR } from '../../config/constants.js'
import toast from 'react-hot-toast'

/**
 * Screen S12: Real-time Live Transaction Feed & Ingestion Simulator
 * Follows DATA RULE #3: Uses poller from services/transactions.js every 3 seconds.
 * Provides Pause / Resume control and cleans up timer on unmount.
 */
export function LiveFeedPage() {
  const [feed, setFeed] = useState([])
  const [isPaused, setIsPaused] = useState(false)
  const [filterTier, setFilterTier] = useState('ALL')
  const [totalStreamed, setTotalStreamed] = useState(0)

  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused

  const lastSinceRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    const poll = async () => {
      if (isPausedRef.current) return
      try {
        const res = await getLiveTransactions(lastSinceRef.current)
        if (isMounted && res?.results?.length) {
          lastSinceRef.current = res.results[0].timestamp
          setFeed((prev) => {
            const newItems = res.results.filter((item) => !prev.some((p) => p.id === item.id))
            if (!newItems.length) return prev
            return [...newItems, ...prev].slice(0, 30)
          })
          setTotalStreamed((count) => count + res.results.length)
        }
      } catch {
        // quiet poll fail
      }
    }

    // Initial fetch
    poll()

    // S12 Requirement: new transactions arrive every 3 seconds from service function
    const interval = setInterval(poll, 3000)

    // S12 Requirement: clean up interval when leaving page
    return () => {
      isMounted = false
      clearInterval(interval)
      lastSinceRef.current = null
      resetLiveFeed()
    }
  }, [])

  const handleTogglePause = () => {
    setIsPaused((p) => {
      const next = !p
      toast(next ? 'Live feed paused' : 'Live feed resumed', {
        icon: next ? '⏸️' : '▶️',
      })
      return next
    })
  }

  const handleClearFeed = () => {
    setFeed([])
    toast.success('Live feed buffer cleared')
  }

  const filteredFeed = feed.filter((item) => {
    if (filterTier === 'ALL') return true
    if (filterTier === 'FRAUD') return item.riskScore >= THRESHOLD
    if (filterTier === 'SUSPICIOUS') return item.riskScore >= REVIEW_FLOOR && item.riskScore < THRESHOLD
    if (filterTier === 'LEGIT') return item.riskScore < REVIEW_FLOOR
    return true
  })

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Real-Time Ingestion Feed & Live Simulator
            </h1>
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Sub-20ms streaming pipeline polling transactions every 3 seconds with autonomous XGBoost risk scoring
          </p>
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="pause-resume-feed-btn"
            onClick={handleTogglePause}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Resume Stream' : 'Pause Stream'}
          </button>

          <button
            type="button"
            onClick={handleClearFeed}
            className="p-2 rounded-xl border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 shadow-xs transition"
            title="Clear Stream Buffer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stream Metrics Bar */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <span className="text-[11px] text-neutral-400 uppercase font-semibold">Stream Status</span>
          <div className="text-xl font-bold font-mono mt-0.5 flex items-center gap-2">
            <Radio className={`w-4 h-4 ${isPaused ? 'text-amber-400' : 'text-emerald-400 animate-pulse'}`} />
            {isPaused ? 'PAUSED' : 'STREAMING'}
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">3.0s cycle</span>
        </div>

        <div>
          <span className="text-[11px] text-neutral-400 uppercase font-semibold">Ingested This Session</span>
          <div className="text-xl font-bold font-mono mt-0.5 text-neutral-100">{totalStreamed} Txns</div>
          <span className="text-[10px] text-neutral-500">Live in-memory buffer</span>
        </div>

        <div>
          <span className="text-[11px] text-neutral-400 uppercase font-semibold">High-Risk Caught</span>
          <div className="text-xl font-bold font-mono mt-0.5 text-red-400">
            {feed.filter((t) => t.riskScore >= THRESHOLD).length}
          </div>
          <span className="text-[10px] text-red-400/80">Halted at gateway</span>
        </div>

        <div>
          <span className="text-[11px] text-neutral-400 uppercase font-semibold">Inference Latency</span>
          <div className="text-xl font-bold font-mono mt-0.5 text-emerald-400">18.2 ms</div>
          <span className="text-[10px] text-neutral-500">Sub-millisecond peak</span>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
        <span className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5 mr-2">
          <Filter className="w-3.5 h-3.5" /> Filter Stream:
        </span>
        {[
          { id: 'ALL', label: 'All Incoming' },
          { id: 'FRAUD', label: `High Risk (Score ≥ ${THRESHOLD})` },
          { id: 'SUSPICIOUS', label: `Review (Score ${REVIEW_FLOOR}–${THRESHOLD})` },
          { id: 'LEGIT', label: `Safe Approved (< ${REVIEW_FLOOR})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterTier(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterTier === tab.id
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stream List Cards */}
      <div className="space-y-3">
        {filteredFeed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-xs text-neutral-400">
            Awaiting streaming transactions from the simulator socket...
          </div>
        ) : (
          filteredFeed.map((txn, idx) => {
            const isHigh = txn.riskScore >= THRESHOLD
            const isReview = txn.riskScore >= REVIEW_FLOOR && txn.riskScore < THRESHOLD
            return (
              <div
                key={txn.id || idx}
                className={`p-4 rounded-2xl border bg-white shadow-xs transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isHigh
                    ? 'border-red-300 bg-red-50/10 ring-1 ring-red-400/20'
                    : isReview
                    ? 'border-amber-200 bg-amber-50/10'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isHigh
                        ? 'bg-red-100 text-red-600'
                        : isReview
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-neutral-900">{txn.id}</span>
                      <RiskBadge score={txn.riskScore} size="sm" />
                    </div>
                    <div className="text-xs font-semibold text-neutral-700 mt-0.5">
                      {txn.merchant} · <span className="font-normal text-neutral-500">{txn.city || 'Mumbai'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 text-xs">
                  <div className="text-right">
                    <span className="text-base font-extrabold text-neutral-900 font-mono block">
                      ₹{(txn.amountINR || txn.amount || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {txn.timestamp ? new Date(txn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Now'}
                    </span>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      isHigh
                        ? 'bg-red-600 text-white'
                        : isReview
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {isHigh ? 'AUTO-HALT' : isReview ? 'FLAGGED' : 'APPROVED'}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default LiveFeedPage
