import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BotContext, initial } from '../context/botContext.js'
import { PremiumService } from '../services/premium.js'
import { premiumService } from '../services/premium.js'
import { processCommand } from '../utils/ai.js'
import { aiModels } from '../config/index.js'

// Mock Redis
const mockRedis = {
    sadd: vi.fn(),
    srem: vi.fn(),
    sismember: vi.fn(),
    smembers: vi.fn(),
    quit: vi.fn(),
    connect: vi.fn(),
    on: vi.fn(),
}

vi.mock('ioredis', () => ({
    Redis: vi.fn().mockImplementation(() => mockRedis)
}))

// Mock config
vi.mock('../config/index.js', async () => {
    const actual = await vi.importActual('../config/index.js')
    return {
        ...actual,
        adminId: '999999999',
        redisUrl: 'redis://localhost:6379',
        token: 'test-bot-token',
        apiKey: 'test-api-key',
        cloudflareApiToken: 'test-cloudflare-token',
        cloudflareAccountId: 'test-cloudflare-account'
    }
})

// Mock axios for AI requests
vi.mock('axios', () => ({
    default: {
        post: vi.fn().mockResolvedValue({
            data: {
                choices: [{
                    message: {
                        content: 'Test AI response'
                    }
                }]
            }
        }),
        get: vi.fn()
    }
}))

