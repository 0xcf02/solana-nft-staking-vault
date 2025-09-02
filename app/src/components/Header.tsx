'use client'

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'

export function Header() {
  const { connected } = useWallet()

  return (
    <header className="border-b border-gray-800 bg-black/20 backdrop-blur-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-transparent">
            NFT Staking Vault
          </h1>
          {connected && (
            <div className="hidden md:flex items-center space-x-6 text-sm text-gray-300">
              <span>Stake • Earn • Unstake</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <WalletMultiButton className="!bg-gradient-to-r !from-solana-purple !to-solana-green" />
        </div>
      </div>
    </header>
  )
}