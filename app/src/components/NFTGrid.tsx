'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useNFTs } from '@/hooks/useNFTs'
import { useStaking } from '@/hooks/useStaking'
import toast from 'react-hot-toast'
import { NFTCard } from './NFTCard'

export function NFTGrid() {
  const { publicKey } = useWallet()
  const { nfts, stakedNfts, loading: nftsLoading } = useNFTs()
  const { stakeNft, unstakeNft, loading: stakingLoading } = useStaking()

  const handleStake = async (nftMint: string) => {
    if (!publicKey) return

    try {
      await stakeNft(nftMint)
      toast.success('NFT staked successfully!')
    } catch (error) {
      console.error('Error staking NFT:', error)
      toast.error('Failed to stake NFT')
    }
  }

  const handleUnstake = async (nftMint: string) => {
    if (!publicKey) return

    try {
      await unstakeNft(nftMint)
      toast.success('NFT unstaked successfully!')
    } catch (error) {
      console.error('Error unstaking NFT:', error)
      toast.error('Failed to unstake NFT')
    }
  }

  if (nftsLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-6">
        <h2 className="text-2xl font-semibold mb-6">Your NFTs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-700/50 rounded-xl p-4 animate-pulse">
              <div className="aspect-square bg-gray-600 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-600 rounded mb-2"></div>
              <div className="h-3 bg-gray-600 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Available NFTs */}
      <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-6">
        <h2 className="text-2xl font-semibold mb-6">Available NFTs</h2>
        {nfts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎨</div>
            <p className="text-gray-400 mb-2">No eligible NFTs found</p>
            <p className="text-sm text-gray-500">
              Make sure you own NFTs from the supported collection
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nfts.map((nft) => (
              <NFTCard
                key={nft.mint}
                nft={nft}
                onStake={() => handleStake(nft.mint)}
                loading={stakingLoading}
                actionType="stake"
              />
            ))}
          </div>
        )}
      </div>

      {/* Staked NFTs */}
      {stakedNfts.length > 0 && (
        <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-6">
          <h2 className="text-2xl font-semibold mb-6">Staked NFTs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stakedNfts.map((nft) => (
              <NFTCard
                key={nft.mint}
                nft={nft}
                onStake={() => handleUnstake(nft.mint)}
                loading={stakingLoading}
                actionType="unstake"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}