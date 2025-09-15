'use client'

import React from 'react'

interface ProgressBarProps {
  progress: number // 0-100
  size?: 'small' | 'medium' | 'large'
  color?: 'primary' | 'success' | 'warning' | 'error'
  showText?: boolean
  animated?: boolean
  className?: string
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  size = 'medium',
  color = 'primary',
  showText = false,
  animated = false,
  className = ''
}) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100)

  const sizeClasses = {
    small: 'h-1',
    medium: 'h-2',
    large: 'h-3'
  }

  const colorClasses = {
    primary: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  }

  const backgroundColorClasses = {
    primary: 'bg-blue-200',
    success: 'bg-green-200',
    warning: 'bg-yellow-200',
    error: 'bg-red-200'
  }

  return (
    <div className={`w-full ${className}`}>
      <div className={`relative overflow-hidden rounded-full ${backgroundColorClasses[color]} ${sizeClasses[size]}`}>
        <div
          className={`h-full transition-all duration-300 ease-out ${colorClasses[color]} ${
            animated ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] animate-pulse' : ''
          }`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showText && (
        <div className="flex justify-between items-center mt-1 text-xs text-gray-600">
          <span>Progress</span>
          <span>{Math.round(clampedProgress)}%</span>
        </div>
      )}
    </div>
  )
}

export default ProgressBar