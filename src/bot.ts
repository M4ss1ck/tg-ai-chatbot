import { Bot, API_CONSTANTS, GrammyError, HttpError, session } from "grammy";
import { token } from "./config/index.js";
import aiCommands from "./composers/commands.js";
import aiActions from "./composers/actions.js";
import aiFilter from "./composers/filter.js";
import start from "./composers/start.js";
import premiumComposer from "./composers/premium.js";
import premiumMiddleware from "./middlewares/premium.js";
import { BotContext, initial } from "./context/botContext.js";
import { storage } from "./storage/redis.js";

if (!token) {
    throw new Error("BOT_TOKEN is not set");
}

const bot = new Bot<BotContext>(token)

bot.use(session({ initial, storage }));
bot.use(premiumMiddleware);
bot.use(start)
bot.use(premiumComposer)
bot.use(aiCommands)
bot.use(aiActions)
bot.use(aiFilter)

// Try to set commands with retry logic
const setCommandsWithRetry = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            await aiCommands.setCommands(bot);
            console.log("Bot commands set successfully");
            return;
        } catch (error) {
            console.warn(`Failed to set commands (attempt ${i + 1}/${retries}):`, error instanceof Error ? error.message : error);
            if (i === retries - 1) {
                console.error("Failed to set commands after all retries. Bot will continue without command menu.");
            } else {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
    }
};

console.log("BOT STARTED")

bot.start({
    allowed_updates: API_CONSTANTS.ALL_UPDATE_TYPES,
    drop_pending_updates: true,
});

// Set commands after bot starts
setCommandsWithRetry();

bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
        console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
        console.error("Could not contact Telegram:", e);
    } else {
        console.error("Unknown error:", e);
    }
});