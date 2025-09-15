// Dynamic import utilities with enhanced error handling and preloading
import { lazy, ComponentType, useState, useEffect } from 'react'

interface LazyComponentOptions {
  preload?: boolean
  retryDelay?: number
  maxRetries?: number
  fallback?: ComponentType<any>
}

interface ImportCache {
  [key: string]: {
    component: Promise<{ default: ComponentType<any> }>
    loaded: boolean
    error?: Error
  }
}

class DynamicImportManager {
  private importCache: ImportCache = {}
  private preloadQueue: string[] = []
  private isPreloading = false

  // Enhanced lazy loading with retry logic
  createLazyComponent<T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    options: LazyComponentOptions = {}
  ): ComponentType<any> {
    const {
      retryDelay = 1000,
      maxRetries = 3,
      fallback
    } = options

    const wrappedImportFn = async (): Promise<{ default: T }> => {
      let attempts = 0
      let lastError: Error

      while (attempts < maxRetries) {
        try {
          const result = await importFn()
          return result
        } catch (error) {
          attempts++
          lastError = error as Error
          
          if (attempts < maxRetries) {
            // Exponential backoff with jitter
            const delay = retryDelay * Math.pow(2, attempts - 1) + Math.random() * 1000
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      // If all retries failed, return fallback or throw error
      if (fallback) {
        return { default: fallback }
      }
      
      throw new Error(`Failed to load component after ${maxRetries} attempts: ${lastError.message}`)
    }

    return lazy(wrappedImportFn)
  }

  // Preload components for better UX
  preloadComponent(importFn: () => Promise<any>, cacheKey: string): void {
    if (this.importCache[cacheKey]?.loaded) {
      return // Already loaded
    }

    if (!this.importCache[cacheKey]) {
      this.importCache[cacheKey] = {
        component: importFn(),
        loaded: false
      }

      this.importCache[cacheKey].component
        .then(() => {
          this.importCache[cacheKey].loaded = true
        })
        .catch((error) => {
          this.importCache[cacheKey].error = error
          console.warn(`Failed to preload component ${cacheKey}:`, error)
        })
    }
  }

  // Batch preload components
  preloadComponents(components: Array<{ importFn: () => Promise<any>; key: string }>): void {
    this.preloadQueue.push(...components.map(c => c.key))
    
    if (!this.isPreloading) {
      this.processPreloadQueue(components)
    }
  }

  private async processPreloadQueue(components: Array<{ importFn: () => Promise<any>; key: string }>): Promise<void> {
    this.isPreloading = true

    // Process preload queue with concurrency limit
    const concurrencyLimit = 3
    const batches = this.chunkArray(components, concurrencyLimit)

    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(({ importFn, key }) => {
          return this.preloadComponent(importFn, key)
        })
      )
    }

    this.isPreloading = false
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  // Get preload statistics
  getPreloadStats(): { loaded: number; total: number; errors: number } {
    const values = Object.values(this.importCache)
    return {
      loaded: values.filter(v => v.loaded).length,
      total: values.length,
      errors: values.filter(v => v.error).length
    }
  }
}

// Global instance
export const dynamicImportManager = new DynamicImportManager()

// Lazy component definitions with preloading
export const LazyComponents = {
  // Admin components (heavy, load on demand)
  AdminDashboard: dynamicImportManager.createLazyComponent(
    () => import('@/components/admin/AdminDashboard'),
    { retryDelay: 1500, maxRetries: 3 }
  ),

  UpgradeManager: dynamicImportManager.createLazyComponent(
    () => import('@/components/UpgradeManager'),
    { retryDelay: 1000, maxRetries: 2 }
  ),

  MonitoringDashboard: dynamicImportManager.createLazyComponent(
    () => import('@/components/MonitoringDashboard'),
    { retryDelay: 1000, maxRetries: 2 }
  ),

  // User components (medium priority)
  StakingInterface: dynamicImportManager.createLazyComponent(
    () => import('@/components/StakingInterface'),
    { retryDelay: 800 }
  ),

  RewardsPanel: dynamicImportManager.createLazyComponent(
    () => import('@/components/RewardsPanel'),
    { retryDelay: 800 }
  ),

  // Settings and configuration (low priority)
  Settings: dynamicImportManager.createLazyComponent(
    () => import('@/components/Settings'),
    { retryDelay: 2000 }
  )
}

// Preloading strategies
export const preloadingStrategies = {
  // Preload on hover
  onHover: (componentKey: keyof typeof LazyComponents) => ({
    onMouseEnter: () => {
      if (LazyComponents[componentKey]) {
        // Preload the component
        dynamicImportManager.preloadComponent(
          () => import(`@/components/${componentKey}`),
          componentKey
        )
      }
    }
  }),

  // Preload on focus
  onFocus: (componentKey: keyof typeof LazyComponents) => ({
    onFocus: () => {
      if (LazyComponents[componentKey]) {
        dynamicImportManager.preloadComponent(
          () => import(`@/components/${componentKey}`),
          componentKey
        )
      }
    }
  }),

  // Preload based on user role
  byRole: (userRole: string) => {
    const roleBasedComponents = {
      admin: ['AdminDashboard', 'UpgradeManager', 'MonitoringDashboard'],
      user: ['StakingInterface', 'RewardsPanel'],
      all: ['Settings']
    }

    const componentsToPreload = [
      ...roleBasedComponents.all,
      ...(roleBasedComponents[userRole as keyof typeof roleBasedComponents] || [])
    ]

    const componentsWithImports = componentsToPreload.map(key => ({
      key,
      importFn: () => import(`@/components/${key}`)
    }))

    dynamicImportManager.preloadComponents(componentsWithImports)
  },

  // Preload based on route
  byRoute: (currentRoute: string) => {
    const routeBasedPreloads = {
      '/dashboard': ['StakingInterface', 'RewardsPanel'],
      '/admin': ['AdminDashboard', 'UpgradeManager'],
      '/monitoring': ['MonitoringDashboard'],
      '/settings': ['Settings']
    }

    const componentsToPreload = routeBasedPreloads[currentRoute as keyof typeof routeBasedPreloads] || []
    
    const componentsWithImports = componentsToPreload.map(key => ({
      key,
      importFn: () => import(`@/components/${key}`)
    }))

    dynamicImportManager.preloadComponents(componentsWithImports)
  }
}

// Hook for using dynamic imports with loading states
export function useDynamicImport<T>(importFn: () => Promise<T>) {
  const [loading, setLoading] = useState(true)
  const [component, setComponent] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    importFn()
      .then((result) => {
        if (!cancelled) {
          setComponent(result)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [importFn])

  return { loading, component, error }
}

// Code splitting utilities
export const codeSplitting = {
  // Split vendor libraries
  vendors: {
    solana: () => import('@solana/web3.js'),
    anchor: () => import('@coral-xyz/anchor'),
    spl: () => import('@solana/spl-token'),
    walletAdapter: () => import('@solana/wallet-adapter-react')
  },

  // Split by feature
  features: {
    staking: () => import('@/features/staking'),
    rewards: () => import('@/features/rewards'),
    admin: () => import('@/features/admin'),
    monitoring: () => import('@/features/monitoring')
  },

  // Split utilities
  utils: {
    charts: () => import('recharts'),
    animations: () => import('framer-motion'),
    dates: () => import('date-fns')
  }
}

// Performance monitoring for dynamic imports
export const importPerformance = {
  // Track import timing
  trackImport: async <T>(
    importFn: () => Promise<T>,
    label: string
  ): Promise<T> => {
    const start = performance.now()
    
    try {
      const result = await importFn()
      const duration = performance.now() - start
      
      // Log successful import
      console.log(`[Import] ${label} loaded in ${duration.toFixed(2)}ms`)
      
      return result
    } catch (error) {
      const duration = performance.now() - start
      
      // Log failed import
      console.error(`[Import] ${label} failed after ${duration.toFixed(2)}ms:`, error)
      
      throw error
    }
  },

  // Get bundle size estimates
  estimateBundleSize: (componentName: string): Promise<number> => {
    return new Promise((resolve) => {
      // This would be implemented with actual bundle analysis
      // For now, return estimated sizes
      const estimates = {
        AdminDashboard: 150000, // ~150KB
        MonitoringDashboard: 120000, // ~120KB
        StakingInterface: 80000, // ~80KB
        Settings: 50000 // ~50KB
      }
      
      resolve(estimates[componentName as keyof typeof estimates] || 75000)
    })
  }
}

export default {
  LazyComponents,
  dynamicImportManager,
  preloadingStrategies,
  codeSplitting,
  importPerformance,
  useDynamicImport
}