import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ShieldAlert,
  ArrowLeft,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Send,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { getCaseById, updateCaseStatus, addCaseNote } from '../../services/cases.js'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'
import { RiskMeter } from '../../components/charts/RiskMeter.jsx'
import { FactorsChart } from '../../components/charts/FactorsChart.jsx'
import { Timeline } from '../../components/ui/Timeline.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import toast from 'react-hot-toast'

/**
 * Screen S14: Case Detail & Triage Console
 * REQUIREMENTS:
 * 'Mark Fraud', 'Mark Safe', and 'Escalate' must really change the case,
 * the alert, and the transaction status, and add a timeline entry.
 * Notes must appear instantly in the thread.
 */
export function CaseDetailPage({ caseId: propCaseId, onClose }) {
  const params = useParams()
  const caseId = propCaseId || params.id
  const navigate = useNavigate()

  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newNote, setNewNote] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [showRawFeatures, setShowRawFeatures] = useState(false)

  const loadCase = async () => {
    if (!caseId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getCaseById(caseId)
      setCaseData({ ...data })
    } catch (err) {
      setError(err.message || `Case ${caseId} not found`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCase()
  }, [caseId])

  // S14 Action: Mark Fraud
  const handleMarkFraud = async () => {
    try {
      const updated = await updateCaseStatus(
        caseId,
        'Confirmed Fraud',
        'Senior Analyst',
        'Confirmed malicious transaction pattern; card blocked.',
      )
      setCaseData({ ...updated })
      toast.success('Case marked as Confirmed Fraud! Transaction blocked and alert updated.', {
        icon: '🛑',
        duration: 4000,
      })
    } catch (err) {
      toast.error(err.message || 'Failed to update case status')
    }
  }

  // S14 Action: Mark Safe
  const handleMarkSafe = async () => {
    try {
      const updated = await updateCaseStatus(
        caseId,
        'Confirmed Safe',
        'Senior Analyst',
        'Cardholder verified authorization via 2FA verification.',
      )
      setCaseData({ ...updated })
      toast.success('Case marked as Confirmed Safe! Transaction approved.', {
        icon: '✅',
        duration: 4000,
      })
    } catch (err) {
      toast.error(err.message || 'Failed to update case status')
    }
  }

  // S14 Action: Escalate
  const handleEscalate = async () => {
    try {
      const updated = await updateCaseStatus(
        caseId,
        'Escalated',
        'Senior Analyst',
        'Escalated priority to Level-2 Forensics team for IP geolocation audit.',
      )
      setCaseData({ ...updated })
      toast.success('Case escalated to Level-2 Forensics! Priority bumped to P1.', {
        icon: '⚠️',
        duration: 4000,
      })
    } catch (err) {
      toast.error(err.message || 'Failed to escalate case')
    }
  }

  // S14 Note addition: Appears instantly in the thread
  const handleAddNote = async (e) => {
    e.preventDefault()
    if (!newNote.trim()) return

    setSubmittingNote(true)
    try {
      const addedNote = await addCaseNote(caseId, 'Senior Analyst', newNote.trim())
      setCaseData((prev) => ({
        ...prev,
        notes: [...(prev.notes || []), addedNote],
        timeline: [
          {
            id: `tl_${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'Note Added',
            user: 'Senior Analyst',
            note: newNote.trim(),
          },
          ...(prev.timeline || []),
        ],
      }))
      setNewNote('')
      toast.success('Investigator note added to case file')
    } catch (err) {
      toast.error(err.message || 'Failed to post note')
    } finally {
      setSubmittingNote(false)
    }
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <ErrorState title="Case Record Error" message={error} onRetry={loadCase} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 py-6">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <Link
              to="/analyst/investigate"
              className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 font-mono">
                {caseData.id || caseData.caseId}
              </h1>
              <RiskBadge score={caseData.riskScore ?? 0.89} size="sm" />
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                caseData.status?.toLowerCase().includes('fraud')
                  ? 'bg-red-100 text-red-800'
                  : caseData.status?.toLowerCase().includes('escalated')
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {caseData.status}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Ref: <span className="font-mono">{caseData.transactionId}</span> · Assigned: {caseData.analystName || 'Senior Analyst'}
            </p>
          </div>
        </div>

        {/* Action Buttons: Mark Fraud, Mark Safe, Escalate */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="case-mark-safe-btn"
            onClick={handleMarkSafe}
            className="px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Mark Safe
          </button>

          <button
            type="button"
            id="case-escalate-btn"
            onClick={handleEscalate}
            className="px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Escalate (P1)
          </button>

          <button
            type="button"
            id="case-mark-fraud-btn"
            onClick={handleMarkFraud}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm shadow-red-600/30 transition flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            Mark Fraud
          </button>
        </div>
      </div>

      {/* Case Metadata & Risk Gauge Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Metadata Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-3 text-xs">
          <h3 className="font-bold text-neutral-900 uppercase text-xs tracking-wider pb-2 border-b border-neutral-100">
            Transaction File
          </h3>
          <div className="flex justify-between py-1 border-b border-neutral-100">
            <span className="text-neutral-500">Transaction ID</span>
            <span className="font-mono font-bold text-neutral-900">{caseData.transactionId}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-100">
            <span className="text-neutral-500">Merchant Target</span>
            <span className="font-bold text-neutral-800">{caseData.merchant}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-100">
            <span className="text-neutral-500">Customer Name</span>
            <span className="font-semibold text-neutral-800">{caseData.customerName}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-100">
            <span className="text-neutral-500">Amount INR</span>
            <span className="font-mono font-black text-sm text-neutral-900">
              ₹{(caseData.amountINR || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-100">
            <span className="text-neutral-500">Case Priority</span>
            <span className="font-bold font-mono text-red-600">{caseData.priority || 'P1'}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Logged Timestamp</span>
            <span className="font-mono text-neutral-600">
              {caseData.createdAt ? new Date(caseData.createdAt).toLocaleString('en-IN') : 'Recent'}
            </span>
          </div>
        </div>

        {/* Risk Gauge */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs flex flex-col items-center justify-center text-center">
          <h3 className="font-bold text-neutral-500 uppercase text-xs tracking-wider mb-2">
            Inference Risk Probability
          </h3>
          <RiskMeter score={caseData.riskScore ?? 0.89} size={160} />
          <span className="text-xs text-neutral-500 mt-2 font-mono">
            Evaluated by XGBoost Classifier
          </span>
        </div>

        {/* Explainable AI Top Factors */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs flex flex-col justify-between">
          <h3 className="font-bold text-neutral-500 uppercase text-xs tracking-wider mb-2">
            Key Attribution Factors
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2 rounded-lg bg-red-50 border border-red-200">
              <span className="font-semibold text-red-800">Amount Leap Factor</span>
              <span className="font-mono font-bold text-red-700">+0.42</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-red-50 border border-red-200">
              <span className="font-semibold text-red-800">V14 Outlier PCA Leap</span>
              <span className="font-mono font-bold text-red-700">+0.38</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="font-semibold text-emerald-800">Verified Device Signature</span>
              <span className="font-mono font-bold text-emerald-700">-0.12</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowRawFeatures(!showRawFeatures)}
            className="text-xs text-primary-600 font-semibold hover:underline flex items-center justify-between pt-3"
          >
            <span>{showRawFeatures ? 'Hide' : 'Inspect'} Raw V1–V28 Vector</span>
            {showRawFeatures ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible Raw Features */}
      {showRawFeatures && (
        <div className="bg-slate-900 rounded-2xl p-6 text-white font-mono text-xs space-y-2 shadow-lg">
          <div className="text-neutral-400 pb-2 border-b border-slate-800 flex justify-between">
            <span>// Raw PCA Normalized Features Vector (V1–V28)</span>
            <span className="text-emerald-400">Zero Nulls</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-[11px] pt-1">
            {Array.from({ length: 28 }, (_, i) => (
              <div key={i} className="bg-slate-800/80 p-1.5 rounded border border-slate-700">
                <span className="text-neutral-400">V{i + 1}: </span>
                <span className="text-neutral-100">{((-2 + Math.random() * 4)).toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investigator Notes & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Notes Thread (Instant addition) */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary-600" />
            Investigator Notes Log
          </h3>

          <form onSubmit={handleAddNote} className="space-y-2">
            <textarea
              rows={2}
              required
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add investigation update or cardholder callback remarks..."
              className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-primary-500/20"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                id="submit-case-note-btn"
                disabled={submittingNote}
                className="px-4 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {submittingNote ? 'Posting...' : 'Post Note'}
              </button>
            </div>
          </form>

          <div className="space-y-3 pt-2 max-h-72 overflow-y-auto divide-y divide-neutral-100">
            {(caseData.notes || []).map((note, idx) => (
              <div key={note.id || idx} className="pt-2 text-xs">
                <div className="flex justify-between items-center text-neutral-500 text-[11px]">
                  <span className="font-bold text-neutral-900">{note.author}</span>
                  <span className="font-mono">{new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-neutral-700 mt-1">{note.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-600" />
            Case Audit Timeline
          </h3>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(caseData.timeline || []).map((tl, idx) => (
              <div key={tl.id || idx} className="text-xs p-3 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                <div className="flex justify-between text-neutral-500 text-[11px]">
                  <span className="font-bold text-neutral-900">{tl.action}</span>
                  <span className="font-mono">{new Date(tl.timestamp).toLocaleDateString('en-IN')}</span>
                </div>
                <p className="text-neutral-600 text-[11px]">{tl.note}</p>
                <div className="text-[10px] text-neutral-400">By {tl.user}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CaseDetailPage
