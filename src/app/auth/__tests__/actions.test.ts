import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the dependencies
vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  updatePassword: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn(),
}))

vi.mock('@/lib/password-reset', () => ({
  createPasswordResetToken: vi.fn(),
  consumePasswordResetToken: vi.fn(),
}))

import { signIn, signUp, updatePassword } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { createPasswordResetToken, consumePasswordResetToken } from '@/lib/password-reset'
import { login } from '../../login/actions'
import { signup } from '../../signup/actions'
import { requestPasswordReset } from '../../forgot-password/actions'
import { resetPassword } from '../../reset-password/[token]/actions'

// Helper to create FormData
function createFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(data)) {
    formData.set(key, value)
  }
  return formData
}

describe('Auth Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('returns error when email is missing', async () => {
      const formData = createFormData({ password: 'password123' })
      const result = await login(formData)

      expect(result).toEqual({ error: 'Email and password are required' })
    })

    it('returns error when password is missing', async () => {
      const formData = createFormData({ email: 'test@example.com' })
      const result = await login(formData)

      expect(result).toEqual({ error: 'Email and password are required' })
    })

    it('returns error when both email and password are missing', async () => {
      const formData = createFormData({})
      const result = await login(formData)

      expect(result).toEqual({ error: 'Email and password are required' })
    })

    it('returns error from signIn when credentials are invalid', async () => {
      vi.mocked(signIn).mockResolvedValue({ error: 'Invalid email or password' })

      const formData = createFormData({
        email: 'test@example.com',
        password: 'wrongpassword',
      })
      const result = await login(formData)

      expect(result).toEqual({ error: 'Invalid email or password' })
      expect(signIn).toHaveBeenCalledWith('test@example.com', 'wrongpassword')
    })

    it('returns success when credentials are valid', async () => {
      vi.mocked(signIn).mockResolvedValue({ success: true })

      const formData = createFormData({
        email: 'test@example.com',
        password: 'correctpassword',
      })
      const result = await login(formData)

      expect(result).toEqual({ success: true })
      expect(signIn).toHaveBeenCalledWith('test@example.com', 'correctpassword')
    })
  })

  describe('signup', () => {
    it('returns error when username is missing', async () => {
      const formData = createFormData({
        email: 'test@example.com',
        password: 'password123',
      })
      const result = await signup(formData)

      expect(result).toEqual({ error: 'All fields are required' })
    })

    it('returns error when email is missing', async () => {
      const formData = createFormData({
        username: 'testuser',
        password: 'password123',
      })
      const result = await signup(formData)

      expect(result).toEqual({ error: 'All fields are required' })
    })

    it('returns error when password is missing', async () => {
      const formData = createFormData({
        username: 'testuser',
        email: 'test@example.com',
      })
      const result = await signup(formData)

      expect(result).toEqual({ error: 'All fields are required' })
    })

    it('returns error when username is too short', async () => {
      const formData = createFormData({
        username: 'ab',
        email: 'test@example.com',
        password: 'password123',
      })
      const result = await signup(formData)

      expect(result).toEqual({ error: 'Username must be between 3 and 20 characters' })
    })

    it('returns error when username is too long', async () => {
      const formData = createFormData({
        username: 'a'.repeat(21),
        email: 'test@example.com',
        password: 'password123',
      })
      const result = await signup(formData)

      expect(result).toEqual({ error: 'Username must be between 3 and 20 characters' })
    })

    it('returns error when password is too short', async () => {
      const formData = createFormData({
        username: 'testuser',
        email: 'test@example.com',
        password: 'short',
      })
      const result = await signup(formData)

      expect(result).toEqual({ error: 'Password must be at least 8 characters' })
    })

    it('returns error from signUp when email already exists', async () => {
      vi.mocked(signUp).mockResolvedValue({ error: 'Email already in use' })

      const formData = createFormData({
        username: 'testuser',
        email: 'existing@example.com',
        password: 'password123',
      })
      const result = await signup(formData)

      expect(result).toEqual({ error: 'Email already in use' })
    })

    it('returns success when signup is valid', async () => {
      vi.mocked(signUp).mockResolvedValue({ success: true })

      const formData = createFormData({
        username: 'testuser',
        email: 'new@example.com',
        password: 'password123',
      })
      const result = await signup(formData)

      expect(result).toEqual({ success: true })
      expect(signUp).toHaveBeenCalledWith('new@example.com', 'testuser', 'password123')
    })

    it('accepts username at minimum length (3)', async () => {
      vi.mocked(signUp).mockResolvedValue({ success: true })

      const formData = createFormData({
        username: 'abc',
        email: 'test@example.com',
        password: 'password123',
      })
      const result = await signup(formData)

      expect(result).toEqual({ success: true })
    })

    it('accepts username at maximum length (20)', async () => {
      vi.mocked(signUp).mockResolvedValue({ success: true })

      const formData = createFormData({
        username: 'a'.repeat(20),
        email: 'test@example.com',
        password: 'password123',
      })
      const result = await signup(formData)

      expect(result).toEqual({ success: true })
    })

    it('accepts password at minimum length (8)', async () => {
      vi.mocked(signUp).mockResolvedValue({ success: true })

      const formData = createFormData({
        username: 'testuser',
        email: 'test@example.com',
        password: '12345678',
      })
      const result = await signup(formData)

      expect(result).toEqual({ success: true })
    })
  })

  describe('requestPasswordReset', () => {
    it('returns error when email is missing', async () => {
      const formData = createFormData({})
      const result = await requestPasswordReset(formData)

      expect(result).toEqual({ error: 'Email is required' })
    })

    it('returns success when user not found (prevents email enumeration)', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null)

      const formData = createFormData({ email: 'nonexistent@example.com' })
      const result = await requestPasswordReset(formData)

      expect(result).toEqual({ success: true })
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('returns success for OAuth-only users without sending email', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'oauth@example.com',
        username: 'oauthuser',
        passwordHash: null, // OAuth-only user
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({ email: 'oauth@example.com' })
      const result = await requestPasswordReset(formData)

      expect(result).toEqual({ success: true })
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('sends reset email for valid user with password', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(createPasswordResetToken).mockResolvedValue('reset-token-123')

      const formData = createFormData({ email: 'test@example.com' })
      const result = await requestPasswordReset(formData)

      expect(result).toEqual({ success: true })
      expect(createPasswordResetToken).toHaveBeenCalledWith('user-1')
      expect(sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com', 'reset-token-123')
    })

    it('normalizes email to lowercase', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null)

      const formData = createFormData({ email: 'TEST@EXAMPLE.COM' })
      await requestPasswordReset(formData)

      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })
  })

  describe('resetPassword', () => {
    it('returns error when password is missing', async () => {
      const formData = createFormData({ confirmPassword: 'password123' })
      const result = await resetPassword('token-123', formData)

      expect(result).toEqual({ error: 'Password must be at least 8 characters' })
    })

    it('returns error when password is too short', async () => {
      const formData = createFormData({
        password: 'short',
        confirmPassword: 'short',
      })
      const result = await resetPassword('token-123', formData)

      expect(result).toEqual({ error: 'Password must be at least 8 characters' })
    })

    it('returns error when passwords do not match', async () => {
      const formData = createFormData({
        password: 'password123',
        confirmPassword: 'differentpassword',
      })
      const result = await resetPassword('token-123', formData)

      expect(result).toEqual({ error: 'Passwords do not match' })
    })

    it('returns error when token is invalid', async () => {
      vi.mocked(consumePasswordResetToken).mockResolvedValue({
        success: false,
        error: 'Invalid or expired token',
      })

      const formData = createFormData({
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      })
      const result = await resetPassword('invalid-token', formData)

      expect(result).toEqual({ error: 'Invalid or expired token' })
    })

    it('returns error when token is expired', async () => {
      vi.mocked(consumePasswordResetToken).mockResolvedValue({
        success: false,
        error: 'Token has expired',
      })

      const formData = createFormData({
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      })
      const result = await resetPassword('expired-token', formData)

      expect(result).toEqual({ error: 'Token has expired' })
    })

    it('returns generic error when token validation fails without message', async () => {
      vi.mocked(consumePasswordResetToken).mockResolvedValue({
        success: false,
      })

      const formData = createFormData({
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      })
      const result = await resetPassword('bad-token', formData)

      expect(result).toEqual({ error: 'Invalid or expired reset link' })
    })

    it('successfully resets password', async () => {
      vi.mocked(consumePasswordResetToken).mockResolvedValue({
        success: true,
        userId: 'user-1',
      })

      const formData = createFormData({
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      })
      const result = await resetPassword('valid-token', formData)

      expect(result).toEqual({ success: true })
      expect(consumePasswordResetToken).toHaveBeenCalledWith('valid-token')
      expect(updatePassword).toHaveBeenCalledWith('user-1', 'newpassword123')
    })

    it('accepts password at minimum length (8)', async () => {
      vi.mocked(consumePasswordResetToken).mockResolvedValue({
        success: true,
        userId: 'user-1',
      })

      const formData = createFormData({
        password: '12345678',
        confirmPassword: '12345678',
      })
      const result = await resetPassword('valid-token', formData)

      expect(result).toEqual({ success: true })
    })
  })
})
