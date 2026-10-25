import React, { useState, useEffect } from 'react'
import {
  Cpu,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
  Zap,
  Sliders,
  Check,
} from 'lucide-react'
import { predictFraud, predictBatch } from '../../services/predict.js'
import { submitTransaction } from '../../services/transactions.js'
import { PaymentForm } from '../../components/payment/PaymentForm.jsx'
import { ResultPanel } from '../../components/payment/ResultPanel.jsx'
import { RiskMeter } from '../../components/charts/RiskMeter.jsx'
import { FactorsChart } from '../../components/charts/FactorsChart.jsx'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'
import { THRESHOLD, REVIEW_FLOOR } from '../../config/constants.js'
import {
  parseCSV,
  exportToCSV,
  validateTransactionCSV,
  generateSampleTransactionCSV,
} from '../../utils/csv.js'
import { formatCurrency, formatDateTime } from '../../utils/format.js'
import toast from 'react-hot-toast'

// Presets for the sample picker
const SAMPLE_PRESETS = [
  {
    id: 'TXN-SMP-001',
    label: 'Routine Grocery Spend (Normal)',
    cardholder: 'Aarav Sharma',
    cardLast4: '4192',
    merchant: 'Nature Basket Mumbai',
    category: 'Groceries',
    amountINR: 1450,
    city: 'Mumbai',
    riskScore: 0.04,
    trueLabel: 0,
    modelInputs: { Time: 4210, Amount: 1450, V1: -0.421, V2: 0.152, V3: 1.042, V4: -0.891, V14: -0.124 },
  },
  {
    id: 'TXN-SMP-002',
    label: 'High-Value Midnight Electronics (Suspicious)',
    cardholder: 'Priya Iyer',
    cardLast4: '8831',
    merchant: 'Reliance Digital Online',
    category: 'Electronics',
    amountINR: 48900,
    city: 'Bengaluru',
    riskScore: 0.52,
    trueLabel: 0,
    isNewDevice: true,
    modelInputs: { Time: 84920, Amount: 48900, V1: 1.842, V2: 0.941, V3: -1.241, V4: 1.892, V14: 0.982 },
  },
  {
    id: 'TXN-SMP-003',
    label: 'Overseas Rapid Crypto Burst (High Fraud Risk)',
    cardholder: 'Vikram Malhotra',
    cardLast4: '9014',
    merchant: 'GlobalCrypto Exchange',
    category: 'Crypto',
    amountINR: 184000,
    city: 'Foreign / Proxy IP',
    riskScore: 0.94,
    trueLabel: 1,
    isForeignIp: true,
    isNewDevice: true,
    modelInputs: { Time: 12040, Amount: 184000, V1: 3.401, V2: 2.891, V3: -3.451, V4: 4.120, V14: 3.841 },
  },
]

/**
 * Screen S23: Transaction Checker & ML Inference Lab
 * Tabs:
 *  (a) Manual entry: PaymentForm in staff mode with advanced 30-values and save toggle -> ResultPanel
 *  (b) CSV batch: Upload CSV, validate, score batch, download CSV
 *  (c) Pick a stored sample: Score pre-packaged model evaluation rows with live explainability
 */
