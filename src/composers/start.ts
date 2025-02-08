import { Composer } from "grammy";
import { BotContext } from "../context/botContext";
import { processCommand } from "../utils/ai";

const start = new Composer<BotContext>();

start.command("start", async (ctx) => {
    await ctx.reply("¡Hola!")
})

start.on("message_reaction", async (ctx) => {
    const { emojiAdded } = ctx.reactions();
    if (emojiAdded.includes("🎉")) {
        await ctx.reply("Party time!");
    }
});

export default start;