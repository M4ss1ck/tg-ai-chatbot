import { Composer, InlineKeyboard } from "grammy";
import { aiModels } from "../config";
import { BotContext } from "../context/botContext";
import { processCommand } from "../utils/ai";

const ai = new Composer<BotContext>();

ai.command("model", async (ctx) => {
    const text = `Select your AI model:\n${aiModels.map(model => `- ${model.name} (${model.model})`).join('\n')}`
    const buttons = aiModels.map((model, index) => [InlineKeyboard.text(model.name, `set_model_${index}`)])
    const keyboard = InlineKeyboard.from(buttons)
    await ctx.reply(text, {
        reply_markup: keyboard
    })
})

ai.command("info", async (ctx) => {
    const model = ctx.session.model.model
    await ctx.reply(`Your are currently using ${model}`)
})

ai.callbackQuery(/set_model_(\d+)/i, async ctx => {
    if ('data' in ctx.callbackQuery && ctx.from?.id) {
        await ctx.answerCallbackQuery().catch(console.log)
        const [, indexString] = ctx.callbackQuery.data.match(/set_model_(\d+)/i) || [null, '1']
        const index = parseInt(indexString ?? '1')
        const model = aiModels[index].model
        ctx.session.model = aiModels[index]
        await ctx.reply(`Your AI model has been set to ${model}`)
    }
})


// ai.command(["ai", "ia"], async (ctx) => {
//     await processCommand(ctx, ctx.match)
// });

ai.on("message", async (ctx) => {
    if (ctx.msg.reply_to_message?.from?.id === ctx.me.id || ctx.chat.type === "private") {
        await ctx.react("👀").catch(console.log)
        if (ctx.msg.text)
            await processCommand(ctx, ctx.msg.text)
    }
})

export default ai;