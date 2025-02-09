import { Composer } from "grammy";
import { BotContext } from "../context/botContext.js";
import { processCommand } from "../utils/ai.js";

const aiFilter = new Composer<BotContext>();

aiFilter.on("message", async (ctx) => {
    if (ctx.msg.reply_to_message?.from?.id === ctx.me.id || ctx.chat.type === "private") {
        const message = ctx.msg.text ?? ctx.msg.caption
        if (message) {
            await ctx.react("👀").catch(console.log)
            await processCommand(ctx, message)
        }
    }
})

export default aiFilter;