import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  Info,
  ShieldCheck,
  Search,
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import { getPatterns } from '../../services/patterns.js'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'
import toast from 'react-hot-toast'

export function AdminPatterns() {
  const [patterns, setPatterns] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const data = await getPatterns()
        setPatterns(Array.isArray(data) ? data : data.results || [])
      } catch (err) {
        console.error('Failed to load patterns:', err)
        toast.error('Failed to load spending patterns')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredPatterns = patterns.filter(
    (p) =>
      p.code?.toLowerCase().includes(search.toLowerCase()) ||
      p.label?.toLowerCase().includes(search.toLowerCase()) ||
      p.trueLabel?.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    {
      key: 'code',
      label: 'Pattern Code',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md border border-primary-200">
          {row.code}
        </span>
      ),
    },
    {
      key: 'label',
      label: 'Behavioral Description',
      render: (row) => (
        <span className="text-xs font-semibold text-neutral-900 block">{row.label}</span>
      ),
    },
    {
      key: 'typicalAmount',
      label: 'Typical Amount (USD)',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-neutral-800">
          ${Number(row.typicalAmount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'typicalTime',
      label: 'Typical Timing',
      render: (row) => (
        <span className="text-xs text-neutral-600 font-medium">{row.typicalTime || 'Anytime'}</span>
      ),
    },
    {
      key: 'baseScore',
      label: 'Base ML Score',
      render: (row) => (
        <div className="flex items-center gap-2">
          <RiskBadge score={row.baseScore ?? 0} size="sm" />
          <span className="font-mono text-xs text-neutral-500 font-bold">
            {row.baseScore !== undefined ? Number(row.baseScore).toFixed(3) : 'N/A'}
          </span>
        </div>
      ),
    },
    {
      key: 'trueLabel',
      label: 'True Ground Truth Label',
      render: (row) => {
        const lbl = String(row.trueLabel || 'LEGIT').toUpperCase()
        const isFraud = lbl === '1' || lbl === 'FRAUD'
        const isSuspicious = lbl === 'SUSPICIOUS'

        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              isFraud
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : isSuspicious
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {isFraud ? (
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
            ) : isSuspicious ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{isFraud ? 'FRAUD (1)' : isSuspicious ? 'SUSPICIOUS' : 'NORMAL (0)'}</span>
          </span>
        )
      },
    },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-600 mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Real Behavior Profiles</span>
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Demo Behavioral Patterns
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Held-out anonymized feature vectors bridging human input with XGBoost 30-feature inference.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary-50 border border-primary-200 text-primary-800 text-xs font-bold self-start">
          <Database className="w-4 h-4 text-primary-600" />
          <span>20 Ground Truth Profiles Loaded</span>
        </div>
      </div>

      {/* Honest Bridge Explanation Box */}
      <div className="p-5 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/80 rounded-2xl shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-primary-900 font-bold text-xs uppercase tracking-wide">
          <Info className="w-4 h-4 text-primary-600" />
          <span>How Demo Patterns Work as an Honest Bridge</span>
        </div>
        <p className="text-xs text-neutral-700 leading-relaxed">
          The machine learning model requires 30 continuous mathematical inputs (Time, V1..V28, Amount),
          which originate from principal component analysis (PCA) on confidential transaction sequences.
          Because a human user can only meaningfully specify <strong>Time</strong> and <strong>Amount in INR</strong>,
          these 20 held-out real profiles provide the underlying velocity and transaction dynamics (V1..V28)
          while your typed INR amount and timestamp are dynamically injected into the model for live inference.
        </p>
      </div>

      {/* Patterns Table */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search pattern code, label..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <span className="text-xs text-neutral-400 font-semibold">
            Showing {filteredPatterns.length} of 20 patterns
          </span>
        </div>

        <DataTable
          columns={columns}
          data={filteredPatterns}
          loading={loading}
          emptyMessage="No spending patterns loaded."
        />
      </div>
    </div>
  )
}

export default AdminPatterns
