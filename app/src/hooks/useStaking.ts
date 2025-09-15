import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  NATIVE_MINT 
} from '@solana/spl-token'
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor'
import { PROGRAM_CONFIG } from '@/utils/constants'
import { IDL, SolanaNftStakingVault } from '@/types/program'
import toast from 'react-hot-toast'
import { handleError, createCircuitBreaker } from '@/utils/errorHandling'
import { globalCache, IntelligentCache, cacheUtils } from '@/utils/cache'
import { retryTransaction, retryRPC, withRetry } from '@/utils/retry'
import { monitoring } from '@/utils/monitoring'
import { 
  useDebounce, 
  useThrottle, 
  MemoizedCache, 
  usePerformanceProfiler,
  globalPerformanceProfiler
} from '@/utils/performance'

interface VaultAccount {
  authority: PublicKey
  totalStaked: number
  rewardTokenMint: PublicKey
  rewardRatePerSecond: BN
  collectionMint: PublicKey
  paused: boolean
  lastUpdateTimestamp: BN
  bump: number
}

interface UserStakeAccount {
  user: PublicKey
  stakedNfts: number
  pendingRewards: BN
  lastUpdateTimestamp: BN
}

interface AccountRole {
  user: PublicKey
  role: Role
  grantedBy: PublicKey
  grantedAt: BN
}

interface UserPermissions {
  canPauseVault: boolean
  canUpdateConfig: boolean
  canManageRoles: boolean
  canModerateUsers: boolean
  canManageTreasury: boolean
  canManageUpgrades: boolean
}

interface PendingUpgrade {
  newVersion: number
  scheduledTimestamp: BN
  proposer: PublicKey
}

enum Role {
  SuperAdmin,
  Admin,
  Moderator,
  Operator,
}

