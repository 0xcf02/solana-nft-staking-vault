import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

export interface NFTMetadata {
  mint: string
  name: string | null
  image: string | null
  description: string | null
  attributes: Array<{
    trait_type: string
    value: string | number
  }> | null
}

export function useNFTs() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  
  const [loading, setLoading] = useState(false)
  const [nfts, setNfts] = useState<NFTMetadata[]>([])
  const [stakedNfts, setStakedNfts] = useState<NFTMetadata[]>([])

  const fetchMetadata = async (uri: string): Promise<any> => {
    try {
      const response = await fetch(uri)
      if (!response.ok) throw new Error('Failed to fetch metadata')
      return await response.json()
    } catch (error) {
      console.error('Error fetching metadata from URI:', uri, error)
      return null
    }
  }

  const fetchUserNFTs = useCallback(async () => {
    if (!publicKey) {
      setNfts([])
      return
    }

    setLoading(true)
    try {
      // Get all token accounts for the user
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      )

      const nftCandidates = tokenAccounts.value.filter(
        (account) => {
          const amount = account.account.data.parsed.info.tokenAmount.uiAmount
          const decimals = account.account.data.parsed.info.tokenAmount.decimals
          return amount === 1 && decimals === 0 // NFTs have 1 token with 0 decimals
        }
      )

      const nftPromises = nftCandidates.map(async (account) => {
        const mint = account.account.data.parsed.info.mint

        try {
          // In a real implementation, you would:
          // 1. Fetch the mint account to get metadata account address
          // 2. Fetch metadata from Metaplex
          // 3. Fetch off-chain metadata from the URI
          
          // For demo purposes, we'll create mock NFT data
          const mockMetadata: NFTMetadata = {
            mint,
            name: `Mock NFT #${mint.slice(-4)}`,
            image: `https://picsum.photos/400/400?random=${mint.slice(-4)}`,
            description: 'This is a mock NFT for demonstration purposes',
            attributes: [
              { trait_type: 'Rarity', value: 'Common' },
              { trait_type: 'Type', value: 'Demo' }
            ]
          }

          return mockMetadata
        } catch (error) {
          console.error('Error processing NFT:', mint, error)
          return null
        }
      })

      const results = await Promise.all(nftPromises)
      const validNFTs = results.filter((nft): nft is NFTMetadata => nft !== null)

      // Filter for collection NFTs (in a real app, you'd check collection field)
      // For demo, we'll include all NFTs as eligible
      setNfts(validNFTs)

    } catch (error) {
      console.error('Error fetching NFTs:', error)
      setNfts([])
    } finally {
      setLoading(false)
    }
  }, [connection, publicKey])

  const fetchStakedNFTs = useCallback(async () => {
    if (!publicKey) {
      setStakedNfts([])
      return
    }

    try {
      // In a real implementation, you would:
      // 1. Query the vault program for user's staked NFTs
      // 2. Fetch metadata for each staked NFT
      
      // For demo purposes, we'll return empty array
      setStakedNfts([])
    } catch (error) {
      console.error('Error fetching staked NFTs:', error)
      setStakedNfts([])
    }
  }, [publicKey])

  useEffect(() => {
    fetchUserNFTs()
    fetchStakedNFTs()
  }, [fetchUserNFTs, fetchStakedNFTs])

  return {
    loading,
    nfts,
    stakedNfts,
    refetch: () => {
      fetchUserNFTs()
      fetchStakedNFTs()
    }
  }
}