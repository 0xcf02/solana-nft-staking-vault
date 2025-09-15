import { test, expect } from '@playwright/test'

test.describe('NFT Grid Component', () => {
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

  test('should display NFT grid when wallet is connected', async ({ page }) => {
    await expect(page.locator('[data-testid="nft-grid"]')).toBeVisible()
    await expect(page.locator('text=Your NFTs')).toBeVisible()
  })

  test('should show loading state while fetching NFTs', async ({ page }) => {
    // Mock slow NFT fetch
    await page.route('**/nfts/**', route => {
      setTimeout(() => route.fulfill({ json: [] }), 2000)
    })

    await page.reload()
    
    // Should show loading skeleton
    await expect(page.locator('[data-testid="nft-loading"]')).toBeVisible()
    await expect(page.locator('.animate-pulse')).toBeVisible()
  })

  test('should filter NFTs by status', async ({ page }) => {
    // Mock NFT data
    await page.route('**/api/nfts', route => {
      route.fulfill({
        json: {
          nfts: [
            { mint: '1111', name: 'NFT 1', isStaked: false },
            { mint: '2222', name: 'NFT 2', isStaked: true },
            { mint: '3333', name: 'NFT 3', isStaked: false }
          ]
        }
      })
    })

    await page.reload()

    // Test filter buttons
    await page.click('text=Staked (1)')
    await expect(page.locator('[data-testid="nft-card"]')).toHaveCount(1)

    await page.click('text=Unstaked (2)')
    await expect(page.locator('[data-testid="nft-card"]')).toHaveCount(2)

    await page.click('text=All (3)')
    await expect(page.locator('[data-testid="nft-card"]')).toHaveCount(3)
  })

  test('should search NFTs by name', async ({ page }) => {
    // Mock NFT data with searchable names
    await page.route('**/api/nfts', route => {
      route.fulfill({
        json: {
          nfts: [
            { mint: '1111', name: 'Cool Cat #1', isStaked: false },
            { mint: '2222', name: 'Bored Ape #2', isStaked: false },
            { mint: '3333', name: 'Cool Cat #2', isStaked: true }
          ]
        }
      })
    })

    await page.reload()
    
    // Search for "Cool Cat"
    await page.fill('[data-testid="search-input"]', 'Cool Cat')
    
    // Should show only Cool Cat NFTs
    await expect(page.locator('text=Cool Cat #1')).toBeVisible()
    await expect(page.locator('text=Cool Cat #2')).toBeVisible()
    await expect(page.locator('text=Bored Ape #2')).not.toBeVisible()
  })

  test('should switch between grid and list view modes', async ({ page }) => {
    await page.click('[data-testid="view-mode-list"]')
    
    // Should switch to list view
    await expect(page.locator('[data-testid="nft-grid"]')).toHaveClass(/space-y-2/)

    await page.click('[data-testid="view-mode-grid"]')
    
    // Should switch back to grid view
    await expect(page.locator('[data-testid="nft-grid"]')).toHaveClass(/grid/)
  })

  test('should show performance stats when enabled', async ({ page }) => {
    await page.click('[data-testid="stats-toggle"]')
    
    // Should display performance stats panel
    await expect(page.locator('[data-testid="performance-stats"]')).toBeVisible()
    await expect(page.locator('text=Total Items')).toBeVisible()
    await expect(page.locator('text=Virtualized')).toBeVisible()
    await expect(page.locator('text=Cache Size')).toBeVisible()
  })

  test('should handle empty state gracefully', async ({ page }) => {
    // Mock empty NFT response
    await page.route('**/api/nfts', route => {
      route.fulfill({ json: { nfts: [] } })
    })

    await page.reload()
    
    // Should show empty state
    await expect(page.locator('text=No eligible NFTs found')).toBeVisible()
    await expect(page.locator('text=Make sure you own NFTs')).toBeVisible()
  })

  test('should refresh NFT data', async ({ page }) => {
    let callCount = 0
    await page.route('**/api/nfts', route => {
      callCount++
      route.fulfill({
        json: {
          nfts: [{ mint: '1111', name: `NFT ${callCount}`, isStaked: false }]
        }
      })
    })

    await page.reload()
    await expect(page.locator('text=NFT 1')).toBeVisible()

    // Click refresh button
    await page.click('[data-testid="refresh-button"]')
    
    // Should fetch new data
    await expect(page.locator('text=NFT 2')).toBeVisible()
  })

  test('should enable batch staking when multiple NFTs selected', async ({ page }) => {
    // Mock multiple unstaked NFTs
    await page.route('**/api/nfts', route => {
      route.fulfill({
        json: {
          nfts: [
            { mint: '1111', name: 'NFT 1', isStaked: false },
            { mint: '2222', name: 'NFT 2', isStaked: false },
            { mint: '3333', name: 'NFT 3', isStaked: false }
          ]
        }
      })
    })

    await page.reload()
    
    // Filter to unstaked only
    await page.click('text=Unstaked')
    
    // Should show batch stake button
    await expect(page.locator('[data-testid="batch-stake-button"]')).toBeVisible()
    await expect(page.locator('text=Stake All')).toBeVisible()
  })
})