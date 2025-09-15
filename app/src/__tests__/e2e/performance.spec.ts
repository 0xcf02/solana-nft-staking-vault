import { test, expect } from '@playwright/test'

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet connection
    await page.addInitScript(() => {
      localStorage.setItem('walletAdapter', JSON.stringify({
        connected: true,
        publicKey: '11111111111111111111111111111111'
      }))
    })

    await page.goto('/')
  })

  test('should load initial page within performance budget', async ({ page }) => {
    const startTime = Date.now()
    
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000)
  })

  test('should handle large NFT collections efficiently', async ({ page }) => {
    // Mock large NFT collection (100 items)
    const largeNFTCollection = Array.from({ length: 100 }, (_, i) => ({
      mint: `mint-${i.toString().padStart(4, '0')}`,
      name: `Test NFT #${i}`,
      image: `https://example.com/nft${i}.png`,
      isStaked: i % 3 === 0 // Every 3rd NFT is staked
    }))

    await page.route('**/api/nfts', route => {
      route.fulfill({
        json: { nfts: largeNFTCollection }
      })
    })

    const startTime = Date.now()
    await page.reload()
    
    // Wait for virtualization to kick in
    await page.waitForSelector('[data-testid="nft-grid"]')
    
    const renderTime = Date.now() - startTime
    
    // Should render large collection quickly (under 2 seconds)
    expect(renderTime).toBeLessThan(2000)
    
    // Should use virtualization for large lists
    await page.click('[data-testid="stats-toggle"]')
    await expect(page.locator('text=Virtualized: Yes')).toBeVisible()
  })

  test('should scroll smoothly through virtualized list', async ({ page }) => {
    // Mock large collection that triggers virtualization
    const largeCollection = Array.from({ length: 50 }, (_, i) => ({
      mint: `mint-${i}`,
      name: `NFT ${i}`,
      isStaked: false
    }))

    await page.route('**/api/nfts', route => {
      route.fulfill({ json: { nfts: largeCollection } })
    })

    await page.reload()
    await page.waitForSelector('[data-testid="nft-grid"]')
    
    const scrollContainer = page.locator('[data-testid="virtual-scroll-container"]')
    
    // Measure scroll performance
    const scrollStartTime = Date.now()
    
    // Perform smooth scroll
    await scrollContainer.evaluate(el => {
      el.scrollTop = 1000
    })
    
    // Wait for scroll to complete
    await page.waitForTimeout(100)
    
    const scrollTime = Date.now() - scrollStartTime
    
    // Scroll should be responsive (under 200ms)
    expect(scrollTime).toBeLessThan(200)
  })

  test('should cache NFT data effectively', async ({ page }) => {
    let fetchCount = 0
    
    await page.route('**/api/nfts', route => {
      fetchCount++
      route.fulfill({
        json: {
          nfts: [{ mint: '1111', name: 'Cached NFT', isStaked: false }]
        }
      })
    })

    // First load
    await page.reload()
    await page.waitForSelector('[data-testid="nft-grid"]')
    
    expect(fetchCount).toBe(1)
    
    // Navigate away and back (simulating route change)
    await page.goto('/about') // Assuming about page exists
    await page.goBack()
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="nft-grid"]')
    
    // Should use cache (no additional fetch within cache TTL)
    expect(fetchCount).toBe(1)
  })

  test('should debounce search input efficiently', async ({ page }) => {
    let searchRequests = 0
    
    await page.route('**/api/search**', route => {
      searchRequests++
      route.fulfill({ json: { results: [] } })
    })

    const searchInput = page.locator('[data-testid="search-input"]')
    
    // Type rapidly
    await searchInput.type('test search query', { delay: 50 })
    
    // Wait for debounce period
    await page.waitForTimeout(500)
    
    // Should only make one request due to debouncing
    expect(searchRequests).toBeLessThanOrEqual(1)
  })

  test('should handle memory efficiently during interactions', async ({ page }) => {
    // Mock moderate collection
    const collection = Array.from({ length: 25 }, (_, i) => ({
      mint: `mint-${i}`,
      name: `NFT ${i}`,
      isStaked: i % 2 === 0
    }))

    await page.route('**/api/nfts', route => {
      route.fulfill({ json: { nfts: collection } })
    })

    await page.reload()
    
    // Perform multiple filter operations
    await page.click('text=Staked')
    await page.click('text=Unstaked') 
    await page.click('text=All')
    
    // Perform search operations
    await page.fill('[data-testid="search-input"]', 'NFT 1')
    await page.fill('[data-testid="search-input"]', '')
    
    // Switch view modes
    await page.click('[data-testid="view-mode-list"]')
    await page.click('[data-testid="view-mode-grid"]')
    
    // Check performance stats to ensure no memory leaks
    await page.click('[data-testid="stats-toggle"]')
    const cacheSize = await page.locator('[data-testid="cache-size"]').textContent()
    
    // Cache size should be reasonable (not growing indefinitely)
    const cacheSizeNum = parseInt(cacheSize?.replace(/\D/g, '') || '0')
    expect(cacheSizeNum).toBeLessThan(1000) // Reasonable cache size
  })

  test('should lazy load images efficiently', async ({ page }) => {
    const nftWithImages = Array.from({ length: 20 }, (_, i) => ({
      mint: `mint-${i}`,
      name: `NFT ${i}`,
      image: `https://example.com/large-nft-${i}.png`,
      isStaked: false
    }))

    await page.route('**/api/nfts', route => {
      route.fulfill({ json: { nfts: nftWithImages } })
    })

    // Track image requests
    let imageRequests = 0
    await page.route('**/large-nft-*.png', route => {
      imageRequests++
      // Simulate image load delay
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: Buffer.from('fake-image-data')
        })
      }, 100)
    })

    await page.reload()
    await page.waitForSelector('[data-testid="nft-grid"]')
    
    // Should only load images for visible items initially
    await page.waitForTimeout(500)
    expect(imageRequests).toBeLessThan(nftWithImages.length)
    
    // Scroll down to trigger more image loads
    await page.locator('[data-testid="nft-grid"]').evaluate(el => {
      el.scrollTop = 500
    })
    
    await page.waitForTimeout(300)
    
    // Should load additional images as they come into view
    expect(imageRequests).toBeGreaterThan(5)
  })

  test('should maintain responsive UI during heavy operations', async ({ page }) => {
    // Mock batch operation
    await page.route('**/api/batch-stake', route => {
      // Simulate slow batch operation
      setTimeout(() => {
        route.fulfill({
          json: { success: true, processed: 10 }
        })
      }, 3000)
    })

    const largeCollection = Array.from({ length: 10 }, (_, i) => ({
      mint: `mint-${i}`,
      name: `NFT ${i}`,
      isStaked: false
    }))

    await page.route('**/api/nfts', route => {
      route.fulfill({ json: { nfts: largeCollection } })
    })

    await page.reload()
    
    // Start batch operation
    await page.click('text=Unstaked')
    await page.click('[data-testid="batch-stake-button"]')
    
    // UI should remain responsive during operation
    const startTime = Date.now()
    
    // Test button click responsiveness
    await page.click('[data-testid="stats-toggle"]')
    
    const responseTime = Date.now() - startTime
    
    // UI should respond quickly even during heavy operations
    expect(responseTime).toBeLessThan(200)
    
    // Stats panel should be visible (UI is responsive)
    await expect(page.locator('[data-testid="performance-stats"]')).toBeVisible()
  })

  test('should handle network latency gracefully', async ({ page }) => {
    // Simulate slow network
    await page.route('**/api/nfts', route => {
      setTimeout(() => {
        route.fulfill({
          json: {
            nfts: [{ mint: '1111', name: 'Slow Load NFT', isStaked: false }]
          }
        })
      }, 2000) // 2 second delay
    })

    const startTime = Date.now()
    await page.reload()
    
    // Should show loading state immediately
    await expect(page.locator('[data-testid="nft-loading"]')).toBeVisible()
    
    // Wait for content to load
    await page.waitForSelector('text=Slow Load NFT')
    
    const totalTime = Date.now() - startTime
    
    // Should handle the delay gracefully (close to expected 2s + render time)
    expect(totalTime).toBeGreaterThan(1900)
    expect(totalTime).toBeLessThan(3000)
  })
})