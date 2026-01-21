import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login')

      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
      await expect(page.getByLabel(/email/i)).toBeVisible()
      await expect(page.getByLabel(/password/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    })

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login')

      await page.getByLabel(/email/i).fill('invalid@example.com')
      await page.getByLabel(/password/i).fill('wrongpassword')
      await page.getByRole('button', { name: /sign in/i }).click()

      await expect(page.getByText(/invalid/i)).toBeVisible()
    })

    test('should have link to signup page', async ({ page }) => {
      await page.goto('/login')

      const signupLink = page.getByRole('link', { name: /sign up|create account/i })
      await expect(signupLink).toBeVisible()
    })
  })

  test.describe('Signup Page', () => {
    test('should display signup form', async ({ page }) => {
      await page.goto('/signup')

      await expect(page.getByRole('heading', { name: /sign up|create account/i })).toBeVisible()
      await expect(page.getByLabel(/email/i)).toBeVisible()
      await expect(page.getByLabel(/password/i)).toBeVisible()
    })

    test('should show error for existing email', async ({ page }) => {
      // This test would need a seeded user in the test database
      test.skip()
    })
  })

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing decks without auth', async ({ page }) => {
      await page.goto('/decks')

      // Should redirect to login
      await expect(page).toHaveURL(/login/)
    })

    test('should redirect to login when accessing new deck without auth', async ({ page }) => {
      await page.goto('/decks/new')

      // Should redirect to login
      await expect(page).toHaveURL(/login/)
    })
  })
})
