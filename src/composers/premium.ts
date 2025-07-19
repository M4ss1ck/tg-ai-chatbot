import { CommandGroup } from "@grammyjs/commands";
import { Composer, InlineKeyboard } from "grammy";
import { BotContext } from "../context/botContext.js";
import { premiumService } from "../services/premium.js";
import { adminId } from "../config/index.js";

const premiumAdminCommands = new CommandGroup<BotContext>();
const premiumCallbacks = new Composer<BotContext>();

/**
 * Check if the user is authorized to use admin commands
 */
function isAuthorized(ctx: BotContext): boolean {
    const userId = ctx.from?.id?.toString();
    return userId === adminId;
}

/**
 * Validate user ID format (basic check for callback queries)
 */
function isValidUserId(userId: string): boolean {
    return /^\d+$/.test(userId) && userId.length > 0;
}

/**
 * Get user ID from command arguments or replied message
 */
function getUserIdFromContext(ctx: BotContext): string | null {
    const commandArg = typeof ctx.match === 'string' ? ctx.match.trim() : '';

    // If command has argument, use it
    if (commandArg) {
        return commandArg;
    }

    // If replying to a message, use the replied user's ID
    if (ctx.message?.reply_to_message?.from?.id) {
        return ctx.message.reply_to_message.from.id.toString();
    }

    return null;
}

premiumAdminCommands.command("addpremium", "Add premium user (Admin only)", async (ctx) => {
    try {
        // Check admin authorization
        if (!isAuthorized(ctx)) {
            await ctx.reply("❌ Unauthorized. This command is only available to administrators.");
            return;
        }

        // Get user ID from command arguments or replied message
        const userIdToAdd = getUserIdFromContext(ctx);

        if (!userIdToAdd) {
            await ctx.reply("❌ Please provide a user ID or reply to a user's message.\n\n**Usage:**\n• `/addpremium <user_id>`\n• Reply to a message with `/addpremium`\n\n**Example:** `/addpremium 123456789`");
            return;
        }

        // Add user to premium list (validation is now handled in the service)
        const wasAdded = await premiumService.instance.addPremiumUser(userIdToAdd);

        if (wasAdded) {
            await ctx.reply(`✅ **Success!** User ${userIdToAdd} has been added to premium users.`);
        } else {
            await ctx.reply(`ℹ️ **Already Premium:** User ${userIdToAdd} is already a premium user.`);
        }
    } catch (error) {
        console.error("Error in addpremium command:", error);

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('User ID must contain only numeric characters')) {
                await ctx.reply("❌ **Invalid User ID:** Please provide a valid numeric user ID (e.g., 123456789).");
            } else if (error.message.includes('User ID must be between')) {
                await ctx.reply("❌ **Invalid User ID:** User ID must be between 1 and 20 characters long.");
            } else if (error.message.includes('Premium service temporarily unavailable')) {
                await ctx.reply("❌ **Service Unavailable:** Premium service is temporarily unavailable. Please try again in a few moments.");
            } else if (error.message.includes('Premium features are temporarily unavailable')) {
                await ctx.reply("❌ **Database Connection Error:** Unable to connect to the premium database. Please contact the administrator if this persists.");
            } else {
                await ctx.reply(`❌ **Error:** ${error.message}`);
            }
        } else {
            await ctx.reply("❌ **Unknown Error:** An unexpected error occurred while adding the premium user. Please try again later.");
        }
    }
});

