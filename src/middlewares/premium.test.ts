import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BotContext } from '../context/botContext.js'

// Mock the premium service
const mockIsPremiumUser = vi.fn()

vi.mock('../services/premium.js', () => ({
    premiumService: {
        instance: {
            isPremiumUser: mockIsPremiumUser
        }
    }
}))

// Mock config
vi.mock('../config/index.js', () => ({
    adminId: '999999999'
}))

// Import after mocking
const premiumMiddleware = await import('./premium.js')

describe('Premium Middleware', () => {
    let mockContext: Partial<BotContext>
    let mockNext: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.clearAllMocks()
        mockNext = vi.fn()

        mockContext = {
            session: {
                isPremium: false,
                model: {} as any,
                availableModels: [],
                history: [],
                initialPrompt: {} as any
            },
            from: {
                id: 123456,
                is_bot: false,
                first_name: 'Test'
            }
        }
    })

    it('should set isPremium to true for admin user', async () => {
        mockContext.from!.id = 999999999 // Admin ID

        await premiumMiddleware.default.middleware()(mockContext as BotContext, mockNext)

        expect(mockContext.session!.isPremium).toBe(true)
        expect(mockIsPremiumUser).not.toHaveBeenCalled()
        expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('should set isPremium to true for premium user from Redis', async () => {
        mockIsPremiumUser.mockResolvedValue(true)

        await premiumMiddleware.default.middleware()(mockContext as BotContext, mockNext)

        expect(mockContext.session!.isPremium).toBe(true)
        expect(mockIsPremiumUser).toHaveBeenCalledWith('123456')
        expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('should set isPremium to false for non-premium user', async () => {
        mockIsPremiumUser.mockResolvedValue(false)

        await premiumMiddleware.default.middleware()(mockContext as BotContext, mockNext)

        expect(mockContext.session!.isPremium).toBe(false)
        expect(mockIsPremiumUser).toHaveBeenCalledWith('123456')
        expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('should continue with default non-premium status when no user ID available', async () => {
        const contextWithoutUser = {
            ...mockContext,
            from: undefined
        }

        await premiumMiddleware.default.middleware()(contextWithoutUser as BotContext, mockNext)

        expect(mockIsPremiumUser).not.toHaveBeenCalled()
        expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('should handle Redis errors gracefully and default to non-premium', async () => {
        mockIsPremiumUser.mockRejectedValue(new Error('Redis connection failed'))
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

        await premiumMiddleware.default.middleware()(mockContext as BotContext, mockNext)

        expect(mockContext.session!.isPremium).toBe(false)
        expect(consoleSpy).toHaveBeenCalledWith(
            'Error loading premium status for user',
            '123456',
            ':',
            expect.any(Error)
        )
        expect(mockNext).toHaveBeenCalledTimes(1)

        consoleSpy.mockRestore()
    })

    it('should handle admin ID as string comparison correctly', async () => {
        mockContext.from!.id = 999999999 // Admin ID as number

        await premiumMiddleware.default.middleware()(mockContext as BotContext, mockNext)

        expect(mockContext.session!.isPremium).toBe(true)
        expect(mockIsPremiumUser).not.toHaveBeenCalled()
        expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('should check Redis for non-admin users even with similar IDs', async () => {
        mockContext.from!.id = 99999999 // Similar but not admin ID
        mockIsPremiumUser.mockResolvedValue(false)

        await premiumMiddleware.default.middleware()(mockContext as BotContext, mockNext)

        expect(mockContext.session!.isPremium).toBe(false)
        expect(mockIsPremiumUser).toHaveBeenCalledWith('99999999')
        expect(mockNext).toHaveBeenCalledTimes(1)
    })
})