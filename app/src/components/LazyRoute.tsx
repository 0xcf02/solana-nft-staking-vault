'use client'

import React, { Suspense, ComponentType } from 'react'
import LoadingSpinner from './ui/LoadingSpinner'
import { dynamicImportManager, preloadingStrategies } from '@/utils/dynamicImports'

interface LazyRouteProps {
  component: ComponentType<any>
  fallback?: React.ReactNode
  preloadStrategy?: 'hover' | 'focus' | 'immediate' | 'none'
  componentKey?: string
  className?: string
  [key: string]: any
}

// Default loading fallback
const DefaultFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <LoadingSpinner size="medium" text="Loading component..." />
  </div>
)

// Error boundary for lazy routes
class LazyRouteErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LazyRoute error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Component Failed to Load</h3>
          <p className="text-sm text-gray-600 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

const LazyRoute: React.FC<LazyRouteProps> = ({
  component: Component,
  fallback = <DefaultFallback />,
  preloadStrategy = 'none',
  componentKey,
  className = '',
  ...props
}) => {
  // Apply preloading strategy
  const preloadProps = React.useMemo(() => {
    if (!componentKey || preloadStrategy === 'none') return {}

    switch (preloadStrategy) {
      case 'hover':
        return preloadingStrategies.onHover(componentKey as any)
      case 'focus':
        return preloadingStrategies.onFocus(componentKey as any)
      case 'immediate':
        // Preload immediately
        React.useEffect(() => {
          if (componentKey) {
            dynamicImportManager.preloadComponent(
              () => import(`@/components/${componentKey}`),
              componentKey
            )
          }
        }, [componentKey])
        return {}
      default:
        return {}
    }
  }, [preloadStrategy, componentKey])

  return (
    <div className={className} {...preloadProps}>
      <LazyRouteErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <Component {...props} />
        </Suspense>
      </LazyRouteErrorBoundary>
    </div>
  )
}

// Higher-order component for creating lazy routes
export function createLazyRoute<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: {
    fallback?: React.ReactNode
    preloadStrategy?: LazyRouteProps['preloadStrategy']
    componentKey?: string
    retryDelay?: number
    maxRetries?: number
  } = {}
) {
  const {
    fallback,
    preloadStrategy = 'none',
    componentKey,
    retryDelay = 1000,
    maxRetries = 3
  } = options

  const LazyComponent = dynamicImportManager.createLazyComponent(importFn, {
    retryDelay,
    maxRetries
  })

  return (props: P & { className?: string }) => (
    <LazyRoute
      component={LazyComponent}
      fallback={fallback}
      preloadStrategy={preloadStrategy}
      componentKey={componentKey}
      {...props}
    />
  )
}

// Prebuilt lazy routes for common components
export const LazyRoutes = {
  AdminDashboard: createLazyRoute(
    () => import('@/components/admin/AdminDashboard'),
    {
      preloadStrategy: 'hover',
      componentKey: 'AdminDashboard',
      retryDelay: 1500
    }
  ),

  UpgradeManager: createLazyRoute(
    () => import('@/components/UpgradeManager'),
    {
      preloadStrategy: 'hover',
      componentKey: 'UpgradeManager'
    }
  ),

  MonitoringDashboard: createLazyRoute(
    () => import('@/components/MonitoringDashboard'),
    {
      preloadStrategy: 'hover',
      componentKey: 'MonitoringDashboard'
    }
  )
}

export default LazyRoute