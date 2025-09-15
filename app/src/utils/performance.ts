// Performance optimization utilities
import { useCallback, useMemo, useRef, useEffect, useState } from 'react'

// Memoization utility with TTL support
export class MemoizedCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>()
  private defaultTTL: number

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTL
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    
    if (!entry) return undefined
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return undefined
    }
    
    return entry.value
  }

  set(key: string, value: T, ttl?: number): void {
    const expiry = Date.now() + (ttl ?? this.defaultTTL)
    this.cache.set(key, { value, expiry })
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    
    if (!entry) return false
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    // Clean expired entries first
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key)
      }
    }
    return this.cache.size
  }

  // Get cache statistics
  getStats(): { size: number; hitRate: number } {
    return {
      size: this.size(),
      hitRate: 0 // Would need hit tracking for real implementation
    }
  }
}

// Debounce hook for React components
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Throttle hook for React components
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRan = useRef<number>(0)
  
  return useCallback(
    ((...args: Parameters<T>) => {
      if (Date.now() - lastRan.current >= delay) {
        callback(...args)
        lastRan.current = Date.now()
      }
    }) as T,
    [callback, delay]
  )
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [elementRef, options])

  return isIntersecting
}

// Virtual scrolling implementation
export interface VirtualScrollOptions {
  itemHeight: number
  containerHeight: number
  overscan?: number
}

export function useVirtualScroll<T>(
  items: T[],
  options: VirtualScrollOptions
) {
  const [scrollTop, setScrollTop] = useState(0)
  const { itemHeight, containerHeight, overscan = 5 } = options

  const visibleRange = useMemo(() => {
    const visibleItemCount = Math.ceil(containerHeight / itemHeight)
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      startIndex + visibleItemCount + overscan,
      items.length
    )

    return {
      startIndex: Math.max(0, startIndex - overscan),
      endIndex,
      visibleItemCount
    }
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length])

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex)
      .map((item, index) => ({
        item,
        index: visibleRange.startIndex + index
      }))
  }, [items, visibleRange])

  const totalHeight = items.length * itemHeight

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  return {
    visibleItems,
    totalHeight,
    onScroll,
    scrollTop,
    offsetY: visibleRange.startIndex * itemHeight
  }
}

// Performance monitoring utilities
export class PerformanceProfiler {
  private static instance: PerformanceProfiler
  private measurements = new Map<string, number[]>()

  static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler()
    }
    return PerformanceProfiler.instance
  }

  startMeasurement(label: string): void {
    performance.mark(`${label}-start`)
  }

  endMeasurement(label: string): number {
    performance.mark(`${label}-end`)
    performance.measure(label, `${label}-start`, `${label}-end`)
    
    const measure = performance.getEntriesByName(label, 'measure')[0]
    const duration = measure?.duration || 0

    // Store measurement
    if (!this.measurements.has(label)) {
      this.measurements.set(label, [])
    }
    this.measurements.get(label)!.push(duration)

    // Clean up performance entries
    performance.clearMarks(`${label}-start`)
    performance.clearMarks(`${label}-end`)
    performance.clearMeasures(label)

    return duration
  }

  getStats(label: string): {
    count: number
    average: number
    min: number
    max: number
    latest: number
  } {
    const measurements = this.measurements.get(label) || []
    
    if (measurements.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, latest: 0 }
    }

    const sum = measurements.reduce((a, b) => a + b, 0)
    const average = sum / measurements.length
    const min = Math.min(...measurements)
    const max = Math.max(...measurements)
    const latest = measurements[measurements.length - 1]

    return { count: measurements.length, average, min, max, latest }
  }

  getAllStats(): Record<string, ReturnType<typeof this.getStats>> {
    const stats: Record<string, ReturnType<typeof this.getStats>> = {}
    
    for (const label of this.measurements.keys()) {
      stats[label] = this.getStats(label)
    }
    
    return stats
  }

  clear(): void {
    this.measurements.clear()
  }
}

