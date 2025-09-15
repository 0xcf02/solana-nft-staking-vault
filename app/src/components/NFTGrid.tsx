'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useNFTs } from '@/hooks/useNFTs'
import { useStaking } from '@/hooks/useStaking'
import toast from 'react-hot-toast'
import { NFTCard } from './NFTCard'
import VirtualizedList from './VirtualizedList'
import LazyWrapper from './LazyWrapper'
import { 
  useDebounce, 
  useThrottle, 
  usePerformanceProfiler, 
  useIntersectionObserver 
} from '@/utils/performance'
import { monitoring } from '@/utils/monitoring'
import { useMemo, useCallback, useState, useRef, useEffect } from 'react'

type SortOption = 'name' | 'staked' | 'recent'
type ViewMode = 'grid' | 'list'

export function NFTGrid() {
  const { publicKey } = useWallet()
  const { 
    nfts, 
    stakedNfts, 
    loading: nftsLoading, 
    totalNfts, 
    totalStaked, 
    hasNfts,
    refetch,
    getCacheStats
  } = useNFTs()
  const { stakeNft, unstakeNft, loading: stakingLoading } = useStaking()
  
  // State management
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'staked' | 'unstaked'>('all')
  const [sortBy, setSortBy] = useState<SortOption>('staked')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showStats, setShowStats] = useState(false)
  
  // Performance monitoring
  const { startMeasurement, endMeasurement, getStats } = usePerformanceProfiler('NFTGrid')
  const containerRef = useRef<HTMLDivElement>(null)
  const isVisible = useIntersectionObserver(containerRef)
  
  // Track component performance
  useEffect(() => {
    startMeasurement()
    return () => {
      endMeasurement()
    }
  })

  // Debounce search query for performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Enhanced throttled handlers with monitoring
  const handleStake = useThrottle(async (nftMint: string, nftName?: string) => {
    if (!publicKey) return

    monitoring.trackUserAction('nft_stake_initiated', publicKey, { 
      nftMint, 
      nftName,
      totalNfts 
    })

    try {
      const startTime = performance.now()
      await stakeNft(nftMint)
      const duration = performance.now() - startTime
      
      monitoring.trackUserAction('nft_stake_completed', publicKey, {
        nftMint,
        nftName,
        duration
      })
      
      toast.success(`${nftName || 'NFT'} staked successfully!`)
      
      // Refresh data after successful stake
      setTimeout(() => refetch(true), 1000)
    } catch (error) {
      monitoring.trackError(error, 'nft_stake', publicKey)
      console.error('Error staking NFT:', error)
      toast.error(`Failed to stake ${nftName || 'NFT'}`)
    }
  }, 2000)

  const handleUnstake = useThrottle(async (nftMint: string, nftName?: string) => {
    if (!publicKey) return

    monitoring.trackUserAction('nft_unstake_initiated', publicKey, { 
      nftMint, 
      nftName,
      totalStaked 
    })

    try {
      const startTime = performance.now()
      await unstakeNft(nftMint)
      const duration = performance.now() - startTime
      
      monitoring.trackUserAction('nft_unstake_completed', publicKey, {
        nftMint,
        nftName,
        duration
      })
      
      toast.success(`${nftName || 'NFT'} unstaked successfully!`)
      
      // Refresh data after successful unstake
      setTimeout(() => refetch(true), 1000)
    } catch (error) {
      monitoring.trackError(error, 'nft_unstake', publicKey)
      console.error('Error unstaking NFT:', error)
      toast.error(`Failed to unstake ${nftName || 'NFT'}`)
    }
  }, 2000)

  // Batch operations for power users
  const handleBatchStake = useCallback(async (nftMints: string[]) => {
    if (!publicKey || nftMints.length === 0) return
    
    monitoring.trackUserAction('batch_stake_initiated', publicKey, {
      count: nftMints.length
    })

    toast.loading(`Staking ${nftMints.length} NFTs...`, { id: 'batch-stake' })
    
    let succeeded = 0
    let failed = 0
    
    for (const mint of nftMints) {
      try {
        await stakeNft(mint)
        succeeded++
      } catch (error) {
        failed++
        console.error(`Failed to stake NFT ${mint}:`, error)
      }
    }
    
    toast.dismiss('batch-stake')
    
    if (succeeded > 0) {
      toast.success(`Successfully staked ${succeeded} NFT${succeeded !== 1 ? 's' : ''}`)
      refetch(true)
    }
    
    if (failed > 0) {
      toast.error(`Failed to stake ${failed} NFT${failed !== 1 ? 's' : ''}`)
    }
    
    monitoring.trackUserAction('batch_stake_completed', publicKey, {
      succeeded,
      failed,
      total: nftMints.length
    })
  }, [publicKey, stakeNft, refetch])

  // Enhanced filtering and sorting with performance tracking
  const allNFTs = useMemo(() => {
    startMeasurement()
    
    const allItems = [
      ...nfts.map(nft => ({ ...nft, isStaked: false, lastAction: 'unstaked' })),
      ...stakedNfts.map(nft => ({ ...nft, isStaked: true, lastAction: 'staked' }))
    ]

    let filtered = allItems

    // Filter by type
    if (filterType === 'staked') {
      filtered = filtered.filter(nft => nft.isStaked)
    } else if (filterType === 'unstaked') {
      filtered = filtered.filter(nft => !nft.isStaked)
    }

    // Advanced search: name, mint, attributes
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter(nft => {
        // Search in name and mint
        const nameMatch = nft.name?.toLowerCase().includes(query)
        const mintMatch = nft.mint.toLowerCase().includes(query)
        
        // Search in attributes
        const attributeMatch = nft.attributes?.some(attr => 
          attr.trait_type.toLowerCase().includes(query) ||
          String(attr.value).toLowerCase().includes(query)
        )
        
        return nameMatch || mintMatch || attributeMatch
      })
    }

    // Enhanced sorting
    const sorted = filtered.sort((a, b) => {
      switch (sortBy) {
        case 'staked':
          // Staked status first, then name
          if (a.isStaked !== b.isStaked) {
            return a.isStaked ? -1 : 1
          }
          return (a.name || '').localeCompare(b.name || '')
          
        case 'name':
          return (a.name || '').localeCompare(b.name || '')
          
        case 'recent':
          // Sort by mint address as proxy for recency (newer addresses tend to be higher)
          return b.mint.localeCompare(a.mint)
          
        default:
          return 0
      }
    })
    
    endMeasurement()
    return sorted
  }, [nfts, stakedNfts, filterType, debouncedSearchQuery, sortBy, startMeasurement, endMeasurement])

  // Enhanced render function for different view modes
  const renderNFTItem = useCallback((nft: any, index: number) => {
    const itemHeight = viewMode === 'list' ? 120 : 280
    
    return (
      <div 
        key={nft.mint} 
        className={viewMode === 'list' ? 'flex items-center p-2 border-b border-gray-700' : 'p-2'}
        style={viewMode === 'list' ? { height: itemHeight } : {}}
      >
        <LazyWrapper>
          <NFTCard
            nft={nft}
            isStaked={nft.isStaked}
            onStake={() => handleStake(nft.mint, nft.name || undefined)}
            onUnstake={() => handleUnstake(nft.mint, nft.name || undefined)}
            disabled={stakingLoading}
            viewMode={viewMode}
          />
        </LazyWrapper>
      </div>
    )
  }, [handleStake, handleUnstake, stakingLoading, viewMode])

  const getItemKey = useCallback((nft: any) => nft.mint, [])

  // Performance stats for debugging
  const performanceStats = useMemo(() => {
    const stats = getStats()
    const cacheStats = getCacheStats()
    
    return {
      ...stats,
      ...cacheStats,
      totalItems: allNFTs.length,
      isVirtualized: allNFTs.length > 20
    }
  }, [getStats, getCacheStats, allNFTs.length])

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
    <div ref={containerRef} className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Your NFTs</h2>
          <div className="flex items-center gap-3">
            {/* Performance Stats Toggle */}
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Stats
            </button>
            
            {/* Refresh Button */}
            <button
              onClick={() => refetch(true)}
              disabled={nftsLoading}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg transition-colors"
            >
              {nftsLoading ? '⟳' : '↻'} Refresh
            </button>
          </div>
        </div>
        
        {/* Performance Stats Panel */}
        {showStats && (
          <div className="bg-gray-900/50 rounded-lg p-4 mb-4 text-sm">
            <h3 className="font-semibold mb-2">Performance Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-gray-400">Total Items</div>
                <div className="font-mono">{performanceStats.totalItems}</div>
              </div>
              <div>
                <div className="text-gray-400">Virtualized</div>
                <div className="font-mono">{performanceStats.isVirtualized ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-gray-400">Cache Size</div>
                <div className="font-mono">{performanceStats.performanceCacheSize}</div>
              </div>
              <div>
                <div className="text-gray-400">View Mode</div>
                <div className="font-mono capitalize">{viewMode}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Enhanced Search and Filter Controls */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search NFTs by name, mint, or attributes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Filter and View Controls */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            {/* Filter Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All ({totalNfts + totalStaked})
              </button>
              <button
                onClick={() => setFilterType('unstaked')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === 'unstaked'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Unstaked ({totalNfts})
              </button>
              <button
                onClick={() => setFilterType('staked')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === 'staked'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Staked ({totalStaked})
              </button>
            </div>
            
            {/* Sort and View Controls */}
            <div className="flex gap-2">
              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="staked">Sort by Status</option>
                <option value="name">Sort by Name</option>
                <option value="recent">Sort by Recent</option>
              </select>
              
              {/* View Mode Toggle */}
              <div className="flex bg-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 text-sm transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  }`}
                >
                  ⊞ Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 text-sm transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  }`}
                >
                  ☰ List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {allNFTs.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎨</div>
          <p className="text-gray-400 mb-2">
            {debouncedSearchQuery ? 'No NFTs match your search' : 'No eligible NFTs found'}
          </p>
          <p className="text-sm text-gray-500">
            {debouncedSearchQuery 
              ? 'Try adjusting your search terms or filters'
              : 'Make sure you own NFTs from the supported collection'
            }
          </p>
        </div>
      ) : allNFTs.length > 20 ? (
        // Use virtualization for large lists (>20 items)
        <div className="space-y-4">
          {/* Batch Operations for Large Lists */}
          {filterType === 'unstaked' && allNFTs.length > 1 && (
            <div className="flex justify-between items-center p-3 bg-gray-900/30 rounded-lg">
              <span className="text-sm text-gray-400">
                {allNFTs.length} unstaked NFTs
              </span>
              <button
                onClick={() => handleBatchStake(allNFTs.map(nft => nft.mint))}
                disabled={stakingLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
              >
                Stake All
              </button>
            </div>
          )}
          
          <VirtualizedList
            items={allNFTs}
            itemHeight={viewMode === 'list' ? 120 : 280}
            containerHeight={viewMode === 'list' ? 480 : 600}
            renderItem={renderNFTItem}
            getItemKey={getItemKey}
            className="border border-gray-700 rounded-lg"
          />
        </div>
      ) : (
        // Use regular grid/list for smaller collections
        <div className="space-y-4">
          {/* Batch Operations for Small Lists */}
          {filterType === 'unstaked' && allNFTs.length > 1 && (
            <div className="flex justify-between items-center p-3 bg-gray-900/30 rounded-lg">
              <span className="text-sm text-gray-400">
                {allNFTs.length} unstaked NFTs
              </span>
              <button
                onClick={() => handleBatchStake(allNFTs.map(nft => nft.mint))}
                disabled={stakingLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
              >
                Stake All
              </button>
            </div>
          )}
          
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-2"
          }>
            {allNFTs.map((nft) => (
              <LazyWrapper key={nft.mint}>
                <NFTCard
                  nft={nft}
                  isStaked={nft.isStaked}
                  onStake={() => handleStake(nft.mint, nft.name || undefined)}
                  onUnstake={() => handleUnstake(nft.mint, nft.name || undefined)}
                  disabled={stakingLoading}
                  viewMode={viewMode}
                />
              </LazyWrapper>
            ))}
          </div>
        </div>
      )}
      
      {/* Results Summary */}
      {allNFTs.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="flex justify-between items-center text-sm text-gray-400">
            <span>
              Showing {allNFTs.length} of {totalNfts + totalStaked} NFTs
              {debouncedSearchQuery && ` matching "${debouncedSearchQuery}"`}
            </span>
            <span>
              {isVisible ? 'Visible' : 'Hidden'} • 
              {performanceStats.isVirtualized ? ' Virtualized' : ' Standard'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}