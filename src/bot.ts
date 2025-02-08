import { Bot, API_CONSTANTS, GrammyError, HttpError, session } from "grammy";
import { token } from "./config";
import ai from "./composers/ai";
import { BotContext, initial } from "./context/botContext";

if (!token) {
    throw new Error("BOT_TOKEN is not set");
}

const bot = new Bot<BotContext>(token)

bot.command("start", async (ctx) => {
    await ctx.reply("¡Hola!")
})

bot.on("message", async (ctx, next) => {
    await ctx.react("👀")
    await next()
})


bot.on("message_reaction", async (ctx) => {
    const { emojiAdded } = ctx.reactions();
    if (emojiAdded.includes("🎉")) {
        await ctx.reply("party");
    }
});

bot.use(session({ initial }))
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