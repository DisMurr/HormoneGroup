import { test, expect } from '@playwright/test'

test('Our Tests page renders products', async ({ page }) => {
  await page.goto('http://localhost:3000/tests')
  await expect(page.getByRole('heading', { name: 'Our Tests' })).toBeVisible()
  // at least one product card renders
  await expect(page.locator('li:has-text("View details")').first()).toBeVisible()
})
