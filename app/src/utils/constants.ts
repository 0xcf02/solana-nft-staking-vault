import { PublicKey } from '@solana/web3.js'

export const PROGRAM_CONFIG = {
  // Replace with your actual program ID after deployment
  PROGRAM_ID: 'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1',
  
  // Replace with your actual reward token mint
  REWARD_TOKEN_MINT: '11111111111111111111111111111111',
  
  // Replace with your actual collection mint
  COLLECTION_MINT: '11111111111111111111111111111111',
  
  // Network configuration
  NETWORK: 'devnet' as const,
  
  // Reward configuration
  DEFAULT_REWARD_RATE: 1000000, // 1 token per second (6 decimals)
  
  // Token decimals
  REWARD_TOKEN_DECIMALS: 6,
  NFT_TOKEN_DECIMALS: 0,
}

export const UI_CONFIG = {
  // App metadata
  APP_NAME: 'NFT Staking Vault',
  APP_DESCRIPTION: 'Stake your Solana NFTs and earn rewards',
  
  // Colors (Tailwind classes)
  COLORS: {
    PRIMARY: 'solana-purple',
    SECONDARY: 'solana-green',
    BACKGROUND: 'solana-dark',
  },
  
  // Animation durations
  ANIMATION_DURATION: 200,
  
  // Polling intervals (ms)
  BALANCE_REFRESH_INTERVAL: 10000,
  REWARDS_REFRESH_INTERVAL: 1000,
}

export const TOAST_CONFIG = {
  SUCCESS_DURATION: 4000,
  ERROR_DURATION: 6000,
  LOADING_DURATION: 0, // Infinite
}

export const API_ENDPOINTS = {
  // Metadata services
  HELIUS_RPC: 'https://devnet.helius-rpc.com/?api-key=your-api-key',
  QUICKNODE_RPC: 'https://your-quicknode-endpoint.solana-devnet.discover.quiknode.pro/',
  
  // IPFS gateways for metadata
  IPFS_GATEWAYS: [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
  ],
}