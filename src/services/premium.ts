import { Redis } from "ioredis";
import { redisUrl } from "../config/index.js";

if (!redisUrl) {
    throw new Error("REDIS_URL is not set");
}

export class PremiumService {
    private redis: Redis;
    private readonly PREMIUM_USERS_KEY = "premium_users";
    private isConnected: boolean = false;
    private connectionRetries: number = 0;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1 second

    constructor() {
        this.redis = new Redis(redisUrl!, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
        });

        // Set up connection event handlers
        this.redis.on('connect', () => {
            console.log('Redis connected successfully');
            this.isConnected = true;
            this.connectionRetries = 0;
        });

        this.redis.on('error', (error) => {
            console.error('Redis connection error:', error);
            this.isConnected = false;
        });

        this.redis.on('close', () => {
            console.log('Redis connection closed');
            this.isConnected = false;
        });

        this.redis.on('reconnecting', () => {
            console.log('Redis reconnecting...');
            this.isConnected = false;
        });
    }

    /**
     * Ensure Redis connection is available
     * @throws Error if connection cannot be established
     */
    private async ensureConnection(): Promise<void> {
        if (this.isConnected) {
            return;
        }

        try {
            await this.redis.connect();
            this.isConnected = true;
            this.connectionRetries = 0;
        } catch (error) {
            this.connectionRetries++;
            console.error(`Redis connection attempt ${this.connectionRetries} failed:`, error);

            if (this.connectionRetries >= this.MAX_RETRIES) {
                throw new Error(`Failed to connect to Redis after ${this.MAX_RETRIES} attempts. Premium features are temporarily unavailable.`);
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * this.connectionRetries));
            return this.ensureConnection();
        }
    }

    /**
     * Execute Redis operation with error handling and retry logic
     */
    private async executeRedisOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
        try {
            await this.ensureConnection();
            return await operation();
        } catch (error) {
            console.error(`Redis operation '${operationName}' failed:`, error);

            // Check if it's a connection error and retry once
            if (error instanceof Error && (
                error.message.includes('Connection is closed') ||
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('ETIMEDOUT')
            )) {
                console.log(`Retrying Redis operation '${operationName}' after connection error`);
                this.isConnected = false;

                try {
                    await this.ensureConnection();
                    return await operation();
                } catch (retryError) {
                    console.error(`Retry of Redis operation '${operationName}' failed:`, retryError);
                    throw new Error(`Premium service temporarily unavailable. Please try again later.`);
                }
            }

            throw new Error(`Premium service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Validate user ID format
     * @param userId - The user ID to validate
     * @throws Error if user ID is invalid
     */
    private validateUserId(userId: string): void {
        if (!userId || typeof userId !== 'string') {
            throw new Error('User ID is required and must be a string');
        }

        if (!/^\d+$/.test(userId)) {
            throw new Error('User ID must contain only numeric characters');
        }

        if (userId.length === 0 || userId.length > 20) {
            throw new Error('User ID must be between 1 and 20 characters long');
        }
    }

    /**
     * Add a user to the premium users list
     * @param userId - The user ID to add
     * @returns Promise<boolean> - true if user was added, false if already existed
     * @throws Error if user ID is invalid or Redis operation fails
     */
    async addPremiumUser(userId: string): Promise<boolean> {
        this.validateUserId(userId);

        return await this.executeRedisOperation(async () => {
            const result = await this.redis.sadd(this.PREMIUM_USERS_KEY, userId);
            return result === 1; // Returns 1 if new member, 0 if already existed
        }, 'addPremiumUser');
    }

    /**
     * Remove a user from the premium users list
     * @param userId - The user ID to remove
     * @returns Promise<boolean> - true if user was removed, false if didn't exist
     * @throws Error if user ID is invalid or Redis operation fails
     */
    async removePremiumUser(userId: string): Promise<boolean> {
        this.validateUserId(userId);

        return await this.executeRedisOperation(async () => {
            const result = await this.redis.srem(this.PREMIUM_USERS_KEY, userId);
            return result === 1; // Returns 1 if member was removed, 0 if didn't exist
        }, 'removePremiumUser');
    }

    /**
     * Check if a user is in the premium users list
     * @param userId - The user ID to check
     * @returns Promise<boolean> - true if user is premium, false otherwise (defaults to false on error)
     */
    async isPremiumUser(userId: string): Promise<boolean> {
        try {
            this.validateUserId(userId);

            return await this.executeRedisOperation(async () => {
                const result = await this.redis.sismember(this.PREMIUM_USERS_KEY, userId);
                return result === 1; // Returns 1 if member exists, 0 if not
            }, 'isPremiumUser');
        } catch (error) {
            console.error(`Error checking premium status for user ${userId}:`, error);
            // For premium checks, default to false on error to avoid blocking users
            return false;
        }
    }

    /**
     * Get all premium users
     * @returns Promise<string[]> - Array of premium user IDs
     * @throws Error if Redis operation fails
     */
    async listPremiumUsers(): Promise<string[]> {
        return await this.executeRedisOperation(async () => {
            return await this.redis.smembers(this.PREMIUM_USERS_KEY);
        }, 'listPremiumUsers');
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