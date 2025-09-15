'use client'

import React from 'react'
import { useStaking } from '@/hooks/useStaking'

const StakingInterface: React.FC = () => {
  const { 
    loading, 
    vaultData, 
    userStakeData, 
    stakeNft, 
    unstakeNft, 
    claimRewards 
  } = useStaking()

  if (loading) {
    return <div className="text-center p-4">Loading staking interface...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">NFT Staking Interface</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Vault Information</h2>
          {vaultData ? (
            <div className="space-y-2 text-sm text-gray-600">
              <p><span className="font-medium">Total Staked:</span> {vaultData.totalStaked} NFTs</p>
              <p><span className="font-medium">Status:</span> {vaultData.paused ? 'Paused' : 'Active'}</p>
              <p><span className="font-medium">Authority:</span> {vaultData.authority.toString().slice(0, 8)}...</p>
            </div>
          ) : (
            <p className="text-gray-500">No vault data available</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Your Stakes</h2>
          {userStakeData ? (
            <div className="space-y-2 text-sm text-gray-600">
              <p><span className="font-medium">Staked NFTs:</span> {userStakeData.stakedNfts}</p>
              <p><span className="font-medium">Pending Rewards:</span> {userStakeData.pendingRewards.toString()}</p>
            </div>
          ) : (
            <p className="text-gray-500">No stake data available</p>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-gray-600 mb-4">
          Connect your wallet and select NFTs to stake for rewards
        </p>
      </div>
    </div>
  )
}

export default StakingInterface