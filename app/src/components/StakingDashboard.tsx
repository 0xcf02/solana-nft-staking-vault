'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useStaking } from '@/hooks/useStaking'
import toast from 'react-hot-toast'

export function StakingDashboard() {
  const { publicKey } = useWallet()
  const { userStakeData, vaultData, claimRewards, loading } = useStaking()

  const handleClaimRewards = async () => {
    if (!publicKey) return

    try {
      await claimRewards()
      toast.success('Rewards claimed successfully!')
    } catch (error) {
      console.error('Error claiming rewards:', error)
      toast.error('Failed to claim rewards')
    }
  }

  const pendingRewards = userStakeData?.pendingRewards || 0
  const stakedNfts = userStakeData?.stakedNfts || 0
  const rewardRate = vaultData?.rewardRatePerSecond || 0

  // Calculate estimated daily rewards
  const dailyRewards = (rewardRate * stakedNfts * 86400) / Math.pow(10, 6) // Assuming 6 decimals

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Staking Dashboard</h2>
        <p className="text-gray-400">Track your staking performance</p>
      </div>

      <div className="space-y-4">
        <div className="bg-gradient-to-r from-solana-purple/10 to-solana-green/10 border border-solana-purple/20 rounded-xl p-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-solana-green">
              {(pendingRewards / Math.pow(10, 6)).toFixed(6)}
            </div>
            <div className="text-sm text-gray-400 mt-1">Pending Rewards</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900/50 border border-gray-600 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stakedNfts}</div>
            <div className="text-xs text-gray-400">Staked NFTs</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-600 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{dailyRewards.toFixed(2)}</div>
            <div className="text-xs text-gray-400">Daily Rewards</div>
          </div>
        </div>

        <button
          onClick={handleClaimRewards}
          disabled={loading || pendingRewards === 0}
          className="w-full bg-gradient-to-r from-solana-purple to-solana-green text-white font-semibold py-3 px-6 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? 'Claiming...' : 'Claim Rewards'}
        </button>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <h3 className="font-semibold mb-2">Vault Statistics</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex justify-between">
            <span>Total NFTs Staked:</span>
            <span className="text-white font-semibold">{vaultData?.totalStaked || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Reward Rate:</span>
            <span className="text-white font-semibold">
              {(rewardRate / Math.pow(10, 6)).toFixed(6)}/sec
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}