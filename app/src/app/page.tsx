'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Header } from '@/components/Header'
import { StakingDashboard } from '@/components/StakingDashboard'
import { NFTGrid } from '@/components/NFTGrid'

export default function Home() {
  const { connected } = useWallet()

  return (
    <main className="min-h-screen">
      <Header />
      
      {!connected ? (
        <div className="container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-transparent mb-8">
              NFT Staking Vault
            </h1>
            <p className="text-xl text-gray-300 mb-12 leading-relaxed">
              Stake your Solana NFTs from eligible collections and earn continuous rewards. 
              Connect your wallet to get started and maximize your NFT utility.
            </p>
            <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-8 mb-12">
              <h2 className="text-2xl font-semibold mb-6">How it works</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-solana-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🔗</span>
                  </div>
                  <h3 className="font-semibold mb-2">Connect Wallet</h3>
                  <p className="text-gray-400">Connect your Solana wallet to view your eligible NFTs</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-solana-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <h3 className="font-semibold mb-2">Stake NFTs</h3>
                  <p className="text-gray-400">Lock your NFTs in our secure vault to start earning</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-solana-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">💰</span>
                  </div>
                  <h3 className="font-semibold mb-2">Earn Rewards</h3>
                  <p className="text-gray-400">Receive continuous token rewards for your staked NFTs</p>
                </div>
              </div>
            </div>
            <WalletMultiButton className="!bg-gradient-to-r !from-solana-purple !to-solana-green !text-white !font-semibold !py-4 !px-8 !rounded-xl !text-lg hover:!scale-105 !transition-transform" />
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <StakingDashboard />
            </div>
            <div className="lg:col-span-2">
              <NFTGrid />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}