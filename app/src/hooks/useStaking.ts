import { useState, useEffect, useCallback } from 'react'
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

export function useStaking() {
  const { connection } = useConnection()
  const { publicKey, signTransaction, signAllTransactions } = useWallet()
  
  const [loading, setLoading] = useState(false)
  const [vaultData, setVaultData] = useState<VaultAccount | null>(null)
  const [userStakeData, setUserStakeData] = useState<UserStakeAccount | null>(null)

  // Program configuration
  const PROGRAM_ID = new PublicKey(PROGRAM_CONFIG.PROGRAM_ID)
  const REWARD_TOKEN_MINT = new PublicKey(PROGRAM_CONFIG.REWARD_TOKEN_MINT)
  const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

  const getProvider = useCallback(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null
    
    return new AnchorProvider(
      connection,
      {
        publicKey,
        signTransaction,
        signAllTransactions,
      },
      { commitment: 'confirmed' }
    )
  }, [connection, publicKey, signTransaction, signAllTransactions])

  const getProgram = useCallback(() => {
    const provider = getProvider()
    if (!provider) return null
    
    return new Program<SolanaNftStakingVault>(IDL, PROGRAM_ID, provider)
  }, [getProvider])

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

  const fetchVaultData = useCallback(async () => {
    try {
      const program = getProgram()
      if (!program) return

      const [vaultPDA] = getVaultPDA()
      
      const vaultAccount = await program.account.vaultAccount.fetch(vaultPDA)
      setVaultData(vaultAccount as VaultAccount)
    } catch (error) {
      console.error('Error fetching vault data:', error)
      setVaultData(null)
    }
  }, [getProgram, getVaultPDA])

  const fetchUserStakeData = useCallback(async () => {
    if (!publicKey) {
      setUserStakeData(null)
      return
    }

    try {
      const program = getProgram()
      if (!program) return

      const [userStakePDA] = getUserStakePDA(publicKey)
      
      const userStakeAccount = await program.account.userStakeAccount.fetch(userStakePDA)
      setUserStakeData(userStakeAccount as UserStakeAccount)
    } catch (error) {
      console.error('Error fetching user stake data:', error)
      setUserStakeData(null)
    }
  }, [getProgram, publicKey, getUserStakePDA])

  const stakeNft = useCallback(async (nftMint: string) => {
    if (!publicKey) throw new Error('Wallet not connected')
    
    setLoading(true)
    try {
      const program = getProgram()
      if (!program) throw new Error('Program not available')

      const nftMintPubkey = new PublicKey(nftMint)
      const [vaultPDA] = getVaultPDA()
      const [userStakePDA] = getUserStakePDA(publicKey)
      const [nftMetadataPDA] = getNftMetadataPDA(nftMintPubkey)

      const userNftTokenAccount = await getAssociatedTokenAddress(
        nftMintPubkey,
        publicKey
      )

      const vaultNftTokenAccount = await getAssociatedTokenAddress(
        nftMintPubkey,
        vaultPDA,
        true
      )

      const tx = await program.methods
        .stakeNft()
        .accounts({
          vault: vaultPDA,
          userStake: userStakePDA,
          user: publicKey,
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

      console.log('NFT staked successfully! Signature:', tx)
      
      await fetchUserStakeData()
      await fetchVaultData()
    } catch (error) {
      console.error('Staking error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [publicKey, getProgram, getVaultPDA, getUserStakePDA, getNftMetadataPDA, fetchUserStakeData, fetchVaultData])

  const unstakeNft = useCallback(async (nftMint: string) => {
    if (!publicKey) throw new Error('Wallet not connected')
    
    setLoading(true)
    try {
      const program = getProgram()
      if (!program) throw new Error('Program not available')

      const nftMintPubkey = new PublicKey(nftMint)
      const [vaultPDA] = getVaultPDA()
      const [userStakePDA] = getUserStakePDA(publicKey)

      const userNftTokenAccount = await getAssociatedTokenAddress(
        nftMintPubkey,
        publicKey
      )

      const vaultNftTokenAccount = await getAssociatedTokenAddress(
        nftMintPubkey,
        vaultPDA,
        true
      )

      const tx = await program.methods
        .unstakeNft()
        .accounts({
          vault: vaultPDA,
          userStake: userStakePDA,
          user: publicKey,
          nftMint: nftMintPubkey,
          userNftTokenAccount: userNftTokenAccount,
          vaultNftTokenAccount: vaultNftTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()

      console.log('NFT unstaked successfully! Signature:', tx)
      
      await fetchUserStakeData()
      await fetchVaultData()
    } catch (error) {
      console.error('Unstaking error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [publicKey, getProgram, getVaultPDA, getUserStakePDA, fetchUserStakeData, fetchVaultData])

  const claimRewards = useCallback(async () => {
    if (!publicKey) throw new Error('Wallet not connected')
    
    setLoading(true)
    try {
      const program = getProgram()
      if (!program) throw new Error('Program not available')

      const [vaultPDA] = getVaultPDA()
      const [userStakePDA] = getUserStakePDA(publicKey)

      const userRewardTokenAccount = await getAssociatedTokenAddress(
        REWARD_TOKEN_MINT,
        publicKey
      )

      const tx = await program.methods
        .claimRewards()
        .accounts({
          vault: vaultPDA,
          userStake: userStakePDA,
          user: publicKey,
          rewardTokenMint: REWARD_TOKEN_MINT,
          userRewardTokenAccount: userRewardTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log('Rewards claimed successfully! Signature:', tx)
      
      await fetchUserStakeData()
    } catch (error) {
      console.error('Claim rewards error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [publicKey, getProgram, getVaultPDA, getUserStakePDA, fetchUserStakeData])

  useEffect(() => {
    if (publicKey) {
      fetchVaultData()
      fetchUserStakeData()
    }
  }, [publicKey, fetchVaultData, fetchUserStakeData])

  return {
    loading,
    vaultData,
    userStakeData,
    stakeNft,
    unstakeNft,
    claimRewards,
  }
}