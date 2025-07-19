import { Composer } from "grammy";
import { BotContext } from "../context/botContext.js";
import { premiumService } from "../services/premium.js";
import { adminId } from "../config/index.js";

/**
 * Premium status loading middleware
 * Checks and loads user premium status into session before other composers process requests
 */
const premiumMiddleware = new Composer<BotContext>();

premiumMiddleware.use(async (ctx, next) => {
    // Get user ID from the context
    const userId = ctx.from?.id?.toString();

    if (!userId) {
        // If no user ID is available, continue with default non-premium status
        ctx.session.isPremium = false;
        await next();
        return;
    }

    try {
        let isPremium = false;

        // Check if user is the admin (automatic premium access)
        if (adminId && userId === adminId) {
            isPremium = true;
            console.log(`Admin user ${userId} granted automatic premium access`);
        } else {
            // Check premium status from Redis with timeout
            const premiumCheckPromise = premiumService.instance.isPremiumUser(userId);
            const timeoutPromise = new Promise<boolean>((_, reject) => {
                setTimeout(() => reject(new Error('Premium status check timeout')), 5000);
            });

            try {
                isPremium = await Promise.race([premiumCheckPromise, timeoutPromise]);
            } catch (timeoutError) {
                console.warn(`Premium status check timed out for user ${userId}, defaulting to non-premium`);
                isPremium = false;
            }
        }

        // Update session with premium status
        ctx.session.isPremium = isPremium;

        // Continue to next middleware/handler
        await next();
    } catch (error) {
        console.error("Error loading premium status for user", userId, ":", error);

        // On error, default to non-premium status and continue
        // This ensures the bot continues to function even if Redis is down
        ctx.session.isPremium = false;

        // Log specific error types for debugging
        if (error instanceof Error) {
            if (error.message.includes('Premium features are temporarily unavailable')) {
                console.warn(`Redis connection failed for user ${userId}, continuing with non-premium access`);
            } else if (error.message.includes('Premium service temporarily unavailable')) {
                console.warn(`Premium service error for user ${userId}, continuing with non-premium access`);
            } else {
                console.warn(`Unexpected premium service error for user ${userId}:`, error.message);
            }
        }

        await next();
    }
});

export default premiumMiddleware;