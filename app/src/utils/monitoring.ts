// Comprehensive monitoring and audit logging system
import { PublicKey } from '@solana/web3.js'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info', 
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum EventCategory {
  TRANSACTION = 'transaction',
  USER_ACTION = 'user_action',
  SYSTEM = 'system',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  ERROR = 'error'
}

export interface AuditLogEntry {
  id: string
  timestamp: number
  level: LogLevel
  category: EventCategory
  event: string
  user?: string
  details: Record<string, any>
  metadata: {
    sessionId?: string
    userAgent?: string
    ip?: string
    url?: string
  }
}

export interface MetricEntry {
  name: string
  value: number
  timestamp: number
  tags: Record<string, string>
}

export interface PerformanceEntry {
  operation: string
  duration: number
  timestamp: number
  success: boolean
  details?: any
}

class AuditLogger {
  private logs: AuditLogEntry[] = []
  private maxLogs = 1000
  private sessionId = this.generateSessionId()

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  private getMetadata() {
    return {
      sessionId: this.sessionId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      // IP would be added on backend
    }
  }

  log(
    level: LogLevel,
    category: EventCategory,
    event: string,
    details: Record<string, any> = {},
    user?: PublicKey
  ): void {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      category,
      event,
      user: user?.toString(),
      details,
      metadata: this.getMetadata()
    }

    this.logs.push(entry)

    // Maintain log size limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      const logMethod = level === LogLevel.ERROR || level === LogLevel.CRITICAL 
        ? console.error 
        : level === LogLevel.WARN 
        ? console.warn 
        : console.log

      logMethod(`[${level.toUpperCase()}] ${category}:${event}`, details)
    }

    // Send to monitoring service (would be implemented)
    this.sendToMonitoring(entry)
  }

  debug(event: string, details?: Record<string, any>, user?: PublicKey): void {
    this.log(LogLevel.DEBUG, EventCategory.SYSTEM, event, details, user)
  }

  info(event: string, details?: Record<string, any>, user?: PublicKey): void {
    this.log(LogLevel.INFO, EventCategory.USER_ACTION, event, details, user)
  }

  warn(event: string, details?: Record<string, any>, user?: PublicKey): void {
    this.log(LogLevel.WARN, EventCategory.SYSTEM, event, details, user)
  }

  error(event: string, details?: Record<string, any>, user?: PublicKey): void {
    this.log(LogLevel.ERROR, EventCategory.ERROR, event, details, user)
  }

  critical(event: string, details?: Record<string, any>, user?: PublicKey): void {
    this.log(LogLevel.CRITICAL, EventCategory.SECURITY, event, details, user)
  }

  // Specific audit methods for different actions
  auditTransaction(
    type: 'stake' | 'unstake' | 'claim' | 'upgrade' | 'role_change',
    user: PublicKey,
    details: Record<string, any>
  ): void {
    this.log(
      LogLevel.INFO,
      EventCategory.TRANSACTION,
      `transaction_${type}`,
      {
        transactionType: type,
        ...details
      },
      user
    )
  }

  auditSecurity(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    user?: PublicKey
  ): void {
    const level = severity === 'critical' 
      ? LogLevel.CRITICAL 
      : severity === 'high' 
      ? LogLevel.ERROR 
      : LogLevel.WARN

    this.log(level, EventCategory.SECURITY, event, { severity, ...details }, user)
  }

  auditUserAction(
    action: string,
    user: PublicKey,
    details: Record<string, any> = {}
  ): void {
    this.log(LogLevel.INFO, EventCategory.USER_ACTION, action, details, user)
  }

  // Get logs for analysis
  getLogs(filters?: {
    level?: LogLevel
    category?: EventCategory
    user?: string
    startTime?: number
    endTime?: number
  }): AuditLogEntry[] {
    let filteredLogs = [...this.logs]

    if (filters) {
      if (filters.level) {
        filteredLogs = filteredLogs.filter(log => log.level === filters.level)
      }
      
      if (filters.category) {
        filteredLogs = filteredLogs.filter(log => log.category === filters.category)
      }
      
      if (filters.user) {
        filteredLogs = filteredLogs.filter(log => log.user === filters.user)
      }
      
      if (filters.startTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startTime!)
      }
      
      if (filters.endTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endTime!)
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp - a.timestamp)
  }

  // Export logs for analysis
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    const logs = this.getLogs()
    
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'category', 'event', 'user', 'details']
      const csvRows = logs.map(log => [
        new Date(log.timestamp).toISOString(),
        log.level,
        log.category,
        log.event,
        log.user || '',
        JSON.stringify(log.details)
      ])
      
      return [headers, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n')
    }
    
    return JSON.stringify(logs, null, 2)
  }

  // Clear old logs
  clearLogs(): void {
    this.logs = []
  }

  private sendToMonitoring(entry: AuditLogEntry): void {
    // In production, this would send to monitoring service
    // For now, we'll store in localStorage for analysis
    try {
      const stored = localStorage.getItem('audit_logs') || '[]'
      const logs = JSON.parse(stored)
      logs.push(entry)
      
      // Keep only recent logs in localStorage
      const recentLogs = logs.slice(-500)
      localStorage.setItem('audit_logs', JSON.stringify(recentLogs))
    } catch (error) {
      console.error('Failed to store audit log:', error)
    }
  }
}

