import React from 'react'
import { FileText, Store, BarChart3 } from 'lucide-react'
import { ReportBuilder } from '../../components/reports/ReportBuilder.jsx'

/**
 * Screen S22: Merchant Settlement & Risk Reports
 * Reuses the shared ReportBuilder from S10 as specified in extra requirements.
 */
export function MerchantReportsPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Merchant Risk & Settlement Reports
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 uppercase tracking-wider">
              <Store className="w-3.5 h-3.5" />
              S22 Portal
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Generate merchant financial summaries, export dispute telemetry, and audit chargeback exposure.
          </p>
        </div>
      </div>

      {/* Shared Report Builder */}
      <ReportBuilder role="merchant" />
    </div>
  )
}

export default MerchantReportsPage
