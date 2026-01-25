import { test, expect } from '@playwright/test'

// Helper to login before tests that require authentication
async function login(page: import('@playwright/test').Page) {
  // This would use test credentials from a seeded database
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('test@example.com')
  await page.getByLabel(/password/i).fill('testpassword123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('/')
}

test.describe('Playgroup Player Deck Management', () => {
  test.describe('Deck List Page', () => {
    test.skip('should display deck list for unregistered player', async ({ page }) => {
      await login(page)
      // Navigate to a playgroup player's decks page
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('button', { name: /add deck/i })).toBeVisible()
    })

    test.skip('should show empty state when player has no decks', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await expect(page.getByText(/no decks/i)).toBeVisible()
    })

    test.skip('should display active and archived decks separately', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      // Active decks section should be visible
      await expect(page.getByText(/active decks/i)).toBeVisible()

      // Archived section might be collapsed or hidden when empty
    })
  })

  test.describe('Add Deck Form', () => {
    test.skip('should show add deck form when button clicked', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /add deck/i }).click()

      await expect(page.getByLabel(/deck name/i)).toBeVisible()
      await expect(page.getByLabel(/format/i)).toBeVisible()
    })

    test.skip('should show commander fields when Commander format selected', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /add deck/i }).click()

      // Commander is the default format, so commander fields should be visible
      await expect(page.getByLabel(/commander$/i)).toBeVisible()
      await expect(page.getByLabel(/partner commander/i)).toBeVisible()
      await expect(page.getByLabel(/edh bracket/i)).toBeVisible()
    })

    test.skip('should hide commander fields for non-Commander formats', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /add deck/i }).click()
      await page.getByLabel(/format/i).selectOption('modern')

      await expect(page.getByLabel(/commander$/i)).not.toBeVisible()
      await expect(page.getByLabel(/partner commander/i)).not.toBeVisible()
      await expect(page.getByLabel(/edh bracket/i)).not.toBeVisible()
    })

    test.skip('should show decklist URL field', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /add deck/i }).click()

      await expect(page.getByLabel(/decklist url/i)).toBeVisible()
    })

    test.skip('should show validation error when name is empty', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /add deck/i }).click()
      // Leave name empty and submit
      await page.getByRole('button', { name: /create deck/i }).click()

      // HTML5 validation should prevent submission, or server-side error should show
      await expect(page.getByLabel(/deck name/i)).toHaveAttribute('required')
    })

    test.skip('should create deck with minimal valid data', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /add deck/i }).click()
      await page.getByLabel(/deck name/i).fill('Test Modern Deck')
      await page.getByLabel(/format/i).selectOption('modern')
      await page.getByRole('button', { name: /create deck/i }).click()

      // Form should close and deck should appear in list
      await expect(page.getByText('Test Modern Deck')).toBeVisible()
    })

    test.skip('should create commander deck with all fields', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /add deck/i }).click()
      await page.getByLabel(/deck name/i).fill('Krenko Goblins')
      await page.getByLabel(/format/i).selectOption('commander')
      await page.getByLabel(/commander$/i).fill('Krenko, Mob Boss')
      await page.getByLabel(/edh bracket/i).selectOption('2')
      await page.getByLabel(/decklist url/i).fill('https://moxfield.com/decks/abc123')
      await page.getByRole('button', { name: /create deck/i }).click()

      // Form should close and deck should appear in list
      await expect(page.getByText('Krenko Goblins')).toBeVisible()
      await expect(page.getByText('Krenko, Mob Boss')).toBeVisible()
    })

    test.skip('should create deck with partner commanders', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /add deck/i }).click()
      await page.getByLabel(/deck name/i).fill('Partner Deck')
      await page.getByLabel(/format/i).selectOption('commander')
      await page.getByLabel(/commander$/i).fill('Thrasios, Triton Hero')
      await page.getByLabel(/partner commander/i).fill('Tymna the Weaver')
      await page.getByLabel(/edh bracket/i).selectOption('4')
      await page.getByRole('button', { name: /create deck/i }).click()

      await expect(page.getByText('Partner Deck')).toBeVisible()
      await expect(page.getByText('Thrasios, Triton Hero')).toBeVisible()
      await expect(page.getByText('Tymna the Weaver')).toBeVisible()
    })

    test.skip('should cancel form and hide it', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /add deck/i }).click()
      await expect(page.getByLabel(/deck name/i)).toBeVisible()

      await page.getByRole('button', { name: /cancel/i }).click()

      await expect(page.getByLabel(/deck name/i)).not.toBeVisible()
      await expect(page.getByRole('button', { name: /add deck/i })).toBeVisible()
    })
  })

  test.describe('Deck Actions', () => {
    test.skip('should show edit, archive, and delete buttons for deck', async ({ page }) => {
      await login(page)
      // Assuming there's a deck already created
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      // Find deck actions for a specific deck
      await expect(page.getByRole('button', { name: /edit/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /archive/i })).toBeVisible()
    })

    test.skip('should show edit form when edit clicked', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /edit/i }).first().click()

      await expect(page.getByLabel(/deck name/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
    })

    test.skip('should update deck on save', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /edit/i }).first().click()
      await page.getByLabel(/deck name/i).fill('Updated Deck Name')
      await page.getByRole('button', { name: /save/i }).click()

      await expect(page.getByText('Updated Deck Name')).toBeVisible()
    })

    test.skip('should archive deck', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /archive/i }).first().click()

      // Deck should move to archived section
      await expect(page.getByText(/archived/i)).toBeVisible()
    })

    test.skip('should restore archived deck', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      // Find restore button in archived section
      await page.getByRole('button', { name: /restore/i }).first().click()

      // Deck should move back to active section
    })
  })

  test.describe('Format-specific behavior', () => {
    test.skip('should show bracket field only for Commander format', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /add deck/i }).click()

      // Commander - bracket should be visible
      await page.getByLabel(/format/i).selectOption('commander')
      await expect(page.getByLabel(/edh bracket/i)).toBeVisible()

      // Modern - bracket should not be visible
      await page.getByLabel(/format/i).selectOption('modern')
      await expect(page.getByLabel(/edh bracket/i)).not.toBeVisible()

      // Oathbreaker - commander fields but no bracket
      await page.getByLabel(/format/i).selectOption('oathbreaker')
      await expect(page.getByLabel(/commander$/i)).toBeVisible()
      await expect(page.getByLabel(/edh bracket/i)).not.toBeVisible()
    })

    test.skip('should show commander fields for Brawl format', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await page.getByRole('button', { name: /add deck/i }).click()
      await page.getByLabel(/format/i).selectOption('brawl')

      await expect(page.getByLabel(/commander$/i)).toBeVisible()
      await expect(page.getByLabel(/partner commander/i)).toBeVisible()
    })
  })

  test.describe('Access Control', () => {
    test.skip('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      await expect(page).toHaveURL(/\/login/)
    })

    test.skip('should show error when not a member of playgroup', async ({ page }) => {
      await login(page)
      // Try to access a playgroup user is not a member of
      await page.goto('/playgroups/other-playgroup/players/test-player/decks')

      await expect(page.getByText(/not a member/i)).toBeVisible()
    })
  })

  test.describe('Deck Display', () => {
    test.skip('should display format badge on deck card', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      // Look for format badge like "Commander" or "Modern"
      await expect(page.getByText(/commander|modern|legacy/i)).toBeVisible()
    })

    test.skip('should display bracket badge for Commander decks', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      // Look for bracket badge like "Bracket 2"
      await expect(page.getByText(/bracket \d/i)).toBeVisible()
    })

    test.skip('should display game count on deck card', async ({ page }) => {
      await login(page)
      await page.goto('/playgroups/test-playgroup/players/test-player/decks')

      // Look for game count like "5 games" or "0 games"
      await expect(page.getByText(/\d+ games?/i)).toBeVisible()
    })
  })
})