premiumAdminCommands.command("removepremium", "Remove premium user (Admin only)", async (ctx) => {
    try {
        // Check admin authorization
        if (!isAuthorized(ctx)) {
            await ctx.reply("❌ Unauthorized. This command is only available to administrators.");
            return;
        }

        // Get user ID from command arguments or replied message
        const userIdToRemove = getUserIdFromContext(ctx);

        if (!userIdToRemove) {
            await ctx.reply("❌ Please provide a user ID or reply to a user's message.\n\n**Usage:**\n• `/removepremium <user_id>`\n• Reply to a message with `/removepremium`\n\n**Example:** `/removepremium 123456789`");
            return;
        }

        // Remove user from premium list (validation is now handled in the service)
        const wasRemoved = await premiumService.instance.removePremiumUser(userIdToRemove);

        if (wasRemoved) {
            await ctx.reply(`✅ **Success!** User ${userIdToRemove} has been removed from premium users.`);
        } else {
            await ctx.reply(`ℹ️ **Not Premium:** User ${userIdToRemove} was not a premium user.`);
        }
    } catch (error) {
        console.error("Error in removepremium command:", error);

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('User ID must contain only numeric characters')) {
                await ctx.reply("❌ **Invalid User ID:** Please provide a valid numeric user ID (e.g., 123456789).");
            } else if (error.message.includes('User ID must be between')) {
                await ctx.reply("❌ **Invalid User ID:** User ID must be between 1 and 20 characters long.");
            } else if (error.message.includes('Premium service temporarily unavailable')) {
                await ctx.reply("❌ **Service Unavailable:** Premium service is temporarily unavailable. Please try again in a few moments.");
            } else if (error.message.includes('Premium features are temporarily unavailable')) {
                await ctx.reply("❌ **Database Connection Error:** Unable to connect to the premium database. Please contact the administrator if this persists.");
            } else {
                await ctx.reply(`❌ **Error:** ${error.message}`);
            }
        } else {
            await ctx.reply("❌ **Unknown Error:** An unexpected error occurred while removing the premium user. Please try again later.");
        }
    }
});

premiumAdminCommands.command("listpremium", "List all premium users (Admin only)", async (ctx) => {
    try {
        // Check admin authorization
        if (!isAuthorized(ctx)) {
            await ctx.reply("❌ Unauthorized. This command is only available to administrators.");
            return;
        }

        // Get list of premium users
        const premiumUsers = await premiumService.instance.listPremiumUsers();

        if (premiumUsers.length === 0) {
            const keyboard = InlineKeyboard.from([
                [InlineKeyboard.text("➕ Add Premium User", "premium_add_prompt")]
            ]);
            await ctx.reply("📋 **No Premium Users Found**\n\nThere are currently no premium users in the system.", {
                reply_markup: keyboard
            });
        } else {
            const userList = premiumUsers.map((userId, index) => `${index + 1}. ${userId}`).join('\n');

            // Create buttons for each user (remove) and add button
            const buttons = [];

            // Add remove buttons for each user (max 5 per row to avoid telegram limits)
            for (let i = 0; i < premiumUsers.length; i += 2) {
                const row = [];
                for (let j = i; j < Math.min(i + 2, premiumUsers.length); j++) {
                    row.push(InlineKeyboard.text(`❌ ${premiumUsers[j]}`, `premium_remove_${premiumUsers[j]}`));
                }
                buttons.push(row);
            }

            // Add the "Add Premium User" button at the bottom
            buttons.push([InlineKeyboard.text("➕ Add Premium User", "premium_add_prompt")]);

            const keyboard = InlineKeyboard.from(buttons);

            await ctx.reply(`📋 **Premium Users (${premiumUsers.length}):**\n\n${userList}\n\n💡 Click on a user to remove them or add a new premium user:`, {
                reply_markup: keyboard
            });
        }
    } catch (error) {
        console.error("Error in listpremium command:", error);

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('Premium service temporarily unavailable')) {
                await ctx.reply("❌ **Service Unavailable:** Premium service is temporarily unavailable. Please try again in a few moments.");
            } else if (error.message.includes('Premium features are temporarily unavailable')) {
                await ctx.reply("❌ **Database Connection Error:** Unable to connect to the premium database. Please contact the administrator if this persists.");
            } else {
                await ctx.reply(`❌ **Error:** ${error.message}`);
            }
        } else {
            await ctx.reply("❌ **Unknown Error:** An unexpected error occurred while retrieving the premium users list. Please try again later.");
        }
    }
});

