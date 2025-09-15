import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js'
import { PROGRAM_CONFIG } from '@/utils/constants'
import { globalCache, IntelligentCache, cacheUtils } from '@/utils/cache'
import { retryMetadata, retryRPC } from '@/utils/retry'
import { monitoring } from '@/utils/monitoring'
import { 
  useDebounce, 
  MemoizedCache, 
  usePerformanceProfiler,
  useIntersectionObserver,
  arrayUtils
} from '@/utils/performance'

export interface NFTMetadata {
  mint: string
  name: string | null
  image: string | null
  description: string | null
  attributes: Array<{
    trait_type: string
    value: string | number
  }> | null
  loading?: boolean
  error?: string
}

interface NFTFetchState {
  loading: boolean
  error: string | null
  lastFetch: number
}

export function useNFTs() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  
  const [loading, setLoading] = useState(false)
  const [nfts, setNfts] = useState<NFTMetadata[]>([])
  const [stakedNfts, setStakedNfts] = useState<NFTMetadata[]>([])
  const [metaplex, setMetaplex] = useState<Metaplex | null>(null)
  const [fetchState, setFetchState] = useState<NFTFetchState>({
    loading: false,
    error: null,
    lastFetch: 0
  })

  // Performance optimizations
  const performanceCache = useState(() => new MemoizedCache<any>(600000))[0] // 10 minute TTL
  const { startMeasurement, endMeasurement } = usePerformanceProfiler('useNFTs')
  
  // Debounced public key for reducing unnecessary updates
  const debouncedPublicKey = useDebounce(publicKey, 200)

  // Initialize Metaplex
  useEffect(() => {
    if (connection) {
      const mx = Metaplex.make(connection)
      setMetaplex(mx)
    }
  }, [connection])

  // Memoized collection mint for performance
  const collectionMint = useMemo(() => 
    new PublicKey(PROGRAM_CONFIG.COLLECTION_MINT), 
    []
  )

  // Optimized metadata fetching with caching and performance tracking
  const fetchMetadata = useCallback(async (uri: string): Promise<any> => {
    const cacheKey = `metadata_${btoa(uri)}`
    
    // Try performance cache first
    const performanceCached = performanceCache.get(cacheKey)
    if (performanceCached) {
      return performanceCached
    }

    startMeasurement()
    try {
      // Use retry logic for metadata fetching
      const metadata = await retryMetadata(async () => {
        const response = await fetch(uri)
        if (!response.ok) throw new Error(`Failed to fetch metadata: ${response.status}`)
        return await response.json()
      })
      
      // Cache the result
      performanceCache.set(cacheKey, metadata, 3600000) // 1 hour cache
      
      return metadata
    } catch (error) {
      monitoring.trackError(error, 'fetchMetadata', debouncedPublicKey || undefined)
      console.error('Error fetching metadata from URI:', uri, error)
      return null
    } finally {
      endMeasurement()
    }
  }, [performanceCache, startMeasurement, endMeasurement, debouncedPublicKey])

  // Enhanced batch NFT processing with lazy loading support
  const processNFTBatch = useCallback(async (nfts: any[], batchSize: number = 5) => {
    const batches = arrayUtils.chunk(nfts, batchSize)
    const results: (NFTMetadata | null)[] = []
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (nft) => {
        try {
          const fullNft = await retryRPC(async () => 
            metaplex!.nfts().load({ metadata: nft })
          )
          
          // Check if NFT belongs to authorized collection
          const isFromCollection = fullNft.collection?.address.equals(collectionMint) && 
                                  fullNft.collection?.verified

          if (!isFromCollection) {
            return null
          }

          // Fetch off-chain metadata with caching
          const offChainMetadata = fullNft.json ? 
            fullNft.json : 
            await fetchMetadata(fullNft.uri)

          return {
            mint: fullNft.address.toString(),
            name: offChainMetadata?.name || fullNft.name || 'Unknown NFT',
            image: offChainMetadata?.image || null,
            description: offChainMetadata?.description || null,
            attributes: offChainMetadata?.attributes || null,
            loading: false,
          } as NFTMetadata
        } catch (error) {
          monitoring.trackError(error, 'processNFTBatch', debouncedPublicKey || undefined)
          console.error('Error processing NFT:', nft.address.toString(), error)
          return null
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // Small delay between batches to prevent overwhelming the RPC
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return results.filter((nft): nft is NFTMetadata => nft !== null)
  }, [metaplex, collectionMint, fetchMetadata, debouncedPublicKey])

  const fetchUserNFTs = useCallback(async (forceRefresh: boolean = false) => {
    if (!debouncedPublicKey || !metaplex) {
      setNfts([])
      setFetchState(prev => ({ ...prev, loading: false }))
      return
    }

    const cacheKey = IntelligentCache.keys.userNfts(debouncedPublicKey.toString())
    const performanceCacheKey = `user_nfts_${debouncedPublicKey.toString()}`
    
    // Try performance cache first (fastest)
    if (!forceRefresh) {
      const performanceCached = performanceCache.get(performanceCacheKey)
      if (performanceCached) {
        setNfts(performanceCached)
        return
      }
      
      // Try global cache
      const cachedNfts = globalCache.get<NFTMetadata[]>(cacheKey)
      if (cachedNfts) {
        setNfts(cachedNfts)
        performanceCache.set(performanceCacheKey, cachedNfts, 300000) // 5 min in perf cache
        return
      }
    }

    // Check if we fetched recently to avoid spam
    const now = Date.now()
    if (!forceRefresh && now - fetchState.lastFetch < 10000) { // 10 second cooldown
      return
    }

    setLoading(true)
    setFetchState(prev => ({ ...prev, loading: true, error: null }))
    
    startMeasurement()
    
    monitoring.trackUserAction('fetch_user_nfts_initiated', debouncedPublicKey, {
      forceRefresh,
      lastFetch: fetchState.lastFetch
    })

    try {
      // Get all NFTs owned by the user with retry logic
      const nfts = await retryRPC(async () => 
        metaplex.nfts().findAllByOwner({
          owner: debouncedPublicKey,
        })
      )

      // Process NFTs in batches for better performance
      const validNFTs = await processNFTBatch(nfts)

      // Remove duplicates based on mint address
      const deduplicatedNFTs = arrayUtils.deduplicate(validNFTs, nft => nft.mint)

      // Cache the results in both caches
      globalCache.set(cacheKey, deduplicatedNFTs)
      performanceCache.set(performanceCacheKey, deduplicatedNFTs, 300000)
      
      setNfts(deduplicatedNFTs)
      setFetchState({
        loading: false,
        error: null,
        lastFetch: now
      })
      
      monitoring.trackUserAction('fetch_user_nfts_completed', debouncedPublicKey, {
        nftCount: deduplicatedNFTs.length,
        duration: endMeasurement()
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      monitoring.trackError(error, 'fetchUserNFTs', debouncedPublicKey || undefined)
      console.error('Error fetching NFTs:', error)
      
      setNfts([])
      setFetchState({
        loading: false,
        error: errorMessage,
        lastFetch: now
      })
    } finally {
      setLoading(false)
      endMeasurement()
    }
  }, [
    debouncedPublicKey, 
    metaplex, 
    fetchMetadata, 
    performanceCache, 
    processNFTBatch, 
    fetchState.lastFetch,
    startMeasurement, 
    endMeasurement
  ])

  const fetchStakedNFTs = useCallback(async (forceRefresh: boolean = false) => {
    if (!debouncedPublicKey || !metaplex) {
      setStakedNfts([])
      return
    }

    const cacheKey = IntelligentCache.keys.stakedNfts(debouncedPublicKey.toString())
    const performanceCacheKey = `staked_nfts_${debouncedPublicKey.toString()}`
    
    // Try cache first
    if (!forceRefresh) {
      const performanceCached = performanceCache.get(performanceCacheKey)
      if (performanceCached) {
        setStakedNfts(performanceCached)
        return
      }
      
      const cachedNfts = globalCache.get<NFTMetadata[]>(cacheKey)
      if (cachedNfts) {
        setStakedNfts(cachedNfts)
        performanceCache.set(performanceCacheKey, cachedNfts, 120000) // 2 min cache
        return
      }
    }

    startMeasurement()
    monitoring.trackUserAction('fetch_staked_nfts_initiated', debouncedPublicKey)

    try {
      // Get vault PDA
      const PROGRAM_ID = new PublicKey(PROGRAM_CONFIG.PROGRAM_ID)
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        PROGRAM_ID
      )

      // Get all NFTs owned by the vault with retry logic
      const vaultNfts = await retryRPC(async () =>
        metaplex.nfts().findAllByOwner({
          owner: vaultPDA,
        })
      )

      // Process staked NFTs in batches (smaller batch size since they're staked)
      const validStakedNFTs = await processNFTBatch(vaultNfts, 3)
      
      // Cache results
      globalCache.set(cacheKey, validStakedNFTs)
      performanceCache.set(performanceCacheKey, validStakedNFTs, 120000)
      
      setStakedNfts(validStakedNFTs)
      
      monitoring.trackUserAction('fetch_staked_nfts_completed', debouncedPublicKey, {
        stakedCount: validStakedNFTs.length,
        duration: endMeasurement()
      })
      
    } catch (error) {
      monitoring.trackError(error, 'fetchStakedNFTs', debouncedPublicKey || undefined)
      console.error('Error fetching staked NFTs:', error)
      setStakedNfts([])
    } finally {
      endMeasurement()
    }
  }, [
    debouncedPublicKey, 
    metaplex, 
    fetchMetadata, 
    performanceCache, 
    processNFTBatch, 
    startMeasurement, 
    endMeasurement
  ])

  // Memoized refresh function to prevent unnecessary re-renders
  const refetch = useCallback((forceRefresh: boolean = false) => {
    fetchUserNFTs(forceRefresh)
    fetchStakedNFTs(forceRefresh)
  }, [fetchUserNFTs, fetchStakedNFTs])

  // Smart cache invalidation when wallet changes
  useEffect(() => {
    if (debouncedPublicKey) {
      // Clear performance cache when wallet changes
      performanceCache.clear()
      
      // Fetch fresh data
      fetchUserNFTs(false)
      fetchStakedNFTs(false)
    } else {
      // Clear data when wallet disconnects
      setNfts([])
      setStakedNfts([])
      setFetchState({
        loading: false,
        error: null,
        lastFetch: 0
      })
    }
  }, [debouncedPublicKey, fetchUserNFTs, fetchStakedNFTs, performanceCache])

  // Memoized derived state for performance
  const derivedState = useMemo(() => ({
    totalNfts: nfts.length,
    totalStaked: stakedNfts.length,
    hasNfts: nfts.length > 0,
    hasStakedNfts: stakedNfts.length > 0,
    isLoading: loading || fetchState.loading,
    lastError: fetchState.error,
    canRefetch: !fetchState.loading && Date.now() - fetchState.lastFetch > 5000, // 5s cooldown
  }), [nfts.length, stakedNfts.length, loading, fetchState])

  return {
    // Core data
    loading: derivedState.isLoading,
    nfts,
    stakedNfts,
    
    // Derived state
    ...derivedState,
    
    // Actions
    refetch,
    refetchUserNfts: (forceRefresh = false) => fetchUserNFTs(forceRefresh),
    refetchStakedNfts: (forceRefresh = false) => fetchStakedNFTs(forceRefresh),
    
    // Performance utilities
    clearCache: () => {
      performanceCache.clear()
      if (debouncedPublicKey) {
        cacheUtils.invalidateUser(debouncedPublicKey)
      }
    },
    
    // Cache statistics for debugging
    getCacheStats: () => ({
      performanceCacheSize: performanceCache.size(),
      globalCacheHits: globalCache.getStats?.() || { hits: 0, misses: 0 }
    })
  }
}