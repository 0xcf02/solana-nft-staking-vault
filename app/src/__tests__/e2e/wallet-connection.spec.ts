import { test, expect } from '@playwright/test'

test.describe('Wallet Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display wallet connection options', async ({ page }) => {
    // Check if wallet connection buttons are present
    await expect(page.locator('[data-testid="wallet-connect-button"]')).toBeVisible()
    
    // Check if the page shows appropriate state for non-connected wallet
    await expect(page.locator('text=Connect Wallet')).toBeVisible()
  })

  test('should show wallet selection modal', async ({ page }) => {
    // Click connect wallet button
    await page.click('[data-testid="wallet-connect-button"]')
    
    // Check if wallet selection modal appears
    await expect(page.locator('[data-testid="wallet-modal"]')).toBeVisible()
    
    // Check if popular wallets are listed
    await expect(page.locator('text=Phantom')).toBeVisible()
    await expect(page.locator('text=Solflare')).toBeVisible()
  })

  test('should handle wallet connection errors gracefully', async ({ page }) => {
    // Mock wallet connection failure
    await page.route('**/wallet/**', route => {
      route.fulfill({ status: 500, body: 'Wallet connection failed' })
    })

    await page.click('[data-testid="wallet-connect-button"]')
    
    // Should show error message
    await expect(page.locator('text=Failed to connect')).toBeVisible({ timeout: 10000 })
  })

  test('should persist wallet connection state', async ({ page }) => {
    // Simulate successful wallet connection
    await page.evaluate(() => {
      localStorage.setItem('walletAdapter', JSON.stringify({
        connected: true,
        publicKey: '11111111111111111111111111111111'
      }))
    })

    await page.reload()

    // Should remember connection state after reload
    await expect(page.locator('[data-testid="wallet-address"]')).toBeVisible()
  })
})