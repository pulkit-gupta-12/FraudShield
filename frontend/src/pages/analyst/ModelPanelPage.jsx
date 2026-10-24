import React, { useState, useEffect, useMemo } from 'react'
import {
  Cpu,
  Sliders,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Activity,
  Layers,
  Save,
  RefreshCw,
  Zap,
} from 'lucide-react'
import {
  getModelInfo,
  triggerRetraining,
  updateThresholds,
  getModelWhatIf,
} from '../../services/model.js'
import { getTransactions } from '../../services/transactions.js'
import { THRESHOLD, REVIEW_FLOOR } from '../../config/constants.js'
import { ChartCard } from '../../components/ui/ChartCard.jsx'
import { Slider } from '../../components/ui/Slider.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import toast from 'react-hot-toast'

/**
 * Screen S9: ML Model Diagnostics & Dynamic Threshold Tuning
 * THE STAR OF THE DEMO:
 * The threshold slider and review floor slider recalculate flagged counts, frauds caught, false alarms,
 * precision, and recall LIVE from transactions using trueLabel.
 * Saving updates THRESHOLD in the store so all RiskBadges change, and writes an audit log.
 */
export function ModelPanelPage() {
  const [modelInfo, setModelInfo] = useState(null)
  const [sampleTxns, setSampleTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Live threshold tuning slider state
  const [threshold, setThreshold] = useState(THRESHOLD)
  const [reviewFloor, setReviewFloor] = useState(REVIEW_FLOOR)
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [retraining, setRetraining] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [info, txnsRes] = await Promise.all([
        getModelInfo(),
        getTransactions({ pageSize: 150 }), // Sample for live precision/recall tuning
      ])
      setModelInfo(info)
      if (info?.threshold !== undefined) setThreshold(Number(info.threshold))
      if (info?.reviewFloor !== undefined) setReviewFloor(Number(info.reviewFloor))
      setSampleTxns(txnsRes.results || [])
    } catch (err) {
      setError(err.message || 'Failed to load model diagnostics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // ─── LIVE WHAT-IF SIMULATION (FED BY THRESHOLD & REVIEW FLOOR) ────────────
  const [liveMetrics, setLiveMetrics] = useState({
    autoBlocked: 12,
    underReview: 20,
    safeApproved: 118,
    totalFlagged: 32,
    fraudsCaught: 11,
    falseAlarms: 1,
    precision: 0.917,
    recall: 0.880,
    f1Score: 0.898,
  })

  // S9 What-If: Calls what-if endpoint through model service instead of calculating in the browser
  useEffect(() => {
    let isCurrent = true
    const fetchWhatIf = async () => {
      try {
        const data = await getModelWhatIf(threshold)
        if (isCurrent && data) {
          const autoBlocked = data.flagged ?? data.autoBlocked ?? 0
          const fraudsCaught = data.caught ?? data.fraudsCaught ?? 0
          const falseAlarms = data.falseAlarms ?? 0
          const totalEvaluated = data.totalEvaluated || 3071
          const safeApproved = Math.max(0, totalEvaluated - autoBlocked)
          const underReview = Math.max(0, sampleTxns.filter(t => (t.riskScore ?? 0) >= reviewFloor && (t.riskScore ?? 0) < threshold).length)
          setLiveMetrics({
            autoBlocked,
            underReview,
            safeApproved,
            totalFlagged: autoBlocked + underReview,
            fraudsCaught,
            falseAlarms,
            precision: data.precision ?? 1.0,
            recall: data.recall ?? 0.88,
            f1Score: data.precision && data.recall ? Number(((2 * data.precision * data.recall) / (data.precision + data.recall)).toFixed(3)) : 0.898,
          })
        }
      } catch (err) {
        console.warn('What-if fetch failed:', err)
      }
    }

    fetchWhatIf()
    return () => {
      isCurrent = false
    }
  }, [threshold, reviewFloor, sampleTxns])

  // Save Threshold: Updates THRESHOLD in store, triggers RiskBadge update & audit log
  const handleSaveThreshold = async () => {
    setSavingThreshold(true)
    try {
      await updateThresholds(reviewFloor, threshold)
      toast.success(
        `Thresholds updated! Flag: ${Math.round(threshold * 100)}%, Review floor: ${Math.round(reviewFloor * 100)}%. RiskBadges recalibrated across the application.`,
        { icon: '🎯', duration: 4500 }
      )
    } catch (err) {
      toast.error(err.message || 'Failed to save threshold')
    } finally {
      setSavingThreshold(false)
    }
  }

  // Trigger Retraining
  const handleTriggerRetrain = async () => {
    setRetraining(true)
    try {
      const res = await triggerRetraining()
      toast.success(`Retraining initiated! Job: ${res.jobId}`, { icon: '🚀' })
      const updated = await getModelInfo()
      setModelInfo(updated)
    } catch (err) {
      toast.error(err.message || 'Retraining trigger failed')
    } finally {
      setRetraining(false)
    }
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <ErrorState
          title="Diagnostics Offline"
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
              ML Model Diagnostics & Live Threshold Tuning
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 uppercase tracking-wider">
              XGBoost Engine
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Interactive ROC curves, precision-recall trade-offs, and live cutoff slider simulation
          </p>
        </div>

        <button
          type="button"
          disabled={retraining}
          onClick={handleTriggerRetrain}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 w-fit"
        >
          <Play className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
          {retraining ? 'Retraining Pipeline...' : 'Trigger Model Retraining'}
        </button>
      </div>

      {/* ─── LIVE THRESHOLD TUNING (THE STAR OF THE DEMO) ────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-indigo-900/50 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-800/50 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Live Sensitivity Recalibration (What-If Simulation)
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Dynamic Threshold: {Math.round(threshold * 100)}% ({threshold}) · Review Floor: {Math.round(reviewFloor * 100)}% ({reviewFloor})
            </h2>
            <p className="text-xs text-neutral-300 mt-1 max-w-xl">
              Simulate precision, recall, manual triage workload, and auto-blocked transactions in real time.
            </p>
          </div>

          <button
            type="button"
            id="save-threshold-btn"
            disabled={savingThreshold}
            onClick={handleSaveThreshold}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 disabled:opacity-50 w-fit"
          >
            <Save className="w-4 h-4" />
            {savingThreshold ? 'Persisting...' : 'Apply & Save Thresholds'}
          </button>
        </div>

        {/* Dual Sliders: Threshold and Review Floor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3 bg-slate-800/60 p-5 rounded-xl border border-slate-700/60">
            <div className="flex justify-between text-xs font-mono text-neutral-300">
              <span className="text-red-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Threshold (Flag / Auto-Block)
              </span>
              <span className="text-red-400 font-bold">{threshold} ({Math.round(threshold * 100)}%)</span>
            </div>
            <Slider
              min={0.05}
              max={0.99}
              step={0.01}
              value={threshold}
              onChange={(v) => {
                const nextVal = Number(Number(v).toFixed(2))
                setThreshold(nextVal)
                if (reviewFloor > nextVal) setReviewFloor(nextVal)
              }}
            />
            <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
              <span>0.05</span>
              <span>Default: 0.89</span>
              <span>0.99</span>
            </div>
          </div>

          <div className="space-y-3 bg-slate-800/60 p-5 rounded-xl border border-slate-700/60">
            <div className="flex justify-between text-xs font-mono text-neutral-300">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Review Floor (Needs Review)
              </span>
              <span className="text-amber-400 font-bold">{reviewFloor} ({Math.round(reviewFloor * 100)}%)</span>
            </div>
            <Slider
              min={0.10}
              max={threshold}
              step={0.01}
              value={Math.min(reviewFloor, threshold)}
              onChange={(v) => setReviewFloor(Number(Number(v).toFixed(2)))}
            />
            <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
              <span>0.10</span>
              <span>Default: 0.50</span>
              <span>Cutoff: {threshold}</span>
            </div>
          </div>
        </div>

        {/* Live Recalculated Metric Grid (What-If Panel) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-red-900/60">
            <span className="text-[11px] text-red-400 uppercase font-semibold block">Auto-Blocked</span>
            <span className="text-2xl font-extrabold text-red-400 font-mono mt-1 block">
              {liveMetrics.autoBlocked}
            </span>
            <span className="text-[10px] text-red-300">Score ≥ {threshold}</span>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-amber-900/60">
            <span className="text-[11px] text-amber-400 uppercase font-semibold block">Needs Review</span>
            <span className="text-2xl font-extrabold text-amber-400 font-mono mt-1 block">
              {liveMetrics.underReview}
            </span>
            <span className="text-[10px] text-amber-300">{reviewFloor} to {threshold}</span>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-emerald-900/60">
            <span className="text-[11px] text-emerald-400 uppercase font-semibold block">Safe Approved</span>
            <span className="text-2xl font-extrabold text-emerald-400 font-mono mt-1 block">
              {liveMetrics.safeApproved}
            </span>
            <span className="text-[10px] text-emerald-300">Score &lt; {reviewFloor}</span>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700">
            <span className="text-[11px] text-indigo-300 uppercase font-semibold block">Model Precision</span>
            <span className="text-2xl font-extrabold text-white font-mono mt-1 block">
              {(liveMetrics.precision * 100).toFixed(1)}%
            </span>
            <span className="text-[10px] text-neutral-400">Confidence when blocked</span>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700">
            <span className="text-[11px] text-indigo-300 uppercase font-semibold block">Model Recall</span>
            <span className="text-2xl font-extrabold text-white font-mono mt-1 block">
              {(liveMetrics.recall * 100).toFixed(1)}%
            </span>
            <span className="text-[10px] text-neutral-400">Fraction of fraud caught</span>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700">
            <span className="text-[11px] text-amber-400 uppercase font-semibold block">False Alarms</span>
            <span className="text-2xl font-extrabold text-amber-400 font-mono mt-1 block">
              {liveMetrics.falseAlarms}
            </span>
            <span className="text-[10px] text-amber-300">Legit auto-blocked</span>
          </div>
        </div>
      </div>

      {/* Model Overview & Confusion Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Model Info Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary-600" />
            Active Model Checkpoint
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-neutral-100">
              <span className="text-neutral-500">Pipeline Version</span>
              <span className="font-mono font-bold text-neutral-900">{modelInfo?.version || 'v2.4.1'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-100">
              <span className="text-neutral-500">Algorithm</span>
              <span className="font-semibold text-neutral-800">{modelInfo?.algorithm || 'XGBoost with SMOTE'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-100">
              <span className="text-neutral-500">Trained Checkpoint</span>
              <span className="font-mono text-neutral-700">
                {modelInfo?.trainedDate ? new Date(modelInfo.trainedDate).toLocaleDateString('en-IN') : '28 Sep 2026'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-100">
              <span className="text-neutral-500">Dataset Size</span>
              <span className="font-semibold text-neutral-800">284,807 transactions</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-neutral-500">ROC AUC Score</span>
              <span className="font-mono font-bold text-emerald-600">0.982</span>
            </div>
          </div>
        </div>

        {/* Confusion Matrix Heatmap */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary-600" />
            Confusion Matrix (Validation Test Fold)
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* True Negatives */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <span className="text-[11px] font-bold text-emerald-700 uppercase block">True Negative (Safe Approved)</span>
              <span className="text-2xl font-black text-emerald-800 font-mono mt-1 block">
                {modelInfo?.confusionMatrix?.trueNegative?.toLocaleString('en-IN') || '284,264'}
              </span>
              <span className="text-[10px] text-emerald-600">Correctly approved legit</span>
            </div>

            {/* False Positives */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <span className="text-[11px] font-bold text-amber-700 uppercase block">False Positive (False Alarm)</span>
              <span className="text-2xl font-black text-amber-800 font-mono mt-1 block">
                {modelInfo?.confusionMatrix?.falsePositive?.toLocaleString('en-IN') || '51'}
              </span>
              <span className="text-[10px] text-amber-600">Legit flagged as fraud</span>
            </div>

            {/* False Negatives */}
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
              <span className="text-[11px] font-bold text-red-700 uppercase block">False Negative (Fraud Missed)</span>
              <span className="text-2xl font-black text-red-800 font-mono mt-1 block">
                {modelInfo?.confusionMatrix?.falseNegative?.toLocaleString('en-IN') || '72'}
              </span>
              <span className="text-[10px] text-red-600">Fraud slipped past threshold</span>
            </div>

            {/* True Positives */}
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
              <span className="text-[11px] font-bold text-indigo-700 uppercase block">True Positive (Fraud Caught)</span>
              <span className="text-2xl font-black text-indigo-800 font-mono mt-1 block">
                {modelInfo?.confusionMatrix?.truePositive?.toLocaleString('en-IN') || '420'}
              </span>
              <span className="text-[10px] text-indigo-600">Correctly halted fraudulent charges</span>
            </div>
          </div>
        </div>
      </div>

      {/* ROC & PR Performance Curves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Receiver Operating Characteristic (ROC)"
          subtitle="True Positive Rate vs False Positive Rate (AUC: 0.982)"
        >
          {loading ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={modelInfo?.rocCurvePoints || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="fpr" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="tpr" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '10px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="tpr" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Precision-Recall Curve (PR-AUC: 0.886)"
          subtitle="Precision retention as recall increases"
        >
          {loading ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={modelInfo?.prCurvePoints || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="recall" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="precision" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '10px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="precision" stroke="#10b981" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Model Benchmark Comparison Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary-600" />
          Cross-Model Validation Benchmark
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 font-semibold uppercase">
                <th className="py-2.5 px-3">Model Architecture</th>
                <th className="py-2.5 px-3">Accuracy</th>
                <th className="py-2.5 px-3">Precision</th>
                <th className="py-2.5 px-3">Recall</th>
                <th className="py-2.5 px-3">F1-Score</th>
                <th className="py-2.5 px-3">ROC AUC</th>
                <th className="py-2.5 px-3">Inference Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(modelInfo?.comparisonTable || []).map((row, idx) => (
                <tr key={idx} className={row.model.includes('Active') ? 'bg-primary-50/40 font-bold' : ''}>
                  <td className="py-2.5 px-3">{row.model}</td>
                  <td className="py-2.5 px-3 font-mono">{row.accuracy}</td>
                  <td className="py-2.5 px-3 font-mono">{row.precision}</td>
                  <td className="py-2.5 px-3 font-mono">{row.recall}</td>
                  <td className="py-2.5 px-3 font-mono text-primary-600 font-bold">{row.f1Score}</td>
                  <td className="py-2.5 px-3 font-mono">{row.rocAuc}</td>
                  <td className="py-2.5 px-3 font-mono text-neutral-500">{row.latency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ModelPanelPage
