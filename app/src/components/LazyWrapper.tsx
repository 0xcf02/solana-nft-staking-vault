'use client'

import React, { Suspense, lazy, useRef } from 'react'
import { useIntersectionObserver } from '@/utils/performance'

interface LazyWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  className?: string
  threshold?: number
  rootMargin?: string
}

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    <span className="ml-3 text-gray-600">Loading...</span>
  </div>
)

// Error boundary for lazy components
class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LazyWrapper error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-red-600 bg-red-50 rounded-lg border border-red-200">
          <p className="font-medium">Component failed to load</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Main lazy wrapper component
const LazyWrapper: React.FC<LazyWrapperProps> = ({
  children,
  fallback,
  className = '',
  threshold = 0.1,
  rootMargin = '50px'
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const isVisible = useIntersectionObserver(ref, { threshold, rootMargin })

  return (
    <div ref={ref} className={className}>
      <LazyErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback || <LoadingSpinner />}>
          {isVisible ? children : <div className="h-32" />} {/* Placeholder height */}
        </Suspense>
      </LazyErrorBoundary>
    </div>
  )
}

// Higher-order component for lazy loading
export function withLazyLoading<P extends object>(
  Component: React.ComponentType<P>,
  displayName?: string
) {
  const LazyComponent = lazy(async () => {
    // Simulate small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 100))
    return { default: Component }
  })
  
  // Set display name for debugging (React.lazy components don't support displayName)
  
  return (props: P) => (
    <LazyWrapper>
      <LazyComponent {...(props as any)} />
    </LazyWrapper>
  )
}

// Preloader utility
export const preloadComponent = (importFn: () => Promise<any>) => {
  // Start preloading on hover or focus
  return {
    onMouseEnter: () => importFn().catch(() => {}),
    onFocus: () => importFn().catch(() => {})
  }
}

export default LazyWrapper