import { Redis } from "ioredis";
import { redisUrl } from "../config/index.js";

if (!redisUrl) {
    throw new Error("REDIS_URL is not set");
}

export class PremiumService {
    private redis: Redis;
    private readonly PREMIUM_USERS_KEY = "premium_users";

    constructor() {
        this.redis = new Redis(redisUrl!); // Use non-null assertion since we checked above
    }

    /**
     * Add a user to the premium users list
     * @param userId - The user ID to add
     * @returns Promise<boolean> - true if user was added, false if already existed
     */
    async addPremiumUser(userId: string): Promise<boolean> {
        const result = await this.redis.sadd(this.PREMIUM_USERS_KEY, userId);
        return result === 1; // Returns 1 if new member, 0 if already existed
    }

    /**
     * Remove a user from the premium users list
     * @param userId - The user ID to remove
     * @returns Promise<boolean> - true if user was removed, false if didn't exist
     */
    async removePremiumUser(userId: string): Promise<boolean> {
        const result = await this.redis.srem(this.PREMIUM_USERS_KEY, userId);
        return result === 1; // Returns 1 if member was removed, 0 if didn't exist
    }

    /**
     * Check if a user is in the premium users list
     * @param userId - The user ID to check
     * @returns Promise<boolean> - true if user is premium, false otherwise
     */
    async isPremiumUser(userId: string): Promise<boolean> {
        const result = await this.redis.sismember(this.PREMIUM_USERS_KEY, userId);
        return result === 1; // Returns 1 if member exists, 0 if not
    }

    /**
     * Get all premium users
     * @returns Promise<string[]> - Array of premium user IDs
     */
    async listPremiumUsers(): Promise<string[]> {
        return await this.redis.smembers(this.PREMIUM_USERS_KEY);
    }

    /**
     * Close the Redis connection
     */
    async close(): Promise<void> {
        await this.redis.quit();
    }
}

// Export a singleton instance - created lazily to avoid issues with testing
let _premiumService: PremiumService | null = null;

export const premiumService = {
    get instance(): PremiumService {
        if (!_premiumService) {
            _premiumService = new PremiumService();
        }
        return _premiumService;
    },

    // For testing purposes
    reset(): void {
        if (_premiumService) {
            _premiumService.close();
            _premiumService = null;
        }
    }
};