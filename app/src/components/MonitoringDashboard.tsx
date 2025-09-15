'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { monitoring, auditLogger, performanceMonitor, healthMonitor } from '@/utils/monitoring'
import type { AuditLogEntry, LogLevel } from '@/utils/monitoring'

interface DashboardStats {
  totalTransactions: number
  successRate: number
  avgResponseTime: number
  errorRate: number
  activeUsers: number
}

interface SystemHealth {
  overall: boolean
  rpcConnection: boolean
  walletConnection: boolean
  cacheHealth: boolean
}

const MonitoringDashboard = () => {
  const { publicKey } = useWallet()
  const [stats, setStats] = useState<DashboardStats>({
    totalTransactions: 0,
    successRate: 0,
    avgResponseTime: 0,
    errorRate: 0,
    activeUsers: 0
  })
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: true,
    rpcConnection: true,
    walletConnection: true,
    cacheHealth: true
  })
  const [selectedLogLevel, setSelectedLogLevel] = useState<LogLevel | 'all'>('all')
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  // Refresh dashboard data
  const refreshData = () => {
    // Get performance stats
    const perfStats = performanceMonitor.getStats()
    
    // Get recent logs
    const logs = auditLogger.getLogs({
      startTime: Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
    }).slice(0, 50)

    // Get health status
    const health = healthMonitor.getHealthStatus()

    // Calculate stats
    const transactionLogs = logs.filter(log => 
      log.category === 'transaction' && log.event.startsWith('transaction_')
    )
    
    const errorLogs = logs.filter(log => 
      log.level === 'error' || log.level === 'critical'
    )

    const uniqueUsers = new Set(
      logs.filter(log => log.user).map(log => log.user)
    ).size

    setStats({
      totalTransactions: transactionLogs.length,
      successRate: perfStats.successRate,
      avgResponseTime: perfStats.averageTime,
      errorRate: logs.length > 0 ? (errorLogs.length / logs.length) * 100 : 0,
      activeUsers: uniqueUsers
    })

    setRecentLogs(logs)
    
    setSystemHealth({
      overall: health.overall,
      rpcConnection: health.checks.rpc_connection?.healthy ?? false,
      walletConnection: health.checks.wallet_connection?.healthy ?? false,
      cacheHealth: true // Would check cache health
    })
  }

  // Auto-refresh effect
  useEffect(() => {
    refreshData()
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000)
    setRefreshInterval(interval)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  // Filter logs by level
  const filteredLogs = selectedLogLevel === 'all' 
    ? recentLogs 
    : recentLogs.filter(log => log.level === selectedLogLevel)

  // Get status indicator color
  const getStatusColor = (healthy: boolean) => 
    healthy ? 'bg-green-500' : 'bg-red-500'

  const getLogLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300'
      case 'error': return 'bg-red-50 text-red-700 border-red-200'
      case 'warn': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'info': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'debug': return 'bg-gray-50 text-gray-700 border-gray-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const exportLogs = () => {
    const csv = auditLogger.exportLogs('csv')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">System Monitoring</h2>
        <div className="flex gap-3">
          <button
            onClick={refreshData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Refresh
          </button>
          <button
            onClick={exportLogs}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Export Logs
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">System Health</h3>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(systemHealth.overall)}`}></div>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {systemHealth.overall ? 'Healthy' : 'Issues'}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">RPC Connection</h3>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(systemHealth.rpcConnection)}`}></div>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {systemHealth.rpcConnection ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Wallet Status</h3>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(systemHealth.walletConnection)}`}></div>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {publicKey ? 'Connected' : 'Not Connected'}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Cache Health</h3>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(systemHealth.cacheHealth)}`}></div>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {systemHealth.cacheHealth ? 'Optimal' : 'Issues'}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-700">Total Transactions</h3>
          <div className="mt-2 text-3xl font-bold text-blue-900">
            {stats.totalTransactions.toLocaleString()}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-700">Success Rate</h3>
          <div className="mt-2 text-3xl font-bold text-green-900">
            {stats.successRate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-700">Avg Response</h3>
          <div className="mt-2 text-3xl font-bold text-yellow-900">
            {stats.avgResponseTime.toFixed(0)}ms
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-red-700">Error Rate</h3>
          <div className="mt-2 text-3xl font-bold text-red-900">
            {stats.errorRate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-700">Active Users</h3>
          <div className="mt-2 text-3xl font-bold text-purple-900">
            {stats.activeUsers}
          </div>
        </div>
      </div>

      {/* Recent Activity Logs */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Recent Activity</h3>
          <select
            value={selectedLogLevel}
            onChange={(e) => setSelectedLogLevel(e.target.value as LogLevel | 'all')}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Levels</option>
            <option value="critical">Critical</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2">
          {filteredLogs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No logs found</p>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-lg border ${getLogLevelColor(log.level)}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium uppercase`}>
                        {log.level}
                      </span>
                      <span className="text-sm text-gray-600">
                        {log.category}
                      </span>
                      <span className="text-sm font-medium">
                        {log.event}
                      </span>
                    </div>
                    
                    {log.user && (
                      <div className="text-xs text-gray-600 mb-1">
                        User: {log.user.slice(0, 8)}...{log.user.slice(-8)}
                      </div>
                    )}
                    
                    {Object.keys(log.details).length > 0 && (
                      <div className="text-xs text-gray-600">
                        <details className="mt-1">
                          <summary className="cursor-pointer">View Details</summary>
                          <pre className="mt-1 text-xs bg-white p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-500 ml-4">
                    {formatTimestamp(log.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Performance Insights */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">Performance Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-blue-700">Fastest Operation:</span>
            <div className="text-blue-900">{performanceMonitor.getStats().fastestOperation}ms</div>
          </div>
          <div>
            <span className="font-medium text-blue-700">Slowest Operation:</span>
            <div className="text-blue-900">{performanceMonitor.getStats().slowestOperation}ms</div>
          </div>
          <div>
            <span className="font-medium text-blue-700">Total Operations:</span>
            <div className="text-blue-900">{performanceMonitor.getStats().totalOperations}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MonitoringDashboard