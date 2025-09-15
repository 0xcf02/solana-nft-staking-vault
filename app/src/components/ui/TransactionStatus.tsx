'use client'

import React from 'react'
import LoadingSpinner from './LoadingSpinner'
import ProgressBar from './ProgressBar'

interface TransactionStatusProps {
  status: 'idle' | 'preparing' | 'signing' | 'sending' | 'confirming' | 'success' | 'error'
  transactionSignature?: string
  error?: string
  onRetry?: () => void
  onViewTransaction?: () => void
}

const TransactionStatus: React.FC<TransactionStatusProps> = ({
  status,
  transactionSignature,
  error,
  onRetry,
  onViewTransaction
}) => {
  const statusConfig = {
    idle: {
      progress: 0,
      title: 'Ready',
      description: 'Transaction ready to start',
      color: 'primary' as const,
      showSpinner: false
    },
    preparing: {
      progress: 20,
      title: 'Preparing Transaction',
      description: 'Building transaction instructions...',
      color: 'primary' as const,
      showSpinner: true
    },
    signing: {
      progress: 40,
      title: 'Awaiting Signature',
      description: 'Please sign the transaction in your wallet',
      color: 'warning' as const,
      showSpinner: true
    },
    sending: {
      progress: 60,
      title: 'Sending Transaction',
      description: 'Broadcasting to the network...',
      color: 'primary' as const,
      showSpinner: true
    },
    confirming: {
      progress: 80,
      title: 'Confirming Transaction',
      description: 'Waiting for network confirmation...',
      color: 'primary' as const,
      showSpinner: true
    },
    success: {
      progress: 100,
      title: 'Transaction Successful',
      description: 'Your transaction has been confirmed!',
      color: 'success' as const,
      showSpinner: false
    },
    error: {
      progress: 0,
      title: 'Transaction Failed',
      description: error || 'An error occurred while processing the transaction',
      color: 'error' as const,
      showSpinner: false
    }
  }

  const config = statusConfig[status]

  if (status === 'idle') return null

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 max-w-md mx-auto">
      <div className="text-center">
        {/* Status Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4">
          {config.showSpinner ? (
            <LoadingSpinner size="large" color={config.color} />
          ) : status === 'success' ? (
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : status === 'error' ? (
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          ) : null}
        </div>

        {/* Status Text */}
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {config.title}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {config.description}
        </p>

        {/* Progress Bar */}
        <div className="mb-6">
          <ProgressBar
            progress={config.progress}
            color={config.color}
            animated={config.showSpinner}
            showText={status !== 'error'}
          />
        </div>

        {/* Transaction Signature */}
        {transactionSignature && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Transaction Signature:</p>
            <p className="text-xs font-mono text-gray-700 break-all">
              {transactionSignature}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
          {status === 'error' && onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Try Again
            </button>
          )}
          
          {transactionSignature && onViewTransaction && (
            <button
              onClick={onViewTransaction}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              View on Explorer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Hook for managing transaction status
export const useTransactionStatus = () => {
  const [status, setStatus] = React.useState<TransactionStatusProps['status']>('idle')
  const [transactionSignature, setTransactionSignature] = React.useState<string>()
  const [error, setError] = React.useState<string>()

  const reset = () => {
    setStatus('idle')
    setTransactionSignature(undefined)
    setError(undefined)
  }

  const updateStatus = (
    newStatus: TransactionStatusProps['status'],
    signature?: string,
    errorMessage?: string
  ) => {
    setStatus(newStatus)
    if (signature) setTransactionSignature(signature)
    if (errorMessage) setError(errorMessage)
  }

  return {
    status,
    transactionSignature,
    error,
    reset,
    updateStatus,
    setStatus,
    setTransactionSignature,
    setError
  }
}

export default TransactionStatus