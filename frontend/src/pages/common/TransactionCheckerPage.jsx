import React, { useState, useEffect, useRef } from 'react'
import {
  Cpu,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
  Zap,
} from 'lucide-react'
import { predictFraud, predictBatch } from '../../services/predict.js'
import { getTransactions } from '../../services/transactions.js'
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
 * Screen S23: Transaction Checker & ML Inference Simulator
 * Features:
 *  1. Sample picker calling predictFraud (returns score consistent with sample's riskScore).
 *  2. CSV file upload: parsed in-browser via parseCSV, validated columns via validateTransactionCSV,
 *     sample template download via generateSampleTransactionCSV, calls predictBatch.
 *  3. Live simulator generating transactions with start/pause/reset, cleaning up timer on unmount.
 * Follows Code rules in PROJECT_CONTEXT.md. Zero imports from src/mock.
 */
export function TransactionCheckerPage() {
  const [activeTab, setActiveTab] = useState('picker') // 'picker' | 'csv' | 'simulator'

  // ── Tab 1: Sample Picker State ──
  const [selectedSample, setSelectedSample] = useState(SAMPLE_PRESETS[0])
  const [predictResult, setPredictResult] = useState(null)
  const [predictLoading, setPredictLoading] = useState(false)
  const [showModelInputs, setShowModelInputs] = useState(false)

  // ── Tab 2: CSV Upload State ──
  const [csvFile, setCsvFile] = useState(null)
  const [csvRows, setCsvRows] = useState([])
  const [csvErrors, setCsvErrors] = useState([])
  const [batchScoring, setBatchScoring] = useState(false)
  const [batchResults, setBatchResults] = useState(null)

  // ── Tab 3: Live Simulator State ──
  const [simRunning, setSimRunning] = useState(false)
  const [simFeed, setSimFeed] = useState([])
  const timerRef = useRef(null)

  // Run single prediction whenever sample changes
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
    runPrediction(SAMPLE_PRESETS[0])
  }, [])

  // ── Tab 2: CSV Parsing & Validation ──
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
          toast.error('CSV validation failed. Please check required columns.')
        } else {
          setCsvRows(rows)
          toast.success(`Loaded and validated ${rows.length} rows successfully!`)
        }
      } catch (err) {
        setCsvErrors(['Failed to parse CSV format: ' + err.message])
        setCsvRows([])
      }
    }
    reader.readAsText(file)
  }

  const handleDownloadSampleCSV = () => {
    const csvContent = generateSampleTransactionCSV()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'fraudshield_sample_transactions.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Sample CSV downloaded')
  }

  const handleRunBatchScoring = async () => {
    if (!csvRows.length) return
    setBatchScoring(true)
    try {
      const res = await predictBatch(csvFile)
      setBatchResults(res)
      toast.success(`Evaluated ${res.processedCount} records in batch!`)
    } catch (err) {
      toast.error('Batch scoring failed: ' + err.message)
    } finally {
      setBatchScoring(false)
    }
  }

  // ── Tab 3: Live Simulator with unmount cleanup ──
  useEffect(() => {
    if (simRunning) {
      timerRef.current = setInterval(() => {
        const randomAmount = Math.floor(200 + Math.random() * 95000)
        const isFraud = Math.random() < 0.18
        const simulatedScore = isFraud
          ? Number((THRESHOLD + Math.random() * 0.08).toFixed(3))
          : Number((0.02 + Math.random() * 0.45).toFixed(3))

        const newSimTxn = {
          id: `SIM-${Date.now().toString().slice(-5)}`,
          timestamp: new Date().toISOString(),
          cardLast4: String(Math.floor(1000 + Math.random() * 9000)),
          merchant: ['Flipkart', 'Zomato', 'CryptoHub', 'Amazon India', 'Tanishq Gold'][
            Math.floor(Math.random() * 5)
          ],
          amountINR: randomAmount,
          riskScore: simulatedScore,
          band: simulatedScore >= THRESHOLD ? 'FRAUD' : simulatedScore >= REVIEW_FLOOR ? 'SUSPICIOUS' : 'LEGIT',
        }

        setSimFeed((prev) => [newSimTxn, ...prev.slice(0, 19)])
      }, 2500)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    // Unmount cleanup
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [simRunning])

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Transaction Checker & ML Inference Lab
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
              <Zap className="w-3.5 h-3.5" />
              S23 Tool
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Real-time inference against the XGBoost model. Test with sample cards, batch CSV uploads, or real-time simulation.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="inline-flex p-1 bg-neutral-100 rounded-xl border border-neutral-200">
          <button
            onClick={() => setActiveTab('picker')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'picker'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Sample Picker
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'csv'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            CSV Upload
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'simulator'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Live Simulator
          </button>
        </div>
      </div>

      {/* ── TAB 1: SAMPLE PICKER ── */}
      {activeTab === 'picker' && (
        <div className="space-y-6">
          {/* Preset Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_PRESETS.map((preset) => {
              const isSelected = selectedSample.id === preset.id
              return (
                <div
                  key={preset.id}
                  onClick={() => runPrediction(preset)}
                  className={`p-4 rounded-2xl border cursor-pointer transition text-left flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50/20 ring-2 ring-primary-500/20 shadow-sm'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-neutral-400">{preset.id}</span>
                      <RiskBadge score={preset.riskScore} />
                    </div>
                    <h4 className="text-sm font-bold text-neutral-900">{preset.label}</h4>
                    <p className="text-xs text-neutral-500 mt-1">
                      {preset.merchant} • {preset.city}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-900">
                      {formatCurrency(preset.amountINR)}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      Target: {(preset.riskScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Model Inference Results Panel */}
          {predictResult && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Risk Gauge & Recommendation */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  XGBoost Fraud Probability
                </span>
                <RiskMeter score={predictResult.riskScore} size={220} />
                <div className="mt-4">
                  <div className="inline-flex items-center gap-2 mb-2">
                    <RiskBadge score={predictResult.riskScore} />
                    <span className="text-xs font-semibold text-neutral-700">
                      Recommendation: {predictResult.actionRecommended}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Model Latency: <span className="font-mono font-semibold">{predictResult.modelLatencyMs} ms</span>
                  </p>
                </div>
              </div>

              {/* XAI Factors Chart */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 mb-1">
                    Explainable AI (SHAP Attribution)
                  </h3>
                  <p className="text-xs text-neutral-500 mb-4">
                    Top features driving inference toward approval or risk flag.
                  </p>
                  <FactorsChart factors={predictResult.factors} />
                </div>

                {/* Collapsible 'What the Model Saw' PCA Vector */}
                <div className="mt-6 pt-4 border-t border-neutral-100">
                  <button
                    onClick={() => setShowModelInputs(!showModelInputs)}
                    className="flex items-center justify-between w-full text-xs font-semibold text-neutral-700 hover:text-neutral-900"
                  >
                    <span>What the model saw (Preprocessed feature vector)</span>
                    {showModelInputs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showModelInputs && (
                    <div className="mt-3 p-3 bg-neutral-900 text-neutral-100 rounded-xl font-mono text-[11px] overflow-x-auto">
                      <pre>{JSON.stringify(selectedSample.modelInputs, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: CSV BATCH UPLOAD ── */}
      {activeTab === 'csv' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-100">
            <div>
              <h3 className="text-base font-bold text-neutral-900">Batch CSV Scoring Engine</h3>
              <p className="text-xs text-neutral-500">
                Upload transaction sets for synchronous batch classification.
              </p>
            </div>
            <button
              onClick={handleDownloadSampleCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              Download Sample CSV
            </button>
          </div>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-neutral-300 rounded-2xl p-8 text-center hover:border-primary-400 hover:bg-primary-50/20 transition relative cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center">
              <UploadCloud className="w-10 h-10 text-primary-500 mb-2" />
              <p className="text-sm font-semibold text-neutral-800">
                {csvFile ? csvFile.name : 'Choose a transaction CSV file or drag and drop'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">Requires Time, Amount / amountINR, and PCA features</p>
            </div>
          </div>

          {/* Validation Errors */}
          {csvErrors.length > 0 && (
            <div className="p-4 rounded-xl bg-risk-50 border border-risk-200 text-xs text-risk-700 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-risk-500" />
                CSV Validation Failed:
              </div>
              <ul className="list-disc list-inside pl-2">
                {csvErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          {csvRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700">
                  Preview (First {Math.min(5, csvRows.length)} of {csvRows.length} rows)
                </span>
                <button
                  onClick={handleRunBatchScoring}
                  disabled={batchScoring}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-primary-600 text-white hover:bg-primary-700 shadow-sm transition disabled:opacity-50"
                >
                  <Cpu className="w-4 h-4" />
                  {batchScoring ? 'Scoring Batch...' : 'Run Scoring on All Rows'}
                </button>
              </div>

              <div className="border border-neutral-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 font-semibold">
                    <tr>
                      {Object.keys(csvRows[0]).slice(0, 6).map((k) => (
                        <th key={k} className="p-2.5">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-mono">
                    {csvRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50">
                        {Object.values(row).slice(0, 6).map((val, cellIdx) => (
                          <td key={cellIdx} className="p-2.5 truncate max-w-[150px]">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Batch Results Summary */}
          {batchResults && (
            <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-neutral-900">Batch Scoring Summary</h4>
                <button
                  onClick={() => exportToCSV(batchResults.results, 'batch_scored_results.csv')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Results CSV
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <span className="text-xs text-neutral-500">Processed</span>
                  <p className="text-lg font-bold text-neutral-900">{batchResults.processedCount}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <span className="text-xs text-neutral-500">Suspicious</span>
                  <p className="text-lg font-bold text-review-600">{batchResults.flaggedCount}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <span className="text-xs text-neutral-500">Likely Fraud</span>
                  <p className="text-lg font-bold text-risk-600">{batchResults.fraudCount}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: LIVE SIMULATOR ── */}
      {activeTab === 'simulator' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-neutral-900">Real-time Transaction Stream Simulator</h3>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  simRunning ? 'bg-safe-50 text-safe-700 border border-safe-200' : 'bg-neutral-100 text-neutral-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${simRunning ? 'bg-safe-500 animate-pulse' : 'bg-neutral-400'}`}></span>
                  {simRunning ? 'Simulating Live Stream (2.5s)' : 'Paused'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Emulates continuous payment gateway traffic flowing through the inference scoring microservice.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSimRunning(!simRunning)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition ${
                  simRunning
                    ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-300'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {simRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {simRunning ? 'Pause Simulator' : 'Start Simulation'}
              </button>
              <button
                onClick={() => setSimFeed([])}
                className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 border border-neutral-200 transition"
                title="Clear stream"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Simulator Stream Table */}
          <div className="border border-neutral-200 rounded-xl overflow-hidden">
            {simFeed.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-400">
                Simulation idle. Click <strong>Start Simulation</strong> to begin streaming synthetic transactions.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 sticky top-0 font-semibold">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Transaction</th>
                      <th className="p-3">Merchant</th>
                      <th className="p-3">Card</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Risk Assessment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {simFeed.map((tx) => (
                      <tr key={tx.id} className="hover:bg-neutral-50 transition">
                        <td className="p-3 text-neutral-400 font-mono text-[11px]">
                          {formatDateTime(tx.timestamp)}
                        </td>
                        <td className="p-3 font-mono font-semibold text-neutral-900">{tx.id}</td>
                        <td className="p-3 text-neutral-700">{tx.merchant}</td>
                        <td className="p-3 font-mono text-neutral-500">•••• {tx.cardLast4}</td>
                        <td className="p-3 font-semibold text-neutral-900">{formatCurrency(tx.amountINR)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <RiskBadge score={tx.riskScore} />
                            <span className="font-mono text-neutral-500">{(tx.riskScore * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionCheckerPage
