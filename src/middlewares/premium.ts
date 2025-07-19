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
        await next();
        return;
    }

    try {
        let isPremium = false;

        // Check if user is the admin (automatic premium access)
        if (adminId && userId === adminId) {
            isPremium = true;
        } else {
            // Check premium status from Redis
            isPremium = await premiumService.instance.isPremiumUser(userId);
        }

        // Update session with premium status
        ctx.session.isPremium = isPremium;

        // Continue to next middleware/handler
        await next();
    } catch (error) {
        console.error("Error loading premium status for user", userId, ":", error);

        // On error, default to non-premium status and continue
        ctx.session.isPremium = false;
        await next();
    }
});

export default premiumMiddleware;