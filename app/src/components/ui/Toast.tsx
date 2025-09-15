'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ToastProps {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
  onClose: (id: string) => void
  action?: {
    label: string
    onClick: () => void
  }
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  description,
  duration = 5000,
  onClose,
  action
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setIsVisible(true), 10)
    
    // Start progress countdown
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - (100 / (duration / 50))
        if (newProgress <= 0) {
          clearInterval(progressTimer)
          handleClose()
          return 0
        }
        return newProgress
      })
    }, 50)

    return () => {
      clearTimeout(showTimer)
      clearInterval(progressTimer)
    }
  }, [duration])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => onClose(id), 200) // Wait for animation
  }

  const typeConfig = {
    success: {
      icon: '✅',
      bgColor: 'bg-green-50 border-green-200',
      iconColor: 'text-green-600',
      titleColor: 'text-green-800',
      textColor: 'text-green-700',
      progressColor: 'bg-green-500'
    },
    error: {
      icon: '❌',
      bgColor: 'bg-red-50 border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-800',
      textColor: 'text-red-700',
      progressColor: 'bg-red-500'
    },
    warning: {
      icon: '⚠️',
      bgColor: 'bg-yellow-50 border-yellow-200',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-800',
      textColor: 'text-yellow-700',
      progressColor: 'bg-yellow-500'
    },
    info: {
      icon: 'ℹ️',
      bgColor: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-800',
      textColor: 'text-blue-700',
      progressColor: 'bg-blue-500'
    }
  }

  const config = typeConfig[type]

  return (
    <div
      className={`
        relative max-w-sm w-full border rounded-lg shadow-lg p-4 mb-4 transition-all duration-200 ease-in-out
        ${config.bgColor}
        ${isVisible 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
        }
      `}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg overflow-hidden">
        <div
          className={`h-full transition-all duration-50 linear ${config.progressColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-start">
        <div className={`flex-shrink-0 ${config.iconColor} text-lg mr-3 mt-0.5`}>
          {config.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${config.titleColor}`}>
            {title}
          </h4>
          {description && (
            <p className={`mt-1 text-sm ${config.textColor}`}>
              {description}
            </p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-2 text-sm font-medium ${config.iconColor} hover:underline`}
            >
              {action.label}
            </button>
          )}
        </div>

        <button
          onClick={handleClose}
          className={`flex-shrink-0 ml-4 ${config.textColor} hover:${config.titleColor} transition-colors`}
        >
          <span className="sr-only">Close</span>
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Toast container component
interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ position = 'top-right' }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const addToast = (toast: Omit<ToastProps, 'onClose'>) => {
    setToasts(prev => [...prev, { ...toast, onClose: removeToast }])
  }

  // Expose global toast function
  useEffect(() => {
    (window as any).addToast = addToast
    return () => {
      delete (window as any).addToast
    }
  }, [])

  if (typeof window === 'undefined') return null

  return createPortal(
    <div className={`fixed z-50 ${positionClasses[position]}`}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>,
    document.body
  )
}

// Utility functions for creating toasts
let toastId = 0

export const toast = {
  success: (title: string, description?: string, options?: Partial<ToastProps>) => {
    const id = `toast-${++toastId}`
    if ((window as any).addToast) {
      (window as any).addToast({
        id,
        type: 'success',
        title,
        description,
        ...options
      })
    }
  },

  error: (title: string, description?: string, options?: Partial<ToastProps>) => {
    const id = `toast-${++toastId}`
    if ((window as any).addToast) {
      (window as any).addToast({
        id,
        type: 'error',
        title,
        description,
        duration: 7000, // Longer duration for errors
        ...options
      })
    }
  },

  warning: (title: string, description?: string, options?: Partial<ToastProps>) => {
    const id = `toast-${++toastId}`
    if ((window as any).addToast) {
      (window as any).addToast({
        id,
        type: 'warning',
        title,
        description,
        ...options
      })
    }
  },

  info: (title: string, description?: string, options?: Partial<ToastProps>) => {
    const id = `toast-${++toastId}`
    if ((window as any).addToast) {
      (window as any).addToast({
        id,
        type: 'info',
        title,
        description,
        ...options
      })
    }
  }
}

export default Toast