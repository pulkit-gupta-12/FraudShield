import React, { useState, useEffect } from 'react'
import {
  CreditCard,
  Building2,
  MapPin,
  Calendar,
  Sparkles,
  HelpCircle,
  SlidersHorizontal,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { getPatterns } from '../../services/patterns.js'
import { getMerchants } from '../../services/merchants.js'
import { getCards, getPOSCards } from '../../services/cards.js'
import { useAuth } from '../../context/AuthContext.jsx'

export const INDIAN_CITIES = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Ahmedabad',
  'Pune',
  'Jaipur',
  'Surat',
  'Lucknow',
  'Chandigarh',
  'Kochi',
  'Indore',
  'Bhopal',
  'Nagpur',
]

export const MERCHANT_CATEGORIES = [
  'Electronics',
  'Grocery',
  'Dining',
  'Hospitality',
  'Travel',
  'Apparel',
  'Entertainment',
  'Healthcare',
  'Services',
  'General',
]

/**
 * Reusable PaymentForm component for Customer, Merchant Terminal, and Staff Checker.
 *
 * @param {'customer'|'merchant'|'staff'} mode
 * @param {Function} onSubmit - Async function called with payload; should return submitTransaction response
 * @param {boolean} loading - Loading state for submit button
 */
export function PaymentForm({
  mode = 'customer',
  onSubmit,
  loading = false,
  className = '',
}) {
  const { user } = useAuth()

  // Form Fields
  const [cards, setCards] = useState([])
  const [selectedCardId, setSelectedCardId] = useState('')
  const [merchants, setMerchants] = useState([])
  const [merchantMode, setMerchantMode] = useState('select') // 'select' | 'custom'
  const [selectedMerchantId, setSelectedMerchantId] = useState('')
  const [customMerchantName, setCustomMerchantName] = useState('')
  const [customMerchantCategory, setCustomMerchantCategory] = useState('General')
  const [amount, setAmount] = useState('')
  const [city, setCity] = useState(user?.city || 'Mumbai')
  const [itemDescription, setItemDescription] = useState('')
  
  // Format now for datetime-local: YYYY-MM-DDTHH:mm
  const getNowLocal = () => {
    const now = new Date()
    const offset = now.getTimezoneOffset() * 60000
    return new Date(now.getTime() - offset).toISOString().slice(0, 16)
  }
  const [occurredAt, setOccurredAt] = useState(getNowLocal())

  const [patterns, setPatterns] = useState([])
  const [selectedPatternId, setSelectedPatternId] = useState('')

  // Staff only
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [raw30Values, setRaw30Values] = useState('')
  const [saveAsReal, setSaveAsReal] = useState(false) // Off by default for checker

  // Validation & errors
  const [errors, setErrors] = useState({})
  const [tooltipVisible, setTooltipVisible] = useState(false)

  // Fetch initial data
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        // Load patterns
        const patternsData = await getPatterns()
        if (isMounted) {
          setPatterns(patternsData)
          if (patternsData.length > 0) {
            setSelectedPatternId(patternsData[0].id)
          }
        }

        // Load merchants (for customer and staff)
        if (mode !== 'merchant') {
          const mData = await getMerchants()
          if (isMounted) {
            const list = Array.isArray(mData) ? mData : mData.results || []
            setMerchants(list)
            if (list.length > 0) setSelectedMerchantId(String(list[0].id))
          }
        }

        // Load cards based on mode
        if (mode === 'customer') {
          const userCards = await getCards({ userId: user?.id })
          const list = userCards.results || []
          if (isMounted) {
            setCards(list)
            if (list.length > 0) setSelectedCardId(String(list[0].id))
          }
        } else if (mode === 'merchant') {
          const posCards = await getPOSCards()
          if (isMounted) {
            setCards(posCards)
            if (posCards.length > 0) setSelectedCardId(String(posCards[0].id))
          }
        } else {
          // Staff mode: get all cards
          const allCards = await getCards({ pageSize: 50 })
          const list = allCards.results || []
          if (isMounted) {
            setCards(list)
            if (list.length > 0) setSelectedCardId(String(list[0].id))
          }
        }
      } catch (err) {
        console.error('Failed to load payment form dependencies:', err)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [mode, user])

  const validate = () => {
    const errs = {}

    if (!selectedCardId) {
      errs.cardId = 'Please select a card.'
    }

    const numAmount = parseFloat(amount)
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errs.amount = 'Please enter a valid positive amount in INR.'
    }

    if (!city || city.trim() === '') {
      errs.city = 'Please enter or select a city.'
    }

    if (mode !== 'merchant') {
      if (merchantMode === 'select' && !selectedMerchantId) {
        errs.merchant = 'Please select a merchant.'
      } else if (merchantMode === 'custom' && !customMerchantName.trim()) {
        errs.merchant = 'Please enter a merchant name.'
      }
    }

    if (showAdvanced && raw30Values.trim()) {
      const parts = raw30Values.split(',').map((p) => p.trim())
      if (parts.length !== 30) {
        errs.rawValues = `Expected 30 comma-separated numeric values (Time, V1..V28, Amount), got ${parts.length}.`
      } else if (parts.some((p) => isNaN(Number(p)))) {
        errs.rawValues = 'All 30 values must be valid numeric numbers.'
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    const payload = {
      cardId: selectedCardId,
      amount: parseFloat(amount),
      city: city.trim(),
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
    }

    if (mode === 'merchant') {
      payload.description = itemDescription.trim()
    } else {
      if (merchantMode === 'select') {
        payload.merchantId = selectedMerchantId
      } else {
        payload.merchantName = customMerchantName.trim()
        payload.merchantCategory = customMerchantCategory
      }
    }

    if (selectedPatternId) {
      payload.patternId = selectedPatternId
    }

    if (mode === 'staff') {
      payload.save = saveAsReal
      if (showAdvanced && raw30Values.trim()) {
        const parts = raw30Values.split(',').map((p) => Number(p.trim()))
        payload.rawValues = parts
      }
    }

    if (onSubmit) {
      await onSubmit(payload)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {/* Validation Errors Header Banner if any */}
      {Object.keys(errors).length > 0 && (
        <div className="p-3.5 bg-risk-50 border border-risk-200 rounded-xl text-risk-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-risk-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">Please fix the following validation errors:</p>
            <ul className="list-disc list-inside text-risk-700">
              {Object.values(errors).map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 1. Card Selection */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
          {mode === 'merchant' ? 'Customer Test Card (POS Terminal)' : 'Payment Card'}
        </label>
        <div className="relative">
          <select
            id="payment-card-select"
            value={selectedCardId}
            onChange={(e) => {
              setSelectedCardId(e.target.value)
              if (errors.cardId) setErrors((prev) => ({ ...prev, cardId: null }))
            }}
            className={`w-full h-11 pl-10 pr-4 text-xs font-semibold rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition ${
              errors.cardId ? 'border-risk-400 text-risk-900' : 'border-neutral-200 text-neutral-800'
            }`}
          >
            {cards.length === 0 ? (
              <option value="">No active cards available</option>
            ) : (
              cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.brand || c.cardType || 'Card'} •••• {c.last4 || (c.cardNumber && c.cardNumber.slice(-4)) || '••••'}
                  {c.cardholderFirstName ? ` — ${c.cardholderFirstName}` : c.holderName ? ` — ${c.holderName}` : ''}
                  {c.spendingLimit ? ` (Limit: ₹${Number(c.spendingLimit).toLocaleString('en-IN')})` : ''}
                  {c.status && c.status !== 'active' ? ` [${c.status.toUpperCase()}]` : ''}
                </option>
              ))
            )}
          </select>
          <CreditCard className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5 pointer-events-none" />
        </div>
        {errors.cardId && <p className="text-[11px] text-risk-600 font-medium">{errors.cardId}</p>}
      </div>

      {/* 2. Merchant Info (Hidden in Merchant mode as it auto-assigns to merchant's own terminal) */}
      {mode !== 'merchant' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Merchant Details
            </label>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMerchantMode('select')}
                className={`px-2 py-0.5 rounded-md font-semibold transition ${
                  merchantMode === 'select'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                Existing
              </button>
              <button
                type="button"
                onClick={() => setMerchantMode('custom')}
                className={`px-2 py-0.5 rounded-md font-semibold transition ${
                  merchantMode === 'custom'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                + New Merchant
              </button>
            </div>
          </div>

          {merchantMode === 'select' ? (
            <div className="relative">
              <select
                id="merchant-select"
                value={selectedMerchantId}
                onChange={(e) => {
                  setSelectedMerchantId(e.target.value)
                  if (errors.merchant) setErrors((prev) => ({ ...prev, merchant: null }))
                }}
                className={`w-full h-11 pl-10 pr-4 text-xs font-semibold rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition ${
                  errors.merchant ? 'border-risk-400' : 'border-neutral-200 text-neutral-800'
                }`}
              >
                {merchants.length === 0 ? (
                  <option value="">No registered merchants found</option>
                ) : (
                  merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.category}) — {m.city}
                    </option>
                  ))
                )}
              </select>
              <Building2 className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5 pointer-events-none" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                id="custom-merchant-name"
                placeholder="Merchant name (e.g. Swiggy Instamart)"
                value={customMerchantName}
                onChange={(e) => {
                  setCustomMerchantName(e.target.value)
                  if (errors.merchant) setErrors((prev) => ({ ...prev, merchant: null }))
                }}
                className="h-11 px-3.5 text-xs font-semibold rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <select
                id="custom-merchant-category"
                value={customMerchantCategory}
                onChange={(e) => setCustomMerchantCategory(e.target.value)}
                className="h-11 px-3.5 text-xs font-semibold rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 bg-white"
              >
                {MERCHANT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    Category: {cat}
                  </option>
                ))}
              </select>
            </div>
          )}
          {errors.merchant && <p className="text-[11px] text-risk-600 font-medium">{errors.merchant}</p>}
        </div>
      )}

      {/* If merchant mode, show Item Description field */}
      {mode === 'merchant' && (
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
            Sale Item Description
          </label>
          <input
            type="text"
            id="item-description-input"
            placeholder="e.g. Sony WH-1000XM5 Headphones"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            className="w-full h-11 px-3.5 text-xs font-semibold rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      )}

      {/* 3. Amount & City (Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Amount in INR */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
            Amount (INR ₹)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-3 text-xs font-bold text-neutral-500">₹</span>
            <input
              type="number"
              id="payment-amount-input"
              step="0.01"
              min="0.01"
              placeholder="e.g. 2499.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }))
              }}
              className={`w-full h-11 pl-8 pr-4 text-xs font-bold rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition ${
                errors.amount ? 'border-risk-400 text-risk-900' : 'border-neutral-200 text-neutral-900'
              }`}
            />
          </div>
          {errors.amount && <p className="text-[11px] text-risk-600 font-medium">{errors.amount}</p>}
        </div>

        {/* City with Indian suggestions */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
            Transaction City
          </label>
          <div className="relative">
            <input
              list="indian-cities-list"
              id="payment-city-input"
              type="text"
              placeholder="e.g. Mumbai, Bengaluru"
              value={city}
              onChange={(e) => {
                setCity(e.target.value)
                if (errors.city) setErrors((prev) => ({ ...prev, city: null }))
              }}
              className={`w-full h-11 pl-10 pr-4 text-xs font-semibold rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition ${
                errors.city ? 'border-risk-400 text-risk-900' : 'border-neutral-200 text-neutral-900'
              }`}
            />
            <MapPin className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5 pointer-events-none" />
            <datalist id="indian-cities-list">
              {INDIAN_CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          {errors.city && <p className="text-[11px] text-risk-600 font-medium">{errors.city}</p>}
        </div>
      </div>

      {/* 4. Date & Time and Spending Pattern (Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Date and Time (default now, editable) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
            Date & Time
          </label>
          <div className="relative">
            <input
              type="datetime-local"
              id="payment-datetime-input"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full h-11 pl-10 pr-4 text-xs font-semibold rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <Calendar className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5 pointer-events-none" />
          </div>
        </div>

        {/* Spending Pattern with Tooltip */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>Spending Pattern</span>
              <div className="relative inline-block">
                <button
                  type="button"
                  onMouseEnter={() => setTooltipVisible(true)}
                  onMouseLeave={() => setTooltipVisible(false)}
                  onClick={() => setTooltipVisible(!tooltipVisible)}
                  className="text-neutral-400 hover:text-primary-600 transition"
                  aria-label="Info about spending patterns"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
                {tooltipVisible && (
                  <div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2.5 bg-neutral-900 text-white text-[11px] leading-relaxed rounded-lg shadow-xl pointer-events-none">
                    The dataset hides real card details. Patterns are real anonymised behaviours. Amount and time are fully your input.
                  </div>
                )}
              </div>
            </label>
            <span className="text-[10px] text-primary-600 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Real behaviour vectors
            </span>
          </div>

          <div className="relative">
            <select
              id="spending-pattern-select"
              value={selectedPatternId}
              onChange={(e) => setSelectedPatternId(e.target.value)}
              className="w-full h-11 pl-3.5 pr-8 text-xs font-semibold rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {patterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}: {p.label}
                  {p.typicalAmount ? ` (Typical: $${p.typicalAmount})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 5. Staff Only: Advanced 30-values & Save Toggle */}
      {mode === 'staff' && (
        <div className="p-4 bg-neutral-50 border border-neutral-200/80 rounded-xl space-y-3.5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs font-bold text-neutral-700 hover:text-primary-600 transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Hide Advanced Vector (30 Values)' : 'Show Advanced Vector (30 Values)'}</span>
            </button>

            {/* Save as real transaction switch */}
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700 cursor-pointer">
              <input
                type="checkbox"
                id="staff-save-real-toggle"
                checked={saveAsReal}
                onChange={(e) => setSaveAsReal(e.target.checked)}
                className="w-4 h-4 rounded text-primary-600 border-neutral-300 focus:ring-primary-500"
              />
              <span>Save as a real transaction and open a case if flagged</span>
            </label>
          </div>

          {showAdvanced && (
            <div className="space-y-1.5 pt-2 border-t border-neutral-200">
              <p className="text-[11px] text-neutral-500">
                Paste all 30 comma-separated numbers in dataset order (Time, V1..V28, Amount):
              </p>
              <textarea
                rows={3}
                id="staff-raw-values-input"
                placeholder="0.0, -1.3598, -0.0727, 2.5363, 1.3781, -0.3383, 0.4623, 0.2395, 0.0986, 0.3637, 0.0907, -0.5515, -0.6178, -0.9913, -0.3111, 1.4681, -0.4704, 0.2079, 0.0257, 0.4039, 0.2514, -0.0183, 0.2778, -0.1104, 0.0669, 0.1285, -0.1891, 0.1335, -0.0210, 149.62"
                value={raw30Values}
                onChange={(e) => {
                  setRaw30Values(e.target.value)
                  if (errors.rawValues) setErrors((prev) => ({ ...prev, rawValues: null }))
                }}
                className={`w-full p-2.5 text-xs font-mono rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                  errors.rawValues ? 'border-risk-400' : 'border-neutral-200'
                }`}
              />
              {errors.rawValues && (
                <p className="text-[11px] text-risk-600 font-medium">{errors.rawValues}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          id="payment-form-submit-btn"
          disabled={loading || cards.length === 0}
          className={`w-full h-12 rounded-xl text-xs font-extrabold tracking-wide uppercase flex items-center justify-center gap-2 shadow-sm transition-all duration-200 ${
            loading || cards.length === 0
              ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              : mode === 'merchant'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10'
              : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/10'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing Transaction via Real ML Model...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {mode === 'merchant'
                  ? 'Process POS Sale'
                  : mode === 'staff'
                  ? saveAsReal
                    ? 'Execute & Record Transaction'
                    : 'Score Transaction (Dry Run)'
                  : 'Authorize Payment'}
              </span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
