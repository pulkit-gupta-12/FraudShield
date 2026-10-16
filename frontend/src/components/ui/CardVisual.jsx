import React from 'react'
import { ShieldAlert, Lock, CheckCircle2, AlertTriangle, Wifi, CreditCard } from 'lucide-react'
import clsx from 'clsx'

/**
 * Reusable bank card visual component.
 * Features realistic banking card design with chip, contactless symbol,
 * formatted card number, expiry, cardholder, bank brand, and status indicator.
 *
 * CRITICAL REQUIREMENT: Blocked cards display a prominent red "BLOCKED" chip.
 */
export function CardVisual({
  card,
  onToggleStatus,
  actionLoading = false,
  showActions = true,
  className = '',
}) {
  if (!card) return null

  const isBlocked = card.status === 'blocked'
  const isFlagged = card.status === 'flagged'
  const isActive = card.status === 'active'

  // Card background theme based on bank/cardType
  const getGradient = () => {
    if (isBlocked) {
      return 'from-slate-900 via-zinc-900 to-red-950/60 border-red-500/40'
    }
    const type = card.cardType || ''
    if (type.includes('Platinum')) {
      return 'from-slate-900 via-indigo-950 to-slate-800 border-indigo-400/30'
    }
    if (type.includes('World') || type.includes('Mastercard')) {
      return 'from-slate-900 via-blue-950 to-neutral-900 border-blue-400/30'
    }
    if (type.includes('RuPay')) {
      return 'from-emerald-950 via-teal-950 to-slate-900 border-teal-400/30'
    }
    return 'from-slate-900 via-slate-800 to-indigo-950 border-white/20'
  }

  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      {/* Physical Card Container */}
      <div
        className={clsx(
          'relative w-full aspect-[1.586/1] max-w-sm rounded-2xl p-5 sm:p-6 text-white shadow-xl transition-all duration-300 overflow-hidden border backdrop-blur-md bg-gradient-to-br',
          getGradient(),
          isBlocked && 'ring-2 ring-red-500/50 shadow-red-950/40',
        )}
      >
        {/* Holographic Sheen Effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none" />

        {/* Card Header: Bank Name & Status Chip */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-neutral-300" />
            <span className="font-bold text-sm tracking-wider uppercase text-neutral-200">
              {card.bank || 'FraudShield Bank'}
            </span>
          </div>

          {/* Prominent Status Chip */}
          {isBlocked ? (
            <span
              id={`card-blocked-${card.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-600 text-white shadow-lg shadow-red-900/50 border border-red-400 animate-pulse"
            >
              <Lock className="w-3.5 h-3.5" />
              BLOCKED
            </span>
          ) : isFlagged ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              FLAGGED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ACTIVE
            </span>
          )}
        </div>

        {/* EMV Chip & Contactless */}
        <div className="relative z-10 my-4 sm:my-5 flex items-center gap-4">
          {/* Gold EMV Chip Graphic */}
          <div className="w-10 h-8 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-0.5 shadow-md flex flex-col justify-around">
            <div className="h-px bg-amber-800/40 mx-1" />
            <div className="h-px bg-amber-800/40 mx-1" />
            <div className="h-px bg-amber-800/40 mx-1" />
          </div>
          <Wifi className="w-5 h-5 text-neutral-400 rotate-90 opacity-70" />
        </div>

        {/* Masked Card Number */}
        <div className="relative z-10 font-mono text-base sm:text-lg tracking-[0.2em] font-semibold text-neutral-100 drop-shadow-sm my-1">
          {card.cardNumber || '•••• •••• •••• 0000'}
        </div>

        {/* Card Footer: Holder, Expiry, Type */}
        <div className="relative z-10 mt-3 sm:mt-4 flex items-end justify-between text-xs">
          <div>
            <div className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
              Cardholder
            </div>
            <div className="font-medium tracking-wide uppercase text-neutral-200 truncate max-w-[140px]">
              {card.cardHolder || 'Authorized User'}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
              Expires
            </div>
            <div className="font-mono font-medium text-neutral-200">{card.expiry || '12/28'}</div>
          </div>

          <div className="text-right">
            <span className="font-bold text-xs italic tracking-wider text-neutral-300 uppercase">
              {card.cardType || 'Visa'}
            </span>
          </div>
        </div>
      </div>

      {/* Optional Card Actions Bar */}
      {showActions && onToggleStatus && (
        <div className="flex items-center justify-between px-1">
          <div className="text-xs text-neutral-500">
            Limit: <span className="font-semibold text-neutral-800">₹{(card.limitINR || 100000).toLocaleString('en-IN')}</span>
          </div>
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => onToggleStatus(card)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs',
              isBlocked
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200',
            )}
          >
            <Lock className="w-3.5 h-3.5" />
            {isBlocked ? 'Unblock Card' : 'Block Card'}
          </button>
        </div>
      )}
    </div>
  )
}

export default CardVisual
