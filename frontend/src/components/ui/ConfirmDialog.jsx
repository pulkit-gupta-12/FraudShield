import React from 'react'
import { Modal } from './Modal.jsx'
import { Button } from './Button.jsx'
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react'

/**
 * ConfirmDialog component for destructive or important actions.
 * 
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {() => void} onConfirm
 * @param {string} title
 * @param {string} message
 * @param {'danger'|'primary'} [variant='danger']
 * @param {string} [confirmText='Confirm']
 * @param {string} [cancelText='Cancel']
 * @param {boolean} [loading=false]
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  variant = 'danger',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false,
}) {
  const isDanger = variant === 'danger'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            size="sm"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDanger ? 'bg-risk-50 text-risk-600' : 'bg-primary-50 text-primary-600'
          }`}
        >
          {isDanger ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
        </div>
        <div>
          <h4 className="text-sm font-bold text-neutral-900">{title}</h4>
          <p className="text-xs text-neutral-600 mt-1 leading-relaxed">{message}</p>
        </div>
      </div>
    </Modal>
  )
}
