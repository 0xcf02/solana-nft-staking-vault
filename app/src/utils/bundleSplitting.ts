// Advanced bundle splitting and resource optimization
import React from 'react'
import { dynamicImportManager } from './dynamicImports'

interface BundleAnalysis {
  name: string
  size: number
  loadTime: number
  dependencies: string[]
  criticalPath: boolean
}

interface ResourcePriority {
  high: string[]
  medium: string[]
  low: string[]
}

class BundleSplittingManager {
  private loadedBundles = new Set<string>()
  private loadingBundles = new Map<string, Promise<any>>()
  private bundleAnalysis = new Map<string, BundleAnalysis>()
  private resourcePriorities: ResourcePriority = {
    high: ['wallet-adapter', 'solana-web3', 'core-ui'],
    medium: ['staking-features', 'nft-display', 'monitoring'],
    low: ['admin-tools', 'advanced-settings', 'charts']
  }

  // Intelligent bundle loading based on user context
  async loadBundleGroup(groupName: string, context?: {
    userRole?: string
    route?: string
    viewport?: 'mobile' | 'desktop'
  }): Promise<void> {
    const bundles = this.getBundlesForGroup(groupName, context)
    
    // Load high priority bundles first
    const highPriorityBundles = bundles.filter(bundle => 
      this.resourcePriorities.high.includes(bundle)
    )
    
    const mediumPriorityBundles = bundles.filter(bundle => 
      this.resourcePriorities.medium.includes(bundle)
    )
    
    const lowPriorityBundles = bundles.filter(bundle => 
      this.resourcePriorities.low.includes(bundle)
    )

    // Sequential loading for high priority, parallel for others
    await this.loadBundlesSequential(highPriorityBundles)
    await Promise.all([
      this.loadBundlesParallel(mediumPriorityBundles),
      this.loadBundlesParallel(lowPriorityBundles, { delay: 1000 })
    ])
  }

  private async loadBundlesSequential(bundles: string[]): Promise<void> {
    for (const bundle of bundles) {
      await this.loadBundle(bundle)
    }
  }

  private async loadBundlesParallel(
    bundles: string[], 
    options: { delay?: number } = {}
  ): Promise<void> {
    const { delay = 0 } = options
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    await Promise.allSettled(bundles.map(bundle => this.loadBundle(bundle)))
  }

  private async loadBundle(bundleName: string): Promise<any> {
    if (this.loadedBundles.has(bundleName)) {
      return // Already loaded
    }

    if (this.loadingBundles.has(bundleName)) {
      return this.loadingBundles.get(bundleName) // Already loading
    }

    const startTime = performance.now()
    
    const loadPromise = this.getBundleImport(bundleName)
      .then(result => {
        const endTime = performance.now()
        const loadTime = endTime - startTime
        
        this.loadedBundles.add(bundleName)
        this.loadingBundles.delete(bundleName)
        
        // Record bundle analysis
        this.bundleAnalysis.set(bundleName, {
          name: bundleName,
          size: this.estimateBundleSize(bundleName),
          loadTime,
          dependencies: this.getBundleDependencies(bundleName),
          criticalPath: this.resourcePriorities.high.includes(bundleName)
        })
        
        console.log(`[Bundle] ${bundleName} loaded in ${loadTime.toFixed(2)}ms`)
        return result
      })
      .catch(error => {
        this.loadingBundles.delete(bundleName)
        console.error(`[Bundle] Failed to load ${bundleName}:`, error)
        throw error
      })

    this.loadingBundles.set(bundleName, loadPromise)
    return loadPromise
  }

  private getBundleImport(bundleName: string): Promise<any> {
    const bundleImports: { [key: string]: () => Promise<any> } = {
      // Core bundles
      'wallet-adapter': () => import('@solana/wallet-adapter-react'),
      'solana-web3': () => import('@solana/web3.js'),
      'spl-token': () => import('@solana/spl-token'),
      'anchor': () => import('@coral-xyz/anchor'),
      
      // UI bundles
      'core-ui': () => import('@/components/ui'),
      'forms': () => import('@/components/forms'),
      'modals': () => import('@/components/modals'),
      
      // Feature bundles
      'staking-features': () => Promise.all([
        import('@/components/StakingInterface'),
        import('@/hooks/useStaking')
      ]),
      
      'nft-display': () => Promise.all([
        import('@/components/NFTGrid'),
        import('@/components/NFTCard'),
        import('@/hooks/useNFTs')
      ]),
      
      'monitoring': () => Promise.all([
        import('@/components/MonitoringDashboard'),
        import('@/utils/monitoring')
      ]),
      
      'admin-tools': () => Promise.all([
        import('@/components/UpgradeManager'),
        import('@/components/admin/AdminDashboard')
      ]),
      
      // Utility bundles
      'charts': () => import('recharts'),
      'animations': () => import('framer-motion'),
      'date-utils': () => import('date-fns'),
      
      // Advanced features
      'advanced-settings': () => import('@/components/Settings'),
      'performance-tools': () => import('@/utils/performance')
    }

    const importFn = bundleImports[bundleName]
    if (!importFn) {
      throw new Error(`Unknown bundle: ${bundleName}`)
    }

    return importFn()
  }