// Performance monitoring
class PerformanceMonitor {
  private metrics: MetricEntry[] = []
  private performances: PerformanceEntry[] = []
  private maxEntries = 1000

  recordMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    const entry: MetricEntry = {
      name,
      value,
      timestamp: Date.now(),
      tags
    }

    this.metrics.push(entry)
    
    if (this.metrics.length > this.maxEntries) {
      this.metrics = this.metrics.slice(-this.maxEntries)
    }
  }

  recordPerformance(
    operation: string,
    duration: number,
    success: boolean,
    details?: any
  ): void {
    const entry: PerformanceEntry = {
      operation,
      duration,
      timestamp: Date.now(),
      success,
      details
    }

    this.performances.push(entry)
    
    if (this.performances.length > this.maxEntries) {
      this.performances = this.performances.slice(-this.maxEntries)
    }

    // Log slow operations
    if (duration > 5000) { // 5 seconds
      auditLogger.warn('slow_operation', {
        operation,
        duration,
        success,
        details
      })
    }
  }

  // Measure function execution time
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    details?: any
  ): Promise<T> {
    const startTime = Date.now()
    let success = false
    
    try {
      const result = await fn()
      success = true
      return result
    } catch (error) {
      throw error
    } finally {
      const duration = Date.now() - startTime
      this.recordPerformance(operation, duration, success, details)
    }
  }

  // Get performance statistics
  getStats(operation?: string): {
    averageTime: number
    successRate: number
    totalOperations: number
    slowestOperation: number
    fastestOperation: number
  } {
    let ops = this.performances
    
    if (operation) {
      ops = ops.filter(p => p.operation === operation)
    }

    if (ops.length === 0) {
      return {
        averageTime: 0,
        successRate: 0,
        totalOperations: 0,
        slowestOperation: 0,
        fastestOperation: 0
      }
    }

    const totalTime = ops.reduce((sum, op) => sum + op.duration, 0)
    const successCount = ops.filter(op => op.success).length
    const durations = ops.map(op => op.duration)

    return {
      averageTime: totalTime / ops.length,
      successRate: (successCount / ops.length) * 100,
      totalOperations: ops.length,
      slowestOperation: Math.max(...durations),
      fastestOperation: Math.min(...durations)
    }
  }

  // Common metrics
  incrementCounter(name: string, tags?: Record<string, string>): void {
    this.recordMetric(`${name}_count`, 1, tags)
  }

  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(`${name}_gauge`, value, tags)
  }

  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(`${name}_histogram`, value, tags)
  }
}

