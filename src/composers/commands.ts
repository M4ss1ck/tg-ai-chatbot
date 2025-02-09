import { InlineKeyboard } from "grammy";
import { CommandGroup } from "@grammyjs/commands";
import { aiModels, aiPrompts } from "../config/index.js";
import { BotContext } from "../context/botContext.js";
import { processCommand } from "../utils/ai.js";

const aiCommands = new CommandGroup<BotContext>();

aiCommands.command("model", "Select your AI model", async (ctx) => {
    const text = `Select your AI model:\n${aiModels.map(model => `- ${model.name} (${model.model})`).join('\n')}`
    const buttons = aiModels.map((model, index) => [InlineKeyboard.text(model.name, `set_model_${index}`)])
    const keyboard = InlineKeyboard.from(buttons)
    await ctx.reply(text, {
        reply_markup: keyboard
    })
})

aiCommands.command("info", "Show current AI model", async (ctx) => {
    const model = ctx.session.model.model
    await ctx.reply(`Your are currently using ${model}`)
})

aiCommands.command("reset", "Reset chat history", async (ctx) => {
    await ctx.reply("Resetting history...")
    ctx.session.history = []
    ctx.session.initialPrompt = {
        role: "system",
        content: aiPrompts[0].text
    }
    await ctx.reply("History reset.")
})

aiCommands.command("ask", "Ask AI", async (ctx) => {
    await processCommand(ctx, ctx.match)
});

export default aiCommands;