  private getBundlesForGroup(
    groupName: string, 
    context?: {
      userRole?: string
      route?: string
      viewport?: 'mobile' | 'desktop'
    }
  ): string[] {
    const bundleGroups: { [key: string]: string[] } = {
      // Essential bundles for app start
      'core': ['wallet-adapter', 'solana-web3', 'core-ui'],
      
      // User dashboard bundles
      'dashboard': ['staking-features', 'nft-display', 'forms'],
      
      // Admin interface bundles
      'admin': ['admin-tools', 'monitoring', 'charts'],
      
      // Mobile-optimized bundles
      'mobile': ['core-ui', 'staking-features'],
      
      // Desktop full-feature bundles
      'desktop': ['staking-features', 'nft-display', 'charts', 'advanced-settings']
    }

    let bundles = bundleGroups[groupName] || []
    
    // Context-based bundle selection
    if (context) {
      if (context.userRole === 'admin') {
        bundles = [...bundles, ...bundleGroups.admin]
      }
      
      if (context.viewport === 'mobile') {
        // Prioritize mobile bundles, exclude heavy desktop features
        bundles = bundles.filter(b => !['charts', 'advanced-settings'].includes(b))
      }
      
      if (context.route?.includes('admin')) {
        bundles = [...bundles, ...bundleGroups.admin]
      }
    }

    return [...new Set(bundles)] // Remove duplicates
  }

  private estimateBundleSize(bundleName: string): number {
    const sizeEstimates: { [key: string]: number } = {
      'wallet-adapter': 150000,
      'solana-web3': 200000,
      'spl-token': 80000,
      'anchor': 120000,
      'core-ui': 60000,
      'staking-features': 100000,
      'nft-display': 90000,
      'monitoring': 110000,
      'admin-tools': 130000,
      'charts': 180000,
      'animations': 100000,
      'advanced-settings': 70000
    }
    
    return sizeEstimates[bundleName] || 50000
  }

  private getBundleDependencies(bundleName: string): string[] {
    const dependencies: { [key: string]: string[] } = {
      'staking-features': ['wallet-adapter', 'solana-web3', 'anchor'],
      'nft-display': ['solana-web3', 'spl-token', 'core-ui'],
      'admin-tools': ['wallet-adapter', 'solana-web3', 'anchor', 'core-ui'],
      'monitoring': ['core-ui', 'charts'],
      'advanced-settings': ['core-ui', 'forms']
    }
    
    return dependencies[bundleName] || []
  }

  // Get loading statistics
  getBundleStats(): {
    loaded: string[]
    loading: string[]
    totalSize: number
    averageLoadTime: number
  } {
    const analyses = Array.from(this.bundleAnalysis.values())
    
    return {
      loaded: Array.from(this.loadedBundles),
      loading: Array.from(this.loadingBundles.keys()),
      totalSize: analyses.reduce((sum, analysis) => sum + analysis.size, 0),
      averageLoadTime: analyses.length > 0 
        ? analyses.reduce((sum, analysis) => sum + analysis.loadTime, 0) / analyses.length
        : 0
    }
  }

  // Preload bundles based on user behavior
  preloadBasedOnBehavior(behavior: {
    frequentRoutes: string[]
    userRole: string
    deviceType: 'mobile' | 'desktop'
    connectionSpeed: 'slow' | 'fast'
  }): void {
    const { frequentRoutes, userRole, deviceType, connectionSpeed } = behavior
    
    // Don't preload on slow connections
    if (connectionSpeed === 'slow') {
      return
    }
    
    const bundlesToPreload: string[] = []
    
    // Preload based on frequent routes
    if (frequentRoutes.includes('/admin')) {
      bundlesToPreload.push(...this.getBundlesForGroup('admin'))
    }
    
    if (frequentRoutes.includes('/dashboard')) {
      bundlesToPreload.push(...this.getBundlesForGroup('dashboard'))
    }
    
    // Role-based preloading
    if (userRole === 'admin') {
      bundlesToPreload.push('admin-tools', 'monitoring')
    }
    
    // Device-based preloading
    const deviceGroup = deviceType === 'mobile' ? 'mobile' : 'desktop'
    bundlesToPreload.push(...this.getBundlesForGroup(deviceGroup))
    
    // Preload with low priority
    setTimeout(() => {
      this.loadBundlesParallel([...new Set(bundlesToPreload)])
    }, 2000)
  }

  // Clear loaded bundles (for testing or memory management)
  clearBundles(): void {
    this.loadedBundles.clear()
    this.loadingBundles.clear()
    this.bundleAnalysis.clear()
  }
}

// Global instance
export const bundleSplittingManager = new BundleSplittingManager()

// React hook for bundle loading
export function useBundleLoading() {
  const [stats, setStats] = React.useState(bundleSplittingManager.getBundleStats())
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setStats(bundleSplittingManager.getBundleStats())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  const loadBundleGroup = React.useCallback((
    groupName: string,
    context?: Parameters<typeof bundleSplittingManager.loadBundleGroup>[1]
  ) => {
    return bundleSplittingManager.loadBundleGroup(groupName, context)
  }, [])
  
  return {
    stats,
    loadBundleGroup,
    isLoading: stats.loading.length > 0
  }
}

// Resource hints for the browser
export const resourceHints = {
  // Generate preload links
  generatePreloadLinks: (bundles: string[]): string[] => {
    return bundles.map(bundle => 
      `<link rel="modulepreload" href="/bundles/${bundle}.js">`
    )
  },
  
  // Generate prefetch links for likely-needed resources
  generatePrefetchLinks: (userContext: {
    role: string
    route: string
  }): string[] => {
    const { role, route } = userContext
    const prefetchBundles: string[] = []
    
    if (role === 'admin' && !route.includes('admin')) {
      prefetchBundles.push('admin-tools', 'monitoring')
    }
    
    if (!route.includes('dashboard')) {
      prefetchBundles.push('staking-features', 'nft-display')
    }
    
    return prefetchBundles.map(bundle => 
      `<link rel="prefetch" href="/bundles/${bundle}.js">`
    )
  }
}

export default {
  bundleSplittingManager,
  useBundleLoading,
  resourceHints
}