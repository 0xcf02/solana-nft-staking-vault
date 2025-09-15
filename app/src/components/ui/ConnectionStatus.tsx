'use client'

import React, { useState, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useStaking } from '@/hooks/useStaking'

interface ConnectionStatusProps {
  showDetails?: boolean
  compact?: boolean
  className?: string
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showDetails = false,
  compact = false,
  className = ''
}) => {
  const { connected, connecting, publicKey, wallet } = useWallet()
  const { connection } = useConnection()
  const { loading } = useStaking()
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'online' | 'offline' | 'slow'>('checking')
  const [lastPing, setLastPing] = useState<number>(0)

  // Network status monitoring
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const start = Date.now()
        await connection.getLatestBlockhash('finalized')
        const ping = Date.now() - start
        
        setLastPing(ping)
        
        if (ping > 2000) {
          setNetworkStatus('slow')
        } else {
          setNetworkStatus('online')
        }
      } catch (error) {
        setNetworkStatus('offline')
        console.error('Network check failed:', error)
      }
    }

    checkNetworkStatus()
    const interval = setInterval(checkNetworkStatus, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [connection])

  const getWalletStatus = () => {
    if (connecting) return { status: 'connecting', text: 'Connecting...', color: 'yellow' }
    if (!connected) return { status: 'disconnected', text: 'Not Connected', color: 'red' }
    if (loading) return { status: 'processing', text: 'Processing...', color: 'blue' }
    return { status: 'connected', text: 'Connected', color: 'green' }
  }

  const getNetworkStatus = () => {
    switch (networkStatus) {
      case 'checking':
        return { text: 'Checking...', color: 'gray', ping: null }
      case 'online':
        return { text: 'Online', color: 'green', ping: lastPing }
      case 'slow':
        return { text: 'Slow Connection', color: 'yellow', ping: lastPing }
      case 'offline':
        return { text: 'Offline', color: 'red', ping: null }
      default:
        return { text: 'Unknown', color: 'gray', ping: null }
    }
  }

  const walletStatus = getWalletStatus()
  const networkStatusInfo = getNetworkStatus()

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {/* Wallet Status Indicator */}
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full bg-${walletStatus.color}-500`} />
          <span className="text-xs text-gray-600">{walletStatus.text}</span>
        </div>
        
        {/* Network Status Indicator */}
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full bg-${networkStatusInfo.color}-500`} />
          <span className="text-xs text-gray-600">{networkStatusInfo.text}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-medium text-gray-900 mb-3">Connection Status</h3>
      
      <div className="space-y-3">
        {/* Wallet Connection */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full bg-${walletStatus.color}-500`} />
            <span className="text-sm text-gray-700">Wallet</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {walletStatus.text}
            </div>
            {wallet && (
              <div className="text-xs text-gray-500">
                {wallet.adapter.name}
              </div>
            )}
          </div>
        </div>

        {/* Public Key */}
        {publicKey && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Address</span>
            <div className="text-right">
              <div className="text-sm font-mono text-gray-900">
                {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(publicKey.toString())}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Network Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full bg-${networkStatusInfo.color}-500`} />
            <span className="text-sm text-gray-700">Network</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {networkStatusInfo.text}
            </div>
            {networkStatusInfo.ping && (
              <div className="text-xs text-gray-500">
                {networkStatusInfo.ping}ms latency
              </div>
            )}
          </div>
        </div>

        {showDetails && (
          <>
            {/* RPC Endpoint */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">RPC Endpoint</span>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {new URL(connection.rpcEndpoint).hostname}
                </div>
                <div className="text-xs text-gray-500">
                  {connection.commitment}
                </div>
              </div>
            </div>

            {/* Cluster */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Cluster</span>
              <div className="text-sm font-medium text-gray-900">
                {connection.rpcEndpoint.includes('devnet') ? 'Devnet' :
                 connection.rpcEndpoint.includes('testnet') ? 'Testnet' :
                 connection.rpcEndpoint.includes('mainnet') ? 'Mainnet' : 'Custom'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Status Messages */}
      {walletStatus.status === 'disconnected' && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          Connect your wallet to start using the application
        </div>
      )}
      
      {networkStatus === 'offline' && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
          Network connection lost. Please check your internet connection.
        </div>
      )}
      
      {networkStatus === 'slow' && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          Slow network connection detected. Transactions may take longer than usual.
        </div>
      )}
    </div>
  )
}

export default ConnectionStatus