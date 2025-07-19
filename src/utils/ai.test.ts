import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processCommand } from './ai.js';
import { premiumService } from '../services/premium.js';
import type { BotContext } from '../context/botContext.js';
import { aiModels } from '../config/index.js';

// Mock the premium service
vi.mock('../services/premium.js', () => ({
    premiumService: {
        instance: {
            isPremiumUser: vi.fn(),
        }
    }
}));

// Mock axios
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
}));

// Mock config
vi.mock('../config/index.js', async () => {
    const actual = await vi.importActual('../config/index.js');
    return {
        ...actual,
        apiKey: 'test-api-key',
        token: 'test-bot-token',
        adminId: '123456789',
        cloudflareApiToken: 'test-cloudflare-token',
        cloudflareAccountId: 'test-cloudflare-account'
    };
});

describe('processCommand - Premium Model Access Validation', () => {
    let mockCtx: Partial<BotContext>;
    const mockPremiumService = vi.mocked(premiumService.instance);

    beforeEach(() => {
        mockCtx = {
            reply: vi.fn(),
            session: {
                model: aiModels.find(m => m.premium) || aiModels[0], // Start with premium model
                availableModels: aiModels,
                history: [],
                initialPrompt: { role: 'system', content: 'Test prompt' },
                isPremium: false
            },
            msg: {
                message_id: 123,
                text: 'test message'
            },
            from: {
                id: 987654321
            },
            api: {
                getFile: vi.fn()
            }
        } as any;

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should allow premium users to use premium models', async () => {
        // Setup: User has premium access
        mockPremiumService.isPremiumUser.mockResolvedValue(true);

        // Set session to use premium model
        const premiumModel = aiModels.find(m => m.premium);
        if (premiumModel) {
            mockCtx.session!.model = premiumModel;
        }

        await processCommand(mockCtx as BotContext, 'test message');

        // Should not call reply with error message
        expect(mockCtx.reply).not.toHaveBeenCalledWith(
            expect.stringContaining("don't have access to premium models")
        );

        // Should check premium status
        expect(mockPremiumService.isPremiumUser).toHaveBeenCalledWith('987654321');
    });

    it('should fallback non-premium users from premium models to free models', async () => {
        // Setup: User does not have premium access
        mockPremiumService.isPremiumUser.mockResolvedValue(false);

        // Set session to use premium model
        const premiumModel = aiModels.find(m => m.premium);
        if (premiumModel) {
            mockCtx.session!.model = premiumModel;
        }

        await processCommand(mockCtx as BotContext, 'test message');

        // Should call reply with fallback message
        expect(mockCtx.reply).toHaveBeenCalledWith(
            expect.stringContaining("don't have access to premium models"),
            expect.any(Object)
        );

        // Should update session to use free model
        expect(mockCtx.session!.model.premium).toBe(false);
    });

    it('should allow admin to use premium models without checking premium status', async () => {
        // Setup: User is admin
        mockCtx.from!.id = 123456789; // This matches adminId in mock

        // Set session to use premium model
        const premiumModel = aiModels.find(m => m.premium);
        if (premiumModel) {
            mockCtx.session!.model = premiumModel;
        }

        await processCommand(mockCtx as BotContext, 'test message');

        // Should not call premium service for admin
        expect(mockPremiumService.isPremiumUser).not.toHaveBeenCalled();

        // Should not call reply with error message
        expect(mockCtx.reply).not.toHaveBeenCalledWith(
            expect.stringContaining("don't have access to premium models")
        );
    });

    it('should handle premium service errors gracefully', async () => {
        // Setup: Premium service throws error
        mockPremiumService.isPremiumUser.mockRejectedValue(new Error('Redis connection failed'));

        // Set session to use premium model
        const premiumModel = aiModels.find(m => m.premium);
        if (premiumModel) {
            mockCtx.session!.model = premiumModel;
        }

        await processCommand(mockCtx as BotContext, 'test message');

        // Should call reply with error message
        expect(mockCtx.reply).toHaveBeenCalledWith(
            expect.stringContaining("Unable to verify premium access"),
            expect.any(Object)
        );
    });

    it('should allow free models without premium checks', async () => {
        // Setup: Use free model
        const freeModel = aiModels.find(m => !m.premium);
        if (freeModel) {
            mockCtx.session!.model = freeModel;
        }

        await processCommand(mockCtx as BotContext, 'test message');

        // Should not check premium status for free models
        expect(mockPremiumService.isPremiumUser).not.toHaveBeenCalled();

        // Should not call reply with premium error
        expect(mockCtx.reply).not.toHaveBeenCalledWith(
            expect.stringContaining("don't have access to premium models")
        );
    });

    it('should handle missing user ID gracefully', async () => {
        // Setup: Create context without user ID
        const mockCtxWithoutUser = {
            ...mockCtx,
            from: undefined
        } as any;

        // Set session to use premium model
        const premiumModel = aiModels.find(m => m.premium);
        if (premiumModel) {
            mockCtxWithoutUser.session!.model = premiumModel;
        }

        await processCommand(mockCtxWithoutUser as BotContext, 'test message');

        // Should call reply with identity error
        expect(mockCtxWithoutUser.reply).toHaveBeenCalledWith(
            expect.stringContaining("Unable to verify user identity"),
            expect.any(Object)
        );
    });

    it('should handle Cloudflare provider correctly', async () => {
        // Setup: User has premium access and uses Cloudflare model
        mockPremiumService.isPremiumUser.mockResolvedValue(true);

        // Set session to use Cloudflare model
        const cloudflareModel = aiModels.find(m => m.provider === 'cloudflare');
        if (cloudflareModel) {
            mockCtx.session!.model = cloudflareModel;
        }

        await processCommand(mockCtx as BotContext, 'test message');

        // Should not call reply with error message
        expect(mockCtx.reply).not.toHaveBeenCalledWith(
            expect.stringContaining("don't have access to premium models")
        );

        // Should check premium status
        expect(mockPremiumService.isPremiumUser).toHaveBeenCalledWith('987654321');
    });
});