describe('Premium Functionality Integration Tests', () => {
    let testPremiumService: PremiumService
    let mockContext: Partial<BotContext>

    beforeEach(() => {
        vi.clearAllMocks()
        testPremiumService = new PremiumService()

        mockContext = {
            reply: vi.fn(),
            session: initial(),
            from: {
                id: 123456789,
                is_bot: false,
                first_name: 'Test User'
            },
            msg: {
                message_id: 123,
                text: 'test message'
            } as any,
            api: {
                getFile: vi.fn()
            }
        } as any
    })

    afterEach(async () => {
        try {
            await testPremiumService.close()
        } catch {
            // Ignore cleanup errors
        }
    })

    describe('Complete Admin Workflow', () => {
        it('should complete full admin workflow: add, list, remove premium users', async () => {
            // Step 1: Add premium user
            mockRedis.sadd.mockResolvedValueOnce(1) // User added successfully
            const wasAdded = await testPremiumService.addPremiumUser('123456789')
            expect(wasAdded).toBe(true)
            expect(mockRedis.sadd).toHaveBeenCalledWith('premium_users', '123456789')

            // Step 2: List premium users
            vi.clearAllMocks()
            mockRedis.smembers.mockResolvedValueOnce(['123456789', '987654321'])
            const premiumUsers = await testPremiumService.listPremiumUsers()
            expect(premiumUsers).toEqual(['123456789', '987654321'])
            expect(mockRedis.smembers).toHaveBeenCalledWith('premium_users')

            // Step 3: Remove premium user
            vi.clearAllMocks()
            mockRedis.srem.mockResolvedValueOnce(1) // User removed successfully
            const wasRemoved = await testPremiumService.removePremiumUser('123456789')
            expect(wasRemoved).toBe(true)
            expect(mockRedis.srem).toHaveBeenCalledWith('premium_users', '123456789')
        })

        it('should handle duplicate add operations gracefully', async () => {
            mockRedis.sadd.mockResolvedValueOnce(0) // User already exists
            const wasAdded = await testPremiumService.addPremiumUser('123456789')
            expect(wasAdded).toBe(false)
        })

        it('should handle remove non-existent user gracefully', async () => {
            mockRedis.srem.mockResolvedValueOnce(0) // User doesn't exist
            const wasRemoved = await testPremiumService.removePremiumUser('123456789')
            expect(wasRemoved).toBe(false)
        })

        it('should show empty state when no premium users exist', async () => {
            mockRedis.smembers.mockResolvedValueOnce([])
            const premiumUsers = await testPremiumService.listPremiumUsers()
            expect(premiumUsers).toEqual([])
        })
    })

    describe('Premium User Model Selection and Usage Flow', () => {
        it('should process AI requests with premium models successfully for premium users', async () => {
            const premiumModel = aiModels.find(m => m.premium)
            if (!premiumModel) {
                throw new Error('No premium model found in test setup')
            }

            // Set user as premium
            mockContext.session!.isPremium = true
            mockContext.session!.model = premiumModel

            await processCommand(mockContext as BotContext, 'test message')

            // Should not show access denied message
            expect(mockContext.reply).not.toHaveBeenCalledWith(
                expect.stringContaining("don't have access to premium models")
            )
        })

        it('should allow premium users to check premium status', async () => {
            mockRedis.sismember.mockResolvedValueOnce(1) // User is premium
            const isPremium = await testPremiumService.isPremiumUser('123456789')
            expect(isPremium).toBe(true)
            expect(mockRedis.sismember).toHaveBeenCalledWith('premium_users', '123456789')
        })
    })

    describe('Non-Premium User Access Restrictions', () => {
        it('should fallback non-premium users from premium models during AI processing', async () => {
            const premiumModel = aiModels.find(m => m.premium)
            const freeModel = aiModels.find(m => !m.premium)

            if (!premiumModel || !freeModel) {
                throw new Error('Required models not found in test setup')
            }

            // Set user as non-premium but using premium model (simulating user who lost premium access)
            mockContext.session!.isPremium = false
            mockContext.session!.model = premiumModel

            await processCommand(mockContext as BotContext, 'test message')

            // Should show fallback message
            expect(mockContext.reply).toHaveBeenCalledWith(
                expect.stringContaining("don't have access to premium models"),
                expect.any(Object)
            )

            // Should update session to use free model
            expect(mockContext.session!.model.premium).toBe(false)
        })

        it('should allow non-premium users to use free models', async () => {
            const freeModel = aiModels.find(m => !m.premium)
            if (!freeModel) {
                throw new Error('No free model found in test setup')
            }

            // Set user as non-premium using free model
            mockContext.session!.isPremium = false
            mockContext.session!.model = freeModel

            await processCommand(mockContext as BotContext, 'test message')

            // Should not show access denied message
            expect(mockContext.reply).not.toHaveBeenCalledWith(
                expect.stringContaining("don't have access to premium models")
            )
        })

        it('should return false for non-premium users', async () => {
            mockRedis.sismember.mockResolvedValueOnce(0) // User is not premium
            const isPremium = await testPremiumService.isPremiumUser('123456789')
            expect(isPremium).toBe(false)
            expect(mockRedis.sismember).toHaveBeenCalledWith('premium_users', '123456789')
        })
    })

    describe('ADMIN_ID Automatic Premium Access', () => {
        it('should allow admin to use premium models without Redis check', async () => {
            const premiumModel = aiModels.find(m => m.premium)
            if (!premiumModel) {
                throw new Error('No premium model found in test setup')
            }

            // Set admin context
            mockContext.from!.id = 999999999 // Admin ID from mock config
            mockContext.session!.isPremium = true // Admin should be premium
            mockContext.session!.model = premiumModel

            await processCommand(mockContext as BotContext, 'test message')

            // Should not show access denied message
            expect(mockContext.reply).not.toHaveBeenCalledWith(
                expect.stringContaining("don't have access to premium models")
            )
        })

        it('should handle admin ID correctly in premium service', async () => {
            // Admin should be able to add users
            mockRedis.sadd.mockResolvedValueOnce(1)
            const wasAdded = await testPremiumService.addPremiumUser('123456789')
            expect(wasAdded).toBe(true)
        })
    })

    describe('Session Persistence Across Bot Restarts', () => {
        it('should maintain premium user data in Redis after bot restart simulation', async () => {
            // Add user to premium list
            mockRedis.sadd.mockResolvedValueOnce(1)
            await testPremiumService.addPremiumUser('123456789')

            // Simulate bot restart by creating new service instance
            const newPremiumService = new PremiumService()

            // Check if user is still premium
            mockRedis.sismember.mockResolvedValueOnce(1)
            const isPremium = await newPremiumService.isPremiumUser('123456789')

            expect(isPremium).toBe(true)
            expect(mockRedis.sismember).toHaveBeenCalledWith('premium_users', '123456789')

            await newPremiumService.close()
        })

        it('should initialize new sessions with correct premium status', async () => {
            // Test premium user
            mockRedis.sismember.mockResolvedValueOnce(1)
            const isPremium = await testPremiumService.isPremiumUser('123456789')
            expect(isPremium).toBe(true)

            // Test non-premium user
            vi.clearAllMocks()
            mockRedis.sismember.mockResolvedValueOnce(0)
            const isNotPremium = await testPremiumService.isPremiumUser('987654321')
            expect(isNotPremium).toBe(false)
        })

        it('should handle Redis connection failures gracefully during session load', async () => {
            mockRedis.sismember.mockRejectedValueOnce(new Error('Redis connection failed'))
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            const isPremium = await testPremiumService.isPremiumUser('123456789')

            // Should default to non-premium on Redis failure
            expect(isPremium).toBe(false)
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error checking premium status for user 123456789:',
                expect.any(Error)
            )

            consoleErrorSpy.mockRestore()
        })
    })

    describe('Error Handling and Edge Cases', () => {
        it('should handle invalid user IDs in premium service', async () => {
            await expect(testPremiumService.addPremiumUser('')).rejects.toThrow('User ID is required')
            await expect(testPremiumService.addPremiumUser('invalid')).rejects.toThrow('User ID must contain only numeric characters')
            await expect(testPremiumService.removePremiumUser('')).rejects.toThrow('User ID is required')
            await expect(testPremiumService.removePremiumUser('invalid')).rejects.toThrow('User ID must contain only numeric characters')
        })

        it('should handle Redis service errors in premium operations', async () => {
            mockRedis.sadd.mockRejectedValueOnce(new Error('Redis connection failed'))
            await expect(testPremiumService.addPremiumUser('123456789')).rejects.toThrow('Premium service error: Redis connection failed')

            mockRedis.srem.mockRejectedValueOnce(new Error('Redis connection failed'))
            await expect(testPremiumService.removePremiumUser('123456789')).rejects.toThrow('Premium service error: Redis connection failed')

            mockRedis.smembers.mockRejectedValueOnce(new Error('Redis connection failed'))
            await expect(testPremiumService.listPremiumUsers()).rejects.toThrow('Premium service error: Redis connection failed')
        })

        it('should handle missing user context gracefully in AI processing', async () => {
            const contextWithoutUser = {
                ...mockContext,
                from: undefined
            } as BotContext

            const premiumModel = aiModels.find(m => m.premium)
            if (premiumModel) {
                contextWithoutUser.session!.model = premiumModel
            }

            await processCommand(contextWithoutUser, 'test message')

            // Should handle missing user gracefully
            expect(contextWithoutUser.reply).toHaveBeenCalledWith(
                expect.stringContaining('Unable to verify user identity'),
                expect.any(Object)
            )
        })

        it('should handle premium model API failures with fallback', async () => {
            const premiumModel = aiModels.find(m => m.premium)
            if (!premiumModel) {
                throw new Error('No premium model found in test setup')
            }

            mockContext.session!.isPremium = true
            mockContext.session!.model = premiumModel

            // Mock axios to fail
            const axios = await import('axios')
            vi.mocked(axios.default.post).mockRejectedValueOnce(new Error('API Error'))

            await processCommand(mockContext as BotContext, 'test message')

            // Should handle the error gracefully
            expect(mockContext.reply).toHaveBeenCalledWith(
                expect.stringContaining('Error'),
                expect.any(Object)
            )
        })
    })

    describe('Premium Service Consistency', () => {
        it('should use consistent Redis key for all operations', async () => {
            // Add user
            mockRedis.sadd.mockResolvedValueOnce(1)
            await testPremiumService.addPremiumUser('123')

            // Check user
            mockRedis.sismember.mockResolvedValueOnce(1)
            await testPremiumService.isPremiumUser('123')

            // List users
            mockRedis.smembers.mockResolvedValueOnce(['123'])
            await testPremiumService.listPremiumUsers()

            // Remove user
            mockRedis.srem.mockResolvedValueOnce(1)
            await testPremiumService.removePremiumUser('123')

            // Verify all operations use the same Redis key
            expect(mockRedis.sadd).toHaveBeenCalledWith('premium_users', '123')
            expect(mockRedis.sismember).toHaveBeenCalledWith('premium_users', '123')
            expect(mockRedis.smembers).toHaveBeenCalledWith('premium_users')
            expect(mockRedis.srem).toHaveBeenCalledWith('premium_users', '123')
        })

        it('should handle concurrent operations safely', async () => {
            // Simulate concurrent add operations
            mockRedis.sadd.mockResolvedValue(1)

            const promises = [
                testPremiumService.addPremiumUser('123'),
                testPremiumService.addPremiumUser('456'),
                testPremiumService.addPremiumUser('789')
            ]

            const results = await Promise.all(promises)
            expect(results).toEqual([true, true, true])
            expect(mockRedis.sadd).toHaveBeenCalledTimes(3)
        })
    })

    describe('Model Configuration Integration', () => {
        it('should have premium models configured correctly', () => {
            const premiumModels = aiModels.filter(m => m.premium)
            const freeModels = aiModels.filter(m => !m.premium)

            expect(premiumModels.length).toBeGreaterThan(0)
            expect(freeModels.length).toBeGreaterThan(0)

            // Check that premium models have the premium property set correctly
            premiumModels.forEach(model => {
                expect(model.premium).toBe(true)
                expect(model.model).toBeDefined()
                expect(model.name).toBeDefined()
            })

            // Check that free models have the premium property set correctly
            freeModels.forEach(model => {
                expect(model.premium).toBe(false)
                expect(model.model).toBeDefined()
                expect(model.name).toBeDefined()
            })
        })

        it('should handle model selection based on premium status', async () => {
            const premiumModel = aiModels.find(m => m.premium)
            const freeModel = aiModels.find(m => !m.premium)

            if (!premiumModel || !freeModel) {
                throw new Error('Required models not found in test setup')
            }

            // Test premium user can use premium model
            mockContext.session!.isPremium = true
            mockContext.session!.model = premiumModel
            await processCommand(mockContext as BotContext, 'test message')
            expect(mockContext.reply).not.toHaveBeenCalledWith(
                expect.stringContaining("don't have access to premium models")
            )

            // Reset mocks
            vi.clearAllMocks()

            // Test non-premium user gets fallback from premium model
            mockContext.session!.isPremium = false
            mockContext.session!.model = premiumModel
            await processCommand(mockContext as BotContext, 'test message')
            expect(mockContext.reply).toHaveBeenCalledWith(
                expect.stringContaining("don't have access to premium models"),
                expect.any(Object)
            )
            expect(mockContext.session!.model.premium).toBe(false)
        })
    })
})