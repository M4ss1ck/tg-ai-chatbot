import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PremiumService } from './premium.js'

// Mock config first
vi.mock('../config/index.js', () => ({
    redisUrl: 'redis://localhost:6379'
}))

// Create mock Redis instance
const mockRedis = {
    sadd: vi.fn(),
    srem: vi.fn(),
    sismember: vi.fn(),
    smembers: vi.fn(),
    quit: vi.fn(),
    connect: vi.fn(),
    on: vi.fn(),
}

// Mock ioredis
vi.mock('ioredis', () => ({
    Redis: vi.fn().mockImplementation(() => mockRedis)
}))

describe('PremiumService', () => {
    let premiumService: PremiumService

    beforeEach(() => {
        vi.clearAllMocks()
        premiumService = new PremiumService()
    })

    afterEach(async () => {
        try {
            await premiumService.close()
        } catch {
            // Ignore errors in cleanup
        }
    })

    describe('addPremiumUser', () => {
        it('should add a new premium user successfully', async () => {
            mockRedis.sadd.mockResolvedValue(1)

            const result = await premiumService.addPremiumUser('123456')

            expect(result).toBe(true)
            expect(mockRedis.sadd).toHaveBeenCalledWith('premium_users', '123456')
            expect(mockRedis.sadd).toHaveBeenCalledTimes(1)
        })

        it('should return false when user already exists', async () => {
            mockRedis.sadd.mockResolvedValue(0)

            const result = await premiumService.addPremiumUser('123456')

            expect(result).toBe(false)
            expect(mockRedis.sadd).toHaveBeenCalledWith('premium_users', '123456')
        })

        it('should handle Redis errors', async () => {
            mockRedis.sadd.mockRejectedValue(new Error('Redis connection failed'))

            await expect(premiumService.addPremiumUser('123456')).rejects.toThrow('Premium service error: Redis connection failed')
        })

        it('should validate user ID format', async () => {
            await expect(premiumService.addPremiumUser('')).rejects.toThrow('User ID is required and must be a string')
            await expect(premiumService.addPremiumUser('abc')).rejects.toThrow('User ID must contain only numeric characters')
            await expect(premiumService.addPremiumUser('123456789012345678901')).rejects.toThrow('User ID must be between 1 and 20 characters long')
        })
    })

    describe('removePremiumUser', () => {
        it('should remove an existing premium user successfully', async () => {
            mockRedis.srem.mockResolvedValue(1)

            const result = await premiumService.removePremiumUser('123456')

            expect(result).toBe(true)
            expect(mockRedis.srem).toHaveBeenCalledWith('premium_users', '123456')
            expect(mockRedis.srem).toHaveBeenCalledTimes(1)
        })

        it('should return false when user does not exist', async () => {
            mockRedis.srem.mockResolvedValue(0)

            const result = await premiumService.removePremiumUser('123456')

            expect(result).toBe(false)
            expect(mockRedis.srem).toHaveBeenCalledWith('premium_users', '123456')
        })

        it('should handle Redis errors', async () => {
            mockRedis.srem.mockRejectedValue(new Error('Redis connection failed'))

            await expect(premiumService.removePremiumUser('123456')).rejects.toThrow('Premium service error: Redis connection failed')
        })

        it('should validate user ID format', async () => {
            await expect(premiumService.removePremiumUser('')).rejects.toThrow('User ID is required and must be a string')
            await expect(premiumService.removePremiumUser('abc')).rejects.toThrow('User ID must contain only numeric characters')
            await expect(premiumService.removePremiumUser('123456789012345678901')).rejects.toThrow('User ID must be between 1 and 20 characters long')
        })
    })

    describe('isPremiumUser', () => {
        it('should return true for existing premium user', async () => {
            mockRedis.sismember.mockResolvedValue(1)

            const result = await premiumService.isPremiumUser('123456')

            expect(result).toBe(true)
            expect(mockRedis.sismember).toHaveBeenCalledWith('premium_users', '123456')
            expect(mockRedis.sismember).toHaveBeenCalledTimes(1)
        })

        it('should return false for non-premium user', async () => {
            mockRedis.sismember.mockResolvedValue(0)

            const result = await premiumService.isPremiumUser('123456')

            expect(result).toBe(false)
            expect(mockRedis.sismember).toHaveBeenCalledWith('premium_users', '123456')
        })

        it('should handle Redis errors gracefully and return false', async () => {
            mockRedis.sismember.mockRejectedValue(new Error('Redis connection failed'))
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            const result = await premiumService.isPremiumUser('123456')

            expect(result).toBe(false)
            expect(consoleSpy).toHaveBeenCalledWith(
                'Error checking premium status for user 123456:',
                expect.any(Error)
            )

            consoleSpy.mockRestore()
        })

        it('should validate user ID format and return false on invalid input', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            const result1 = await premiumService.isPremiumUser('')
            const result2 = await premiumService.isPremiumUser('abc')
            const result3 = await premiumService.isPremiumUser('123456789012345678901')

            expect(result1).toBe(false)
            expect(result2).toBe(false)
            expect(result3).toBe(false)
            expect(consoleSpy).toHaveBeenCalledTimes(3)

            consoleSpy.mockRestore()
        })
    })

    describe('listPremiumUsers', () => {
        it('should return list of premium users', async () => {
            const mockUsers = ['123456', '789012', '345678']
            mockRedis.smembers.mockResolvedValue(mockUsers)

            const result = await premiumService.listPremiumUsers()

            expect(result).toEqual(mockUsers)
            expect(mockRedis.smembers).toHaveBeenCalledWith('premium_users')
            expect(mockRedis.smembers).toHaveBeenCalledTimes(1)
        })

        it('should return empty array when no premium users exist', async () => {
            mockRedis.smembers.mockResolvedValue([])

            const result = await premiumService.listPremiumUsers()

            expect(result).toEqual([])
            expect(mockRedis.smembers).toHaveBeenCalledWith('premium_users')
        })

        it('should handle Redis errors', async () => {
            mockRedis.smembers.mockRejectedValue(new Error('Redis connection failed'))

            await expect(premiumService.listPremiumUsers()).rejects.toThrow('Premium service error: Redis connection failed')
        })
    })

    describe('close', () => {
        it('should close Redis connection', async () => {
            mockRedis.quit.mockResolvedValue('OK')

            await premiumService.close()

            expect(mockRedis.quit).toHaveBeenCalledTimes(1)
        })

        it('should handle Redis close errors', async () => {
            mockRedis.quit.mockRejectedValue(new Error('Failed to close connection'))

            await expect(premiumService.close()).rejects.toThrow('Failed to close connection')
        })
    })

    describe('Redis key consistency', () => {
        it('should use consistent Redis key for all operations', async () => {
            mockRedis.sadd.mockResolvedValue(1)
            mockRedis.srem.mockResolvedValue(1)
            mockRedis.sismember.mockResolvedValue(1)
            mockRedis.smembers.mockResolvedValue([])

            await premiumService.addPremiumUser('123')
            await premiumService.removePremiumUser('123')
            await premiumService.isPremiumUser('123')
            await premiumService.listPremiumUsers()

            expect(mockRedis.sadd).toHaveBeenCalledWith('premium_users', '123')
            expect(mockRedis.srem).toHaveBeenCalledWith('premium_users', '123')
            expect(mockRedis.sismember).toHaveBeenCalledWith('premium_users', '123')
            expect(mockRedis.smembers).toHaveBeenCalledWith('premium_users')
        })
    })
})