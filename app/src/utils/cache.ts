// Intelligent caching system for NFT metadata and blockchain data
import { PublicKey } from '@solana/web3.js'

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  key: string
}

export interface CacheStats {
  hits: number
  misses: number
  entries: number
  size: number
  hitRate: number
}

export class IntelligentCache {
  protected cache = new Map<string, CacheEntry<any>>()
  private stats = {
    hits: 0,
    misses: 0,
  }

  // Different TTL for different data types
  private static readonly TTL_CONFIG = {
    NFT_METADATA: 10 * 60 * 1000, // 10 minutes - metadata rarely changes
    VAULT_DATA: 30 * 1000, // 30 seconds - frequently updated
    USER_STAKE_DATA: 15 * 1000, // 15 seconds - updated on transactions
    USER_ROLE: 5 * 60 * 1000, // 5 minutes - roles change infrequently
    COLLECTION_DATA: 30 * 60 * 1000, // 30 minutes - very stable
    TRANSACTION_STATUS: 5 * 1000, // 5 seconds - needs frequent updates
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const defaultTtl = this.getDefaultTtl(key)
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || defaultTtl,
      key,
    }
    
    this.cache.set(key, entry)
    this.cleanup() // Periodic cleanup
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    
    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    this.stats.hits++
    return entry.data
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0 }
  }

  // Smart cache keys for different data types
  static keys = {
    nftMetadata: (mint: string) => `nft_metadata:${mint}`,
    vaultData: () => 'vault_data',
    userStakeData: (user: string) => `user_stake:${user}`,
    userRole: (user: string) => `user_role:${user}`,
    collectionData: (mint: string) => `collection:${mint}`,
    transactionStatus: (signature: string) => `tx_status:${signature}`,
    userNfts: (user: string) => `user_nfts:${user}`,
    stakedNfts: (user: string) => `staked_nfts:${user}`,
  }

  private getDefaultTtl(key: string): number {
    if (key.startsWith('nft_metadata:')) return IntelligentCache.TTL_CONFIG.NFT_METADATA
    if (key === 'vault_data') return IntelligentCache.TTL_CONFIG.VAULT_DATA
    if (key.startsWith('user_stake:')) return IntelligentCache.TTL_CONFIG.USER_STAKE_DATA
    if (key.startsWith('user_role:')) return IntelligentCache.TTL_CONFIG.USER_ROLE
    if (key.startsWith('collection:')) return IntelligentCache.TTL_CONFIG.COLLECTION_DATA
    if (key.startsWith('tx_status:')) return IntelligentCache.TTL_CONFIG.TRANSACTION_STATUS
    
    return 60 * 1000 // Default 1 minute
  }

  protected isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private cleanup(): void {
    // Only cleanup every 100 operations to avoid performance impact
    if ((this.stats.hits + this.stats.misses) % 100 !== 0) return

    const now = Date.now()
    const toDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        toDelete.push(key)
      }
    }

    toDelete.forEach(key => this.cache.delete(key))
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: this.cache.size,
      size: this.calculateSize(),
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
    }
  }

  private calculateSize(): number {
    let size = 0
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry).length
    }
    return size
  }

  // Invalidate related cache entries
  invalidatePattern(pattern: string): void {
    const keysToDelete: string[] = []
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key))
  }

  // Preload frequently accessed data
  async preload<T>(
    key: string,
    loader: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached) return cached

    const data = await loader()
    this.set(key, data, ttl)
    return data
  }

  // Batch operations for efficiency
  setMultiple<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    entries.forEach(({ key, data, ttl }) => this.set(key, data, ttl))
  }

  getMultiple<T>(keys: string[]): Array<{ key: string; data: T | null }> {
    return keys.map(key => ({ key, data: this.get<T>(key) }))
  }
}

// Cache with automatic persistence to localStorage
export class PersistentCache extends IntelligentCache {
  private readonly storageKey: string

  constructor(storageKey = 'nft_staking_cache') {
    super()
    this.storageKey = storageKey
    this.loadFromStorage()
  }

  set<T>(key: string, data: T, ttl?: number): void {
    super.set(key, data, ttl)
    this.saveToStorage()
  }

  delete(key: string): boolean {
    const result = super.delete(key)
    if (result) this.saveToStorage()
    return result
  }

  clear(): void {
    super.clear()
    this.clearStorage()
  }

  private saveToStorage(): void {
    try {
      const cacheData = Array.from(this.cache.entries())
      localStorage.setItem(this.storageKey, JSON.stringify(cacheData))
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error)
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const cacheData = JSON.parse(stored)
        this.cache = new Map(cacheData)
        
        // Clean up expired entries
        const now = Date.now()
        for (const [key, entry] of this.cache.entries()) {
          if (this.isExpired(entry)) {
            this.cache.delete(key)
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error)
      this.clear()
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem(this.storageKey)
    } catch (error) {
      console.warn('Failed to clear cache from localStorage:', error)
    }
  }
}

// Global cache instance
export const globalCache = new PersistentCache()

// Cache decorators for hooks
export function withCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttl?: number
): () => Promise<T> {
  return async () => {
    return globalCache.preload(cacheKey, fetcher, ttl)
  }
}

// Utility functions for common operations
export const cacheUtils = {
  invalidateUser: (userPublicKey: PublicKey) => {
    const userKey = userPublicKey.toString()
    globalCache.invalidatePattern(userKey)
  },

  invalidateVault: () => {
    globalCache.delete(IntelligentCache.keys.vaultData())
  },

  invalidateNftMetadata: (mint: string) => {
    globalCache.delete(IntelligentCache.keys.nftMetadata(mint))
  },

  preloadUserData: async (
    userPublicKey: PublicKey,
    loaders: {
      stakeData?: () => Promise<any>
      role?: () => Promise<any>
      nfts?: () => Promise<any>
    }
  ) => {
    const userKey = userPublicKey.toString()
    const promises: Promise<any>[] = []

    if (loaders.stakeData) {
      promises.push(
        globalCache.preload(
          IntelligentCache.keys.userStakeData(userKey),
          loaders.stakeData
        )
      )
    }

    if (loaders.role) {
      promises.push(
        globalCache.preload(
          IntelligentCache.keys.userRole(userKey),
          loaders.role
        )
      )
    }

    if (loaders.nfts) {
      promises.push(
        globalCache.preload(
          IntelligentCache.keys.userNfts(userKey),
          loaders.nfts
        )
      )
    }

    await Promise.all(promises)
  },

  getBatchMetadata: async (
    mints: string[],
    loader: (mint: string) => Promise<any>
  ) => {
    const results: Array<{ mint: string; data: any }> = []
    const toFetch: string[] = []

    // Check cache first
    for (const mint of mints) {
      const cached = globalCache.get(IntelligentCache.keys.nftMetadata(mint))
      if (cached) {
        results.push({ mint, data: cached })
      } else {
        toFetch.push(mint)
      }
    }

    // Fetch missing data in parallel
    if (toFetch.length > 0) {
      const fetchPromises = toFetch.map(async (mint) => {
        try {
          const data = await loader(mint)
          globalCache.set(IntelligentCache.keys.nftMetadata(mint), data)
          return { mint, data }
        } catch (error) {
          console.error(`Failed to fetch metadata for ${mint}:`, error)
          return { mint, data: null }
        }
      })

      const fetchedResults = await Promise.all(fetchPromises)
      results.push(...fetchedResults)
    }

    return results
  },
}