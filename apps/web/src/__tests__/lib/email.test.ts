import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store original env
const originalEnv = { ...process.env }

describe('Email Library', () => {
  beforeEach(() => {
    vi.resetModules()
    // Reset env vars
    delete process.env.RESEND_API_KEY
    delete process.env.FROM_EMAIL
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  describe('sendPasswordResetEmail (dev mode)', () => {
    it('logs to console when RESEND_API_KEY is not set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Import fresh module without RESEND_API_KEY
      const { sendPasswordResetEmail } = await import('@/lib/email')

      const result = await sendPasswordResetEmail('test@example.com', 'reset-token-123')

      expect(result).toEqual({ success: true })
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PASSWORD RESET EMAIL'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('To: test@example.com'))
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3000/reset-password/reset-token-123')
      )

      consoleSpy.mockRestore()
    })

    it('uses custom APP_URL when set', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://karakas.example.com'

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { sendPasswordResetEmail } = await import('@/lib/email')

      await sendPasswordResetEmail('test@example.com', 'token-abc')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://karakas.example.com/reset-password/token-abc')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('sendPasswordResetEmail (production mode)', () => {
    it('sends email via Resend when API key is set', async () => {
      process.env.RESEND_API_KEY = 'test-api-key'
      process.env.FROM_EMAIL = 'noreply@test.com'
      process.env.NEXT_PUBLIC_APP_URL = 'https://karakas.app'

      // Mock Resend
      const mockSend = vi.fn().mockResolvedValue({ error: null })
      vi.doMock('resend', () => ({
        Resend: vi.fn().mockImplementation(() => ({
          emails: { send: mockSend },
        })),
      }))

      const { sendPasswordResetEmail } = await import('@/lib/email')

      const result = await sendPasswordResetEmail('user@example.com', 'reset-token-xyz')

      expect(result).toEqual({ success: true })
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@test.com',
          to: 'user@example.com',
          subject: 'Reset your Karakas password',
        })
      )
    })

    it('returns error when Resend fails', async () => {
      process.env.RESEND_API_KEY = 'test-api-key'

      const mockSend = vi.fn().mockResolvedValue({ error: { message: 'Rate limited' } })
      vi.doMock('resend', () => ({
        Resend: vi.fn().mockImplementation(() => ({
          emails: { send: mockSend },
        })),
      }))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { sendPasswordResetEmail } = await import('@/lib/email')

      const result = await sendPasswordResetEmail('user@example.com', 'token')

      expect(result).toEqual({ success: false, error: 'Rate limited' })

      consoleSpy.mockRestore()
    })

    it('handles exceptions gracefully', async () => {
      process.env.RESEND_API_KEY = 'test-api-key'

      const mockSend = vi.fn().mockRejectedValue(new Error('Network failure'))
      vi.doMock('resend', () => ({
        Resend: vi.fn().mockImplementation(() => ({
          emails: { send: mockSend },
        })),
      }))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { sendPasswordResetEmail } = await import('@/lib/email')

      const result = await sendPasswordResetEmail('user@example.com', 'token')

      expect(result).toEqual({ success: false, error: 'Network failure' })

      consoleSpy.mockRestore()
    })
  })
})
