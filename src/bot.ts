import { Bot, API_CONSTANTS, GrammyError, HttpError, session } from "grammy";
import { token } from "./config";
import ai from "./composers/ai";
import start from "./composers/start";
import { BotContext, initial } from "./context/botContext";

if (!token) {
    throw new Error("BOT_TOKEN is not set");
}

const bot = new Bot<BotContext>(token)

bot.use(session({ initial }))
bot.use(start)
bot.use(ai)

bot.start({
    allowed_updates: API_CONSTANTS.ALL_UPDATE_TYPES,
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