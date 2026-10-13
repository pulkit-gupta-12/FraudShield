import React from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'

export function PageStub({ title, description, badge = 'Coming in the next step', role = '' }) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{title}</h1>
            {role && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200 uppercase tracking-wider">
                {role}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-review-50 text-review-700 border border-review-200 shadow-sm w-fit">
          <Sparkles className="w-3.5 h-3.5 text-review-500 animate-pulse" />
          {badge}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[320px]">
        <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4 text-neutral-400">
          <Sparkles className="w-8 h-8 text-primary-500" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">{title} Workspace</h3>
        <p className="text-neutral-500 max-w-md text-sm mb-6">
          {description} Full interactive feature implementation, live charts, and workflows are scheduled for the next step.
        </p>
        <div className="inline-flex items-center gap-2 text-xs font-medium text-neutral-400 bg-neutral-50 px-4 py-2 rounded-lg border border-neutral-200">
          <span>Route: <code className="text-neutral-700 font-mono">{window.location.pathname}</code></span>
        </div>
      </div>
    </div>
  )
}
