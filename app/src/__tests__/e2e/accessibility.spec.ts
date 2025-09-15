import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have proper ARIA labels and roles', async ({ page }) => {
    // Check wallet connect button
    await expect(page.locator('[data-testid="wallet-connect-button"]')).toHaveAttribute('aria-label')
    
    // Check search input
    await expect(page.locator('[data-testid="search-input"]')).toHaveAttribute('aria-label')
    
    // Check filter buttons have proper roles
    const filterButtons = page.locator('[data-testid*="filter-button"]')
    await expect(filterButtons.first()).toHaveAttribute('role', 'button')
  })

  test('should be navigable with keyboard only', async ({ page }) => {
    // Start keyboard navigation
    await page.keyboard.press('Tab')
    
    // Check if focus is visible
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
    
    // Navigate through major interactive elements
    await page.keyboard.press('Tab') // Next element
    await page.keyboard.press('Tab') // Next element
    
    // Should be able to activate focused elements with Enter/Space
    await page.keyboard.press('Enter')
    
    // Check if an action was triggered (e.g., modal opened, button clicked)
    // This will depend on what element was focused
  })

  test('should have proper contrast ratios', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['color-contrast'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have descriptive page title', async ({ page }) => {
    await expect(page).toHaveTitle(/NFT Staking/i)
  })

  test('should handle screen reader navigation', async ({ page }) => {
    // Mock wallet connection for more complete page
    await page.addInitScript(() => {
      localStorage.setItem('walletAdapter', JSON.stringify({
        connected: true,
        publicKey: '11111111111111111111111111111111'
      }))
    })

    await page.reload()

    // Check for proper heading hierarchy
    const h1 = page.locator('h1').first()
    const h2 = page.locator('h2').first()
    
    await expect(h1).toBeVisible()
    await expect(h2).toBeVisible()
    
    // Check for landmarks
    await expect(page.locator('main')).toBeVisible()
    
    // Check for skip links (if implemented)
    const skipLink = page.locator('a[href="#main-content"]').first()
    if (await skipLink.count() > 0) {
      await expect(skipLink).toHaveText(/skip/i)
    }
  })

  test('should provide feedback for user actions', async ({ page }) => {
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
          nfts: [{ mint: '1111', name: 'Test NFT', isStaked: false }]
        }
      })
    })

    await page.reload()

    // Check for loading states (should be announced to screen readers)
    await expect(page.locator('[aria-live="polite"]').or(page.locator('[aria-live="assertive"]'))).toBeVisible()
    
    // Check for status updates when actions are performed
    await page.fill('[data-testid="search-input"]', 'test')
    
    // Should provide feedback about search results
    await expect(page.locator('[role="status"]').or(page.locator('[aria-live]'))).toBeVisible()
  })

  test('should work with high contrast mode', async ({ page }) => {
    // Enable high contrast mode (simulated)
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['color-contrast'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should respect reduced motion preferences', async ({ page }) => {
    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' })
    
    await page.reload()
    
    // Check that animations are reduced or disabled
    // This would need to be implemented in the CSS with @media (prefers-reduced-motion: reduce)
    const animatedElement = page.locator('.animate-pulse').first()
    if (await animatedElement.count() > 0) {
      const animationDuration = await animatedElement.evaluate(el => {
        return window.getComputedStyle(el).animationDuration
      })
      
      // Animation should be very fast or none when reduced motion is preferred
      expect(['0s', 'none'].includes(animationDuration)).toBeTruthy()
    }
  })

  test('should have accessible form labels and error messages', async ({ page }) => {
    // Test search form accessibility
    const searchInput = page.locator('[data-testid="search-input"]')
    
    await expect(searchInput).toHaveAttribute('aria-label')
    
    // If there's a form with validation, test error message accessibility
    // Mock a form submission with errors
    await page.route('**/api/contact', route => {
      route.fulfill({
        status: 400,
        json: { errors: { email: 'Invalid email format' } }
      })
    })
    
    // Check if error messages are properly associated with form fields
    const errorMessage = page.locator('[role="alert"]').or(page.locator('[aria-describedby]'))
    if (await errorMessage.count() > 0) {
      await expect(errorMessage).toBeVisible()
    }
  })

  test('should work with browser zoom up to 200%', async ({ page }) => {
    // Test at 200% zoom
    await page.setViewportSize({ width: 640, height: 480 }) // Simulates 200% zoom on 1280x960
    
    await page.reload()
    
    // Essential functionality should still be accessible
    await expect(page.locator('[data-testid="wallet-connect-button"]')).toBeVisible()
    
    // Content should not be cut off or overlap
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should provide text alternatives for images', async ({ page }) => {
    // Mock wallet connection and NFT data
    await page.addInitScript(() => {
      localStorage.setItem('walletAdapter', JSON.stringify({
        connected: true,
        publicKey: '11111111111111111111111111111111'
      }))
    })

    await page.route('**/api/nfts', route => {
      route.fulfill({
        json: {
          nfts: [{
            mint: '1111',
            name: 'Accessibility Test NFT',
            image: 'https://example.com/nft.png',
            isStaked: false
          }]
        }
      })
    })

    await page.reload()
    
    // Check that NFT images have proper alt text
    const nftImages = page.locator('img[src*="nft"]')
    if (await nftImages.count() > 0) {
      await expect(nftImages.first()).toHaveAttribute('alt')
      
      const altText = await nftImages.first().getAttribute('alt')
      expect(altText).toBeTruthy()
      expect(altText?.length).toBeGreaterThan(0)
    }
  })
})