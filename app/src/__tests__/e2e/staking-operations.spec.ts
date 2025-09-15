import { test, expect } from '@playwright/test'

test.describe('Staking Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet connection
    await page.addInitScript(() => {
      localStorage.setItem('walletAdapter', JSON.stringify({
        connected: true,
        publicKey: '11111111111111111111111111111111'
      }))
    })

    // Mock NFT data
    await page.route('**/api/nfts', route => {
      route.fulfill({
        json: {
          nfts: [
            { 
              mint: '1111', 
              name: 'Test NFT #1', 
              image: 'https://example.com/nft1.png',
              isStaked: false 
            },
            { 
              mint: '2222', 
              name: 'Test NFT #2', 
              image: 'https://example.com/nft2.png',
              isStaked: true 
            }
          ]
        }
      })
    })

    await page.goto('/')
  })

  test('should stake an NFT successfully', async ({ page }) => {
    // Mock successful staking transaction
    await page.route('**/api/stake', route => {
      route.fulfill({
        json: { success: true, signature: 'mock-signature-123' }
      })
    })

    // Find unstaked NFT and click stake button
    const unstakedNft = page.locator('[data-testid="nft-card"]').filter({ hasText: 'Test NFT #1' })
    await unstakedNft.locator('[data-testid="stake-button"]').click()

    // Should show loading state
    await expect(page.locator('text=Staking...')).toBeVisible()

    // Should show success message
    await expect(page.locator('text=Test NFT #1 staked successfully!')).toBeVisible()

    // NFT should move to staked section
    await page.click('text=Staked')
    await expect(page.locator('text=Test NFT #1')).toBeVisible()
  })

  test('should unstake an NFT successfully', async ({ page }) => {
    // Mock successful unstaking transaction
    await page.route('**/api/unstake', route => {
      route.fulfill({
        json: { success: true, signature: 'mock-signature-456' }
      })
    })

    // Filter to staked NFTs
    await page.click('text=Staked')

    // Find staked NFT and click unstake button
    const stakedNft = page.locator('[data-testid="nft-card"]').filter({ hasText: 'Test NFT #2' })
    await stakedNft.locator('[data-testid="unstake-button"]').click()

    // Should show loading state
    await expect(page.locator('text=Unstaking...')).toBeVisible()

    // Should show success message
    await expect(page.locator('text=Test NFT #2 unstaked successfully!')).toBeVisible()

    // NFT should move to unstaked section
    await page.click('text=Unstaked')
    await expect(page.locator('text=Test NFT #2')).toBeVisible()
  })

  test('should handle staking errors gracefully', async ({ page }) => {
    // Mock staking transaction failure
    await page.route('**/api/stake', route => {
      route.fulfill({
        status: 500,
        json: { error: 'Insufficient funds for transaction' }
      })
    })

    const unstakedNft = page.locator('[data-testid="nft-card"]').filter({ hasText: 'Test NFT #1' })
    await unstakedNft.locator('[data-testid="stake-button"]').click()

    // Should show error message
    await expect(page.locator('text=Failed to stake Test NFT #1')).toBeVisible()

    // NFT should remain in unstaked state
    await expect(unstakedNft.locator('[data-testid="stake-button"]')).toBeVisible()
  })

  test('should prevent double-clicking stake button', async ({ page }) => {
    // Mock slow staking transaction
    await page.route('**/api/stake', route => {
      setTimeout(() => {
        route.fulfill({
          json: { success: true, signature: 'mock-signature-789' }
        })
      }, 2000)
    })

    const unstakedNft = page.locator('[data-testid="nft-card"]').filter({ hasText: 'Test NFT #1' })
    const stakeButton = unstakedNft.locator('[data-testid="stake-button"]')
    
    // Click stake button
    await stakeButton.click()

    // Button should be disabled
    await expect(stakeButton).toBeDisabled()
    
    // Try to click again (should be prevented)
    await stakeButton.click({ force: true })

    // Should still be in loading state (not double-processed)
    await expect(page.locator('text=Staking...')).toBeVisible()
  })

  test('should show transaction progress and confirmation', async ({ page }) => {
    let resolveStaking: (value: any) => void
    const stakingPromise = new Promise(resolve => {
      resolveStaking = resolve
    })

    await page.route('**/api/stake', route => {
      stakingPromise.then(() => {
        route.fulfill({
          json: { success: true, signature: 'mock-signature-progress' }
        })
      })
    })

    const unstakedNft = page.locator('[data-testid="nft-card"]').filter({ hasText: 'Test NFT #1' })
    await unstakedNft.locator('[data-testid="stake-button"]').click()

    // Should show progress indicator
    await expect(page.locator('[data-testid="transaction-progress"]')).toBeVisible()
    
    // Complete the transaction
    resolveStaking!(true)

    // Should show completion and hide progress
    await expect(page.locator('text=Transaction confirmed')).toBeVisible()
    await expect(page.locator('[data-testid="transaction-progress"]')).not.toBeVisible()
  })

  test('should update staking statistics', async ({ page }) => {
    // Mock vault statistics
    await page.route('**/api/vault/stats', route => {
      route.fulfill({
        json: {
          totalStaked: 15,
          totalRewards: '1500.50',
          userStaked: 2,
          userRewards: '150.75'
        }
      })
    })

    await page.reload()

    // Check if statistics are displayed
    await expect(page.locator('text=Total Staked: 15')).toBeVisible()
    await expect(page.locator('text=Your Staked: 2')).toBeVisible()
    await expect(page.locator('text=Your Rewards: 150.75')).toBeVisible()
  })

  test('should handle circuit breaker activation', async ({ page }) => {
    // Mock circuit breaker response
    await page.route('**/api/stake', route => {
      route.fulfill({
        status: 429,
        json: { 
          error: 'Too many failures. Circuit breaker active. Try again in 30s',
          circuitBreaker: {
            active: true,
            resetIn: 30000
          }
        }
      })
    })

    const unstakedNft = page.locator('[data-testid="nft-card"]').filter({ hasText: 'Test NFT #1' })
    await unstakedNft.locator('[data-testid="stake-button"]').click()

    // Should show circuit breaker message
    await expect(page.locator('text=Too many failures')).toBeVisible()
    await expect(page.locator('text=Try again in')).toBeVisible()
  })

  test('should claim rewards successfully', async ({ page }) => {
    // Mock pending rewards
    await page.route('**/api/rewards', route => {
      route.fulfill({
        json: { pendingRewards: '25.50' }
      })
    })

    // Mock successful claim
    await page.route('**/api/rewards/claim', route => {
      route.fulfill({
        json: { success: true, amount: '25.50', signature: 'claim-signature' }
      })
    })

    await page.reload()

    // Should show pending rewards
    await expect(page.locator('text=Pending: 25.50')).toBeVisible()

    // Click claim button
    await page.click('[data-testid="claim-rewards-button"]')

    // Should show success message
    await expect(page.locator('text=Rewards claimed: 25.50')).toBeVisible()
  })

  test('should batch stake multiple NFTs', async ({ page }) => {
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

    // Mock batch staking
    await page.route('**/api/batch-stake', route => {
      route.fulfill({
        json: { 
          success: true, 
          results: [
            { mint: '1111', success: true },
            { mint: '2222', success: true },
            { mint: '3333', success: false, error: 'Transaction failed' }
          ]
        }
      })
    })

    await page.reload()

    // Filter to unstaked
    await page.click('text=Unstaked')

    // Click batch stake button
    await page.click('[data-testid="batch-stake-button"]')

    // Should show batch progress
    await expect(page.locator('text=Staking 3 NFTs...')).toBeVisible()

    // Should show batch results
    await expect(page.locator('text=Successfully staked 2 NFTs')).toBeVisible()
    await expect(page.locator('text=Failed to stake 1 NFT')).toBeVisible()
  })
})