export function TransactionCheckerPage() {
  const [activeTab, setActiveTab] = useState('manual') // 'manual' | 'batch' | 'sample'

  // ── Tab 1: Manual Entry State ──
  const [manualLoading, setManualLoading] = useState(false)
  const [manualResult, setManualResult] = useState(null)

  const handleManualSubmit = async (payload) => {
    setManualLoading(true)
    try {
      const res = await submitTransaction(payload)
      setManualResult(res)
      if (res.decision === 'approved') {
        toast.success('Transaction evaluated: Approved')
      } else if (res.decision === 'review') {
        toast('Transaction flagged for review', { icon: '⚠️' })
      } else if (res.decision === 'blocked') {
        toast.error('Transaction blocked by model threshold')
      } else if (res.decision === 'declined') {
        toast.error(`Transaction declined: ${res.reason || 'authorization failure'}`)
      }
    } catch (err) {
      toast.error(err.message || 'Scoring failed')
    } finally {
      setManualLoading(false)
    }
  }

  // ── Tab 2: CSV Upload State ──
  const [csvFile, setCsvFile] = useState(null)
  const [csvRows, setCsvRows] = useState([])
  const [csvErrors, setCsvErrors] = useState([])
  const [batchScoring, setBatchScoring] = useState(false)
  const [batchResults, setBatchResults] = useState(null)

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    setCsvErrors([])
    setBatchResults(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target.result
      try {
        const rows = parseCSV(text)
        const validation = validateTransactionCSV(rows)
        if (!validation.valid) {
          setCsvErrors(validation.errors)
          setCsvRows([])
          toast.error(`CSV invalid: ${validation.errors[0]}`)
        } else {
          setCsvRows(rows)
          toast.success(`Loaded ${rows.length} transactions for scoring`)
        }
      } catch (err) {
        setCsvErrors(['Failed to parse CSV file: ' + err.message])
        toast.error('Failed to parse CSV file')
      }
    }
    reader.readAsText(file)
  }

  const handleRunBatch = async () => {
    if (!csvRows.length) return
    setBatchScoring(true)
    try {
      const res = await predictBatch(csvRows)
      setBatchResults(res)
      toast.success(
        `Scored ${res.processedCount} transactions. Found ${res.flaggedCount} suspicious, ${res.fraudCount} blocked.`,
        { duration: 5000 }
      )
    } catch (err) {
      toast.error('Batch scoring failed: ' + err.message)
    } finally {
      setBatchScoring(false)
    }
  }

  const handleExportBatchResults = () => {
    if (!batchResults?.results) return
    const exportData = batchResults.results.map((r) => ({
      ID: r.id,
      Amount: r.amount || r.Amount,
      RiskScore: r.riskScore,
      Band: r.band,
      Status: r.status,
    }))
    exportToCSV(exportData, `fraudshield_batch_scored_${Date.now()}.csv`)
    toast.success('Batch results exported to CSV!')
  }

  // ── Tab 3: Sample Picker State ──
  const [selectedSample, setSelectedSample] = useState(SAMPLE_PRESETS[0])
  const [predictResult, setPredictResult] = useState(null)
  const [predictLoading, setPredictLoading] = useState(false)
  const [showModelInputs, setShowModelInputs] = useState(false)

  const runPrediction = async (sample) => {
    setSelectedSample(sample)
    setPredictLoading(true)
    try {
      const res = await predictFraud({
        id: sample.id,
        amount: sample.amountINR,
        riskScore: sample.riskScore,
        isNewDevice: sample.isNewDevice,
        isForeignIp: sample.isForeignIp,
        features: sample.modelInputs,
      })
      setPredictResult(res)
    } catch (err) {
      toast.error('Prediction failed: ' + err.message)
    } finally {
      setPredictLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'sample' && !predictResult) {
      runPrediction(SAMPLE_PRESETS[0])
    }
  }, [activeTab])

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-600 mb-1">
            <Cpu className="w-4 h-4" />
            <span>ML Inference Testing Lab</span>
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Transaction Checker
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Verify transactions against the real XGBoost fraud detection model.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center p-1 bg-neutral-100 rounded-xl border border-neutral-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'manual'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-primary-600" />
            <span>Manual Entry</span>
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'batch'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-primary-600" />
            <span>CSV Batch</span>
          </button>
          <button
            onClick={() => setActiveTab('sample')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'sample'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-primary-600" />
            <span>Pick a Stored Sample</span>
          </button>
        </div>
      </div>

      {/* ──────────────── TAB A: MANUAL ENTRY ──────────────── */}
      {activeTab === 'manual' && (
        <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-6 md:p-8">
            {manualResult ? (
              <ResultPanel
                result={manualResult}
                onReset={() => setManualResult(null)}
              />
            ) : (
              <div className="space-y-6">
                <div className="pb-4 border-b border-neutral-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-800">
                      Staff Transaction Evaluator
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Input customer payment parameters or paste full 30-feature vector for inference.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary-50 text-primary-700 font-bold">
                    STAFF MODE
                  </span>
                </div>

                <PaymentForm
                  mode="staff"
                  loading={manualLoading}
                  onSubmit={handleManualSubmit}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── TAB B: CSV BATCH ──────────────── */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Batch Inference Pipeline</h3>
                <p className="text-xs text-neutral-500">
                  Upload transaction records in CSV format for bulk ML risk classification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  generateSampleTransactionCSV()
                  toast.success('Downloaded sample_transactions.csv')
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold self-start"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template</span>
              </button>
            </div>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center hover:border-primary-400 hover:bg-primary-50/20 transition cursor-pointer relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <FileSpreadsheet className="w-10 h-10 text-primary-500 mb-3" />
                <p className="text-xs font-bold text-neutral-800">
                  {csvFile ? csvFile.name : 'Click or drag & drop CSV file here'}
                </p>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Expected columns: Amount, Time, V1..V28 (or AmountINR, Merchant, City)
                </p>
              </div>
            </div>

            {/* Parsing Errors if any */}
            {csvErrors.length > 0 && (
              <div className="p-4 bg-risk-50 border border-risk-200 rounded-xl text-risk-800 text-xs space-y-1">
                <p className="font-bold">Validation Errors in CSV:</p>
                <ul className="list-disc list-inside">
                  {csvErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            {csvRows.length > 0 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-neutral-600">
                  Ready to score {csvRows.length} transactions
                </span>
                <button
                  type="button"
                  onClick={handleRunBatch}
                  disabled={batchScoring}
                  className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  <span>{batchScoring ? 'Scoring Batch...' : 'Run Model Batch Scoring'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Batch Scoring Results */}
          {batchResults && (
            <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <h3 className="text-sm font-bold text-neutral-900">Batch Scoring Summary</h3>
                <button
                  type="button"
                  onClick={handleExportBatchResults}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Scored CSV</span>
                </button>
              </div>

              {/* KPI summary tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[11px] font-bold uppercase text-neutral-500">Processed</span>
                  <p className="text-2xl font-extrabold text-neutral-900 mt-1">
                    {batchResults.processedCount}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[11px] font-bold uppercase text-amber-700">Flagged for Review</span>
                  <p className="text-2xl font-extrabold text-amber-800 mt-1">
                    {batchResults.flaggedCount}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-[11px] font-bold uppercase text-rose-700">Blocked Fraud</span>
                  <p className="text-2xl font-extrabold text-rose-800 mt-1">
                    {batchResults.fraudCount}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── TAB C: STORED SAMPLE PICKER ──────────────── */}
      {activeTab === 'sample' && (
        <div className="space-y-6">
          {/* Preset Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SAMPLE_PRESETS.map((sample) => (
              <button
                key={sample.id}
                onClick={() => runPrediction(sample)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  selectedSample.id === sample.id
                    ? 'border-primary-500 bg-primary-50/40 ring-2 ring-primary-500/20'
                    : 'border-neutral-200/80 bg-white hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-neutral-400 font-bold uppercase">
                    {sample.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      sample.trueLabel === 1
                        ? 'bg-rose-100 text-rose-700'
                        : sample.riskScore >= 0.5
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {sample.trueLabel === 1 ? 'Fraud' : sample.riskScore >= 0.5 ? 'Review' : 'Normal'}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-neutral-900 leading-snug">{sample.label}</h4>
                <div className="mt-2 text-[11px] text-neutral-500 flex justify-between font-medium">
                  <span>{sample.merchant}</span>
                  <span className="font-bold text-neutral-900">
                    ₹{sample.amountINR.toLocaleString('en-IN')}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Sample Scoring Result */}
          {predictResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* Gauge */}
              <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                    Sample Model Gauge
                  </h3>
                  <RiskBadge score={predictResult.riskScore} size="sm" />
                </div>
                <div className="flex justify-center py-2">
                  <RiskMeter score={predictResult.riskScore} size={200} />
                </div>
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/60 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Action Recommended:</span>
                    <span className="font-bold text-neutral-900">
                      {predictResult.actionRecommended || predictResult.action || 'APPROVE'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Inference Latency:</span>
                    <span className="font-mono text-neutral-700">
                      {predictResult.modelLatencyMs || 2.4} ms
                    </span>
                  </div>
                </div>
              </div>

              {/* Factors & Model Inputs */}
              <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                    Feature Importances (XAI)
                  </h3>
                  <span className="text-[11px] font-mono font-bold text-primary-600">SHAP</span>
                </div>

                {predictResult.factors && predictResult.factors.length > 0 ? (
                  <FactorsChart factors={predictResult.factors} />
                ) : (
                  <p className="text-xs text-neutral-400">No factor breakdown available.</p>
                )}

                <div className="pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setShowModelInputs(!showModelInputs)}
                    className="flex items-center justify-between w-full text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                  >
                    <span>Raw Input Features</span>
                    {showModelInputs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showModelInputs && (
                    <pre className="mt-2 p-3 bg-neutral-900 text-neutral-200 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48">
                      {JSON.stringify(selectedSample.modelInputs, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TransactionCheckerPage