// Health monitoring
class HealthMonitor {
  private checks: Map<string, () => Promise<boolean>> = new Map()
  private lastResults: Map<string, { healthy: boolean, timestamp: number, error?: string }> = new Map()

  addCheck(name: string, checkFn: () => Promise<boolean>): void {
    this.checks.set(name, checkFn)
  }

  async runCheck(name: string): Promise<{ healthy: boolean, error?: string }> {
    const checkFn = this.checks.get(name)
    if (!checkFn) {
      return { healthy: false, error: 'Check not found' }
    }

    try {
      const healthy = await checkFn()
      const result = { healthy, timestamp: Date.now() }
      this.lastResults.set(name, result)
      return result
    } catch (error) {
      const result = { 
        healthy: false, 
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      this.lastResults.set(name, result)
      return result
    }
  }

  async runAllChecks(): Promise<Record<string, { healthy: boolean, error?: string }>> {
    const results: Record<string, { healthy: boolean, error?: string }> = {}
    
    for (const [name] of this.checks) {
      results[name] = await this.runCheck(name)
    }
    
    return results
  }

  getHealthStatus(): { overall: boolean, checks: Record<string, any> } {
    const checks: Record<string, any> = {}
    let overall = true

    for (const [name, result] of this.lastResults) {
      checks[name] = result
      if (!result.healthy) {
        overall = false
      }
    }

    return { overall, checks }
  }
}

// Global instances
export const auditLogger = new AuditLogger()
export const performanceMonitor = new PerformanceMonitor()
export const healthMonitor = new HealthMonitor()

// Initialize health checks
healthMonitor.addCheck('wallet_connection', async () => {
  // Check if wallet adapter is working
  return typeof window !== 'undefined' && window.solana !== undefined
})

healthMonitor.addCheck('rpc_connection', async () => {
  // Check RPC connection
  try {
    // This would be a real RPC call
    return true
  } catch {
    return false
  }
})

// Monitoring utilities
export const monitoring = {
  // Track user interactions
  trackUserAction: (action: string, user: PublicKey, details?: Record<string, any>) => {
    auditLogger.auditUserAction(action, user, details)
    performanceMonitor.incrementCounter('user_actions', { action })
  },

  // Track transactions
  trackTransaction: (
    type: 'stake' | 'unstake' | 'claim' | 'upgrade' | 'role_change',
    user: PublicKey,
    details: Record<string, any>
  ) => {
    auditLogger.auditTransaction(type, user, details)
    performanceMonitor.incrementCounter('transactions', { type })
  },

  // Track errors
  trackError: (error: any, context: string, user?: PublicKey) => {
    auditLogger.error(`error_${context}`, {
      error: error.message || error,
      stack: error.stack,
      context
    }, user)
    performanceMonitor.incrementCounter('errors', { context })
  },

  // Track performance
  measureOperation: async <T>(
    operation: string,
    fn: () => Promise<T>,
    user?: PublicKey
  ): Promise<T> => {
    return await performanceMonitor.measure(operation, fn, { user: user?.toString() })
  },

  // Security monitoring
  trackSecurity: (
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    user?: PublicKey,
    details?: Record<string, any>
  ) => {
    auditLogger.auditSecurity(event, severity, details || {}, user)
    performanceMonitor.incrementCounter('security_events', { 
      event, 
      severity 
    })
  },

  // Get monitoring dashboard data
  getDashboardData: () => {
    return {
      logs: auditLogger.getLogs().slice(0, 100), // Last 100 logs
      performance: performanceMonitor.getStats(),
      health: healthMonitor.getHealthStatus()
    }
  }
}

// Export for browser console access in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).monitoring = {
    auditLogger,
    performanceMonitor,
    healthMonitor,
    monitoring
  }
}