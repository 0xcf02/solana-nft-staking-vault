'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import LoadingSpinner from './LoadingSpinner'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  type?: 'info' | 'warning' | 'danger'
  loading?: boolean
  details?: Array<{
    label: string
    value: string | React.ReactNode
  }>
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
  loading = false,
  details = []
}) => {
  const typeConfig = {
    info: {
      icon: 'ℹ️',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    },
    warning: {
      icon: '⚠️',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      confirmButton: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
    },
    danger: {
      icon: '🚨',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    }
  }

  const config = typeConfig[type]

  if (!isOpen) return null

  const handleConfirm = async () => {
    try {
      await onConfirm()
    } catch (error) {
      console.error('Confirmation error:', error)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onClose()
    }
  }

  const modal = (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleBackdropClick}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
          <div className="sm:flex sm:items-start">
            {/* Icon */}
            <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${config.iconBg} sm:mx-0 sm:h-10 sm:w-10`}>
              <span className={`text-xl ${config.iconColor}`}>
                {config.icon}
              </span>
            </div>
            
            {/* Content */}
            <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
              <h3 className="text-base font-semibold leading-6 text-gray-900">
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {description}
                </p>
              </div>
              
              {/* Details */}
              {details.length > 0 && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Details:</h4>
                  <dl className="space-y-2">
                    {details.map((detail, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <dt className="text-gray-500">{detail.label}:</dt>
                        <dd className="text-gray-900 font-medium ml-2 text-right">
                          {detail.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm ${config.confirmButton} sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" color="secondary" />
                  <span className="ml-2">Processing...</span>
                </>
              ) : (
                confirmText
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return typeof window !== 'undefined' ? createPortal(modal, document.body) : null
}

// Hook for managing confirmation modal
export const useConfirmation = () => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [config, setConfig] = React.useState<Omit<ConfirmationModalProps, 'isOpen' | 'onClose' | 'onConfirm'>>({
    title: '',
    description: ''
  })
  const [loading, setLoading] = React.useState(false)
  const [onConfirmCallback, setOnConfirmCallback] = React.useState<() => void | Promise<void>>(() => {})

  const showConfirmation = (
    confirmationConfig: Omit<ConfirmationModalProps, 'isOpen' | 'onClose' | 'onConfirm' | 'loading'>,
    onConfirm: () => void | Promise<void>
  ) => {
    setConfig(confirmationConfig)
    setOnConfirmCallback(() => onConfirm)
    setIsOpen(true)
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirmCallback()
      setIsOpen(false)
    } catch (error) {
      console.error('Confirmation error:', error)
      // Keep modal open on error
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setIsOpen(false)
    }
  }

  const ConfirmationComponent = () => (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      loading={loading}
      {...config}
    />
  )

  return {
    showConfirmation,
    ConfirmationComponent
  }
}

export default ConfirmationModal