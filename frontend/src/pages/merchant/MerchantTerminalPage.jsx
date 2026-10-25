import React, { useState, useEffect, useCallback } from 'react'
import { Terminal, ShieldCheck, RefreshCw, Receipt } from 'lucide-react'
import { PaymentForm } from '../../components/payment/PaymentForm.jsx'
import { ResultPanel } from '../../components/payment/ResultPanel.jsx'
import { DataTable } from '../../components/ui/DataTable.jsx'
import { RiskBadge } from '../../components/ui/RiskBadge.jsx'
import { submitTransaction, getTransactions } from '../../services/transactions.js'
import toast from 'react-hot-toast'

export function MerchantTerminalPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  // Recent sales table
  const [recentSales, setRecentSales] = useState([])
  const [salesLoading, setSalesLoading] = useState(true)
  const [newRowIds, setNewRowIds] = useState(new Set())

  const fetchRecentSales = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setSalesLoading(true)
      const res = await getTransactions({ pageSize: 10, ordering: '-timestamp' })
      const list = res.results || []

      if (isPolling && list.length > 0) {
        setRecentSales((prev) => {
          const prevIds = new Set(prev.map((item) => item.id || item.publicId))
          const freshIds = new Set()
          list.forEach((item) => {
            const id = item.id || item.publicId
            if (!prevIds.has(id)) {
              freshIds.add(id)
            }
          })
          if (freshIds.size > 0) {
            setNewRowIds(freshIds)
            setTimeout(() => setNewRowIds(new Set()), 3000)
          }
          return list
        })
      } else {
        setRecentSales(list)
      }
    } catch (err) {
      console.warn('Failed to load recent POS sales:', err)
    } finally {
      setSalesLoading(false)
    }
  }, [])

  // Initial fetch and 10s polling + focus listener
  useEffect(() => {
    fetchRecentSales(false)

    const interval = setInterval(() => {
      fetchRecentSales(true)
    }, 10000)

    const handleFocus = () => {
      fetchRecentSales(true)
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleFocus()
    })

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchRecentSales])

  const handleSaleSubmit = async (payload) => {
    try {
      setLoading(true)
      const res = await submitTransaction(payload)
      setResult(res)
      if (res.decision === 'approved') {
        toast.success('Sale approved & settled!')
      } else if (res.decision === 'review') {
        toast('Sale held for security verification.', { icon: '⚠️' })
      } else if (res.decision === 'blocked') {
        toast.error('Sale blocked by fraud prevention engine.')
      } else if (res.decision === 'declined') {
        toast.error(`Sale declined: ${res.reason || 'card limit or block'}`)
      }
      // Refresh recent sales
      fetchRecentSales(true)
    } catch (err) {
      console.error('POS Sale processing failed:', err)
      toast.error(err.message || 'POS transaction failed')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'publicId',
      label: 'Transaction ID',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-neutral-800">
          {row.publicId || row.id}
        </span>
      ),
    },
    {
      key: 'amountINR',
      label: 'Amount (INR)',
      render: (row) => (
        <span className="font-bold text-neutral-900 text-xs">
          ₹{Number(row.amountINR || row.amountInr || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'cardNumber',
      label: 'Card Last 4',
      render: (row) => (
        <span className="font-mono text-xs text-neutral-600">
          •••• {row.cardNumber ? row.cardNumber.slice(-4) : row.last4 || '••••'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Authorization Status',
      render: (row) => {
        const s = (row.status || 'approved').toLowerCase()
        const badgeClasses = {
          approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          flagged: 'bg-amber-100 text-amber-800 border-amber-200',
          under_review: 'bg-amber-100 text-amber-800 border-amber-200',
          blocked: 'bg-rose-100 text-rose-800 border-rose-200',
          declined: 'bg-neutral-200 text-neutral-800 border-neutral-300',
        }[s] || 'bg-neutral-100 text-neutral-700 border-neutral-200'

        return (
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase border ${badgeClasses}`}>
            {s.replace('_', ' ')}
          </span>
        )
      },
    },
    {
      key: 'riskScore',
      label: 'Risk Score',
      render: (row) => <RiskBadge score={row.riskScore ?? 0} size="sm" />,
    },
    {
      key: 'timestamp',
      label: 'Time',
      render: (row) => (
        <span className="text-xs text-neutral-500 font-mono">
          {new Date(row.timestamp).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
    },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">
            <Terminal className="w-4 h-4" />
            <span>Point of Sale Terminal</span>
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            New Sale Terminal
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Simulate a customer in-store POS or counter sale with masked test cards.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold self-start">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>POS Gateway Live & Polling</span>
        </div>
      </div>

      {/* Terminal Form Container */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-6 md:p-8">
          {result ? (
            <ResultPanel result={result} onReset={() => setResult(null)} />
          ) : (
            <div className="space-y-6">
              <div className="pb-4 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-neutral-800">Checkout Terminal Input</h2>
                  <p className="text-xs text-neutral-500">
                    Swipe or select customer test card, enter sale amount and city.
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold text-neutral-400">
                  POS #01-ACTIVE
                </span>
              </div>

              <PaymentForm
                mode="merchant"
                loading={loading}
                onSubmit={handleSaleSubmit}
              />
            </div>
          )}
        </div>
      </div>

      {/* Recent Sales from this terminal */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div>
            <h2 className="text-sm font-bold text-neutral-900">Recent Sales from this Terminal</h2>
            <p className="text-xs text-neutral-500">
              Live polled real transactions processed through this merchant outlet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchRecentSales(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${salesLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <DataTable
          columns={columns}
          data={recentSales}
          loading={salesLoading && recentSales.length === 0}
          emptyMessage="No recent sales recorded yet from this terminal."
          rowClassName={(row) => {
            const id = row.id || row.publicId
            return newRowIds.has(id) ? 'bg-primary-50/60 transition-colors duration-1000' : ''
          }}
        />
      </div>
    </div>
  )
}

export default MerchantTerminalPage