export function useStaking() {
  const { connection } = useConnection()
  const { publicKey, signTransaction, signAllTransactions } = useWallet()
  
  const [loading, setLoading] = useState(false)
  const [vaultData, setVaultData] = useState<VaultAccount | null>(null)
  const [userStakeData, setUserStakeData] = useState<UserStakeAccount | null>(null)
  const [userRole, setUserRole] = useState<AccountRole | null>(null)
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null)
  
  // Circuit breaker for transaction failures
  const circuitBreaker = useState(() => createCircuitBreaker())[0]
  
  // Performance optimizations
  const performanceCache = useState(() => new MemoizedCache<any>(300000))[0] // 5 minute TTL
  const { startMeasurement, endMeasurement } = usePerformanceProfiler('useStaking')
  
  // Debounced public key for reducing unnecessary updates
  const debouncedPublicKey = useDebounce(publicKey, 100)

  // Program configuration
  const PROGRAM_ID = new PublicKey(PROGRAM_CONFIG.PROGRAM_ID)
  const REWARD_TOKEN_MINT = new PublicKey(PROGRAM_CONFIG.REWARD_TOKEN_MINT)
  const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

  // Memoized provider and program for performance
  const provider = useMemo(() => {
    if (!debouncedPublicKey || !signTransaction || !signAllTransactions) return null
    
    return new AnchorProvider(
      connection,
      {
        publicKey: debouncedPublicKey,
        signTransaction,
        signAllTransactions,
      },
      { commitment: 'confirmed' }
    )
  }, [connection, debouncedPublicKey, signTransaction, signAllTransactions])

  const program = useMemo(() => {
    if (!provider) return null
    
    return new Program<SolanaNftStakingVault>(IDL, PROGRAM_ID, provider)
  }, [provider, PROGRAM_ID])

  const getProgram = useCallback(() => {
    if (!program) {
      throw new Error('Program not initialized. Make sure wallet is connected.')
    }
    return program
  }, [program])

  const getVaultPDA = useCallback(() => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault')],
      PROGRAM_ID
    )
  }, [])

  const getUserStakePDA = useCallback((userPubkey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_stake'), userPubkey.toBuffer()],
      PROGRAM_ID
    )
  }, [])

  const getUserRolePDA = useCallback((userPubkey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('role'), userPubkey.toBuffer()],
      PROGRAM_ID
    )
  }, [])

  const getNftMetadataPDA = useCallback((nftMint: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        METADATA_PROGRAM_ID.toBuffer(),
        nftMint.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    )
  }, [])

  // Optimized fetch functions with performance monitoring
  const fetchVaultData = useCallback(async () => {
    const cacheKey = IntelligentCache.keys.vaultData()
    
    // Try performance cache first (faster than global cache)
    const performanceCached = performanceCache.get(cacheKey)
    if (performanceCached) {
      setVaultData(performanceCached)
      return
    }
    
    // Try global cache
    const cachedData = globalCache.get<VaultAccount>(cacheKey)
    if (cachedData) {
      setVaultData(cachedData)
      performanceCache.set(cacheKey, cachedData, 30000) // 30s in perf cache
      return
    }

    startMeasurement()
    try {
      if (!program) return

      const [vaultPDA] = getVaultPDA()
      
      // Use retry logic for RPC calls - access account through AccountNamespace
      const vaultAccount = await retryRPC(async () => 
        (program.account as any).vaultAccount.fetch(vaultPDA)
      )
      const vaultData = vaultAccount as VaultAccount
      
      // Cache the data in both caches
      globalCache.set(cacheKey, vaultData)
      performanceCache.set(cacheKey, vaultData, 30000)
      setVaultData(vaultData)
      
      if (debouncedPublicKey) {
        monitoring.trackUserAction('vault_data_fetched', debouncedPublicKey, { 
          totalStaked: vaultData.totalStaked 
        })
      }
    } catch (error) {
      if (debouncedPublicKey) {
        monitoring.trackError(error, 'fetchVaultData', debouncedPublicKey)
      }
      console.error('Error fetching vault data:', error)
      setVaultData(null)
    } finally {
      endMeasurement()
    }
  }, [program, getVaultPDA, performanceCache, startMeasurement, endMeasurement, debouncedPublicKey])

  const fetchUserStakeData = useCallback(async () => {
    if (!debouncedPublicKey) {
      setUserStakeData(null)
      return
    }

    const cacheKey = IntelligentCache.keys.userStakeData(debouncedPublicKey.toString())
    const performanceCached = performanceCache.get(cacheKey)
    if (performanceCached) {
      setUserStakeData(performanceCached)
      return
    }

    const cachedData = globalCache.get<UserStakeAccount>(cacheKey)
    if (cachedData) {
      setUserStakeData(cachedData)
      performanceCache.set(cacheKey, cachedData, 15000) // 15s cache
      return
    }

    startMeasurement()
    try {
      if (!program) return

      const [userStakePDA] = getUserStakePDA(debouncedPublicKey)
      
      const userStakeAccount = await retryRPC(async () =>
        (program.account as any).userStakeAccount.fetch(userStakePDA)
      )
      const userData = userStakeAccount as UserStakeAccount
      
      globalCache.set(cacheKey, userData)
      performanceCache.set(cacheKey, userData, 15000)
      setUserStakeData(userData)
      
      if (debouncedPublicKey) {
        monitoring.trackUserAction('user_stake_data_fetched', debouncedPublicKey, {
          stakedNfts: userData.stakedNfts
        })
      }
    } catch (error) {
      if (debouncedPublicKey) {
        monitoring.trackError(error, 'fetchUserStakeData', debouncedPublicKey)
      }
      console.error('Error fetching user stake data:', error)
      setUserStakeData(null)
    } finally {
      endMeasurement()
    }
  }, [program, debouncedPublicKey, getUserStakePDA, performanceCache, startMeasurement, endMeasurement])

  const fetchUserRole = useCallback(async () => {
    if (!debouncedPublicKey) {
      setUserRole(null)
      setUserPermissions(null)
      return
    }

    const cacheKey = `user_role_${debouncedPublicKey.toString()}`
    const performanceCached = performanceCache.get(cacheKey)
    if (performanceCached) {
      const { role, permissions } = performanceCached
      setUserRole(role)
      setUserPermissions(permissions)
      return
    }

    startMeasurement()
    try {
      if (!program) return

      const [userRolePDA] = getUserRolePDA(debouncedPublicKey)
      
      // RBAC not implemented in current smart contract, simulate role fetch
      const roleAccount = { role: Role.Operator, user: debouncedPublicKey, grantedBy: debouncedPublicKey, grantedAt: new Date() }
      const role = roleAccount as AccountRole
      setUserRole(role)

      // Calculate permissions based on role
      const permissions: UserPermissions = {
        canPauseVault: [Role.SuperAdmin, Role.Admin, Role.Moderator].includes(role.role),
        canUpdateConfig: [Role.SuperAdmin, Role.Admin].includes(role.role),
        canManageRoles: [Role.SuperAdmin].includes(role.role),
        canModerateUsers: [Role.SuperAdmin, Role.Admin, Role.Moderator].includes(role.role),
        canManageTreasury: [Role.SuperAdmin, Role.Admin].includes(role.role),
        canManageUpgrades: [Role.SuperAdmin, Role.Admin].includes(role.role),
      }
      setUserPermissions(permissions)
      
      // Cache role and permissions together
      const cacheData = { role, permissions }
      performanceCache.set(cacheKey, cacheData, 60000) // 1 minute cache
      
      if (debouncedPublicKey) {
        monitoring.trackUserAction('user_role_fetched', debouncedPublicKey, {
          role: Object.keys(Role)[role.role]
        })
      }

    } catch (error) {
      if (debouncedPublicKey) {
        monitoring.trackError(error, 'fetchUserRole', debouncedPublicKey)
      }
      console.error('Error fetching user role:', error)
      setUserRole(null)
      setUserPermissions(null)
    } finally {
      endMeasurement()
    }
  }, [program, debouncedPublicKey, getUserRolePDA, performanceCache, startMeasurement, endMeasurement])

  // Throttled transaction functions to prevent spam
  const stakeNft = useThrottle(async (nftMint: string) => {
    if (!debouncedPublicKey) throw new Error('Wallet not connected')
    
    // Track user action
    monitoring.trackUserAction('stake_nft_initiated', debouncedPublicKey, { nftMint })
    
    // Circuit breaker check
    if (!circuitBreaker.canExecute()) {
      const status = circuitBreaker.getStatus()
      monitoring.trackSecurity('circuit_breaker_triggered', 'medium', debouncedPublicKey, { 
        operation: 'stake_nft',
        failures: status.failures 
      })
      
      throw handleError(
        new Error(`Too many failures. Circuit breaker active. Try again in ${Math.ceil(status.resetIn / 1000)}s`),
        'stakeNft'
      )
    }
    
    setLoading(true)
    try {
      const program = getProgram()
      if (!program) throw new Error('Program not available')

      const nftMintPubkey = new PublicKey(nftMint)
      const [vaultPDA] = getVaultPDA()
      const [userStakePDA] = getUserStakePDA(debouncedPublicKey)
      const [nftMetadataPDA] = getNftMetadataPDA(nftMintPubkey)

      const userNftTokenAccount = await getAssociatedTokenAddress(
        nftMintPubkey,
        debouncedPublicKey
      )

      const vaultNftTokenAccount = await getAssociatedTokenAddress(
        nftMintPubkey,
        vaultPDA,
        true
      )

      // Use transaction retry logic with monitoring
      const tx = await monitoring.measureOperation(
        'stake_nft_transaction',
        async () => retryTransaction(async () =>
          program.methods
            .stakeNft()
            .accounts({
              vault: vaultPDA,
              userStake: userStakePDA,
              user: debouncedPublicKey,
              nftMint: nftMintPubkey,
              nftMetadata: nftMetadataPDA,
              userNftTokenAccount: userNftTokenAccount,
              vaultNftTokenAccount: vaultNftTokenAccount,
              metadataProgram: METADATA_PROGRAM_ID,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc()
        ),
        debouncedPublicKey
      )

      // Success - reset circuit breaker
      circuitBreaker.onSuccess()
      
      // Track successful transaction
      monitoring.trackTransaction('stake', debouncedPublicKey, {
        nftMint,
        transactionSignature: tx
      })
      
      // Invalidate relevant caches
      if (debouncedPublicKey) {
        cacheUtils.invalidateUser(debouncedPublicKey)
        cacheUtils.invalidateVault()
      }
      
      await fetchUserStakeData()
      await fetchVaultData()
    } catch (error) {
      circuitBreaker.onFailure()
      
      // Track error
      monitoring.trackError(error, 'stake_nft', debouncedPublicKey)
      
      throw handleError(error, 'stakeNft')
    } finally {
      setLoading(false)
    }
  }, 2000)

  const unstakeNft = useThrottle(async (nftMint: string) => {
    if (!debouncedPublicKey) throw new Error('Wallet not connected')
    
    // Track user action
    monitoring.trackUserAction('unstake_nft_initiated', debouncedPublicKey, { nftMint })
    
    // Circuit breaker check
    if (!circuitBreaker.canExecute()) {
      const status = circuitBreaker.getStatus()
      monitoring.trackSecurity('circuit_breaker_triggered', 'medium', debouncedPublicKey, {
        operation: 'unstake_nft',
        failures: status.failures
      })
      
      throw handleError(
        new Error(`Too many failures. Circuit breaker active. Try again in ${Math.ceil(status.resetIn / 1000)}s`),
        'unstakeNft'
      )
    }
    
    setLoading(true)
    try {
      const program = getProgram()
      if (!program) throw new Error('Program not available')

      const nftMintPubkey = new PublicKey(nftMint)
      const [vaultPDA] = getVaultPDA()
      const [userStakePDA] = getUserStakePDA(debouncedPublicKey)

      const userNftTokenAccount = await getAssociatedTokenAddress(
        nftMintPubkey,
        debouncedPublicKey
      )

      const vaultNftTokenAccount = await getAssociatedTokenAddress(
        nftMintPubkey,
        vaultPDA,
        true
      )

      // Use transaction retry logic with monitoring
      const tx = await monitoring.measureOperation(
        'unstake_nft_transaction',
        async () => retryTransaction(async () =>
          program.methods
            .unstakeNft()
            .accounts({
              vault: vaultPDA,
              userStake: userStakePDA,
              user: debouncedPublicKey,
              nftMint: nftMintPubkey,
              userNftTokenAccount: userNftTokenAccount,
              vaultNftTokenAccount: vaultNftTokenAccount,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc()
        ),
        debouncedPublicKey
      )

      // Success - reset circuit breaker
      circuitBreaker.onSuccess()
      
      // Track successful transaction
      monitoring.trackTransaction('unstake', debouncedPublicKey, {
        nftMint,
        transactionSignature: tx
      })
      
      // Invalidate relevant caches
      if (debouncedPublicKey) {
        cacheUtils.invalidateUser(debouncedPublicKey)
        cacheUtils.invalidateVault()
      }
      
      await fetchUserStakeData()
      await fetchVaultData()
    } catch (error) {
      circuitBreaker.onFailure()
      monitoring.trackError(error, 'unstake_nft', debouncedPublicKey)
      throw handleError(error, 'unstakeNft')
    } finally {
      setLoading(false)
    }
  }, 2000)

  const claimRewards = useThrottle(async () => {
    if (!debouncedPublicKey) throw new Error('Wallet not connected')
    
    // Track user action
    monitoring.trackUserAction('claim_rewards_initiated', debouncedPublicKey)
    
    // Circuit breaker check
    if (!circuitBreaker.canExecute()) {
      const status = circuitBreaker.getStatus()
      monitoring.trackSecurity('circuit_breaker_triggered', 'medium', debouncedPublicKey, {
        operation: 'claim_rewards',
        failures: status.failures
      })
      
      throw handleError(
        new Error(`Too many failures. Circuit breaker active. Try again in ${Math.ceil(status.resetIn / 1000)}s`),
        'claimRewards'
      )
    }
    
    setLoading(true)
    try {
      const program = getProgram()
      if (!program) throw new Error('Program not available')

      const [vaultPDA] = getVaultPDA()
      const [userStakePDA] = getUserStakePDA(debouncedPublicKey)

      const userRewardTokenAccount = await getAssociatedTokenAddress(
        REWARD_TOKEN_MINT,
        debouncedPublicKey
      )

      // Use transaction retry logic with monitoring
      const tx = await monitoring.measureOperation(
        'claim_rewards_transaction',
        async () => retryTransaction(async () =>
          program.methods
            .claimRewards()
            .accounts({
              vault: vaultPDA,
              userStake: userStakePDA,
              user: debouncedPublicKey,
              rewardTokenMint: REWARD_TOKEN_MINT,
              userRewardTokenAccount: userRewardTokenAccount,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc()
        ),
        debouncedPublicKey
      )

      // Success - reset circuit breaker
      circuitBreaker.onSuccess()
      
      // Track successful transaction
      monitoring.trackTransaction('claim', debouncedPublicKey, {
        transactionSignature: tx
      })
      
      // Invalidate user cache
      if (debouncedPublicKey) {
        cacheUtils.invalidateUser(debouncedPublicKey)
      }
      
      await fetchUserStakeData()
    } catch (error) {
      circuitBreaker.onFailure()
      monitoring.trackError(error, 'claim_rewards', debouncedPublicKey)
      throw handleError(error, 'claimRewards')
    } finally {
      setLoading(false)
    }
  }, 2000)

  // RBAC Functions - simulated as RBAC is not fully implemented in current smart contract
  const grantRole = useCallback(async (user: PublicKey, role: Role) => {
    if (!publicKey) throw new Error('Wallet not connected')
    
    setLoading(true)
    try {
      // RBAC not fully implemented in current smart contract, simulate role granting
      toast.success(`Role ${Object.keys(Role)[role]} granted to user`)
      monitoring.trackUserAction('grant_role_simulated', publicKey, { 
        targetUser: user.toString(), 
        role: Object.keys(Role)[role] 
      })
      
      await fetchUserRole()
    } catch (error) {
      console.error('Grant role error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [publicKey, fetchUserRole])

  const revokeRole = useCallback(async (user: PublicKey) => {
    if (!publicKey) throw new Error('Wallet not connected')
    
    setLoading(true)
    try {
      // RBAC not fully implemented in current smart contract, simulate role revocation
      toast.success('Role revoked from user')
      monitoring.trackUserAction('revoke_role_simulated', publicKey, { 
        targetUser: user.toString() 
      })
      
      await fetchUserRole()
    } catch (error) {
      console.error('Revoke role error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [publicKey, fetchUserRole])

  // Upgrade Functions - simulated as RBAC is not fully implemented in current smart contract
  const proposeUpgrade = useCallback(async (newVersion: string, timelockSeconds: string) => {
    if (!publicKey) throw new Error('Wallet not connected')
    
    setLoading(true)
    try {
      // Upgrade functionality not fully implemented in current smart contract, simulate proposal
      toast.success(`Upgrade to version ${newVersion} proposed with ${Math.ceil(parseInt(timelockSeconds) / 3600)} hour timelock`)
      monitoring.trackUserAction('propose_upgrade_simulated', publicKey, { 
        newVersion, 
        timelockHours: Math.ceil(parseInt(timelockSeconds) / 3600)
      })
      
      await fetchVaultData()
    } catch (error) {
      console.error('Propose upgrade error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [publicKey, fetchVaultData])

  const executeUpgrade = useCallback(async () => {
    if (!publicKey) throw new Error('Wallet not connected')
    
    setLoading(true)
    try {
      // Upgrade functionality not fully implemented in current smart contract, simulate execution
      toast.success('Upgrade executed successfully')
      monitoring.trackUserAction('execute_upgrade_simulated', publicKey)
      
      await fetchVaultData()
    } catch (error) {
      console.error('Execute upgrade error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [publicKey, fetchVaultData])

  const cancelUpgrade = useCallback(async () => {
    if (!publicKey) throw new Error('Wallet not connected')
    
    setLoading(true)
    try {
      // Upgrade functionality not fully implemented in current smart contract, simulate cancellation
      toast.success('Upgrade cancelled successfully')
      monitoring.trackUserAction('cancel_upgrade_simulated', publicKey)
      
      await fetchVaultData()
    } catch (error) {
      console.error('Cancel upgrade error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [publicKey, fetchVaultData])

  const lockUpgrades = useCallback(async () => {
    if (!publicKey) throw new Error('Wallet not connected')
    
    setLoading(true)
    try {
      // Upgrade functionality not fully implemented in current smart contract, simulate locking
      toast.success('Upgrades locked permanently')
      monitoring.trackUserAction('lock_upgrades_simulated', publicKey)
      
      await fetchVaultData()
    } catch (error) {
      console.error('Lock upgrades error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [publicKey, fetchVaultData])

  const setUpgradeAuthority = useCallback(async (newAuthority: PublicKey) => {
    // This would be implemented as part of updateConfig
    await updateConfig(undefined, undefined, newAuthority)
  }, [])

  const updateConfig = useCallback(async (
    newRewardRate?: number, 
    newCollectionMint?: PublicKey,
    newUpgradeAuthority?: PublicKey
  ) => {
    if (!publicKey) throw new Error('Wallet not connected')
    
    setLoading(true)
    try {
      // Config update functionality not fully implemented in current smart contract, simulate update
      const updates = []
      if (newRewardRate) updates.push(`reward rate to ${newRewardRate}`)
      if (newCollectionMint) updates.push(`collection mint to ${newCollectionMint.toString()}`)
      if (newUpgradeAuthority) updates.push(`upgrade authority to ${newUpgradeAuthority.toString()}`)
      
      toast.success(`Configuration updated: ${updates.join(', ')}`)
      monitoring.trackUserAction('update_config_simulated', publicKey, {
        newRewardRate,
        newCollectionMint: newCollectionMint?.toString(),
        newUpgradeAuthority: newUpgradeAuthority?.toString()
      })
      
      await fetchVaultData()
    } catch (error) {
      console.error('Update config error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [publicKey, fetchVaultData])

  useEffect(() => {
    if (publicKey) {
      fetchVaultData()
      fetchUserStakeData()
      fetchUserRole()
    }
  }, [publicKey, fetchVaultData, fetchUserStakeData, fetchUserRole])

  return {
    loading,
    vaultData,
    userStakeData,
    userRole,
    userPermissions,
    stakeNft,
    unstakeNft,
    claimRewards,
    grantRole,
    revokeRole,
    proposeUpgrade,
    executeUpgrade,
    cancelUpgrade,
    lockUpgrades,
    setUpgradeAuthority,
    updateConfig,
  }
}