// React hook for performance profiling
export function usePerformanceProfiler(label: string) {
  const profiler = PerformanceProfiler.getInstance()

  const startMeasurement = useCallback(() => {
    profiler.startMeasurement(label)
  }, [profiler, label])

  const endMeasurement = useCallback(() => {
    return profiler.endMeasurement(label)
  }, [profiler, label])

  const getStats = useCallback(() => {
    return profiler.getStats(label)
  }, [profiler, label])

  return { startMeasurement, endMeasurement, getStats }
}

// Memory usage monitoring
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize?: number
    totalJSHeapSize?: number
    jsHeapSizeLimit?: number
    percentage?: number
  }>({})

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        const percentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
        
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          percentage
        })
      }
    }

    updateMemoryInfo()
    const interval = setInterval(updateMemoryInfo, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  return memoryInfo
}

// Efficient array operations
export const arrayUtils = {
  // Efficient array deduplication
  deduplicate: <T>(
    array: T[], 
    keyExtractor?: (item: T) => string | number
  ): T[] => {
    if (!keyExtractor) {
      return [...new Set(array)]
    }

    const seen = new Set<string | number>()
    return array.filter(item => {
      const key = keyExtractor(item)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  },

  // Efficient array chunking
  chunk: <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  },

  // Binary search for sorted arrays
  binarySearch: <T>(
    array: T[],
    target: T,
    compareFn?: (a: T, b: T) => number
  ): number => {
    let left = 0
    let right = array.length - 1

    const compare = compareFn || ((a: T, b: T) => {
      if (a < b) return -1
      if (a > b) return 1
      return 0
    })

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const comparison = compare(array[mid], target)

      if (comparison === 0) {
        return mid
      } else if (comparison < 0) {
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    return -1 // Not found
  },

  // Efficient array flattening
  flatten: <T>(array: (T | T[])[]): T[] => {
    const result: T[] = []
    
    for (const item of array) {
      if (Array.isArray(item)) {
        result.push(...arrayUtils.flatten(item))
      } else {
        result.push(item)
      }
    }
    
    return result
  }
}

// Component optimization utilities (non-JSX)
export const componentUtils = {
  // Performance monitoring helpers
  createProfiler: (componentName: string) => {
    const profiler = PerformanceProfiler.getInstance()
    return {
      start: () => profiler.startMeasurement(`${componentName}-render`),
      end: () => profiler.endMeasurement(`${componentName}-render`)
    }
  }
}

// Bundle splitting utilities (non-JSX)
export const bundleUtils = {
  // Preload components for better UX
  preloadComponent: (importFn: () => Promise<any>): void => {
    // Start loading the component
    importFn().catch(error => {
      console.warn('Failed to preload component:', error)
    })
  }
}

// Global performance optimization settings
export const performanceConfig = {
  // Debounce delays for different scenarios
  debounceDelays: {
    search: 300,
    input: 150,
    scroll: 50,
    resize: 100
  },

  // Virtual scrolling configurations
  virtualScroll: {
    itemHeight: 60,
    overscan: 5,
    containerHeight: 400
  },

  // Cache configurations
  cache: {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000,
    cleanupInterval: 10 * 60 * 1000 // 10 minutes
  },

  // Performance thresholds
  thresholds: {
    renderTime: 16, // 60 FPS
    memoryUsage: 70, // 70% of heap limit
    cacheHitRate: 80 // 80% cache hit rate
  }
}

// Global performance instance for easy access
export const globalPerformanceProfiler = PerformanceProfiler.getInstance()

// Export default performance optimization hook
export default function usePerformanceOptimization() {
  const memoryInfo = useMemoryMonitor()
  const profiler = PerformanceProfiler.getInstance()

  const getPerformanceReport = useCallback(() => {
    return {
      memory: memoryInfo,
      measurements: profiler.getAllStats(),
      timestamp: Date.now()
    }
  }, [memoryInfo, profiler])

  const clearPerformanceData = useCallback(() => {
    profiler.clear()
  }, [profiler])

  return {
    memoryInfo,
    getPerformanceReport,
    clearPerformanceData,
    profiler
  }
}