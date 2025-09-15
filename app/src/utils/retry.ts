// Robust retry logic with exponential backoff and timeout handling
import { StakingError, ErrorType, shouldRetry } from './errorHandling'

export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  timeoutMs?: number
  retryCondition?: (error: any) => boolean
  onRetry?: (error: any, attempt: number) => void
}

export interface RetryableFunction<T> {
  (): Promise<T>
}

// Default retry configuration
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  timeoutMs: 30000,
  retryCondition: (error) => {
    // Default condition - retry on network/timeout errors
    if (error instanceof StakingError) {
      return shouldRetry(error, 0)
    }
    return (
      error?.message?.includes('network') ||
      error?.message?.includes('timeout') ||
      error?.message?.includes('fetch') ||
      error?.code === 'NETWORK_ERROR'
    )
  },
  onRetry: () => {}, // No-op by default
}

// Exponential backoff with jitter
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
  const jitter = Math.random() * 0.1 * exponentialDelay // 10% jitter
  return Math.min(exponentialDelay + jitter, maxDelay)
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Timeout wrapper
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new StakingError(
        ErrorType.TIMEOUT_ERROR,
        `Operation timed out after ${timeoutMs}ms`,
        { retryable: true }
      ))
    }, timeoutMs)

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId))
  })
}

// Main retry function
export async function withRetry<T>(
  fn: RetryableFunction<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options }
  
  let lastError: any
  let attempt = 0

  while (attempt < config.maxAttempts) {
    attempt++
    
    try {
      // Wrap with timeout
      const result = await withTimeout(fn(), config.timeoutMs)
      return result
    } catch (error) {
      lastError = error
      
      // Don't retry on the last attempt
      if (attempt >= config.maxAttempts) {
        break
      }

      // Check if we should retry this error
      if (!config.retryCondition(error)) {
        break
      }

      // Call retry callback
      config.onRetry(error, attempt)

      // Calculate delay and wait
      const delay = calculateDelay(attempt, config.baseDelayMs, config.maxDelayMs)
      console.warn(`Retry attempt ${attempt}/${config.maxAttempts} after ${delay}ms delay:`, error)
      
      await sleep(delay)
    }
  }

  // If we get here, all retries failed
  throw lastError
}

// Specialized retry functions for different scenarios

// For blockchain transactions
export const retryTransaction = <T>(fn: RetryableFunction<T>) => 
  withRetry(fn, {
    maxAttempts: 3,
    baseDelayMs: 2000,
    maxDelayMs: 8000,
    timeoutMs: 45000, // Longer timeout for blockchain
    retryCondition: (error) => {
      return (
        error?.message?.includes('Blockhash not found') ||
        error?.message?.includes('Transaction was not confirmed') ||
        error?.message?.includes('network') ||
        error?.code === 'NETWORK_ERROR'
      )
    },
    onRetry: (error, attempt) => {
      console.log(`Retrying transaction (${attempt}/3):`, error.message)
    }
  })

// For metadata fetching
export const retryMetadata = <T>(fn: RetryableFunction<T>) =>
  withRetry(fn, {
    maxAttempts: 5,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    timeoutMs: 15000,
    retryCondition: (error) => {
      return (
        error?.message?.includes('404') ||
        error?.message?.includes('network') ||
        error?.message?.includes('fetch') ||
        error?.status >= 500
      )
    },
    onRetry: (error, attempt) => {
      console.log(`Retrying metadata fetch (${attempt}/5):`, error.message)
    }
  })

// For RPC calls
export const retryRPC = <T>(fn: RetryableFunction<T>) =>
  withRetry(fn, {
    maxAttempts: 4,
    baseDelayMs: 1500,
    maxDelayMs: 6000,
    timeoutMs: 20000,
    retryCondition: (error) => {
      return (
        error?.message?.includes('429') || // Rate limited
        error?.message?.includes('500') || // Server error
        error?.message?.includes('502') || // Bad gateway
        error?.message?.includes('503') || // Service unavailable
        error?.message?.includes('network')
      )
    },
    onRetry: (error, attempt) => {
      console.log(`Retrying RPC call (${attempt}/4):`, error.message)
    }
  })

// Batch retry for multiple operations
export async function retryBatch<T>(
  operations: Array<{ fn: RetryableFunction<T>; id: string }>,
  options: RetryOptions = {}
): Promise<Array<{ id: string; result: T | null; error: any | null }>> {
  const results = await Promise.allSettled(
    operations.map(async (op) => {
      try {
        const result = await withRetry(op.fn, options)
        return { id: op.id, result, error: null }
      } catch (error) {
        return { id: op.id, result: null, error }
      }
    })
  )

  return results.map((result) => 
    result.status === 'fulfilled' 
      ? result.value 
      : { id: 'unknown', result: null, error: result.reason }
  )
}

// Circuit breaker with retry
export class RetryCircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 60000 // 1 minute
  ) {}

  async execute<T>(
    fn: RetryableFunction<T>, 
    retryOptions: RetryOptions = {}
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN'
      } else {
        throw new StakingError(
          ErrorType.PROGRAM_ERROR,
          'Circuit breaker is OPEN - too many failures'
        )
      }
    }

    try {
      const result = await withRetry(fn, retryOptions)
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      isBlocked: this.state === 'OPEN'
    }
  }
}

// Utility for timeout-only operations (no retry)
export function withTimeoutOnly<T>(
  promise: Promise<T>, 
  timeoutMs: number
): Promise<T> {
  return withTimeout(promise, timeoutMs)
}

// Debounced retry - prevents too frequent retry attempts
export class DebouncedRetry {
  private timers = new Map<string, NodeJS.Timeout>()

  retry<T>(
    key: string,
    fn: RetryableFunction<T>,
    delayMs = 1000,
    options: RetryOptions = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Clear existing timer
      const existingTimer = this.timers.get(key)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }

      // Set new timer
      const timer = setTimeout(async () => {
        try {
          const result = await withRetry(fn, options)
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.timers.delete(key)
        }
      }, delayMs)

      this.timers.set(key, timer)
    })
  }

  cancel(key: string): boolean {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
      return true
    }
    return false
  }

  cancelAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }
}

// Global instances for easy use
export const globalCircuitBreaker = new RetryCircuitBreaker()
export const globalDebouncedRetry = new DebouncedRetry()

// Helper functions for common patterns
export const retryUtils = {
  // Safe wrapper that doesn't throw
  safe: async <T>(fn: RetryableFunction<T>, defaultValue: T): Promise<T> => {
    try {
      return await withRetry(fn)
    } catch (error) {
      console.error('Retry failed, returning default:', error)
      return defaultValue
    }
  },

  // Conditional retry based on user settings
  conditional: async <T>(
    fn: RetryableFunction<T>,
    shouldRetryFn: () => boolean,
    options?: RetryOptions
  ): Promise<T> => {
    if (!shouldRetryFn()) {
      return await withTimeoutOnly(fn(), options?.timeoutMs || 10000)
    }
    return await withRetry(fn, options)
  },

  // Retry with progress callback
  withProgress: async <T>(
    fn: RetryableFunction<T>,
    onProgress: (attempt: number, maxAttempts: number) => void,
    options?: RetryOptions
  ): Promise<T> => {
    const maxAttempts = options?.maxAttempts || 3
    return await withRetry(fn, {
      ...options,
      onRetry: (error, attempt) => {
        onProgress(attempt, maxAttempts)
        options?.onRetry?.(error, attempt)
      }
    })
  }
}