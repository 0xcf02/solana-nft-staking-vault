'use client'

import { NFTMetadata } from '@/hooks/useNFTs'

interface NFTCardProps {
  nft: NFTMetadata
  onStake: () => void
  loading: boolean
  actionType: 'stake' | 'unstake'
}

export function NFTCard({ nft, onStake, loading, actionType }: NFTCardProps) {
  return (
    <div className="bg-gray-900/50 border border-gray-600 rounded-xl p-4 hover:border-solana-purple/50 transition-colors">
      <div className="aspect-square bg-gray-700 rounded-lg mb-4 overflow-hidden">
        {nft.image ? (
          <img
            src={nft.image}
            alt={nft.name || 'NFT'}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              target.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            🎨
          </div>
        )}
        <div className="hidden w-full h-full flex items-center justify-center text-4xl">
          🎨
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="font-semibold text-white truncate">
          {nft.name || 'Unknown NFT'}
        </h3>
        <p className="text-xs text-gray-400 truncate">
          {nft.mint}
        </p>
        
        {nft.description && (
          <p className="text-sm text-gray-300 line-clamp-2">
            {nft.description}
          </p>
        )}

        <button
          onClick={onStake}
          disabled={loading}
          className={`w-full py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${
            actionType === 'stake'
              ? 'bg-gradient-to-r from-solana-purple to-solana-green text-white hover:scale-105'
              : 'bg-red-500 hover:bg-red-600 text-white hover:scale-105'
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
        >
          {loading 
            ? (actionType === 'stake' ? 'Staking...' : 'Unstaking...')
            : (actionType === 'stake' ? 'Stake NFT' : 'Unstake NFT')
          }
        </button>

        {actionType === 'unstake' && (
          <div className="text-xs text-center text-solana-green">
            ✨ Earning rewards
          </div>
        )}
      </div>
    </div>
  )
}