import React, { useState } from 'react'
import { CreditCard, ShieldCheck, Sparkles } from 'lucide-react'
import { PaymentForm } from '../../components/payment/PaymentForm.jsx'
import { ResultPanel } from '../../components/payment/ResultPanel.jsx'
import { submitTransaction } from '../../services/transactions.js'
import toast from 'react-hot-toast'

export function UseMyCardPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleSubmit = async (payload) => {
    try {
      setLoading(true)
      const res = await submitTransaction(payload)
      setResult(res)
      if (res.decision === 'approved') {
        toast.success('Payment approved!')
      } else if (res.decision === 'review') {
        toast('Payment held for security review.', { icon: '⚠️' })
      } else if (res.decision === 'blocked') {
        toast.error('Payment blocked by fraud shield.')
      } else if (res.decision === 'declined') {
        toast.error(`Payment declined: ${res.reason || 'authorization failure'}`)
      }
    } catch (err) {
      console.error('Payment submission failed:', err)
      toast.error(err.message || 'Payment processing failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-600 mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Cardholder Portal</span>
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Use My Card
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Perform an authorized purchase transaction with your active card credentials.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold self-start">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Real-Time Fraud Shield Active</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-6 md:p-8">
          {result ? (
            <ResultPanel result={result} onReset={() => setResult(null)} />
          ) : (
            <div className="space-y-6">
              <div className="pb-4 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-neutral-800">Payment Authorization Details</h2>
                  <p className="text-xs text-neutral-500">
                    Select your card, merchant, amount in INR, and behavioral pattern.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-neutral-400">
                  Step 1 of 2
                </span>
              </div>

              <PaymentForm
                mode="customer"
                loading={loading}
                onSubmit={handleSubmit}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
