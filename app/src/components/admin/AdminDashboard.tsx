'use client'

import React from 'react'

interface AdminDashboardProps {
  className?: string
}

export default function AdminDashboard({ className = '' }: AdminDashboardProps) {
  return (
    <div className={`p-6 bg-white rounded-lg shadow-sm ${className}`}>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* System Status */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">System Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-blue-600">Status:</span>
              <span className="text-green-600 font-medium">Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-600">Uptime:</span>
              <span className="text-blue-900">99.9%</span>
            </div>
          </div>
        </div>

        {/* User Statistics */}
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-2">User Statistics</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-green-600">Active Users:</span>
              <span className="text-green-900 font-medium">1,234</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-600">Total Stakers:</span>
              <span className="text-green-900 font-medium">456</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-800 mb-2">Performance</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-purple-600">Avg Response:</span>
              <span className="text-purple-900 font-medium">120ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-600">Cache Hit Rate:</span>
              <span className="text-purple-900 font-medium">94%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Admin Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Refresh Data
          </button>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            Export Logs
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            System Health
          </button>
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            Emergency Stop
          </button>
        </div>
      </div>
    </div>
  )
}