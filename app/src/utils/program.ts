import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor'
import { WalletContextState } from '@solana/wallet-adapter-react'

// Program configuration
export const PROGRAM_ID = new PublicKey('DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1')
export const DEVNET_RPC = clusterApiUrl('devnet')

// PDA seeds
export const VAULT_SEED = 'vault'
export const USER_STAKE_SEED = 'user_stake'

export function getVaultPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED)],
    PROGRAM_ID
  )
}

export function getUserStakePDA(userPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(USER_STAKE_SEED), userPubkey.toBuffer()],
    PROGRAM_ID
  )
}

export function createAnchorProvider(
  connection: Connection,
  wallet: WalletContextState
): AnchorProvider | null {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    return null
  }

  return new AnchorProvider(
    connection,
    {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
    },
    { commitment: 'confirmed' }
  )
}

// Helper function to create program instance
export function createProgram(provider: AnchorProvider, idl: Idl) {
  return new Program(idl, PROGRAM_ID, provider)
}

// Constants
export const REWARD_TOKEN_DECIMALS = 6
export const NFT_DECIMALS = 0

// Collection configuration - replace with your actual collection mint
export const COLLECTION_MINT = new PublicKey('11111111111111111111111111111111')

// Utility functions
export function formatTokenAmount(amount: number | string, decimals: number = REWARD_TOKEN_DECIMALS): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount
  return (value / Math.pow(10, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

export function parseTokenAmount(amount: number, decimals: number = REWARD_TOKEN_DECIMALS): number {
  return amount * Math.pow(10, decimals)
}