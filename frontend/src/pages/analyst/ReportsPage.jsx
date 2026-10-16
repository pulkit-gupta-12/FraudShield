import React from 'react'
import { FileText, Download } from 'lucide-react'
import { ReportBuilder } from '../../components/reports/ReportBuilder.jsx'

/**
 * Screen S10: Compliance & Fraud Analytics Reports
 * Embeds the shared ReportBuilder component.
 */
export function ReportsPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Audit & Risk Report Generator
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 uppercase tracking-wider">
              Analytics Hub
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Generate executive compliance summaries, download CSV exports, and monitor loss prevention trends
          </p>
        </div>
      </div>

      {/* Shared Report Builder */}
      <ReportBuilder role="analyst" />
    </div>
  )
}

export default ReportsPage
