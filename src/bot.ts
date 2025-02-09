import { Bot, API_CONSTANTS, GrammyError, HttpError, session } from "grammy";
import { token } from "./config/index.js";
import aiCommands from "./composers/commands.js";
import aiActions from "./composers/actions.js";
import aiFilter from "./composers/filter.js";
import start from "./composers/start.js";
import { BotContext, initial } from "./context/botContext.js";
import { storage } from "./storage/redis.js";

if (!token) {
    throw new Error("BOT_TOKEN is not set");
}

const bot = new Bot<BotContext>(token)

bot.use(session({ initial, storage }));
bot.use(start)
bot.use(aiCommands)
bot.use(aiActions)
bot.use(aiFilter)

await aiCommands.setCommands(bot)

bot.start({
    allowed_updates: API_CONSTANTS.ALL_UPDATE_TYPES,
    drop_pending_updates: true,
});

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