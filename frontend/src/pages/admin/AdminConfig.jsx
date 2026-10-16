import React, { useState, useEffect } from 'react'
import {
  Sliders,
  Mail,
  Cpu,
  ToggleLeft,
  Save,
  RotateCcw,
  Shield,
  FileCheck,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
} from 'lucide-react'
import { getSystemConfig, updateThresholds } from '../../services/model.js'
import { getAuditLogs } from '../../services/reports.js'
import { THRESHOLD, REVIEW_FLOOR } from '../../config/constants.js'
import { Slider } from '../../components/ui/Slider.jsx'
import { Toggle } from '../../components/ui/Toggle.jsx'
import { ErrorState } from '../../components/ui/ErrorState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import toast from 'react-hot-toast'

/**
 * Screen S8: System Configuration & Risk Parameters
 * Controls cutoffs, feature flags, alert email lists, and audit log history.
 */
export function AdminConfig() {
  const [config, setConfig] = useState(null)
  const [suspiciousCutoff, setSuspiciousCutoff] = useState(REVIEW_FLOOR)
  const [fraudCutoff, setFraudCutoff] = useState(THRESHOLD)
  const [selectedModel, setSelectedModel] = useState('xgb-fraud-v2.4.1')
  const [alertEmails, setAlertEmails] = useState([])
  const [newEmail, setNewEmail] = useState('')
  const [featureFlags, setFeatureFlags] = useState({
    enableBatchScoring: true,
    enableAutoBlock: false,
    enableSmsOtpChallenge: true,
    enableRealtimeWebhooks: true,
  })

  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const loadConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const [cfg, logs] = await Promise.all([
        getSystemConfig(),
        getAuditLogs({ pageSize: 6 }),
      ])
      setConfig(cfg)
      setSuspiciousCutoff(cfg.reviewFloor ?? cfg.suspiciousThreshold ?? REVIEW_FLOOR)
      setFraudCutoff(cfg.threshold ?? cfg.fraudThreshold ?? THRESHOLD)
      setSelectedModel(cfg.selectedModel || 'xgb-fraud-v2.4.1')
      setAlertEmails(cfg.alertEmails || ['alerts@fraudshield.io', 'security-ops@fraudshield.io'])
      if (cfg.featureFlags) setFeatureFlags(cfg.featureFlags)
      setAuditLogs(logs.results || [])
    } catch (err) {
      setError(err.message || 'Failed to load system configuration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const handleAddEmail = (e) => {
    e.preventDefault()
    if (!newEmail.trim() || !newEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    if (alertEmails.includes(newEmail.trim())) {
      toast.error('Email already in notification roster')
      return
    }
    setAlertEmails([...alertEmails, newEmail.trim()])
    setNewEmail('')
    toast.success('Alert recipient added')
  }

  const handleRemoveEmail = (email) => {
    setAlertEmails(alertEmails.filter((e) => e !== email))
    toast.success('Alert recipient removed')
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      await updateThresholds(suspiciousCutoff, fraudCutoff)
      toast.success('System configuration & model parameters persisted successfully!')
      // reload audit logs
      const logs = await getAuditLogs({ pageSize: 6 })
      setAuditLogs(logs.results || [])
    } catch (err) {
      toast.error(err.message || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setSuspiciousCutoff(REVIEW_FLOOR)
    setFraudCutoff(THRESHOLD)
    setSelectedModel('xgb-fraud-v2.4.1')
    setFeatureFlags({
      enableBatchScoring: true,
      enableAutoBlock: false,
      enableSmsOtpChallenge: true,
      enableRealtimeWebhooks: true,
    })
    toast.success('Parameters reverted to system defaults')
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <ErrorState
          title="Configuration Service Offline"
          message={error}
          onRetry={loadConfig}
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
              System Configuration & Risk Cutoffs
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 uppercase tracking-wider">
              Governance
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Tune algorithmic sensitivity boundaries, feature toggles, and incident dispatch lists
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 rounded-xl bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-semibold text-xs shadow-xs transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            type="button"
            id="save-config-btn"
            disabled={saving}
            onClick={handleSaveAll}
            className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Applying...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Cutoffs, Emails, & Feature Flags */}
        <div className="lg:col-span-2 space-y-6">
          {/* Risk Threshold Sliders */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary-600" />
                  ML Probability Cutoff Sliders
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Tune when transactions transition between SAFE, REVIEW, and FRAUD
                </p>
              </div>
            </div>

            {loading ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-bold text-neutral-800 mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      SUSPICIOUS Cutoff Threshold
                    </span>
                    <span className="font-mono text-amber-600 text-sm">
                      {Math.round(suspiciousCutoff * 100)}% ({suspiciousCutoff})
                    </span>
                  </div>
                  <Slider
                    min={0.10}
                    max={0.88}
                    step={0.01}
                    value={suspiciousCutoff}
                    onChange={(v) => setSuspiciousCutoff(Number(v))}
                  />
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    Transactions scoring at or above this value trigger cardholder challenge or manual analyst review.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-neutral-800 mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                      FRAUD Auto-Block Cutoff Threshold
                    </span>
                    <span className="font-mono text-red-600 text-sm">
                      {Math.round(fraudCutoff * 100)}% ({fraudCutoff})
                    </span>
                  </div>
                  <Slider
                    min={0.50}
                    max={0.99}
                    step={0.01}
                    value={fraudCutoff}
                    onChange={(v) => setFraudCutoff(Number(v))}
                  />
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    Transactions scoring at or above this threshold are classified as High Risk Fraud and halted.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Model Selector & Feature Flags */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-6">
            <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary-600" />
              Active Artifact & Feature Flags
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Active Model Checkpoint (.joblib)
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-neutral-300 bg-white text-xs font-mono font-medium focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="xgb-fraud-v2.4.1">xgb-fraud-v2.4.1.joblib (Active)</option>
                  <option value="xgb-fraud-v2.3.9">xgb-fraud-v2.3.9.joblib (Challenger)</option>
                  <option value="rf-ensemble-v1.2.0">rf-ensemble-v1.2.0.joblib (Baseline)</option>
                </select>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-800">Enable Batch Scoring</span>
                  <Toggle
                    checked={featureFlags.enableBatchScoring}
                    onChange={(c) => setFeatureFlags({ ...featureFlags, enableBatchScoring: c })}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-800">Auto-Block High Risk Cards</span>
                  <Toggle
                    checked={featureFlags.enableAutoBlock}
                    onChange={(c) => setFeatureFlags({ ...featureFlags, enableAutoBlock: c })}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-800">SMS OTP Step-up Challenge</span>
                  <Toggle
                    checked={featureFlags.enableSmsOtpChallenge}
                    onChange={(c) => setFeatureFlags({ ...featureFlags, enableSmsOtpChallenge: c })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Alert Notification Email Roster */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary-600" />
              Critical Incident Notification Roster
            </h3>

            <form onSubmit={handleAddEmail} className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="security-officer@bank.com"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs shadow-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Recipient
              </button>
            </form>

            <div className="flex flex-wrap gap-2 pt-2">
              {alertEmails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-800 text-xs font-mono font-medium border border-neutral-200"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    className="text-neutral-400 hover:text-red-600 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Recent Configuration Audit Trail */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-600" />
              Recent Configuration Audit Trail
            </h3>

            {loading ? (
              <Skeleton className="h-56 rounded-xl" />
            ) : auditLogs.length === 0 ? (
              <p className="text-xs text-neutral-400 py-4 text-center">No recent audit records.</p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl border border-neutral-100 bg-neutral-50/50 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900 font-mono text-[11px]">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-600 line-clamp-2">{log.details}</p>
                    <div className="text-[10px] text-neutral-400 flex justify-between pt-1">
                      <span>By {log.actor}</span>
                      <span className="text-emerald-600 font-bold">{log.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminConfig
