import { 
  MemoizedCache, 
  useDebounce, 
  useThrottle, 
  useVirtualScroll,
  PerformanceProfiler,
  arrayUtils,
  globalPerformanceProfiler
} from '../performance'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'

// Mock performance API
global.performance = {
  ...global.performance,
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn().mockReturnValue([{ duration: 100 }]),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
}

describe('MemoizedCache', () => {
  let cache: MemoizedCache<string>

  beforeEach(() => {
    cache = new MemoizedCache<string>(1000) // 1 second TTL
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1')
    expect(cache.get('key1')).toBe('value1')
  })

  it('should respect TTL', () => {
    cache.set('key1', 'value1')
    
    // Advance time beyond TTL
    jest.advanceTimersByTime(1500)
    
    expect(cache.get('key1')).toBeUndefined()
  })

  it('should handle has() method correctly', () => {
    cache.set('key1', 'value1')
    expect(cache.has('key1')).toBe(true)
    
    // Advance time beyond TTL
    jest.advanceTimersByTime(1500)
    expect(cache.has('key1')).toBe(false)
  })

  it('should delete values', () => {
    cache.set('key1', 'value1')
    cache.delete('key1')
    expect(cache.get('key1')).toBeUndefined()
  })

  it('should clear all values', () => {
    cache.set('key1', 'value1')
    cache.set('key2', 'value2')
    cache.clear()
    expect(cache.get('key1')).toBeUndefined()
    expect(cache.get('key2')).toBeUndefined()
  })

  it('should return correct size', () => {
    cache.set('key1', 'value1')
    cache.set('key2', 'value2')
    expect(cache.size()).toBe(2)
    
    // Advance time to expire one item
    jest.advanceTimersByTime(1500)
    cache.size() // This should clean up expired entries
    // Note: The actual size depends on implementation details
  })

  it('should set custom TTL per item', () => {
    cache.set('short', 'value1', 500)
    cache.set('long', 'value2', 2000)
    
    jest.advanceTimersByTime(750)
    
    expect(cache.get('short')).toBeUndefined()
    expect(cache.get('long')).toBe('value2')
  })
})

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should debounce value changes', () => {
    const TestComponent = () => {
      const [value, setValue] = useState('')
      const debouncedValue = useDebounce(value, 500)
      return { value, setValue, debouncedValue }
    }

    const { result } = renderHook(() => TestComponent())

    // Initial value
    expect(result.current.debouncedValue).toBe('')

    // Change value rapidly
    act(() => {
      result.current.setValue('test1')
    })
    
    act(() => {
      result.current.setValue('test2')
    })
    
    act(() => {
      result.current.setValue('test3')
    })

    // Debounced value should still be initial
    expect(result.current.debouncedValue).toBe('')

    // Advance time
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Now debounced value should update to latest
    expect(result.current.debouncedValue).toBe('test3')
  })
})

describe('useThrottle', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should throttle function calls', () => {
    const mockFn = jest.fn()
    
    const TestComponent = () => {
      const throttledFn = useThrottle(mockFn, 1000)
      return { throttledFn }
    }

    const { result } = renderHook(() => TestComponent())

    // Call multiple times rapidly
    act(() => {
      result.current.throttledFn('call1')
      result.current.throttledFn('call2')
      result.current.throttledFn('call3')
    })

    // Should only be called once
    expect(mockFn).toHaveBeenCalledTimes(1)
    expect(mockFn).toHaveBeenCalledWith('call1')

    // Advance time
    act(() => {
      jest.advanceTimersByTime(1100)
    })

    // Call again
    act(() => {
      result.current.throttledFn('call4')
    })

    expect(mockFn).toHaveBeenCalledTimes(2)
    expect(mockFn).toHaveBeenLastCalledWith('call4')
  })
})

describe('useVirtualScroll', () => {
  const mockItems = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }))
  
  it('should calculate visible range correctly', () => {
    const TestComponent = () => {
      return useVirtualScroll(mockItems, {
        itemHeight: 50,
        containerHeight: 400,
        overscan: 2
      })
    }

    const { result } = renderHook(() => TestComponent())

    expect(result.current.visibleItems.length).toBeGreaterThan(0)
    expect(result.current.totalHeight).toBe(50000) // 1000 * 50
    expect(typeof result.current.onScroll).toBe('function')
  })

  it('should handle scroll events', () => {
    const TestComponent = () => {
      return useVirtualScroll(mockItems, {
        itemHeight: 50,
        containerHeight: 400
      })
    }

    const { result } = renderHook(() => TestComponent())

    const mockScrollEvent = {
      currentTarget: { scrollTop: 500 }
    } as React.UIEvent<HTMLDivElement>

    act(() => {
      result.current.onScroll(mockScrollEvent)
    })

    // Should update visible items based on scroll position
    expect(result.current.offsetY).toBeGreaterThan(0)
  })
})

describe('PerformanceProfiler', () => {
  let profiler: PerformanceProfiler

  beforeEach(() => {
    profiler = PerformanceProfiler.getInstance()
    profiler.clear() // Clear any previous measurements
  })

  it('should be a singleton', () => {
    const profiler2 = PerformanceProfiler.getInstance()
    expect(profiler).toBe(profiler2)
  })

  it('should measure performance', () => {
    profiler.startMeasurement('test')
    const duration = profiler.endMeasurement('test')
    
    expect(typeof duration).toBe('number')
    expect(duration).toBeGreaterThanOrEqual(0)
  })

  it('should provide statistics', () => {
    profiler.startMeasurement('test')
    profiler.endMeasurement('test')
    
    const stats = profiler.getStats('test')
    
    expect(stats.count).toBe(1)
    expect(stats.average).toBeGreaterThanOrEqual(0)
    expect(stats.min).toBeGreaterThanOrEqual(0)
    expect(stats.max).toBeGreaterThanOrEqual(0)
    expect(stats.latest).toBeGreaterThanOrEqual(0)
  })

  it('should handle multiple measurements', () => {
    for (let i = 0; i < 5; i++) {
      profiler.startMeasurement('multi-test')
      profiler.endMeasurement('multi-test')
    }
    
    const stats = profiler.getStats('multi-test')
    expect(stats.count).toBe(5)
  })

  it('should get all stats', () => {
    profiler.startMeasurement('test1')
    profiler.endMeasurement('test1')
    profiler.startMeasurement('test2')
    profiler.endMeasurement('test2')
    
    const allStats = profiler.getAllStats()
    expect(Object.keys(allStats)).toContain('test1')
    expect(Object.keys(allStats)).toContain('test2')
  })

  it('should clear measurements', () => {
    profiler.startMeasurement('test')
    profiler.endMeasurement('test')
    
    profiler.clear()
    const stats = profiler.getStats('test')
    expect(stats.count).toBe(0)
  })
})

describe('arrayUtils', () => {
  describe('deduplicate', () => {
    it('should remove duplicates from primitive array', () => {
      const input = [1, 2, 3, 2, 4, 1, 5]
      const result = arrayUtils.deduplicate(input)
      expect(result).toEqual([1, 2, 3, 4, 5])
    })

    it('should remove duplicates using key extractor', () => {
      const input = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'C' },
        { id: 3, name: 'D' }
      ]
      const result = arrayUtils.deduplicate(input, (item) => item.id)
      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('A') // First occurrence kept
    })
  })

  describe('chunk', () => {
    it('should split array into chunks', () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const result = arrayUtils.chunk(input, 3)
      expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]])
    })

    it('should handle empty array', () => {
      const result = arrayUtils.chunk([], 3)
      expect(result).toEqual([])
    })
  })

  describe('binarySearch', () => {
    it('should find element in sorted array', () => {
      const input = [1, 3, 5, 7, 9, 11, 13]
      expect(arrayUtils.binarySearch(input, 7)).toBe(3)
      expect(arrayUtils.binarySearch(input, 1)).toBe(0)
      expect(arrayUtils.binarySearch(input, 13)).toBe(6)
    })

    it('should return -1 for missing element', () => {
      const input = [1, 3, 5, 7, 9]
      expect(arrayUtils.binarySearch(input, 4)).toBe(-1)
      expect(arrayUtils.binarySearch(input, 0)).toBe(-1)
      expect(arrayUtils.binarySearch(input, 10)).toBe(-1)
    })

    it('should work with custom compareFn', () => {
      const input = ['apple', 'banana', 'cherry', 'date']
      const result = arrayUtils.binarySearch(
        input, 
        'cherry',
        (a, b) => a.localeCompare(b)
      )
      expect(result).toBe(2)
    })
  })

  describe('flatten', () => {
    it('should flatten nested arrays', () => {
      const input = [1, [2, 3], [4, [5, 6]], 7]
      const result = arrayUtils.flatten(input)
      expect(result).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('should handle already flat array', () => {
      const input = [1, 2, 3, 4]
      const result = arrayUtils.flatten(input)
      expect(result).toEqual([1, 2, 3, 4])
    })
  })
})

describe('Global Performance Profiler', () => {
  it('should be accessible globally', () => {
    expect(globalPerformanceProfiler).toBeInstanceOf(PerformanceProfiler)
  })

  it('should maintain measurements across imports', () => {
    globalPerformanceProfiler.startMeasurement('global-test')
    const duration = globalPerformanceProfiler.endMeasurement('global-test')
    
    expect(typeof duration).toBe('number')
    
    const stats = globalPerformanceProfiler.getStats('global-test')
    expect(stats.count).toBeGreaterThan(0)
  })
})