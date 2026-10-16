import React, { useState } from 'react'
import {
  UploadCloud,
  FileSpreadsheet,
  Play,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
  RefreshCw,
  Search,
} from 'lucide-react'
import { parseCSV, exportToCSV } from '../../utils/csv.js'
import { batchScoreTransactions } from '../../services/transactions.js'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { THRESHOLD, REVIEW_FLOOR } from '../../config/constants.js'
import toast from 'react-hot-toast'

/**
 * Screen S11: Batch Upload & Offline Scoring
 * Implements CSV drag & drop upload, preview table, progress bar during scoring,
 * scored results DataTable, and real CSV download via exportToCSV.
 */
export function BatchUploadPage() {
  const [file, setFile] = useState(null)
  const [previewRows, setPreviewRows] = useState([])
  const [scoring, setScoring] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(null)
  const [errorLog, setErrorLog] = useState([])

  // Sample CSV generator for easy testing by judges
  const handleLoadSampleCSV = () => {
    const sampleCSV = `transactionId,amountINR,merchant,merchantCategory,city,Time,Amount,V1,V2,V3,V4
TXN-BATCH-001,48200,Reliance Retail,Retail,Mumbai,120,48200,-1.42,0.85,-2.1,1.8
TXN-BATCH-002,1250,Swiggy Food,Food,Bengaluru,240,1250,0.12,0.05,0.2,-0.1
TXN-BATCH-003,98500,Dubai Duty Free,Jewelry,International,360,98500,-3.85,2.4,-4.2,3.1
TXN-BATCH-004,3400,Apollo Pharmacy,Healthcare,Delhi,480,3400,-0.1,0.2,-0.3,0.1
TXN-BATCH-005,65000,Croma Electronics,Electronics,Hyderabad,600,65000,-2.4,1.8,-3.1,2.4
TXN-BATCH-006,890,Uber Rides,Transport,Delhi,720,890,0.05,-0.1,0.1,-0.05
TXN-BATCH-007,142000,Crypto Gateway India,Crypto,Mumbai,840,142000,-4.5,3.2,-5.1,4.2
TXN-BATCH-008,540,Chai Point,Food,Bengaluru,960,540,0.02,0.01,0.05,-0.02`

    const parsed = parseCSV(sampleCSV)
    setPreviewRows(parsed)
    setFile({ name: 'sample_transactions_batch.csv', size: 1420 })
    toast.success('Loaded sample transaction CSV batch')
  }

  // Handle file drop / upload
  const handleFileUpload = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text === 'string') {
        const parsed = parseCSV(text)
        setPreviewRows(parsed)
        toast.success(`Loaded ${parsed.length} rows from ${selected.name}`)
      }
    }
    reader.readAsText(selected)
  }

  // Run Batch Scoring with animated progress
  const handleRunScoring = async () => {
    if (!previewRows.length) {
      toast.error('Please upload a CSV file or load sample data first')
      return
    }

    setScoring(true)
    setProgress(15)

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(timer)
          return 90
        }
        return prev + 25
      })
    }, 250)

    try {
      const res = await batchScoreTransactions(previewRows)
      clearInterval(timer)
      setProgress(100)
      setResults(res)
      toast.success(
        `Scored ${res.processedCount} records! ${res.flaggedCount} flagged, ${res.fraudCount} high risk.`,
        { icon: '🎯', duration: 4000 }
      )
    } catch (err) {
      clearInterval(timer)
      toast.error(err.message || 'Batch scoring failed')
      setErrorLog([err.message || 'Batch inferencing failed'])
    } finally {
      setScoring(false)
    }
  }

  // Download Scored Results (S11 Requirement)
  const handleDownloadScoredCSV = () => {
    if (!results?.results?.length) return

    const exportRows = results.results.map((r) => ({
      TransactionID: r.transactionId || r.id,
      Merchant: r.merchant || '',
      AmountINR: r.amountINR || r.amount || '',
      RiskScore: r.riskScore,
      ClassificationBand: r.band,
      RecommendedAction: r.riskScore >= THRESHOLD ? 'BLOCK' : r.riskScore >= REVIEW_FLOOR ? 'REVIEW' : 'APPROVE',
    }))

    exportToCSV(exportRows, `fraudshield_scored_results_${Date.now()}.csv`)
    toast.success('Scored batch results downloaded as CSV')
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Batch Scoring & Offline Inference
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 uppercase tracking-wider">
              Bulk Pipeline
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Upload transaction datasets to run high-throughput XGBoost model evaluation and download audited results
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadSampleCSV}
          className="px-4 py-2 rounded-xl bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-semibold text-xs shadow-xs transition flex items-center gap-2 w-fit"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Load Demo CSV Dataset
        </button>
      </div>

      {/* Drag & Drop Upload Surface */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="border-2 border-dashed border-neutral-300 rounded-2xl p-8 text-center hover:border-primary-400 hover:bg-primary-50/10 transition flex flex-col items-center justify-center">
          <UploadCloud className="w-12 h-12 text-primary-600 mb-3" />
          <h3 className="font-bold text-base text-neutral-900">
            {file ? file.name : 'Upload Batch CSV File'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mt-1 mb-4">
            Supports standard tabular headers: <code className="font-mono text-neutral-700">transactionId, amountINR, merchant, city</code> or ML vectors <code className="font-mono text-neutral-700">V1–V28</code>.
          </p>

          <label className="cursor-pointer px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition">
            Choose CSV from Computer
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Progress Bar during scoring */}
        {scoring && (
          <div className="space-y-2 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
            <div className="flex justify-between text-xs font-semibold text-neutral-800">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-primary-600 animate-spin" />
                Executing XGBoost scoring matrix...
              </span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="w-full bg-neutral-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        {previewRows.length > 0 && !results && (
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={scoring}
              onClick={handleRunScoring}
              className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {scoring ? 'Scoring Batch...' : `Run Scoring on ${previewRows.length} Rows`}
            </button>
          </div>
        )}
      </div>

      {/* CSV Preview Table (First 10 Rows) */}
      {previewRows.length > 0 && !results && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-600" />
              Batch Preview (First {Math.min(10, previewRows.length)} Records)
            </h3>
            <span className="text-xs text-neutral-400 font-mono">
              Ready for evaluation
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 font-semibold uppercase">
                  {Object.keys(previewRows[0] || {}).slice(0, 6).map((h) => (
                    <th key={h} className="py-2 px-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {previewRows.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50">
                    {Object.values(row).slice(0, 6).map((val, vIdx) => (
                      <td key={vIdx} className="py-2 px-3 font-mono text-neutral-800">{String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scored Results Section */}
      {results && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs">
              <span className="text-xs text-neutral-500 font-semibold uppercase">Evaluated Total</span>
              <div className="text-2xl font-black text-neutral-900 mt-1 font-mono">{results.processedCount}</div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs">
              <span className="text-xs text-amber-600 font-semibold uppercase">Flagged for Review</span>
              <div className="text-2xl font-black text-amber-600 mt-1 font-mono">{results.flaggedCount}</div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs">
              <span className="text-xs text-red-600 font-semibold uppercase">High-Risk Fraud</span>
              <div className="text-2xl font-black text-red-600 mt-1 font-mono">{results.fraudCount}</div>
            </div>
          </div>

          {/* Scored DataTable with Real CSV Download */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Batch Scoring Results
              </h3>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResults(null)
                    setPreviewRows([])
                    setFile(null)
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Upload New Batch
                </button>
                <button
                  type="button"
                  id="download-scored-csv-btn"
                  onClick={handleDownloadScoredCSV}
                  className="px-4 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Scored CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 font-semibold uppercase">
                    <th className="py-2.5 px-3">Transaction ID</th>
                    <th className="py-2.5 px-3">Merchant</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Risk Score</th>
                    <th className="py-2.5 px-3">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {results.results.map((r, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">{r.transactionId || r.id}</td>
                      <td className="py-2.5 px-3">{r.merchant || 'Sample Merchant'}</td>
                      <td className="py-2.5 px-3 font-mono font-bold">₹{(r.amountINR || r.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3">
                        <RiskBadge score={r.riskScore} size="sm" />
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.riskScore >= THRESHOLD ? 'bg-red-100 text-red-800' : r.riskScore >= REVIEW_FLOOR ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {r.riskScore >= THRESHOLD ? 'Auto-Halt' : r.riskScore >= REVIEW_FLOOR ? 'Challenge' : 'Approve'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BatchUploadPage
