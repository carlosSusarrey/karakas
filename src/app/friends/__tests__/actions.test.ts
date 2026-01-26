import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the dependencies
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: vi.fn(),
    },
    friendship: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  cancelFriendRequest,
} from '../actions'

describe('Friends Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendFriendRequest', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await sendFriendRequest('testuser')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when username is empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const result = await sendFriendRequest('')

      expect(result).toEqual({ error: 'Username or email is required' })
    })

    it('returns error when username is only whitespace', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const result = await sendFriendRequest('   ')

      expect(result).toEqual({ error: 'Username or email is required' })
    })

    it('returns error when target user not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.user.findFirst).mockResolvedValue(null)

      const result = await sendFriendRequest('nonexistent')

      expect(result).toEqual({ error: 'User not found' })
    })

    it('returns error when trying to add self as friend', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.user.findFirst).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await sendFriendRequest('testuser')

      expect(result).toEqual({ error: 'You cannot add yourself as a friend' })
    })

    it('returns error when already friends', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.user.findFirst).mockResolvedValue({
        id: 'user-2',
        email: 'friend@example.com',
        username: 'friend',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.findFirst).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'accepted',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await sendFriendRequest('friend')

      expect(result).toEqual({ error: 'You are already friends with this user' })
    })

    it('returns error when request already sent', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.user.findFirst).mockResolvedValue({
        id: 'user-2',
        email: 'friend@example.com',
        username: 'friend',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.findFirst).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await sendFriendRequest('friend')

      expect(result).toEqual({ error: 'Friend request already sent' })
    })

    it('accepts incoming request instead of sending new one', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.user.findFirst).mockResolvedValue({
        id: 'user-2',
        email: 'friend@example.com',
        username: 'friend',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.findFirst).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-2', // They sent us the request
        addresseeId: 'user-1',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.update).mockResolvedValue({} as never)

      const result = await sendFriendRequest('friend')

      expect(result).toEqual({ success: true, message: 'Friend request accepted' })
      expect(db.friendship.update).toHaveBeenCalledWith({
        where: { id: 'friendship-1' },
        data: { status: 'accepted' },
      })
    })

    it('allows resending request after decline', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.user.findFirst).mockResolvedValue({
        id: 'user-2',
        email: 'friend@example.com',
        username: 'friend',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.findFirst).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-2',
        addresseeId: 'user-1',
        status: 'declined',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.update).mockResolvedValue({} as never)

      const result = await sendFriendRequest('friend')

      expect(result).toEqual({ success: true })
      expect(db.friendship.update).toHaveBeenCalledWith({
        where: { id: 'friendship-1' },
        data: { requesterId: 'user-1', addresseeId: 'user-2', status: 'pending' },
      })
    })

    it('creates new friend request', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.user.findFirst).mockResolvedValue({
        id: 'user-2',
        email: 'friend@example.com',
        username: 'friend',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.findFirst).mockResolvedValue(null)
      vi.mocked(db.friendship.create).mockResolvedValue({} as never)

      const result = await sendFriendRequest('friend')

      expect(result).toEqual({ success: true })
      expect(db.friendship.create).toHaveBeenCalledWith({
        data: {
          requesterId: 'user-1',
          addresseeId: 'user-2',
          status: 'pending',
        },
      })
    })

    it('finds user by email', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.user.findFirst).mockResolvedValue({
        id: 'user-2',
        email: 'friend@example.com',
        username: 'friend',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.findFirst).mockResolvedValue(null)
      vi.mocked(db.friendship.create).mockResolvedValue({} as never)

      await sendFriendRequest('friend@example.com')

      expect(db.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: 'friend@example.com' },
            { email: 'friend@example.com' },
          ],
        },
      })
    })

    it('normalizes search term to lowercase', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.user.findFirst).mockResolvedValue(null)

      await sendFriendRequest('  FRIEND@EXAMPLE.COM  ')

      expect(db.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: 'friend@example.com' },
            { email: 'friend@example.com' },
          ],
        },
      })
    })
  })

  describe('acceptFriendRequest', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await acceptFriendRequest('friendship-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when friendship not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue(null)

      const result = await acceptFriendRequest('nonexistent')

      expect(result).toEqual({ error: 'Friend request not found' })
    })

    it('returns error when user is not the addressee', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2', // Different user
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await acceptFriendRequest('friendship-1')

      expect(result).toEqual({ error: 'You cannot accept this request' })
    })

    it('returns error when request is not pending', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-2',
        addresseeId: 'user-1',
        status: 'accepted',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await acceptFriendRequest('friendship-1')

      expect(result).toEqual({ error: 'This request has already been processed' })
    })

    it('successfully accepts friend request', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-2',
        addresseeId: 'user-1',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.update).mockResolvedValue({} as never)

      const result = await acceptFriendRequest('friendship-1')

      expect(result).toEqual({ success: true })
      expect(db.friendship.update).toHaveBeenCalledWith({
        where: { id: 'friendship-1' },
        data: { status: 'accepted' },
      })
    })
  })

  describe('declineFriendRequest', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await declineFriendRequest('friendship-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when friendship not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue(null)

      const result = await declineFriendRequest('nonexistent')

      expect(result).toEqual({ error: 'Friend request not found' })
    })

    it('returns error when user is not the addressee', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await declineFriendRequest('friendship-1')

      expect(result).toEqual({ error: 'You cannot decline this request' })
    })

    it('successfully declines friend request', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-2',
        addresseeId: 'user-1',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.update).mockResolvedValue({} as never)

      const result = await declineFriendRequest('friendship-1')

      expect(result).toEqual({ success: true })
      expect(db.friendship.update).toHaveBeenCalledWith({
        where: { id: 'friendship-1' },
        data: { status: 'declined' },
      })
    })
  })

  describe('removeFriend', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await removeFriend('friendship-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when friendship not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue(null)

      const result = await removeFriend('nonexistent')

      expect(result).toEqual({ error: 'Friendship not found' })
    })

    it('returns error when user is not part of the friendship', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-2',
        addresseeId: 'user-3',
        status: 'accepted',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await removeFriend('friendship-1')

      expect(result).toEqual({ error: 'You are not part of this friendship' })
    })

    it('successfully removes friendship as requester', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'accepted',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.delete).mockResolvedValue({} as never)

      const result = await removeFriend('friendship-1')

      expect(result).toEqual({ success: true })
      expect(db.friendship.delete).toHaveBeenCalledWith({
        where: { id: 'friendship-1' },
      })
    })

    it('successfully removes friendship as addressee', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-2',
        addresseeId: 'user-1',
        status: 'accepted',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.delete).mockResolvedValue({} as never)

      const result = await removeFriend('friendship-1')

      expect(result).toEqual({ success: true })
    })
  })

  describe('cancelFriendRequest', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await cancelFriendRequest('friendship-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when friendship not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue(null)

      const result = await cancelFriendRequest('nonexistent')

      expect(result).toEqual({ error: 'Friend request not found' })
    })

    it('returns error when user is not the requester', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-2',
        addresseeId: 'user-1',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await cancelFriendRequest('friendship-1')

      expect(result).toEqual({ error: 'You can only cancel your own requests' })
    })

    it('returns error when request is not pending', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'accepted',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await cancelFriendRequest('friendship-1')

      expect(result).toEqual({ error: 'This request is no longer pending' })
    })

    it('successfully cancels friend request', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.friendship.findUnique).mockResolvedValue({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.friendship.delete).mockResolvedValue({} as never)

      const result = await cancelFriendRequest('friendship-1')

      expect(result).toEqual({ success: true })
      expect(db.friendship.delete).toHaveBeenCalledWith({
        where: { id: 'friendship-1' },
      })
    })
  })
})