// Callback handler for "Add Premium User" button
premiumCallbacks.callbackQuery("premium_add_prompt", async (ctx) => {
    try {
        // Answer callback immediately for better UX
        await ctx.answerCallbackQuery();

        // Check admin authorization
        if (!isAuthorized(ctx)) {
            await ctx.editMessageText("❌ Unauthorized. This command is only available to administrators.");
            return;
        }

        await ctx.editMessageText("➕ To add a premium user:\n\n1. Use `/addpremium <user_id>`\n2. Or reply to a user's message with `/addpremium`\n\nExample: `/addpremium 123456789`");
    } catch (error) {
        console.error("Error in premium_add_prompt callback:", error);
        await ctx.answerCallbackQuery("❌ An error occurred. Please try again later.");
    }
});

// Callback handler for removing premium users
premiumCallbacks.callbackQuery(/^premium_remove_(\d+)$/, async (ctx) => {
    try {
        // Answer callback immediately for better UX
        await ctx.answerCallbackQuery();

        // Check admin authorization
        if (!isAuthorized(ctx)) {
            await ctx.editMessageText("❌ Unauthorized. This command is only available to administrators.");
            return;
        }

        // Extract user ID from callback data
        const match = ctx.match;
        const userIdToRemove = match[1];

        if (!userIdToRemove || !isValidUserId(userIdToRemove)) {
            await ctx.answerCallbackQuery("❌ Invalid user ID.");
            return;
        }

        // Remove user from premium list
        const wasRemoved = await premiumService.instance.removePremiumUser(userIdToRemove);

        if (wasRemoved) {
            // Refresh the list after removal
            const premiumUsers = await premiumService.instance.listPremiumUsers();

            if (premiumUsers.length === 0) {
                const keyboard = InlineKeyboard.from([
                    [InlineKeyboard.text("➕ Add Premium User", "premium_add_prompt")]
                ]);
                await ctx.editMessageText("📋 **No Premium Users Found**\n\n✅ User removed successfully!", {
                    reply_markup: keyboard
                });
            } else {
                const userList = premiumUsers.map((userId, index) => `${index + 1}. ${userId}`).join('\n');

                // Recreate buttons for remaining users
                const buttons = [];

                for (let i = 0; i < premiumUsers.length; i += 2) {
                    const row = [];
                    for (let j = i; j < Math.min(i + 2, premiumUsers.length); j++) {
                        row.push(InlineKeyboard.text(`❌ ${premiumUsers[j]}`, `premium_remove_${premiumUsers[j]}`));
                    }
                    buttons.push(row);
                }

                buttons.push([InlineKeyboard.text("➕ Add Premium User", "premium_add_prompt")]);
                const keyboard = InlineKeyboard.from(buttons);

                await ctx.editMessageText(`📋 **Premium Users (${premiumUsers.length}):**\n\n${userList}\n\n✅ User ${userIdToRemove} removed successfully!\n\n💡 Click on a user to remove them or add a new premium user:`, {
                    reply_markup: keyboard
                });
            }
        } else {
            await ctx.answerCallbackQuery("ℹ️ User was not a premium user.");
        }
    } catch (error) {
        console.error("Error in premium_remove callback:", error);

        // Handle specific error types for callback queries
        if (error instanceof Error) {
            if (error.message.includes('Premium service temporarily unavailable')) {
                await ctx.answerCallbackQuery("❌ Service temporarily unavailable. Please try again later.");
            } else if (error.message.includes('Premium features are temporarily unavailable')) {
                await ctx.answerCallbackQuery("❌ Database connection error. Please contact administrator.");
            } else {
                await ctx.answerCallbackQuery("❌ An error occurred while removing the premium user.");
            }
        } else {
            await ctx.answerCallbackQuery("❌ An error occurred while removing the premium user.");
        }
    }
});

// Combine commands and callbacks into a single composer
const premiumComposer = new Composer<BotContext>();
premiumComposer.use(premiumAdminCommands);
premiumComposer.use(premiumCallbacks);

export default premiumComposer;